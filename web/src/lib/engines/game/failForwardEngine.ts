// ---------------------------------------------------------------------------
// Plan 18: deterministic Fail Forward engine.
//
// A failed check denies the player's INTENT, not the story. This module is the
// single source of truth for:
//   - what kind of failure this is (investigative / social / physical / travel),
//   - which Fail Forward mode the scene must use (cost, complication, reveal,
//     reposition, escalation, or an authorized hard stop),
//   - an action-appropriate mechanical cost (HP only for bodily risk),
//   - the retry budget (first repeat escalates, second unchanged repeat hard-
//     stops), and authored-gate handling.
//
// Pure and deterministic: no model calls, no state mutation. `actionCheckEngine`
// consumes the returned plan and merges the resource changes into its diff.
// ---------------------------------------------------------------------------

import type {
  DiceOutcome,
  FailureActionKind,
  FailureDirective,
  FailureMode,
} from '@/lib/types/gameplay';
import { detectTravelIntent } from './travelEngine';
import { isPressureAction, isSocialAction } from './socialEngine';

const SOCIAL_PATTERN =
  /persuad|convinc|bargain|negotiat|bribe|deceiv|lie\b|intimidat|threat|blackmail|interrogat|ask\b|tell\b|talk|speak|greet|thank|offer|deal\b|pact\b|contract|accept|refus|promis|plead|beg\b|command|order\b|demand|charm|flatter|apolog|متقاعد|مذاکره|چانه|رشوه|دروغ|فریب|تهدید|ارعاب|باج|بازجویی|پرسیدن|بپرس|بگو|گفتن|صحبت|حرف|سلام|تشکر|پیشنهاد|معامله|قرارداد|پیمان|قبول|بپذیر|رد کن|قول|التماس|خواهش|فرمان|دستور|خواستن|چاپلوسی|عذرخواه/i;

const INVESTIGATIVE_PATTERN =
  /search|examin|inspect|investigat|study|read\b|decipher|translate|track|listen|observ|scout|analy[sz]e|check\b|look for|gather information|recall|remember|research|surveil|جستجو|جست‌وجو|بررسی|وارسی|تحقیق|مطالعه|خواندن|بخوان|رمزگشایی|رمزگشا|ردگیر|ردیابی|گوش دادن|گوش کن|مشاهده|رصد|شناسایی|تحلیل|بررسی کردن|به دنبال|جمع‌آوری اطلاعات|به یاد|یادآوری|پژوهش|تحقیق کن/i;

const STRONG_PHYSICAL_PATTERN =
  /\b(attack|strike|hit|beat|punch|kick|shove|grapple|wrestle|tackle|climb|jump|leap|vault|swim|dive|dodge|parry|stab|slash|shoot|smash|choke|fall|trip|wound|injure|force|push|pull|lift|carry|run\b|sprint|charge)\b|(حمله|مشت|لگد|هل|کشتی|گلاویز|تاخت|دوید|پرید|جهید|بالا رفت|شنا|شیرجه|جاخالی|غلت|چاقو|شمشیر|تیر|پرتاب|خرد کرد|افتاد|سقوط|زخم|زور|فشار|بلند کردن|کشیدن|دوان|یورش)/i;

/** Social idioms that contain a violent-looking verb ("strike a deal"). */
const SOCIAL_IDIOM_PATTERN = /\b(strike|struck|seal|sealed|close|closed)\s+(a\s+)?deal\b|(قرارداد|معامله|پیمان)\s*(بستن|بست|بستم)/i;

const PHYSICAL_STYLES = new Set(['aggressive', 'defensive', 'agile', 'stealthy']);
const INVESTIGATIVE_STYLES = new Set(['inquisitive']);
const SOCIAL_STYLES = new Set(['diplomatic']);

