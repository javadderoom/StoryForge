import { GoogleGenAI } from '@google/genai';
import '@/lib/ai/geminiProxy';
import { StreamingJsonNarrativeExtractor } from '../engines/narrative/streamingExtractor';
import { GenerationPromptPayload } from '../engines/narrative/PromptAssembler';
import {
  SceneModelCall,
  SceneModelOptions,
  RawSceneResult,
  RawSceneData,
  defaultSceneModelCall,
} from '../engines/narrative/modelCall';
import { STAT_CANONICAL_ALIASES } from '../engines/world/ActionNormalizer';
import { ChoiceOption, ActionStyle, RiskLevel, PlayerConditionChanges, ConditionChangeEntry } from '../types/gameplay';
import {
  normalizeNpcTrustChanges,
  type DeclaredNpcTrustChange,
} from '../engines/game/npcTrustEngine';
import {
  normalizeClockChanges,
  type DeclaredClockChange,
} from '../engines/game/threatClock';
import { MemoryCategory } from '../types/memory';

export interface ExtractedMemory {
  category: MemoryCategory;
  importance: number;
  summary: string;
}

export interface GeneratedSceneResponse {
  narrative: string;
  choices: ChoiceOption[];
  extractedMemories: ExtractedMemory[];
  encounteredCreatureId?: string;
  /**
   * Plan 17: writer-declared condition lifecycle for THIS scene. Normalized
   * (trimmed kinds, capped arrays) but not yet evidence-checked — the
   * condition reconciler is the authority that applies it to PlayerState.
   */
  playerConditionChanges?: PlayerConditionChanges;
  /**
   * Plan 17 (NPC stance authority): writer-declared trust movement for NPCs it
   * actually wrote into this scene. Normalized and bounded here; the server
   * evidence/presence gate is applied before any state mutation.
   */
  npcTrustChanges?: DeclaredNpcTrustChange[];
  /**
   * Plan 13 follow-up: writer-declared tension-clock movement for the active
   * zone. Normalized and bounded here; the server evidence gate is applied
   * before any state mutation.
   */
  clockChanges?: DeclaredClockChange[];
  /**
   * Plan 08: true when this response came from the offline mock generator
   * (no API key configured, or the API call failed). Mock prose must NEVER be
   * persisted as story canon — callers are expected to reject it (HTTP 503).
   */
  isMock: boolean;
}

const VALID_ACTION_STYLES = new Set([
  'defensive',
  'agile',
  'aggressive',
  'diplomatic',
  'inquisitive',
  'tactical',
  'stealthy',
  'free_text',
]);

const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);

const VALID_MEMORY_CATEGORIES = new Set(['world', 'character', 'story', 'player', 'recent']);

export const CONFRONTATIONAL_CHOICE =
  /(?:threat|intimidat|interrogat|attack|strike|stab|shoot|cast|dodge|sneak|steal|pickpocket|climb|leap|force|coerce|bribe|deceive|sword|blade|weapon|spear|shield|sentry|guard|standoff|crossbow|longbow|bowman|archer|arrow|rifle|musket|pistol|handgun|firearm|bandit|raider|brigand|thug|cutthroat|marauder|ambush|assail|brandish|unsheathe|menace|تهدید|ارعاب|بازجویی|حمله|ضربه|خنجر|شمشیر|سلاح|تیغ|تیغه|نیزه|سپر|شلیک|طلسم|جاخالی|پنهان|مخفی|دزدی|جیب‌بری|زور|اجبار|رشوه|دروغ|فریب|جنگ|درگیری|یورش|گزمه|نگهبان|پاسبان|فرمانده|سرد|تشر|کمان|تیر|تفنگ|خشاب|رهزن|راهزن|تازیانه|غافلگیر)/i;

/**
 * The production standoff detector, scoped to a single choice's text (plus its
 * declared risk). Exported so evaluation harnesses assert the *same* contract
 * the guardrail actually enforces, instead of a coarser prose-level proxy
 * (which falsely flags peaceful choices in any scene that merely mentions a
 * guard).
 */
export function isConfrontationalChoiceText(text: string, riskLevel?: string): boolean {
  return CONFRONTATIONAL_CHOICE.test(text ?? '') || riskLevel === 'high';
}

/**
 * Strips accidental roll-check labels, DC notations, parenthetical skill tags,
 * and outer quotation marks from choice text so choices only display clean,
 * immersive literary narrative prose (the UI badge already indicates the check).
 */
