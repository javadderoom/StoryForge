import type { WorldBible, OracleMemoryDirective } from '@/lib/types/world';

export const ALLOWED_ENTITIES = [
  'faction',
  'location',
  'npc',
  'artifact',
  'creature',
  'deity',
  'timeline_event',
  'world_law',
] as const;

export type EntityType = (typeof ALLOWED_ENTITIES)[number];

// Map natural-language names the model may use to canonical entity types.
export const ENTITY_ALIASES: Record<string, EntityType> = {
  faction: 'faction',
  organization: 'faction',
  organisation: 'faction',
  order: 'faction',
  guild: 'faction',
  faction_relation: 'faction',
  faction_relations: 'faction',
  factionrelation: 'faction',
  relation: 'faction',
  relations: 'faction',
  location: 'location',
  place: 'location',
  region: 'location',
  area: 'location',
  npc: 'npc',
  character: 'npc',
  person: 'npc',
  artifact: 'artifact',
  relic: 'artifact',
  item: 'artifact',
  creature: 'creature',
  monster: 'creature',
  beast: 'creature',
  deity: 'deity',
  religion: 'deity',
  religions: 'deity',
  god: 'deity',
  gods: 'deity',
  goddess: 'deity',
  pantheon: 'deity',
  divinity: 'deity',
  faith: 'deity',
  cult: 'deity',
  timeline_event: 'timeline_event',
  event: 'timeline_event',
  timeline: 'timeline_event',
  era: 'timeline_event',
  world_law: 'world_law',
  law: 'world_law',
  rule: 'world_law',
};

export interface ActionBlock {
  op: 'create' | 'update' | 'delete';
  entity: EntityType;
  prompt?: string;
  data?: Record<string, any>;
  anchor?: string;
  match?: { byName: string };
}

export type PersonaId = 'oracle' | 'inquisitor' | 'weaver' | 'cosmologist' | 'stylist';

export interface AdviserPersona {
  id: PersonaId;
  label: { en: string; fa: string };
  blurb: { en: string; fa: string };
  // Core behaviour prompt (without world-context / action protocol sections).
  core: { en: string; fa: string };
}

