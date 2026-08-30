import { GoogleGenAI } from '@google/genai';
import { GenerationPromptPayload } from '../engines/narrative/PromptAssembler';
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

/**
 * Plan 08 — deterministic normalization of AI-returned choices.
 * Rejects choices referencing stats that do not exist in the active RPG system
 * (they would silently roll with a 0 modifier), clamps DCs to a sane range,
 * and coerces style/riskLevel into their unions.
 */
export function normalizeChoices(
  rawChoices: unknown,
  validStatIds: string[],
  isEnglish: boolean
): ChoiceOption[] {
  if (!Array.isArray(rawChoices)) return [];
  const statIds = new Set(validStatIds.map((id) => id.toLowerCase()));
  const defaultChoiceText = isEnglish ? 'Proceed forward...' : 'ادامه مسیر...';

  const normalized: ChoiceOption[] = [];
  for (const c of rawChoices) {
    if (!c || typeof c !== 'object') continue;
    const raw = c as Record<string, unknown>;
    const text = typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : defaultChoiceText;

    // A choice whose required stat does not exist in this story would break
    // the next turn's deterministic check — drop it rather than corrupt canon.
    let requiredStatId: string | undefined =
      (raw.requiredStatId as string) ||
      (raw.required_stat_id as string) ||
      (raw.statId as string) ||
      (raw.stat_id as string);
    if (!requiredStatId) continue;
    requiredStatId = requiredStatId.toLowerCase();
    if (!statIds.has(requiredStatId)) continue;

      const style = VALID_ACTION_STYLES.has(raw.style as string) ? (raw.style as ActionStyle) : 'tactical';
    const riskLevelRaw =
      VALID_RISK_LEVELS.has(raw.riskLevel as string)
        ? (raw.riskLevel as RiskLevel)
        : VALID_RISK_LEVELS.has(raw.risk_level as string)
        ? (raw.risk_level as RiskLevel)
        : 'medium';
    const riskLevel: RiskLevel = riskLevelRaw;

    let targetDC =
      typeof raw.targetDC === 'number'
        ? raw.targetDC
        : typeof raw.target_dc === 'number'
        ? raw.target_dc
        : riskLevel === 'high'
        ? 14
        : riskLevel === 'low'
        ? 10
        : 12;
    targetDC = Math.min(30, Math.max(5, Math.round(targetDC)));

    normalized.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : `choice_${normalized.length + 1}`,
      text,
      style,
      riskLevel,
      targetDC,
      requiredStatId,
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

export class GeminiAdapter {
  private client: GoogleGenAI | null = null;
  private modelName: string;

  constructor(apiKey?: string, modelName = 'gemini-2.5-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    this.modelName = modelName;
  }

  /**
   * Generates a complete structured narrative scene and choices.
   */
  public async generateScene(prompt: GenerationPromptPayload): Promise<GeneratedSceneResponse> {
    if (!this.client) {
      // No API key configured (local testing): mock response, flagged as mock.
      return { ...this.generateMockScene(prompt), isMock: true };
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          { role: 'system', parts: [{ text: prompt.systemPrompt }] },
          { role: 'user', parts: [{ text: prompt.userPrompt }] },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.75,
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);

      const defaultNarrative = prompt.isEnglish
        ? 'The scene shifts as the consequences of your choice unfold before you...'
        : 'صحنه به آرامی در برابرت ورق می‌خورد...';

      const validStatIds = Object.keys(prompt.playerStatIds || {});

      return {
        narrative:
          typeof parsed.narrative === 'string' && parsed.narrative.trim()
            ? parsed.narrative
            : defaultNarrative,
        choices: normalizeChoices(parsed.choices, validStatIds, prompt.isEnglish),
        extractedMemories: normalizeExtractedMemories(parsed.extractedMemories),
        isMock: false,
      };
    } catch (error) {
      // Plan 08: a failed generation must NOT silently degrade into fake canon.
      console.error('Gemini API generation error:', error);
      return { ...this.generateMockScene(prompt), isMock: true };
    }
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
