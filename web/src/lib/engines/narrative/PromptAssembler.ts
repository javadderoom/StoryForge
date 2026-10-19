import { WorkingContextEnvelope } from '@/lib/types/memory';
import { isTreated, kindForTag, promptVisibleConditions } from '@/lib/engines/game/conditionCatalog';

export interface GenerationPromptPayload {
  systemPrompt: string;
  userPrompt: string;
  isEnglish: boolean;
  /** Plan 08: valid stat ids of the active RPG system, for choice validation. */
  playerStatIds?: Record<string, number>;
  /** Low-base calibration flag: true when story uses low starting attributes (< 8) */
  isLowBase?: boolean;
  /**
   * Story-aware stat aliases (canonical stat id -> its authored display names,
   * e.g. might -> ['نیرو']). Lets choice normalization survive the model using
   * synonyms or localized names instead of silently dropping the choice.
   */
  statIdAliases?: Record<string, string[]>;
}

/**
 * Renders the expanded World Bible context (summary, theme, factions, timeline,
 * artifacts, bestiary, religions, NPC relationships, ontology) into labeled
 * blocks. Each section is only emitted when present, keeping the prompt bounded.
 */
function worldContextBlock(context: WorkingContextEnvelope, isEnglish: boolean): string[] {
  const labels = isEnglish
    ? {
        summary: 'WORLD SUMMARY',
        theme: 'THEMATIC DIRECTION',
        factions: 'FACTIONS & POWER BLOCS',
        factionRelations: 'FACTION RELATIONS',
        timeline: 'TIMELINE & HISTORY',
        artifacts: 'ARTIFACTS & RELICS',
        bestiary: 'BESTIARY & CREATURES',
        religions: 'RELIGIONS & DEITIES',
        bonds: 'NPC RELATIONSHIPS',
        ontology: 'WORLD ONTOLOGY',
        locations: 'KNOWN LOCATIONS',
        npcs: 'KNOWN NPCS',
        tradeRoutes: 'COMMERCIAL ARTERIES & ACTIVE TRADE ROUTES',
      }
    : {
        summary: 'خلاصه جهان / WORLD SUMMARY',
        theme: 'جهت تماتیک / THEMATIC DIRECTION',
        factions: 'گروه‌ها و قدرت‌ها / FACTIONS',
        factionRelations: 'روابط جناح‌ها / FACTION RELATIONS',
        timeline: 'تاریخ و زمان / TIMELINE',
        artifacts: 'اشیاء و یادگارها / ARTIFACTS',
        bestiary: 'موجودات / BESTIARY',
        religions: 'ادیان و خدایان / RELIGIONS',
        bonds: 'روابط شخصیت‌ها / NPC RELATIONSHIPS',
        ontology: 'ساختار جهان / ONTOLOGY',
        locations: 'مکان‌های شناخته‌شده / LOCATIONS',
        npcs: 'شخصیت‌های شناخته‌شده / NPCS',
        tradeRoutes: 'شاهراه‌ها و کاروان‌های تجاری فعال / ACTIVE TRADE ROUTES & CARAVANS',
      };

  const out: string[] = [];
  if (context.worldSummary) out.push(`[${labels.summary}]\n${context.worldSummary}`);
  if (context.themeNotes) out.push(`[${labels.theme}]\n${context.themeNotes}`);
  if (context.factions?.length) out.push(`[${labels.factions}]\n${context.factions.map((x) => `• ${x}`).join('\n')}`);
  if (context.factionRelations?.length) out.push(`[${labels.factionRelations} — honor these stances: allied fights together, favorable cooperates quietly, neutral does not intervene, rival contests without open war, hostile wages open war]\n${context.factionRelations.map((x) => `• ${x}`).join('\n')}`);
  if (context.locations?.length) out.push(`[${labels.locations}]\n${context.locations.map((x) => `• ${x}`).join('\n')}`);
  if (context.npcs?.length) out.push(`[${labels.npcs}]\n${context.npcs.map((x) => `• ${x}`).join('\n')}`);
  if (context.timeline?.length) out.push(`[${labels.timeline}]\n${context.timeline.map((x) => `• ${x}`).join('\n')}`);
  if (context.artifacts?.length) out.push(`[${labels.artifacts}]\n${context.artifacts.map((x) => `• ${x}`).join('\n')}`);
  if (context.bestiary?.length) {
    const bestiaryDirective = isEnglish
      ? ' — When wildlife, predators, or monstrosities appear, you MUST draw from these canonical creatures and their lore descriptions below instead of inventing ad-hoc generic beasts'
      : ' — در صورت حضور جانوران، درندگان یا هیولاها، حتماً از این موجودات مانیفست و ویژگی‌های ظاهری آن‌ها استفاده کن نه ابداع موجودات فرضی و کلیشه‌ای';
    out.push(`[${labels.bestiary}${bestiaryDirective}]\n${context.bestiary.map((x) => `• ${x}`).join('\n')}`);
  } else {
    // Plan 15: no location-matched beasts — release the MUST-draw pressure so
    // the model does not trap itself into placing off-biome creatures.
    out.push(
      isEnglish
        ? `[ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate terrain. Focus tension on terrain hazards, physical exhaustion, harsh weather, and environmental atmosphere.`
        : `[راهنمای محیطی / ENVIRONMENTAL GUIDANCE]: در این پهنه هیچ درنده‌ای زندگی نمی‌کند. تنش را بر خطرات زمین، فرسودگی جسمانی، آب‌وهوای خشن و فضای محیط متمرکز کن.`
    );
  }
  if (context.religions?.length) out.push(`[${labels.religions}]\n${context.religions.map((x) => `• ${x}`).join('\n')}`);
  if (context.dramaBonds?.length) out.push(`[${labels.bonds}]\n${context.dramaBonds.map((x) => `• ${x}`).join('\n')}`);
  if (context.tradeRoutes?.length) {
    const tradeDirective = isEnglish
      ? ' — Commercial arteries and caravan trails connecting settlements, transporting goods, and guarded by caravan masters and retinues'
      : ' — شریان‌های تجاری و مسیرهای کاروان که سکونتگاه‌ها را به هم پیوند می‌دهند، کالاها را حمل می‌کنند و توسط کاروان‌سالاران و محافظان همراهی می‌شوند';
    out.push(`[${labels.tradeRoutes}${tradeDirective}]\n${context.tradeRoutes.map((x) => `• ${x}`).join('\n')}`);
  }
  if (context.ontologySummary) out.push(`[${labels.ontology}]\n${context.ontologySummary}`);
  return out;
}

