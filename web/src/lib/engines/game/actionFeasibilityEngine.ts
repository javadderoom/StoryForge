import { SubQAdapter, SubQDecisionRequest } from '@/lib/providers/SubQAdapter';
import { DiceOutcome } from '@/lib/types/gameplay';

export type FeasibilityTier = 'feasible' | 'extreme' | 'impossible';

export type ExpectedReaction =
  | 'standard'
  | 'amusement_or_dismissal'
  | 'imprisonment_or_law'
  | 'overwhelming_violence'
  | 'lethal_hazard';

export interface FeasibilityAssessment {
  tier: FeasibilityTier;
  reaction: ExpectedReaction;
  reason: string;
  source: 'subq_snap' | 'heuristic_fallback';
  nat20SalvageSummaryEn: string;
  nat20SalvageSummaryFa: string;
  failureConsequenceEn: string;
  failureConsequenceFa: string;
  criticalFailureConsequenceEn: string;
  criticalFailureConsequenceFa: string;
}

/**
 * Deterministic heuristics for spotting physically impossible,
 * socially absurd, or suicidally asymmetric actions across all settings.
 */
export function evaluateFeasibilityHeuristics(
  actionText: string,
  context: {
    characterName?: string;
    isPersian?: boolean;
    currentLocationName?: string;
    level?: number;
  } = {}
): FeasibilityAssessment {
  const lower = actionText.toLowerCase();

  // 1. Military scale / Solo vs Entrenched Unit / Squad / Garrison (Combat Scale Asymmetry)
  const isSquadScaleConflict =
    /(?:صف|دسته|گروهان|پادگان|لشکر|سپاه|گروه)\s+(?:گزمه|سرباز|نیزه‌دار|کماندار|نگهبان|جنگجو)/i.test(
      lower
    ) ||
    /(?:charge|assault|attack|rush|smash|fight|take on)\s+.*(?:squad|garrison|spear\s*wall|phalanx|regiment|army|platoon|guard\s*line|line of guards)/i.test(
      lower
    ) ||
    (/(?:گزمه|سرباز|نگهبان|guards|sentries|soldiers|garrison)/i.test(lower) &&
      /(?:سد معبر.*با زور|یورش.*به صف|هجوم.*به صف|تنهایی.*حمله|wiping out|solo.*charge|break.*through.*all|alone.*smash|smash.*through)/i.test(
        lower
      ));

  if (isSquadScaleConflict) {
    return {
      tier: 'impossible',
      reaction: 'overwhelming_violence',
      reason: 'A lone mortal warrior cannot single-handedly scatter or smash through an entire armed military unit by brute force.',
      source: 'heuristic_fallback',
      nat20SalvageSummaryEn:
        'Miraculous survival: exceptional reflexes allowed you to parry fatal spear thrusts and scramble back out of the kill zone with your life (Health -5).',
      nat20SalvageSummaryFa:
        'بقا در واپسین دم: با چالاکی استثنایی از ضربات مرگبار نیزه‌ها گریختی و با زخم‌های سطحی از مهلکه عقب نشستی (سلامت ۵-).',
      failureConsequenceEn:
        'Overwhelmed by superior numbers: the spear wall slammed forward, battering you into the mud, disarmed and pinned (Health -15).',
      failureConsequenceFa:
        'شکست در برابر فزونی نفرات: صف نیزه‌ها بر سرت فرود آمد، به لجن کوبیده شدی، سلاحت افتاد و زمین‌گیر شدی (سلامت ۱۵-).',
      criticalFailureConsequenceEn:
        'Devastating slaughter: trampling boots and cruel spearpoints pinned you helplessly to the earth (Health -25).',
      criticalFailureConsequenceFa:
        'سرکوب مهلک: چکمه‌های گزمه‌ها و سرنیزه‌ها بی‌رحمانه بر تنت فرود آمدند و پیکرت در خون غلطید (سلامت ۲۵-).',
    };
  }

  // 2. Monarchical / Supreme Authority Absurdity (e.g. Demanding the King's Crown / Throne on a whim)
  const isRoyalAudacity =
    /(?:تاج|تخت|پادشاهی|سلطنت|فرمانروایی|ملک).*(?:بده|تسلیم|واگذار|بده به من)|(?:give me|hand over|surrender).*(?:crown|throne|kingdom|scepter)/i.test(
      lower
    );

  if (isRoyalAudacity) {
    return {
      tier: 'impossible',
      reaction: 'imprisonment_or_law',
      reason: 'Demanding a reigning monarch surrender their crown or throne to a traveler is impossible and treasonous.',
      source: 'heuristic_fallback',
      nat20SalvageSummaryEn:
        'Incredible audacity: the King roared with laughter at the sheer madness of the joke, taking you for a bold court jester and sparing your head.',
      nat20SalvageSummaryFa:
        'جسارت باورنکردنی: پادشاه از شدت نامعقول بودن خواسته به خنده افتاد و تو را دیوانه‌ای جسور پنداشت؛ سرت بر تنت ماند اما خواسته‌ات با تمسخر رد شد.',
      failureConsequenceEn:
        'Lèse-majesté: royal guards drew steel with furious shouts, seizing you by the throat for high treason and dragging you to the dungeons.',
      failureConsequenceFa:
        'خیانت به تاج‌وتخت: نگهبانان با غریو خشم شمشیر کشیدند، گلویت را فشردند و تو را به سیاهچال دربار افکندند.',
      criticalFailureConsequenceEn:
        'Sentence of death: the executioner was summoned immediately to sever the traitor’s head upon the marble floor.',
      criticalFailureConsequenceFa:
        'حکم اعدام در دم: شاه با خشم فریاد کشید و جلاد فراخوانده شد تا گردن خائن را بر کف مرمرین تالار بزند.',
    };
  }

  // 3. Physical & Gravitational Defiance (e.g. jumping a 100ft chasm bare-bodied, flying without magic, breathing underwater without spell)
  const isPhysicalDefiance =
    /(?:پریدن|جهش|پرواز).*(?:از روی دره|روی پرتگاه|صخره بلند|آسمان|ارتفاع صدمتری|گودال بی‌پایان)|(?:jump|leap|fly).*(?:across the (?:100|hundred|giant|vast) (?:foot|meter)? (?:chasm|gorge|canyon|abyss)|off the cliff bare)/i.test(
      lower
    );

  if (isPhysicalDefiance) {
    return {
      tier: 'impossible',
      reaction: 'lethal_hazard',
      reason: 'Leaping across vast yawning chasms or defying gravity without wings or magic is physically impossible.',
      source: 'heuristic_fallback',
      nat20SalvageSummaryEn:
        'Desperate snag: you crashed violently into a protruding root on the lower cliff wall, breaking bones but clutching to life (Health -20).',
      nat20SalvageSummaryFa:
        'چنگ‌زدن از سرِ استیصال: بدنت بر ریشهٔ بیرون‌زدهٔ دیوارهٔ پایینی فرود آمد و استخوانت ترک برداشت، اما به طرز معجزه‌آسایی زنده ماندی (سلامت ۲۰-).',
      failureConsequenceEn:
        'Plunge into the void: gravity claimed you immediately, smashing your frame against sharp jagged boulders below (Health -30).',
      failureConsequenceFa:
        'سقوط در مغاک: جاذبه بی‌رحمانه تو را فرو کشید و پیکرت بر صخره‌های تیز قعر دره کوبیده شد (سلامت ۳۰-).',
      criticalFailureConsequenceEn:
        'Fatal descent: an unbroken drop into the yawning abyss below.',
      criticalFailureConsequenceFa:
        'سقوط مرگبار: فرودی سهمگین در دل تاریکی مطلق و اعماق بی‌بازگشت.',
    };
  }

  // Default: Action is feasible within ordinary physical / social rules
  return {
    tier: 'feasible',
    reaction: 'standard',
    reason: 'Plausible action within mortal adventure bounds.',
    source: 'heuristic_fallback',
    nat20SalvageSummaryEn: 'Flawless execution with exceptional tactical insight.',
    nat20SalvageSummaryFa: 'اجرای بی‌نقص همراه با بینش تاکتیکی و برتری کامل.',
    failureConsequenceEn: 'The attempt failed: unexpected obstacle arose or opportunity lost.',
    failureConsequenceFa: 'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.',
    criticalFailureConsequenceEn: 'Disaster strikes: complete failure with severe complications or damage.',
    criticalFailureConsequenceFa: 'فاجعه رخ داد: شکست کامل همراه با آسیب سنگین یا عواقب ناگوار.',
  };
}

