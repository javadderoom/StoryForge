import { WorkingContextEnvelope } from '@/lib/types/memory';
import { buildStatIdAliases } from './promptMechanics';

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
 * Builds a choices-only prompt for the opening turn of a story, using the authored
 * beat narrative text. Unlike buildNarrativePrompt, this does NOT instruct the
 * model to author a new narrative beat or advance the timeline, avoiding
 * phantom beast attacks, ungrounded combat paranoia, or narrative desynchronization.
 */
export function buildOpeningChoicesPrompt(
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
    statIdAliases: buildStatIdAliases(statsDefs),
  };
}

/**
 * Generates ONLY choices tailored to an already established, validated narrative scene.
 * Used when prose validation passed, but choices were invalid, dropped by sanitizers,
 * or flagged by AOT audits. Avoids discarding or rewriting high-quality 700-word prose.
 */
export function buildChoicesOnlyPrompt(
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
      `4. VARIED INTENTS: Offer 3 to 4 distinct options. When the scene contains active opposition or pressure, include one EXIT rather than an attempt: "withdraw" (disengage, retreat, refuse the encounter) or "observe" (wait, watch, gather without acting). A calm, social, or transitional scene does NOT need one — never bolt a retreat onto a conversation that is going fine. Cautious is NOT withdrawal — cautious is a careful attempt at the same objective; withdrawal declines the objective. Other intents are tactical, diplomatic, and bold. Set "style" to one of: tactical, cautious, bold, diplomatic, withdraw, observe.\n` +
      `5. WITHDRAWAL IS NOT A DEAD END: A withdrawal option must name what leaving buys — time, safety, distance, information, or a plan to return — and the engine will spend that time. Never frame it as an admission of defeat.\n` +
      `6. THREAT READOUT: When the opposition clearly outclasses the protagonist (an armed patrol, a beast far above their tier, a fortified position), at least one option MUST be a withdrawal or an observation. Never present a choice set in which every option is a doomed assault.\n` +
      `7. STAT CALIBRATION: Provide 1-2 diceless options and 1-2 options testing valid stats: [${validStatIds.join(', ')}]. DCs should be reasonable (10-14). A withdrawal that nothing is actively pursuing is diceless; a withdrawal from active pursuit may roll.\n` +
      `8. LITERARY PROSE: Clean narrative prose with NO dice tags, roll labels, or parenthetical annotations in the choice text.`
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
      `۴. تنوع رویکردها: ۳ تا ۴ گزینهٔ متمایز بده. وقتی صحنه رویارویی یا فشار فعال دارد، یکی از گزینه‌ها باید «خروج» باشد نه «اقدام»: عقب‌نشینی (رها کردن، کنار کشیدن، رد کردن این رویارویی) یا مشاهده (انتظار، زیر نظر گرفتن، گردآوری اطلاعات بدون درگیر شدن). صحنهٔ آرام، اجتماعی یا گذار به چنین گزینه‌ای نیاز ندارد — به گفت‌وگویی که خوب پیش می‌رود، عقب‌نشینی نچسبان. «محتاطانه» عقب‌نشینی نیست — محتاطانه یعنی تلاش سنجیده برای همان هدف؛ عقب‌نشینی یعنی رد کردن هدف. رویکردهای دیگر: هوشمندانه، گفت‌وگو/دیپلماتیک، جسورانه. مقدار style را یکی از این‌ها بگذار: tactical، cautious، bold، diplomatic، withdraw، observe.\n` +
      `۵. عقب‌نشینی هرگز بن‌بست نیست: گزینهٔ عقب‌نشینی باید بگوید بازیکن با رفتن چه به دست می‌آورد — زمان، ایمنی، فاصله، اطلاعات، یا نقشه‌ای برای بازگشت — و موتور بازی همان زمان را خرج می‌کند. آن را به‌شکل اعتراف به شکست ارائه نکن.\n` +
      `۶. سنجش تهدید: وقتی دشمن صحنه آشکارا از قهرمان قوی‌تر است (گزمهٔ مسلح، هیولایی بسیار فراتر از سطح او، موضعی استحکام‌شده)، دست‌کم یک گزینه باید عقب‌نشینی یا مشاهده باشد. هرگز مجموعه‌ای نساز که همهٔ گزینه‌هایش یورشِ محکوم‌به‌شکست باشند.\n` +
      `۷. تعادل تاس: حداقل ۱ گزینه بدون تاس (DICELESS) و گزینه‌های دارای بررسی مهارت بر اساس صفات معتبر ([${validStatIds.join('، ')}] با نام‌های: ${statDescriptors}). درجه سختی معقول (۱۰ تا ۱۴). عقب‌نشینی‌ای که چیزی او را تعقیب نمی‌کند بدون تاس است؛ عقب‌نشینی از تعقیب فعال می‌تواند تاس بخواهد.\n` +
      `۸. نثر ادبی ناب: از درج هرگونه پرانتز، برچسب بررسی مهارت یا شماره در متن گزینه‌ها خودداری کن. خروجی صرفاً JSON معتبر باشد.`
    );
  }

  return {
    systemPrompt,
    userPrompt: parts.join('\n\n'),
    isEnglish,
    playerStatIds: context.playerStatus?.stats || {},
    isLowBase,
    statIdAliases: buildStatIdAliases(statsDefs),
  };
}
