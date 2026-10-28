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
 * Plan 17 (§4.5): journey leg / arrival blocks — the road is real. Rendered
 * whenever the envelope carries an active journey or an arrival this turn,
 * with hard arrival discipline so prose can never teleport the protagonist
 * into the destination early.
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
      if (travel.isElliptical) {
        const companions = travel.caravanNpcNames?.length
          ? ` Travelling companions: ${travel.caravanNpcNames.join(', ')}.`
          : '';
        const road = travel.roadNote ? ` Route notes: ${travel.roadNote}.` : '';
        const distanceStr = travel.distanceKm ? `${travel.distanceKm} km` : 'a long distance';
        const daysStr = travel.calendarDays ? `${travel.calendarDays} days` : 'several days';

        parts.push(
          `[JOURNEY ELLIPSIS — TIME & DISTANCE MONTAGE]\n` +
            `• NARRATIVE ELLIPSIS: The journey from "${travel.originName}" to "${travel.destinationName}"${travel.routeName ? ` via the "${travel.routeName}"` : ''} covers ~${distanceStr} and spans ~${daysStr} of travel (${travel.mode}).${companions}${road}\n` +
            `• COMPRESS PASSAGE OF TIME: This stretch of the road is uneventful (no ambushes or sudden crises). Do NOT narrate day-by-day micro-steps. Instead, write 1-2 evocative, cinematic paragraphs summarizing the passage of time, the changing sky and landscape, night camps under unfamiliar stars, the rhythm of beasts and boots, and the weathering of gear.\n` +
            `• NO TRIVIAL STALLS: Strictly do NOT pause the narrative for routine camping chores, cooking, or sleeping choices. Forbid mundane road choices.\n` +
            `• ARRIVAL AT OUTSKIRTS / GATES: Conclude the scene as the traveller approaches the visible horizon, outskirts, or gates of "${travel.destinationName}". Let the sensory reality of the destination loom directly ahead so the player is primed to take their first meaningful action upon arrival.`
        );
      } else {
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
    }
    if (travelArrival) {
      const durationNote = travelArrival.calendarDays
        ? ` after ${travelArrival.calendarDays} days${travelArrival.distanceKm ? ` (${travelArrival.distanceKm} km)` : ''} on the road`
        : '';
      parts.push(
        `[JOURNEY ARRIVED — پایان راه]\n` +
          `• The journey ended this turn${durationNote}: the protagonist has entered "${travelArrival.destinationName}". Open the scene with the destination washing over the senses (crowds, smells, sound, road-dust still on them) and treat it as the new grounded setting — continue seamlessly from the final leg of the road.`
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

    if (travel.isElliptical) {
      const companions = travel.caravanNpcNames?.length
        ? ` همسفران راه: ${travel.caravanNpcNames.join('، ')}.`
        : '';
      const road = travel.roadNote ? ` وضعیت جاده: ${travel.roadNote}.` : '';
      const distanceStr = travel.distanceKm ? `${travel.distanceKm} کیلومتر` : 'مسافتی طولانی';
      const daysStr = travel.calendarDays ? `${travel.calendarDays} روز` : 'چندین روز';

      parts.push(
        `[گذر زمان و خلاصهٔ سفر / JOURNEY ELLIPSIS]\n` +
          `• خلاصه و گذر زمان سفر (Narrative Ellipsis): سفر از «${travel.originName}» به «${travel.destinationName}»${travel.routeName ? ` از مسیر «${travel.routeName}»` : ''} نزدیک به ${distanceStr} مسافت داشته و حدود ${daysStr} (${modeFa}) به طول انجامیده است.${companions}${road}\n` +
          `• فشردن زمان و مسافت: این پهنه از مسیر بدون درگیری بحرانی یا کمین مستقیم طی شده است. از روایت گام‌به‌گام و روزمره بپرهیز. گذر زمان، تغییر اقلیم و مناظر، اتراق‌های شبانه زیر آسمان پرستاره، سوز سرما یا داغی آفتاب، و خستگی سفر را در ۱ تا ۲ پاراگراف فضاساز و سینمایی خلاصه کن.\n` +
          `• منع درنگ‌های پیش‌پاافتاده: هرگز صحنه را برای کارهای روزمره (آب خوردن، پختن غذا، برپا کردن چادر) متوقف نکن و انتخاب‌های روزمره نساز.\n` +
          `• فرود در آستانهٔ مقصد: صحنه باید در آستانه، دروازه‌ها یا مدخل «${travel.destinationName}» به پایان برسد و هیاهو و نشانه‌های مقصد نمایان شود تا قهرمان آماده اولین کنش هدفمند در این مکان جدید باشد.`
      );
    } else {
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
  }
  if (travelArrival) {
    const durationNote = travelArrival.calendarDays
      ? ` پس از ${travelArrival.calendarDays} روز${travelArrival.distanceKm ? ` (${travelArrival.distanceKm} کیلومتر)` : ''} راه`
      : '';
    parts.push(
      `[رسیدن به مقصد / JOURNEY ARRIVED]\n` +
        `• سفر همین نوبت${durationNote} به پایان رسید: قهرمان به «${travelArrival.destinationName}» درآمده است. صحنه را با سرریز حس‌های مقصد بگشا (هیاهو، بو، صدا؛ گردِ راه هنوز بر تن او) و اینجا را قرارگاه تازهٔ او بدان — پیوسته و بی‌درز از پایان راه پیش ببر.`
    );
  }
  return parts.join('\n');
}
