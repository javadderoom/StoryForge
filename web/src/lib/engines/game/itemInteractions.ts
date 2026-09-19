import { PlayerState } from '@/lib/types/gameplay';
import { GameItem } from '@/lib/types/rpg';
import { WorldArtifact } from '@/lib/types/world';

export interface ItemInteractionProfile {
  itemId: string;
  name: string;
  slot: string;
  slotLabel: string;
  isPermanent: boolean;
  primaryPurpose: string;
  validInteractions: string[];
  forbiddenMisuses: string[];
  passiveBonus?: {
    value: number;
    triggerKeywords: string[];
    descriptionEn: string;
    descriptionFa: string;
  };
}

/**
 * Builds a systematic interaction profile for an equipped item or artifact.
 * Encodes primary purpose, authentic tactical uses, forbidden misuses (anti-patterns),
 * and situational mechanical passive bonuses.
 */
export function buildItemInteractionProfile(
  itemRef: string | GameItem,
  artifactDef?: Partial<WorldArtifact>,
  isEnglish: boolean = false
): ItemInteractionProfile {
  const itemObj: Partial<GameItem> | undefined =
    typeof itemRef === 'object' ? itemRef : undefined;

  const itemId = itemObj?.id || artifactDef?.id || (typeof itemRef === 'string' ? itemRef : 'item');
  const name = itemObj?.name || artifactDef?.name || itemId;
  const slot = (artifactDef?.slot || (itemObj as any)?.slot || itemObj?.type || 'relic') as string;
  const desc = artifactDef?.description || itemObj?.description || '';
  const powers: string[] = artifactDef?.powers || [];
  const isPermanent = itemObj?.isConsumable === false || slot === 'relic' || slot === 'armor' || slot === 'shield' || slot === 'main_hand' || slot === 'two_handed';

  const combinedText = `${name} ${slot} ${desc} ${powers.join(' ')}`.toLowerCase();

  const slotLabelsEn: Record<string, string> = {
    main_hand: 'Main Hand Weapon',
    two_handed: 'Two-Handed Heavy Weapon',
    off_hand: 'Off Hand / Shield',
    shield: 'Defensive Shield',
    armor: 'Body Armor',
    relic: 'Equipped Relic / Talisman',
  };

  const slotLabelsFa: Record<string, string> = {
    main_hand: 'سلاح دست اصلی',
    two_handed: 'سلاح سنگین دودستی',
    off_hand: 'دست فرعی / سپر',
    shield: 'سپر پدافندی',
    armor: 'زره و بالاپوش',
    relic: 'یادگار / طلسم متصل',
  };

  const slotLabel = isEnglish
    ? slotLabelsEn[slot] || slot
    : slotLabelsFa[slot] || slot;

  let primaryPurpose = '';
  const validInteractions: string[] = [];
  const forbiddenMisuses: string[] = [];
  let passiveBonus: ItemInteractionProfile['passiveBonus'] | undefined;

  // 1. Relics & Talismans
  if (slot === 'relic' || /مهره|طلسم|تسبیح|عینک|آویز|relic|charm|talisman|amulet|bead/.test(combinedText)) {
    forbiddenMisuses.push(
      isEnglish
        ? 'NEVER throw or toss as a disposable diversion pebble or distraction stone'
        : 'هرگز به عنوان سنگریزه برای پرتاب و انحراف حواس یا جلب توجه دشمن تلف نشود',
      isEnglish
        ? 'NEVER use as an idle conversational fidget prop while speaking'
        : 'هرگز به عنوان بازیچهٔ بی‌هدف یا فیجت در حین گفت‌وگو دست‌مالی و سبک شمرده نشود',
      isEnglish
        ? 'NEVER discard, destroy, or offer for barter as mundane cheap junk'
        : 'هرگز به عنوان اشیاء بی‌ارزش یا یک‌بارمصرف معامله یا دور انداخته نشود'
    );

    // Desert survival / thirst / mirage warding (e.g. مهره نمک فیروزه)
    if (/عطش|سراب|کویر|دشت|thirst|mirage|desert/.test(combinedText)) {
      primaryPurpose = isEnglish
        ? 'Arid waste survival, warding off extreme dehydration, and dispelling optical mirages'
        : 'بقا در دشت و کویر، مهار عطش طاقت‌فرسا و باطل‌کنندهٔ توهمات و سراب‌های بیابانی';

      validInteractions.push(
        isEnglish
          ? 'Enduring prolonged treks across arid expanses without suffering heat exhaustion or dehydration'
          : 'مقاومت در برابر تشنگی شدید و تابش طاقت‌فرسای آفتاب در پیمایش‌های طولانی کویری',
        isEnglish
          ? 'Dispelling optical illusions, heat mirages, and phantom paths in desert badlands'
          : 'باطل کردن فریب‌های بینایی، سراب‌های فریبنده و راه‌های انحرافی در شن‌زارها',
        isEnglish
          ? 'Grounding the protagonist’s willpower and equilibrium when traversing scorching salt flats'
          : 'تثبیت تمرکز و ارادهٔ قهرمان هنگام عبور از شوره‌زارهای تفتیده'
      );

      passiveBonus = {
        value: 3,
        triggerKeywords: ['عطش', 'تشنگی', 'سراب', 'گرما', 'کویر', 'دشت', 'بیابان', 'thirst', 'mirage', 'heat', 'desert'],
        descriptionEn: '+3 Survival & Willpower bonus against desert heat, thirst, and mirages',
        descriptionFa: '+3 پاداش بقا و تمرکز در برابر گرمازدگی، عطش و سراب‌های کویر',
      };
    }
    // Scrutiny / Lenses / Reading (e.g. عینک عدسی‌دار)
    else if (/عینک|عدسی|شیشه|طومار|مهر|خواندن|lens|spectacle|magnif|parchment/.test(combinedText)) {
      primaryPurpose = isEnglish
        ? 'Forensic document examination, deciphering faded archaic text, and detecting forged administrative stamps'
        : 'بازرسی موشکافانهٔ اسناد، خواندن خطوط کهن و کشف مهرهای مخدوش یا جعلی دیوان';

      validInteractions.push(
        isEnglish
          ? 'Deciphering minute marginalia, secret watermark ciphers, or eroded wax seals'
          : 'خواندن یادداشت‌های ریز، رمزهای پنهان در بافت طومارها یا مهرهای مخدوش',
        isEnglish
          ? 'Detecting fraudulent signatures, forged cargo manifests, or doctored bureaucracy permits'
          : 'تشخیص امضاهای جعلی، بارنامه‌های دست‌کاری‌شده و جوازهای ساختگی',
        isEnglish
          ? 'Scrutinizing masonry, door jambs, or stone thresholds for hair-thin concealed levers'
          : 'بررسی موشکافانهٔ درگاه‌های سنگی و شکاف دیوارها جهت یافتن زبانه یا نشانه‌های پنهان'
      );

      passiveBonus = {
        value: 2,
        triggerKeywords: ['بررسی', 'سند', 'طومار', 'مهر', 'خط', 'کاتب', 'بازرسی', 'نقش', 'inspect', 'document', 'seal', 'parchment', 'examine', 'clue'],
        descriptionEn: '+2 Scrutiny bonus when inspecting documents, seals, and hidden mechanisms',
        descriptionFa: '+2 پاداش بازرسی و کشف جعل و نشانه‌های پنهان در اسناد و سازه‌ها',
      };
    }
    // Divination / Meditation / Prayer beads (e.g. تسبیح چوبی، آویز سنگی)
    else if (/تسبیح|آویز|شمارش|طالع|پیش‌گو|ذکر|bead|prayer|oracle|divin/.test(combinedText)) {
      primaryPurpose = isEnglish
        ? 'Mental centering, chronometric rhythm, and attuning to mystic resonances'
        : 'تمرکز ذهنی، گاه‌شماری و حفظ آرامش روان در برابر اضطراب و هراس';

      validInteractions.push(
        isEnglish
          ? 'Centering mental resolve to resist dread, confusion, or hostile psychic pressure'
          : 'حفظ ثبات روان و تمرکز اراده در مواجهه با وحشت یا فشار روانی محیط',
        isEnglish
          ? 'Tracking temporal cadences and celestial planetary alignments'
          : 'محاسبهٔ چرخه‌های زمانی و نشانه‌های طالع در شب‌های بیابان'
      );

      passiveBonus = {
        value: 2,
        triggerKeywords: ['تمرکز', 'اراده', 'طالع', 'زمان', 'شمارش', 'focus', 'resolve', 'oracle', 'divination'],
        descriptionEn: '+2 Mental resolve and divination attunement bonus',
        descriptionFa: '+2 پاداش تمرکز ذهنی و اراده در برابر فشارهای روانی',
      };
    } else {
      primaryPurpose = isEnglish
        ? 'Anchoring specialized personal capabilities and narrative identity'
        : 'تثبیت قابلیت‌های ویژهٔ هویتی و یادگاری';
      if (powers.length > 0) {
        validInteractions.push(...powers);
      } else {
        validInteractions.push(
          isEnglish
            ? 'Channeling the authentic lore and powers of the artifact'
            : 'به‌کارگیری اثر و قابلیت مندرج در پیشینهٔ دست‌سازه'
        );
      }
    }
  }
  // 2. Defensive Shields
  else if (slot === 'shield' || slot === 'off_hand' || /سپر|shield|buckler/.test(combinedText)) {
    primaryPurpose = isEnglish
      ? 'Kinetic physical protection, deflecting missile volleys, and absorbing heavy predatory impacts'
      : 'پدافند فیزیکی فعال، مهار پرتابه‌ها و سد کردن ضربات سنگین دشمن و درندگان';

    validInteractions.push(
      isEnglish
        ? 'Bracing behind the shield to intercept incoming arrow volleys, slingstones, and ranged projectiles'
        : 'سنگر گرفتن پشت سپر جهت مهار تیرهای کمان، سنگ‌اندازها و پرتابه‌ها',
      isEnglish
        ? 'Deflecting or absorbing the sudden pounce, fangs, or crushing weapon strikes of adversaries'
        : 'دفع یا جذب جهش ناگهانی درندگان، نیش خزندگان یا فرود شمشیر و گرز مهاجمان',
      isEnglish
        ? 'Executing a forceful shield-bash to throw adversaries off balance or create tactical breathing room'
        : 'کوبیدن لبه یا بدنهٔ سپر (Shield Bash) جهت برهم زدن تعادل حریف یا ایجاد فضا برای گریز'
    );

    forbiddenMisuses.push(
      isEnglish
        ? 'NEVER leave the shield idle or unbraced during an active armed ambush or projectile volley'
        : 'هرگز در هنگام باران تیر یا کمین مسلحانه، سپر را بی‌استفاده و آویزان رها نکن',
      isEnglish
        ? 'NEVER throw or discard the shield in the midst of open combat'
        : 'هرگز سپر را در میانهٔ درگیری مسلحانه دور نینداز'
    );

    passiveBonus = {
      value: 3,
      triggerKeywords: ['دفاع', 'سپر', 'تیر', 'پرتابه', 'مهار', 'پناه', 'دفع', 'سنگر', 'defend', 'defense', 'shield', 'block', 'parry', 'arrow', 'projectile'],
      descriptionEn: '+3 Physical Defense Bonus against incoming attacks and missile volleys',
      descriptionFa: '+3 پاداش دفاع فیزیکی با سپر در برابر پرتابه‌ها و ضربات',
    };
  }
  // 3. Armor
  else if (slot === 'armor' || /زره|جوشن|کلاه‌خود|نیم‌تنه|armor|cuirass|helm|leather/.test(combinedText)) {
    primaryPurpose = isEnglish
      ? 'Physical body protection, environmental insulation, and mitigating superficial injury'
      : 'محافظت فیزیکی از بدن، مهار خراش‌ها و عایق در برابر رطوبت لجن و نمک دشت';

    validInteractions.push(
      isEnglish
        ? 'Absorbing glancing blade cuts, abrasive thorn scratches, and harsh weather exposure'
        : 'کاهش اثر خراش‌های سطحی تیغ، تیغه‌های گیاهی و هجوم باد و گردوغبار',
      isEnglish
        ? 'Maneuvering stealthily through wetlands or sand dunes without alerting nearby sentries'
        : 'حرکت چابک و بی‌صدا در میان نیزارها و لجن‌زار بدون برانگیختن سوءظن نگهبانان'
    );

    forbiddenMisuses.push(
      isEnglish
        ? 'NEVER refer to leather gear as absurd pseudo-terms like "armored leather" (describe specific cuirass/vambraces)'
        : 'هرگز از ترکیبات ترجمه‌زده مانند «چرم زره‌پوش» استفاده نکن (از کلماتی چون جوشن چرمی، زره چرمی، نیم‌تنه استفاده کن)'
    );
  }
  // 4. Heavy Two-Handed Weapons
  else if (slot === 'two_handed' || /تبرزین|تبر|گرز|two_handed|greataxe|greatsword|polearm/.test(combinedText)) {
    primaryPurpose = isEnglish
      ? 'Heavy kinetic leverage, breaching fortified barriers, and delivering wide devastating cleaves'
      : 'اعمال نیروی سهمگین فیزیکی، خرد کردن موانع چوبی و وارد آوردن ضربات سنگین به درندگان عظیم';

    validInteractions.push(
      isEnglish
        ? 'Splintering barricades, wooden gates, and overturned caravan wagon axles'
        : 'خرد کردن درگاه‌های تخته‌ای، موانع چوبی و الوارهای مسدودکننده',
      isEnglish
        ? 'Delivering wide sweeping strikes to ward off packs of predators or armored adversaries'
        : 'فرود آوردن ضربات قاطع و سنگین برای دفع هجوم هیولاها یا مهاجمان زره‌پوش'
    );

    forbiddenMisuses.push(
      isEnglish
        ? 'NEVER permit an off-hand shield or second weapon while wielding a two-handed weapon'
        : 'هنگام استفاده از سلاح دودستی، استفادهٔ هم‌زمان از سپر یا سلاح دوم غیرممکن است'
    );
  }
  // 5. Main Hand Weapons & Daggers
  else {
    primaryPurpose = isEnglish
      ? 'Close-quarters martial defense, precision strikes, and tactical cutting'
      : 'دفاع نزدیک، حملات دقیق تاکتیکی و بریدن موانع محیطی';

    validInteractions.push(
      isEnglish
        ? 'Targeting vulnerabilities in adversary guard or grappling in tight terrain'
        : 'فرود آوردن ضربات دقیق در نقاط آسیب‌پذیر یا درگیری تن‌به‌تن در پایاب و نیزار',
      isEnglish
        ? 'Silently severing cords, reed bundles, ropes, or rigging'
        : 'بریدن بی‌صدای طناب‌ها، ریشه‌ها و ساقه‌های ضخیم نیزار جهت ایجاد معبر'
    );
  }

  // Include any specific authored powers if defined
  if (powers.length > 0) {
    for (const pow of powers) {
      if (!validInteractions.includes(pow)) {
        validInteractions.unshift(pow);
      }
    }
  }

  return {
    itemId,
    name,
    slot,
    slotLabel,
    isPermanent,
    primaryPurpose,
    validInteractions,
    forbiddenMisuses,
    passiveBonus,
  };
}