export function cleanChoiceText(rawText: unknown): string {
  if (typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // 1. Strip parenthetical or bracketed check / roll / DC / stat tags first
  // e.g. "(بررسی مهارت)", "(پرتاب تاس)", "(آزمون نیرو)", "[Roll Check]", "(Skill Check: Might)", "[DC 12]", "(D20)"
  text = text.replace(
    /\s*[\(\[\{]\s*(?:roll check|skill check|stat check|ability check|dice check|dice roll|d20 check|d20|check|dc\s*\d+|بررسی مهارت|بررسی صفت|بررسی ویژگی|بررسی تاس|پرتاب تاس|آزمون مهارت|آزمون ویژگی|آزمون صفت|آزمون|تاس)[\s\S]*?[\)\]\}]/gi,
    ''
  ).trim();

  // 2. Strip choice numbering prefixes e.g. "Choice 1:", "گزینه ۲: " (supports Latin, Arabic, and Persian digits)
  text = text.replace(/^(?:choice|گزینه|انتخاب)\s*[\d\u0660-\u0669\u06F0-\u06F9]+\s*[:\-–—]\s*/i, '').trim();

  // 3. Strip surrounding book quotation marks
  text = text.replace(/^[«"“'`]([\s\S]*)[»"”'`]$/, '$1').trim();

  return text;
}

/**
 * Plan 08 — deterministic normalization of AI-returned choices.
 * Rejects choices referencing stats that do not exist in the active RPG system
 * (they would silently roll with a 0 modifier), clamps DCs to a sane range,
 * and coerces style/riskLevel into their unions.
 *
 * Unlike the original strict mode, choices are never silently dropped for
 * terminology drift: synonyms (`strength`→`might`, Persian statutory names,
 * …) are resolved through `STAT_CANONICAL_ALIASES` + the story's authored stat
 * names (`statIdAliases`); an unknown stat value binds to the story's first
 * stat so the next turn still resolves as a real check; and a choice with no
 * stat field at all survives as a safe diceless continuation. This guarantees
 * the reader never receives an empty choice panel merely because the model
 * reworded a stat.
 */
export function normalizeChoices(
  rawChoices: unknown,
  validStatIds: string[],
  isEnglish: boolean,
  isLowBase: boolean = false,
  statIdAliases?: Record<string, string[]>
): ChoiceOption[] {
  if (!Array.isArray(rawChoices)) return [];
  const statIds = new Set(validStatIds.map((id) => id.toLowerCase()));
  const firstStatId = validStatIds.length ? validStatIds[0] : undefined;
  const defaultChoiceText = isEnglish ? 'Proceed forward...' : 'ادامه مسیر...';

  // Canonical id -> alias lookup (ids, common synonyms/typos, story-authored localized names).
  const aliasToStat = new Map<string, string>();
  const registerAlias = (alias: string, canon: string | undefined) => {
    if (!canon || !statIds.has(canon.toLowerCase())) return;
    const key = String(alias).trim().toLowerCase();
    if (key) aliasToStat.set(key, canon);
  };
  for (const id of validStatIds) {
    const canon = id.toLowerCase();
    registerAlias(canon, canon);
    for (const [alias, target] of Object.entries(STAT_CANONICAL_ALIASES)) {
      if (target.toLowerCase() === canon) registerAlias(alias, canon);
    }
    for (const alias of statIdAliases?.[id] ?? []) registerAlias(alias, canon);
  }
  const resolveStat = (value: unknown): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const v = String(value).trim().toLowerCase();
    return v ? aliasToStat.get(v) : undefined;
  };

  const normalized: ChoiceOption[] = [];
  for (const c of rawChoices) {
    if (!c || typeof c !== 'object') continue;
    if (normalized.length >= 4) break;
    const raw = c as Record<string, unknown>;
    const rawText = typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : defaultChoiceText;
    const text = cleanChoiceText(rawText) || defaultChoiceText;

    const style = VALID_ACTION_STYLES.has(raw.style as string) ? (raw.style as ActionStyle) : 'tactical';
    const riskLevelRaw =
      VALID_RISK_LEVELS.has(raw.riskLevel as string)
        ? (raw.riskLevel as RiskLevel)
        : VALID_RISK_LEVELS.has(raw.risk_level as string)
        ? (raw.risk_level as RiskLevel)
        : 'medium';
    let riskLevel: RiskLevel = riskLevelRaw;
    const isSentryConfrontation =
      /(?:گزمه|نگهبان|پاسبان|پاسدار|سربازان|sentry|guard|garrison).*(?:تهدید|ارعاب|عصبانیت|فریاد|تشر|تسلیم|راه را باز|کنار بروید|خرد کردن|یورش|حمله|threaten|intimidat|force|open the gate|stand down|command)/i.test(text) ||
      /(?:تهدید|ارعاب|عصبانیت|فریاد|تشر|تسلیم|راه را باز|کنار بروید|خرد کردن|یورش|حمله|threaten|intimidat|force|open the gate|stand down|command).*(?:گزمه|نگهبان|پاسبان|پاسدار|سربازان|sentry|guard|garrison)/i.test(text);

    if (isSentryConfrontation && riskLevel !== 'high') {
      riskLevel = 'high';
    }

    // Resolve the checked stat from any supported key shape, including the
    // Studio-style `stat` / `check.stat` variants.
    const rawCheck =
      raw.check && typeof raw.check === 'object'
        ? (raw.check as Record<string, unknown>)
        : undefined;
    const rawStatValue =
      (raw.requiredStatId as string) ||
      (raw.required_stat_id as string) ||
      (raw.statId as string) ||
      (raw.stat_id as string) ||
      (typeof raw.stat === 'string' ? (raw.stat as string) : '') ||
      (typeof rawCheck?.stat === 'string' ? (rawCheck.stat as string) : '');
    const hasStatValue = typeof rawStatValue === 'string' && rawStatValue.trim().length > 0;

    let requiredStatId = hasStatValue ? resolveStat(rawStatValue) : undefined;
    // Unknown / unparseable stat value (e.g. `"strength"` in a story with no
    // strength stat): bind to the story's first stat rather than dropping the
    // choice — the reader keeps it and the engine still resolves a real check.
    if (!requiredStatId && hasStatValue && firstStatId) {
      requiredStatId = firstStatId;
    }

    // Safety net: if AI omitted requiredStatId but the choice text or risk indicates
    // a high-stakes, confrontational, threatening, or hazardous action, infer a stat check
    // rather than letting it bypass the RPG dice mechanics as diceless.
    if (!requiredStatId && firstStatId) {
      const isConfrontational = isConfrontationalChoiceText(text, riskLevel);

      if (isConfrontational) {
        if (/(?:threat|intimidat|force|sword|blade|weapon|spear|shield|crossbow|longbow|arrow|rifle|musket|pistol|firearm|brandish|unsheathe|تهدید|ارعاب|زور|اجبار|حمله|ضربه|جنگ|یورش|شمشیر|سلاح|تیغ|تیغه|نیزه|سپر|کمان|تیر|تفنگ)/i.test(text)) {
          requiredStatId =
            resolveStat('might') ||
            resolveStat('strength') ||
            resolveStat('presence') ||
            resolveStat('charisma') ||
            firstStatId;
        } else if (/(?:sneak|steal|pickpocket|dodge|climb|leap|پنهان|مخفی|دزدی|جیب‌بری|جاخالی)/i.test(text)) {
          requiredStatId =
            resolveStat('agility') ||
            resolveStat('dexterity') ||
            resolveStat('cunning') ||
            firstStatId;
        } else if (/(?:interrogat|bribe|deceive|lie|sentry|guard|standoff|بازجویی|رشوه|فریب|دروغ|گزمه|نگهبان|پاسبان|فرمانده|سرد|تشر)/i.test(text)) {
          requiredStatId =
            resolveStat('cunning') ||
            resolveStat('guile') ||
            resolveStat('presence') ||
            resolveStat('charisma') ||
            firstStatId;
        } else {
          requiredStatId = firstStatId;
        }
      }
    }

    let targetDC: number | undefined;
    if (requiredStatId) {
      targetDC =
        typeof raw.targetDC === 'number' && Number.isFinite(raw.targetDC)
          ? raw.targetDC
          : typeof raw.target_dc === 'number' && Number.isFinite(raw.target_dc)
          ? raw.target_dc
          : isLowBase
          ? riskLevel === 'high'
            ? 11
            : riskLevel === 'low'
            ? 7
            : 9
          : riskLevel === 'high'
          ? 14
          : riskLevel === 'low'
          ? 10
          : 12;

      if (isLowBase) {
        // Low-base dynamic progression: low risk 6-8 (default 7), medium 9-12 (default 9), high/heroic 11-18 (default 11)
        const [floor, ceiling] = riskLevel === 'low' ? [6, 8] : riskLevel === 'high' ? [11, 18] : [9, 12];
        targetDC = Math.min(ceiling, Math.max(floor, Math.round(targetDC)));
      } else {
        // Plan 14 — pull a model-assigned DC back inside its risk band so a
        // single mislabeled number never makes a live turn trivial or unrollable.
        targetDC = Math.min(30, Math.max(5, Math.round(targetDC)));
        if (riskLevel === 'low' && (targetDC < 8 || targetDC > 10)) {
          targetDC = targetDC < 8 ? 8 : 10;
        } else if (riskLevel === 'medium' && (targetDC < 11 || targetDC > 13)) {
          targetDC = targetDC < 11 ? 11 : 13;
        } else if (riskLevel === 'high' && (targetDC < 14 || targetDC > 19)) {
          targetDC = targetDC < 14 ? 14 : 19;
        }
      }
    }

    normalized.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : `choice_${normalized.length + 1}`,
      text,
      style,
      riskLevel,
      ...(requiredStatId ? { requiredStatId, targetDC } : {}),
    });
  }
  return normalized.slice(0, 4);
}

