import { NextRequest, NextResponse } from 'next/server';

interface GenerateRequest {
  type:
    | 'location'
    | 'npc'
    | 'artifact'
    | 'creature'
    | 'deity'
    | 'timeline_event'
    | 'world_law';
  prompt?: string;
  themeContext?: string;
  isPersian?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { type, prompt = '', themeContext = '', isPersian = true } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const systemPrompt = `You are the World-Building Co-Pilot for StoryForge, an advanced Interactive Fiction RPG engine.
Generate a high-quality JSON object for a ${type} within a dark fantasy / grim-arcane setting.
${isPersian ? 'Output all narrative text, names, descriptions in Persian (Farsi).' : 'Output in English.'}
Theme context: ${themeContext || 'Dark basalt mountain fortress, political tension, forbidden alchemy'}
User guidance: ${prompt || 'Create something rich with atmospheric depth and literary gravitas.'}
Strictly output a valid JSON object matching the requested schema. Do not enclose in markdown blocks if possible, or return clean JSON.`;

        let schemaInstruction = '';
        if (type === 'location') {
          schemaInstruction = `Schema: { "name": string, "region": string, "description": string, "dangerLevel": 1|2|3|4|5, "atmosphere": string, "specialRules": string[] }`;
        } else if (type === 'npc') {
          schemaInstruction = `Schema: { "name": string, "title": string, "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number }`;
        } else if (type === 'artifact') {
          schemaInstruction = `Schema: { "name": string, "title": string, "originEra": string, "rarity": "rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "secretLore": string }`;
        } else if (type === 'creature') {
          schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic", "dangerLevel": 1|2|3|4|5, "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string }`;
        } else if (type === 'deity') {
          schemaInstruction = `Schema: { "name": string, "title": string, "domain": "light"|"secrets"|"death"|"war"|"nature"|"chaos"|"forge", "sacredSymbol": string, "coreDogma": string, "taboos": string[], "divineBlessings": string[] }`;
        } else if (type === 'timeline_event') {
          schemaInstruction = `Schema: { "yearOrEra": string, "title": string, "summary": string, "significance": string, "knownByPublic": boolean, "eraCategory": "ancient"|"war"|"reign"|"present" }`;
        } else if (type === 'world_law') {
          schemaInstruction = `Schema: { "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }`;
        }

