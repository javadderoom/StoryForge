import { WorkingContextEnvelope } from '@/lib/types/memory';

/**
 * Renders the expanded World Bible context (summary, theme, factions, timeline,
 * artifacts, bestiary, religions, NPC relationships, ontology) into labeled
 * blocks. Each section is only emitted when present, keeping the prompt bounded.
 */
export function worldContextBlock(context: WorkingContextEnvelope, isEnglish: boolean): string[] {
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
        quests: 'ACTIVE QUESTS & OBJECTIVES',
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
        quests: 'مأموریت‌های فعال و اهداف / ACTIVE QUESTS',
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
  if (context.quests?.length) out.push(`[${labels.quests}]\n${context.quests.map((x) => `• ${x}`).join('\n')}`);
  if (context.tradeRoutes?.length) {
    const tradeDirective = isEnglish
      ? ' — Commercial arteries and caravan trails connecting settlements, transporting goods, and guarded by caravan masters and retinues'
      : ' — شریان‌های تجاری و مسیرهای کاروان که سکونتگاه‌ها را به هم پیوند می‌دهند، کالاها را حمل می‌کنند و توسط کاروان‌سالاران و محافظان همراهی می‌شوند';
    out.push(`[${labels.tradeRoutes}${tradeDirective}]\n${context.tradeRoutes.map((x) => `• ${x}`).join('\n')}`);
  }
  if (context.ontologySummary) out.push(`[${labels.ontology}]\n${context.ontologySummary}`);
  return out;
}

/**
 * Builds a canonical stat-id -> authored display names map so choice
 * normalization can tolerate the model emitting a stat's Persian/English
 * name or a synonym instead of the exact schema id.
 */