/**
 * Plan 08 — deterministic normalization of AI-extracted memories.
 * Clamps importance to 0–10, whitelists categories, drops ephemeral entries
 * (<3) and junk summaries so the memory ledger stays consistent with the
 * MemoryEngine's persistence policy.
 */
export function normalizeExtractedMemories(rawMemories: unknown): ExtractedMemory[] {
  if (!Array.isArray(rawMemories)) return [];
  const out: ExtractedMemory[] = [];
  for (const m of rawMemories) {
    if (!m || typeof m !== 'object') continue;
    const raw = m as Record<string, unknown>;
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
    if (summary.length < 3) continue;

    const category = VALID_MEMORY_CATEGORIES.has(raw.category as string)
      ? (raw.category as MemoryCategory)
      : 'story';
    const importanceRaw = typeof raw.importance === 'number' ? Math.round(raw.importance) : 5;
    const importance = Math.min(10, Math.max(0, importanceRaw));
    if (importance < 3) continue; // ephemeral chit-chat never enters the ledger

    out.push({ category, importance, summary });
  }
  return out;
}

/**
 * Plan 17 — deterministic normalization of the writer's condition-lifecycle
 * channel. Keeps only well-formed entries (non-empty `kind`), caps list sizes,
 * whitelists narrative severities, and trims evidence strings. The condition
 * reconciler later cross-checks every entry against the actual prose before
 * it touches PlayerState.
 */
