import { WorkingContextEnvelope } from '@/lib/types/memory';

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
  }
  if (context.religions?.length) out.push(`[${labels.religions}]\n${context.religions.map((x) => `• ${x}`).join('\n')}`);
  if (context.dramaBonds?.length) out.push(`[${labels.bonds}]\n${context.dramaBonds.map((x) => `• ${x}`).join('\n')}`);
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
- STRICT GROUNDING IN SCENE PROSE (NO PHANTOM ENTITIES): Every choice MUST strictly react to the physical obstacles, characters, and events EXPLICITLY established in the scene's narrative prose. NEVER invent phantom entities, unmentioned bystanders, imaginary cargo, caravan inspections, or unstated subplots. All choices must be actions directly referenced or present in the text (e.g. if only a closed gate is described, choices must interact with that gate or visible sentries, NOT inspect unmentioned caravans or baggage).`
        : `۴. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای و طبیعی ارائه کن:
- گام‌های اتمیک و تک‌مرحله‌ای (ATOMIC SINGLE-BEAT): هر انتخاب باید دقیقاً «یک اقدام فیزیکی یا گفتاری فوری» را در همین لحظه بیان کند. هرگز چند اقدام پیاپی را با «و» به هم متصل نکن (از فرمول «کار الف و سپس کار ب و کار ج» اکیداً پرهیز کن).
- ممنوعیت درج نتیجه در متن انتخاب: متن انتخاب باید صرفاً کنشِ عینی شخصیت باشد، نه هدف یا نتیجهٔ از پیش‌تعیین‌شده (از عباراتی چون «برای اینکه...»، «به منظور فرار...»، «تا مسیر امن را پیدا کند» پرهیز کن). نتیجه و پیامد کار تنها پس از تاس و توسط راوی مشخص می‌شود.
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
- انطباق مطلق با متن و صحنه (ممنوعیت توهم و فرضیات ناموجود): تک‌تک گزینه‌ها باید دقیقاً از دلِ موانع، اشخاص، محیط و رویدادهایی که در متنِ همین صحنه صریحاً به آن‌ها اشاره شده است برآیند. ابداع موجودیت‌های فرضی، افراد غایب، کاروان‌ها یا بارهای ذکرنشده، یا بازرسی بارهایی که اصلاً در متن نیامده‌اند اکیداً ممنوع است. تمام انتخاب‌ها باید مواردی باشند که در متن به آن‌ها اشاره شده است (مثلاً اگر در متن فقط از بسته بودن دروازه سخن رفته، گزینه‌ها باید منحصراً پیرامون خودِ دروازه، نگهبانان حاضر یا محیط پیرامونی باشند، نه بازرسی کالاهای خیالی).`
      : isEnglish
      ? `4. Provide 2 to 4 natural, contextual next choices for the reader in English. Keep choices strictly atomic without pre-baked outcomes, and strictly grounded in what has been explicitly mentioned in the scene prose without hallucinating unmentioned entities. In tense standoffs or conflicts, all choices must have a stat check and DC.`
      : `۴. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای تک‌مرحله‌ای (اتمیک) ارائه کن که کاملاً بر عناصر و وقایعِ صریحاً ذکرشده در متن صحنه استوار باشند (بدون توهم یا ابداع موارد غایب). در شرایط درگیری، بن‌بست مسلحانه یا تنش با دشمنان، تمام گزینه‌ها باید دارای بررسی ویژگی و درجه سختی باشند.`;

    // Plan 13: contextual choice material shared by both language branches.
    const choiceMaterial = [
      context.inventoryTerms?.length ? `Equipped gear / inventory: ${context.inventoryTerms.join(', ')}` : '',
      context.environmentInteractables?.length ? `Environmental interactables: ${context.environmentInteractables.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const dialogueDirective = isEnglish
      ? '5. Wrap every line of direct speech in double quotation marks ("...") so dialogue stays visually distinct from narration.'
      : '۵. هر گفت‌وگوی مستقیم را داخل «...» بنویس تا از روایت متمایز بماند.';

    const secretGuardDirective = isEnglish
      ? '6. KNOWLEDGE BOUNDARY: Never expose or offer choices that act upon unrevealed NPC secrets or hidden plot twists. The protagonist only knows what has been explicitly discovered or experienced in the story.'
      : '۶. مرز دانش شخصیت: هرگز در گزینه‌های انتخابی یا روایت، اسرار پنهان و ناگفته شخصیت‌ها را پیش از کشف توسط بازیکن لو نده. انتخاب‌ها باید صرفاً بر اساس دانسته‌ها و شواهد ملموس صحنه باشند.';

    const continuityDirective = `[SCENE CONTINUITY & CHOICE PREMISES]
- Resolve only the player's stated action against its actual target. Success does not authorize unrelated victories, confessions, or extra player actions beyond the pre-resolved consequence.
- TARGET FIDELITY & NO TELEPORTING NPCS: If the player acts toward generic guards, sentries, gates, or obstacles, do NOT substitute a named commander or unintroduced off-scene NPC as the immediate responder. Address only the actual recipient of the action.
- SPATIAL CONTINUITY & MICRO-VANTAGE (NO MAGIC NPC TELEPORTATION): If the protagonist stepped away, snuck off, or moved to a distinct micro-feature (e.g. down into the muddy reeds by the riverbank, behind wagons, onto a roof, or down a dark alley), NPCs left behind at camp, at the gates, or by a campfire DO NOT magically spawn or teleport beside the protagonist! They remain at their original post. They do not follow silently unless the player specifically asked them to accompany them. If a violent, noisy, or dramatic event occurs in a secluded spot, distant NPCs can only react from afar (hearing the noise from the campfire, shouting across the gloom, or running over with torches to see what happened). They are NEVER already standing over the aftermath!
- PHYSICAL ENVIRONMENT CONTINUITY: Only depict physical elements, obstacles, and props that exist in the scene. Do NOT hallucinate unmentioned physical objects (e.g., piled cargo, baggage wagons, caravan inspections) out of nowhere unless explicitly introduced by story prose or player action.
- SINGLE DRAMATIC FOCUS (NO THREAT STACKING): Maintain a single, cohesive source of dramatic conflict per turn. When a check fails or complications escalate, escalate ONE primary threat (e.g., either an encountered creature OR a patrolling sentry), rather than piling multiple uncoordinated antagonists into the same instant. Never depict an NPC completely oblivious to a giant predator coiling in front of them!
- BESTIARY GROUNDING & VISCERAL TRAITS: When introducing wild beasts, predators, or monstrosities, you MUST draw from the [BESTIARY & CREATURES] section and depict their specific authored physical features, secretions, and behaviors. Integrate the creature naturally through direct sensory prose (scale patterns, sounds, colors, predatory motion); do not awkwardly put its formal taxonomy name in quotation marks (the game UI automatically renders its Bestiary Discovery Card).
- COMPREHENSIVE CHOICE COVERAGE: The generated choices MUST directly address the active demands, ultimatums, or physical hazards presented at the end of the prose (e.g., if an adversary orders the protagonist to back away or face violence, choices must provide direct responses such as compliance, de-escalation, deception, cover, or counter-resistance).
- ITEM ROLE FIDELITY & NO ABSURD MISUSE: Equipped gear, relics, talismans, and artifacts must ONLY be referenced or offered in choices according to their true authored nature and powers (e.g. a desert survival bead, talisman, or sacred relic is NOT a throwaway pebble to toss into mud as a diversion, nor a random fidget prop to touch while talking). Permanent and non-consumable items must NEVER be used as disposable projectiles or distractions!
- Preserve present participants, their positions, and unresolved threats from recent prose. Do not silently remove opposition or treat a brief opening as a fully secured scene.
- Track who can see and hear each action. When a pre-resolved consequence requires a revelation, stage its delivery plausibly and account for witnesses' reactions; do not invent privacy or let nearby adversaries ignore an audible confession.
- Every choice must be possible at the end of this scene and grounded in facts the protagonist has actually learned. Do not invent profits, motives, ownership, accomplices, or available escape routes from a loosely related clue. Questions may investigate uncertainty, but must not present an unproven premise as fact.
- STRICT FACTUAL GROUNDING IN SCENE PROSE: Every choice MUST strictly react to the physical obstacles, characters, and situation explicitly established in the scene text. Do NOT invent phantom entities, unmentioned bystanders, cargo inspections, baggage searches, or phantom subplots. Choices must only address what is actually mentioned in the prose.
- Do not offer leverage that this scene has already spent, such as threatening to disclose information to someone who just heard it. Do not ask an NPC to remove an obstacle they do not control.
- Before returning JSON, check narrative and choices together for action scope, remaining opposition, witness knowledge, and supported premises. Revise contradictions without changing the authoritative game outcome.`;

    const systemPrompt = isEnglish
      ? `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).${authorDirective}
