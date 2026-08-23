import { NextRequest, NextResponse } from 'next/server';
import { generateStructuredJson } from '@/lib/ai/geminiClient';
import {
  GenesisWorldSchema,
  ContradictionAuditReportSchema,
  buildGenesisUserPrompt,
  buildAuditUserPrompt,
  GENESIS_SYSTEM_DIRECTIVES,
  AUDIT_SYSTEM_DIRECTIVES,
  GenesisWorldData,
  ContradictionFinding,
} from '@/lib/engines/world/GenesisSchemas';
import { LoreAuditor } from '@/lib/engines/world/LoreAuditor';
import { WorldBible } from '@/lib/types/world';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

interface GenerateRequest {
  type:
    | 'world'
    | 'location'
    | 'npc'
    | 'faction'
    | 'artifact'
    | 'creature'
    | 'deity'
    | 'timeline_event'
    | 'world_law'
    | 'scene'
    | 'genesis'
    | 'audit_world';
  prompt?: string;
  themeContext?: string;
  customSystemPrompt?: string;
  taskType?: 'world' | 'scene' | 'default';
  isPersian?: boolean;
  worldBible?: WorldBible;
  // Author-controlled generation constraints (the "type" they want the AI to honor)
  rarity?: 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  speciesCategory?: 'beast' | 'monstrosity' | 'undead' | 'elemental' | 'flora' | 'draconic';
  domain?: 'light' | 'secrets' | 'death' | 'war' | 'nature' | 'chaos' | 'forge';
  category?: 'magic' | 'physics' | 'society' | 'divine';
  eraCategory?: 'ancient' | 'war' | 'reign' | 'cataclysm' | 'present';
  dangerLevel?: 1 | 2 | 3 | 4 | 5;
  npcRole?: string;
  worldContext?: string;
  anchor?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const {
      type,
      prompt = '',
      themeContext = '',
      customSystemPrompt,
      taskType = (type === 'world' ? 'world' : 'scene'),
      isPersian = true,
      rarity,
      speciesCategory,
      domain,
      category,
      eraCategory,
      dangerLevel,
      npcRole,
      worldContext,
      anchor,
      worldBible,
    } = body;

    // ----------------------------------------------------------------
    // Plan 01: Seed-to-Cosmos Genesis Generator
    // ----------------------------------------------------------------
    if (type === 'genesis') {
      const systemInstruction = `${GENESIS_SYSTEM_DIRECTIVES}\n\n${
        isPersian
          ? 'زبان خروجی: فارسی ادبی (رشته‌های id انگلیسی بمانند).'
          : 'Output language: literary English (keep id strings in English).'
      }`;
      const userPrompt = buildGenesisUserPrompt({ prompt, isPersian, themeContext });

      const aiResult = await generateStructuredJson<GenesisWorldData>(
        userPrompt,
        systemInstruction,
        { temperature: 0.85, taskType: 'world', maxOutputTokens: 8000 }
      );

      if (aiResult && aiResult.data) {
        const parsed = GenesisWorldSchema.safeParse(aiResult.data);
        if (parsed.success) {
          return NextResponse.json({
            success: true,
            data: parsed.data,
            isAiGenerated: true,
            modelUsed: aiResult.modelUsed,
          });
        }
      }

      // Procedural fallback — fully self-consistent starter world
      return NextResponse.json({
        success: true,
        data: buildFallbackGenesis(isPersian),
        isAiGenerated: false,
      });
    }