export class PromptAssembler {
  /**
   * Builds a canonical stat-id -> authored display names map so choice
   * normalization can tolerate the model emitting a stat's Persian/English
   * name or a synonym instead of the exact schema id.
   */
  private static buildStatIdAliases(
    statsDefs: NonNullable<WorkingContextEnvelope['statsConfig']>
  ): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const s of statsDefs) {
      const id = s.id?.trim().toLowerCase();
      if (!id) continue;
      const names = [s.name, s.nameFa, s.nameEn]
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .map((n) => n.trim());
      if (names.length) out[id] = names;
    }
    return out;
  }

  /**
   * Outcome-specific narrator directive. Mixed success is the critical case:
   * the goal IS achieved, but a visible cost MUST be dramatized — otherwise
   * the narrator defaults to a clean triumph and contradicts the engine.
   */
  private static outcomeDirective(outcome: string | undefined, isEnglish: boolean): string {
    if ((outcome || '').toLowerCase() !== 'mixed_success') return '';
    return isEnglish
      ? `• OUTCOME DIRECTIVE (MIXED SUCCESS — partial victory WITH cost): The goal IS achieved, but NEVER cleanly. You MUST depict BOTH (a) the achieved objective AND (b) an explicit cost from the Cost line below (wound, pain, fatigue, breathlessness, torn gear, raised alarm, suspicion, or a lost opportunity). Pure triumph wording (flawless, effortless, unscathed) is FORBIDDEN here. If the Cost line lists HP/stamina/trust loss, show it in the body with proportionate pain, exhaustion, trembling, or witnesses turning hostile.
• CAUSAL COST RULE (MANDATORY): Every point of HP/stamina/trust lost MUST be caused by THIS action and by hazards, terrain, opponents, gear, or bystanders ALREADY established in the scene. NEVER invent a new attacker, a stray arrow, a hidden enemy, a trap, falling debris, or a convenient accident to explain the cost. If this action cannot plausibly injure the protagonist, express the cost as physical strain, a wrenched joint, exhaustion, torn or stained gear, lost footing, lost time, exposure, or raised suspicion/attention — never a wound from nowhere. Keep the injury proportional: a mixed success is a setback, not a crippling or life-threatening wound.`
      : `• دستور نتیجه (موفقیت نسبی — پیروزی ناقص همراه با بها): هدف محقق می‌شود، اما هرگز تمیز و بی‌هزینه نیست! باید همزمان هر دو را نشان بدهی: (الف) دستیابی به هدف و (ب) بهای عینی از خط «هزینه» زیر (زخم، درد، خستگی، نفس‌تنگی، پاره شدن لباس/زره، جلب توجه، سوءظن، یا فرصت از دست رفته). به‌کار بردن لحن پیروزی کامل (بی‌نقص، آسان، بدون خراش، پیروزمندانه) در این حالت ممنوع است. اگر در خط هزینه از کاهش سلامت/استقامت/اعتماد یاد شده، آن را متناسب و با درد، خستگی، لرزش یا واکنش خصمانه شاهدان در متن نشان بده.
• قاعده علت‌ومعلول هزینه (اجباری): هر کاهش سلامت/استقامت/اعتماد باید پیامد مستقیم همین اقدام و فقط ناشی از خطرها، زمین، دشمنان، تجهیزات یا شاهدانِ از پیش حاضر در صحنه باشد. هرگز برای توجیه هزینه، مهاجم تازه، تیر گم‌شده، دشمن پنهان، تله، سقوط ناگهانی سنگ/تیر یا حادثهٔ ساختگی اختراع نکن. اگر این اقدام به‌طور منطقی نمی‌تواند به قهرمان آسیب جسمی بزند، هزینه را به‌صورت خستگی، کشیدگی عضله، پیچ‌خوردگی، پاره یا کثیف شدن تجهیزات، از دست رفتن تعادل، اتلاف وقت، قرار گرفتن در معرض خطر یا جلب سوءظن/توجه نشان بده — نه زخمی که از ناکجا آمده. شدت آسیب باید متناسب باشد: موفقیت نسبی یک عقب‌نشینی جزئی است، نه زخم فلج‌کننده یا مرگ‌آور.`;
  }

  /**
   * Plan 18: renders the deterministic failure mode as a binding prompt block.
   * The system-level FAILURE FORWARD CONTRACT states the general rule; this block
   * names the exact movement the scene must make this turn.
   */
  private static failureForwardBlock(
    outcome: NonNullable<WorkingContextEnvelope['resolvedGameOutcome']>,
    isEnglish: boolean
  ): string {
    if (outcome.outcome !== 'failure' && outcome.outcome !== 'critical_failure') return '';
    if (!outcome.failureMode) return '';

    const isHardStop = outcome.failureMode === 'hard_stop';
    if (isEnglish) {
      const parts = [
        `[FAILURE FORWARD — PRE-RESOLVED MODE]`,
        `• Failure Mode: ${outcome.failureMode.toUpperCase()}${
          outcome.failureSecondaryMode
            ? ` + ${outcome.failureSecondaryMode.toUpperCase()} (secondary)`
            : ''
        }`,
        outcome.failureDirective
          ? `• Binding directive: ${outcome.failureDirective}`
          : '',
        isHardStop
          ? `• Stuck permitted: YES — ${
              outcome.stuckReason || 'this method is genuinely blocked.'
            }`
          : `• Stuck permitted: NO — the failure must produce at least one concrete change, and at least two choices must pursue a new approach.`,
        isHardStop && outcome.failureRequirementHint
          ? `• Requirement to reveal: ${outcome.failureRequirementHint}`
          : '',
        outcome.locationChanged
          ? `• ENGINE MOVEMENT: the protagonist has already been moved to the current location this turn. The failure is the price of arrival — depict the new place and the cost of entering it. Do NOT narrate them still stuck at the old threshold.`
          : '',
      ];
      return parts.filter(Boolean).join('\n');
    }

    const parts = [
      `[شکستِ پیش‌برنده — حالت محاسباتی]`,
      `• حالت شکست: ${outcome.failureMode.toUpperCase()}${
        outcome.failureSecondaryMode
          ? ` + ${outcome.failureSecondaryMode.toUpperCase()} (ثانویه)`
          : ''
      }`,
      outcome.failureDirective ? `• دستور الزام‌آور: ${outcome.failureDirective}` : '',
      isHardStop
        ? `• توقف کامل مجاز است: بله — ${
            outcome.stuckReason || 'این روش واقعاً بسته است.'
          }`
        : `• توقف کامل مجاز است: نه — شکست باید دست‌کم یک تغییر عینی بیاورد و دست‌کم دو گزینه رویکردی تازه را دنبال کنند.`,
      isHardStop && outcome.failureRequirementHint
        ? `• شرطی که باید آشکار شود: ${outcome.failureRequirementHint}`
        : '',
      outcome.locationChanged
        ? `• جابه‌جایی موتور: قهرمان همین نوبت به مکان فعلی منتقل شده است. شکست بهای رسیدن است — مکان تازه و بهای ورود را نشان بده. او را همچنان پشت آستانهٔ قبلی نگه ندار.`
        : '',
    ];
    return parts.filter(Boolean).join('\n');
  }

  /**
   * Plan 17 (§4.5): journey leg / arrival blocks — the road is real. Rendered
   * whenever the envelope carries an active journey or an arrival this turn,
   * with hard arrival discipline so prose can never teleport the protagonist
   * into the destination early.
   */
  private static journeyBlock(
    context: WorkingContextEnvelope,
    isEnglish: boolean
  ): string | undefined {
    const { travel, travelArrival } = context;
    if (!travel && !travelArrival) return undefined;
    const parts: string[] = [];

    if (isEnglish) {
      if (travel) {
        const companions = travel.caravanNpcNames?.length
          ? ` Travelling companions: ${travel.caravanNpcNames.join(', ')}.`
          : '';
        const road = travel.roadNote ? ` Road conditions: ${travel.roadNote}.` : '';
        const next = travel.nextStopName ? ` Next stop: "${travel.nextStopName}".` : '';
        parts.push(
          `[JOURNEY EN ROUTE — سفر در راه]\n` +
            `• The protagonist is ON THE ROAD: from "${travel.originName}" to "${travel.destinationName}"${travel.routeName ? ` via the "${travel.routeName}"` : ''} (${travel.mode}) — day ${travel.dayOnRoad} of ${travel.totalTurns}; ${travel.turnsRemaining} turn(s) of road remain. Current stop: "${travel.currentStopName}".${next}${companions}${road}\n` +
            (travel.dayOnRoad === 1
              ? `• DEPARTURE: the journey begins this turn — open at "${travel.originName}" (its gates, packing and provisions, the caravan or mounts forming up, farewells or the plain resolve of the road ahead).\n`
              : '') +
            (travel.arriving
              ? `• FINAL LEG: the destination appears on the horizon this turn; you may bring the traveller right up to the gates and end the scene inside them. Any life inside "${travel.destinationName}" opens only after this leg.\n`
              : `• ARRIVAL DISCIPLINE: the protagonist must NOT be placed inside "${travel.destinationName}" — no inns, markets, courts, or residents — until the final leg. Keep every scene on the corridor between the current stop and the road ahead.\n`) +
            `• THE SCENE IS THE ROAD: terrain in motion (dust, salt, rain, heat), pack animals and wagon noise, way-station life, camp at dusk, lantern glow at a caravanserai. Anchor scene elements to the corridor between these stops.\n` +
            `• DESTINATION CONTACTS: no residents, rulers, or guilds of "${travel.destinationName}" appear before arrival — only route-legitimate contacts (caravan masters, mounted patrols, fellow travellers already on this road).\n` +
            `• CHOICE MATERIAL for the road: push on, make camp for the night, scout ahead, talk with travelling companions, trade at a caravanserai, tend wounds and gear.\n` +
            `• PACE: a forced march or a deliberately slow pace is allowed — narrate it; the engine adjusts the schedule. NEVER invent an early arrival.`
        );
      }
      if (travelArrival) {
        parts.push(
          `[JOURNEY ARRIVED — پایان راه]\n` +
            `• The journey ended this turn: the protagonist has entered "${travelArrival.destinationName}". Open the scene with the destination washing over the senses (crowds, smells, sound, road-dust still on them) and treat it as the new grounded setting — continue seamlessly from the final leg of the road.`
        );
      }
      return parts.join('\n');
    }

    // Persian
    if (travel) {
      const modeFa =
        travel.mode === 'caravan'
          ? 'کاروانی'
          : travel.mode === 'ship'
            ? 'دریایی'
            : travel.mode === 'mount'
              ? 'سواره'
              : 'پیاده';
      const companions = travel.caravanNpcNames?.length
        ? ` همسفران راه: ${travel.caravanNpcNames.join('، ')}.`
        : '';
      const road = travel.roadNote ? ` وضعیت جاده: ${travel.roadNote}.` : '';
      const next = travel.nextStopName ? ` ایستگاه بعدی: «${travel.nextStopName}».` : '';
      parts.push(
        `[سفر در راه / JOURNEY EN ROUTE]\n` +
          `• قهرمان در راه است: از «${travel.originName}» به «${travel.destinationName}»${travel.routeName ? ` از مسیر «${travel.routeName}»` : ''} (${modeFa}) — روز ${travel.dayOnRoad} از ${travel.totalTurns}؛ ${travel.turnsRemaining} نوبت دیگر راه مانده است. ایستگاه فعلی: «${travel.currentStopName}».${next}${companions}${road}\n` +
          (travel.dayOnRoad === 1
            ? `• آغاز سفر: کاروان/مرکب همین نوبت راه می‌افتد — صحنه را کنار دروازه‌های «${travel.originName}» بگشا (باروبنه، آماده‌سازی، صف بستن کاروان یا زین کردن مرکب، بدرقه یا دل کندن و ارادهٔ راه).\n`
            : '') +
          (travel.arriving
            ? `• پایان راه: مقصد همین نوبت در افق نمایان می‌شود؛ می‌توانی قهرمان را تا دروازه‌ها برسانی و صحنه را داخل دروازه‌ها ببندی. هر صحنه‌ای در دلِ «${travel.destinationName}» فقط پس از همین نوبت آغاز می‌شود.\n`
            : `• انضباط ورود: تا نوبت پایان راه، هرگز قهرمان را داخل «${travel.destinationName}» مگذار — نه کاروانسرا، نه بازار، نه دربار و نه میان مردمانش. هر صحنه باید در کریدور جاده میان ایستگاه فعلی و راه پیش رو بماند.\n`) +
          `• صحنه همان جاده است: زمین در حرکت (گرد و نمک، باران، گرما)، هیاهوی چارپایان و ارابه‌ها، زندگی میان‌راهی، اتراق در غروب، نور فانوس کاروانسرا. عناصر صحنه را به کریدور میان این ایستگاه‌ها گره بزن.\n` +
          `• آشنایان مقصد: تا پیش از رسیدن، هیچ‌یک از ساکنان، بزرگان یا صنف‌های «${travel.destinationName}» در صحنه ظاهر نمی‌شوند — تنها آشنایان مجاز راه (سالار کاروان، گشت‌های سواره، همسفرانی که همین حالا بر جاده‌اند).\n` +
          `• مواد انتخاب برای جاده: ادامه دادن، اتراق شبانه، پیشاهنگی و شناسایی مسیر، گفت‌وگو با همسفران، داد و ستد در کاروانسرا، رسیدگی به زخم و توشه.\n` +
          `• آهنگ سفر: تاختِ تند یا پیمودن آهسته آزاد است — آن را روایت کن؛ زمان‌بندی به دست موتور بازی است. هرگز رسیدن زودهنگام از خودت نساز.`
      );
    }
    if (travelArrival) {
      parts.push(
        `[رسیدن به مقصد / JOURNEY ARRIVED]\n` +
          `• سفر همین نوبت به پایان رسید: قهرمان به «${travelArrival.destinationName}» درآمده است. صحنه را با سرریز حس‌های مقصد بگشا (هیاهو، بو، صدا؛ گردِ راه هنوز بر تن او) و اینجا را قرارگاه تازهٔ او بدان — پیوسته و بی‌درز از پایان راه پیش ببر.`
      );
    }
    return parts.join('\n');
  }

  /**
   * Builds the structured, high-density prompt envelope for Gemini 3.7.
   * Accurately adapts language and format based on the story manifest language.
   */
  public static buildNarrativePrompt(context: WorkingContextEnvelope): GenerationPromptPayload {
    const isExplicitlyPersian =
      context.languageDirective === 'fa' ||
      /[\u0600-\u06FF]/.test(context.storyTitle || '') ||
      /[\u0600-\u06FF]/.test(context.worldSummary || '');
    const isEnglish = !isExplicitlyPersian && context.languageDirective === 'en';
    // Plan 08 & Custom stats: real stats from RPG system or player status
    const statsDefs = context.statsConfig || [];
    const validStatIds = Object.keys(context.playerStatus?.stats || {});
    const statDescriptors = statsDefs.length > 0
      ? statsDefs.map((s) => `${s.id}${s.name ? ` (${s.name})` : ''}`).join(', ')
      : validStatIds.join(', ');

    // A system is genuinely low-base if universalBaseValue is < 8, or if all authored stats have base < 8.
    const isLowBase = context.universalBaseValue !== undefined
      ? context.universalBaseValue < 8
      : statsDefs.length > 0
      ? statsDefs.every((s) => (s.baseValue ?? 10) < 8)
      : false;

    const exampleLowDC = isLowBase ? 7 : 10;
    const exampleMedDC = isLowBase ? 9 : 12;

    const authorDirective = context.authoredSystemPrompt
      ? `\n\n[AUTHOR'S DIRECTIVE — honor the story author's voice, rules, and constraints below]\n${context.authoredSystemPrompt}`
      : '';

    const worldBlock = worldContextBlock(context, isEnglish);

    const dcDirective = isLowBase
      ? isEnglish
        ? `Difficulty targets (targetDC) for choices scale dynamically with risk and character progression:
- Low risk: 7-8 (standard minor checks, non-adversarial actions).
- Medium risk: 9-11 (moderate obstacles, cautious opposition).
- High risk: 11-14 (dangerous opposition, alert armed sentries, high-pressure confrontations).
- Heroic / Extreme feats & late-saga challenges: 15-18 (superhuman physical or tactical trials matching seasoned attributes 12-20, relics, or climactic chapter stakes).
Calibrate DCs dynamically to the active chapter and protagonist capabilities: early chapter high risk is 11-12, while late saga/heroic challenges scale up to 15-18.`
        : `درجه سختی (targetDC) برای انتخاب‌ها به صورت پویا بر اساس میزان ریسک و پیشرفت شخصیت تعیین می‌شود:
- ریسک پایین: ۷-۸ (اقدامات استاندارد، بدون مقاومت جدی).
- ریسک متوسط: ۹-۱۱ (موانع معمول، نگهبانان محتاط).
- ریسک بالا: ۱۱-۱۴ (مقاومت جدی، گزمه‌های مسلح، مواجهه پرخطر).
- کارهای حماسی و چالش‌های فصول پیشرفته (Heroic/Extreme): ۱۵-۱۸ (اعمال سنگین و موانع مهیب متناسب با صفات ۱۲ تا ۲۰، تجهیزات برتر یا اوج داستان در فصول پایانی).
درجه سختی را متناسب با فصل جاری و توان قهرمان تنظیم کن: در آغاز داستان، ریسک بالا ۱۱-۱۲ است و با پیشرفت به فصول بالاتر تا ۱۵-۱۸ افزایش می‌یابد.`
      : isEnglish
      ? `Difficulty targets (targetDC) for choices MUST realistically match the physical, tactical, and opposition scale:
- Low risk: 8-10 (standard minor checks, non-adversarial actions).
- Medium risk: 11-13 (moderate obstacles, cautious guards, standard adventure challenges).
- High risk: 14-16 (dangerous opposition, alert armed sentries, high-pressure interrogation or deceit).
- Heroic / Extreme feats: 17-19 (tremendous physical force such as crashing through barricades bare-bodied, dodging point-blank volleys, resisting lethal toxins).
IMPORTANT — NEVER assign a DC from the wrong band: medium-risk choices live at 11-13 (never 10 or below), high-risk at 14-16, heroic at 17-19 (never 20 or above). The storyboard below shows real failures to avoid: a standoff choice at DC 11 is too easy; a heroic barricade feat at DC 20 is effectively unrollable.`
      : `درجه سختی (targetDC) برای انتخاب‌ها باید دقیقاً متناسب با دشواری واقعی و مقاومت موانع تعیین شود:
- ریسک پایین: ۸-۱۰ (اقدامات استاندارد، بدون مقاومت جدی).
- ریسک متوسط: ۱۱-۱۳ (موانع معمولی، نگهبانان محتاط، چالش‌های معمول ماجراجویی).
- ریسک بالا: ۱۴-۱۶ (مقاومت جدی، گزمه‌های مسلح و هوشیار، موقعیت‌های پرخطر جسمی یا فریب دشوار).
- کارهای خارق‌العاده و پرفشار (Extreme / Heroic): ۱۷-۱۹ (اعمال نیروی فیزیکی سهمگین مانند خرد کردن موانع چوبی نظامی با شانه بدون ابزار، جاخالی دادن به تیرهای نزدیک، خلع سلاح در محاصره).
مهم — هرگز درجه‌ای از باند اشتباه نده: متوسط ۱۱ تا ۱۳ (نه ۱۰ یا کمتر)، بالا ۱۴ تا ۱۶، حماسی ۱۷ تا ۱۹ (نه ۲۰ یا بیشتر).`;

    const statsDirective = validStatIds.length
      ? isEnglish
        ? `4. Provide 2 to 4 natural, contextual next choices for the reader in English.
- ATOMIC SINGLE-BEAT GRANULARITY: Every choice MUST represent exactly ONE immediate physical or verbal step happening right now. Never chain multiple consecutive actions (e.g. avoid "Action A and Action B and Action C").
- NO PRE-BAKED OUTCOMES: State ONLY what the character physically does right now. NEVER include the intended outcome, consequence, or motivation in the choice text (e.g. avoid "in order to...", "to find a safe path", "so that..."). The dice roll and narrative director determine the outcome.
- PURE LITERARY NARRATIVE (NO MECHANICAL LABELS OR ROLL CHECK TAGS IN CHOICE TEXT): State ONLY the clean literary physical or verbal action. NEVER append or prepend roll check labels, skill names, dice notations, or parenthetical metadata (e.g. NEVER write '(Skill Check)', '(Roll Check)', '(بررسی مهارت)', '(پرتاب تاس)', or '(D20)'). The game UI ALREADY renders a dedicated stat badge for any required roll check; the choice text must remain 100% immersive, clean story prose.
- SELECTIVE DICE CHECKS (DICELESS VS. STAT CHECKS):
  * AT LEAST 2 CHOICES (or the majority of choices) per turn MUST have a stat check ("requiredStatId" and "targetDC") so the RPG system and dice rolls remain engaging.
  * HIGH TENSION & CONFRONTATION RULE (NO DICELESS IN STANDOFFS):
    When the current scene involves an active armed confrontation, standoff, combat, pursuit, or life-or-death tension (e.g. sentries with drawn swords, shouting threats, weapons readied):
    EVERY choice carries peril and MUST have a stat check ("requiredStatId" and "targetDC").
    DO NOT provide ANY diceless choices in hostile or standoff situations!
    Seemingly calm actions in a standoff are NOT safe: staring down an armed guard with a hand on a weapon is Intimidation/Presence (stat check); questioning an enraged sentry who is threatening to kill you is Persuasion/De-escalation (stat check).
  * HIGH-STAKES, ADVERSARIAL & SOCIAL CONFLICT CHOICES ALWAYS REQUIRE A STAT CHECK: Any action involving threats, intimidation, aggressive interrogation of sentries/guards, coercion, deception, lying, bribery, stealth, combat, physical force, or persuading suspicious figures MUST include "requiredStatId" (one of: [${validStatIds.join(', ')}], Authored stats: ${statDescriptors}) and ${dcDirective}. NEVER make threats, intimidation, or interrogation diceless!
  * DICELESS IS STRICTLY FOR SAFE, PEACEFUL ACTIONS: Only truly peaceful, safe, and low-stakes actions (e.g. asking a calm question to an ally/vendor in a calm inn, quietly observing safe surroundings, resting, or examining an obvious safe object) must omit "requiredStatId" and "targetDC".
- DYNAMIC CAPABILITY & PROGRESSION SCALING:
  * Calibrate the physical, tactical, and magical scale of choices to the protagonist's actual attributes, gear, and abilities shown in [PROTAGONIST STATUS & CAPABILITIES]:
    - Mortal / Starting Tier (attributes under 10, mundane gear): The character is an ordinary mortal. Keep choices physically grounded, tactical, and plausible (using tools, stealth, environment, or social wits). Do NOT offer effortless superheroic brute force (e.g. shattering fortified barricades bare-bodied).
    - Heroic / Superhuman Tier (attributes 12+, 16+, 20+, enchanted relics, powerful spells, or mythic world scope): The character has grown beyond ordinary limits! Dynamically unlock larger-than-life, heroic, magical, or superhuman feats that match their high attributes and magical gear.
  * Appropriate DC Matching: Truly extreme or superhuman feats carry commensurate DCs (14-18) so that high attributes or legendary gear are what make them achievable and rewarding.
- GROUNDING & ITEM ROLE FIDELITY: Ground choices in equipped gear, environmental interactables, and discovered clues. Honor item role fidelity: equipped relics, charms, and specialized gear must ONLY be proposed in choices when their specific authored function or powers are genuinely relevant. NEVER propose permanent relics or talismans as throwaway diversion pebbles or irrelevant conversational fidget props. Non-consumable gear must never be tossed or destroyed. NEVER reveal or base choices on hidden/undiscovered NPC secrets. Span distinct philosophies (tactical, aggressive, defensive, inquisitive).
- ACTIVE ITEM & ARTIFACT INTEGRATION (ITEM FIDELITY): Consult the [EQUIPPED GEAR & ARTIFACT INTERACTION CATALOGUE]. When relevant tactical, survival, or martial challenges arise (e.g. arrows/missiles, desert heat, deciphering seals, tight combat), actively offer choices utilizing the authentic primary purposes and interactions of the protagonist's equipped items (e.g. bracing behind a shield to intercept incoming missile volleys or executing a shield-bash, focusing through lenses to decipher eroded seals, or relying on desert beads to resist heat). NEVER propose any action listed under [FORBIDDEN MISUSES].
- ACTIVE ABILITY & SPELL INTEGRATION (ABILITY FIDELITY): When the protagonist faces active combat, tactical obstacles, physical perils, or specialized challenges (ONLY when conflict or danger is actively present in the scene, NEVER in peaceful or travel scenes), you MUST actively leverage their known abilities, feats, and spells (from [PROTAGONIST STATUS & CAPABILITIES]). In hostile, combat, or high-stakes encounters, at least one offered choice should provide a proactive application of one of their signature abilities or spells with an appropriate stat check and targetDC matching the action. Describe the concrete physical or magical action directly (e.g. "Brace behind the shield against incoming shafts" rather than "Leverage Shield Defense skill to block arrows"). NEVER shoehorn meta skill names or phrases like "relying on the skill of..." into the choice text.
- STRICT GROUNDING IN SCENE PROSE (NO PHANTOM ENTITIES): Every choice MUST strictly react to the physical obstacles, characters, and events EXPLICITLY established in the scene's narrative prose. NEVER invent phantom entities, unmentioned bystanders, imaginary cargo, caravan inspections, or unstated subplots. All choices must be actions directly referenced or present in the text (e.g. if only a closed gate is described, choices must interact with that gate or visible sentries, NOT inspect unmentioned caravans or baggage).
- SCENE ATMOSPHERE, PACING & NO COMBAT PARANOIA: In calm, exploratory, travel, introductory, or conversational scenes (such as walking with a caravan at dawn, resting at camp, or talking in a tavern), DO NOT invent sudden surprise monster attacks or force combat paranoia choices (such as drawing weapons, holding shields forward, or bracing for phantom ambushes). Choices in calm scenes must feel natural and atmospheric: engaging in conversation with present companions, observing environmental landmarks or tracks, assisting travelers, adjusting pace, or inspecting supplies.`
        : `۴. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای و طبیعی ارائه کن:
- گام‌های اتمیک و تک‌مرحله‌ای (ATOMIC SINGLE-BEAT): هر انتخاب باید دقیقاً «یک اقدام فیزیکی یا گفتاری فوری» را در همین لحظه بیان کند. هرگز چند اقدام پیاپی را با «و» به هم متصل نکن (از فرمول «کار الف و سپس کار ب و کار ج» اکیداً پرهیز کن).
- ممنوعیت درج نتیجه در متن انتخاب: متن انتخاب باید صرفاً کنشِ عینی شخصیت باشد، نه هدف یا نتیجهٔ از پیش‌تعیین‌شده (از عباراتی چون «برای اینکه...»، «به منظور فرار...»، «تا مسیر امن را پیدا کند» پرهیز کن). نتیجه و پیامد کار تنها پس از تاس و توسط راوی مشخص می‌شود.
- نثر ادبی خالص و ممنوعیت برچسب‌های بررسی تاس در متن انتخاب: متن انتخاب باید صرفاً کنشِ عینی، ادبی و داستانی شخصیت باشد. از درج عبارات مکانیکی، پرانتزها، یا نشانه‌های بررسی تاس در متن انتخاب (مانند «(بررسی مهارت)»، «(پرتاب تاس)»، «(آزمون ویژگی)»، «(Roll Check)» یا عبارات فراداستانی مانند «با اتکا به مهارت...») اکیداً خودداری کن! واسط کاربری بازی خود نشان ویژگی و تاس را به عنوان یک تگ مشخص بالای کارت نمایش می‌دهد؛ متن انتخاب باید کاملاً روان، ادبی و روایی باشد.
- بررسی انتخابی تاس (DICELESS در برابر بررسی ویژگی):
  * حداقل ۲ انتخاب (یا اکثریت گزینه‌ها) در هر نوبت حتماً باید دارای بررسی ویژگی و درجه سختی («requiredStatId» و «targetDC») باشند تا هیجان بازی و مکانیک‌های تاس زنده بماند.
  * موقعیت‌های پرتنش و مواجهه با دشمن (ممنوعیت کامل گزینه‌های بدون تاس در تنش بالا):
    هنگامی که صحنه در شرایط تعارض مسلحانه، تنش بالا، محاصره یا نبرد و تعقیب است (مانند کشیده شدن شمشیرها، فریادهای تهدیدآمیز گزمه‌ها، مسدود شدن راه):
    تک‌تک گزینه‌ها دارای خطر هستند و اکیداً باید دارای بررسی ویژگی و درجه سختی («requiredStatId» و «targetDC») باشند.
    در شرایط درگیری و بن‌بست مسلحانه، قرار دادن هرگونه گزینهٔ بدون تاس (DICELESS) اکیداً ممنوع است!
    در چنین تنشی، حتی رفتارهای به ظاهر خونسردانه هم بی‌خطر نیستند: دست گذاشتن روی شمشیر در برابر گزمه یعنی ارعاب و ایستادگی روانی (تاس نیرو یا حضور ذهن)؛ سؤال پرسیدن از گزمه‌ای که شمشیر کشیده و تهدید به مرگ می‌کند یعنی اقناع و خواباندن غائله (تاس هوش، کاریزما یا حیله‌گری).
  * اقدامات پرریسک، تعارضی و تنش‌زا حتماً نیازمند تاس هستند: هرگونه تهدید، ارعاب، بازجویی از نگهبانان/گزمه‌ها با لحن تند، اجبار، فریب، دروغ‌گویی، رشوه، مخفی‌کاری، نبرد، زورآزمایی، یا اقناع افراد مشکوک اکیداً باید دارای «requiredStatId» (از بین: [${validStatIds.join('، ')}] با نام‌های: ${statDescriptors}) و ${dcDirective} باشد. هرگز تهدید، بازجویی و اقدامات پرخاشگرانه را بدون تاس (DICELESS) نگذار!
  * حالت بدون تاس (DICELESS) صرفاً مختص اقدامات کاملاً بی‌خطر و آرام است: فقط گفت‌وگوهای عادی و مسالمت‌آمیز با یاران یا فروشندگان، استراحت، بررسی آرام محیط امن، یا پیگیری عادی مسیر می‌توانند بدون تاس باشند (فاقد requiredStatId و targetDC).
- مقیاس‌پذیری پویا بر اساس قدرت و پیشرفت شخصیت (DYNAMIC CAPABILITY SCALING):
  * مقیاس گزینه‌ها را با صفات، تجهیزات و توانمندی‌های فعلی قهرمان (مشخص‌شده در بخش وضعیت قهرمان) هماهنگ کن:
    - سطح فانی و آغاز بازی (ویژگی‌های زیر ۱۰ و ابزارهای معمولی): شخصیت هنوز یک انسان عادی و آسیب‌پذیر است. گزینه‌ها باید واقع‌گرایانه، تاکتیکی و هوشمندانه باشند (استفاده از اهرم‌ها، مخفی‌کاری، ترفندها یا ضعف‌های محیطی). کارهای ابرقهرمانی بی‌دلیل (مانند خرد کردن موانع سنگین با شانهٔ خالی) را به عنوان گزینه عادی پیشنهاد نده.
    - سطح قهرمانی و فراانسانی (ویژگی‌های ۱۲، ۱۶، ۲۰ به بالا، ابزارها و سلاح‌های جادویی، طلسم‌های قوی، یا جهان‌های حماسی): با رشد و پیشرفت شخصیت، این محدودیت‌ها برداشته می‌شوند! با ارتقای ویژگی‌ها و دستیابی به یادگارهای کهن، اعمال حماسی، ماوراءطبیعی و فراانسانیِ متناسب با قدرت جدید قهرمان را در گزینه‌ها آزاد و پیشنهاد کن.
  * تناسب درجه سختی (DC): اعمال بسیار سنگین یا فراانسانی سختی متناسب (۱۴ تا ۱۸) دارند تا بازیکن با داشتن ویژگی‌های بالا و تجهیزات برتر طعم غلبه بر چالش‌های ناممکن اولیه را بچشد.
- زمینه و وفاداری به کارکرد تجهیزات (ITEM ROLE FIDELITY): انتخاب‌ها را بر تجهیزات، عناصر محیطی و سرنخ‌ها استوار کن. وفاداری به ماهیت آیتم‌ها الزامی است: تجهیزات، یادگارها و طلسم‌های همراه قهرمان باید صرفاً در زمینهٔ کارکرد و قدرت‌های واقعی‌شان در گزینه‌ها پیشنهاد شوند. هرگز یادگارهای باستانی، نمادها یا مهره‌های مقدس و دائمی (مانند دافع عطش و سراب) را به عنوان سنگریزه برای پرتاب و انحراف حواس دشمن، یا فیجت و بازیچهٔ دست در حین صحبت پیشنهاد نده! آیتم‌های دائمی و غیرمصرفی هرگز نباید به عنوان اشیاء پرتابی یا یک‌بارمصرف تلف شوند. هرگز اسرار کشف‌نشده را لو نده. فلسفه‌های متفاوت (تاکتیکی، تهاجمی، تدافعی، کنجکاوانه) را پوشش بده.
- به‌کارگیری فعال تجهیزات و یادگارها (ITEM FIDELITY): به بخش [کاتالوگ تعاملات و کارکرد تجهیزات همراه / EQUIPPED GEAR & ARTIFACT INTERACTION CATALOGUE] مراجعه کن. در رویارویی با چالش‌های تاکتیکی، رزمی یا بقا (صرفاً در صورت وجود خطر، مانع یا نبرد واقعی در متن صحنه، نه در پیاده‌روی یا سفر مسالمت‌آمیز)، در صورت تناسب موقعیت گزینه‌ای متکی بر کارکرد اصیل تجهیزات مجهز قهرمان پیشنهاد کن. اکیداً از پیشنهاد هرگونه اقدامی که تحت عنوان «سوءاستفاده‌های اکیداً ممنوع / FORBIDDEN MISUSES» ثبت شده است خودداری کن.
- به‌کارگیری فعال توانایی‌ها، مهارت‌ها و جادوها (ABILITY & SPELL FIDELITY): در شرایط نبرد، موانع فیزیکی، تعارضات یا چالش‌های تاکتیکی (صرفاً هنگامی که خطر، مانع یا نبردی در متن فعال است)، از توانایی‌ها، مهارت‌ها و جادوهای شناخته‌شدهٔ قهرمان (مندرج در بخش وضعیت و توانمندی‌های قهرمان) استفاده کن. در مواجهه با خطرات یا موانع دشوار، حداقل یکی از گزینه‌های پیشنهادی می‌تواند استفادهٔ هدفمند و تاکتیکی از یکی از توانایی‌ها یا مهارت‌ها را پیشنهاد دهد (مثلاً هدایت و مهار حیوانات با نهیب و تجربه‌ کاروانی، یا اجرای وردهای جادویی) و برای آن یک بررسی صفت متناسب («requiredStatId» و «targetDC») تعیین کند. خودِ عمل فیزیکی یا کلامی را به شکلی طبیعی و داستانی توصیف کن و هرگز نام کاتالوگی مهارت را به شکل تصنعی در متن گزینه نیاور (مانند آوردن «با اتکا به مهارت کاروان...»).
- انطباق مطلق با متن و صحنه (ممنوعیت توهم و فرضیات ناموجود): تک‌تک گزینه‌ها باید دقیقاً از دلِ موانع، اشخاص، محیط و رویدادهایی که در متنِ همین صحنه صریحاً به آن‌ها اشاره شده است برآیند. ابداع موجودیت‌های فرضی، افراد غایب، کاروان‌ها یا بارهای ذکرنشده، یا بازرسی بارهایی که اصلاً در متن نیامده‌اند اکیداً ممنوع است. تمام انتخاب‌ها باید مواردی باشند که در متن به آن‌ها اشاره شده است (مثلاً اگر در متن فقط از بسته بودن دروازه سخن رفته، گزینه‌ها باید منحصراً پیرامون خودِ دروازه، نگهبانان حاضر یا محیط پیرامونی باشند، نه بازرسی کالاهای خیالی).
- انطباق با لحن و اتمسفر صحنه و منع پارانویای رزمی (SCENE ATMOSPHERE & NO COMBAT PARANOIA): در صحنه‌های آرام، کاروانی، پیاده‌روی، سفر، گفت‌وگو یا معرفی (مانند حرکت کاروان در سپیده‌دم، استراحت در کاروانسرا، یا پیاده‌روی مسالمت‌آمیز)، اکیداً از ابداع یورش‌های ناگهانی موجودات یا هیولاها و تحمیل انتخاب‌های پارانوئید جنگی (مانند سپر رو به جلو گرفتن برای آماده شدن در برابر حادثه، کشیدن سلاح، یا موضع دفاعی گرفتن در یک پیاده‌روی عادی) خودداری کن! در صحنه‌های آرام، انتخاب‌ها باید کاملاً طبیعی، جوّی، اجتماعی، کاوشگرانه یا هدایتی باشند: گفت‌وگو با همراهان حاضر، بررسی مسیر یا ردپای جانوران، وارسی بار و چهارپایان، نوشیدن آب، کمک به ساربانان یا رصد افق و عوارض زمین.`
      : isEnglish
      ? `4. Provide 2 to 4 natural, contextual next choices for the reader in English. Keep choices strictly atomic without pre-baked outcomes, actively offer choices leveraging the protagonist's known abilities/spells in combat or obstacles, and strictly ground them in what has been explicitly mentioned in the scene prose without hallucinating unmentioned entities. In calm travel/exploratory scenes, keep choices peaceful and atmospheric without combat paranoia. In tense standoffs or conflicts, all choices must have a stat check and DC.`
      : `۴. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای تک‌مرحله‌ای (اتمیک) ارائه کن که در شرایط نبرد و چالش‌ها به طور فعال از توانایی‌ها و جادوهای قهرمان بهره بگیرند و کاملاً بر عناصر و وقایعِ صریحاً ذکرشده در متن صحنه استوار باشند (بدون توهم یا ابداع موارد غایب). در صحنه‌های آرام و سفر، گزینه‌ها باید مسالمت‌آمیز، اجتماعی و متناسب با اتمسفر باشند بدون تحمیل موضع‌گیری‌های جنگی. در شرایط درگیری، بن‌بست مسلحانه یا تنش با دشمنان، تمام گزینه‌ها باید دارای بررسی ویژگی و درجه سختی باشند.`;

    // Plan 13: contextual choice material shared by both language branches.
    const choiceMaterial = [
      context.inventoryTerms?.length ? `Equipped gear / inventory: ${context.inventoryTerms.join(', ')}` : '',
      context.environmentInteractables?.length ? `Environmental interactables: ${context.environmentInteractables.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const dialogueDirective = isEnglish
      ? '5. Wrap every line of direct speech in double quotation marks ("...") so dialogue stays visually distinct from narration.'
      : '۵. هر گفت‌وگوی مستقیم را داخل «...» بنویس تا از روایت متمایز بماند.';

    const secretGuardDirective = isEnglish
      ? '6. KNOWLEDGE BOUNDARY & NO PREMATURE LEAKS: Never expose or offer choices that act upon unrevealed NPC secrets or hidden plot twists. The protagonist only knows what has been explicitly discovered or experienced in the story. In early turns (Turns 1-3), never dump overarching conspiracies or treasonous plots unless critically unlocked by the engine. Third-party sentries and environmental adversaries do not possess or leak unrelated NPC secrets.'
      : '۶. مرز دانش شخصیت و منع افشای زودهنگام رازها: هرگز در گزینه‌های انتخابی یا روایت، اسرار پنهان و ناگفته شخصیت‌ها یا توطئه‌های کلان را پیش از کشف منطقی و گام‌به‌گام توسط بازیکن لو نده. انتخاب‌ها باید صرفاً بر اساس دانسته‌ها و شواهد ملموس صحنه باشند. گزمه‌ها و نگهبانان صحنه نمی‌توانند رازهای پنهان و توطئه‌های کاروانیان یا اشخاص دیگر را که ربطی به آن‌ها ندارد فاش کنند.';

    // Plan 15: the MUST-draw imperative fires only when the scoper actually
    // placed beasts in context; otherwise the environmental fallback applies
    // (mirrors the worldContextBlock guidance above).
    const bestiaryGrounding = context.bestiary?.length
      ? isEnglish
        ? `- BESTIARY GROUNDING & VISCERAL TRAITS: When introducing wild beasts, predators, or monstrosities, you MUST draw from the [BESTIARY & CREATURES] section and depict their specific authored physical features, secretions, and behaviors. Integrate the creature naturally through direct sensory prose (scale patterns, sounds, colors, predatory motion); do not awkwardly put its formal taxonomy name in quotation marks (the game UI automatically renders its Bestiary Discovery Card).`
        : `- بازنمایی حسی و دقیق موجودات (BESTIARY GROUNDING & VISCERAL TRAITS): هنگام معرفی یا مواجهه با جانوران وحشی، درندگان یا هیولاها، حتماً از بخش [موجودات و جانوران / BESTIARY & CREATURES] استفاده کن و ویژگی‌های ظاهری عینی، ترشحات، فلس‌ها و الگوهای رفتاری ثبت‌شدهٔ آن‌ها را به تصویر بکش. موجود را به شکلی طبیعی و از طریق توصیف حسی ملموس (نقش‌ونگار پوست، اصوات، رنگ‌ها، و حرکات درنده) در متن بنشان؛ از گذاشتن نام رسمی کتابچه در داخل گیومه خودداری کن (واسط کاربری بازی کارت شناسایی آن را نمایش می‌دهد).`
      : isEnglish
        ? `- [ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate terrain. Focus tension on terrain hazards, physical exhaustion, harsh weather, and environmental atmosphere — do NOT introduce wildlife, predators, or monstrosities into this scene.`
        : `- [راهنمای محیطی / ENVIRONMENTAL GUIDANCE]: در این پهنه هیچ درنده‌ای زندگی نمی‌کند. تنش را بر خطرات زمین، فرسودگی جسمانی، آب‌وهوای خشن و فضای محیط متمرکز کن — اکیداً جانور، درنده یا هیولایی در این صحنه وارد نکن.`;

    // Plan 15 (Bug 4): a single-line emotional directive for the
    // protagonist's untreated wound — present allies must acknowledge it.
    // Treated markers (bandaged/healed/…) suppress the beat.
    const woundTag = (context.playerStatus?.conditions ?? []).find((c) => {
      const t = (c || '').toLowerCase();
      if (/treated|bandaged|healed|dressed|stitched|مداوا|پانسمان|بهبود|بخیه/.test(t)) return false;
      return /injury|wound|bleed|lesion|trauma|lacerat|زخم|جراحت|خونریزی|مجروح/.test(t);
    });
    // Plan 17: treated wounds never trigger the bandage directive; they get a
    // continuity guard instead so the dressing is not silently forgotten.
    const treatedWoundTag = (context.playerStatus?.conditions ?? []).find(
      (c) => isTreated(c) && kindForTag(c)?.kind === 'wounded'
    );
    const treatedWoundBeat = !woundTag && treatedWoundTag
      ? isEnglish
        ? `- [TREATED WOUND CONTINUITY]: The wound is bound and no longer bleeding (tag: "${treatedWoundTag}"). Do NOT re-bandage it or treat it as untreated; physical strain still aches and the dressing must be kept in mind during hard movement.`
        : `- [تداوم زخمِ پانسمان‌شده]: زخم بسته شده و خون‌ریزی ندارد (نشان: «${treatedWoundTag}»). آن را دوباره پانسمان نکن و درمان‌نشده ننویس؛ اما فشار جسمی هنوز می‌سوزاند و در حرکات سنگین باید حواست به پانسمان باشد.`
      : '';
    const woundBeat = woundTag
      ? isEnglish
        ? `- [CRITICAL EMOTIONAL BEAT]: The protagonist suffered an untreated injury last turn (active wound tag: "${woundTag}"). Present allies must acknowledge this (checking the wound, offering water, or bandaging) before advancing.`
        : `- [ضربهٔ عاطفی حیاتی / CRITICAL EMOTIONAL BEAT]: قهرمان در نوبت پیش زخمی درمان‌نشده برداشته است (نشان زخم فعال: «${woundTag}»). یاران حاضر باید پیش از پیشروی به آن واکنش نشان دهند (وارسی زخم، آب دادن، یا پانسمان).`
      : '';

    const continuityDirective = `[SCENE CONTINUITY & CHOICE PREMISES]
- Resolve only the player's stated action against its actual target. Success does not authorize unrelated victories, confessions, or extra player actions beyond the pre-resolved consequence.
- TARGET FIDELITY & NO TELEPORTING NPCS: If the player acts toward generic guards, sentries, gates, or obstacles, do NOT substitute a named commander or unintroduced off-scene NPC as the immediate responder. Address only the actual recipient of the action.
- SPATIAL CONTINUITY & MICRO-VANTAGE (NO MAGIC NPC TELEPORTATION): If the protagonist stepped away, snuck off, or moved to a distinct micro-feature (e.g. down into the muddy reeds by the riverbank, behind wagons, onto a roof, or down a dark alley), NPCs left behind at camp, at the gates, or by a campfire DO NOT magically spawn or teleport beside the protagonist! They remain at their original post. They do not follow silently unless the player specifically asked them to accompany them. If a violent, noisy, or dramatic event occurs in a secluded spot, distant NPCs can only react from afar (hearing the noise from the campfire, shouting across the gloom, or running over with torches to see what happened). They are NEVER already standing over the aftermath!
- PHYSICAL ENVIRONMENT CONTINUITY: Only depict physical elements, obstacles, and props that exist in the scene. Do NOT hallucinate unmentioned physical objects (e.g., piled cargo, baggage wagons, caravan inspections) out of nowhere unless explicitly introduced by story prose or player action.
- SINGLE DRAMATIC FOCUS (NO THREAT STACKING): Maintain a single, cohesive source of dramatic conflict per turn. When a check fails or complications escalate, escalate ONE primary threat (e.g., either an encountered creature OR a patrolling sentry), rather than piling multiple uncoordinated antagonists into the same instant. Never depict an NPC completely oblivious to a giant predator coiling in front of them!
${bestiaryGrounding}
- COMPREHENSIVE CHOICE COVERAGE: The generated choices MUST directly address the active demands, ultimatums, or physical hazards presented at the end of the prose (e.g., if an adversary orders the protagonist to back away or face violence, choices must provide direct responses such as compliance, de-escalation, deception, cover, or counter-resistance).
- ITEM ROLE FIDELITY & NO ABSURD MISUSE: Equipped gear, relics, talismans, and artifacts must ONLY be referenced or offered in choices according to their true authored nature and powers (e.g. a desert survival bead, talisman, or sacred relic is NOT a throwaway pebble to toss into mud as a diversion, nor a random fidget prop to touch while talking). Permanent and non-consumable items must NEVER be used as disposable projectiles or distractions!
- Preserve present participants, their positions, and unresolved threats from recent prose. Do not silently remove opposition or treat a brief opening as a fully secured scene.
- Track who can see and hear each action. When a pre-resolved consequence requires a revelation, stage its delivery plausibly and account for witnesses' reactions; do not invent privacy or let nearby adversaries ignore an audible confession.
- Every choice must be possible at the end of this scene and grounded in facts the protagonist has actually learned. Do not invent profits, motives, ownership, accomplices, or available escape routes from a loosely related clue. Questions may investigate uncertainty, but must not present an unproven premise as fact.
- STRICT FACTUAL GROUNDING IN SCENE PROSE: Every choice MUST strictly react to the physical obstacles, characters, and situation explicitly established in the scene text. Do NOT invent phantom entities, unmentioned bystanders, cargo inspections, baggage searches, or phantom subplots. Choices must only address what is actually mentioned in the prose.
- Do not offer leverage that this scene has already spent, such as threatening to disclose information to someone who just heard it. Do not ask an NPC to remove an obstacle they do not control.
- PSYCHOLOGICAL BREAKING POINT FIDELITY (NO PREMATURE COLLAPSE): Any "Breaking point / نقطه شکست" mentioned in consequence text or NPC notes describes that NPC's internal psychological vulnerability or theoretical condition for future total collapse (e.g. "facing armed rebellion or death of their commander"). It is NOT an event that took place in this turn unless explicitly performed by the player! Do NOT narrate hypothetical breaking point events (such as soldiers abandoning posts, commanders being slain, or garrisons scattering) as accomplished facts unless the player actually caused or executed that exact event.
- UNIVERSAL ACTION FEASIBILITY & PROPORTIONATE CONSEQUENCES: Impossible or absurd actions (e.g. asking a reigning king to hand over his crown, a lone mortal charging an entrenched armed military squad, leaping a 100ft canyon bare-bodied) CANNOT grant the impossible goal even on high dice rolls. The narrative reaction MUST be strictly proportionate to the absurdity of the action:
  * Social Audacity (e.g. asking the king for his crown): A salvage roll makes the ruler roar with laughter or treat the player as a harmless court jester; a standard roll results in immediate arrest for high treason / dungeon.
  * Asymmetric Combat (e.g. charging a military squad solo): A salvage roll represents miraculous narrow survival (parrying killing blows, scrambling back alive with wounds); a normal roll results in being battered down by numbers, disarmed, and pinned in the mud.
  * Physical Defiance (e.g. jumping vast chasms): Results in plunging down, broken bones, or fatal hazard.
  Never grant superhuman plot armor or treat absurd demands as successful real-world accomplishments.
- Before returning JSON, check narrative and choices together for action scope, remaining opposition, witness knowledge, and supported premises. Revise contradictions without changing the authoritative game outcome.${woundBeat ? `\n${woundBeat}` : treatedWoundBeat ? `\n${treatedWoundBeat}` : ''}`;

    const systemPrompt = isEnglish
      ? `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).${authorDirective}
Base Language: Write the entire narrative and choices in pure, literary ENGLISH.

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. LITERARY MULTI-PARAGRAPH NOVELISTIC ARCHITECTURE:
   - Target Length: Deliver rich, atmospheric literary prose between 250 and 500 words across 4 distinct paragraphs. Keep the pacing focused, kinetic, and punchy—never condense into a single brief paragraph, nor bloat into rambling scenic filler!
   - Paragraph 1 (Kinetic Execution & Immediate Sensory Impact): Open directly with the physical execution of the player's action, the clash of metal, wood, or muscle, and tactile sensory immersion (the smell of cold river mist, spray of wet silt, reverberation in your arm, the sting of sudden pain or momentum).
   - Paragraph 2 (World Ripple & Living Environment/NPC Counter-Play): Expand the lens to show how the surrounding world and present entities react (the shifting stance of adversaries, the glint of torchlight, animals muttering in their harnesses, or a companion/bystander reacting with dialogue or movement).
   - Paragraph 3 (Sensory Evolution & Tactical Tension): Broaden the atmosphere and sensory depth, capturing shifting environmental details, psychological stakes, or the escalating tactical situation.
   - Paragraph 4 (Tactile Stakes, Aftermath & The Looming Dilemma): Bring focus back to the protagonist's physical state (breathing, pulse, bleeding wounds, or strain on your shield/blade) and firmly establish the new tactile dilemma and tension that seamlessly sets up the choices.
   - PARAGRAPH DELIMITATION & SENTENCE DENSITY: Separate the 4 paragraphs with a blank line (\n\n). Each paragraph should contain roughly 3 to 5 full, descriptive, and purposeful sentences (approximately 60 to 110 words per paragraph), ensuring the full scene lands naturally within the 250 to 500 word range.
   - SENSORY MICRO-OBSERVATIONS: Weave at least two tactile, auditory, or olfactory details into the prose (e.g. the cold bite of night air through a split in the leather, the weight of the bronze hilt, or the sucking drag of black mud).
   - DIALOGUE FRICTION & ECHO: If the player or an adversary speaks, greets, or shouts, dramatize both the spoken dialogue ("...") and the audible response, counter-threat, or stunned silence.
[CAUSE & EFFECT PRIORITY — IMMEDIATE ACTION RESPONSIVENESS]
- The prose MUST open with or directly dramatize the protagonist performing the player's specific action and the immediate direct reaction of the world or target NPC.
- TARGET FIDELITY: Depict the reaction of the EXACT entity targeted by the action (e.g. the closed gate, the wall, or the specific sentry). Do NOT invent or substitute an unintroduced commander or off-scene NPC as the face-to-face responder!
- SPATIAL CONTINUITY & SECLUDED VANTAGE: If the protagonist moved to a distinct sub-location or secluded micro-vantage (e.g. muddy reeds, dark alley, rooftop shadows), NPCs left at camp or the gate DO NOT teleport beside them. They remain at their post. Unless an action creates an overtly loud commotion (explosion, fire, loud shout for help), the secluded scene remains strictly solitary and quiet; distant NPCs do not notice, grab torches, or walk over.
- SINGLE DRAMATIC CONFLICT: Escalate one focused conflict or obstacle per turn. Do not spawn multiple uncoordinated crises simultaneously.
- CONVERSATIONAL ACTIONS: If the player spoke, asked, greeted, questioned, or negotiated with someone, the scene MUST feature direct spoken dialogue ("...") from the protagonist and a personal, direct reply or confrontation from the targeted NPC. Never reduce the player's speech to silence or generic ambient crowd noise!
- SENSORY BESTIARY DEPICTION: When wild beasts or monstrosities appear, describe their physical traits, coloration, and predatory movements viscerally. Avoid putting formal taxonomy names in awkward quotes in the prose (the game UI renders a dedicated Bestiary Discovery card for the player).
- ITEM ROLE FIDELITY: Equipped relics, talismans, and artifacts must be treated with appropriate weight according to their authored powers and slot. Never treat sacred relics or survival talismans as disposable diversion pebbles or casual conversational fidget props.
- ABILITY & SPELL AWARENESS: Honor the protagonist's known skills, passive feats, and spells in combat narration and when offering choices. A character with specialized defensive, wilderness, or magical traits instinctively relies on their training during tense encounters.
- SECOND-PERSON POV CONSISTENCY: Always maintain a strict second-person POV ("You"). Never refer to the protagonist in the third person by their proper name (e.g. avoid "Barzin's footstep"); address the reader directly ("your footstep", "you lunge", "your boots sink into the mud").
- KINETIC COMBAT CHOREOGRAPHY: When narrating parries, dodges, blocks, or physical clashes, vividly depict BOTH sides of the conflict: first dramatize the adversary's sudden attack, lunge, or strike (e.g., bared fangs, snapping jaws, leaping from the mud, or a sentry's descending blade), and immediately follow with the protagonist's physical reaction, the resounding impact of wood, steel, or shield, and the tactile aftermath. Never omit the enemy's attack, leaving defensive actions to occur in a vacuum.
- BIOME & CLIMATE FIDELITY: Strictly adhere to the authored biome, climate, and atmospheric conditions of the protagonist's active location (e.g. humid wetlands, warm reed beds, dusty plains). Never hallucinate contradictory environmental extremes (such as frost, ice, half-frozen mud, or snow in warm marshes or arid riverbanks).
- AUDITORY PLAUSIBILITY & SECLUSION: Unless the protagonist's or adversary's actions cause an overtly loud, echoing disturbance (such as an explosion, a loud battle cry/scream for help, or a massive blaze), secluded micro-locations (e.g. dense river reeds, dark alleys, remote mudbanks) MUST remain strictly solitary and quiet. Distant bystanders, camp occupants, or sentries do NOT randomly notice, grab torches, or walk over unprompted.
- FORWARD MOMENTUM ON OVERCOME OBSTACLES: When a physical, tactical, or social obstacle has been overcome (especially with a triumph, success, or decisive action like clearing guards, crossing a bridge, unlocking a door, or pacifying beasts), you MUST advance the protagonist physically across the threshold into the new space or next phase! Do NOT reset or re-describe the protagonist stranded before the same old obstacle, and NEVER propose choices that re-attempt or re-phrase what was just completed.
- BAN REPETITIVE TROPES & STOCK GESTURES: Do NOT repeat identical physical mannerisms, character quirks, or stock gestures across turns (such as NPCs repeatedly slamming pipes, wiping brow sweat, or repeating identical ambient wind/weather phrasing). Show dynamic, evolving reactions and progressive dialogue rather than recycling the exact same physical gesture.
- ANTI-RECYCLING OF BODILY INJURIES & ENVIRONMENTAL ACCIDENTS (NO STUCK CRISIS LOOPS): NEVER repeat or re-injure the exact same body part, wound narrative, or environmental accident (e.g. repeatedly tearing the same thigh wound on shale rock, repeatedly tilting camel litters, or repeatedly re-bandaging in an endless loop). Once a physical injury or road mishap occurs, the scene MUST dynamically evolve forward into interpersonal dialogue, social interrogation, tactical movement, or a fresh new conflict. Do NOT turn the narrative into an endless repetitive medical or harness-fixing cycle!
- NATURAL LITERARY ITEM & GEAR REFERENCES: Refer to the protagonist's gear using natural literary prose (e.g. "your blade", "your shield", "your armor", "the leather tunic"). NEVER copy-paste long, awkward formal catalog/database titles verbatim in every sentence (e.g. avoid repeating "the dust-covered leather cuirass of Hiram" or "metal-rimmed wooden shield" repeatedly). Introduce the item naturally and use simple nouns or pronouns thereafter.
- REALISTIC SENTRY & GARRISON DISCIPLINE: A single early-game or mortal traveler cannot effortlessly terrify or rout an entire disciplined armed garrison (such as a squad of sentries holding a bridge or gate) with a mere shout or assertive step. Unless backed by overwhelming supernatural aura, an army, or immense pre-existing leverage, guard units maintain basic military discipline: intimidation or strength checks may cause them to hesitate, step back into defensive spear formations, demand tolls/papers, or yield grudging passage under tense standoff conditions, but does NOT cause professional soldiers to instantly burst into tears, drop weapons, flee their posts, or blurt out unrelated conspiracies. In physical combat against an armed squad, a lone warrior faces real tactile resistance and lethal danger.
- NO FLOATING CAMERA SYNDROME: Do NOT open with detached panoramic scenery (weather, distant campfires, tobacco smoke) that ignores what the protagonist just did or said. Action and immediate reaction come first!
${statsDirective}
${dialogueDirective}
${secretGuardDirective}
${continuityDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "Visceral, atmospheric next scene prose in English...",
  "encounteredCreatureId": null, // If and ONLY IF an active predator, monster, or wild beast from [BESTIARY & CREATURES] directly engages or is encountered in this turn, provide its ID or exact name; otherwise strictly null (never set for ambient plants, background livestock, or setting descriptions)
  "playerConditionChanges": {
    // ONLY conditions ACTUALLY DEPICTED in the narrative above. Empty arrays when nothing changed.
    "add":    [ { "kind": "wounded", "severity": "moderate", "source": "the shard opened a gash on your left forearm" } ],
    "treat":  [ { "kind": "wounded", "method": "you tear a strip of cloth and bind the gash" } ],
    "remove": [ { "kind": "bleeding", "reason": "the pressure stops the bleeding" } ]
  },
  "npcTrustChanges": [
    // ONLY meaningful interpersonal shifts ACTUALLY DEPICTED in the narrative above. Empty array when nothing changed.
    { "npcName": "Exact NPC name from the active dossiers", "trustDelta": 8, "reason": "you sealed the salt contract and split the profit fairly" }
  ],
  "clockChanges": [
    // ONLY clocks listed under [ACTIVE THREAT CLOCKS], and ONLY when the narrative depicts the shift. Empty array when nothing moved.
    { "clockName": "Exact clock name from the active clocks list", "delta": 1, "reason": "you push the caravan through the night instead of making camp" }
  ],
  "choices": [
    { "id": "choice_1", "text": "Carefully inspect the masonry around the threshold for a hidden lever or latch", "style": "inquisitive", "riskLevel": "low" },
    { "id": "choice_2", "text": "Quietly draw the dagger and step behind the granite pillar", "style": "tactical", "riskLevel": "medium", "targetDC": ${exampleMedDC}, "requiredStatId": "${validStatIds[0] || 'might'}" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "Key discovery about a character in English..." }
  ]
}
[FAILURE FORWARD CONTRACT — MANDATORY]
- Failure denies the INTENT, never the story. The player's stated goal must NOT be granted, and a failed check must never be narrated as a disguised success.
- When [PRE-RESOLVED GAME ENGINE OUTCOME] names a Failure Mode and directive, that is BINDING. Depict the primary movement (cost / complication / reveal / reposition / escalation) and any secondary movement it names.
- Every failure must change the situation concretely: a price paid, a new complication, a revealed fact, a forced change of position, or an advancing threat. The same obstacle may not remain exactly as it was with no new information, pressure, price, or opportunity.
- Costs must be causal and proportional. HP only for bodily risk. Social/investigative failures cost time, attention, stamina, composure, leverage, or information. NEVER invent a wound, rescuer, hazard, or retroactive fact to justify a cost.
- At least two offered choices must pursue a genuinely different approach. A static "try again" or a rephrasing of the failed action as the only path is FORBIDDEN.
- A hard stop is permitted ONLY when the engine marks it as authorized (authored gate or exhausted retries). Then show exactly why the method cannot work, reveal what is required, and offer at least two genuinely different alternatives. Otherwise the protagonist must not remain stuck.
- If the engine moved the protagonist to a new location this turn, the failure is the price of arrival. Depict the new place and the cost of entering it; do not narrate them still stuck at the old threshold.

[CONDITION CHANGE CONTRACT — MANDATORY]
- Every entry in playerConditionChanges.add / treat / remove MUST be visible in the narrative you just wrote. If the prose does not depict it, do NOT list it. If the prose depicts a wound, you MUST list it.
- Bandaging, splinting, poultices, or a healer's care → "treat" (never "remove"). A wound is only "remove"d on genuine healing (magic, medicine, a long convalescent rest) explicitly narrated.
- "bleeding" may accompany "wounded" when the prose shows active blood loss and is removed (via "treat") once the bleeding is stopped. Never remove "bleeding" without treatment prose.
- "severity" is narrative only: "minor" | "moderate" | "severe". Never write mechanical numbers, HP values, or dice terms here.
- Player conditions only — never NPC or party wounds. Leave arrays empty on quiet turns.

[NPC TRUST CONTRACT — MANDATORY]
- Only NPCs PRESENT in this scene (the [ACTIVE NPC DOSSIERS] and party blocks above) may gain or lose trust. Never off-screen characters, distant rulers, or faceless groups.
- Declare a change ONLY when the narrative itself depicts the interpersonal shift: a deal struck or accepted, a bargain sealed, a promise kept or broken, aid given, a kindness, an insult, a threat, or a betrayal. If nothing shifted, use [].
- "trustDelta" is an integer between -20 and +20: small gestures ±2..5, meaningful events ±8..15, betrayal or rescue up to ±20. Put the NPC's exact name in "npcName" and cite the prose evidence in "reason".
- Trust is disposition toward the protagonist — never quest state or secret discovery. NEVER write the number or any mechanical term inside the narrative prose.

[TENSION CLOCK CONTRACT — MANDATORY]
- Only clocks listed in [ACTIVE THREAT CLOCKS] may change. Never invent a clock, a segment count, or a danger meter.
- Declare a change ONLY when the narrative itself depicts the pressure shift: delay, a lost trail, a failed or costly task, violence that draws attention, an alarm — or, in the other direction, rest, water, shelter, a bribe, or a clean success that removes the threat.
- "delta" is an integer from -2 to +2. Most scenes move a clock by 1; a severe setback may add 2. NEVER write clock numbers or mechanics inside the prose.
- If your declared delta fills the clock, the conversation's prose MUST already depict that clock's crisis event in this same scene. Never fill a clock and leave its crisis undescribed.
- A clock marked CRISIS TRIGGERED has already paid out — do not advance it again.
`
      : `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).${authorDirective}