/** Explicit social verbs override a physical-looking style label. */
const EXPLICIT_SOCIAL_PATTERN =
  /persuad|convinc|bribe|negotiat|threaten|intimidat|interrogat|blackmail|lie\b|deceiv|ask\b|talk|speak|greet|thank|offer|apolog|متقاعد|رشوه|مذاکره|تهدید|ارعاب|بازجویی|باج|دروغ|فریب|بپرس|صحبت|سلام|تشکر|پیشنهاد|عذرخواه/i;

const PHYSICAL_STAT_PATTERN =
  /^(might|strength|agility|dexterity|endurance|constitution|athletics|acrobatics|vitality|toughness|نیرو|قدرت|چابکی|استقامت|تن|ورزیدگی)/i;
const INVESTIGATIVE_STAT_PATTERN =
  /^(cunning|intelligence|intellect|wits|perception|investigation|lore|arcana|insight|wisdom|awareness|ذهن|هوش|ادراک|بینش|دانش|شناخت)/i;

const GATE_ACTION_PATTERN =
  /\b(gate|gateway|door|doorway|threshold|bridge|passage|checkpoint|barrier|wall|lock|enter|bypass)\b|\bopen\s+(the\s+)?(gate|door|doorway|lock|passage|barrier|way)\b|\bunlock\s+(the\s+)?(gate|door|lock|passage|barrier|way)\b|\bpass\s+(through|the\s+gate|the\s+door|the\s+checkpoint|the\s+passage)\b|\bcross\s+(the\s+)?(gate|bridge|threshold|checkpoint|barrier|wall)\b|(دروازه|درِ|در بسته|در چوبی|دَر|پل|گذرگاه|معبر|آستانه|دیوار|قفل|ورود|وارد شدن|عبور|گذشتن|دور زدن|رد شدن|سد)/i;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
  'with', 'from', 'into', 'onto', 'over', 'under', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'it', 'this', 'that', 'these', 'those', 'my', 'your',
  'his', 'her', 'their', 'our', 'i', 'you', 'he', 'she', 'they', 'we',
  'do', 'does', 'did', 'try', 'trying', 'again', 'once', 'more',
  'و', 'به', 'از', 'با', 'در', 'بر', 'برای', 'که', 'این', 'آن', 'را', 'تا',
  'هم', 'یا', 'یک', 'می', 'نمی', 'است', 'بود', 'شد', 'شده', 'کرد', 'کن',
  'می‌کنم', 'می‌کنی', 'می‌کند', 'من', 'تو', 'او', 'ما', 'شما', 'آنها',
  'دوباره', 'بار', 'دیگر', 'تلاش',
]);