/**
 * Builds interaction profiles for all actively equipped items of a player.
 */
export function buildEquippedItemProfiles(
  playerState?: PlayerState,
  story?: any,
  isEnglish: boolean = false
): ItemInteractionProfile[] {
  if (!playerState?.equipment) return [];

  const artifacts: WorldArtifact[] = story?.worldBible?.artifacts || [];
  const inventory: GameItem[] = playerState.inventory || [];
  const profiles: ItemInteractionProfile[] = [];

  for (const [slotKey, itemRef] of Object.entries(playerState.equipment)) {
    if (!itemRef) continue;

    const invItem = inventory.find(
      (i) => i.id === itemRef || i.name === itemRef
    );
    const art = artifacts.find(
      (a) => a.id === itemRef || a.name === itemRef
    );

    const profile = buildItemInteractionProfile(
      invItem || itemRef,
      art,
      isEnglish
    );

    // Ensure slot name reflects actual equipment slot if not set
    if (!profile.slot || profile.slot === 'relic') {
      profile.slot = slotKey;
    }

    profiles.push(profile);
  }

  return profiles;
}

/**
 * Formats a list of ItemInteractionProfiles into a dense, clean catalog
 * ready for injection into LLM system or user prompts.
 */
export function formatItemInteractionsForPrompt(
  profiles: ItemInteractionProfile[],
  isEnglish: boolean = false
): string {
  if (profiles.length === 0) return '';

  const header = isEnglish
    ? '[EQUIPPED GEAR & ARTIFACT INTERACTION CATALOGUE]'
    : '[کاتالوگ تعاملات تاکتیکی تجهیزات و عتیقه‌های همراه / EQUIPPED GEAR INTERACTIONS]';

  const blocks = profiles.map((p) => {
    const lines: string[] = [];
    if (isEnglish) {
      lines.push(`• "${p.name}" (${p.slotLabel}):`);
      lines.push(`  - Primary Purpose: ${p.primaryPurpose}`);
      if (p.validInteractions.length > 0) {
        lines.push(`  - Valid Tactical Interactions:\n    * ${p.validInteractions.join('\n    * ')}`);
      }
      if (p.passiveBonus) {
        lines.push(`  - Mechanical Passive Effect: ${p.passiveBonus.descriptionEn}`);
      }
      if (p.forbiddenMisuses.length > 0) {
        lines.push(`  - STRICTLY FORBIDDEN MISUSES:\n    * ${p.forbiddenMisuses.join('\n    * ')}`);
      }
    } else {
      lines.push(`• «${p.name}» (${p.slotLabel}):`);
      lines.push(`  - کارکرد و ماهیت اصلی: ${p.primaryPurpose}`);
      if (p.validInteractions.length > 0) {
        lines.push(`  - تعاملات معتبر تاکتیکی:\n    * ${p.validInteractions.join('\n    * ')}`);
      }
      if (p.passiveBonus) {
        lines.push(`  - اثر مکانیکی پدافندی/پایدار: ${p.passiveBonus.descriptionFa}`);
      }
      if (p.forbiddenMisuses.length > 0) {
        lines.push(`  - ممنوعیت‌های قطعی در گزینه‌ها و روایت:\n    * ${p.forbiddenMisuses.join('\n    * ')}`);
      }
    }
    return lines.join('\n');
  });

  return `${header}\n${blocks.join('\n\n')}`;
}
