import 'dotenv/config';
import { prisma } from '../src/lib/db/client';

export interface ActionCategorySeed {
  code: string;
  nameFa: string;
  nameEn: string;
  domain: string;
  description: string;
  tags: string[];
}

export const INITIAL_ACTION_CATEGORIES: ActionCategorySeed[] = [
  // -------------------------------------------------------------
  // Combat Defense
  // -------------------------------------------------------------
  {
    code: 'incoming_light_projectile',
    nameFa: 'دفاع در برابر پرتابه‌های سبک (تیر و سنگ)',
    nameEn: 'Incoming Light Projectile Defense',
    domain: 'combat_defense',
    description: 'دفاع، مهار یا سنگرگیری در برابر تیرهای کمان، سنگ‌انداز، زوبین سبک یا پرتابه‌های سبک دشمن.',
    tags: ['تیر', 'کمان', 'سنگ‌انداز', 'پرتابه', 'arrow', 'projectile', 'sling', 'ranged'],
  },
  {
    code: 'incoming_heavy_projectile',
    nameFa: 'مهار پرتابه‌های سنگین (منجنیق و زوبین بزرگ)',
    nameEn: 'Incoming Heavy Projectile Defense',
    domain: 'combat_defense',
    description: 'دفاع یا گریختن از سنگ‌های فلاخن‌های عظیم، پرتابه‌های منجنیق یا تیرهای سنگین دژکوب.',
    tags: ['منجنیق', 'سنگین', 'catapult', 'boulder', 'heavy_missile'],
  },
  {
    code: 'incoming_melee_slash_blunt',
    nameFa: 'دفع ضربات تن‌به‌تن تیغه و گرز',
    nameEn: 'Melee Slash & Blunt Defense',
    domain: 'combat_defense',
    description: 'مهار با سپر یا زره در برابر شمشیر، تبر، گرز و سلاح‌های سنگین نبرد نزدیک.',
    tags: ['شمشیر', 'تبر', 'گرز', 'تن‌به‌تن', 'melee', 'slash', 'blunt', 'sword'],
  },
  {
    code: 'incoming_predator_natural',
    nameFa: 'مهار حمله و جهش درندگان طبیعی',
    nameEn: 'Beast & Predator Defense',
    domain: 'combat_defense',
    description: 'دفاع در برابر جهش ناگهانی گرگ‌ها، نیش کفتارها، خزندگان نیزار و چنگال درندگان دشت.',
    tags: ['درنده', 'گرگ', 'جانور', 'کفتار', 'beast', 'predator', 'fangs', 'claws'],
  },
  {
    code: 'defensive_stance_idle',
    nameFa: 'موضع و آمادگی دفاعی (بدون حملهٔ فعال)',
    nameEn: 'Defensive Stance / Readiness',
    domain: 'combat_defense',
    description: 'گرفتن حالت دفاعی، بالا آوردن محتاطانهٔ سلاح یا سپر به عنوان پیش‌گیری و احتیاط بدون وقوع حملهٔ فعال.',
    tags: ['آمادگی', 'موضع', 'احتیاط', 'ایستادگی', 'stance', 'readiness', 'posture'],
  },
  {
    code: 'shield_bash_counter',
    nameFa: 'ضدحمله و کوبیدن سپر (Shield Bash)',
    nameEn: 'Shield Bash Counter',
    domain: 'combat_defense',
    description: 'کوبیدن لبه یا برآمدگی برنزی سپر به حریف برای برهم زدن تعادل و ایجاد فاصله.',
    tags: ['کوبیدن', 'سپر', 'bash', 'shield_bash', 'stagger'],
  },
  {
    code: 'parry_riposte',
    nameFa: 'رد کردن تیغه و پاسخ شمشیر (Parry)',
    nameEn: 'Parry & Riposte',
    domain: 'combat_defense',
    description: 'منحرف کردن ضربهٔ شمشیر مهاجم با لبهٔ تیغه و اجرای ضدحملهٔ سریع.',
    tags: ['رد_ضربه', 'انحراف', 'parry', 'riposte', 'counter'],
  },
  {
    code: 'dodge_evasion',
    nameFa: 'جاخالی و گریز سریع از ضربه',
    nameEn: 'Dodge & Evasion',
    domain: 'combat_defense',
    description: 'چرخش سریع، غلتیدن یا کنار کشیدن کالبد از مسیر ضربه یا پرتابه.',
    tags: ['جاخالی', 'گریز', 'غلتیدن', 'dodge', 'evasion', 'roll'],
  },
  {
    code: 'cover_interception',
    nameFa: 'سنگرگیری پشت موانع طبیعی و بارو',
    nameEn: 'Cover & Terrain Interception',
    domain: 'combat_defense',
    description: 'پناه گرفتن پشت دیواره‌های سنگی، جعبه‌های کاروان یا بشکه‌های اسکله.',
    tags: ['سنگر', 'پناه', 'دیوار', 'cover', 'barrier'],
  },
  {
    code: 'ambush_defense',
    nameFa: 'واکنش پدافندی به شبیخون و کمین',
    nameEn: 'Ambush Reaction & Defense',
    domain: 'combat_defense',
    description: 'تاب‌آوری در برابر حملهٔ غافلگیرانه در گردنه‌ها، شب‌های دشت یا کوچه‌های باریک پل.',
    tags: ['شبیخون', 'کمین', 'غافلگیری', 'ambush', 'surprise'],
  },

  // -------------------------------------------------------------
  // Combat Offense
  // -------------------------------------------------------------
  {
    code: 'melee_heavy_strike',
    nameFa: 'فرود ضربهٔ سنگین و خردکننده',
    nameEn: 'Heavy Melee Cleave',
    domain: 'combat_offense',
    description: 'وارد کردن ضربهٔ سهمگین با شمشیر سنگین، تبرزین یا گرز به زره یا موانع دشمن.',
    tags: ['ضربه_سنگین', 'خردکردن', 'cleave', 'heavy_strike'],
  },
  {
    code: 'melee_precision_thrust',
    nameFa: 'ضربهٔ دقیق و نفوذی (Thrust)',
    nameEn: 'Precision Thrust',
    domain: 'combat_offense',
    description: 'یافتن روزنه‌های زره و فرود آوردن نوک خنجر یا شمشیر به نقاط حیاتی حریف.',
    tags: ['نفوذی', 'خنجر', 'روزنه', 'thrust', 'pierce', 'finesse'],
  },
  {
    code: 'ranged_bow_snipe',
    nameFa: 'تیراندازی دوربرد با کمان',
    nameEn: 'Ranged Archery Precision',
    domain: 'combat_offense',
    description: 'نشانه‌گیری دقیق و رهاسازی تیر از فواصل دور به سوی اهداف متحرک یا ثابت.',
    tags: ['تیراندازی', 'کمان', 'هدف‌گیری', 'archery', 'bow', 'snipe'],
  },
  {
    code: 'thrown_weapon',
    nameFa: 'پرتاب خنجر، سنگ یا نیزه',
    nameEn: 'Thrown Weapon Attack',
    domain: 'combat_offense',
    description: 'پرتاب غافلگیرکنندهٔ اشیاء سبک، خنجرهای پرتابی یا سنگ‌انداز به سمت دشمن.',
    tags: ['پرتابی', 'خنجر_پرتابی', 'thrown', 'javelin'],
  },
  {
    code: 'unarmed_brawl',
    nameFa: 'مشت‌زنی و گلاویزی دست‌خالی',
    nameEn: 'Unarmed Brawl & Grapple',
    domain: 'combat_offense',
    description: 'درگیری فیزیکی بدون سلاح، قفل کردن مفاصل، سرنگون کردن یا مشت‌زنی در کافه‌ها و بارانداز.',
    tags: ['مشت', 'گلاویزی', 'دست_خالی', 'brawl', 'grapple', 'unarmed'],
  },

  // -------------------------------------------------------------
  // Social & Friction
  // -------------------------------------------------------------
  {
    code: 'social_bureaucratic_official',
    nameFa: 'تعامل و مذاکره با کاتبان و مأموران اداری',
    nameEn: 'Bureaucratic & Official Dealing',
    domain: 'social',
    description: 'مذاکره، توجیه اسناد، استناد به احکام و تعامل با کاتبان دیوان خراج، داروغه و قاضیان.',
    tags: ['کاتب', 'مأمور', 'دیوان', 'اسناد', 'مجوز', 'scribe', 'official', 'bureaucrat'],
  },
  {
    code: 'social_commercial_haggling',
    nameFa: 'چانه‌زنی تجاری و ارزیابی مسکوکات',
    nameEn: 'Commercial Bargaining & Trade',
    domain: 'social',
    description: 'تخفیف گرفتن از بازرگانان، چانه‌زنی بر سر کرایهٔ بلم یا تعیین عیار سکه‌ها با صرافان.',
    tags: ['چانه‌زنی', 'تخفیف', 'معامله', 'سکه', 'barter', 'haggle', 'trade'],
  },
  {
    code: 'social_interrogation_pressure',
    nameFa: 'بازجویی، تفتیش و اعمال فشار کلامی',
    nameEn: 'Interrogation & Verbal Pressure',
    domain: 'social',
    description: 'تحت فشار قرار دادن شاهدان یا دستگیرشدگان جهت کشف حقیقت، اعتراف یا افشای رازها.',
    tags: ['بازجویی', 'اعتراف', 'فشار', 'interrogate', 'pressure'],
  },
  {
    code: 'social_persuasion_empathy',
    nameFa: 'اقناع صمیمانه و جلب اعتماد عاطفی',
    nameEn: 'Persuasion & Diplomatic Empathy',
    domain: 'social',
    description: 'همراه کردن مخاطب، تسلی دادن به مسافران وحشت‌زده یا برقراری همدلی در بن‌بست‌های جمعی.',
    tags: ['اعتماد', 'همدلی', 'اقناع', 'persuade', 'empathy'],
  },
  {
    code: 'social_deception_bluff',
    nameFa: 'فریب، بلوف‌زنی و جعل هویت کلامی',
    nameEn: 'Deception & Bluff',
    domain: 'social',
    description: 'دروغ‌پردازی سنجیده، تظاهر به داشتن حکم دیوان یا انحراف توجه بازرسان دروازه.',
    tags: ['دروغ', 'بلوف', 'فریب', 'تظاهر', 'deceive', 'bluff', 'lie'],
  },
  {
    code: 'social_intimidation_menace',
    nameFa: 'ارعاب، تهدید و اعمال هیبت شخصیتی',
    nameEn: 'Intimidation & Menace',
    domain: 'social',
    description: 'عقب راندن گزمه‌های باج‌گیر، اوباش بارانداز یا باج‌خواهان از طریق تهدید صریح یا قدرت بدنی.',
    tags: ['ارعاب', 'تهدید', 'ترساندن', 'intimidate', 'threaten', 'menace'],
  },
  {
    code: 'social_underworld_cant',
    nameFa: 'اصطلاحات لاتی و شبکهٔ زیرزمینی بلم‌رانان',
    nameEn: 'Underworld Cant & Slang',
    domain: 'social',
    description: 'هم‌کلامی با زاغه‌نشینان پایاب، قاچاقچیان هور و درک رمزها و استعاره‌های محلی دزدان.',
    tags: ['قاچاقچی', 'لاتی', 'پایاب', 'رمز', 'underworld', 'smuggler', 'thieves_cant'],
  },

  // -------------------------------------------------------------
  // Wilderness & Survival
  // -------------------------------------------------------------
  {
    code: 'wilderness_caravan_handling',
    nameFa: 'تیمار و هدایت ستور بارکش (شتر و قاطر)',
    nameEn: 'Caravan & Pack Animal Handling',
    domain: 'wilderness',
    description: 'بستن بارهای سنگین، مهار شترهای رمیده، گره‌زدن طناب‌ها و آرام‌سازی چهارپایان در طوفان.',
    tags: ['شتر', 'قاطر', 'کاروان', 'مهاربند', 'camel', 'mule', 'pack_animal'],
  },
  {
    code: 'wilderness_celestial_navigation',
    nameFa: 'جهت‌یابی با ستارگان در شب‌های دشت',
    nameEn: 'Celestial Navigation',
    domain: 'wilderness',
    description: 'پیدا کردن مسیر در افق‌های بی‌نشانهٔ استپ هیرام از طریق رصد ستارهٔ قطبی و صورت‌های فلکی.',
    tags: ['ستارگان', 'جهت‌یابی', 'افق', 'stars', 'celestial', 'navigation'],
  },
  {
    code: 'survival_desert_heat_thirst',
    nameFa: 'تاب‌آوری در برابر گرمازدگی و عطش کویر',
    nameEn: 'Desert Heat & Thirst Survival',
    domain: 'wilderness',
    description: 'صرفه‌جویی در مصرف آب، مقاومت در برابر سراب و تاب‌آوری بدنی در ساعات اوج آفتاب سرخ.',
    tags: ['گرما', 'عطش', 'سراب', 'کویر', 'heat', 'thirst', 'desert', 'arid'],
  },
  {
    code: 'survival_cold_endurance',
    nameFa: 'تاب‌آوری در برابر سرمای منجمد کوهستان',
    nameEn: 'Cold & Blizzard Endurance',
    domain: 'wilderness',
    description: 'حفظ گرمای بدن در بادهای شبانهٔ ارژن، ممانعت از سرمازدگی و شب‌زنده‌داری در برفاب.',
    tags: ['سرما', 'یخ', 'بوران', 'کولاک', 'cold', 'blizzard', 'frost'],
  },
  {
    code: 'wilderness_tracking_foraging',
    nameFa: 'ردزنی در دشت و جمع‌آوری آذوقه',
    nameEn: 'Tracking & Foraging',
    domain: 'wilderness',
    description: 'دنبال کردن رد پای کاروان‌های گم‌شده یا حیوانات در خاک سرخ و پیدا کردن ریشه‌های خوراکی.',
    tags: ['ردزنی', 'ردپا', 'آذوقه', 'گیاهان', 'track', 'forage'],
  },
  {
    code: 'wilderness_climbing_traversal',
    nameFa: 'صعود از صخره‌ها و گذر از پرتگاه‌ها',
    nameEn: 'Rock Climbing & Cliff Traversal',
    domain: 'wilderness',
    description: 'بالا رفتن از پایه‌های لغزندهٔ پل، صعود از دیواره‌های گرانیتی ارگ یا عبور از شکاف‌های تنگ.',
    tags: ['صعود', 'صخره', 'پرتگاه', 'پایاب', 'climb', 'traversal', 'cliff'],
  },
  {
    code: 'wilderness_waterway_boating',
    nameFa: 'بلم‌رانی و هدایت قایق در مانداب و رودخانه',
    nameEn: 'Waterway Boating & Navigation',
    domain: 'wilderness',
    description: 'پاروزنی در جریان‌های خروشان زروانرود، عبور بلم از میان نیزارهای انبوه هور فراخ.',
    tags: ['بلم', 'قایق', 'رودخانه', 'نیزار', 'boat', 'waterway', 'river'],
  },

  // -------------------------------------------------------------
  // Stealth & Infiltration
  // -------------------------------------------------------------
  {
    code: 'stealth_shadow_movement',
    nameFa: 'حرکت بی‌صدا در سایه‌ها و تاریکی',
    nameEn: 'Silent Movement & Shadow Lurking',
    domain: 'stealth',
    description: 'رد شدن از کنار گشتی‌های مشعل‌دار، خزش روی الوارهای چوبی بدون ایجاد غژغژ صدا.',
    tags: ['سایه', 'بی‌صدا', 'تاریکی', 'خزش', 'sneak', 'shadow', 'silent'],
  },
  {
    code: 'stealth_lockpicking',
    nameFa: 'باز کردن قفل و شاه‌کلیدزنی',
    nameEn: 'Lockpicking & Mechanism Bypass',
    domain: 'stealth',
    description: 'دست‌کاری زبانهٔ قفل‌های برنزی، صندوق‌های انبار دیوان یا درگاه‌های بستهٔ بازارچه.',
    tags: ['قفل', 'کلید', 'صندوق', 'lockpick', 'pick_lock'],
  },
  {
    code: 'stealth_trap_disarm',
    nameFa: 'خنثی‌سازی تله‌ها و تله‌های سیمی',
    nameEn: 'Trap Detection & Disarming',
    domain: 'stealth',
    description: 'کشف سیم‌های پنهان، تیغه‌های فنری یا سنگ‌های پرتابی تعبیه‌شده در دخمه‌های باستانی.',
    tags: ['تله', 'خنثی‌سازی', 'سیم_تله', 'trap', 'disarm'],
  },
  {
    code: 'stealth_pickpocket_theft',
    nameFa: 'جیب‌بری و دزدی سبک‌دست',
    nameEn: 'Sleight of Hand & Pickpocketing',
    domain: 'stealth',
    description: 'برداشتن پنهانی کیسهٔ سکه، مهر کاتب یا طومار ترخیص کالا از کمربند مأموران.',
    tags: ['جیب‌بری', 'کیسه', 'سرقت', 'pickpocket', 'sleight_of_hand'],
  },

  // -------------------------------------------------------------
  // Investigation & Forensics
  // -------------------------------------------------------------
  {
    code: 'investigation_document_forgery',
    nameFa: 'بازرسی اسناد کهن و کشف جعل مهر',
    nameEn: 'Document Inspection & Forgery',
    domain: 'investigation',
    description: 'بررسی لایه‌های پوستین، خواندن متون محوشده، تشخیص امضای دروغین و مهر مخدوش دیوان.',
    tags: ['سند', 'طومار', 'جعل', 'مهر', 'ممیزی', 'document', 'forgery', 'inspect_seal'],
  },
  {
    code: 'investigation_hidden_compartment',
    nameFa: 'کشف درهای مخفی و زوایای پنهان سازه‌ها',
    nameEn: 'Hidden Compartment Search',
    domain: 'investigation',
    description: 'لمس درز سنگ‌ها، یافتن ضامن‌های پنهان زیر پایهٔ پل یا کشف جاساز کالاهای قاچاق.',
    tags: ['مخفی', 'جاساز', 'شکاف', 'hidden_door', 'compartment'],
  },
  {
    code: 'investigation_cipher_decoding',
    nameFa: 'رمزگشایی کتیبه‌ها و خطوط باستانی',
    nameEn: 'Ancient Cipher & Cryptography',
    domain: 'investigation',
    description: 'ترجمهٔ نشانه‌های پیش از عصر آرتاوان، رمزگشایی کدهای شبکهٔ بیداری روی دیوارها.',
    tags: ['کتیبه', 'رمز', 'باستانی', 'خط', 'cipher', 'cryptography', 'ancient_script'],
  },

  // -------------------------------------------------------------
  // Occult & Supernatural
  // -------------------------------------------------------------
  {
    code: 'occult_warding_dispelling',
    nameFa: 'باطل‌السحر و دفع انرژی‌های مفسد',
    nameEn: 'Mystic Warding & Dispelling',
    domain: 'occult',
    description: 'رسم نمادهای محافظ، شکستن طلسم‌های مانع و خاموش کردن امواج تباهی بنیادین.',
    tags: ['افسون', 'باطل_سحر', 'حصار', 'ward', 'dispel', 'occult'],
  },
  {
    code: 'occult_curse_resistance',
    nameFa: 'مقاومت اراده در برابر تسخیر ذهن و نفرین',
    nameEn: 'Psychic & Curse Resistance',
    domain: 'occult',
    description: 'حفظ تمامیت روان، مقاومت در برابر پچ‌پچ‌های تاریک نیستی و طلسم‌های اغواگر ذهنی.',
    tags: ['اراده', 'نفرین', 'تسخیر', 'curse', 'psychic', 'willpower'],
  },
  {
    code: 'occult_alchemy_concoction',
    nameFa: 'ترکیب معجون، تریاق و خاکسترهای کیمیاگری',
    nameEn: 'Alchemy & Tincture Brewing',
    domain: 'occult',
    description: 'جوشاندن صمغ‌های گیاهی، تقطیر پودرهای معدنی و ساخت پادزهر در برابر عفونت‌های لجن.',
    tags: ['معجون', 'تریاق', 'کیمیاگری', 'پادزهر', 'alchemy', 'potion', 'tincture'],
  },

  // -------------------------------------------------------------
  // Crafting & Trade
  // -------------------------------------------------------------
  {
    code: 'crafting_armor_smithing',
    nameFa: 'آهنگری، چکش‌کاری و ترمیم پلاک‌های زره',
    nameEn: 'Armor Repair & Blacksmithing',
    domain: 'crafting',
    description: 'صاف کردن فرورفتگی زره، پرچ کردن لولاهای فرسوده و تقویت لبه‌های کند تیغه‌ها.',
    tags: ['آهنگری', 'چکش', 'زره', 'smithing', 'forge', 'armor_repair'],
  },
  {
    code: 'crafting_masonry_stone',
    nameFa: 'سنگ‌تراشی و درک شالودهٔ سازه‌ها',
    nameEn: 'Stone Masonry & Structural Analysis',
    domain: 'crafting',
    description: 'تشخیص شکاف‌های بحرانی پایه‌ها، تخمین مقاومت طاق‌های پل و کار با گرانیت.',
    tags: ['سنگ‌تراشی', 'پایه', 'شالوده', 'masonry', 'stone'],
  },

  // -------------------------------------------------------------
  // General
  // -------------------------------------------------------------
  {
    code: 'athletic_feat_strength',
    nameFa: 'نمایش توان خام فیزیکی و جابه‌جایی بار',
    nameEn: 'Feat of Raw Strength',
    domain: 'general',
    description: 'بلند کردن تیرک‌های فروافتاده، نگه داشتن درگاه در حال ریزش یا کشیدن ارابهٔ به گل نشسته.',
    tags: ['نیرو', 'زور', 'بلند_کردن', 'strength', 'might', 'lift'],
  },
  {
    code: 'acrobatic_balance',
    nameFa: 'حفظ تعادل روی لبه‌های باریک و طناب‌ها',
    nameEn: 'Acrobatic Ledge Balance',
    domain: 'general',
    description: 'دویدن روی طاقچه‌های نمناک پل، حفظ تعادل در وزش بادهای شدید یا عبور از تیرک‌های لق.',
    tags: ['تعادل', 'لبه', 'طناب', 'balance', 'acrobatics', 'ledge'],
  },
  {
    code: 'first_aid_bandaging',
    nameFa: 'پانسمان زخم، آتل‌بندی و مهار خون‌ریزی',
    nameEn: 'First Aid & Bandaging',
    domain: 'general',
    description: 'بستن پارچه بر زخم‌های باز، ضدعفونی سطحی با الکل یا داغ کردن جای نیش گزندگان.',
    tags: ['پانسمان', 'درمان', 'زخم', 'first_aid', 'bandage', 'heal'],
  },
];

export async function seedActionCategories() {
  console.log(`🚀 Seeding ${INITIAL_ACTION_CATEGORIES.length} Action Categories into PostgreSQL database...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const cat of INITIAL_ACTION_CATEGORIES) {
    const existing = await prisma.actionCategory.findUnique({
      where: { code: cat.code },
    });

    if (existing) {
      await prisma.actionCategory.update({
        where: { code: cat.code },
        data: {
          nameFa: cat.nameFa,
          nameEn: cat.nameEn,
          domain: cat.domain,
          description: cat.description,
          tags: cat.tags,
          isSystem: true,
        },
      });
      updatedCount++;
    } else {
      await prisma.actionCategory.create({
        data: {
          code: cat.code,
          nameFa: cat.nameFa,
          nameEn: cat.nameEn,
          domain: cat.domain,
          description: cat.description,
          tags: cat.tags,
          isSystem: true,
        },
      });
      createdCount++;
    }
  }

  console.log(`✅ Action Categories seeding complete: ${createdCount} created, ${updatedCount} updated.`);
}

// Allow standalone execution via ts-node / npx tsx
if (require.main === module) {
  seedActionCategories()
    .catch((err) => {
      console.error('❌ Failed to seed action categories:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