const MODE_DIRECTIVES: Record<FailureMode, FailureDirective> = {
  cost: {
    en: 'The intent FAILS and the protagonist pays a concrete, causal price for this attempt. Do not grant the goal. The price must arise from this action and from hazards, terrain, opponents, gear, or witnesses already established in the scene.',
    fa: 'قصد بازیکن شکست می‌خورد و قهرمان بهای عینی و علت‌ومعلولی این تلاش را می‌پردازد. هدف را محقق نکن. این بها باید از خودِ اقدام و از خطرها، زمین، دشمنان، تجهیزات یا شاهدانِ از پیش حاضر در صحنه برآید.',
  },
  complication: {
    en: 'The intent FAILS and the situation immediately gets worse through an element already present in the scene: an NPC reacts, an obligation comes due, a rival moves, a patrol notices, or the environment turns hostile. Do not grant the goal and do not leave the obstacle unchanged.',
    fa: 'قصد بازیکن شکست می‌خورد و وضعیت فوراً از دل عنصری که از پیش در صحنه حاضر است بدتر می‌شود: واکنش یک شخصیت، سررسیدن یک تعهد، حرکت رقیب، توجه گزمه‌ها یا خصمانه شدن محیط. هدف را محقق نکن و مانع را دست‌نخورده رها نکن.',
  },
  reveal: {
    en: 'The intent FAILS, but the attempt exposes a new fact, clue, weakness, requirement, or alternative grounded in the scene. The goal is still not achieved; the reveal changes what the next decision can be.',
    fa: 'قصد بازیکن شکست می‌خورد، اما تلاش حقیقتی تازه، سرنخ، ضعف، شرط لازم یا راهی جایگزین را آشکار می‌کند که ریشه در صحنه دارد. هدف همچنان محقق نمی‌شود؛ این افشا تصمیم بعدی را تغییر می‌دهد.',
  },
  reposition: {
    en: 'The intent FAILS and the protagonist is forced out of position or into a worse one — surrounded, disarmed, cornered, separated, driven back, or knocked down. Do not grant the goal; change the physical coordinates of the scene.',
    fa: 'قصد بازیکن شکست می‌خورد و قهرمان از موقعیت خود بیرون رانده یا به وضعیت بدتری انداخته می‌شود — محاصره، خلع سلاح، به گوشه رانده شدن، جدا افتادن، عقب رانده شدن یا زمین خوردن. هدف را محقق نکن؛ مختصات فیزیکی صحنه را تغییر بده.',
  },
  escalation: {
    en: 'The intent FAILS and the danger or time pressure advances: a threat clock ticks, pursuers close in, the ritual progresses, a patrol arrives, or a costly delay changes the situation. Do not grant the goal.',
    fa: 'قصد بازیکن شکست می‌خورد و خطر یا فشار زمان پیش می‌رود: ساعت تهدید بالا می‌رود، تعقیب‌کنندگان نزدیک می‌شوند، آیین پیشرفت می‌کند، گزمه‌ای می‌رسد یا تأخیری پرهزینه وضعیت را تغییر می‌دهد. هدف را محقق نکن.',
  },
  hard_stop: {
    en: 'This method CANNOT work here. Show exactly why it is blocked, reveal what is required or what alternative exists, and offer at least two genuinely different paths. Do not offer a rephrasing of the same attempt and do not roll it again.',
    fa: 'این روش در اینجا کار نمی‌کند. دقیقاً نشان بده چرا راه بسته است، مشخص کن چه چیزی لازم است یا چه جایگزینی وجود دارد، و دست‌کم دو مسیر واقعاً متفاوت پیشنهاد بده. بازنویسی همان تلاش را پیشنهاد نکن و دوباره برایش تاس نریز.',
  },
};

const MODE_SUMMARIES: Record<FailureMode, FailureDirective> = {
  cost: {
    en: 'The attempt fails and exacts a price.',
    fa: 'تلاش شکست می‌خورد و بهایی می‌گیرد.',
  },
  complication: {
    en: 'The attempt fails and creates an immediate complication.',
    fa: 'تلاش شکست می‌خورد و پیچیدگی‌ای فوری می‌آفریند.',
  },
  reveal: {
    en: 'The attempt fails, but reveals something that changes the situation.',
    fa: 'تلاش شکست می‌خورد، اما چیزی را آشکار می‌کند که وضعیت را تغییر می‌دهد.',
  },
  reposition: {
    en: 'The attempt fails and forces a change of position.',
    fa: 'تلاش شکست می‌خورد و تغییر موقعیت را تحمیل می‌کند.',
  },
  escalation: {
    en: 'The attempt fails and the danger advances.',
    fa: 'تلاش شکست می‌خورد و خطر پیش می‌رود.',
  },
  hard_stop: {
    en: 'The attempt cannot succeed as tried; the way is barred until the requirement is met.',
    fa: 'این تلاش به این شکل نمی‌تواند موفق شود؛ راه تا برآورده شدن شرط بسته است.',
  },
};

export interface FailureForwardInput {
  outcome: Extract<DiceOutcome, 'failure' | 'critical_failure'>;
  actionText: string;
  actionStyle?: string;
  statId?: string;
  isPersian?: boolean;
  /** True when the protagonist is currently on an inter-city journey. */
  isTraveling?: boolean;
  /** True when the action can plausibly injure the protagonist. */
  bodilyRisk: boolean;
  /** Authored policy attached to the selected choice. */
  authoredMode?: FailureMode;
  authoredHint?: string;
  /** Authored scene gate (location-level). Only entry/bypass actions are gated. */
  authoredGate?: boolean;
  authoredGateHint?: string;
  /** Consecutive identical failed attempts BEFORE this turn. */
  previousFailedAttempts?: number;
  healthKey: string;
  staminaKey?: string;
  resolveKey?: string;
  /** Resource ids actually present in the player's state. */
  availableResourceIds?: string[];
  /** Feasibility/displacement already applied a health penalty this turn. */
  hasExistingHealthPenalty?: boolean;
}