export const ADVISER_PERSONAS: Record<PersonaId, AdviserPersona> = {
  oracle: {
    id: 'oracle',
    label: { en: 'Oracle', fa: 'دانا' },
    blurb: {
      en: 'Balanced world-building partner',
      fa: 'همراه متوازن جهان‌سازی',
    },
    core: {
      en: 'You are the World-Building Co-Pilot for AfsanehSaz — a smart, analytical creative partner and editor. You help the author brainstorm, critique, organize, and spot structural lore gaps. Speak in a clear, natural, direct conversational tone (NOT theatrical roleplay). Offer concrete, actionable advice.',
      fa: 'تو «مشاور و دستیار جهان‌سازی» افسانه‌ساز هستی؛ یک همکار خلاق، تحلیل‌گر و ویراستار حرفه‌ای. به نویسنده در ایده‌پردازی، نقد، ساختاردهی و شناسایی خلأهای داستانی کمک می‌کنی. لحن صحبت تو در گفتگوها باید کاملاً طبیعی، مستقیم، محترمانه و اداری-روان باشد (هرگز نقش‌آفرینی نمایشی یا نثر اغراق‌آمیز انجام نده). پیشنهادات دقیق و کاربردی ارائه بده.',

    },
  },
  inquisitor: {
    id: 'inquisitor',
    label: { en: 'The Inquisitor', fa: 'بازپرس' },
    blurb: {
      en: 'Probes assumptions & plot holes',
      fa: 'کاوش در فرض‌ها و سوراخ‌های داستانی',
    },
    core: {
      en: 'You are THE INQUISITOR persona. You are a sharp, skeptical narrative editor and logic consultant. You examine the author\'s world for plot holes, contradictions, vague motivations, and unearned stakes. Speak clearly, concisely, and directly. Identify flaws with precision before suggesting practical fixes.',
      fa: 'تو در نقش «بازپرس» (منتقد منطق و پلات) هستی. جهان را برای سوراخ‌های داستانی، تناقض‌ها، انگیزه‌های نامشخص و نامتعادل بودن سیستم‌ها بررسی می‌کنی. لحن تو باید کاملاً واضح، صریح، منطقی و حرفه‌ای باشد (بدون نقش‌آفرینی شاعرانه). ابتدا ایراد دقیق را بر اساس داده‌های موجود بیان کن و سپس راه‌حل‌های ملموس پیشنهاد بده.',
    },
  },
  weaver: {
    id: 'weaver',
    label: { en: 'The World-Weaver', fa: 'بافنده جهان' },
    blurb: {
      en: 'Connects threads & builds synergy',
      fa: 'پیوند نخ‌ها و هم‌افزایی',
    },
    core: {
      en: 'You are THE WORLD-WEAVER persona. You specialize in dramatic tension, political webs, character bonds, and interconnected consequences. Speak in a clear, collaborative editor tone. Propose rich cause-and-effect ties between factions, NPCs, and locations.',
      fa: 'تو در نقش «بافنده جهان» (طراح درام و شبکه ارتباطات) هستی. تخصص تو در ایجاد تنش‌های دراماتیک، تضاد منافع جناح‌ها، رازهای بین شخصیت‌ها و روابط متقابل است. با لحنی شفاف، حرفه‌ای و طبیعی با نویسنده گفتگو کن و پیوندهای علت و معلولی میان اجزای جهان را نشان بده.',
    },
  },
  cosmologist: {
    id: 'cosmologist',
    label: { en: 'The Cosmologist', fa: 'کیهان‌شناس' },
    blurb: {
      en: 'Magic, physics & geography consistency',
      fa: 'سازگاری جادو، فیزیک و جغرافیا',
    },
    core: {
      en: 'You are THE COSMOLOGIST persona. You are a systems and world mechanics consultant specializing in magic rules, physical laws, geography, and resource logic. Speak as an objective systems designer. Point out mechanical inconsistencies and verify that the world follows its own hard rules.',
      fa: 'تو در نقش «کیهان‌شناس» (مشاور قوانین و سیستم‌های جهان) هستی. در سازگاری قوانین جادو، محدودیت‌ها، هزینه قدرت‌ها، جغرافیا و منطق اقلیمی تخصص داری. با لحنی علمی، دقیق، طبیعی و مستقیم صحبت کن و هرگونه نقض قوانین یا عدم تعادل را با ذکر جزئیات نشان بده.',
    },
  },
  stylist: {
    id: 'stylist',
    label: { en: 'The Wordsmith', fa: 'زبان‌زر' },
    blurb: {
      en: 'Naming, tone & evocative prose',
      fa: 'نام‌گذاری، لحن و نثر دل‌انگیز',
    },
    core: {
      en: 'You are THE WORDSMITH persona. You are a literary stylist and naming consultant. You help craft evocative names, distinct epithets, and polished lore prose. When chatting with the author, speak in a normal, direct editor tone; save high literary polish for the actual entity names and lore excerpts you propose.',
      fa: 'تو در نقش «زبان‌زر» (ویراستار ادبی و نام‌گذاری) هستی. به نام‌گذاری‌های پرطنین، القاب گیرا و ارتقای متون روایی کمک می‌کنی. در چت با نویسنده به صورت شفاف و مستقیم صحبت کن، و قلم ادبی و شکوهمند را تنها برای نام‌ها و متون لوری که پیشنهاد می‌دهی به کار ببر.',
    },
  },
};


export function normalizeEntityName(raw: unknown): EntityType | null {
  if (typeof raw !== 'string') return null;
  return ENTITY_ALIASES[raw.trim().toLowerCase()] || null;
}

export function nameOf(entity: EntityType, item: any): string {
  if (!item) return '';
  return item.name ?? item.title ?? item.rule ?? item.yearOrEra ?? '';
}

/**
 * Robust text normalizer that strips Zero-Width characters (ZWNJ \u200c),
 * normalizes Arabic/Persian letter variants (ی/ي, ک/ك, هٔ/ه),
 * strips diacritics/harakat, and collapses punctuation/whitespace.
 */