Base Language: Write the narrative and choices in PERSIAN (فارسی - شیوا و ادبی).

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. عمق ادبی، گستردگی داستان و ساختار چندبندی رمان (LITERARY MULTI-PARAGRAPH ARCHITECTURE):
   - حجم و طول متن: نثری شیوا، غنی و رمان‌گونه بین ۲۵۰ تا ۵۰۰ کلمه در قالب ۴ بند (پاراگراف) مشخص و خوش‌خوان ارائه بده. ریتم روایت باید پرشتاب، زنده و تأثیرگذار باشد—هرگز تمام صحنه را در یک بندِ کوتاه خلاصه نکن، و در عین حال از اطناب و کش دادن بی‌دلیل پرهیز کن!
   - بند اول (کنش جنبشی و ضربهٔ حسیِ بلافاصله): صحنه را مستقیماً با خودِ عمل بازیکن، درگیری فیزیکی، طنین برخورد تیغه یا سپر، پاشیدن گل‌ولای یا بوی نم و غبار، و پیامد ملموس مکانیکی آغاز کن.
   - بند دوم (بازتاب محیطی و کنش‌وپاسخ شخصیت‌ها / درندگان): زاویه را بازتر کن و نشان بده محیط زنده و افراد حاضر چگونه واکنش نشان می‌دهند (چرخش یا موضع‌گیری گزمه‌ها یا درنده، بازتاب نور مشعل‌ها بر لجن، بی‌قراری شترها و ستوران، یا عکس‌العمل و کلام اطرافیان).
   - بند سوم (توسعهٔ اتمسفر و تنش روانی/محیطی): به جزئیات فضاسازی، سایه‌روشن‌ها، بوی محیط و بار روانی و تاکتیکی موقعیت عمق ببخش.
   - بند چهارم (پیامد جسمانی، ایستایی صحنه و تنگنای پیش‌رو): دوباره بر وضعیت ملموس تن، نفس‌ها، درد یا کوفتگی عضلات، چنگ زدن دست بر قبضه، و موقعیت دشوار و تعلیقی که بازیکن پیش از تصمیم بعدی در آن گرفتار شده تمرکز کن تا گزینه‌ها کاملاً طبیعی بر بستر این تعلیق بنشینند.
   - تفکیک بندها با خط خالی و چگالی جملات: دقیقاً ۴ بند را با خط خالی (\n\n) از هم جدا کن. هر بند حاوی ۳ الی ۵ جملهٔ کامل، فضاساز و سنجیده باشد (حدود ۶۰ الی ۱۱۰ کلمه برای هر بند) تا حجم کل صحنه به شکل طبیعی در محدوده مطلوب ۲۵۰ تا ۵۰۰ کلمه قرار گیرد.
   - ریزمشاهدات حسی (Sensory Micro-Observations): حداقل دو جزئیات ملموس حسی (سرمای گزندهٔ بادِ آب بر عرق تن، سنگینی انتهای شمشیر در کف دست، صدای خرد شدن نی‌های خشک زیر چکمه) را در تاروپود متن بگنجان.
   - طنین گفتار و دیالوگ: اگر بازیکن یا شخصیتی سخن گفت، حتماً دیالوگ مستقیم با علامت «...» را با پاسخ کلامی، تشر، یا سکوت تهدیدآمیز طرف مقابل بازتاب بده.