export interface FailureForwardResult {
  mode: FailureMode;
  secondaryMode?: FailureMode;
  actionKind: FailureActionKind;
  stuckAllowed: boolean;
  stuckReason?: string;
  requirementHint?: string;
  directive: FailureDirective;
  resourceChanges: Record<string, number>;
  costKind: 'health' | 'stamina' | 'resolve' | 'none';
  consequenceSummary: FailureDirective;
  previousFailedAttempts: number;
}

/** Normalize FA/EN text for retry similarity: unify Arabic/Persian letters and strip punctuation. */
export function normalizeActionForSimilarity(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\u064A\u0649]/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[\u200B-\u200F\u202A-\u202E]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForSimilarity(text: string): Set<string> {
  return new Set(
    normalizeActionForSimilarity(text)
      .split(' ')
      .map(stemToken)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
  );
}

/** Minimal English stemming so "searching" matches "search". */
function stemToken(word: string): string {
  if (!/^[a-z]+$/.test(word) || word.length <= 4) return word;
  const stemmed = word.replace(/(ing|ed|es|s)$/i, '');
  return stemmed.length > 2 ? stemmed : word;
}

export function actionSimilarity(a: string, b: string): number {
  const aNorm = normalizeActionForSimilarity(a);
  const bNorm = normalizeActionForSimilarity(b);
  if (!aNorm || !bNorm) return 0;
  if (aNorm === bNorm) return 1;

  const aWords = tokenizeForSimilarity(a);
  const bWords = tokenizeForSimilarity(b);
  if (aWords.size === 0 || bWords.size === 0) return 0;

  const intersection = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  const jaccard = intersection / union;
  const overlap = intersection / Math.min(aWords.size, bWords.size);
  return Math.max(jaccard, overlap);
}

export function actionsAreSimilar(a: string, b: string): boolean {
  const aNorm = normalizeActionForSimilarity(a);
  const bNorm = normalizeActionForSimilarity(b);
  if (!aNorm || !bNorm) return false;
  if (aNorm === bNorm) return true;
  const aWords = tokenizeForSimilarity(a);
  const bWords = tokenizeForSimilarity(b);
  if (aWords.size === 0 || bWords.size === 0) return false;
  const intersection = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  const jaccard = intersection / union;
  const overlap = intersection / Math.min(aWords.size, bWords.size);
  return jaccard >= 0.55 || overlap >= 0.7;
}

export interface PriorFailedTurn {
  playerActionText?: string;
  sceneId?: string;
  locationId?: string;
  resolution?: {
    outcome?: string;
    stateDiff?: { locationChange?: string };
  };
}

/**
 * Counts immediately preceding failed attempts at the same approach in the same
 * place. Stops at the first success, different approach, or location change.
 * Capped at 3: the engine only needs "first", "repeat", and "exhausted".
 */
export function countConsecutiveFailedAttempts(
  turns: PriorFailedTurn[],
  currentAction: string,
  currentLocationId?: string
): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0 && count < 3; i--) {
    const turn = turns[i];
    const outcome = turn.resolution?.outcome;
    if (outcome !== 'failure' && outcome !== 'critical_failure') break;
    if (turn.resolution?.stateDiff?.locationChange) break;

    const priorLocation =
      turn.locationId ??
      (typeof turn.sceneId === 'string' && turn.sceneId.startsWith('loc_')
        ? turn.sceneId
        : undefined);
    if (currentLocationId && priorLocation && priorLocation !== currentLocationId) break;
    if (!turn.playerActionText || !actionsAreSimilar(currentAction, turn.playerActionText)) break;
    count++;
  }
  return count;
}

