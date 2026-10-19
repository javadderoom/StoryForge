import type { CheckResolution, PlayerState } from '@/lib/types/gameplay';
import type { WorldBible } from '@/lib/types/world';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';

export type ContinuityIssueType =
  | 'ghost_npc'          // An NPC appeared who is not in this location or party roster
  | 'repeated_event'     // Amnesia / Repetition of an event/dialogue from recent scenes
  | 'outcome_disconnect' // Prose contradicts mechanical check/dice outcome
  | 'lore_contradiction' // Contradicts world laws, location rules, or canon
  | 'other';             // Other continuity defect

export interface RemakeValidationInput {
  issueType: ContinuityIssueType;
  reason: string;
  narrativeProse?: string;
  playerActionText?: string;
  resolution?: CheckResolution | null;
  playerState?: PlayerState | null;
  worldBible?: WorldBible | null;
  language?: string;
  sessionTurns?: Array<{ turnNumber?: number; narrativeProse?: string; playerActionText?: string }>;
}

export interface RemakeValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  verifiedDirective?: string;
}

const DICE_CHEATING_REGEX_FA =
  /(?:پیروز شدم|موفق شدم|نباختم|شکست نخوردم|آسیب نبینم|نزدم|چرا خون کم شد|چرا ضربه خوردم|باید موفق می‌شدم|آسیب ندیدم|دمیج نخورم|تاسم رو عوض کن|تاس رو تغییر بده)/i;

const DICE_CHEATING_REGEX_EN =
  /(?:didn't fail|should succeed|no damage|didn't get hit|i won|undo damage|remove injury|reroll dice|change my roll|didn't lose hp)/i;

const INJECTION_REGEX =
  /(?:ignore (?:all )?previous instructions|system prompt|disregard instructions|you are now|developer mode)/i;

/**
 * Validates player-submitted scene remake reasons to prevent:
 * 1. Frivolous / spam inputs (< 10 chars).
 * 2. Overturning legitimate failed dice checks or damage.
 * 3. Prompt injections and secret fishing.
 */
export class RemakeValidator {
  public static validate(input: RemakeValidationInput): RemakeValidationResult {
    const rawReason = (input.reason || '').trim();
    const isPersian = input.language === 'fa' || /[\u0600-\u06FF]/.test(rawReason || input.narrativeProse || '');

    // 1. Length & Substance Check
    if (rawReason.length < 10) {
      return {
        isValid: false,
        rejectionReason: isPersian
          ? 'لطفاً توضیح کوتاهی (حداقل ۱۰ حرف) دربارهٔ ناهماهنگی یا خطای تداوم صحنه بنویسید.'
          : 'Please provide a brief explanation (at least 10 characters) of the continuity issue.',
      };
    }

    // 2. Prompt Injection Defense
    if (INJECTION_REGEX.test(rawReason)) {
      return {
        isValid: false,
        rejectionReason: isPersian
          ? 'دستورات سیستمی در بازسازی صحنه مجاز نیستند.'
          : 'System instructions and prompt injections are not permitted.',
      };
    }

    // 3. Secret Fishing Defense
    if (input.playerState && input.worldBible) {
      const secretLeak = ActionValidator.detectUndiscoveredSecret(
        rawReason,
        input.playerState,
        input.worldBible
      );
      if (secretLeak) {
        return {
          isValid: false,
          rejectionReason: isPersian
            ? 'متن دلیل شامل ارجاع به رازهایی است که هنوز در بازی کشف نشده‌اند.'
            : 'Reason references secrets that have not yet been discovered in the story.',
        };
      }
    }

    // 4. Dice Outcome Overturn Defense (Cheating Defense)
    const outcome = input.resolution?.outcome;
    const isFailedCheck = outcome === 'failure' || outcome === 'critical_failure' || outcome === 'mixed_success';

    if (isFailedCheck) {
      const cheats = isPersian
        ? DICE_CHEATING_REGEX_FA.test(rawReason)
        : DICE_CHEATING_REGEX_EN.test(rawReason);

      if (cheats) {
        const dc = input.resolution?.difficultyClass ?? 10;
        const score = input.resolution?.totalScore ?? input.resolution?.diceRoll ?? 0;
        return {
          isValid: false,
          rejectionReason: isPersian
            ? `نتیجهٔ تاس این اقدام (${score} در برابر سختی ${dc}) قطعی است و بازسازی نمی‌تواند نتیجهٔ تاس یا آسیب را تغییر دهد. بازسازی فقط برای تصحیح روایت و ناهماهنگی است.`
            : `The check outcome (${score} vs DC ${dc}) is canonical and cannot be overturned. Remakes only correct narrative continuity and hallucinations.`,
        };
      }
    }

    // 5. Build Verified Directive for PromptAssembler & Narrative Writer
    const categoryLabels: Record<ContinuityIssueType, { en: string; fa: string }> = {
      ghost_npc: {
        en: 'Ghost NPC / Impossible Character Presence',
        fa: 'حضور ناممکن یا بدون پیش‌زمینهٔ شخصیت',
      },
      repeated_event: {
        en: 'Amnesia / Repeated Narrative Beat',
        fa: 'تکرار رویداد یا دیالوگ صحنهٔ پیشین',
      },
      outcome_disconnect: {
        en: 'Narrative & Outcome Disconnect',
        fa: 'ناهماهنگی توصیف روایت با نتیجهٔ اقدام',
      },
      lore_contradiction: {
        en: 'World Lore or Setting Law Contradiction',
        fa: 'تناقض با قوانین یا دانسته‌های جهان داستان',
      },
      other: {
        en: 'Narrative Continuity Error',
        fa: 'خطای تداوم و منطق روایی',
      },
    };

    const catLabel = isPersian
      ? categoryLabels[input.issueType]?.fa || input.issueType
      : categoryLabels[input.issueType]?.en || input.issueType;

    const outcomeText = input.resolution
      ? `Mechanical Outcome: ${input.resolution.outcome} (Score ${input.resolution.totalScore ?? input.resolution.diceRoll})`
      : 'Diceless Action';

    const verifiedDirective = isPersian
      ? `[دستور بازنویسی صحنه به دلیل ناهماهنگی روایی]
دسته‌بندی خطا: ${catLabel}
گزارش خواننده: «${rawReason}»
قوانین الزامی بازنویسی:
۱. نقص و ناهماهنگی گزارش‌شده را کاملاً برطرف کن و شخصیت‌ها، رویدادها یا دیالوگ‌های تکراری/ناممکن را از صحنه حذف نما.
۲. نتیجه و پیامد مکانیکی اقدام (${outcomeText}) و تغییرات ایجادشده را کاملاً حفظ کن؛ بازنویسی نباید نتیجه را از شکست به پیروزی یا بالعکس تغییر دهد.
۳. روایت جدید باید بین ۲۵۰ تا ۵۰۰ کلمه و در ۴ بند مشخص، زنده و پرکشش بازآفرینی شود.`
      : `[CONTINUITY DISPUTE REWRITE DIRECTIVE]
Issue Category: ${catLabel}
Reader Finding: "${rawReason}"
CRITICAL REWRITE RULES:
1. Completely resolve the reported continuity defect, eliminating any impossible characters, repeated beats, or contradictions.
2. STRICTLY preserve the mechanical outcome (${outcomeText}) and state changes; do not invert success or failure.
3. Generate rich, immersive narrative prose of 250-500 words across 4 well-developed paragraphs.`;

    return {
      isValid: true,
      verifiedDirective,
    };
  }
}