[اولویت علت و معلول — پاسخگویی مستقیم به اقدام بازیکن / CAUSE & EFFECT PRIORITY]
- صحنه باید فوراً با نشان دادن خودِ کنش بازیکن و واکنش بلافاصلهٔ جهان یا شخصیت مقابل آغاز شود یا بر آن متمرکز باشد.
- وفاداری به هدف اقدام (Target Fidelity): دقیقاً واکنش همان هدف، شخص یا مانعی که بازیکن مورد خطاب قرار داده یا بر آن اقدام کرده را نشان بده (مثلاً همان نگهبانان یا درِ بسته). هرگز یک فرمانده یا شخصیت غایب را که در صحنه نبوده ناگهان رو در روی بازیکن ظاهر نکن!
- پیوستگی مکانی و انزوای صحنه (Spatial Continuity & Seclusion): اگر قهرمان به محلی جداگانه، تاریک یا دورتر از قرارگاه قدم گذاشته (مانند لجن‌زار حاشیهٔ رودخانه یا میان نی‌زارها)، شخصیت‌های مستقر کنار آتش یا بارانداز (مانند رادمان یا ساربانان) در جای خود باقی می‌مانند. تا زمانی که حادثه‌ای به شدت پرسروصدا (مانند انفجار، فریاد بلند کمک‌خواهی یا آتش‌سوزی مهیب) رخ نداده باشد، صحنه در انزوای کامل است و افراد دوردست متوجه درگیری‌های موضعی در دل نی‌زار نمی‌شوند؛ هرگز آنها را بدون دلیل صوتی موجه با پای پیاده و مشعل‌به‌دست به صحنه نکشان.
- تمرکز بر یک بحران واحد (Single Dramatic Focus): در هر نوبت فقط یک منبع تنش یا خطر را تشدید کن. از رویارویی هم‌زمان بازیکن با دو خطر نامرتبط (مثلاً حملهٔ موجود وحشی همراه با اخطار نیزه‌دار بی‌خبر) اکیداً بپرهیز.
- پیوستگی محیطی: از ابداع موانع یا وسایل فیزیکیِ ذکرنشده (مانند بارهای انباشته‌شده یا کاروان‌ها) خودداری کن، مگر اینکه در متن صحنه‌های قبلی صراحتاً آمده باشند.
- اقدامات گفتاری و پرسش: اگر بازیکن سخنی گفت، سؤالی پرسید، سلام کرد یا با کسی وارد مذاکره شد، صحنه حتماً باید شامل دیالوگ مستقیم با علامت «...» باشد که به شکل شخصی و مستقیم به خودِ بازیکن پاسخ می‌دهد (یا با کلام و یا با تهدید/برخورد فیزیکی مشخص). هرگز دیالوگ بازیکن را بی‌پاسخ نگذار و آن را به فریادهای نامربوط در پس‌زمینه تبدیل نکن!
- وفاداری به ماهیت آیتم‌ها و ابزارها (Item Role Fidelity): تجهیزات، یادگارها و طلسم‌های همراه قهرمان باید دقیقاً مطابق با ماهیت و کارکرد تعریف‌شده‌شان استفاده شوند. هرگز یادگارهای باستانی، نمادها یا مهره‌های مقدس و دائمی (مانند دافع عطش و سراب) را به عنوان سنگریزه برای پرتاب و انحراف حواس دشمن، یا فیجت و بازیچهٔ دست در حین صحبت به کار نبر! آیتم‌های دائمی و غیرمصرفی هرگز نباید به عنوان اشیاء پرتابی تلف شوند.
- وفاداری به توانایی‌ها و جادوها (Ability & Spell Awareness): در توصیف صحنه‌های نبرد، خطرات و انتخاب‌های پیش‌رو، به مهارت‌ها، خصلت‌های ذاتی و جادوهای ثبت‌شدهٔ قهرمان وفادار باش. شخصیتی که دارای مهارت‌های دفاعی، کاروانی یا جادویی ویژه است، در مواجهه با بحران‌ها و خطرات باید بتواند بر اساس این آموزش‌ها و توانایی‌ها واکنش نشان دهد.
- توصیف حسی و طبیعی موجودات (Sensory Bestiary Depiction): هنگام رویارویی با جانوران یا هیولاها، ویژگی‌های عینی، فلس‌ها، صدا و حرکات هولناک آن‌ها را به شکل زنده توصیف کن، اما از گذاشتن نام رسمی کتابچه در داخل گیومه مثل «افعی رسوبی» در متن خودداری کن؛ واسط کاربری بازی خود کارت شناسایی و کشف موجود را نمایش می‌دهد. در گزینه‌ها نیز به شکل طبیعی به آن اشاره کن (مثلاً «خزنده»، «مار»، یا «درنده»).
- ثبات زاویه دید دوم‌شخص («تو» / Second-Person POV): همواره زاویه دید دوم‌شخص را حفظ کن. هرگز با ذکر نام سوم‌شخصِ قهرمان دربارهٔ او ننویس (از عباراتی مثل «گامِ برزین در گل فرو می‌رود» اکیداً پرهیز کن؛ بنویس: «گام‌هایت»، «پایت در گل فرو می‌رود»، «دستت را دراز می‌کنی»).
- زبان طبیعی در اشاره به زره و سازوبرگ (Natural Literary Item References): در اشاره به سازوبرگ و سلاح‌های قهرمان، از نثر طبیعی و شیوا استفاده کن (مانند «شمشیرت»، «سپر»، «جوشن چرمی‌ات»). از ترکیبات ناشیانهٔ ترجمه‌زده مانند «چرم زره‌پوش» اکیداً خودداری کن (زره‌پوش صفت انسان است، نه چرم). همچنین از تکرار مکانیکی و آزاردهندهٔ عناوین کامل و کاتالوگی دیتابیس در هر بند (مانند تکرار مداوم «جوشن چرمی غبارگرفتهٔ هیرام»، «سپر چوبی لبه‌فلزی» یا «شمشیر سرپایی مسافران») اکیداً خودداری کن؛ پس از اولین اشاره، از ضمایر و نام‌های طبیعی ساده استفاده کن.
- پیشروی اجباری پس از عبور از موانع (Forward Momentum on Overcome Obstacles): وقتی یک مانع فیزیکی، تاکتیکی یا اجتماعی پشت سر گذاشته می‌شود (به‌ویژه با موفقیت، پیروزی قاطع، گشوده شدن راه، یا عبور از پل/دروازه)، راوی موظف است قهرمان را از آستانه عبور داده و وارد فضا، بن‌بست یا مرحلهٔ بعدی کند! هرگز نباید در نوبت بعدی قهرمان را مجدداً پشت همان درِ بسته یا همان دهانهٔ پل توصیف کنی، و پیشنهاد دادن انتخاب‌هایی که همان کارِ انجام‌شده را تکرار کنند اکیداً ممنوع است.
- ممنوعیت تکرار حرکات و کلیشه‌های رفتاری (Ban Repetitive Tropes & Stock Gestures): از تکرار حرکات کلیشه‌ای و رفتارهای تکراری شخصیت‌ها در نوبت‌های پیاپی (مانند کوبیدن مداوم چپق رادمان به زمین، مالیدن مداوم عرق پیشانی، یا توصیف یکنواخت زوزهٔ باد) اکیداً خودداری کن. واکنش‌ها و دیالوگ‌های اطرافیان باید پویا، پیش‌رونده و متغیر باشند.
- ممنوعیت بازیافت و تکرار حوادث فیزیکی و جراحات تکراری (Anti-Recycling of Bodily Injuries & Mishaps): اکیداً از تکرار یک سانحهٔ فیزیکی یا پارگی مداوم یک نقطه از بدن (مانند پاره شدن چندبارهٔ گوشت ران روی سنگ، کج شدن مداوم کجاوهٔ شتر، ریختن دوبارهٔ روغن داغ، یا چرخیدن در لوپِ بی‌پایان پانسمان و باز شدن زخم) خودداری کن! اگر یک‌بار آسیبی به بدن یا کاروان وارد شد، داستان فوراً باید وارد فاز دیالوگ‌های انسانی، بازجویی از اطرافیان، تعارضات اجتماعی یا پیشروی به سمت مقصد شود و نباید در یک چرخهٔ مضحک و فرسایشی از حوادثِ بدنی مشابه درجا بزند!
- انضباط واقع‌گرایانهٔ سربازان و گزمه‌ها (Realistic Garrison Discipline): یک مسافر یا جنگجوی تنها نمی‌تواند با یک فریاد، گام استوار یا تشر، یک گروهان یا دستهٔ گزمه‌های مسلحِ مستقر بر پل یا دروازه را به وحشتِ کودکانه، انداختن سلاح‌ها، گریه یا فرار وا دارد! انضباط نظامی نگهبانان را واقع‌گرایانه به تصویر بکش: ارعاب یا نمایش قدرتِ موفق تنها می‌تواند آن‌ها را به درنگ، احتیاط، حفظ فاصله با نیزه‌های رو به جلو، طلب باج/مجوز یا باز کردن معبر در فضایی پر از تنش و دست‌به‌قبضه وادار کند، اما سربازان مسلح هرگز پست خود را رها نکرده، سلاح نمی‌اندازند و رازهای پنهان اشخاص ثالث را فاش نمی‌کنند. رویارویی با گروهی از گزمه‌های مسلح دارای خطر فیزیکی ملموس و اصطکاک جنگی است.
- طراحی دوسویهٔ حرکات رزمی (Kinetic Combat Choreography): هنگام دفع، جاخالی، دفاع یا نبرد تن‌به‌تن، هر دو سوی درگیری را به شکل ملموس و پرشتاب توصیف کن: ابتدا جهش، نیش یا هجوم ناگهانی دشمن (مانند باز شدن آرواره‌ها، کمانه کردن درنده از میان گل‌ولای یا فرود شمشیر گزمه)، و سپس بلافاصله واکنش فیزیکی قهرمان، طنین صدای برخورد سلاح یا سپر، و پیامد ملموس آن. هرگز هجوم دشمن را جا نینداز تا دفاع قهرمان در خلأ رخ ندهد.
- پایبندی به اقلیم و اتمسفر بومی (Biome & Climate Fidelity): توصیفات آب‌وهوا، حرارت، لجن و پوشش گیاهی باید کاملاً منطبق بر اتمسفر مکانِ حضور بازیکن در کتابچهٔ جهان باشد (مثلاً هوای شرجی، گرم، خاکی یا نمناک حاشیهٔ دشت و هور). هرگز اقلیم‌های خیالی و متناقض مانند لجن نیمه‌منجمد، یخ‌زدگی یا برف در تالاب‌ها و دشت‌های گرم و شرجی ابداع نکن.
- واقع‌گرایی صوتی و انزوای صحنه (Auditory Plausibility & Seclusion): تا زمانی که اقدام بازیکن یا درگیری با دشمن صدای مهیب (مانند انفجار، فریاد بلند کمک‌خواهی، یا آتش‌سوزی آشکار) ایجاد نکرده باشد، صحنه‌های مخفیانه، خلوت یا دورافتاده (مانند نیزار حاشیهٔ رود، خرابه‌ها یا پایاب تاریک) باید کاملاً «منزوی و در خلوت» باقی بمانند. هرگز شخصیت‌های دوردست یا افراد کنار آتش را بدون دلیل صوتی موجه یا مشاهدهٔ مستقیم، با پای پیاده و مشعل‌به‌دست به صحنه نکشان.
- منع زاویه دید دوربین معلق: صحنه را با توصیفات کلی و منفعلانه از منظره و دود و آتش‌های دوردست شروع نکن که عمل مشخصِ بازیکن در آن نادیده گرفته شود. اقدام و واکنش در اولویت اول هستند!
- واقع‌گرایی همه‌جانبهٔ اقدامات و پیامدهای متناسب (Universal Action Feasibility): اقداماتی که از نظر فیزیکی، اجتماعی یا مقیاس نبرد ناممکن یا نامعقول هستند (مانند طلب تاج از پادشاه، حملهٔ تن‌به‌تن یک مسافر تازه‌کار به یک صف یا گروهان نظامی، یا پریدن از روی یک درهٔ صدمتری) حتی با تاس بالا هرگز نمی‌توانند به تحقق خواستهٔ ناممکن منجر شوند! پیامد روایت باید دقیقاً متناسب با ماهیت اقدام باشد:
  * جسارت اجتماعی (مانند طلب تاج از شاه): پرتاب نجات‌بخش باعث خندهٔ شاه و تلقی بازیکن به عنوان دلقک دربار می‌شود؛ اما یک پرتاب عادی فوراً به کشیده شدن شمشیرها و پرتاب به سیاه‌چال به جرم خیانت منجر می‌شود.
  * نبرد نامتقارن (مانند یورش انفرادی به صف گزمه‌ها): پرتاب نجات‌بخش تنها به معنی فرار معجزه‌آسا از مرگ با جراحت است؛ پرتاب عادی به معنی کوبیده شدن به گل، خلع سلاح و زمین‌گیر شدن است.
  * تمرد از قوانین فیزیک (مانند پریدن از دره یا پرواز بدون جادو): به سقوط، شکستن استخوان‌ها و مخاطرهٔ مرگبار ختم می‌شود.
  هرگز زره‌پوش خیالی (پلات آرمور) یا پیروزی‌های مضحک و غیرمنطقی در برابر قوانین جهان داستان خلق نکن.