Base Language: Write the entire narrative and choices in pure, literary ENGLISH.

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. Keep the prose focused (between 200 and 350 words). Maintain narrative momentum and visceral tension.
[CAUSE & EFFECT PRIORITY — IMMEDIATE ACTION RESPONSIVENESS]
- The prose MUST open with or directly dramatize the protagonist performing the player's specific action and the immediate direct reaction of the world or target NPC.
- TARGET FIDELITY: Depict the reaction of the EXACT entity targeted by the action (e.g. the closed gate, the wall, or the specific sentry). Do NOT invent or substitute an unintroduced commander or off-scene NPC as the face-to-face responder!
- SPATIAL CONTINUITY & MICRO-VANTAGE: If the protagonist moved to a distinct sub-location or vantage point (e.g. muddy reeds, alley, rooftop), NPCs left at camp or the gate DO NOT magically teleport beside them. They remain at their post and only react from a distance (hearing noise, shouting, or running over).
- SINGLE DRAMATIC CONFLICT: Escalate one focused conflict or obstacle per turn. Do not spawn multiple uncoordinated crises simultaneously.
- CONVERSATIONAL ACTIONS: If the player spoke, asked, greeted, questioned, or negotiated with someone, the scene MUST feature direct spoken dialogue ("...") from the protagonist and a personal, direct reply or confrontation from the targeted NPC. Never reduce the player's speech to silence or generic ambient crowd noise!
- SENSORY BESTIARY DEPICTION: When wild beasts or monstrosities appear, describe their physical traits, coloration, and predatory movements viscerally. Avoid putting formal taxonomy names in awkward quotes in the prose (the game UI renders a dedicated Bestiary Discovery card for the player).
- ITEM ROLE FIDELITY: Equipped relics, talismans, and artifacts must be treated with appropriate weight according to their authored powers and slot. Never treat sacred relics or survival talismans as disposable diversion pebbles or casual conversational fidget props.
- NO FLOATING CAMERA SYNDROME: Do NOT open with detached panoramic scenery (weather, distant campfires, tobacco smoke) that ignores what the protagonist just did or said. Action and immediate reaction come first!
${statsDirective}
${dialogueDirective}
${secretGuardDirective}
${continuityDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "Visceral, atmospheric next scene prose in English...",
  "encounteredCreatureId": null, // If a beast/creature from [BESTIARY & CREATURES] is encountered or featured in this scene, put its ID (or name) here; otherwise null
  "choices": [
    { "id": "choice_1", "text": "Carefully inspect the masonry around the threshold for a hidden lever or latch", "style": "inquisitive", "riskLevel": "low" },
    { "id": "choice_2", "text": "Quietly draw the dagger and step behind the granite pillar", "style": "tactical", "riskLevel": "medium", "targetDC": ${exampleMedDC}, "requiredStatId": "${validStatIds[0] || 'might'}" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "Key discovery about a character in English..." }
  ]
}`
      : `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).${authorDirective}