export function classifyFailureAction(input: {
  actionText: string;
  actionStyle?: string;
  statId?: string;
  bodilyRisk?: boolean;
}): FailureActionKind {
  const text = input.actionText || '';
  const style = (input.actionStyle || '').toLowerCase();
  const stat = (input.statId || '').toLowerCase();

  // Explicit violence/athletics wins over a social style label, but not over a
  // social idiom such as "strike a deal".
  if (STRONG_PHYSICAL_PATTERN.test(text) && !SOCIAL_IDIOM_PATTERN.test(text)) {
    return 'physical';
  }
  // A physical style is itself a strong signal (e.g. "Squeeze through the
  // hatch" should not become social merely because "squeeze" also appears in
  // the coercion lexicon), unless the text names an explicit social verb.
  if (
    PHYSICAL_STYLES.has(style) &&
    !SOCIAL_IDIOM_PATTERN.test(text) &&
    !EXPLICIT_SOCIAL_PATTERN.test(text) &&
    !INVESTIGATIVE_PATTERN.test(text)
  ) {
    return 'physical';
  }
  if (
    isSocialAction(text) ||
    isPressureAction(text) ||
    SOCIAL_PATTERN.test(text) ||
    SOCIAL_STYLES.has(style)
  ) {
    return 'social';
  }
  if (
    INVESTIGATIVE_PATTERN.test(text) ||
    INVESTIGATIVE_STYLES.has(style) ||
    INVESTIGATIVE_STAT_PATTERN.test(stat)
  ) {
    return 'investigative';
  }
  if (detectTravelIntent(text)) return 'travel';
  if (input.bodilyRisk || PHYSICAL_STYLES.has(style) || PHYSICAL_STAT_PATTERN.test(stat)) {
    return 'physical';
  }
  return 'other';
}

export function isGateAction(actionText: string): boolean {
  return GATE_ACTION_PATTERN.test(actionText || '');
}

function defaultModeFor(kind: FailureActionKind, bodilyRisk: boolean): FailureMode {
  switch (kind) {
    case 'travel':
      return 'escalation';
    case 'investigative':
      return 'reveal';
    case 'social':
      return 'complication';
    case 'physical':
      return bodilyRisk ? 'cost' : 'reposition';
    default:
      return 'complication';
  }
}

function secondaryModeFor(
  kind: FailureActionKind,
  primary: FailureMode
): FailureMode | undefined {
  if (kind === 'social') return primary === 'reveal' ? 'complication' : 'reveal';
  if (kind === 'investigative') return 'complication';
  if (kind === 'physical') return primary === 'reposition' ? 'cost' : 'reposition';
  return undefined;
}

function localize(en: string, fa: string, isPersian?: boolean): string {
  return isPersian ? fa : en;
}

/**
 * Builds the deterministic failure plan. Precedence is intentional:
 *   1. exhausted repeat (2 prior identical failures) -> hard_stop
 *   2. authored hard stop / authored gate             -> hard_stop
 *   3. critical failure                               -> escalation + cost
 *   4. first repeat (1 prior identical failure)       -> escalation
 *   5. authored mode                                  -> authored mode
 *   6. action-appropriate default mode
 */