${statsDirective}
${dialogueDirective}
${secretGuardDirective}
${continuityDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "متن ادبی و فضاسازی صحنه بعدی...",
  "encounteredCreatureId": null, // فقط و تنها در صورت نبرد یا رویارویی مستقیم با درنده، هیولا یا جانوری فعال در این صحنه، شناسه یا نام دقیق آن را از فهرست موجودات قرار دهید؛ در غیر این صورت حتماً null (هرگز برای گیاهان، دام‌های پس‌زمینه یا توصیفات محیطی مقداردهی نشود)
  "playerConditionChanges": {
    // فقط حالت‌هایی که واقعاً در همین متن روایت شده‌اند. اگر چیزی تغییر نکرده، آرایه‌ها خالی بمانند.
    "add":    [ { "kind": "wounded", "severity": "moderate", "source": "ترکش، شکافی بر ساعد چپت گشود" } ],
    "treat":  [ { "kind": "wounded", "method": "تکه‌ای پارچه می‌دری و زخم را می‌بندی" } ],
    "remove": [ { "kind": "bleeding", "reason": "فشار دست، خون‌ریزی را بند آورد" } ]
  },
  "npcTrustChanges": [
    // فقط دگرگونی‌های معنادار رابطه که عیناً در همین متن روایت شده‌اند. اگر چیزی تغییر نکرده، آرایه خالی بماند.
    { "npcName": "نام دقیق شخصیت از فهرست حاضر در صحنه", "trustDelta": 8, "reason": "پیمان نمک را بستی و سود را منصفانه تقسیم کردی" }
  ],
  "clockChanges": [
    // فقط ساعت‌هایی که در فهرست [ساعت‌های تهدید فعال] آمده‌اند، و فقط وقتی روایت تغییر فشار را نشان می‌دهد. اگر چیزی حرکت نکرده، آرایه خالی بماند.
    { "clockName": "نام دقیق ساعت از فهرست ساعت‌های فعال", "delta": 1, "reason": "کاروان را شبانه پیش می‌بری و اردو نمی‌زنی" }
  ],
  "choices": [
    { "id": "choice_1", "text": "بررسی دقیق نقش‌ونگارهای روی سنگِ درگاه برای یافتن روزنه یا نشانه‌ای پنهان", "style": "inquisitive", "riskLevel": "low" },
    { "id": "choice_2", "text": "کشیدن بی‌صدای خنجر و پناه گرفتن پشت ستون سنگی", "style": "tactical", "riskLevel": "medium", "targetDC": ${exampleMedDC}, "requiredStatId": "${validStatIds[0] || 'might'}" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "کشف رازی مهم در مورد شخصیت..." }
  ]
}
[قرارداد شکستِ پیش‌برنده — اجباری]
- شکست، «قصد» را رد می‌کند، نه داستان را. هدف اعلام‌شدهٔ بازیکن هرگز محقق نمی‌شود و شکست هرگز نباید به‌شکل موفقیت پنهان روایت شود.
- وقتی [نتیجه محاسباتی موتور بازی] «حالت شکست» و دستور آن را مشخص می‌کند، همان الزام‌آور است. حرکت اصلی (هزینه / پیچیدگی / افشا / جابه‌جایی / تشدید) و هر حرکت ثانویه را در نثر نشان بده.
- هر شکست باید وضعیت را عینی تغییر دهد: بهای پرداخت‌شده، پیچیدگی تازه، حقیقت آشکارشده، تغییر اجباری موقعیت، یا پیشروی تهدید. همان مانع نمی‌تواند بدون هیچ اطلاعات، فشار، بها یا فرصت تازه‌ای دقیقاً سر جایش بماند.
- هزینه باید علت‌ومعلول و متناسب باشد. کاهش سلامت فقط برای خطر جسمی. شکست اجتماعی/تحقیقی به‌صورت زمان، توجه، استقامت، عزم، اهرم یا اطلاعات هزینه می‌شود. هرگز برای توجیه هزینه، زخم، نجات‌دهنده، خطر یا واقعیتِ از پیش‌وجودنیامده اختراع نکن.
- دست‌کم دو گزینه باید رویکردی واقعاً متفاوت را دنبال کنند. «دوباره تلاش کن» ثابت یا بازنویسی همان اقدام شکست‌خورده به‌عنوان تنها مسیر ممنوع است.
- توقف کامل فقط وقتی مجاز است که موتور آن را مجاز اعلام کند (دروازهٔ نویسنده یا تلاش‌های تکراری تمام‌شده). در آن صورت دقیقاً نشان بده چرا این روش کار نمی‌کند، چه چیزی لازم است و دست‌کم دو جایگزین واقعاً متفاوت پیشنهاد بده. در غیر این صورت قهرمان نباید درجا بزند.
- اگر قهرمان این نوبت به مکان تازه‌ای منتقل شده، شکست بهای رسیدن است. مکان تازه و بهای ورود را نشان بده؛ او را همچنان پشت آستانهٔ قبلی نگه ندار.