Base Language: Write the narrative and choices in PERSIAN (فارسی - شیوا و ادبی).

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. Keep the prose focused (between 200 and 350 words). Maintain narrative momentum and visceral tension.
[اولویت علت و معلول — پاسخگویی مستقیم به اقدام بازیکن / CAUSE & EFFECT PRIORITY]
- صحنه باید فوراً با نشان دادن خودِ کنش بازیکن و واکنش بلافاصلهٔ جهان یا شخصیت مقابل آغاز شود یا بر آن متمرکز باشد.
- وفاداری به هدف اقدام (Target Fidelity): دقیقاً واکنش همان هدف، شخص یا مانعی که بازیکن مورد خطاب قرار داده یا بر آن اقدام کرده را نشان بده (مثلاً همان نگهبانان یا درِ بسته). هرگز یک فرمانده یا شخصیت غایب را که در صحنه نبوده ناگهان رو در روی بازیکن ظاهر نکن!
- پیوستگی مکانی و منع تله‌پورت شخصیت‌ها (Spatial Continuity): اگر قهرمان به محلی جداگانه یا دورتر از قرارگاه قدم گذاشته (مانند لجن‌زار حاشیهٔ رودخانه یا میان نی‌زارها)، شخصیت‌های مستقر کنار آتش یا کاروان (مانند رادمان) بی‌صدا پشت سر او نیامده‌اند و ناگهان در همان ثانیه در کنار او در لجن‌زار ظاهر نمی‌شوند! آن‌ها صدای ضربه، شکستن یا غوغا را از دور می‌شنوند، از کنار آتش بانگ می‌زنند یا دوان‌دوان برای وارسی می‌آیند؛ هرگز نباید بدون حرکت، از قبل بالای سر جسد ایستاده باشند.
- تمرکز بر یک بحران واحد (Single Dramatic Focus): در هر نوبت فقط یک منبع تنش یا خطر را تشدید کن. از رویارویی هم‌زمان بازیکن با دو خطر نامرتبط (مثلاً حملهٔ موجود وحشی همراه با اخطار نیزه‌دار بی‌خبر) اکیداً بپرهیز.
- پیوستگی محیطی: از ابداع موانع یا وسایل فیزیکیِ ذکرنشده (مانند بارهای انباشته‌شده یا کاروان‌ها) خودداری کن، مگر اینکه در متن صحنه‌های قبلی صراحتاً آمده باشند.
- اقدامات گفتاری و پرسش: اگر بازیکن سخنی گفت، سؤالی پرسید، سلام کرد یا با کسی وارد مذاکره شد، صحنه حتماً باید شامل دیالوگ مستقیم با علامت «...» باشد که به شکل شخصی و مستقیم به خودِ بازیکن پاسخ می‌دهد (یا با کلام و یا با تهدید/برخورد فیزیکی مشخص). هرگز دیالوگ بازیکن را بی‌پاسخ نگذار و آن را به فریادهای نامربوط در پس‌زمینه تبدیل نکن!
- وفاداری به ماهیت آیتم‌ها و ابزارها (Item Role Fidelity): تجهیزات، یادگارها و طلسم‌های همراه قهرمان باید دقیقاً مطابق با ماهیت و کارکرد تعریف‌شده‌شان استفاده شوند. هرگز یادگارهای باستانی، نمادها یا مهره‌های مقدس و دائمی (مانند دافع عطش و سراب) را به عنوان سنگریزه برای پرتاب و انحراف حواس دشمن، یا فیجت و بازیچهٔ دست در حین صحبت به کار نبر! آیتم‌های دائمی و غیرمصرفی هرگز نباید به عنوان اشیاء پرتابی تلف شوند.
- توصیف حسی و طبیعی موجودات (Sensory Bestiary Depiction): هنگام رویارویی با جانوران یا هیولاها، ویژگی‌های عینی، فلس‌ها، صدا و حرکات هولناک آن‌ها را به شکل زنده توصیف کن، اما از گذاشتن نام رسمی کتابچه در داخل گیومه مثل «افعی رسوبی» در متن خودداری کن؛ واسط کاربری بازی خود کارت شناسایی و کشف موجود را نمایش می‌دهد. در گزینه‌ها نیز به شکل طبیعی به آن اشاره کن (مثلاً «خزنده»، «مار»، یا «درنده»).
- منع زاویه دید دوربین معلق: صحنه را با توصیفات کلی و منفعلانه از منظره و دود و آتش‌های دوردست شروع نکن که عمل مشخصِ بازیکن در آن نادیده گرفته شود. اقدام و واکنش در اولویت اول هستند!
${statsDirective}
${dialogueDirective}
${secretGuardDirective}
${continuityDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "متن ادبی و فضاسازی صحنه بعدی...",
  "encounteredCreatureId": null, // در صورت رویارویی با موجودی از بخش فهرست موجودات، شناسه یا نام آن را در اینجا قرار دهید؛ در غیر این صورت null
  "choices": [
    { "id": "choice_1", "text": "بررسی دقیق نقش‌ونگارهای روی سنگِ درگاه برای یافتن روزنه یا نشانه‌ای پنهان", "style": "inquisitive", "riskLevel": "low" },
    { "id": "choice_2", "text": "کشیدن بی‌صدای خنجر و پناه گرفتن پشت ستون سنگی", "style": "tactical", "riskLevel": "medium", "targetDC": ${exampleMedDC}, "requiredStatId": "${validStatIds[0] || 'might'}" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "کشف رازی مهم در مورد شخصیت..." }
  ]
}`;

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

    const enProtagonistBlock = (statsLineEn || resourcesLine || playerEquipped.length || powerRanksLineEn)
      ? [
          '[PROTAGONIST STATUS & CAPABILITIES]',
          context.playerStatus?.characterName
            ? `• Name: ${context.playerStatus.characterName}${context.playerStatus.archetypeName ? ` (${context.playerStatus.archetypeName})` : ''}`
            : '',
          statsLineEn ? `• Attributes: ${statsLineEn}` : '',
          resourcesLine ? `• Vitals: ${resourcesLine}` : '',
          playerEquipped.length ? `• Equipped / Carried Gear: ${playerEquipped.join(', ')}` : '',
          context.playerStatus?.abilities?.length ? `• Known Abilities / Spells: ${context.playerStatus.abilities.join(', ')}` : '',
          powerRanksLineEn ? `\n[POWER SCHOOL RANKINGS & MASTERY]\n${powerRanksLineEn}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const faProtagonistBlock = (statsLineFa || resourcesLine || playerEquipped.length || powerRanksLineFa)
      ? [
          '[وضعیت و توانمندی‌های قهرمان داستان / PROTAGONIST STATUS]',
          context.playerStatus?.characterName
            ? `• نام: ${context.playerStatus.characterName}${context.playerStatus.archetypeName ? ` (${context.playerStatus.archetypeName})` : ''}`
            : '',
          statsLineFa ? `• ویژگی‌ها و صفات: ${statsLineFa}` : '',
          resourcesLine ? `• منابع و وضعیت حیاتی: ${resourcesLine}` : '',
          playerEquipped.length ? `• تجهیزات و اشیاء همراه: ${playerEquipped.join('، ')}` : '',
          context.playerStatus?.abilities?.length ? `• توانایی‌ها و جادوهای فعال: ${context.playerStatus.abilities.join('، ')}` : '',
          powerRanksLineFa ? `\n[مکاتب قدرت و درجات تسلط / POWER SYSTEM RANKINGS]\n${powerRanksLineFa}` : '',
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

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => {
            const statusTag = npc.presenceStatus === 'nearby_resident'
              ? ' [STATIONED AT LOCATION — NOT currently in this immediate scene]'
              : (npc.presenceStatus === 'present' ? ' [PRESENT IN SCENE]' : '');
            return `• ${npc.name}${statusTag} (Trust: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - Speech: ${npc.speechStyle}${npc.vitalsLine ? ` - Vitals: ${npc.vitalsLine}` : ''}${npc.powerAffiliationLine ? ` - Power: [${npc.powerAffiliationLine}]` : ''}`;
          })
          .join('\n');
        parts.push(
          `[PRESENT NPCS]\n${npcs}\n` +
          `• DIRECTIVE ON NPC PRESENCE & SPATIAL CONTINUITY: NPCs marked as [STATIONED AT LOCATION — NOT currently in this immediate scene] are stationed somewhere in this broad location/garrison, but are NOT currently in front of the protagonist. DO NOT place the protagonist face-to-face with them unless an action or event explicitly summons or seeks them out. Furthermore, if the protagonist stepped away to a secluded micro-location (e.g. riverbank reeds, shadows, alleys), NPCs left at camp remain at their post and only react to loud noises from afar. Maintain realistic physical space!`
        );
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (Importance: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        parts.push(
          `[PRE-RESOLVED GAME ENGINE OUTCOME]\n` +
          `• Player Action: "${context.resolvedGameOutcome.actionText}"\n` +
          `• Check Result: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• Consequence: ${context.resolvedGameOutcome.consequence}\n` +
          `• DIRECTIVE: Immediately open with the protagonist performing this exact action and depict the direct, personal reaction of the target NPC or environment! Respond to the exact target addressed, not an off-scene commander. If speaking or asking a question, use direct dialogue.`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[RECENT SCENE PROSE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      // Narrative goal / upcoming milestone encounter directive
      if (context.activeChapterGoal || context.activeChapterTitle) {
        parts.push(
          `[UPCOMING MILESTONE & NARRATIVE DIRECTION]\n` +
          (context.activeChapterTitle ? `Chapter: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `Target Milestone / Encounter: "${context.activeChapterGoal}"\n` : '') +
          `• DIRECTIVE: Act as the connective tissue! Subtly steer the environment, obstacles, and choice opportunities across turns toward this milestone encounter without forcing an unnatural instant teleport.`
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
          `[ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nReflect rising tension in the prose; when a clock hits its maximum, unleash its crisis event NOW, then stand the clock down.`
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

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => {
            const statusTag = npc.presenceStatus === 'nearby_resident'
              ? ' [مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست]'
              : (npc.presenceStatus === 'present' ? ' [حاضر در صحنه]' : '');
            return `• ${npc.name}${statusTag} (میزان اعتماد: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - لحن صحبت: ${npc.speechStyle}${npc.vitalsLine ? ` - علائم حیاتی: ${npc.vitalsLine}` : ''}${npc.powerAffiliationLine ? ` - قدرت: [${npc.powerAffiliationLine}]` : ''}`;
          })
          .join('\n');
        parts.push(
          `[شخصیت‌های حاضر / PRESENT NPCS]\n${npcs}\n` +
          `• دستور حضور شخصیت‌ها و پیوستگی مکانی: شخصیت‌هایی که برچسب «مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست» دارند، در این مکان کلی حضور یا اقامت دارند اما هنوز در این صحنهٔ مشخص رو در روی بازیکن نیستند. هرگز آنها را بدون مقدمه، بدون صدا زدن یا بدون تغییر تدریجی صحنه ناگهان رو در روی قهرمان قرار نده! اگر قهرمان به حاشیهٔ رودخانه یا میان نی‌ها رفته، افراد کنار آتش در جای خود باقی می‌مانند و تنها صدای حوادث را از دور می‌شنوند.`
        );
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (اهمیت: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[حافظه و رویدادهای گذشته / RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        parts.push(
          `[نتیجه محاسباتی موتور بازی / PRE-RESOLVED OUTCOME]\n` +
          `• عمل انجام شده توسط بازیکن: "${context.resolvedGameOutcome.actionText}"\n` +
          `• نتیجه تاس و بررسی: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• پیامد: ${context.resolvedGameOutcome.consequence}\n` +
          `• دستور مؤکد روایی: روایت را بلافاصله با انجام همین اقدام توسط قهرمان داستان آغاز کن و واکنش مستقیم، شخصی و عینیِ شخصیت یا مانع مورد اقدام (نه یک فرمانده غایب) را با دیالوگ مستقیم («...») نشان بده! از ابداع موانع فیزیکیِ ذکرنشده (مثل بارهای انباشته) بپرهیز و هرگز صحنه را با توصیفات منفعل پس‌زمینه که این اقدام در آن گم شود پر نکن.`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[خلاصه صحنه قبلی / RECENT SCENE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      // Narrative goal / upcoming milestone encounter directive
      if (context.activeChapterGoal || context.activeChapterTitle) {
        parts.push(
          `[جهت‌گیری روایی و برخورد پیش‌رو / UPCOMING MILESTONE]\n` +
          (context.activeChapterTitle ? `فصل: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `هدف روایی / برخورد هدف: «${context.activeChapterGoal}»\n` : '') +
          `• دستور راوی: شکاف داستانی را پر کن! وقایع، سرنخ‌ها و انتخاب‌ها را در طول نوبت‌ها به شکلی نامحسوس به سمت تحقق این برخورد روایی هدایت کن تا بازیکن در جریان ماجرا به این اتفاق برسد.`
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
          `[ساعت‌های تهدید فعال / ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nتنش فزاینده را در نثر منعکس کن؛ وقتی ساعتی به سقف رسید، بحرانش را همین حالا آزاد کن و سپس آن را بخوابان.`
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
}