export function normalizeSearchText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    // Strip Zero-Width characters (ZWNJ \u200c, ZWJ \u200d, LRM \u200e, RLM \u200f, BOM \ufeff)
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, '')
    // Normalize Arabic Yeh (ي, ى, ئ) to Persian Yeh (ی)
    .replace(/[\u0649\u064a\u0626]/g, 'ی')
    // Normalize Arabic Kaf (ك) to Persian Kaf (ک)
    .replace(/\u0643/g, 'ک')
    // Remove Arabic/Persian diacritics / harakat (َ ِ ُ ً ٍ ٌ ّ ْ ٔ)
    .replace(/[\u064b-\u065f\u0670\u0654]/g, '')
    // Normalize Hamza (أ, إ, آ, ؤ) to Alef (ا) or Waw (و)
    .replace(/[\u0622\u0623\u0625\u0671]/g, 'ا')
    .replace(/\u0624/g, 'و')
    // Normalize Heh with Hamza (هٔ, ۀ) to Heh (ه)
    .replace(/[\u06c0\u06d5]/g, 'ه')
    // Normalize punctuation & extra whitespace
    .replace(/[«»""''()[\]{}،,.;:!?\-—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const rawA = a.toString().trim().toLowerCase();
  const rawB = b.toString().trim().toLowerCase();
  if (rawA === rawB || rawA.includes(rawB) || rawB.includes(rawA)) return true;

  const na = normalizeSearchText(rawA);
  const nb = normalizeSearchText(rawB);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // Word token overlap for robust partial/fuzzy matches
  const wordsA = na.split(' ').filter((w) => w.length > 1);
  const wordsB = nb.split(' ').filter((w) => w.length > 1);
  if (wordsA.length && wordsB.length) {
    const setA = new Set(wordsA);
    const matchedCount = wordsB.filter((w) => setA.has(w)).length;
    const minWords = Math.min(wordsA.length, wordsB.length);
    if (matchedCount > 0 && matchedCount / minWords >= 0.6) {
      return true;
    }
  }

  return false;
}

export function getEntityArray(wb: WorldBible | undefined, entity: EntityType): any[] {
  const w = wb || ({} as WorldBible);
  switch (entity) {
    case 'faction':
      return (w as any).factions || [];
    case 'location':
      return (w as any).locations || [];
    case 'npc':
      return (w as any).npcs || [];
    case 'artifact':
      return (w as any).artifacts || [];
    case 'creature':
      return (w as any).bestiary || [];
    case 'deity':
      return (w as any).religions || [];
    case 'timeline_event':
      return (w as any).timeline || [];
    case 'world_law':
      return (w as any).laws || [];
    default:
      return [];
  }
}

function parseOrdinal(text: string): number | null {
  const t = text.toLowerCase();
  const map: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
    seventh: 6,
    last: -1,
    '1st': 0,
    '2nd': 1,
    '3rd': 2,
    '4th': 3,
    '5th': 4,
    '6th': 5,
    '7th': 6,
    اول: 0,
    نخست: 0,
    دوم: 1,
    سوم: 2,
    چهارم: 3,
    پنجم: 4,
    آخر: -1,
    پایانی: -1,
  };
  for (const k of Object.keys(map)) if (t.includes(k)) return map[k];
  const m = t.match(/\b(\d{1,2})\b/);
  if (m) return parseInt(m[1], 10) - 1;
  return null;
}