    // ----------------------------------------------------------------
    // Plan 01: Contradiction Radar (Lore Consistency Auditor)
    // ----------------------------------------------------------------
    if (type === 'audit_world') {
      const wb = worldBible;
      if (!wb || !wb.worldId) {
        return NextResponse.json(
          { success: false, error: 'A worldBible payload is required for audit_world.' },
          { status: 400 }
        );
      }

      const deterministic = LoreAuditor.audit(wb);

      // Try to enrich with an AI audit; if unavailable, return the deterministic one.
      const aiResult = await generateStructuredJson(
        buildAuditUserPrompt({ isPersian, worldContext: buildWorldContextString({ worldBible: wb }) }),
        AUDIT_SYSTEM_DIRECTIVES,
        { temperature: 0.3, taskType: 'world', maxOutputTokens: 6000 }
      );

      if (aiResult && aiResult.data) {
        const parsed = ContradictionAuditReportSchema.safeParse(aiResult.data);
        if (parsed.success) {
          // Union deterministic findings into the AI report so hard violations always surface.
          const mergedFindings = mergeFindings(deterministic.findings, parsed.data.findings);
          return NextResponse.json({
            success: true,
            data: {
              score: parsed.data.score,
              summary: parsed.data.summary,
              findings: mergedFindings,
            },
            isAiGenerated: true,
            modelUsed: aiResult.modelUsed,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: deterministic,
        isAiGenerated: false,
      });
    }

    // Build author constraints so the AI honors the chosen "type" (rarity/species/domain/...)
    const constraints: string[] = [];
    if (type === 'artifact' && rarity) {
      constraints.push(`The author explicitly requested an item of RARITY "${rarity}". Output exactly that rarity value.`);
    }
    if (type === 'creature' && speciesCategory) {
      constraints.push(`The author explicitly requested a creature of SPECIES CATEGORY "${speciesCategory}". Output exactly that speciesCategory value.`);
    }
    if (type === 'deity' && domain) {
      constraints.push(`The author explicitly requested a deity of DOMAIN "${domain}". Output exactly that domain value.`);
    }
    if (type === 'world_law' && category) {
      constraints.push(`The author explicitly requested a law of CATEGORY "${category}". Output exactly that category value.`);
    }
    if (type === 'timeline_event' && eraCategory) {
      constraints.push(`The author explicitly requested a timeline event of ERA CATEGORY "${eraCategory}". Output exactly that eraCategory value.`);
    }
    if (type === 'location' && dangerLevel) {
      constraints.push(`The author explicitly requested a location with DANGER LEVEL ${dangerLevel}. Output exactly that dangerLevel value.`);
    }
    if (type === 'npc' && npcRole?.trim()) {
      constraints.push(`The author explicitly requested an NPC whose ROLE is "${npcRole.trim()}".`);
    }
    const constraintLine = constraints.length
      ? `\n\nAUTHOR CONSTRAINTS (you MUST honor these):\n- ${constraints.join('\n- ')}`
      : '';

    // Explicitly forbid duplicating existing lore. The world context lists what
    // ALREADY exists; without this directive the model imitates it and produces
    // near-clones (similar names/descriptions across generations).
    const uniquenessInstruction = isPersian
      ? worldContext
        ? '\n\nمهم — یگانگی: بخش «زمینه جهان» بالا، موجودیت‌هایی را فهرست می‌کند که هم‌اکنون در جهان وجود دارند. باید یک موجودیت کاملاً جدید و متمایز بسازی. نام، لقب یا توصیف هیچ موجودیت موجود را بازاستفاده، کپی یا بازنویسی نکن. خروجی باید از نظر نام و مفهوم کاملاً یگانه و متمایز باشد.'
        : '\n\nمهم — یگانگی: خروجی باید کاملاً بدیع، منحصربه‌فرد و متمایز باشد و با تولیدهای پیشین هم‌پوشانی نداشته باشد.'
      : worldContext
        ? '\n\nIMPORTANT — UNIQUENESS: The "World context" above lists entities that ALREADY EXIST in this world. Generate a single brand-new, distinct entity. Do NOT reuse, copy, or closely paraphrase the name, title, or description of any existing entity. Your output must be clearly unique in both name and concept.'
        : '\n\nIMPORTANT — UNIQUENESS: Ensure your output is wholly original and distinct, with no overlap with previously generated content.';

    // Use custom system prompt from UI if provided, otherwise default to context-rich prompt
    const systemPrompt =
      customSystemPrompt?.trim() ||
      `You are the Master World-Building & Narrative AI Co-Pilot for StoryForge, an advanced Interactive Fiction RPG engine.
Generate a high-quality JSON object for a ${type} within a dark fantasy / grim-arcane setting.
${isPersian ? 'Output all narrative text, names, descriptions in literary Persian (Farsi).' : 'Output in literary English.'}
Theme context: ${themeContext || 'Dark basalt mountain fortress, political tension, forbidden alchemy'}
User guidance: ${prompt || 'Create something rich with atmospheric depth and literary gravitas.'}
${worldContext ? `World context (existing lore — stay consistent with it):\n${worldContext}` : ''}${uniquenessInstruction}${anchor ? `\n\nANCHOR — This new ${type} MUST be thematically tied to the following existing lore element; derive its concept, theme, powers/flavor, and relations from it rather than introducing an unrelated motif:\n${anchor}` : ''}
Strictly output a valid JSON object matching the requested schema. Do not enclose in markdown blocks if possible, or return clean JSON.${constraintLine}`;

    let schemaInstruction = '';
    if (type === 'world') {
      schemaInstruction = `Schema: { "worldName": string, "summary": string, "themeNotes": string, "aiSystemPrompt": string, "laws": [{ "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }], "factions": [{ "id": string, "name": string, "description": string, "alignment": string, "publicGoals": string }] }`;
    } else if (type === 'faction') {
      schemaInstruction = `Schema: { "name": string, "description": string, "alignment": string, "publicGoals": string, "secretAgendas": string, "territoryIds": string[], "rivalFactionIds": string[], "alliedFactionIds": string[] }`;
    } else if (type === 'location') {
      schemaInstruction = `Schema: { "name": string, "region": string, "description": string, "dangerLevel": 1|2|3|4|5, "atmosphere": string, "specialRules": string[] }`;
    } else if (type === 'npc') {
      schemaInstruction = `Schema: { "name": string, "title": string, "role": string, "currentLocationId": string, "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number }`;
    } else if (type === 'artifact') {
      schemaInstruction = `Schema: { "name": string, "title": string, "originEra": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "secretLore": string }`;
    } else if (type === 'creature') {
      schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic", "dangerLevel": 1|2|3|4|5, "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string }`;
    } else if (type === 'deity') {
      schemaInstruction = `Schema: { "name": string, "title": string, "domain": "light"|"secrets"|"death"|"war"|"nature"|"chaos"|"forge", "sacredSymbol": string, "coreDogma": string, "taboos": string[], "divineBlessings": string[] }`;
    } else if (type === 'timeline_event') {
      schemaInstruction = `Schema: { "yearOrEra": string, "title": string, "summary": string, "significance": string, "knownByPublic": boolean, "eraCategory": "ancient"|"war"|"reign"|"present" }`;
    } else if (type === 'world_law') {
      schemaInstruction = `Schema: { "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }`;
    } else if (type === 'scene') {
      schemaInstruction = `Schema: { "sceneId": string, "locationId": string, "narrativeText": string, "choices": [{ "id": string, "text": string, "style": "defensive"|"agile"|"aggressive"|"diplomatic"|"inquisitive", "riskLevel": "low"|"medium"|"high", "targetDC": number, "requiredStatId": string }] }`;
    }

    const effectiveSchemaInstruction = constraints.length
      ? `${constraintLine}\n${schemaInstruction}`
      : schemaInstruction;

    const userPromptText = customSystemPrompt?.trim()
      ? `Apply the requested changes to the existing ${type} entity and return the complete updated JSON strictly matching the schema:\n${effectiveSchemaInstruction}`
      : `Generate a ${type} entity with creative literary depth.\n${effectiveSchemaInstruction}`;

    const aiResult = await generateStructuredJson(
      userPromptText,
      systemPrompt,
      {
        temperature: customSystemPrompt?.trim() ? 0.7 : 0.8,
        taskType: type === 'world' ? 'world' : taskType,
      }
    );

    if (aiResult && aiResult.data) {
      return NextResponse.json({
        success: true,
        data: aiResult.data,
        isAiGenerated: true,
        modelUsed: aiResult.modelUsed,
      });
    }

    // Procedural Fallback Generator
    const timestamp = Date.now().toString(36);
    let fallbackData: Record<string, unknown> | null = null;

    if (type === 'faction') {
      fallbackData = isPersian
        ? {
            id: `fac_${timestamp}`,
            name: 'برادری چکمه‌های سربی',
            description: 'گروهی نیمه‌نظامی از کهنه‌سربازان بندری که مالیات‌های سایه را در حاشیه اسکله وصول می‌کنند.',
            alignment: 'اقتدارگرای قانون‌مند',
            territoryIds: [],
            rivalFactionIds: [],
            alliedFactionIds: [],
            publicGoals: 'حفظ نظم در مناطق بندری و جمع‌آوری خراج نیمه‌رسمی',
            secretAgendas: 'قاچاق تسلیحات به جناح‌های رقیب برای دامن زدن به جنگ قدرت',
          }
        : {
            id: `fac_${timestamp}`,
            name: 'The Lead-Soled Brotherhood',
            description: 'A semi-military guild of veteran dockhands who collect shadow-tariffs along the harbor fringe.',
            alignment: 'Lawful Authoritarian',
            territoryIds: [],
            rivalFactionIds: [],
            alliedFactionIds: [],
            publicGoals: 'Preserve order in the harbor districts and levy unofficial tariffs',
            secretAgendas: 'Smuggle arms to rival factions to stoke a power war',
          };
    } else if (type === 'location') {
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
    } else if (type === 'world') {
      fallbackData = isPersian
        ? {
            worldName: 'قلمروهای گمشده آرکانیا',
            summary: 'سرزمینی آکنده از خاکسترهای جادویی باستان که توسط گارد نقره‌ای با مشت آهنین اداره می‌شود.',
            themeNotes: 'تاریک، رازآلود و سنگین با تعلیق دائمی خیانت در دربار.',
            aiSystemPrompt: 'تو دانای کل و راوی ارشد جهان آرکانیا هستی. توصیفات باید لحنی حماسی، واقع‌گرایانه و فضاساز داشته باشند.',
            laws: [
              {
                id: `law_${timestamp}_1`,
                rule: 'جادوی خون نیازمند تسلیم نیروی حیاتی است.',
                category: 'magic',
                description: 'هر افسونی بهایی جسمانی یا روانی بر جا می‌گذارد.',
                isImmutable: true,
              },
            ],
            factions: [
              {
                id: `fac_${timestamp}_1`,
                name: 'فرمانروایی گارد نقره‌ای',
                description: 'شوالیه‌های قسم‌خورده دربار پادشاهی.',
                alignment: 'نظم‌گرای سخت‌گیر',
                publicGoals: 'حفظ آرامش شهر و دستگیری کیمیاگران مرتد.',
              },
            ],
          }
        : {
            worldName: 'The Shattered Expanse of Arcania',
            summary: 'A dark realm veiled in primordial volcanic fog governed by an authoritarian high inquisition.',
            themeNotes: 'Grimdark, gothic mystery with heavy political tension and forbidden alchemical rites.',
            aiSystemPrompt: 'You are the Master Storyteller for the dark fantasy interactive RPG Arcania.',
            laws: [
              {
                id: `law_${timestamp}_1`,
                rule: 'All thaumaturgy leaves indelible arcane scars upon the soul.',
                category: 'magic',
                description: 'Casting beyond mortal limits triggers cognitive breakdown.',
                isImmutable: true,
              },
            ],
            factions: [
              {
                id: `fac_${timestamp}_1`,
                name: 'The Iron Inquisitors',
                description: 'Elite royal retainers enforcing the ban on occult arts.',
                alignment: 'Lawful Authoritarian',
                publicGoals: 'Purge illegal sorcery and enforce imperial edicts.',
              },
            ],
          };
    } else if (type === 'scene') {
      fallbackData = isPersian
        ? {
            sceneId: `scene_${timestamp}`,
            locationId: 'loc_dungeon_cell_fa',
            narrativeText: 'شعله‌های مشعل روی دیوارهای سرد بازالتی می‌رقصند. صدای چرخش کلید در قفل برنجی سکوت دخمه را می‌شکند.',
            choices: [
              {
                id: `choice_${timestamp}_1`,
                text: 'پشت چارچوب در تاریک سنگر بگیر و خنجرت را آماده کن.',
                style: 'defensive',
                riskLevel: 'low',
                targetDC: 10,
                requiredStatId: 'agility',
              },
              {
                id: `choice_${timestamp}_2`,
                text: 'با گام‌های استوار جلو برو و خود را به نگهبان تسلیم‌ناپذیر نشان بده.',
                style: 'diplomatic',
                riskLevel: 'medium',
                targetDC: 12,
                requiredStatId: 'cunning',
              },
            ],
          }
        : {
            sceneId: `scene_${timestamp}`,
            locationId: 'loc_dungeon_cell',
            narrativeText: 'Torchlight casts dancing shadows across cold basalt flagstones as an iron key turns in the heavy lock.',
            choices: [
              {
                id: `choice_${timestamp}_1`,
                text: 'Conceal yourself in the shadows behind the cell door.',
                style: 'defensive',
                riskLevel: 'low',
                targetDC: 10,
                requiredStatId: 'agility',
              },
              {
                id: `choice_${timestamp}_2`,
                text: 'Step forward into the light to confront the guard.',
                style: 'diplomatic',
                riskLevel: 'medium',
                targetDC: 12,
                requiredStatId: 'cunning',
              },
            ],
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
            rule: "Blood thaumaturgy inexorably demands an equal tithe of the caster's soul.",
            category: 'magic',
            description: 'No crimson rite can be channeled without permanent vitality drain or memory decay.',
            isImmutable: true,
          };
    }

    return NextResponse.json({ success: true, data: fallbackData, isAiGenerated: false });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to generate lore content' },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// Plan 01 helpers: Genesis fallback + audit finding merge
// ----------------------------------------------------------------------------

function mergeFindings(
  deterministic: ContradictionFinding[],
  aiFindings: ContradictionFinding[]
): ContradictionFinding[] {
  const seen = new Set<string>();
  const merged: ContradictionFinding[] = [];
  for (const f of [...deterministic, ...aiFindings]) {
    const key = `${f.category}:${f.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(f);
  }
  return merged;
}

function buildFallbackGenesis(isPersian: boolean): GenesisWorldData {
  if (isPersian) {
    return {
      worldName: 'قلمروهای خاکستر آرکانیا',
      tagline: 'سرزمینی که در آن خاکستر جادوی کهن می‌بارد',
      summary: 'دنیایی تاریک و رازآلود با قلعه‌های سیاه‌سنگ، فرقه‌های مخفی کیمیاگران و نبردهای پنهان بر سر قدرت.',
      themeNotes: 'تاریک، رازآلود، سنگین با تعلیق دائمی خیانت در دربار.',
      aiSystemPrompt: 'تو دانای کل و راوی ارشد جهان آرکانیا هستی. با لحنی حماسی، واقع‌گرایانه و فضاساز روایت کن.',
      laws: [
        { id: 'law_blood_magic', rule: 'جادوی خون نیازمند تسلیم نیروی حیاتی است.', description: 'هر افسون بهایی جسمانی یا روانی بر جا می‌گذارد.', category: 'magic', isImmutable: true },
        { id: 'law_dragon_extinct', rule: 'اژدهایان ۳۰۰ سال است که منقرض شده‌اند.', description: 'هیچ اژدهای زنده‌ای در جهان وجود ندارد.', category: 'society', isImmutable: true },
        { id: 'law_no_fly', rule: 'پرواز جادویی در حریم شهر ممنوع است.', description: 'استفاده از الفاظ پروازی در محدوده دربار جرم است.', category: 'society', isImmutable: true },
        { id: 'law_divine_oath', rule: 'سوگند شکسته به ایزدان باعث نفرین می‌شود.', description: 'نقض پیمان مقدس پیامدهای کیهانی دارد.', category: 'divine', isImmutable: true },
      ],
      factions: [
        { id: 'fac_silver_guard', name: 'گارد نقره‌ای', description: 'شوالیه‌های قسم‌خورده دربار پادشاهی.', alignment: 'نظم‌گرای سخت‌گیر', publicGoals: 'حفظ آرامش شهر و دستگیری کیمیاگران مرتد.', secretAgendas: 'گسترش جاسوسی در میان جناح‌های رقیب.', rivalFactionIds: ['fac_ash_syndicate'], alliedFactionIds: ['fac_candle_order'], territoryIds: ['loc_obsidian_citadel'] },
        { id: 'fac_ash_syndicate', name: 'سندیکای خاکستر', description: 'کیمیاگران شورشی در کانال‌های زیرزمینی.', alignment: 'متمرد آنارشیست', publicGoals: 'لغو مالیات جادو و آزادی کیمیا.', secretAgendas: 'احیای هنرهای ممنوعه خون.', rivalFactionIds: ['fac_silver_guard'], alliedFactionIds: [], territoryIds: ['loc_sunken_canal'] },
        { id: 'fac_candle_order', name: 'فرقه شمع روشن', description: 'روحانیون ایزد نور و نظم.', alignment: 'مذهبی سنتی', publicGoals: 'پاسداری از معابد و جلوگیری از کفر.', secretAgendas: 'انباشت ثروت در خزانه‌های مقدس.', rivalFactionIds: [], alliedFactionIds: ['fac_silver_guard'], territoryIds: ['loc_sunspire_temple'] },
      ],
      locations: [
        { id: 'loc_obsidian_citadel', name: 'قلعه سیاه‌سنگ', region: 'پایتخت', description: 'دژی عظیم از سنگ‌های آتشفشانی که بر فراز شهر قرار دارد.', atmosphere: 'سرد، دلهره‌آور، بوی آهن و بخار گوگرد.', dangerLevel: 4, specialRules: ['حضور دائم گارد نقره‌ای'], connectedLocationIds: ['loc_sunken_canal', 'loc_sunspire_temple'] },
        { id: 'loc_sunken_canal', name: 'کانال غرق‌شده', region: 'حاشیه شهر', description: 'شبکه‌ای از تونل‌های آبی زیرزمینی که پناهگاه متمردان است.', atmosphere: 'تاریک، مرطوب، بوی تعفن و اکسیر.', dangerLevel: 3, specialRules: ['خطر غرق‌شدن در مدارهای پرآب'], connectedLocationIds: ['loc_obsidian_citadel'] },
        { id: 'loc_sunspire_temple', name: 'معبد نوک خورشید', region: 'بخش مقدس', description: 'پرستشگاه بلند ایزد نور با مناره‌های طلایی.', atmosphere: 'آرام، مذهبی، بوی بخور و کندر.', dangerLevel: 2, specialRules: ['احترام به آیین اجباری است'], connectedLocationIds: ['loc_obsidian_citadel'] },
        { id: 'loc_ash_wastes', name: 'بیابان خاکستر', region: 'خارج از دیوارها', description: 'دشتی سوزان و بی‌آب‌وعلف که محکومان به تبعید فرستاده می‌شوند.', atmosphere: 'خشک، وزوز باد، افق تار', dangerLevel: 5, specialRules: ['کمبود آب و سایه'], connectedLocationIds: [] },
      ],
      religions: [
        { id: 'deity_sovereign_fire', name: 'ایزدبانوی شعله', title: 'بانوی کوره ابدی', domain: 'forge', sacredSymbol: 'سندان سنگی مشتعل', coreDogma: 'تنها از طریق آزمایش و اراده، جوهر کمال یافت می‌شود.', taboos: ['خاموش کردن کوره مقدس'], divineBlessings: ['مقاومت در برابر گرما'] },
        { id: 'deity_dawn_order', name: 'ایزد نور', title: 'قاضی روشن', domain: 'light', sacredSymbol: 'خورشید زرین', coreDogma: 'حقیقت و نظم کیهانی برتر از هر خواسته‌ای است.', taboos: ['دروغ بر سوگند مقدس'], divineBlessings: ['نور حقیقت'] },
      ],
      coreCampaignMystery: 'چه کسی نقشه احیای اژدهایان کهن را در زیر کانال‌های غرق‌شده پنهان کرده است؟',
    };
  }

  return {
    worldName: 'The Shattered Expanse of Arcania',
    tagline: 'A realm where the ash of elder sorcery still falls from the sky',
    summary: 'A grim, mysterious world of black-stone citadels, hidden alchemical cults, and silent wars for power in the court.',
    themeNotes: 'Grimdark, gothic mystery with heavy political tension and forbidden arcane rites.',
    aiSystemPrompt: 'You are the Master Storyteller for the dark fantasy interactive RPG Arcania.',
    laws: [
      { id: 'law_blood_magic', rule: 'All blood thaumaturgy demands an equal tithe of vitality.', description: 'Every crimson rite leaves a permanent physical or mental scar.', category: 'magic', isImmutable: true },
      { id: 'law_dragon_extinct', rule: 'Dragons have been extinct for 300 years.', description: 'No living dragon exists anywhere in the world.', category: 'society', isImmutable: true },
      { id: 'law_no_fly', rule: 'Magical flight is forbidden within city limits.', description: 'Casting levitation or flight in the capital is a capital crime.', category: 'society', isImmutable: true },
      { id: 'law_divine_oath', rule: 'A broken oath to the gods invokes a curse.', description: 'Violating a sacred pact carries cosmic consequences.', category: 'divine', isImmutable: true },
    ],
    factions: [
      { id: 'fac_silver_guard', name: 'The Silver Guard', description: 'Sworn royalist knights enforcing imperial edicts.', alignment: 'Lawful Authoritarian', publicGoals: 'Preserve order and purge illegal sorcery.', secretAgendas: 'Expand covert surveillance across rival factions.', rivalFactionIds: ['fac_ash_syndicate'], alliedFactionIds: ['fac_candle_order'], territoryIds: ['loc_obsidian_citadel'] },
      { id: 'fac_ash_syndicate', name: 'The Ash Syndicate', description: 'Rebellious alchemists dwelling in the subterranean canals.', alignment: 'Rebel Anarchist', publicGoals: 'Abolish the sorcery tax and free the craft.', secretAgendas: 'Revive forbidden blood arts in secret.', rivalFactionIds: ['fac_silver_guard'], alliedFactionIds: [], territoryIds: ['loc_sunken_canal'] },
      { id: 'fac_candle_order', name: 'The Candle Order', description: 'Clerics of the Sovereign of Light and Order.', alignment: 'Traditional Theocrat', publicGoals: 'Guard the temples and root out heresy.', secretAgendas: 'Amass wealth within the sacred vaults.', rivalFactionIds: [], alliedFactionIds: ['fac_silver_guard'], territoryIds: ['loc_sunspire_temple'] },
    ],
    locations: [
      { id: 'loc_obsidian_citadel', name: 'The Obsidian Citadel', region: 'Capital', description: 'A towering volcanic-stone fortress looming above the city.', atmosphere: 'Cold, oppressive, scent of iron and sulfur.', dangerLevel: 4, specialRules: ['Constant Silver Guard patrols'], connectedLocationIds: ['loc_sunken_canal', 'loc_sunspire_temple'] },
      { id: 'loc_sunken_canal', name: 'The Sunken Canal', region: 'City Fringe', description: 'A network of flooded tunnels sheltering outcasts and rebels.', atmosphere: 'Dark, damp, reeking of alchemical rot.', dangerLevel: 3, specialRules: ['Risk of drowning in flooded conduits'], connectedLocationIds: ['loc_obsidian_citadel'] },
      { id: 'loc_sunspire_temple', name: 'The Sunspire Temple', region: 'Sacred District', description: 'A tall gilded shrine to the Sovereign of Light.', atmosphere: 'Serene, devotional, scent of incense.', dangerLevel: 2, specialRules: ['Ritual observance is mandatory'], connectedLocationIds: ['loc_obsidian_citadel'] },
      { id: 'loc_ash_wastes', name: 'The Ash Wastes', region: 'Beyond the Walls', description: 'A scorched, waterless plain where exiles are sent.', atmosphere: 'Arid, wind-howling, dim horizon.', dangerLevel: 5, specialRules: ['Severe water and shade scarcity'], connectedLocationIds: [] },
    ],
    religions: [
      { id: 'deity_sovereign_fire', name: 'The Sovereign of the Crucible', title: 'Lady of the Eternal Forge', domain: 'forge', sacredSymbol: 'Blazing stone anvil', coreDogma: 'Only through trial and will is true spirit forged.', taboos: ['Quenching sacred blast furnaces'], divineBlessings: ['Thermal resistance'] },
      { id: 'deity_dawn_order', name: 'The Dawn Sovereign', title: 'The Radiant Judge', domain: 'light', sacredSymbol: 'Golden sun', coreDogma: 'Truth and cosmic order surpass all mortal wants.', taboos: ['Lying under sacred oath'], divineBlessings: ['Light of truth'] },
    ],
    coreCampaignMystery: 'Who concealed the blueprint to revive the elder dragons beneath the Sunken Canal?',
  };
}