[قرارداد تغییر حالت‌های قهرمان — اجباری]
- هر مورد در playerConditionChanges (افزودن/مداوا/حذف) باید عیناً در همین متن روایت شده باشد. اگر در نثر نیامده، هرگز آن را ننویس. اگر در نثر زخمی رخ داده، حتماً آن را ثبت کن.
- باندپیچی، آتل، مرهم یا مداوای درمانگر → «treat» (هرگز «remove»). یک زخم تنها با بهبود واقعی و روایت‌شده (جادو، دارو، استراحت طولانی) «remove» می‌شود.
- «bleeding» فقط وقتی همراه «wounded» می‌آید که نثر خون‌ریزی فعال را نشان دهد و با «treat» (بند آمدن خون) حذف می‌شود. هرگز بدون نثرِ مداوا خون‌ریزی را حذف نکن.
- «severity» فقط روایی است: minor | moderate | severe. هرگز عدد مکانیکی، مقدار سلامت یا اصطلاح تاس در این بخش نگذار.
- فقط حالت‌های خودِ قهرمان — هرگز زخم شخصیت‌های دیگر یا یاران. در نوبت‌های آرام آرایه‌ها را خالی بگذار.

[قرارداد اعتماد شخصیت‌ها — اجباری]
- فقط شخصیت‌هایی که در همین صحنه حاضرند (بخش دوسیه‌های فعال و یاران) می‌توانند اعتمادشان تغییر کند. هرگز شخصیت‌های غایب، بزرگان دور یا گروه‌های بی‌نام.
- تغییر را فقط وقتی ثبت کن که خودِ روایت دگرگونی رابطه را نشان دهد: بستن یا پذیرفتن قرارداد، معامله، وعدهٔ انجام‌شده یا شکسته، یاری و لطف، توهین، تهدید یا خیانت. اگر چیزی تغییر نکرده، آرایه را خالی بگذار ([]).
- «trustDelta» عددی صحیح بین ۲۰- تا ۲۰+ است: حرکت‌های کوچک ۲ تا ۵، رخدادهای معنادار ۸ تا ۱۵، خیانت یا نجات تا ۲۰. نام دقیق شخصیت را در «npcName» و شاهد روایی را در «reason» بنویس.
- اعتماد یعنی نگرش شخصیت نسبت به قهرمان — نه وضعیت مأموریت و نه کشف راز. هرگز عدد یا اصطلاح مکانیکی را داخل متن روایت ننویس.

