import { GoogleGenAI } from '@google/genai';
import { GenerationPromptPayload } from '../engines/narrative/PromptAssembler';
import {
  SceneModelCall,
  SceneModelOptions,
  RawSceneResult,
  RawSceneData,
  defaultSceneModelCall,
} from '../engines/narrative/modelCall';
import { STAT_CANONICAL_ALIASES } from '../engines/world/ActionNormalizer';
import { ChoiceOption, ActionStyle, RiskLevel } from '../types/gameplay';
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
    const text = typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : defaultChoiceText;

    const style = VALID_ACTION_STYLES.has(raw.style as string) ? (raw.style as ActionStyle) : 'tactical';
    const riskLevelRaw =
      VALID_RISK_LEVELS.has(raw.riskLevel as string)
        ? (raw.riskLevel as RiskLevel)
        : VALID_RISK_LEVELS.has(raw.risk_level as string)
        ? (raw.risk_level as RiskLevel)
        : 'medium';
    const riskLevel: RiskLevel = riskLevelRaw;

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
        const [floor, ceiling] = riskLevel === 'low' ? [7, 8] : riskLevel === 'high' ? [11, 12] : [9, 10];
        targetDC = Math.min(ceiling, Math.max(floor, Math.round(targetDC)));
      } else {
        // Plan 14 — pull a model-assigned DC back inside its risk band so a
        // single mislabeled number never makes a live turn trivial or unrollable.
        targetDC = Math.min(30, Math.max(5, Math.round(targetDC)));
        if (riskLevel === 'low' && (targetDC < 8 || targetDC > 10)) {
          targetDC = targetDC < 8 ? 8 : 10;
        } else if (riskLevel === 'medium' && (targetDC < 11 || targetDC > 13)) {
          targetDC = targetDC < 11 ? 11 : 13;
        } else if (riskLevel === 'high' && (targetDC < 14 || targetDC > 16)) {
          targetDC = targetDC < 14 ? 14 : 16;
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

export interface GeminiAdapterOptions {
  /**
   * Plan 14 — injectable model seam. When provided, scene generation sources its
   * raw (pre-normalization) output from this function instead of the live
   * cascading queue, enabling deterministic record/replay and headless evals.
   * An injected seam that yields nothing never falls through to the network.
   */
  modelCall?: SceneModelCall;
}

export class GeminiAdapter {
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private modelCall: SceneModelCall;
  private hasCustomModelCall: boolean;

  constructor(
    apiKey?: string,
    modelName = 'gemini-2.5-flash',
    options: GeminiAdapterOptions = {}
  ) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    this.modelName = modelName;
    this.hasCustomModelCall = Boolean(options.modelCall);
    this.modelCall = options.modelCall ?? defaultSceneModelCall;
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
      const viaSeam = await this.modelCall(prompt, options);
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
