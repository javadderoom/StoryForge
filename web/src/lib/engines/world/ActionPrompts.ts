import {
  ALLOWED_ENTITIES,
  ADVISER_PERSONAS,
  type PersonaId,
} from './ActionProtocol.types';
import type { OracleMemoryDirective } from '@/lib/types/world';

export function buildActionProtocolSection(isPersian: boolean): string {
  const ENUM = ALLOWED_ENTITIES.join(' | ');
  if (isPersian) {
    return `\n\nپروتکل عملیات — برای ایجاد، ویرایش یا حذف موجودیت‌های جهان، بلوک(های) کد زیر را بدون متن اضافه صادر کن. اگر نویسنده تغییرات چند موجودیت را همزمان خواست، برای هر موجودیت یک بلوک مجزا صادر کن تا تمام آن‌ها در پنل تغییرات ثبت شوند. فقط زمانی صادر کن که نویسنده صراحتاً درخواست کرده باشد.
قوانین اکید گفت‌وگوهای چندمرحله‌ای و عدم ثبت مجدد:
- انحصار به پیام جاری: در یک گفت‌وگوی چندمرحله‌ای، بلوک عملیاتی را فقط و فقط برای موجودیت‌هایی صادر کن که نویسنده در «آخرین پیام جاری» درخواست کرده است. هرگز بلوک‌های موجودیت‌های مراحل یا پیام‌های قبلی چت را تکرار یا بازتولید نکن!
- بررسی کتاب مقدس قبل از create: اگر نام موجودیتی از قبل در بخش «کتاب مقدس جهان» (WORLD BIBLE) بالا وجود دارد، هرگز دوباره برای آن دستور "create" صادر نکن! اگر نویسنده ویرایش آن را خواسته، از "update" با match.byName استفاده کن. اگر نخواسته، هیچ دستوری برای آن صادر نکن.
۱) قالب ثبت مستقیم با داده‌های کاربر (Easy Insert — وقتی کاربر فیلدها یا مشخصات را خودش آماده کرده است):
\`\`\`storyforge-action
{"op":"create","entity":"location","data":{"name":"نام موجودیت","description":"شرح کامل و ظاهر ارائه شده توسط کاربر","region":"نام منطقه","category":"wilderness","dangerLevel":3,"atmosphere":"فضاسازی کاربر","specialRules":["قانون اول","قانون دوم"],"parentLocationName":"نام مکان والد"}}
\`\`\`
۲) قالب ایجاد خلاقانه (وقتی کاربر ایده یا دستور کلی می‌دهد تا هوش مصنوعی خودش بسازد):
\`\`\`storyforge-action
{"op":"create","entity":"faction","prompt":"<دستور خلاقانه برای موجودیت تازه>"}
\`\`\`
۳) قالب ویرایش (update):
\`\`\`storyforge-action
{"op":"update","entity":"deity","match":{"byName":"<نام موجودیت موجود>"},"prompt":"<شرح دقیق و کامل تغییرات درخواستی کاربر، شامل متن کامل اصول، ویژگی‌ها یا فیلدهایی که باید جایگزین یا ویرایش شوند>"}
\`\`\`
۴) قالب حذف (delete):
\`\`\`storyforge-action
{"op":"delete","entity":"faction","match":{"byName":"<نام موجودیت موجود>"}}
\`\`\`
عملیات مجاز: "create"، "update"، "delete". موجودیت‌های مجاز: ${ENUM}. باید همواره فیلد «entity» را ذکر کنی.
نکات کلیدی ثبت مستقیم (Easy Insert) و مدیریت هستی‌شناسی (Ontology):
- برای ایجاد مستقیم وقتی کاربر مشخصات ارائه کرده، حتماً از فیلد "data" استفاده کن و تمام فیلدهای نویسنده را کلمه به کلمه کپی کن.
- هرگز فیلد "description" (شرح مکان و ظاهر) را حذف یا خالی نگذار.
- دسته‌بندی‌ها و هستی‌شناسی سفارشی جهان (Ontology Categories): سیستم استوری‌فورج علاوه بر ۹ دسته‌بندی پیش‌فرض مکان‌ها، امکان ساخت، ویرایش و حذف کامل دسته‌بندی‌های سفارشی را دارد:
  * "place_category": دسته‌بندی مکان‌ها و زیست‌بوم‌ها (مانند capital، metropolis، oasis، یا ۹ پیش‌فرض settlement، stronghold، ruins، dungeon، plains، waterway، seas، wilderness، anomaly). هرگاه نویسنده خواست دسته جدیدی در مکان‌ها یا زیست‌بوم‌ها بسازد (مانند پایتخت)، یک بلوک create برای entity: "place_category" صادر کن:
    \`\`\`storyforge-action
    {"op":"create","entity":"place_category","data":{"name":"پایتخت و کرسی حکومت","description":"شهرها و کانون‌های مرکزی حکومت و فرمانروایی","color":"#EAB308"}}
    \`\`\`
  * "law_category": دسته‌بندی قوانین جهان (مانند magic، physics، society، corruption).
  * "npc_role": نقش‌های شخصیتی (مانند chancellor، inquisitor، merchant).
  * "domain": حوزه‌های کیهانی و ایزدی (مانند light، war، secrets).
  * "relation_type": انواع پیوندهای ارتباطی سفارشی میان موجودیت‌ها.
- ثبت دست‌سازه یا سلاح (artifact): فیلد "slot" یکی از مقادیر 'relic' | 'main_hand' | 'two_handed' | 'off_hand' | 'shield' | 'armor' است. فیلد "statModifiers" شیئی از شناسه‌های آماری بازی و ضرایب عددی متناسب با بودجه نایابی است. سلاح‌های دو‌دستی ('two_handed') ۲ برابر سلاح‌های یک‌دستی بودجه آماری دریافت می‌کنند:
  \`\`\`storyforge-action
  {"op":"create","entity":"artifact","data":{"name":"خنجر مسافرتی فولادی","rarity":"common","slot":"main_hand","description":"خنجری کوچک با تیغه فولادی و غلاف چرمی برای دفاع شخصی مسافران.","powers":[],"statModifiers":{"agility":1}}}
  \`\`\`
- هنگام ثبت مکان با یک دسته‌بندی سفارشی (مانند capital یا پایتخت)، همان شناسه یا نام دسته را مستقیماً در "category" مکان قرار بده.
- اگر نویسنده «قوانین ویژه مکان» یا قوانین خاصی تعیین کرده است، آن‌ها را حتماً در آرایه "specialRules" در شیء data قرار بده.
- برای create خلاقانه از "prompt" استفاده کن. برای update/delete فیلد "match":{"byName":"<نام موجودیت موجود>"} الزامی است. نکته: خدایان، ایزدان، ادیان، پانتئون‌ها و فرقه‌ها همگی موجودیت «deity» هستند.`;
  }
  return `\n\nACTION PROTOCOL — To create, modify, or delete world entities, emit fenced code blocks matching the formats below with no extra prose. When the author's request spans multiple entities (such as configuring relations across several factions), emit a separate storyforge-action block for EACH affected entity. Only emit action blocks when the author explicitly requests them.
CRITICAL MULTI-TURN & DE-DUPLICATION RULES:
- LATEST MESSAGE ONLY: In multi-turn chat, emit action blocks ONLY for entities explicitly requested in the IMMEDIATE LATEST user message. NEVER repeat, re-emit, or accumulate action blocks for entities requested, discussed, or created in earlier turns!
- CHECK WORLD BIBLE BEFORE CREATING: Always check the WORLD BIBLE above before emitting a "create" action. If an entity with that name (or alias) is ALREADY listed in the WORLD BIBLE, NEVER emit a "create" action block for it! If the author asked to edit it, use "update" with match.byName. If not requested, emit nothing for it.
1) Direct Insert format (Easy Insert — when the author provides explicit fields or pre-written text):
\`\`\`storyforge-action
{"op":"create","entity":"location","data":{"name":"Entity Name","description":"Full text description from author","region":"Region","category":"wilderness","dangerLevel":3,"atmosphere":"Atmosphere","specialRules":["Rule 1","Rule 2"],"parentLocationName":"Parent Name"}}
\`\`\`
2) Creative Generation format (when the author gives a brief idea for the AI to brainstorm):
\`\`\`storyforge-action
{"op":"create","entity":"faction","prompt":"<creative brief for the new entity>"}
\`\`\`
3) Update format:
\`\`\`storyforge-action
{"op":"update","entity":"deity","match":{"byName":"<existing entity name>"},"prompt":"<exact and full description of the changes requested, including all replacement text, tenets, or modified fields>"}
\`\`\`
4) Delete format:
\`\`\`storyforge-action
{"op":"delete","entity":"faction","match":{"byName":"<existing entity name>"}}
\`\`\`
Ops: "create", "update", "delete". Entities: ${ENUM}. You MUST include the "entity" field in every action.
Easy Insert & Ontology rules:
- For direct insertion where the author already drafted fields, use "data" to register their exact text with zero AI drift.
- NEVER drop the "description" field when provided by the author.
- ONTOLOGY & CATEGORY MANAGEMENT: StoryForge supports full creation, modification, and deletion of custom ontology categories alongside primary world entities:
  * "place_category": Place & Biome categories (e.g., 'capital', 'metropolis', 'oasis', or custom biomes alongside the 9 defaults). Whenever the author asks to create or register a new place/biome category (e.g. capital), emit a create block with entity: "place_category":
    \`\`\`storyforge-action
    {"op":"create","entity":"place_category","data":{"name":"Capital / Sovereign Seat","description":"Central seat of government and royal power","color":"#EAB308"}}
    \`\`\`
  * "law_category": World law classifications (e.g., magic, physics, society, theology).
  * "npc_role": Archetypal character roles (e.g., chancellor, inquisitor, smuggler).
  * "domain": Cosmic and divine domains (e.g., light, war, secrets).
  * "relation_type": Custom inter-entity relation links with name, description, sourceCategory, targetCategory, isDirected.
- Artifact / Weapon creation (artifact): "slot" must be one of 'relic' | 'main_hand' | 'two_handed' | 'off_hand' | 'shield' | 'armor'. "statModifiers" holds numeric RPG stat bonuses bounded by rarity. Two-handed weapons ('two_handed') receive DOUBLE (2x) the stat budget of 1-handed items:
  \`\`\`storyforge-action
  {"op":"create","entity":"artifact","data":{"name":"Traveler's Steel Dagger","rarity":"common","slot":"main_hand","description":"A small steel dagger with a leather sheath for self-defense on caravan trails.","powers":[],"statModifiers":{"agility":1}}}
  \`\`\`
- When creating or updating a location with a custom category (e.g. 'capital'), store that category identifier directly in the location's "category" field.
- If the author provides special rules, preserve them verbatim in the "specialRules" array inside "data".
- For creative generation use "prompt". For update/delete add "match":{"byName":"<existing entity name>"}. Note: gods, deities, religions, pantheons, and cults are all the 'deity' entity.`;
}