[قرارداد ساعت تنش — اجباری]
- فقط ساعت‌هایی که در [ساعت‌های تهدید فعال] آمده‌اند می‌توانند تغییر کنند. هرگز ساعتی از خود نساز و بخش یا عدد خطر جعل نکن.
- تغییر را فقط وقتی ثبت کن که خودِ روایت تغییر فشار را نشان دهد: تعلل، گم کردن مسیر، شکست یا هزینهٔ سنگین، خشونتی که توجه جلب می‌کند، به صدا درآمدن هشدار — یا در سوی دیگر، استراحت، آب، پناه، رشوه، یا موفقیتی پاک که تهدید را برمی‌دارد.
- «delta» عددی صحیح بین ۲- تا ۲+ است. بیشتر صحنه‌ها ساعت را ۱ واحد جابه‌جا می‌کنند؛ یک عقب‌گرد شدید می‌تواند ۲ واحد باشد. هرگز عدد یا مکانیک ساعت را داخل متن روایت ننویس.
- اگر تغییر اعلام‌شده ساعت را پر می‌کند، متن همین صحنه باید پیش‌تر بحران آن ساعت را روایت کرده باشد. هرگز ساعتی را پر نکن و بحرانش را نانوشته رها نکن.
- ساعتی که «بحران!» خورده دیگر پرداخت شده است — دوباره پیش نبرش.
`;

    // Build Protagonist Status & Capabilities block
    const playerStats = context.playerStatus?.stats || {};
    const playerResources = context.playerStatus?.resources || {};
    const playerEquipped = context.playerStatus?.equippedItems || [];

    const statsLineEn = Object.entries(playerStats)
      .map(([id, val]) => {
        const def = statsDefs.find((s) => s.id?.toLowerCase() === id.toLowerCase());
        const label = def?.nameEn || def?.name || id;
        return `${label}: ${val}`;
      })
      .join(', ');

    const statsLineFa = Object.entries(playerStats)
      .map(([id, val]) => {
        const def = statsDefs.find((s) => s.id?.toLowerCase() === id.toLowerCase());
        const label = def?.nameFa || def?.name || id;
        return `${label}: ${val}`;
      })
      .join('، ');

    const resourcesLine = Object.entries(playerResources)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const powerRanksLineEn = context.activePowerRanks?.length
      ? context.activePowerRanks
          .map((pr) => `• ${pr.schoolName}: Rank ${pr.rank} - ${pr.rankName}${pr.rankTitle ? ` (${pr.rankTitle})` : ''} [Tier: ${pr.scope || 'seasoned'}] — ${pr.capabilities}`)
          .join('\n')
      : '';

    const powerRanksLineFa = context.activePowerRanks?.length
      ? context.activePowerRanks
          .map((pr) => `• ${pr.schoolName}: مرتبه ${pr.rank} - ${pr.rankName}${pr.rankTitle ? ` (${pr.rankTitle})` : ''} [سطح: ${pr.scope || 'seasoned'}] — ${pr.capabilities}`)
          .join('\n')
      : '';

    const playerTraits = context.playerStatus?.traits || [];
    const traitsLineEn = playerTraits.length
      ? playerTraits
          .map((t) =>
            t.effects.length > 0 ? `• ${t.name} — ${t.effects.join(' | ')}` : `• ${t.name}`
          )
          .join('\n')
      : '';
    const traitsLineFa = traitsLineEn;

    const enProtagonistBlock = (statsLineEn || resourcesLine || playerEquipped.length || context.playerStatus?.abilities?.length || traitsLineEn || powerRanksLineEn || context.playerStatus?.itemInteractionsCatalog)
      ? [
          '[PROTAGONIST STATUS & CAPABILITIES]',
          context.playerStatus?.characterName
            ? `• Name: ${context.playerStatus.characterName}${context.playerStatus.archetypeName ? ` (${context.playerStatus.archetypeName})` : ''}`
            : '',
          statsLineEn ? `• Attributes: ${statsLineEn}` : '',
          resourcesLine ? `• Vitals: ${resourcesLine}` : '',
          playerEquipped.length ? `• Equipped / Carried Gear: ${playerEquipped.join(', ')}` : '',
          context.playerStatus?.abilities?.length
            ? context.playerStatus.abilities.length === 1
              ? `• Known Abilities / Spells: ${context.playerStatus.abilities[0]}`
              : `• Known Abilities / Spells:\n  ${context.playerStatus.abilities.map((a) => `• ${a}`).join('\n  ')}`
            : '',
          traitsLineEn
            ? `• Background Traits (these ALREADY altered this turn's roll — depict them as real):\n  ${traitsLineEn}`
            : '',
          context.playerStatus?.conditions?.length
            ? `• Active Character Conditions (MANDATORY sensory reflection in prose & tone): ${promptVisibleConditions(context.playerStatus.conditions).join(', ')}`
            : '',
          powerRanksLineEn ? `\n[POWER SCHOOL RANKINGS & MASTERY]\n${powerRanksLineEn}` : '',
          context.playerStatus?.itemInteractionsCatalog ? `\n${context.playerStatus.itemInteractionsCatalog}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const faProtagonistBlock = (statsLineFa || resourcesLine || playerEquipped.length || context.playerStatus?.abilities?.length || traitsLineFa || context.playerStatus?.conditions?.length || powerRanksLineFa || context.playerStatus?.itemInteractionsCatalog)
      ? [
          '[وضعیت و توانمندی‌های قهرمان داستان / PROTAGONIST STATUS]',
          context.playerStatus?.characterName
            ? `• نام: ${context.playerStatus.characterName}${context.playerStatus.archetypeName ? ` (${context.playerStatus.archetypeName})` : ''}`
            : '',
          statsLineFa ? `• ویژگی‌ها و صفات: ${statsLineFa}` : '',
          resourcesLine ? `• منابع و وضعیت حیاتی: ${resourcesLine}` : '',
          playerEquipped.length ? `• تجهیزات و اشیاء همراه: ${playerEquipped.join('، ')}` : '',
          context.playerStatus?.abilities?.length
            ? context.playerStatus.abilities.length === 1
              ? `• توانایی‌ها و جادوهای فعال: ${context.playerStatus.abilities[0]}`
              : `• توانایی‌ها و جادوهای فعال:\n  ${context.playerStatus.abilities.map((a) => `• ${a}`).join('\n  ')}`
            : '',
          traitsLineFa
            ? `• ویژگی‌های پیشینه (همین‌ها بر تاس این نوبت اثر گذاشته‌اند — آن‌ها را واقعی و ملموس روایت کن):\n  ${traitsLineFa}`
            : '',
          context.playerStatus?.conditions?.length
            ? `• حالت‌ها و وضعیت‌های فعلی کاراکتر (بسیار مهم: حتماً این احوال، تنش و فرسودگی را در نثر، تنفس و توصیف حسی منعکس کن): ${promptVisibleConditions(context.playerStatus.conditions).join('، ')}`
            : '',
          powerRanksLineFa ? `\n[مکاتب قدرت و درجات تسلط / POWER SYSTEM RANKINGS]\n${powerRanksLineFa}` : '',
          context.playerStatus?.itemInteractionsCatalog ? `\n${context.playerStatus.itemInteractionsCatalog}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    // Build the user prompt context envelope
    const parts: string[] = [];

    if (isEnglish) {
      // English Context
      if (context.worldLaws.length > 0) {
        parts.push(`[ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
      }

      parts.push(...worldBlock);

      if (enProtagonistBlock) {
        parts.push(enProtagonistBlock);
      }

      parts.push(
        `[CURRENT LOCATION: ${context.currentLocationName}]\nDescription: ${context.currentLocationDescription}`
      );

      // Plan 17 (§4.5): the road is real — journey leg / arrival discipline.
      const enJourneyBlock = PromptAssembler.journeyBlock(context, true);
      if (enJourneyBlock) {
        parts.push(enJourneyBlock);
      }

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => {
            const caravanTag = npc.caravanAffiliation
              ? ` [WITH ACTIVE CARAVAN: ${npc.caravanAffiliation}]`
              : '';
            const statusTag = npc.presenceStatus === 'nearby_resident'
              ? ' [STATIONED AT LOCATION — NOT currently in this immediate scene]'
              : (npc.presenceStatus === 'present' ? ' [PRESENT IN SCENE]' : '');
            const appearanceTag = npc.appearance ? ` - Appearance & Attire: ${npc.appearance}` : '';
            return `• ${npc.name}${caravanTag}${statusTag} (Trust: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - Speech: ${npc.speechStyle}${appearanceTag}${npc.vitalsLine ? ` - Vitals: ${npc.vitalsLine}` : ''}${npc.powerAffiliationLine ? ` - Power: [${npc.powerAffiliationLine}]` : ''}`;
          })
          .join('\n');
        parts.push(
          `[PRESENT NPCS]\n${npcs}\n` +
          `• LITERARY CHARACTER PORTRAIT DIRECTIVE: When introducing an NPC for the first time, or when an NPC performs an action or speaks, DO NOT treat them as an abstract floating name or talking head! Ground them in rich, tangible sensory prose: describe their physical stature and frame (height, broad/gaunt build, posture, gait), facial features and gaze (skin weathered by sun/cold, lines, scars, beard/hair, eye sharpness), attire and fabrics (coarse wool, leather, linen, stains, signature colors, footwear), and hands/mannerisms. Paint them vividly like a literary novel!\n` +
          `• DIRECTIVE ON NPC PRESENCE & SPATIAL CONTINUITY: NPCs marked as [STATIONED AT LOCATION — NOT currently in this immediate scene] are stationed somewhere in this broad location/garrison, but are NOT currently in front of the protagonist. DO NOT place the protagonist face-to-face with them unless an action or event explicitly summons or seeks them out. Furthermore, if the protagonist stepped away to a secluded micro-location (e.g. riverbank reeds, shadows, alleys), the scene remains strictly secluded; NPCs left at camp or the gate remain at their post and are completely oblivious to muffled, low-profile struggles within the reeds. Maintain realistic physical space!\n` +
          `• CARAVAN & TRAVELING ENTITY PRESENCE: NPCs marked with [WITH ACTIVE CARAVAN: ...] travel with the trade routes touching this location. Even if their permanent residence or home city in the World Bible is registered in another settlement, they are physically present here at the local caravanserai, baggage train, way-station, or market gates alongside their pack beasts, wagons, and wares. They are valid conversational partners, potential employers for escort contracts, and witnesses.\n` +
          `• STRICT DIRECTIVE ON ORGANIC INTRODUCTION VS CHOICES: Characters marked as [STATIONED AT LOCATION — NOT currently in this immediate scene] have NOT met or interacted with the protagonist yet. If the protagonist's action moves toward their domain (e.g. going to baggage wagons, searching for a guide), you MAY organically introduce them in your narrative prose with dialogue. However, you MUST NOT offer their names in the choice options until they have been explicitly introduced and named in the narrative text!`
        );
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (Importance: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        const mixedDirective = PromptAssembler.outcomeDirective(context.resolvedGameOutcome.outcome, true);
        const failureBlock = PromptAssembler.failureForwardBlock(context.resolvedGameOutcome, true);
        parts.push(
          `[PRE-RESOLVED GAME ENGINE OUTCOME]\n` +
          `• Player Action: "${context.resolvedGameOutcome.actionText}"\n` +
          `• Check Result: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• Consequence: ${context.resolvedGameOutcome.consequence}\n` +
          (context.resolvedGameOutcome.costLine ? `• Cost (MANDATORY — depict in prose): ${context.resolvedGameOutcome.costLine}\n` : '') +
          (mixedDirective ? `${mixedDirective}\n` : '') +
          (failureBlock ? `${failureBlock}\n` : '') +
          `• DIRECTIVE: Immediately open with the protagonist performing this exact action and depict the direct, personal reaction of the target NPC or environment! Respond to the exact target addressed, not an off-scene commander. If speaking or asking a question, use direct dialogue.`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[RECENT SCENE PROSE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      if (context.recentCompletedActions && context.recentCompletedActions.length > 0) {
        parts.push(
          `[RECENTLY COMPLETED ACTIONS — FORWARD MOMENTUM & NO RECYCLING]\n` +
          `The protagonist has ALREADY performed and resolved these actions in recent turns:\n` +
          context.recentCompletedActions.map((a) => `• ${a}`).join('\n') +
          `\n• STRICT ANTI-REPETITION DIRECTIVE: These actions are DONE. The scene has advanced beyond them. You are STRICTLY FORBIDDEN from offering choices that re-attempt, re-phrase, or cycle through these completed actions. The protagonist must move FORWARD into the new space or deal with the new dilemma created by their success.`
        );
      }

      // Narrative goal / upcoming milestone encounter directive & Arc Stages
      if (context.activeChapterGoal || context.activeChapterTitle || context.activeChapterStages?.length) {
        const stageLines = context.activeChapterStages?.length
          ? `\nNarrative Arc Stages:\n` +
            context.activeChapterStages
              .map((st) => `  ${st.order}. [${st.title}]: ${st.description}`)
              .join('\n')
          : '';
        parts.push(
          `[UPCOMING MILESTONE & NARRATIVE DIRECTION]\n` +
          (context.activeChapterTitle ? `Chapter: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `Chapter Narrative Goal: "${context.activeChapterGoal}"\n` : '') +
          stageLines +
          `\n• DIRECTIVE: Act as the connective tissue! Subtly steer the environment, physical clues, and choice opportunities across turns toward these authored arc stages. Ensure current obstacles, clues, and choices in the prose align with the active arc stage rather than spinning in generic loops.`
        );
      }
      if (context.episodicRollup?.length) {
        parts.push(`[EPISODIC MILESTONE ROLLUP — completed chapters]\n${context.episodicRollup.map((x) => `• ${x}`).join('\n')}`);
      }
      if (context.livingWorldLedger?.length) {
        parts.push(
          `[LIVING WORLD LEDGER — immutable play history]\n${context.livingWorldLedger.map((x) => `• ${x}`).join('\n')}\n(Never resurrect dead or transformed NPCs; honor faction standings.)`
        );
      }

      // Plan 13: threat clocks, displacement, contextual choice material.
      if (context.activeClocks?.length) {
        parts.push(
          `[ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nReflect rising tension in the prose; declare every movement in "clockChanges" (see the TENSION CLOCK CONTRACT). When a clock hits its maximum, unleash its crisis event NOW in the prose, then stand the clock down.`
        );
      }
      if (context.displacementDirective) {
        parts.push(context.displacementDirective);
      }
      if (choiceMaterial) {
        parts.push(`[CONTEXTUAL CHOICE MATERIAL — weave into proposed choices]\n${choiceMaterial}`);
      }

      parts.push(`[FINAL INSTRUCTION]\nWrite the next scene prose in English reflecting the pre-resolved check outcome and return 2 to 4 contextual choices strictly grounded in the scene prose in pure JSON.`);
    } else {
      // Persian Context
      if (context.worldLaws.length > 0) {
        parts.push(`[قوانین و محدودیت‌های جهان / ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
      }

      parts.push(...worldBlock);

      if (faProtagonistBlock) {
        parts.push(faProtagonistBlock);
      }

      parts.push(
        `[موقعیت مکانی فعلی / CURRENT LOCATION: ${context.currentLocationName}]\nتوضیحات: ${context.currentLocationDescription}`
      );

      // Plan 17 (§4.5): the road is real — journey leg / arrival discipline.
      const faJourneyBlock = PromptAssembler.journeyBlock(context, false);
      if (faJourneyBlock) {
        parts.push(faJourneyBlock);
      }

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => {
            const caravanTag = npc.caravanAffiliation
              ? ` [همراه کاروان تجاری: ${npc.caravanAffiliation}]`
              : '';
            const statusTag = npc.presenceStatus === 'nearby_resident'
              ? ' [مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست]'
              : (npc.presenceStatus === 'present' ? ' [حاضر در صحنه]' : '');
            const appearanceTag = npc.appearance ? ` - سیما، اندام و پوشش: ${npc.appearance}` : '';
            return `• ${npc.name}${caravanTag}${statusTag} (میزان اعتماد: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - لحن صحبت: ${npc.speechStyle}${appearanceTag}${npc.vitalsLine ? ` - علائم حیاتی: ${npc.vitalsLine}` : ''}${npc.powerAffiliationLine ? ` - قدرت: [${npc.powerAffiliationLine}]` : ''}`;
          })
          .join('\n');
        parts.push(
          `[شخصیت‌های حاضر / PRESENT NPCS]\n${npcs}\n` +
          `• دستور شاهکار ادبی برای توصیف سیمای شخصیت‌ها (LITERARY CHARACTER PORTRAIT DIRECTIVE): هنگام معرفی هر شخصیت برای نخستین بار، یا زمانی که شخصیتی لب به سخن می‌گشاید یا واکنشی نشان می‌دهد، هرگز او را مانند یک «نام انتزاعی» یا صرفاً متکلم دیالوگ توصیف نکن! شخصیت‌ها باید مانند رمان‌های ادبی کلاسیک و فانتزی عینی و جاندار باشند: حتماً اندام و قامت (بلندی یا کوتاهی، ستبر یا لاغر بودن، خمیدگی یا استواری شانه، طرز راه رفتن)، سیمای چهره و نگاه (رنگ و شیار پوست در اثر آفتاب و باد، زبری ریش و مو، خطوط اخم یا خنده، تیزی و رنگ چشم‌ها)، پوشش و جامه (جنس پارچه اعم از پشم زبر، کرباس، چرم کهنه، رنگ جامه، لکه‌های خاک و کار، شال کمر، پاپوش و سلاح آویخته)، و دست‌ها یا حرکات بدنی (پینه‌های انگشتان، تکیه بر عصا، مالیدن تسمه) را با نثری حسی و ملموس در دل روایت بتن!\n` +
          `• دستور حضور شخصیت‌ها و پیوستگی مکانی: شخصیت‌هایی که برچسب «مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست» دارند، در این مکان کلی حضور یا اقامت دارند اما هنوز در این صحنهٔ مشخص رو در روی بازیکن نیستند. هرگز آنها را بدون مقدمه، بدون صدا زدن یا بدون تغییر تدریجی صحنه ناگهان رو در روی قهرمان قرار نده! اگر قهرمان به حاشیهٔ رودخانه یا میان نی‌ها رفته، صحنه در خلوت و انزوای کامل است؛ افراد مستقر کنار آتش یا بارانداز از حوادث بی‌صدا یا درگیری‌های محدود در دل نی‌زار کاملاً بی‌خبرند و در جای خود باقی می‌مانند.\n` +
          `• دستور حضور کاروان‌ها و شخصیت‌های مسافر: شخصیت‌هایی که برچسب [همراه کاروان تجاری: ...] دارند، همراه با کاروان‌های تجاری که به این مکان می‌رسند در این محل حضور دارند. حتی اگر شهر یا اقامتگاه دائمی آنها در شناسنامه جهان در شهر دیگری ثبت شده باشد، به واسطهٔ حضور کاروان، آنها هم‌اکنون به صورت ملموس در کاروانسرا، بارانداز، کنار شترها و ارابه‌ها یا دروازهٔ بازار این مکان حضور دارند و شخصیت‌هایی واقعی برای گفت‌وگو، دادوستد، گرفتن مأموریت محافظت از کاروان یا پرس‌وجو هستند.\n` +
          `• دستور مؤکد معرفی تدریجی در روایت در برابر گزینه‌ها: شخصیت‌هایی که برچسب «مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست» دارند، هنوز با قهرمان داستان رو در رو نشده‌اند. در صورتی که اقدام بازیکن به سمت قلمرو آنها باشد (مثلاً رفتن به سمت کجاوه‌ها یا جست‌وجوی راه‌بلد)، می‌توانی آنها را به شکلی طبیعی و با دیالوگ در نثر صحنه معرفی کنی. اما اکیداً نباید نام آنها را تا پیش از معرفی در متن، در گزینه‌های انتخابی (choices) بیاوری!`
        );
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (اهمیت: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[حافظه و رویدادهای گذشته / RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        const mixedDirectiveFa = PromptAssembler.outcomeDirective(context.resolvedGameOutcome.outcome, false);
        const failureBlockFa = PromptAssembler.failureForwardBlock(context.resolvedGameOutcome, false);
        parts.push(
          `[نتیجه محاسباتی موتور بازی / PRE-RESOLVED OUTCOME]\n` +
          `• عمل انجام شده توسط بازیکن: "${context.resolvedGameOutcome.actionText}"\n` +
          `• نتیجه تاس و بررسی: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• پیامد: ${context.resolvedGameOutcome.consequence}\n` +
          (context.resolvedGameOutcome.costLine ? `• هزینه (اجباری — حتماً در متن نشان بده): ${context.resolvedGameOutcome.costLine}\n` : '') +
          (mixedDirectiveFa ? `${mixedDirectiveFa}\n` : '') +
          (failureBlockFa ? `${failureBlockFa}\n` : '') +
          `• دستور مؤکد روایی: روایت را بلافاصله با انجام همین اقدام توسط قهرمان داستان آغاز کن و واکنش مستقیم، شخصی و عینیِ شخصیت یا مانع مورد اقدام (نه یک فرمانده غایب) را با دیالوگ مستقیم («...») نشان بده! از ابداع موانع فیزیکیِ ذکرنشده (مثل بارهای انباشته) بپرهیز و هرگز صحنه را با توصیفات منفعل پس‌زمینه که این اقدام در آن گم شود پر نکن.`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[خلاصه صحنه قبلی / RECENT SCENE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      if (context.recentCompletedActions && context.recentCompletedActions.length > 0) {
        parts.push(
          `[اقدامات اخیراً انجام‌شده و حل‌شده — لزوم پیشروی داستان و ممنوعیت تکرار / COMPLETED ACTIONS]\n` +
          `قهرمان داستان این اقدامات را در نوبت‌های اخیر به انجام رسانده و پشت سر گذاشته است:\n` +
          context.recentCompletedActions.map((a) => `• ${a}`).join('\n') +
          `\n• دستور اکید جلوگیری از درجا زدن و تکرار: این اقدامات پایان یافته‌اند و مانع مربوطه پشت سر گذاشته شده است. پیشنهاد دادن انتخاب‌هایی که همان کارهای قبلی را با بیانی دیگر تکرار کنند (مانند عبور مجدد از معبری که قبلاً از آن گذشته، یا تکرار همان اقدام موفق) اکیداً ممنوع است! داستان و شخصیت باید وارد فاز بعدی، معبر بعدی یا فضای جدید پس از این اقدام شوند و گزینه‌های جدیدی متناسب با موقعیت پیش‌رو به بازیکن ارائه دهی.`
        );
      }

      // Narrative goal / upcoming milestone encounter directive & Arc Stages
      if (context.activeChapterGoal || context.activeChapterTitle || context.activeChapterStages?.length) {
        const stageLines = context.activeChapterStages?.length
          ? `\nمراحل قوس روایی فصل / Arc Stages:\n` +
            context.activeChapterStages
              .map((st) => `  ${st.order}. [${st.title}]: ${st.description}`)
              .join('\n')
          : '';
        parts.push(
          `[جهت‌گیری روایی و مراحل قوس داستانی / UPCOMING MILESTONE & ARC STAGES]\n` +
          (context.activeChapterTitle ? `فصل: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `هدف کلی روایی فصل: «${context.activeChapterGoal}»\n` : '') +
          stageLines +
          `\n• دستور مؤکد راوی: وقایع، سرنخ‌های محیطی، بن‌بست‌ها و گزینه‌ها باید دقیقاً در راستای مراحل همین قوس روایی پیش بروند! اگر بازیکن در ساحل گل‌آلود و نیزار است، این پیشروی باید سرنخی ملموس از معبر پنهان نفوذ به پایاب زیرین پل، پایه‌های سنگی، یا بلم‌رانان هور آشکار کند نه اینکه در حلقه‌ای بی‌هدف از خطرات نامربوط بچرخد.`
        );
      }
      if (context.episodicRollup?.length) {
        parts.push(`[خلاصه فصل‌های گذشته / EPISODIC ROLLUP]\n${context.episodicRollup.map((x) => `• ${x}`).join('\n')}`);
      }
      if (context.livingWorldLedger?.length) {
        parts.push(
          `[دفتر جهان زنده / LIVING WORLD LEDGER]\n${context.livingWorldLedger.map((x) => `• ${x}`).join('\n')}\n(هرگز شخصیات مرده یا دگرگون‌شده را زنده نکن؛ به جایگاه جناح‌ها پایبند بمان.)`
        );
      }

      // Plan 13: threat clocks, displacement, contextual choice material.
      if (context.activeClocks?.length) {
        parts.push(
          `[ساعت‌های تهدید فعال / ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nتنش فزاینده را در نثر منعکس کن؛ هر جابه‌جایی را در «clockChanges» اعلام کن (قرارداد ساعت تنش را ببین). وقتی ساعتی به سقف رسید، بحرانش را همین حالا در نثر آزاد کن و سپس آن را بخوابان.`
        );
      }
      if (context.displacementDirective) {
        parts.push(context.displacementDirective);
      }
      if (choiceMaterial) {
        parts.push(`[مصالح انتخاب زمینه‌ای / CONTEXTUAL CHOICE MATERIAL]\n${choiceMaterial}`);
      }

      parts.push(`[دستور نهایی]\nصحنه بعدی داستان را با نثر ادبی و تاثیر نتیجه تاس بنویس و ۲ تا ۴ انتخاب کاملاً منطبق بر متن صحنه (بدون ابداع موارد ذکرنشده) در قالب JSON برگردان.`);
    }

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
      isEnglish,
      playerStatIds: context.playerStatus?.stats || {},
      isLowBase,
      statIdAliases: PromptAssembler.buildStatIdAliases(statsDefs),
    };
  }

  /**
   * Generates opening choices tailored specifically to an already-authored opening
   * beat narrative text. Unlike buildNarrativePrompt, this does NOT instruct the
   * model to author a new narrative beat or advance the timeline, avoiding
   * phantom beast attacks, ungrounded combat paranoia, or narrative desynchronization.
   */
  public static buildOpeningChoicesPrompt(
    context: WorkingContextEnvelope,
    openingProse: string
  ): GenerationPromptPayload {
    const isExplicitlyPersian =
      context.languageDirective === 'fa' ||
      /[\u0600-\u06FF]/.test(context.storyTitle || '') ||
      /[\u0600-\u06FF]/.test(context.worldSummary || '') ||
      /[\u0600-\u06FF]/.test(openingProse);
    const isEnglish = !isExplicitlyPersian && context.languageDirective === 'en';

    const statsDefs = context.statsConfig || [];
    const validStatIds = Object.keys(context.playerStatus?.stats || {});
    const statDescriptors = statsDefs.length > 0
      ? statsDefs.map((s) => `${s.id}${s.name ? ` (${s.name})` : ''}`).join(', ')
      : validStatIds.join(', ');

    const isLowBase = context.universalBaseValue !== undefined
      ? context.universalBaseValue < 8
      : statsDefs.length > 0
      ? statsDefs.every((s) => (s.baseValue ?? 10) < 8)
      : false;

    const systemPrompt = isEnglish
      ? `You are the Lead Choice Architect for StoryForge, a literary dark fantasy interactive RPG.
Your sole responsibility is to generate 3 to 4 varied, engaging, atmospheric opening choices for the player at the very start of the story.
The opening scene prose has ALREADY been written and shown to the player.
DO NOT generate any narrative prose. DO NOT invent new scenes or advance time.
Return ONLY a valid JSON object matching this schema:
{
  "choices": [
    {
      "id": "choice_1",
      "text": "Literary description of the action in English",
      "style": "tactical", // "tactical" | "cautious" | "inquisitive" | "diplomatic" | "bold"
      "riskLevel": "low", // "low" | "medium" | "high"
      "requiredStatId": "cunning", // optional, omit for diceless choices
      "targetDC": 10 // optional, omit for diceless choices
    }
  ]
}`
      : `تو معمار ارشد انتخاب‌ها برای بازی تعاملی StoryForge هستی.
وظیفهٔ تو صرفاً تولید ۳ تا ۴ انتخاب غنی، ادبی، متناسب با اتمسفر صحنه و هوشمندانه برای شروع بازی توسط بازیکن است.
متن صحنهٔ آغازین قبلاً نگارش شده و در برابر دیدگان بازیکن قرار گرفته است.
هرگز متن روایی جدید ننویس! صحنه را پیش نبر و چیزی را به عنوان اتفاق افتاده فرض نکن.
صرفاً یک آبجکت معتبر JSON با ساختار زیر برگردان:
{
  "choices": [
    {
      "id": "choice_1",
      "text": "شرح کنش داستانی و ادبی به زبان فارسی",
      "style": "tactical", // "tactical" | "cautious" | "inquisitive" | "diplomatic" | "bold"
      "riskLevel": "low", // "low" | "medium" | "high"
      "requiredStatId": "might", // اختیاری، برای اقدامات بدون تاس حذف شود
      "targetDC": 10 // اختیاری، برای اقدامات بدون تاس حذف شود
    }
  ]
}`;

    const parts: string[] = [];

    if (isEnglish) {
      parts.push(`[STORY TITLE]\n${context.storyTitle || 'Story'}`);
      if (context.worldSummary) parts.push(`[WORLD SUMMARY]\n${context.worldSummary}`);
      if (context.themeNotes) parts.push(`[THEMATIC TONE]\n${context.themeNotes}`);
      parts.push(`[PROTAGONIST STATUS]\nName: ${context.playerStatus?.characterName || 'Protagonist'}\nArchetype: ${context.playerStatus?.archetypeName || 'Traveler'}\nAttributes: ${JSON.stringify(context.playerStatus?.stats || {})}`);

      // Filter active NPCs to those mentioned in openingProse
      const presentNpcs = (context.activeNpcDossiers || []).filter(
        (n) => openingProse.includes(n.name) || (n.caravanAffiliation && openingProse.includes(n.caravanAffiliation))
      );
      if (presentNpcs.length > 0) {
        parts.push(`[NPCS PRESENT IN THIS OPENING SCENE]\n${presentNpcs.map((n) => `• ${n.name} (Trust: ${n.trust})`).join('\n')}`);
      }

      parts.push(
        `[OPENING SCENE PROSE — ALREADY PRESENTED TO THE READER]\n${openingProse}\n\n` +
        `[INSTRUCTIONS FOR OPENING CHOICES]\n` +
        `1. STRICT SCENE GROUNDING: Every choice must directly stem from the characters, environment, and situation described in the opening prose above.\n` +
        `2. NO PHANTOM THREATS OR COMBAT PARANOIA: If this is an introductory, traveling, walking, or peaceful scene, DO NOT invent sudden monster attacks, ambushes, or force ridiculous combat stances (like raising a shield or drawing weapons on thin air). Ground choices in the authentic atmosphere.\n` +
        `3. VARIED OPENING INTENTS: Offer 3 to 4 distinct options reflecting different player impulses:\n` +
        `   - Conversing with one of the present companions or figures.\n` +
        `   - Observing tracks, landmarks, weather, or scouting the route ahead.\n` +
        `   - Tending to journey responsibilities (supplies, pack beasts, pace, equipment).\n` +
        `   - Taking an attentive or curious initiative.\n` +
        `4. DICELESS VS CHECKS: Provide at least 1-2 diceless conversational or observational options, and 1-2 options with low/moderate checks using valid stats: [${validStatIds.join(', ')}]. DCs should be modest (8-11) for opening moments.\n` +
        `5. LITERARY PROSE: Clean narrative prose with NO dice tags, roll labels, or parenthetical annotations in the choice text.`
      );
    } else {
      parts.push(`[عنوان داستان]\n${context.storyTitle || 'داستان'}`);
      if (context.worldSummary) parts.push(`[خلاصه جهان]\n${context.worldSummary}`);
      if (context.themeNotes) parts.push(`[فضای تماتیک]\n${context.themeNotes}`);
      parts.push(`[وضعیت قهرمان]\nنام: ${context.playerStatus?.characterName || 'قهرمان'}\nشغل/کهن‌الگو: ${context.playerStatus?.archetypeName || 'مسافر'}\nویژگی‌ها: ${JSON.stringify(context.playerStatus?.stats || {})}`);

      const presentNpcs = (context.activeNpcDossiers || []).filter(
        (n) => openingProse.includes(n.name) || (n.caravanAffiliation && openingProse.includes(n.caravanAffiliation))
      );
      if (presentNpcs.length > 0) {
        parts.push(`[شخصیت‌های حاضر در این صحنهٔ آغازین]\n${presentNpcs.map((n) => `• ${n.name} (میزان اعتماد: ${n.trust})`).join('\n')}`);
      }

      parts.push(
        `[متن نثر صحنهٔ آغازین — قبلاً به خواننده نمایش داده شده است]\n${openingProse}\n\n` +
        `[دستورالعمل طراحی انتخاب‌های آغازین]\n` +
        `۱. انطباق کامل با صحنه: تک‌تک انتخاب‌ها باید دقیقاً از دلِ اشخاص، عناصر، فضا و رویدادهای توصیف‌شده در متن بالا برآیند.\n` +
        `۲. منع اکید توهم حمله و پارانویای رزمی: اگر این صحنه یک صحنهٔ معرفی، سفر، پیاده‌روی یا آرامش است، هرگز حملهٔ ناگهانی موجودات یا هیولاها را ابداع نکن و ژست‌های جنگی بی‌مورد (مانند سپر رو به جلو گرفتن یا کشیدن سلاح در پیاده‌روی عادی) تحمیل نکن! گزینه‌ها باید کاملاً طبیعی و متناسب با اتمسفر صحنه باشند.\n` +
        `۳. تنوع رویکردها (۳ تا ۴ گزینهٔ متمایز):\n` +
        `   - گفت‌وگو یا مشورت با یکی از یاران یا شخصیت‌های حاضر در صحنه.\n` +
        `   - وارسی عوارض زمین، ردپای جانوران، مسیر پیش‌رو یا رصد افق.\n` +
        `   - رسیدگی به امور کاروان، چهارپایان، آب و آذوقه، یا تنظیم گام‌های حرکت.\n` +
        `   - کنش کنجکاوانه، هوشیارانه یا تأمل در موقعیت.\n` +
        `۴. تعادل تاس: حداقل ۱ تا ۲ گزینه می‌تواند بدون تاس (DICELESS) برای گفت‌وگوی عادی یا وارسی ساده باشد، و ۱ تا ۲ گزینه دارای بررسی ویژگی با صفات معتبر ([${validStatIds.join('، ')}] با نام‌های: ${statDescriptors}) با درجه سختی پایین و آغازین (۹ تا ۱۱).\n` +
        `۵. نثر ادبی ناب: از درج هرگونه پرانتز، برچسب بررسی مهارت یا شماره در متن گزینه‌ها خودداری کن. خروجی صرفاً در قالب JSON معتبر باشد.`
      );
    }

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
      isEnglish,
      playerStatIds: context.playerStatus?.stats || {},
      isLowBase,
      statIdAliases: PromptAssembler.buildStatIdAliases(statsDefs),
    };
  }

  /**
   * Generates ONLY choices tailored to an already established, validated narrative scene.
   * Used when prose validation passed, but choices were invalid, dropped by sanitizers,
   * or flagged by AOT audits. Avoids discarding or rewriting high-quality 700-word prose.
   */
  public static buildChoicesOnlyPrompt(
    context: WorkingContextEnvelope,
    establishedProse: string,
    defectReasons?: string[]
  ): GenerationPromptPayload {
    const isExplicitlyPersian =
      context.languageDirective === 'fa' ||
      /[\u0600-\u06FF]/.test(context.storyTitle || '') ||
      /[\u0600-\u06FF]/.test(context.worldSummary || '') ||
      /[\u0600-\u06FF]/.test(establishedProse);
    const isEnglish = !isExplicitlyPersian && context.languageDirective === 'en';

    const statsDefs = context.statsConfig || [];
    const validStatIds = Object.keys(context.playerStatus?.stats || {});
    const statDescriptors = statsDefs.length > 0
      ? statsDefs.map((s) => `${s.id}${s.name ? ` (${s.name})` : ''}`).join(', ')
      : validStatIds.join(', ');

    const isLowBase = context.universalBaseValue !== undefined
      ? context.universalBaseValue < 8
      : statsDefs.length > 0
      ? statsDefs.every((s) => (s.baseValue ?? 10) < 8)
      : false;

    const systemPrompt = isEnglish
      ? `You are the Lead Choice Architect for StoryForge, a literary dark fantasy interactive RPG.
Your sole responsibility is to generate 3 to 4 varied, engaging, atmospheric contextual choices for the player.
The scene prose has ALREADY been established and validated.
DO NOT generate any narrative prose. DO NOT invent new scenes or advance time.
Return ONLY a valid JSON object matching this schema:
{
  "choices": [
    {
      "id": "choice_1",
      "text": "Literary description of the action in English",
      "style": "tactical", // "tactical" | "cautious" | "inquisitive" | "diplomatic" | "bold"
      "riskLevel": "low", // "low" | "medium" | "high"
      "requiredStatId": "cunning", // optional, omit for diceless choices
      "targetDC": 10 // optional, omit for diceless choices
    }
  ]
}`
      : `تو معمار ارشد انتخاب‌ها برای بازی تعاملی StoryForge هستی.
وظیفهٔ تو صرفاً تولید ۳ تا ۴ انتخاب غنی، ادبی، متناسب با اتمسفر صحنه و هوشمندانه برای صحنهٔ روایی تثبیت‌شدهٔ زیر است.
متن نثر صحنه قبلاً نگارش و تأیید شده است. هرگز متن روایی جدید ننویس! صحنه را پیش نبر و چیزی را به عنوان اتفاق افتاده فرض نکن.
صرفاً یک آبجکت معتبر JSON با ساختار زیر برگردان:
{
  "choices": [
    {
      "id": "choice_1",
      "text": "شرح کنش داستانی و ادبی به زبان فارسی",
      "style": "tactical", // "tactical" | "cautious" | "inquisitive" | "diplomatic" | "bold"
      "riskLevel": "low", // "low" | "medium" | "high"
      "requiredStatId": "might", // اختیاری، برای اقدامات بدون تاس حذف شود
      "targetDC": 10 // اختیاری، برای اقدامات بدون تاس حذف شود
    }
  ]
}`;

    const parts: string[] = [];

    if (isEnglish) {
      parts.push(`[STORY TITLE]\n${context.storyTitle || 'Story'}`);
      if (context.worldSummary) parts.push(`[WORLD SUMMARY]\n${context.worldSummary}`);
      if (context.themeNotes) parts.push(`[THEMATIC TONE]\n${context.themeNotes}`);
      parts.push(
        `[PROTAGONIST STATUS]\nName: ${context.playerStatus?.characterName || 'Protagonist'}\nArchetype: ${context.playerStatus?.archetypeName || 'Traveler'}\nAttributes: ${JSON.stringify(context.playerStatus?.stats || {})}`
      );

      const presentNpcs = (context.activeNpcDossiers || []).filter(
        (n) => establishedProse.includes(n.name) || (n.caravanAffiliation && establishedProse.includes(n.caravanAffiliation))
      );
      if (presentNpcs.length > 0) {
        parts.push(
          `[NPCS PRESENT IN THIS SCENE]\n${presentNpcs.map((n) => `• ${n.name} (Trust: ${n.trust})`).join('\n')}`
        );
      }

      if (context.recentCompletedActions?.length) {
        parts.push(
          `[COMPLETED ACTIONS — DO NOT RECYCLE]\n${context.recentCompletedActions.map((a) => `• ${a}`).join('\n')}`
        );
      }

      parts.push(
        `[ESTABLISHED SCENE PROSE — ALREADY FIXED & DISPLAYED]\n${establishedProse}`
      );

      if (defectReasons?.length) {
        parts.push(
          `[DEFECTS OF REJECTED PREVIOUS CHOICES — DO NOT REPEAT THESE MISTAKES]\n${defectReasons.map((r) => `• ${r}`).join('\n')}`
        );
      }

      parts.push(
        `[INSTRUCTIONS FOR NEW CHOICES]\n` +
        `1. STRICT SCENE GROUNDING: Every choice must directly stem from the characters, environment, tension, and dilemma established in the scene prose above.\n` +
        `2. ONLY PRESENT NPCS: Only name characters who are explicitly introduced and physically present in the established prose.\n` +
        `3. NO SECRET LEAKS: Do NOT offer choices that presume or reveal undiscovered secrets or off-screen lore.\n` +
        `4. VARIED INTENTS: Offer 3 to 4 distinct options (tactical, cautious, conversational/diplomatic, bold).\n` +
        `5. STAT CALIBRATION: Provide 1-2 diceless options and 1-2 options testing valid stats: [${validStatIds.join(', ')}]. DCs should be reasonable (10-14).\n` +
        `6. LITERARY PROSE: Clean narrative prose with NO dice tags, roll labels, or parenthetical annotations in the choice text.`
      );
    } else {
      parts.push(`[عنوان داستان]\n${context.storyTitle || 'داستان'}`);
      if (context.worldSummary) parts.push(`[خلاصه جهان]\n${context.worldSummary}`);
      if (context.themeNotes) parts.push(`[فضای تماتیک]\n${context.themeNotes}`);
      parts.push(
        `[وضعیت قهرمان]\nنام: ${context.playerStatus?.characterName || 'قهرمان'}\nشغل/کهن‌الگو: ${context.playerStatus?.archetypeName || 'مسافر'}\nویژگی‌ها: ${JSON.stringify(context.playerStatus?.stats || {})}`
      );

      const presentNpcs = (context.activeNpcDossiers || []).filter(
        (n) => establishedProse.includes(n.name) || (n.caravanAffiliation && establishedProse.includes(n.caravanAffiliation))
      );
      if (presentNpcs.length > 0) {
        parts.push(
          `[شخصیت‌های حاضر در این صحنه]\n${presentNpcs.map((n) => `• ${n.name} (میزان اعتماد: ${n.trust})`).join('\n')}`
        );
      }

      if (context.recentCompletedActions?.length) {
        parts.push(
          `[اقدامات انجام‌شدهٔ اخیر — بازیافت و تکرار نکنید]\n${context.recentCompletedActions.map((a) => `• ${a}`).join('\n')}`
        );
      }

      parts.push(
        `[متن نثر صحنه — قبلاً تثبیت شده و به خواننده نمایش داده می‌شود]\n${establishedProse}`
      );

      if (defectReasons?.length) {
        parts.push(
          `[ایرادات انتخاب‌های ردشدهٔ قبلی — از تکرار این خطاها بپرهیزید]\n${defectReasons.map((r) => `• ${r}`).join('\n')}`
        );
      }

      parts.push(
        `[دستورالعمل تولید گزینه‌های جدید]\n` +
        `۱. انطباق کامل با صحنه: گزینه‌ها باید منحصراً از وضعیت، اشخاص، تنش و عناصر توصیف‌شده در متن فوق مشتق شوند.\n` +
        `۲. تنها اشخاص حاضر: فقط نام اشخاصی را در گزینه‌ها بیاورید که در متن صحنهٔ بالا صریحاً حضور دارند.\n` +
        `۳. منع افشای اسرار: از ارائهٔ گزینه‌هایی که بر اساس اسرار کشف‌نشده یا دانش خارج از صحنه است خودداری کنید.\n` +
        `۴. تنوع رویکردها: ۳ تا ۴ گزینه با سبک‌های متمایز (هوشمندانه، محتاطانه، گفت‌وگو/دیپلماتیک، جسورانه).\n` +
        `۵. تعادل تاس: حداقل ۱ گزینه بدون تاس (DICELESS) و گزینه‌های دارای بررسی مهارت بر اساس صفات معتبر ([${validStatIds.join('، ')}] با نام‌های: ${statDescriptors}). درجه سختی معقول (۱۰ تا ۱۴).\n` +
        `۶. نثر ادبی ناب: از درج هرگونه پرانتز، برچسب بررسی مهارت یا شماره در متن گزینه‌ها خودداری کن. خروجی صرفاً JSON معتبر باشد.`
      );
    }

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
      isEnglish,
      playerStatIds: context.playerStatus?.stats || {},
      isLowBase,
      statIdAliases: PromptAssembler.buildStatIdAliases(statsDefs),
    };
  }
}