export function resolveFailureForward(input: FailureForwardInput): FailureForwardResult {
  const previous = Math.max(0, Math.min(3, input.previousFailedAttempts ?? 0));
  const actionKind = classifyFailureAction({
    actionText: input.actionText,
    actionStyle: input.actionStyle,
    statId: input.statId,
    bodilyRisk: input.bodilyRisk,
  });

  const authoredGate =
    Boolean(input.authoredGate) && isGateAction(input.actionText || '');
  const exhaustedRetry = previous >= 2;
  const firstRepeat = previous === 1;
  const authoredHardStop = input.authoredMode === 'hard_stop';
  const hardStop = exhaustedRetry || authoredGate || authoredHardStop;

  let mode: FailureMode;
  if (hardStop) {
    mode = 'hard_stop';
  } else if (input.outcome === 'critical_failure') {
    // User policy: a critical failure always gets escalation + cost, even if
    // the action kind would normally call for a reveal or complication.
    mode = 'escalation';
  } else if (firstRepeat) {
    mode = 'escalation';
  } else if (input.authoredMode) {
    mode = input.authoredMode;
  } else if (input.isTraveling && actionKind === 'other') {
    // A failure during an active journey still advances the road pressure even
    // when the action itself is not phrased as travel (e.g. "repair the axle").
    mode = 'escalation';
  } else {
    mode = defaultModeFor(actionKind, input.bodilyRisk);
  }

  const secondaryMode = hardStop
    ? undefined
    : input.outcome === 'critical_failure'
      ? 'cost'
      : secondaryModeFor(actionKind, mode);

  // Hard stops do not add a second mechanical penalty: the blocked method has
  // already cost the player the failed attempt(s). Every other failure pays a
  // causal, action-appropriate price.
  const available = input.availableResourceIds
    ? new Set(input.availableResourceIds)
    : null;
  const hasResource = (id?: string) => Boolean(id && (!available || available.has(id)));
  const resourceChanges: Record<string, number> = {};
  let costKind: FailureForwardResult['costKind'] = 'none';

  if (!hardStop && !input.hasExistingHealthPenalty) {
    if (input.bodilyRisk) {
      resourceChanges[input.healthKey] =
        input.outcome === 'critical_failure' ? -15 : -10;
      costKind = 'health';
    } else if (hasResource(input.staminaKey)) {
      resourceChanges[input.staminaKey!] =
        input.outcome === 'critical_failure' ? -15 : -10;
      costKind = 'stamina';
    } else if (hasResource(input.resolveKey)) {
      resourceChanges[input.resolveKey!] =
        input.outcome === 'critical_failure' ? -10 : -5;
      costKind = 'resolve';
    }
  }

  const costLine = input.hasExistingHealthPenalty
    ? localize(
        'The attempt exacts the mechanical consequence already listed above.',
        'تلاش همان پیامد مکانیکی را که پیش‌تر آمده است می‌گیرد.',
        input.isPersian
      )
    : costKind === 'health'
      ? localize(
          'The attempt draws blood; health is lost.',
          'تلاش خون می‌گیرد؛ از سلامت کاسته می‌شود.',
          input.isPersian
        )
      : costKind === 'stamina'
        ? localize(
            'The attempt drains stamina.',
            'تلاش از استقامت می‌کاهد.',
            input.isPersian
          )
        : costKind === 'resolve'
          ? localize(
              'The attempt shakes composure.',
              'تلاش عزم و آرامش را می‌لرزاند.',
              input.isPersian
            )
          : localize(
              'The attempt costs time, attention, leverage, or information.',
              'تلاش زمان، توجه، اهرم یا اطلاعات را هزینه می‌کند.',
              input.isPersian
            );

  let stuckReason: string | undefined;
  let requirementHint: string | undefined;
  if (hardStop) {
    requirementHint = input.authoredGateHint || input.authoredHint;
    stuckReason = requirementHint
      ? localize(
          `This method is blocked: ${requirementHint}`,
          `این روش بسته است: ${requirementHint}`,
          input.isPersian
        )
      : exhaustedRetry
        ? localize(
            'Repeating the same approach has exhausted its possibilities; it cannot work from here without a different method or a changed situation.',
            'تکرار همان رویکرد همهٔ امکان‌هایش را تمام کرده است؛ از اینجا بدون روشی متفاوت یا تغییر وضعیت کار نمی‌کند.',
            input.isPersian
          )
        : localize(
            'The scene itself bars this method; a requirement or a different route is needed.',
            'خودِ صحنه این روش را می‌بندد؛ یک شرط یا مسیر متفاوت لازم است.',
            input.isPersian
          );
  }

  const primary = MODE_DIRECTIVES[mode];
  const secondary = secondaryMode ? MODE_DIRECTIVES[secondaryMode] : undefined;
  const criticalNote =
    input.outcome === 'critical_failure' && !hardStop
      ? localize(
          'This is a CRITICAL FAILURE: combine the primary movement with the secondary movement, and make the setback severe but proportional.',
          'این یک شکست بحرانی است: حرکت اصلی را با حرکت ثانویه ترکیب کن و شدت ضربه را سنگین اما متناسب نگه دار.',
          input.isPersian
        )
      : '';
  const retryNote = firstRepeat && !hardStop
    ? localize(
        'This is a REPEATED ATTEMPT: escalate. The situation must change against the protagonist; do not simply replay the same obstacle.',
        'این یک تلاش تکراری است: تشدید کن. وضعیت باید به زیان قهرمان تغییر کند؛ همان مانع را ساده تکرار نکن.',
        input.isPersian
      )
    : exhaustedRetry
      ? localize(
          'After repeated unchanged attempts, this is an authorized HARD STOP. Do not pretend the same roll can still work.',
          'پس از تلاش‌های تکراری و بدون تغییر، این یک توقف کاملِ مجاز است. وانمود نکن همان تاس هنوز می‌تواند کار کند.',
          input.isPersian
        )
      : '';

  const choiceConstraint = localize(
    'At least two of the offered choices must pursue a genuinely different approach. A static "try again" or a rephrasing of the failed action as the only path is FORBIDDEN.',
    'دست‌کم دو گزینه از گزینه‌های پیشنهادی باید رویکردی واقعاً متفاوت را دنبال کنند. «دوباره تلاش کن» ثابت یا بازنویسی همان اقدام شکست‌خورده به‌عنوان تنها مسیر ممنوع است.',
    input.isPersian
  );
  const hardStopNote = hardStop
    ? localize(
        `This is an AUTHORIZED HARD STOP. Show why the method cannot work, reveal what is required${requirementHint ? ` (${requirementHint})` : ''}, and offer at least two genuinely different alternatives.`,
        `این یک توقف کاملِ مجاز است. نشان بده چرا این روش کار نمی‌کند، مشخص کن چه چیزی لازم است${requirementHint ? ` (${requirementHint})` : ''}، و دست‌کم دو جایگزین واقعاً متفاوت پیشنهاد بده.`,
        input.isPersian
      )
    : '';

  const directiveEn = [
    primary.en,
    secondary ? `SECONDARY MOVEMENT: ${secondary.en}` : '',
    criticalNote,
    retryNote,
    hardStopNote,
    choiceConstraint,
    costLine && !hardStop ? `Cost: ${costLine}` : '',
  ].filter(Boolean).join(' ');

  const directiveFa = [
    primary.fa,
    secondary ? `حرکت ثانویه: ${secondary.fa}` : '',
    criticalNote,
    retryNote,
    hardStopNote,
    choiceConstraint,
    costLine && !hardStop ? `هزینه: ${costLine}` : '',
  ].filter(Boolean).join(' ');

  const summaryEn = [
    MODE_SUMMARIES[mode].en,
    secondaryMode ? MODE_SUMMARIES[secondaryMode].en : '',
    hardStop ? '' : costLine,
  ]
    .filter(Boolean)
    .join(' ');
  const summaryFa = [
    MODE_SUMMARIES[mode].fa,
    secondaryMode ? MODE_SUMMARIES[secondaryMode].fa : '',
    hardStop ? '' : costLine,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    mode,
    ...(secondaryMode ? { secondaryMode } : {}),
    actionKind,
    stuckAllowed: hardStop,
    ...(stuckReason ? { stuckReason } : {}),
    ...(requirementHint ? { requirementHint } : {}),
    directive: { en: directiveEn, fa: directiveFa },
    resourceChanges,
    costKind,
    consequenceSummary: { en: summaryEn, fa: summaryFa },
    previousFailedAttempts: previous,
  };
}