// Resolve an existing entity from a (possibly loose) reference like
// "first god", "the second deity", "Sovereign of Fire", or a number.
export function resolveEntityTarget(
  wb: WorldBible | undefined,
  entity: EntityType,
  byName: string
): any | undefined {
  if (!byName) return undefined;
  const arr = getEntityArray(wb, entity);
  const searchable = (it: any) =>
    `${nameOf(entity, it)} ${it?.title || ''} ${it?.domain || ''} ${it?.name || ''}`.trim();

  // 1. Direct match in targeted entity array
  let found = arr.find((it) => nameMatch(searchable(it), byName));
  if (found) return found;

  // 2. Exact ID match
  found = arr.find((it) => it?.id === byName.trim());
  if (found) return found;

  // 3. Stripped ordinals/prefixes match
  const stripped = byName
    .replace(
      /\b(first|second|third|fourth|fifth|sixth|seventh|last|\d{1,2}(?:st|nd|rd|th))\b/gi,
      ''
    )
    .replace(/\b(god|gods|deity|deities|religion|religions|pantheon|the|جناح|مکان|شخصیت|ایزد|قانون)\b/gi, '')
    .trim();
  if (stripped && stripped.toLowerCase() !== byName.toLowerCase()) {
    found = arr.find((it) => nameMatch(searchable(it), stripped));
    if (found) return found;
  }
  const ord = parseOrdinal(byName);
  if (ord !== null) {
    const i = ord < 0 ? arr.length + ord : ord;
    if (i >= 0 && i < arr.length) return arr[i];
  }

  // 4. Cross-collection fallback in case the entity type was loosely classified
  for (const otherType of ALLOWED_ENTITIES) {
    if (otherType === entity) continue;
    const otherArr = getEntityArray(wb, otherType);
    const otherSearchable = (it: any) =>
      `${nameOf(otherType, it)} ${it?.title || ''} ${it?.domain || ''} ${it?.name || ''}`.trim();
    const otherFound = otherArr.find((it) => nameMatch(otherSearchable(it), byName));
    if (otherFound) return otherFound;
  }

  return undefined;
}