export function normalizeConditionChanges(raw: unknown): PlayerConditionChanges | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;

  const normalizeList = (list: unknown): ConditionChangeEntry[] => {
    if (!Array.isArray(list)) return [];
    const out: ConditionChangeEntry[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const kind = typeof entry.kind === 'string' ? entry.kind.trim().slice(0, 60) : '';
      if (!kind) continue;
      const severityRaw = typeof entry.severity === 'string' ? entry.severity.trim().toLowerCase() : '';
      const clean: ConditionChangeEntry = {
        kind,
        ...(severityRaw === 'minor' || severityRaw === 'moderate' || severityRaw === 'severe'
          ? { severity: severityRaw }
          : {}),
      };
      const sourceText = typeof entry.source === 'string' ? entry.source.trim().slice(0, 200) : '';
      const methodText = typeof entry.method === 'string' ? entry.method.trim().slice(0, 200) : '';
      const reasonText = typeof entry.reason === 'string' ? entry.reason.trim().slice(0, 200) : '';
      if (sourceText) clean.source = sourceText;
      if (methodText) clean.method = methodText;
      if (reasonText) clean.reason = reasonText;
      out.push(clean);
      if (out.length >= 6) break; // a single turn never rewrites the whole body
    }
    return out;
  };

  const changes: PlayerConditionChanges = {
    add: normalizeList(source.add),
    treat: normalizeList(source.treat),
    remove: normalizeList(source.remove),
  };
  if (!changes.add!.length && !changes.treat!.length && !changes.remove!.length) return undefined;
  return changes;
}