export function buildStatIdAliases(
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
export function outcomeDirective(outcome: string | undefined, isEnglish: boolean): string {
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
export function failureForwardBlock(
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
 * Plan 17 (§4.5) + Transit Halts: journey leg / arrival blocks — logical time
 * passage and pass-through halts WITHOUT raw numerical distance (km/miles).
 */
export function journeyBlock(
  context: WorkingContextEnvelope,
  isEnglish: boolean
): string | undefined {
  const { travel, travelArrival } = context;
  if (!travel && !travelArrival) return undefined;
  const parts: string[] = [];

  if (isEnglish) {
    if (travel) {
      const transitNote = travel.transitHaltNames?.length
        ? ` Along the road, the party passes briefly through the waystations/villages of "${travel.transitHaltNames.join('", "')}" (halting for water and rest without incident — weave their names in passing, never pause the story there).`
        : '';
      if (travel.isElliptical) {
        const companions = travel.caravanNpcNames?.length
          ? ` Travelling companions: ${travel.caravanNpcNames.join(', ')}.`
          : '';
        const road = travel.roadNote ? ` Route notes: ${travel.roadNote}.` : '';
        const daysStr = travel.calendarDays
          ? `${travel.calendarDays} day${travel.calendarDays > 1 ? 's' : ''}`
          : 'several days';

        parts.push(
          `[JOURNEY ELLIPSIS — TIME PASSAGE MONTAGE]\n` +
            `• NARRATIVE ELLIPSIS: The journey from "${travel.originName}" to "${travel.destinationName}"${travel.routeName ? ` via the "${travel.routeName}"` : ''} spans ~${daysStr} of travel (${travel.mode}).${companions}${road}${transitNote}\n` +
            `• LOGICAL TIME ONLY (NO NUMERIC DISTANCE): Reflect that ~${daysStr} have passed on the road. NEVER output numeric distances (km, miles, leagues) in prose.\n` +
            `• COMPRESS PASSAGE OF TIME: This stretch of the road has no separate playable stop. Summarize the passage of time, changing sky and terrain, brief halts at any named transit villages/wells, and the rhythm of beasts and boots in 1-2 atmospheric sentences.\n` +
            `• NO TRIVIAL STALLS: Strictly do NOT pause the narrative for routine camping chores, cooking, or sleeping choices.\n` +
            `• ARRIVAL AT OUTSKIRTS / GATES: Conclude the scene as the traveller approaches or enters "${travel.destinationName}" so the player immediately engages with what matters there.`
        );
      } else {
        const companions = travel.caravanNpcNames?.length
          ? ` Travelling companions: ${travel.caravanNpcNames.join(', ')}.`
          : '';
        const road = travel.roadNote ? ` Road conditions: ${travel.roadNote}.` : '';
        const next = travel.nextStopName ? ` Next stop: "${travel.nextStopName}".` : '';
        const daysStr = travel.calendarDays
          ? ` (~${travel.calendarDays} day${travel.calendarDays > 1 ? 's' : ''} total road time)`
          : '';
        parts.push(
          `[JOURNEY EN ROUTE — سفر در راه]\n` +
            `• The protagonist is ON THE ROAD: from "${travel.originName}" to "${travel.destinationName}"${travel.routeName ? ` via the "${travel.routeName}"` : ''} (${travel.mode})${daysStr}. Current stop: "${travel.currentStopName}".${next}${companions}${road}${transitNote}\n` +
            `• LOGICAL TIME ONLY (NO NUMERIC DISTANCE): NEVER cite numeric distances (km, miles) in prose — convey travel strictly through elapsed days/watches, sun/stars, and road weariness.\n` +
            (travel.dayOnRoad === 1
              ? `• DEPARTURE: the journey begins this turn — open as the caravan/party sets out from "${travel.originName}" and cut straight to the active road event or key conversation.\n`
              : '') +
            (travel.arriving
              ? `• FINAL LEG: the destination appears on the horizon this turn; you may bring the traveller right up to the gates and end the scene inside them. Any life inside "${travel.destinationName}" opens only after this leg.\n`
              : `• ARRIVAL DISCIPLINE: the protagonist must NOT be placed inside "${travel.destinationName}" — no inns, markets, courts, or residents — until the final leg. Keep every scene on the corridor between the current stop and the road ahead.\n`) +
            `• EVENT-DRIVEN CAMERA: Skip empty walking! Focus the scene strictly on the active road incident, environmental hazard, or meaningful dialogue on this stretch.\n` +
            `• DESTINATION CONTACTS: no residents, rulers, or guilds of "${travel.destinationName}" appear before arrival — only route-legitimate contacts (caravan masters, mounted patrols, fellow travellers already on this road).\n` +
            `• CHOICE MATERIAL for the road: respond to the active hazard or road encounter, scout ahead, talk with travelling companions, tend wounds and gear.\n` +
            `• PACE: NEVER invent an early arrival.`
        );
      }
    }
    if (travelArrival) {
      const durationNote = travelArrival.calendarDays
        ? ` after ${travelArrival.calendarDays} day${travelArrival.calendarDays > 1 ? 's' : ''} on the road`
        : '';
      const transitNote = travelArrival.transitHaltNames?.length
        ? ` Having passed through "${travelArrival.transitHaltNames.join('", "')}" along the way, mention them only as brief road memory if natural.`
        : '';
      parts.push(
        `[JOURNEY ARRIVED — پایان راه]\n` +
          `• The journey ended this turn${durationNote} (NEVER mention km/miles): the protagonist has entered "${travelArrival.destinationName}".${transitNote} Open the scene with the destination washing over the senses and treat it as the new grounded setting — focus immediately on the active encounter or dramatic situation at arrival.`
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
    const transitClause = travel.transitHaltNames?.length
      ? ` کاروان در طول مسیر از منزلگاه‌ها و آبادی‌های گذریِ «${travel.transitHaltNames.join('»، «')}» نیز عبور می‌کند و توقف‌های معمولِ آب و استراحت دارد — نامشان را صرفاً گذرا در دلِ گذرِ زمان بیاور و هرگز داستان را برای کارهای روزمره در آن‌ها متوقف نکن.`
      : '';

    if (travel.isElliptical) {
      const companions = travel.caravanNpcNames?.length
        ? ` همسفران راه: ${travel.caravanNpcNames.join('، ')}.`
        : '';
      const road = travel.roadNote ? ` وضعیت جاده: ${travel.roadNote}.` : '';
      const daysStr = travel.calendarDays ? `${travel.calendarDays} روز` : 'چند روز';

      parts.push(
        `[گذر زمان و خلاصهٔ سفر / JOURNEY ELLIPSIS]\n` +
          `• خلاصه و گذر زمان سفر (Narrative Ellipsis): سفر از «${travel.originName}» به «${travel.destinationName}»${travel.routeName ? ` در مسیر «${travel.routeName}»` : ''} حدود ${daysStr} (${modeFa}) به طول انجامیده است.${companions}${road}${transitClause}\n` +
          `• ممنوعیتِ عددِ مسافت و رعایتِ منطقِ زمان: هرگز هیچ عدد و واحدی برای فاصله (کیلومتر، فرسنگ، متر) در متن نیاور! در عوض، گذرِ منطقیِ زمان (سپری شدنِ حدود ${daysStr}) را دقیق و طبیعی بازتاب بده.\n` +
          `• فشردنِ بخش‌های بی‌حادثه: این پهنه از مسیر بدون حادثهٔ بازدارنده طی شده است؛ راه رفتنِ خالی و کارهای روزمره (پخت‌وپز، چادر زدن) را شرح نده و تنها در ۱ تا ۲ جملهٔ فضاساز گذرِ روزها و عبور از منزلگاه‌های گذری را تصویر کن.\n` +
          `• فرود مستقیم در آستانهٔ مقصد: صحنه را در مدخل یا درونِ «${travel.destinationName}» روی موقعیت، رخداد یا گفت‌وگوی مهمِ پیش‌رو باز کن.`
      );
    } else {
      const companions = travel.caravanNpcNames?.length
        ? ` همسفران راه: ${travel.caravanNpcNames.join('، ')}.`
        : '';
      const road = travel.roadNote ? ` وضعیت جاده: ${travel.roadNote}.` : '';
      const next = travel.nextStopName ? ` ایستگاه بعدی: «${travel.nextStopName}».` : '';
      const daysNote = travel.calendarDays ? ` (مدت کل این مسیر: حدود ${travel.calendarDays} روز)` : '';
      parts.push(
        `[سفر در راه / JOURNEY EN ROUTE]\n` +
          `• قهرمان در راه است: از «${travel.originName}» به «${travel.destinationName}»${travel.routeName ? ` در مسیر «${travel.routeName}»` : ''} (${modeFa})${daysNote}. ایستگاه فعلی: «${travel.currentStopName}».${next}${companions}${road}${transitClause}\n` +
          `• ممنوعیتِ عددِ مسافت: هرگز واژهٔ «کیلومتر» یا اعدادِ مسافت را در داستان ننویس؛ فاصله را فقط با گذرِ روز و شب، تغییر آسمان و خستگیِ مرکب‌ها نشان بده.\n` +
          (travel.dayOnRoad === 1
            ? `• آغاز حرکت و برش به اصل ماجرا: حرکت از «${travel.originName}» آغاز شده است — بدونِ مکث روی کارهای عادیِ راه، مستقیم برش بزن به رخدادِ فعال یا مکالمهٔ مهمی که در میانهٔ راه رخ می‌دهد.\n`
            : '') +
          (travel.arriving
            ? `• پایان راه: مقصد همین نوبت در افق نمایان می‌شود؛ می‌توانی قهرمان را تا دروازه‌ها برسانی و صحنه را داخل دروازه‌ها ببندی. هر صحنه‌ای در دلِ «${travel.destinationName}» فقط پس از همین نوبت آغاز می‌شود.\n`
            : `• انضباط ورود: تا نوبت پایان راه، هرگز قهرمان را داخل «${travel.destinationName}» مگذار — نه کاروانسرا، نه بازار، نه دربار و نه میان مردمانش. هر صحنه باید در کریدور جاده میان ایستگاه فعلی و راه پیش رو بماند.\n`) +
          `• دوربینِ رویدادمحور: پیاده‌رویِ خالی را حذف کن؛ صحنه فقط برای حادثهٔ جاده‌ای، خطرِ محیطی یا گفت‌وگوی کلیدی میان همسفران باز شده است.\n` +
          `• آشنایان مقصد: تا پیش از رسیدن، هیچ‌یک از ساکنان، بزرگان یا صنف‌های «${travel.destinationName}» در صحنه ظاهر نمی‌شوند — تنها آشنایان مجاز راه (سالار کاروان، گشت‌های سواره، همسفرانی که همین حالا بر جاده‌اند).\n` +
          `• آهنگ سفر: هرگز رسیدن زودهنگام از خودت نساز.`
      );
    }
  }
  if (travelArrival) {
    const durationNote = travelArrival.calendarDays
      ? ` پس از حدود ${travelArrival.calendarDays} روز راه`
      : '';
    const transitArrival = travelArrival.transitHaltNames?.length
      ? ` (پس از پشت سر گذاشتنِ گذرای «${travelArrival.transitHaltNames.join('»، «')}»)`
      : '';
    parts.push(
      `[رسیدن به مقصد / JOURNEY ARRIVED]\n` +
        `• سفر همین نوبت${durationNote}${transitArrival} به پایان رسید (هرگز عدد کیلومتر/مسافت ننویس): قهرمان به «${travelArrival.destinationName}» درآمده است. گذرِ روزهای راه را تنها در یک جملهٔ کوتاه بازتاب بده و بلافاصله صحنه را روی رخداد یا رویاروییِ ملموسِ مقصد متمرکز کن.`
    );
  }
  return parts.join('\n');
}

/**
 * Renders an active dynamic World Encounter / Key Road Conversation into the
 * narrator prompt so the scene focuses directly on that dramatic beat.
 */
export function activeEncounterBlock(
  context: WorkingContextEnvelope,
  isEnglish: boolean
): string | undefined {
  const enc = context.activeEncounter;
  if (!enc) return undefined;

  if (isEnglish) {
    const actors = [
      enc.npcName ? `Featured NPC: ${enc.npcName}` : '',
      enc.creatureName ? `Featured Creature/Hazard: ${enc.creatureName}` : '',
    ]
      .filter(Boolean)
      .join(' • ');
    const checkHint = enc.recommendedStat
      ? `\n• Resolution Guidance: Anchor at least one key choice around "${enc.recommendedStat}"${enc.recommendedDC ? ` (approx DC ${enc.recommendedDC})` : ''}.`
      : '';
    return (
      `[ACTIVE SCENE ENCOUNTER / KEY EVENT: ${enc.title}]\n` +
      `• Dramatic Premise: ${enc.narrativeText}\n` +
      (actors ? `• Active Participants: ${actors}\n` : '') +
      `• DIRECTORIAL MANDATE: Weave this encounter organically as the immediate centerpiece of this scene (after resolving the player's action). Build your contextual choices directly around how the protagonist responds to this situation.` +
      checkHint
    );
  }

  const actorsFa = [
    enc.npcName ? `شخصیت کانونی: ${enc.npcName}` : '',
    enc.creatureName ? `جانور/خطر کانونی: ${enc.creatureName}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
  const checkHintFa = enc.recommendedStat
    ? `\n• راهنمای مکانیکی انتخاب‌ها: دست‌کم یکی از انتخاب‌های کلیدیِ واکنش به این موقعیت را حولِ ویژگیِ «${enc.recommendedStat}»${enc.recommendedDC ? ` (با سختیِ حدود ${enc.recommendedDC})` : ''} طراحی کن.`
    : '';
  return (
    `[رخداد یا مکالمهٔ ویژهٔ صحنه / ACTIVE SCENE ENCOUNTER: ${enc.title}]\n` +
    `• هستهٔ رخداد: ${enc.narrativeText}\n` +
    (actorsFa ? `• عوامل درگیر در صحنه: ${actorsFa}\n` : '') +
    `• دستور کارگردانی: روایت را پس از بازتابِ اقدامِ بازیکن، مستقیماً واردِ همین رخداد یا گفت‌وگوی کلیدی کن (بخش‌های عادی و بی‌اتفاقِ راه را پرش بزن) و انتخاب‌های صحنه را دقیقاً بر پایهٔ تصمیمِ قهرمان در برابر همین موقعیت بساز.` +
    checkHintFa
  );
}