        const fullPrompt = `${systemPrompt}\n${schemaInstruction}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.8,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return NextResponse.json({ success: true, data: parsed, isAiGenerated: true });
          }
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to procedural engine:', err);
      }
    }

    // Procedural Fallback Generator
    const timestamp = Date.now().toString(36);
    let fallbackData: any = null;

    if (type === 'location') {
      fallbackData = isPersian
        ? {
            id: `loc_${timestamp}`,
            name: 'آزمایشگاه متروک کیمیاگران اخگر',
            region: 'اعماق دخمه‌های زیرین',
            description: 'کارگاهی فرورفته در غبار و شیشه‌های شکسته معجون، که لوله‌های برنجی آن هنوز بخار فسفری ساطع می‌کنند.',
            dangerLevel: 3,
            atmosphere: 'بوی تند گوگرد، چککه‌های مداوم آب اسیدی و درخشش سبز محو خزه‌ها.',
            specialRules: ['کاهش مقاومت در برابر سموم به دلیل گازهای راکد'],
            connectedLocationIds: [],
          }
        : {
            id: `loc_${timestamp}`,
            name: 'Forgotten Ash Alchemist Den',
            region: 'Subterranean Catacombs',
            description: 'A subterranean workshop cluttered with shattered alembics and bubbling phosphorus condensation pipes.',
            dangerLevel: 3,
            atmosphere: 'Pungent brimstone vapors, eerie emerald moss bioluminescence.',
            specialRules: ['Corrosive air requires fortitude checks during combat'],
            connectedLocationIds: [],
          };
    } else if (type === 'npc') {
      fallbackData = isPersian
        ? {
            id: `npc_${timestamp}`,
            name: 'استاد الیاس کاتب',
            title: 'بایگان اسناد سوخته دربار',
            currentLocationId: 'loc_dungeon_cell_fa',
            personalityTraits: ['بدگمان', 'دانشور', 'وفادار به حقیقت'],
            speechStyle: 'صدایی لرزان اما موشکافانه. همواره دست روی طومارهای مخفی‌اش نگه می‌دارد.',
            goals: ['حفظ آخرین رونوشت از پیمان‌نامه اژدهایان', 'گریز از بازجویان گارد نقره‌ای'],
            secrets: [
              {
                id: `sec_${timestamp}`,
                description: 'الیاس رونوشتی از وصیت‌نامه پادشاه مقتول را در عطف کتابی قطور پنهان کرده است.',
                requiredTrustLevel: 25,
                revealed: false,
              },
            ],
            initialTrust: 0,
          }
        : {
            id: `npc_${timestamp}`,
            name: 'Archivist Elias',
            title: 'Keeper of the Scorched Annals',
            currentLocationId: 'loc_dungeon_cell',
            personalityTraits: ['Paranoid', 'Scholarly', 'Devoted to Truth'],
            speechStyle: 'Whispered, analytical tone, constantly clutching his satchel of scrolls.',
            goals: ['Preserve the unexpurgated treaties of the dragon reign', 'Evade royal inquisitors'],
            secrets: [
              {
                id: `sec_${timestamp}`,
                description: 'Elias concealed the authentic royal succession codex inside the cathedral crypt wall.',
                requiredTrustLevel: 25,
                revealed: false,
              },
            ],
            initialTrust: 0,
          };
    } else if (type === 'artifact') {
      fallbackData = isPersian
        ? {
            id: `art_${timestamp}`,
            name: 'بلور چشم غیب‌بین',
            title: 'یادگار پیشگویان محفل ستاره سیاه',
            originEra: '۱۲۰ سال پیش',
            rarity: 'epic',
            description: 'گویی از یاقوت کبود تیره که در تاریکی محض، راه‌های مخفی و نیت درونی افراد را به شکل خطوط نوری آشکار می‌سازد.',
            powers: ['کشف درهای مخفی و تله‌های پنهان', '+3 به مهارت شهود و خرد'],
            curseOrCost: 'خیره شدن بیش از حد به بلور موجب کابوس‌های تکرارشونده درباره سقوط جهان می‌شود.',
            attunementRules: 'نیازمند خرد ۱۲ یا هوش ۱۰',
            currentHolderType: 'unknown',
            currentHolderId: 'unknown',
            secretLore: 'این بلور از چشم منجمد یک ساحر باستانی تراشیده شده است.',
          }
        : {
            id: `art_${timestamp}`,
            name: 'The Oculus of the Void Watcher',
            title: 'Relic of the Eclipse Seers',
            originEra: '120 Years Ago',
            rarity: 'epic',
            description: 'A dark sapphire sphere that illuminates hidden doors and latent murderous intent as ethereal ley-lines.',
            powers: ['Reveals secret passageways and concealed traps', '+3 to Insight and Perception'],
            curseOrCost: 'Prolonged gaze induces apocalyptic visions during sleep.',
            attunementRules: 'Requires Wisdom 12 or Intellect 10',
            currentHolderType: 'unknown',
            currentHolderId: 'unknown',
            secretLore: 'Carved from the calcified eye of an ancient celestial augur.',
          };
    } else if (type === 'creature') {
      fallbackData = isPersian
        ? {
            id: `creature_${timestamp}`,
            name: 'عنکبوت‌های شیشه‌پشت دخمه',
            speciesCategory: 'monstrosity',
            dangerLevel: 3,
            habitatLocationIds: [],
            behavioralTactics: 'تنیدن تارهای شفاف بر روی دهانه‌های راهرو و تزریق زهر فلج‌کننده به مفاصل مهاجمان.',
            weaknesses: ['آتش مستقیم مشعل و گرما', 'ضربات سنگین و کوبشی پتک'],
            resistances: ['مقاومت بالا در برابر زهر و اسید', 'استتار در تاریکی'],
            harvestableLoot: [
              { itemId: `loot_${timestamp}_1`, name: 'ابریشم نسوز عنکبوت', dropRate: '۷۵٪' },
              { itemId: `loot_${timestamp}_2`, name: 'کیسه زهر فلج‌کننده', dropRate: '۴۰٪' },
            ],
            loreDescription: 'بندپایانی غول‌آسا با پوشش محافظ شیشه‌ای که در دهلیزهای غرقاب آبراهه‌ها لانه می‌گزینند.',
          }
        : {
            id: `creature_${timestamp}`,
            name: 'Vitreous Crypt Arachnids',
            speciesCategory: 'monstrosity',
            dangerLevel: 3,
            habitatLocationIds: [],
            behavioralTactics: 'Spins translucent paralyzing webs across choke points and drops from arches.',
            weaknesses: ['Open torch fire and blunt crushing impacts'],
            resistances: ['Immunity to venom and acid', 'Uncanny shadow camouflage'],
            harvestableLoot: [
              { itemId: `loot_${timestamp}_1`, name: 'Fire-Resistant Silk Strand', dropRate: '75%' },
              { itemId: `loot_${timestamp}_2`, name: 'Paralytic Venom Gland', dropRate: '40%' },
            ],
            loreDescription: 'Predatory cavern arachnids with translucent chitin carapace nourished on alchemical runoffs.',
          };
    } else if (type === 'deity') {
      fallbackData = isPersian
        ? {
            id: `deity_${timestamp}`,
            name: 'ایزدبانوی شعله‌های دگرگون‌ساز',
            title: 'بانوی کوره ابدی و حافظ کیمیاگران',
            domain: 'forge',
            sacredSymbol: 'سندان سنگی مشتعل با سه اخگر زرین',
            coreDogma: 'ماده در جهان خام است؛ تنها از طریق حرارت، آزمایش و اراده می‌توان به جوهر کمال دست یافت.',
            taboos: ['خاموش کردن کوره‌های باستانی', 'آلوده کردن فلز مقدس با طلای تقلبی'],
            divineBlessings: ['مقاومت در برابر گرما و سوختگی', 'مهارت در ساخت سلاح‌ها و اکسیرهای کیمیاگری'],
            affiliatedFactionIds: [],
            holyLocationIds: [],
          }
        : {
            id: `deity_${timestamp}`,
            name: 'The Sovereign of Transmuting Fire',
            title: 'Lady of the Eternal Crucible',
            domain: 'forge',
            sacredSymbol: 'Blazing stone anvil emblazoned with three golden embers',
            coreDogma: 'All matter is crude potential; only through heat, trial, and unwavering discipline is the true spirit forged.',
            taboos: ['Quenching sacred blast furnaces', 'Debasing holy alloys with forged lead'],
            divineBlessings: ['Thermal damage resistance', 'Mastery of metallurgical alchemy'],
            affiliatedFactionIds: [],
            holyLocationIds: [],
          };
    } else if (type === 'timeline_event') {
      fallbackData = isPersian
        ? {
            id: `evt_${timestamp}`,
            name: 'خیزش کیمیاگران و تسخیر برج گوگرد',
            yearOrEra: '۸۵ سال پیش',
            title: 'خیزش کیمیاگران و تسخیر برج گوگرد',
            summary: 'گروهی از کیمیاگران معترض به احتکار مواد جادویی، برج آزمایشگاه مرکزی را به تصرف درآوردند.',
            significance: 'موجب بنیان‌گذاری قوانین ممنوعیت تجارت آزاد گوگرد جادویی شد.',
            knownByPublic: true,
            eraCategory: 'war',
          }
        : {
            id: `evt_${timestamp}`,
            name: 'The Alchemical Uprising of the Sulfur Spire',
            yearOrEra: '85 Years Ago',
            title: 'The Alchemical Uprising of the Sulfur Spire',
            summary: 'Rebellious apothecaries seized the central sulfur crucibles in defiance of imperial monopoly taxes.',
            significance: 'Led to the royal decree forbidding private importation of catalytic reagents.',
            knownByPublic: true,
            eraCategory: 'war',
          };
    } else if (type === 'world_law') {
      fallbackData = isPersian
        ? {
            id: `law_${timestamp}`,
            rule: 'جادوی خون همواره بهایی معادل از روح مصرف‌کننده می‌گیرد.',
            category: 'magic',
            description: 'هیچ طلسم خونی بدون تسلیم بخشی از نیروی حیاتی یا زوال حافظه فعال نمی‌شود.',
            isImmutable: true,
          }
        : {
            id: `law_${timestamp}`,
            rule: 'Blood thaumaturgy inexorably demands an equal tithe of the caster\'s soul.',
            category: 'magic',
            description: 'No crimson rite can be channeled without permanent vitality drain or memory decay.',
            isImmutable: true,
          };
    }

    return NextResponse.json({ success: true, data: fallbackData, isAiGenerated: false });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to generate lore content' },
      { status: 500 }
    );
  }
}