/**
 * Universal Action Feasibility & Proportional Consequence Evaluator.
 * Queries SubQ Snap (ultra-fast ~500ms decision model) when configured,
 * with deterministic heuristic fallback when offline.
 */
export async function assessActionFeasibility(
  actionText: string,
  context: {
    characterName?: string;
    isPersian?: boolean;
    currentLocationName?: string;
    level?: number;
    subqAdapter?: SubQAdapter;
  } = {}
): Promise<FeasibilityAssessment> {
  const fallback = evaluateFeasibilityHeuristics(actionText, context);

  // If SubQ Snap is not configured or available, return heuristic evaluation immediately
  const adapter = context.subqAdapter ?? new SubQAdapter();
  if (!adapter.isConfigured()) {
    return fallback;
  }

  try {
    const request: SubQDecisionRequest = {
      model: 'subq-snap-preview',
      state: {
        character: {
          name: context.characterName || 'Protagonist',
          level: context.level || 1,
          description: 'A mortal, low-level adventurer/mercenary in a dark gritty fantasy world.',
        },
        location: context.currentLocationName || 'Dangerous frontier',
        action: actionText,
      },
      questions: {
        feasibilityTier: {
          type: 'choice',
          instructions:
            'Assess whether this specific action is physically, socially, or tactically feasible for a mortal novice in this gritty dark fantasy setting.',
          criteria: {
            feasible: 'Normal plausible action (e.g. climbing, exploring, haggling, single combat, sneaking).',
            extreme: 'Very dangerous heroic feat, but technically within the laws of physics and society (DC 18+).',
            impossible:
              'Completely impossible, absurd, or suicidal (e.g. demanding a king hand over his crown, lone novice charging an entrenched military garrison squad bare/basic steel, flying bare-bodied across a 100ft gorge).',
          },
        },
        expectedReaction: {
          type: 'choice',
          instructions:
            'If this action is absurd, impossible, or suicidal, what is the natural, proportionate response of the world?',
          criteria: {
            standard: 'Standard RPG obstacle resolution.',
            amusement_or_dismissal: 'Target laughs at the insane audacity or treats the player as a harmless jester/fool.',
            imprisonment_or_law: 'Treason, lèse-majesté, or crime punishable by dungeon, shackles, or guards seizing player.',
            overwhelming_violence: 'Opponents use crushing superior numbers/spearwalls to beat down, disarm, and pin player.',
            lethal_hazard: 'Gravity, lava, bottomless pits, or instant natural death.',
          },
        },
      },
    };

    // Fast 1.5s timeout for Snap so turn latency stays snappy
    const response = await adapter.evaluate(request, { timeoutMs: 1500 });
    if (!response.success) {
      return fallback;
    }

    const tierChoice = (response.answers.feasibilityTier?.choice as FeasibilityTier) || fallback.tier;
    const reactionChoice =
      (response.answers.expectedReaction?.choice as ExpectedReaction) || fallback.reaction;

    if (tierChoice === 'impossible') {
      // Pick tailored consequences matching the detected reaction
      switch (reactionChoice) {
        case 'amusement_or_dismissal':
          return {
            tier: 'impossible',
            reaction: 'amusement_or_dismissal',
            reason: 'Absurd request treated as a laughable joke or foolery.',
            source: 'subq_snap',
            nat20SalvageSummaryEn:
              'Incredible audacity: the target burst out laughing at the sheer absurdity, taking you for a harmless jester and letting you off with a chuckle.',
            nat20SalvageSummaryFa:
              'جسارت باورنکردنی: طرف مقابل از شدت نامعقول بودن خواسته به خنده افتاد، تو را دلقکی بی‌خطر پنداشت و با خنده رهایت کرد.',
            failureConsequenceEn:
              'Contempt and mockery: you were scoffed at, rebuked sharply, and ordered away under threat of humiliation.',
            failureConsequenceFa:
              'تحقیر و سرکوفت: خواسته‌ات با تمسخر رد شد و با تهدیدِ خفت از آنجا رانده شدی.',
            criticalFailureConsequenceEn:
              'Disgrace and outrage: your insolence provoked open fury and a harsh public beating.',
            criticalFailureConsequenceFa:
              'رسوایی و خشم: بی‌شرمی تو خشم حاضران را برانگیخت و با ضربات تازیانه مجازات شدی.',
          };

        case 'imprisonment_or_law':
          return {
            tier: 'impossible',
            reaction: 'imprisonment_or_law',
            reason: 'Action breaches sovereign authority or law; results in arrest or captivity.',
            source: 'subq_snap',
            nat20SalvageSummaryEn:
              'Astonishing bravado: sovereign amusement or bizarre fortune spared you the noose, but your demand was flatly denied.',
            nat20SalvageSummaryFa:
              'جسارت حیرت‌انگیز: شانس عجیب یا تمسخر حاکم باعث شد از دار مجازات بگریزی، اما خواسته‌ات قاطعانه رد شد.',
            failureConsequenceEn:
              'Arrest for high treason: royal sentries seized you in iron grips and dragged you down to the dungeon.',
            failureConsequenceFa:
              'بازداشت به جرم خیانت: گزمه‌ها گلویت را در چنگ گرفتند و تو را به سیاه‌چال افکندند.',
            criticalFailureConsequenceEn:
              'Execution decree: condemned on the spot as an assassin or traitor to the realm.',
            criticalFailureConsequenceFa:
              'حکم هلاکت: بی‌درنگ به عنوان خائن و آشوبگر به تیغ جلاد سپرده شدی.',
          };

        case 'overwhelming_violence':
          return {
            tier: 'impossible',
            reaction: 'overwhelming_violence',
            reason: 'Crushed by overwhelming superior numbers and military discipline.',
            source: 'subq_snap',
            nat20SalvageSummaryEn:
              'Miraculous survival: exceptional reflexes allowed you to parry fatal spear thrusts and scramble back out of the kill zone with your life (Health -5).',
            nat20SalvageSummaryFa:
              'بقا در واپسین دم: با چالاکی استثنایی از ضربات مرگبار نیزه‌ها گریختی و با زخم‌های سطحی از مهلکه عقب نشستی (سلامت ۵-).',
            failureConsequenceEn:
              'Overwhelmed by superior numbers: the spear wall slammed forward, battering you into the mud, disarmed and pinned (Health -15).',
            failureConsequenceFa:
              'شکست در برابر فزونی نفرات: صف نیزه‌ها بر سرت فرود آمد، به لجن کوبیده شدی، سلاحت افتاد و زمین‌گیر شدی (سلامت ۱۵-).',
            criticalFailureConsequenceEn:
              'Devastating slaughter: trampling boots and cruel spearpoints pinned you helplessly to the earth (Health -25).',
            criticalFailureConsequenceFa:
              'سرکوب مهلک: چکمه‌های گزمه‌ها و سرنیزه‌ها بی‌رحمانه بر تنت فرود آمدند و پیکرت در خون غلطید (سلامت ۲۵-).',
          };

        case 'lethal_hazard':
        default:
          return {
            tier: 'impossible',
            reaction: 'lethal_hazard',
            reason: 'Defiance of lethal environmental physics.',
            source: 'subq_snap',
            nat20SalvageSummaryEn:
              'Desperate snag: you crashed violently into a protruding ledge, breaking bones but clutching to life (Health -20).',
            nat20SalvageSummaryFa:
              'چنگ‌زدن از سرِ استیصال: بدنت بر لبهٔ سنگی فرود آمد و استخوانت آسیب دید، اما معجزه‌آسا زنده ماندی (سلامت ۲۰-).',
            failureConsequenceEn:
              'Plunge into the void: gravity claimed you immediately, smashing your frame against sharp rocks below (Health -30).',
            failureConsequenceFa:
              'سقوط در مغاک: جاذبه تو را در هم شکست و پیکرت بر صخره‌های قعر دره کوبیده شد (سلامت ۳۰-).',
            criticalFailureConsequenceEn:
              'Fatal descent: total catastrophic plunge into the abyss.',
            criticalFailureConsequenceFa:
              'سقوط مرگبار: فرودی سهمگین و تباهی کامل در ژرفای تاریکی.',
          };
      }
    }

    return {
      tier: tierChoice,
      reaction: reactionChoice,
      reason: 'Evaluated by SubQ Snap decision engine.',
      source: 'subq_snap',
      nat20SalvageSummaryEn: fallback.nat20SalvageSummaryEn,
      nat20SalvageSummaryFa: fallback.nat20SalvageSummaryFa,
      failureConsequenceEn: fallback.failureConsequenceEn,
      failureConsequenceFa: fallback.failureConsequenceFa,
      criticalFailureConsequenceEn: fallback.criticalFailureConsequenceEn,
      criticalFailureConsequenceFa: fallback.criticalFailureConsequenceFa,
    };
  } catch {
    return fallback;
  }
}