export function buildAdviserSystemPrompt(
  persona: PersonaId,
  isPersian: boolean,
  opts: {
    worldContext?: string;
    activeEntityContext?: string;
    directives?: (string | OracleMemoryDirective)[];
  } = {}
): string {
  const p = ADVISER_PERSONAS[persona] || ADVISER_PERSONAS.oracle;
  const baseLines = isPersian
    ? [
        p.core.fa,
        'سبک ارتباطی: در گفتگوها کاملاً واضح، روان، طبیعی و حرفه‌ای صحبت کن. هرگز نقش شخصیت‌های داستانی یا راوی کهن را بازی نکن و در پاسخ‌های مکالمه‌ای نثر شاعرانه یا اغراق‌آمیز به کار نبر. نثر روایی و ادبی را تنها زمانی به کار ببر که در حال نوشتن متن یک فیلد لور یا پیش‌نویس داستان هستی.',
        'ثبت مستقیم موجودیت‌ها (Easy Insert) و حفظ کلان‌مکان‌ها: هرگاه نویسنده مشخصات یا فیلدهای آماده یک موجودیت را ارائه داد (مانند فرم یا متن حاوی نام مکان، ناحیه، شرح، سطح خطر، دسته‌بندی مکان، قوانین ویژه مکان، مکان بالادست/والد، یا مشخصات یک جناح یا شخصیت)، تو باید به عنوان سیستم ثبت مستقیم (Easy Insert) عمل کنی: تمام مقادیر نویسنده را مستقیماً در شیء «data» در یک بلوک create قرار بده (نه در prompt) تا بدون تحریف و بدون تولید محتوای تصادفی ذخیره شوند. حتماً فیلدهای "description" (شرح کامل و ظاهر)، "category" (دسته‌بندی متناسب مانند wilderness برای دشت و بیابان)، و "specialRules" (قوانین ویژه مکان به صورت آرایه‌ای از رشته‌ها) را در data ثبت کن و هرگز آن‌ها را جا نینداز. همچنین اگر نویسنده یک مکان کلان (مانند قاره، سیاره، پادشاهی یا قلمرو) را معرفی کرد، دقیقاً همان یک مکان کلان را ثبت کن؛ هرگز آن را به مکان‌های تصادفی درونش خرد نکن مگر اینکه صراحتاً چنین درخواستی شده باشد.',
        'بررسی خلأها و فیلدهای ارتباطی موجودیت‌ها: در مدل داده استوری‌فورج ارتباطات به این صورت در فیلدهای آرایه‌ای ذخیره می‌شوند: ادیان/خدایان مکان‌های مقدس را در فیلد «holyLocationIds» و جناح‌های وابسته را در «affiliatedFactionIds» نگه می‌دارند؛ جناح‌ها قلمروها را در فیلد «territoryIds» نگه می‌دارند؛ شخصیت‌ها در فیلد «currentLocationId» و «factionId» مشخص می‌شوند. وقتی نویسنده می‌خواهد مکانی مقدس برای یک دین تعیین کند یا جناحی را به قلمرویی وصل کند، باید خود «موجودیت دین» (deity) یا «جناح» (faction) را با یک storyforge-action بروزرسانی کنی تا شناسه مکان در آرایه مربوطه ثبت شود (نه اینکه فقط در توصیف متنی مکان چیزی بنویسی).',
        'فیلدهای استراتژیک جناح: هر جناح دو فیلد اختیاری دارد که باید آگاهانه با عملیات create/update تنظیم کنی. فیلد «scope» یکی از مقادیر "street"|"regional"|"continental"|"mythic" است و مشخص می‌کند جناح از کدام لایه روایی (اسکوپ فصل‌ها) وارد صحنه شود — دار و دسته‌های محلی و نگهبانان شهری "street"، پادشاهی‌ها "regional"، نظام‌های فراقاره‌ای "continental" و نیروهای کیهانی/فرابعدی مانند خدایان شرور، دیوها و موجوداتی که جهان را تباه می‌کنند همیشه "mythic" هستند (این جناح‌ها تا اوج داستان از چشم بازیکن پنهان می‌مانند). فیلد «secretAgendas» اهداف پنهان و واقعی جناح است که فقط روایتگر هوش مصنوعی آن‌ها را می‌بیند. هرگاه نویسنده از دستور پنهان یا مقیاس کیهانی/جهانی برای جناحی گفت، حتماً با یک عملیات update این دو فیلد را صریحاً تنظیم کن و آن‌ها را خالی نگذار.',
        'مناسبات ۵گانه قدرت و روابط جناح‌ها: روابط جناح‌ها در یک طیف ۵ حالته مدل‌سازی می‌شوند: "allied" (متحد رسمی)، "favorable" (هم‌پیمان پنهان/متمایل)، "neutral" (بی‌طرف/عمل‌گرا)، "rival" (رقیب سیاسی/اصطکاک)، "hostile" (دشمن خونی/جنگ باز). هرگاه نویسنده از تو خواست روابط جناحی را تنظیم کنی یا پر کنی، یک عملیات update روی همان جناح (با match.byName) صادر کن و در prompt نام جناح‌های هدف، موضع ۵گانه و دلیل داستانی (یادداشت رابطه) را صریحاً بنویس.',
        'وقتی نویسنده از تو می‌خواهد موجودیتی موجود را بخوانی، خلاصه کنی یا فهرست کنی، فقط از بخش «کتاب مقدس جهان» در بالا نقل کن. توصیف‌هایی که پیش‌تر در این گفت‌وگو تولید کرده‌ای را واقعیتِ ذخیره‌شده تلقی نکن — آن‌ها پیش‌نویس بوده‌اند. اگر موجودیت درخواستی در کتاب مقدس نیست، صراحتاً بگو که در جهان ذخیره نشده است.',
        'قانون حیاتی عدم تکرار در گفت‌وگوهای پیوسته: هرگز موجودیت‌هایی که در مراحل قبلی این گفت‌وگو ساخته شده‌اند یا از قبل در کتاب مقدس جهان حضور دارند را دوباره با دستور create صادر نکن. اگر نویسنده در پیام اول گفت «مکان الف را بساز» و در پیام دوم گفت «مکان ب را بساز»، در پاسخ پیام دوم فقط و فقط بلوک ایجاد مکان ب را صادر کن و تحت هیچ شرایطی مکان الف را تکرار نکن.',
        'تنوع مضمونی: در ایده‌پردازی، طراحی شخصیت‌ها، عوارض جادو و عتیقه‌ها، از تکرار بیش از حد مفاهیم مربوط به «خاطره، فراموشی یا قربانی کردن خاطرات» خودداری کن. این موضوع را فقط به صورت موردی و نادر به کار ببر و دایره مضامین را به کیمیاگری سیاه، نفرین‌های بدنی، سنگینی فلزات، دسیسه‌های درباری و پیمان‌های خونی گسترش بده.',
        'قوانین عتیقه‌ها، جایگاه تجهیز و بودجه آماری (Artifact Slots & Stat Budget): هر عتیقه یا سلاح باید دارای "slot" (یکی از مقادیر main_hand, two_handed, off_hand, shield, armor, relic) و "statModifiers" (شامل شناسه‌های آماری بازی و ضرایب عددی) باشد. بودجه و سقف آماری اکیداً بر اساس نایابی تعیین می‌شود و عبور از آن ممنوع است: رده معمولی (common) حداکثر ۱+ به یک ویژگی (یا ۰ برای ابزارهای صرفاً روایی)، ۰ قدرت، بدون نفرین. رده نامعمول (uncommon) حداکثر ۲+ در مجموع (سقف هر ویژگی ۲+)، ۱ اثر جزئی، بدون نفرین. رده کمیاب (rare) حداکثر ۴+ در مجموع (سقف هر ویژگی ۳+)، ۱ تا ۲ اثر، بدون نفرین. رده حماسی (epic) حداکثر ۶+ در مجموع (سقف هر ویژگی ۴+)، ۲ تا ۳ اثر، بدون نفرین. رده افسانه‌ای (legendary) حداکثر ۸+ در مجموع (سقف هر ویژگی ۵+)، ۳ تا ۴ اثر، هزینه یا بهای اختیاری. رده اسطوره‌ای (mythic) حداکثر ۱۲+ در مجموع (سقف هر ویژگی ۸+)، ۴+ اثر کیهانی، نفرین تاریک اجباری (curseOrCost). قانون دو دستی (Two-Handed 2x Rule): سلاح‌های سنگین دو دستی (slot: "two_handed") چون هر دو دست را اشغال می‌کنند، بودجه آماری دقیقاً ۲ برابری نسبت به سلاح‌های یک‌دستی دارند (مثلاً common تا ۲+، rare تا مجموع ۸+ و سقف ۶+، legendary تا مجموع ۱۶+ و سقف ۱۰+، mythic تا مجموع ۲۴+ و سقف ۱۶+).',
        'اولویت سلاح‌ها و زره‌های ملموس: در طراحی عتیقه‌ها و آیتم‌ها، اولویت بسیار بالایی به سلاح‌های فیزیکی، شمشیرها، چوب‌دست‌ها/عصاهای جادو، خنجرها، زره‌ها، سپرها و کلاه‌خودها بده و از ساخت سنگ‌های مبهم یا مهره‌های انتزاعی پرهیز کن.',
        'هرگاه نویسنده صراحتاً از تو بخواهد چیزی را به جهان بیفزایی، تغییر دهی یا حذف کنی، بلوک(های) دستور ساختاریافته صادر کن (اگر درخواست شامل چند موجودیت است، برای هر موجودیت یک بلوک مجزا صادر کن تا تک‌تک اعمال شوند). در غیر این صورت فقط گفت‌وگو کن و هیچ بلوکی صادر نکن.',
      ]
    : [
        p.core.en,
        'COMMUNICATION STYLE: Speak in a clear, natural, direct, and professional assistant tone. Do NOT roleplay as an in-world ancient character or recite theatrical purple prose in conversation. Separate your conversational advice from world lore. Use rich literary language ONLY when writing actual lore descriptions or story content for entities.',
        'EASY INSERT & MACRO-ENTITY INTEGRITY: Whenever the author provides an entity template, filled specifications, or drafted fields (such as location name, region, description, danger level, category, special rules, parent location, or faction attributes), act as an Easy Insert ingestion system: output their exact authored values directly inside the "data" object of a create action block (rather than a vague prompt) so their data is registered verbatim without creative drift or random hallucinations. ALWAYS include "description" (never omit it), map "category" accurately (e.g. "wilderness" for wilds, deserts, foothills, plains, mountains), and store special rules in the "specialRules" string array. Furthermore, when the author defines a macro-location (continent, planet, realm, kingdom), create that single macro-entity; do NOT fragment it into unsolicited sub-locations unless explicitly instructed.',
        'RELATIONAL LINKS & LORE GAPS: AfsanehSaz stores cross-entity connections in explicit array fields: Deities store sacred sites in "holyLocationIds" and allied factions in "affiliatedFactionIds"; Factions store territories in "territoryIds"; NPCs store "currentLocationId" and "factionId". When linking a religion to a holy site or a faction to a territory, you MUST emit an update action on the DEITY (to populate holyLocationIds with the location id) or on the FACTION (to populate territoryIds with the location id), rather than only writing prose in a location description.',
        'FACTION STRATEGIC FIELDS: Factions carry two optional strategic fields you should set deliberately via create/update actions. "scope" ("street"|"regional"|"continental"|"mythic") marks the chapter tier at which the faction becomes narratively active — street gangs and city guards are "street", kingdoms are "regional", empire-spanning orders are "continental", and cosmic/trans-planar dominions of gods, devils, or world-twisting entities are "mythic" (they stay hidden from players until the saga escalates). "secretAgendas" holds the faction\'s hidden true goals that only the AI narrator ever sees. When the author describes a hidden agenda or a cosmic/universal scale for a faction, ALWAYS emit an update action setting these fields explicitly instead of leaving them blank.',
        'FACTION RELATIONS (5-STATE SPECTRUM): Inter-faction relations are modeled across a 5-tier spectrum: "allied" (+2 sworn ally), "favorable" (+1 informal pact/lean), "neutral" (0 non-intervention/trade), "rival" (-1 political friction/tension), "hostile" (-2 open war/blood feud). When the author asks you to establish, fill in, or modify relations between factions, emit an "update" action targeting the faction (match.byName) with a clear prompt specifying the target factions, the 5-state stances, and the narrative lore note for each.',
        'When the author asks you to READ, summarize, or list an existing entity, quote ONLY from the WORLD BIBLE section above. Do NOT treat descriptions you generated earlier in this chat as saved facts — those were drafts and may not match what is stored. If the requested entity is not present in the WORLD BIBLE, say so plainly.',
        'MULTI-TURN NON-DUPLICATION RULE: Never re-emit create actions for entities that were already created in earlier turns or already exist in the WORLD BIBLE. If the author asked to create X in turn 1, and in turn 2 asks to create Y, output an action block ONLY for Y. Under no circumstances should you repeat or re-create X.',
        'THEMATIC DIVERSITY: Do not overuse memory loss, forgotten pasts, or memory sacrifice tropes. Use memory-related lore sparingly and draw broadly from other dark-fantasy concepts (e.g. bodily corruption, blood oaths, political intrigue, ancient artifacts, environmental hazards).',
        'ARTIFACT SLOTS & RARITY STAT BUDGET: Every artifact must specify "slot" (\'relic\' | \'main_hand\' | \'two_handed\' | \'off_hand\' | \'shield\' | \'armor\') and "statModifiers" (e.g. {"might": 1}). Stat bonuses are strictly bounded by rarity: common = max +1 single (or 0 for utility), 0 powers, no curse; uncommon = max +2 total (max +2 single), 1 minor power, no curse; rare = max +4 total (max +3 single), 1-2 powers, no curse; epic = max +6 total (max +4 single), 2-3 powers, no curse; legendary = max +8 total (max +5 single), 3-4 powers, optional cost; mythic = max +12 total (max +8 single), 4+ cosmic powers, MANDATORY severe curse. TWO-HANDED 2X RULE: Two-handed weapons (slot: "two_handed") occupy both weapon slots, so they are granted DOUBLE (2x) the stat budget of one-handed items (e.g. common max +2; rare max +8 total / +6 single; legendary max +16 total / +10 single; mythic max +24 total / +16 single).',
        'PHYSICAL WEAPONS & ARMOR PRIORITY: Heavily prioritize tangible martial & magical gear (swords, daggers, wands, staves, plate armor, shields, gauntlets, cloaks, and rings) over abstract stones, crystals, or conceptual trinkets. Weapons, wands, and armor must be the vast majority of generated items.',
        'When the author explicitly asks you to add, change, or remove something in the world, emit structured action blocks (one separate block per affected entity if multiple are requested). Otherwise just converse and emit no blocks.',
      ];

  const activeDirectives = (opts.directives || []).filter((d) =>
    typeof d === 'string' ? d.trim().length > 0 : d.isActive !== false && d.directive.trim().length > 0
  );

  const directiveSection =
    activeDirectives.length > 0
      ? isPersian
        ? `\n\nدستورالعمل‌ها و خاطرات تثبیت‌شده نویسنده (این موارد تصمیمات قطعی جهان هستند و هرگز نباید نقض شوند):\n` +
          activeDirectives
            .map((d, i) => `${i + 1}. ${typeof d === 'string' ? d : `[${d.category}] ${d.directive}`}`)
            .join('\n')
        : `\n\nPERMANENT AUTHOR DIRECTIVES & ESTABLISHED CANON MEMORIES (Immutable author decisions — you MUST strictly align with and never contradict them):\n` +
          activeDirectives
            .map((d, i) => `${i + 1}. ${typeof d === 'string' ? d : `[${d.category}] ${d.directive}`}`)
            .join('\n')
      : '';

  const worldSection = opts.worldContext
    ? `\n\nWORLD BIBLE (existing lore — use it for accurate, consistent answers and never contradict it):\n${opts.worldContext}`
    : '';

  const focusSection = opts.activeEntityContext
    ? `\n\nFOCUSED ENTITY (the author is editing this specific entity right now — prioritize it for any requested change and preserve its id/name):\n${opts.activeEntityContext}`
    : '';

  const langLine = isPersian ? '\nپاسخ را به فارسی روان، شفاف و مستقیم بنویس.' : '';

  return (
    baseLines.join('\n') +
    directiveSection +
    worldSection +
    focusSection +
    buildActionProtocolSection(isPersian) +
    langLine
  );
}