function sanitizeJsonSnippet(str: string): string {
  return str
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Remove trailing commas before closing braces/brackets
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function extractJsonObjectsFromBlock(blockText: string): any[] {
  const sanitized = sanitizeJsonSnippet(blockText);
  try {
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Fallback: multiple concatenated JSON objects e.g. { "op": ... } { "op": ... }
    const objects: any[] = [];
    const braceRegex = /\{[\s\S]*?\}(?=\s*(?:\{|$))/g;
    const matches = sanitized.match(braceRegex);
    if (matches) {
      for (const m of matches) {
        try {
          const p = JSON.parse(sanitizeJsonSnippet(m));
          if (p && typeof p === 'object') objects.push(p);
        } catch {
          /* skip unparseable slice */
        }
      }
    }
    return objects;
  }
}

export function parseActionBlocks(reply: string): ActionBlock[] {
  const actions: ActionBlock[] = [];
  // Match fenced blocks with storyforge-action / json / jsonc or no tag
  const matches = [
    ...reply.matchAll(/```(?:storyforge-action|json|jsonc)?[\s\r\n]*([\s\S]*?)```/gi),
  ];

  const rawBlocks = matches.map((m) => m[1]);

  // If no fenced blocks found, attempt to find raw action JSON structures
  if (rawBlocks.length === 0) {
    const rawActionRegex = /\{\s*"op"\s*:\s*"(?:create|update|delete)"[\s\S]*?\}/g;
    const rawMatches = reply.match(rawActionRegex);
    if (rawMatches) {
      rawBlocks.push(...rawMatches);
    }
  }

  for (const block of rawBlocks) {
    const rawList = extractJsonObjectsFromBlock(block);
    for (const obj of rawList) {
      if (!obj || typeof obj !== 'object') continue;
      const validOp = obj.op === 'create' || obj.op === 'update' || obj.op === 'delete';
      let entity = normalizeEntityName(obj.entity);
      if (
        !entity &&
        (obj.op === 'update' || obj.op === 'delete') &&
        obj.match &&
        typeof obj.match.byName === 'string'
      ) {
        // entity resolved later by caller via resolveEntityTarget across types
        entity = obj.entity as EntityType;
      }
      const validEntity =
        !!entity ||
        ((obj.op === 'update' || obj.op === 'delete') &&
          obj.match &&
          typeof obj.match.byName === 'string');
      const hasTarget =
        obj.op === 'create'
          ? typeof obj.prompt === 'string' || (obj.data && typeof obj.data === 'object')
          : !!(obj.match && typeof obj.match.byName === 'string');
      if (validOp && validEntity && hasTarget) {
        actions.push({ ...obj, entity } as ActionBlock);
      }
    }
  }
  return actions;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateActionBlock(block: ActionBlock): ValidationResult {
  const ops = ['create', 'update', 'delete'];
  if (!ops.includes(block.op)) return { valid: false, error: `invalid op: ${block.op}` };
  if (!ALLOWED_ENTITIES.includes(block.entity))
    return { valid: false, error: `invalid entity: ${block.entity}` };
  if (block.op === 'create' && !block.prompt && (!block.data || typeof block.data !== 'object'))
    return { valid: false, error: 'create requires a prompt or data' };
  if ((block.op === 'update' || block.op === 'delete') && !block.match?.byName)
    return { valid: false, error: `${block.op} requires match.byName` };
  if (block.op === 'update' && !block.prompt && (!block.data || typeof block.data !== 'object'))
    return { valid: false, error: 'update requires a prompt or data' };
  return { valid: true };
}

export const PERSIAN_FIELD_MAP: Record<string, string> = {
  'نام': 'name',
  'عنوان': 'title',
  'لقب': 'title',
  'شرح': 'description',
  'توصیف': 'description',
  'توضیح': 'description',
  'توضیحات': 'description',
  'شرح مکان و ظاهر': 'description',
  'شرح مکان': 'description',
  'ناحیه': 'region',
  'منطقه': 'region',
  'ناحیه / منطقه': 'region',
  'سطح خطر': 'dangerLevel',
  'سطح_خطر': 'dangerLevel',
  'خطر': 'dangerLevel',
  'فضاسازی': 'atmosphere',
  'فضاسازی و لحن': 'atmosphere',
  'لحن': 'atmosphere',
  'جو': 'atmosphere',
  'اتمسفر': 'atmosphere',
  'دسته‌بندی': 'category',
  'دستهبندی': 'category',
  'دسته‌بندی مکان': 'category',
  'دستهبندی مکان': 'category',
  'دسته': 'category',
  'والد': 'parentLocationName',
  'مکان والد': 'parentLocationName',
  'موقعیت بالادست': 'parentLocationName',
  'موقعیت بالادست / در بر گیرنده': 'parentLocationName',
  'در بر گیرنده': 'parentLocationName',
  'قوانین خاص': 'specialRules',
  'قوانین خاص مکان': 'specialRules',
  'قوانین ویژه': 'specialRules',
  'قوانین ویژه مکان': 'specialRules',
  'قوانین مکان': 'specialRules',
  'قوانین': 'specialRules',
  'قلمرو': 'territoryIds',
  'قلمروها': 'territoryIds',
  'اهداف علنی': 'publicGoals',
  'اهداف': 'publicGoals',
  'دستور کار پنهان': 'secretAgendas',
  'اهداف پنهان': 'secretAgendas',
  'گرایش': 'alignment',
  'نقش': 'role',
  'گونه': 'speciesCategory',
  'دسته موجود': 'speciesCategory',
  'حوزه': 'domain',
  'قلمرو ایزدی': 'domain',
  'نماد مقدس': 'sacredSymbol',
  'باور اصلی': 'coreDogma',
  'اصول': 'coreDogma',
  'خطوط قرمز': 'taboos',
  'حرمت‌ها': 'taboos',
  'مواهب': 'divineBlessings',
  'برکت‌ها': 'divineBlessings',
  'نادرستی': 'rarity',
  'کمیابی': 'rarity',
  'قدرت‌ها': 'powers',
  'قدرت': 'powers',
  'نفرین': 'curseOrCost',
  'هزینه': 'curseOrCost',
  'قانون': 'rule',
  'اصل': 'rule',
  'سال یا دوره': 'yearOrEra',
  'دوره': 'yearOrEra',
  'اهمیت': 'significance',
};

export function normalizeEntity(entity: EntityType, data: any): any {
  if (!data || typeof data !== 'object') return data;
  const res: Record<string, any> = { ...data };

  // Map Persian / natural language keys to canonical schema keys
  for (const [k, v] of Object.entries(data)) {
    const rawTrimmed = k.trim();
    const cleanKey = rawTrimmed.replace(/\s*\(.*?\)\s*/g, '').trim();
    let mapped = PERSIAN_FIELD_MAP[cleanKey] || PERSIAN_FIELD_MAP[rawTrimmed];

    if (!mapped) {
      if (/^نام(\s+|$)/.test(cleanKey)) mapped = 'name';
      else if (/^(شرح|توصیف|توضیح)/.test(cleanKey)) mapped = 'description';
      else if (/^(ناحیه|منطقه)/.test(cleanKey)) mapped = 'region';
      else if (/خطر/.test(cleanKey)) mapped = 'dangerLevel';
      else if (/^(فضاسازی|لحن|اتمسفر|جو)/.test(cleanKey)) mapped = 'atmosphere';
      else if (/^(والد|بالادست|در\s*بر\s*گیرنده|موقعیت\s*بالادست)/.test(cleanKey) || /بالادست/.test(cleanKey)) mapped = 'parentLocationName';
      else if (/^(دسته|دسته‌بندی|دستهبندی)/.test(cleanKey)) mapped = 'category';
      else if (/^قوانین(\s+|$)/.test(cleanKey) || /قوانین/.test(cleanKey)) mapped = 'specialRules';
    }

    if (mapped && !(mapped in res)) {
      res[mapped] = v;
    }
  }

  // Ensure unique canonical ID if not present
  if (!res.id) {
    const prefix: Record<EntityType, string> = {
      faction: 'fac',
      location: 'loc',
      npc: 'npc',
      artifact: 'art',
      creature: 'creature',
      deity: 'deity',
      timeline_event: 'evt',
      world_law: 'law',
    };
    res.id = `${prefix[entity]}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // Type-specific field sanitation & normalization
  if (entity === 'location') {
    if (typeof res.dangerLevel === 'string') {
      const parsedNum = parseInt(res.dangerLevel.match(/\d+/)?.[0] || '1', 10);
      res.dangerLevel = Math.max(1, Math.min(5, isNaN(parsedNum) ? 1 : parsedNum));
    } else if (typeof res.dangerLevel === 'number') {
      res.dangerLevel = Math.max(1, Math.min(5, Math.round(res.dangerLevel)));
    } else {
      res.dangerLevel = 1;
    }

    const validCategories = ['settlement', 'wilderness', 'dungeon', 'sanctuary', 'ruin', 'anomaly'];
    if (res.category) {
      const catLower = String(res.category).toLowerCase();
      if (
        catLower.includes('طبیعت') ||
        catLower.includes('بیابان') ||
        catLower.includes('wild') ||
        catLower.includes('کویر') ||
        catLower.includes('دشت') ||
        catLower.includes('جنگل') ||
        catLower.includes('کوه') ||
        catLower.includes('گذرگاه') ||
        catLower.includes('دره')
      ) {
        res.category = 'wilderness';
      } else if (catLower.includes('سیاه‌چال') || catLower.includes('دخمه') || catLower.includes('غار') || catLower.includes('dungeon') || catLower.includes('cave')) {
        res.category = 'dungeon';
      } else if (catLower.includes('مقدس') || catLower.includes('معبد') || catLower.includes('پناهگاه') || catLower.includes('آرامگاه') || catLower.includes('sanct')) {
        res.category = 'sanctuary';
      } else if (catLower.includes('ویرانه') || catLower.includes('خرابه') || catLower.includes('متروکه') || catLower.includes('ruin')) {
        res.category = 'ruin';
      } else if (catLower.includes('ناهنجاری') || catLower.includes('جادویی') || catLower.includes('پرتگاه') || catLower.includes('anom')) {
        res.category = 'anomaly';
      } else if (catLower.includes('شهر') || catLower.includes('روستا') || catLower.includes('آبادی') || catLower.includes('قلعه') || catLower.includes('دژ') || catLower.includes('بندر') || catLower.includes('settle')) {
        res.category = 'settlement';
      } else if (!validCategories.includes(res.category)) {
        res.category = 'settlement';
      }
    } else {
      res.category = 'settlement';
    }

    if (typeof res.specialRules === 'string') {
      res.specialRules = res.specialRules
        .split(/\r?\n+/)
        .map((s: string) => s.replace(/^[-*•\d+.)]\s*/, '').trim())
        .filter((s: string) => s.length > 0);
    } else if (!Array.isArray(res.specialRules)) {
      res.specialRules = [];
    }
    if (!Array.isArray(res.connectedLocationIds)) res.connectedLocationIds = [];
  } else if (entity === 'faction') {
    if (!Array.isArray(res.territoryIds)) res.territoryIds = [];
    if (!Array.isArray(res.alliedFactionIds)) res.alliedFactionIds = [];
    if (!Array.isArray(res.rivalFactionIds)) res.rivalFactionIds = [];
    const validScopes = ['street', 'regional', 'continental', 'mythic'];
    if (!validScopes.includes(res.scope)) res.scope = 'regional';
  } else if (entity === 'npc') {
    if (!Array.isArray(res.personalityTraits)) res.personalityTraits = [];
    if (!Array.isArray(res.goals)) res.goals = [];
    if (!Array.isArray(res.secrets)) res.secrets = [];
    if (typeof res.initialTrust !== 'number') res.initialTrust = 0;
  } else if (entity === 'artifact') {
    if (!Array.isArray(res.powers)) res.powers = [];
    const validRarities = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    if (!validRarities.includes(res.rarity)) res.rarity = 'rare';
  } else if (entity === 'creature') {
    if (!Array.isArray(res.weaknesses)) res.weaknesses = [];
    if (!Array.isArray(res.resistances)) res.resistances = [];
    if (!Array.isArray(res.harvestableLoot)) res.harvestableLoot = [];
    if (typeof res.dangerLevel === 'number') {
      res.dangerLevel = Math.max(1, Math.min(5, Math.round(res.dangerLevel)));
    } else {
      res.dangerLevel = 2;
    }
  } else if (entity === 'deity') {
    if (!Array.isArray(res.taboos)) res.taboos = [];
    if (!Array.isArray(res.divineBlessings)) res.divineBlessings = [];
    if (!Array.isArray(res.holyLocationIds)) res.holyLocationIds = [];
    if (!Array.isArray(res.affiliatedFactionIds)) res.affiliatedFactionIds = [];
  } else if (entity === 'timeline_event') {
    if (res.knownByPublic === undefined) res.knownByPublic = true;
  } else if (entity === 'world_law') {
    res.isImmutable = true;
  }

  return res;
}

export function buildActionProtocolSection(isPersian: boolean): string {
  const ENUM = ALLOWED_ENTITIES.join(' | ');
  if (isPersian) {
    return `\n\nپروتکل عملیات — برای ایجاد، ویرایش یا حذف موجودیت‌های جهان، بلوک(های) کد زیر را بدون متن اضافه صادر کن. اگر نویسنده تغییرات چند موجودیت را همزمان خواست، برای هر موجودیت یک بلوک مجزا صادر کن تا تمام آن‌ها در پنل تغییرات ثبت شوند. فقط زمانی صادر کن که نویسنده صراحتاً درخواست کرده باشد.
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
نکات کلیدی ثبت مستقیم (Easy Insert):
- برای ایجاد مستقیم وقتی کاربر مشخصات ارائه کرده، حتماً از فیلد "data" استفاده کن و تمام فیلدهای نویسنده را کلمه به کلمه کپی کن.
- هرگز فیلد "description" (شرح مکان و ظاهر) را حذف یا خالی نگذار.
- اگر نویسنده دسته‌بندی مکان (Category) را ارائه داد (مانند طبیعت وحشی، بیابان، کویر، دشت، کوهستان، جنگل)، مقدار مناسب از دسته‌های مجاز را در "category" بگذار: "wilderness" (برای طبیعت وحشی/بیابان/دشت/کوهستان)، "settlement" (برای شهر/روستا/آبادی)، "dungeon" (برای سیاهچال/دخمه/غار)، "sanctuary" (برای معبد/مکان مقدس)، "ruin" (برای خرابه/ویرانه)، یا "anomaly" (برای ناهنجاری جادویی).
- اگر نویسنده «قوانین ویژه مکان» یا قوانین خاصی تعیین کرده است، آن‌ها را حتماً در آرایه "specialRules" در شیء data قرار بده.
- برای create خلاقانه از "prompt" استفاده کن. برای update/delete فیلد "match":{"byName":"<نام موجودیت موجود>"} الزامی است. نکته: خدایان، ایزدان، ادیان، پانتئون‌ها و فرقه‌ها همگی موجودیت «deity» هستند.`;
  }
  return `\n\nACTION PROTOCOL — To create, modify, or delete world entities, emit fenced code blocks matching the formats below with no extra prose. When the author's request spans multiple entities (such as configuring relations across several factions), emit a separate storyforge-action block for EACH affected entity. Only emit action blocks when the author explicitly requests them.
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
Easy Insert rules:
- For direct insertion where the author already drafted fields, use "data" to register their exact text with zero AI drift.
- NEVER drop the "description" field when provided by the author.
- Map the location category accurately: "wilderness" (wilds, deserts, plains, mountains, forests), "settlement" (cities, towns, villages), "dungeon" (caves, dungeons), "sanctuary" (holy sites, temples), "ruin" (ruins), "anomaly" (magical anomalies).
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
        'تنوع مضمونی: در ایده‌پردازی، طراحی شخصیت‌ها، عوارض جادو و عتیقه‌ها، از تکرار بیش از حد مفاهیم مربوط به «خاطره، فراموشی یا قربانی کردن خاطرات» خودداری کن. این موضوع را فقط به صورت موردی و نادر به کار ببر و دایره مضامین را به کیمیاگری سیاه، نفرین‌های بدنی، سنگینی فلزات، دسیسه‌های درباری و پیمان‌های خونی گسترش بده.',
        'قوانین عتیقه‌ها و نفرین‌ها: نفرین‌ها و بهای منفی سنگین را منحصراً برای رده‌های افسانه‌ای (Legendary) و اسطوره‌ای (Mythic) اعمال کن. آیتم‌های رده نامعمول (Uncommon)، کمیاب (Rare) و حماسی (Epic) باید بدون نفرین (curseOrCost: "") با کارایی مثبت و تمیز طراحی شوند.',
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
        'THEMATIC DIVERSITY: Do not overuse memory loss, forgotten pasts, or memory sacrifice tropes. Use memory-related lore sparingly and draw broadly from other dark-fantasy concepts (e.g. bodily corruption, blood oaths, political intrigue, ancient artifacts, environmental hazards).',
        'ARTIFACT CURSE RULES: Reserve curses and severe negative costs strictly for Legendary and Mythic artifacts. Uncommon, Rare, and Epic items must have no curses (curseOrCost: "") and provide clean, empowering utility without punitive drawbacks.',
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


// Lightweight, deterministic lore-gap detector used for the proactive
// "Lore Gap Radar" chips in the chat UI.
export function detectLoreGaps(
  wb: WorldBible | undefined,
  isPersian: boolean
): string[] {
  const w = wb || ({} as WorldBible);
  const gaps: string[] = [];
  const factions = (w as any).factions || [];
  const locations = (w as any).locations || [];
  const npcs = (w as any).npcs || [];
  const laws = (w as any).laws || [];
  const deities = (w as any).religions || [];

  if (factions.length === 0)
    gaps.push(isPersian ? 'هیچ جناحی تعریف نشده است' : 'No factions defined');
  if (locations.length === 0)
    gaps.push(isPersian ? 'هیچ مکانی تعریف نشده است' : 'No locations defined');
  if (npcs.length === 0)
    gaps.push(isPersian ? 'هیچ شخصیتی تعریف نشده است' : 'No characters defined');
  if (laws.length === 0)
    gaps.push(isPersian ? 'هیچ قانون جهانی وضع نشده است' : 'No world laws defined');
  if (factions.length > 0 && !laws.some((l: any) => l.category === 'magic'))
    gaps.push(isPersian ? 'قانون جادویی ندارید' : 'No magic law');
  const orphanFactions = factions.filter(
    (f: any) => !(Array.isArray(f.territoryIds) && f.territoryIds.length > 0)
  );
  if (orphanFactions.length > 0)
    gaps.push(
      isPersian
        ? `${orphanFactions.length} جناح بدون قلمرو`
        : `${orphanFactions.length} faction(s) without territory`
    );
  const deityNoSite = deities.filter(
    (d: any) => !(Array.isArray(d.holyLocationIds) && d.holyLocationIds.length > 0)
  );
  if (deities.length > 0 && deityNoSite.length > 0)
    gaps.push(
      isPersian
        ? `${deityNoSite.length} دین بدون مکان مقدس`
        : `${deityNoSite.length} faith(s) without a holy site`
    );

  return gaps.slice(0, 5);
}