export interface GeminiAdapterOptions {
  /**
   * Plan 14 — injectable model seam. When provided, scene generation sources its
   * raw (pre-normalization) output from this function instead of the live
   * cascading queue, enabling deterministic record/replay and headless evals.
   * An injected seam that yields nothing never falls through to the network.
   */
  modelCall?: SceneModelCall;
  /**
   * Model tried first inside the cascading queue (Studio-managed narrator
   * tier routing). The queue still cascades to the remaining models when the
   * preferred one is rate-limited or unavailable.
   */
  preferredModel?: string;
  /**
   * Thinking (reasoning) token budget for models that support it. Gemini
   * takes its native `thinkingConfig.thinkingBudget`.
   */
  thinkingBudgetTokens?: number;
}

export class GeminiAdapter {
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private modelCall: SceneModelCall;
  private hasCustomModelCall: boolean;
  private preferredModel?: string;
  private thinkingBudgetTokens?: number;

  constructor(
    apiKey?: string,
    modelName = 'gemini-3.5-flash-lite',
    options: GeminiAdapterOptions = {}
  ) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    this.modelName = modelName;
    this.hasCustomModelCall = Boolean(options.modelCall);
    this.modelCall = options.modelCall ?? defaultSceneModelCall;
    this.preferredModel = options.preferredModel;
    this.thinkingBudgetTokens = options.thinkingBudgetTokens;
  }

  /**
   * Plan 14 — returns the RAW (pre-normalization) model payload plus the model
   * that produced it. This is the single choke point all scene generation flows
   * through, so evaluation harnesses can capture unmodified choices.
   */
  public async generateSceneRaw(
    prompt: GenerationPromptPayload,
    options: SceneModelOptions = {}
  ): Promise<RawSceneResult | null> {
    try {
      // The Studio-configured model is tried first inside the cascade; the
      // queue still cascades to the remaining models if it is unavailable.
      const seamOptions: SceneModelOptions = {
        ...options,
        ...(this.preferredModel && !options.preferredModel
          ? { preferredModel: this.preferredModel }
          : {}),
        ...(this.thinkingBudgetTokens && !options.thinkingBudgetTokens
          ? { thinkingBudgetTokens: this.thinkingBudgetTokens }
          : {}),
      };
      const viaSeam = await this.modelCall(prompt, seamOptions);
      if (viaSeam && viaSeam.data) return viaSeam;
    } catch (seamErr) {
      console.warn('[GeminiAdapter] Scene model seam error:', seamErr);
      if (this.hasCustomModelCall) return null;
    }

    // An injected seam that yields nothing must never silently reach the network.
    if (this.hasCustomModelCall) return null;

    // Legacy direct-SDK fallback (the cascading queue returned nothing).
    if (!this.client) return null;
    try {
      if (typeof options.onTextDelta === 'function') {
        const responseStream = await (this.client.models as any).generateContentStream({
          model: this.modelName,
          contents: [
            { role: 'system', parts: [{ text: prompt.systemPrompt }] },
            { role: 'user', parts: [{ text: prompt.userPrompt }] },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: options.temperature ?? 0.75,
          },
        });
        const extractor = new StreamingJsonNarrativeExtractor();
        for await (const chunk of responseStream) {
          const chunkText = chunk.text || '';
          if (chunkText) {
            extractor.pushChunk(chunkText, (delta) => options.onTextDelta?.(delta));
          }
        }
        const text = extractor.getFullRawText() || '{}';
        return {
          data: JSON.parse(text) as RawSceneData,
          rawText: text,
          modelUsed: this.modelName,
        };
      }

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          { role: 'system', parts: [{ text: prompt.systemPrompt }] },
          { role: 'user', parts: [{ text: prompt.userPrompt }] },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: options.temperature ?? 0.75,
        },
      });
      const text = response.text || '{}';
      return {
        data: JSON.parse(text) as RawSceneData,
        rawText: text,
        modelUsed: this.modelName,
      };
    } catch (error) {
      console.error('[GeminiAdapter] Direct API generation error:', error);
      return null;
    }
  }

  /**
   * Generates a complete structured narrative scene and choices using the
   * multi-model cascading queue and Cloudflare proxy manager to prevent 429 rate limits.
   */
  public async generateScene(prompt: GenerationPromptPayload): Promise<GeneratedSceneResponse> {
    return (await this.generateSceneWithRaw(prompt)).response;
  }

  /**
   * Plan 14 — single-call variant returning BOTH the normalized response and the
   * raw model payload. Eval harnesses assert on `raw` (what the model actually
   * produced) while callers consume `response` (guardrail-normalized).
   */
  public async generateSceneWithRaw(
    prompt: GenerationPromptPayload,
    options: SceneModelOptions = {}
  ): Promise<{ response: GeneratedSceneResponse; raw: RawSceneResult | null }> {
    const defaultNarrative = prompt.isEnglish
      ? 'The scene shifts as the consequences of your choice unfold before you...'
      : 'صحنه به آرامی در برابرت ورق می‌خورد...';

    const validStatIds = Object.keys(prompt.playerStatIds || {});

    const raw = await this.generateSceneRaw(prompt, options);

    // Plan 08: no usable output (no key, offline, or API failure) → mock, and the
    // caller is expected to reject it rather than persist fake canon.
    if (!raw) {
      return { response: { ...this.generateMockScene(prompt), isMock: true }, raw: null };
    }

    const parsed = raw.data;
    return {
      raw,
      response: {
        narrative:
          typeof parsed.narrative === 'string' && parsed.narrative.trim()
            ? parsed.narrative
            : defaultNarrative,
        choices: normalizeChoices(
          parsed.choices,
          validStatIds,
          prompt.isEnglish,
          prompt.isLowBase ?? false,
          prompt.statIdAliases
        ),
        extractedMemories: normalizeExtractedMemories(parsed.extractedMemories),
        encounteredCreatureId:
          typeof parsed.encounteredCreatureId === 'string'
            ? parsed.encounteredCreatureId.trim()
            : undefined,
        playerConditionChanges: normalizeConditionChanges(parsed.playerConditionChanges),
        npcTrustChanges: normalizeNpcTrustChanges(parsed.npcTrustChanges),
        clockChanges: normalizeClockChanges(parsed.clockChanges),
        isMock: false,
      },
    };
  }

  /**
   * Mock fallback generator adapted to the requested language. Always flagged
   * with `isMock: true` by generateScene — never persist its output.
   */
  private generateMockScene(prompt: GenerationPromptPayload): Omit<GeneratedSceneResponse, 'isMock'> {
    if (prompt.isEnglish) {
      return {
        narrative:
          'A tense silence hangs in the air as torchlight flickers along the passage. Every breath sends a pale mist into the gloom. Across the corridor, the cadence of approaching footsteps halts abruptly outside the doorway.',
        choices: [
          {
            id: 'choice_en_1',
            text: 'Hold your breath and step deep into the shadows along the wall.',
            style: 'defensive',
            riskLevel: 'low',
            targetDC: 10,
            requiredStatId: 'agility',
          },
          {
            id: 'choice_en_2',
            text: 'Carefully slip your lockpick into the tumblers of the door.',
            style: 'tactical',
            riskLevel: 'medium',
            targetDC: 12,
            requiredStatId: 'cunning',
          },
          {
            id: 'choice_en_3',
            text: 'Draw your weapon and prepare to confront whoever breaches the threshold.',
            style: 'aggressive',
            riskLevel: 'high',
            targetDC: 14,
            requiredStatId: 'might',
          },
        ],
        extractedMemories: [
          {
            category: 'character',
            importance: 6,
            summary: 'Heard approaching footsteps halting outside the doorway',
          },
        ],
      };
    }

    return {
      narrative:
        'سکوت سنگینی بر فضا حاکم است و نوری لرزان از زیر درگاه کهن به داخل می‌تابد. از پشت در، صدای چرخش کلید در قفل به گوش می‌رسد و سایه‌ای پشت شکاف درگاه پدیدار می‌شود.',
      choices: [
        {
          id: 'choice_fa_1',
          text: 'نَفَسَت را در سینه حبس کن و در فرورفتگی تاریک دیوار پناه بگیر.',
          style: 'defensive',
          riskLevel: 'low',
          targetDC: 10,
          requiredStatId: 'agility',
        },
        {
          id: 'choice_fa_2',
          text: 'به آرامی میله قفل‌گشایی را داخل مکانیزم در بلغزان.',
          style: 'tactical',
          riskLevel: 'medium',
          targetDC: 12,
          requiredStatId: 'cunning',
        },
        {
          id: 'choice_fa_3',
          text: 'سلاح خود را بیرون بکش و برای شبیخون در آستانه درگاه آماده شو.',
          style: 'aggressive',
          riskLevel: 'high',
          targetDC: 14,
          requiredStatId: 'might',
        },
      ],
      extractedMemories: [
        {
          category: 'player',
          importance: 6,
          summary: 'بازیکن مسیر راهرو را مخفیانه زیر نظر گرفت.',
        },
      ],
    };
  }
}
