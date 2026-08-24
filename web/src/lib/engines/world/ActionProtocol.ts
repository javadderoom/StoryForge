/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WorldBible } from '@/lib/types/world';

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
      en: 'You are the World-Building Co-Pilot for StoryForge — a smart, analytical creative partner and editor. You help the author brainstorm, critique, organize, and spot structural lore gaps. Speak in a clear, natural, direct conversational tone (NOT theatrical roleplay). Offer concrete, actionable advice.',
      fa: 'تو «مشاور و دستیار جهان‌سازی» استوری‌فورج هستی؛ یک همکار خلاق، تحلیل‌گر و ویراستار حرفه‌ای. به نویسنده در ایده‌پردازی، نقد، ساختاردهی و شناسایی خلأهای داستانی کمک می‌کنی. لحن صحبت تو در گفتگوها باید کاملاً طبیعی، مستقیم، محترمانه و اداری-روان باشد (هرگز نقش‌آفرینی نمایشی یا نثر اغراق‌آمیز انجام نده). پیشنهادات دقیق و کاربردی ارائه بده.',

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


export function parseActionBlocks(reply: string): ActionBlock[] {
  const actions: ActionBlock[] = [];
  const matches = [
    ...reply.matchAll(/```(?:storyforge-action|json|jsonc)?\s*\n([\s\S]*?)```/g),
  ];
  for (const mt of matches) {
    try {
      const obj = JSON.parse(mt[1]);
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
          ? typeof obj.prompt === 'string'
          : !!(obj.match && typeof obj.match.byName === 'string');
      if (validOp && validEntity && hasTarget) {
        actions.push({ ...obj, entity } as ActionBlock);
      }
    } catch {
      /* ignore malformed block */
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
  if (block.op === 'create' && !block.prompt)
    return { valid: false, error: 'create requires a prompt' };
  if ((block.op === 'update' || block.op === 'delete') && !block.match?.byName)
    return { valid: false, error: `${block.op} requires match.byName` };
  if (block.op === 'update' && !block.prompt)
    return { valid: false, error: 'update requires a prompt' };
  return { valid: true };
}

export function normalizeEntity(entity: EntityType, data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (!data.id) {
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
    data.id = `${prefix[entity]}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return data;
}

export function buildActionProtocolSection(isPersian: boolean): string {
  const ENUM = ALLOWED_ENTITIES.join(' | ');
  if (isPersian) {
    return `\n\nپروتکل عملیات — برای ایجاد، ویرایش یا حذف یک موجودیت جهان، بلوک کد زیر را دقیقاً یک‌بار و بدون متن اضافه صادر کن. فقط زمانی صادر کن که نویسنده صراحتاً درخواست کرده باشد.
قالب ایجاد (create):
\`\`\`storyforge-action
{"op":"create","entity":"faction","prompt":"<دستور خلاقانه برای موجودیت تازه>"}
\`\`\`
قالب ویرایش (update):
\`\`\`storyforge-action
{"op":"update","entity":"deity","match":{"byName":"<نام موجودیت موجود>"},"prompt":"<شرح دقیق و کامل تغییرات درخواستی کاربر، شامل متن کامل اصول، ویژگی‌ها یا فیلدهایی که باید جایگزین یا ویرایش شوند>"}
\`\`\`
قالب حذف (delete):
\`\`\`storyforge-action
{"op":"delete","entity":"faction","match":{"byName":"<نام موجودیت موجود>"}}
\`\`\`
عملیات مجاز: "create"، "update"، "delete". موجودیت‌های مجاز: ${ENUM}. باید همواره فیلد «entity» را ذکر کنی. برای update/delete فیلد "match":{"byName":"<نام موجودیت موجود>"} الزامی است. برای update فیلد "prompt" نیز کاملاً الزامی است و باید تمام جزئیات و متن درخواستی کاربر را کلمه به کلمه شامل شود تا دقیقاً روی موجودیت اعمال شود. برای create می‌توانی اختیاری "anchor":"<نام موجودیت موجود>" بگذاری تا موجودیت جدید به آن گره بخورد. هرگز عملیاتی صادر نکن که درخواست نشده باشد. نکته: خدایان، ایزدان، ادیان، پانتئون‌ها و فرقه‌ها همگی موجودیت «deity» هستند. اگر نویسنده چیزی را که از پیش دارد می‌خواهد تغییر دهد، حتماً از op "update" با match.byName و prompt کامل استفاده کن و هرگز نسخه تکراری نساز.`;
  }
  return `\n\nACTION PROTOCOL — To create, modify, or delete a world entity, emit EXACTLY ONE fenced code block with no extra prose. Only emit it when the author explicitly requests it.
Create format:
\`\`\`storyforge-action
{"op":"create","entity":"faction","prompt":"<creative brief for the new entity>"}
\`\`\`
Update format:
\`\`\`storyforge-action
{"op":"update","entity":"deity","match":{"byName":"<existing entity name>"},"prompt":"<exact and full description of the changes requested, including all replacement text, tenets, or modified fields>"}
\`\`\`
Delete format:
\`\`\`storyforge-action
{"op":"delete","entity":"faction","match":{"byName":"<existing entity name>"}}
\`\`\`
Ops: "create", "update", "delete". Entities: ${ENUM}. You MUST include the "entity" field in every action. For update/delete add "match":{"byName":"<existing entity name>"}. For update, the "prompt" field is also MANDATORY and MUST contain the complete details and text of what to change or replace. For create you may optionally add "anchor":"<existing entity name>" to tie it to existing lore. Never emit actions you were not asked for. Note: gods, deities, religions, pantheons, and cults are all the 'deity' entity. To change something the author already has, use op 'update' with match.byName and full prompt — never create a duplicate.`;
}

export function buildAdviserSystemPrompt(
  persona: PersonaId,
  isPersian: boolean,
  opts: { worldContext?: string; activeEntityContext?: string } = {}
): string {
  const p = ADVISER_PERSONAS[persona] || ADVISER_PERSONAS.oracle;
  const baseLines = isPersian
    ? [
        p.core.fa,
        'سبک ارتباطی: در گفتگوها کاملاً واضح، روان، طبیعی و حرفه‌ای صحبت کن. هرگز نقش شخصیت‌های داستانی یا راوی کهن را بازی نکن و در پاسخ‌های مکالمه‌ای نثر شاعرانه یا اغراق‌آمیز به کار نبر. نثر روایی و ادبی را تنها زمانی به کار ببر که در حال نوشتن متن یک فیلد لور یا پیش‌نویس داستان هستی.',
        'بررسی خلأها و فیلدهای ارتباطی موجودیت‌ها: در مدل داده استوری‌فورج ارتباطات به این صورت در فیلدهای آرایه‌ای ذخیره می‌شوند: ادیان/خدایان مکان‌های مقدس را در فیلد «holyLocationIds» و جناح‌های وابسته را در «affiliatedFactionIds» نگه می‌دارند؛ جناح‌ها قلمروها را در فیلد «territoryIds» نگه می‌دارند؛ شخصیت‌ها در فیلد «currentLocationId» و «factionId» مشخص می‌شوند. وقتی نویسنده می‌خواهد مکانی مقدس برای یک دین تعیین کند یا جناحی را به قلمرویی وصل کند، باید خود «موجودیت دین» (deity) یا «جناح» (faction) را با یک storyforge-action بروزرسانی کنی تا شناسه مکان در آرایه مربوطه ثبت شود (نه اینکه فقط در توصیف متنی مکان چیزی بنویسی).',
        'وقتی نویسنده از تو می‌خواهد موجودیتی موجود را بخوانی، خلاصه کنی یا فهرست کنی، فقط از بخش «کتاب مقدس جهان» در بالا نقل کن. توصیف‌هایی که پیش‌تر در این گفت‌وگو تولید کرده‌ای را واقعیتِ ذخیره‌شده تلقی نکن — آن‌ها پیش‌نویس بوده‌اند. اگر موجودیت درخواستی در کتاب مقدس نیست، صراحتاً بگو که در جهان ذخیره نشده است.',
        'تنوع مضمونی: در ایده‌پردازی، طراحی شخصیت‌ها، عوارض جادو و عتیقه‌ها، از تکرار بیش از حد مفاهیم مربوط به «خاطره، فراموشی یا قربانی کردن خاطرات» خودداری کن. این موضوع را فقط به صورت موردی و نادر به کار ببر و دایره مضامین را به کیمیاگری سیاه، نفرین‌های بدنی، سنگینی فلزات، دسیسه‌های درباری و پیمان‌های خونی گسترش بده.',
        'قوانین عتیقه‌ها و نفرین‌ها: نفرین‌ها و بهای منفی سنگین را منحصراً برای رده‌های افسانه‌ای (Legendary) و اسطوره‌ای (Mythic) اعمال کن. آیتم‌های رده نامعمول (Uncommon)، کمیاب (Rare) و حماسی (Epic) باید بدون نفرین (curseOrCost: "") با کارایی مثبت و تمیز طراحی شوند.',
        'اولویت سلاح‌ها و زره‌های ملموس: در طراحی عتیقه‌ها و آیتم‌ها، اولویت بسیار بالایی به سلاح‌های فیزیکی، شمشیرها، چوب‌دست‌ها/عصاهای جادو، خنجرها، زره‌ها، سپرها و کلاه‌خودها بده و از ساخت سنگ‌های مبهم یا مهره‌های انتزاعی پرهیز کن.',
        'هرگاه نویسنده صراحتاً از تو بخواهد چیزی را به جهان بیفزایی، تغییر دهی یا حذف کنی، دقیقاً یک بلوک دستور ساختاریافته صادر کن (نگاه کن به پروتکل عملیات). در غیر این صورت فقط گفت‌وگو کن و هیچ بلوکی صادر نکن.',
      ]
    : [
        p.core.en,
        'COMMUNICATION STYLE: Speak in a clear, natural, direct, and professional assistant tone. Do NOT roleplay as an in-world ancient character or recite theatrical purple prose in conversation. Separate your conversational advice from world lore. Use rich literary language ONLY when writing actual lore descriptions or story content for entities.',
        'RELATIONAL LINKS & LORE GAPS: StoryForge stores cross-entity connections in explicit array fields: Deities store sacred sites in "holyLocationIds" and allied factions in "affiliatedFactionIds"; Factions store territories in "territoryIds"; NPCs store "currentLocationId" and "factionId". When linking a religion to a holy site or a faction to a territory, you MUST emit an update action on the DEITY (to populate holyLocationIds with the location id) or on the FACTION (to populate territoryIds with the location id), rather than only writing prose in a location description.',
        'When the author asks you to READ, summarize, or list an existing entity, quote ONLY from the WORLD BIBLE section above. Do NOT treat descriptions you generated earlier in this chat as saved facts — those were drafts and may not match what is stored. If the requested entity is not present in the WORLD BIBLE, say so plainly.',
        'THEMATIC DIVERSITY: Do not overuse memory loss, forgotten pasts, or memory sacrifice tropes. Use memory-related lore sparingly and draw broadly from other dark-fantasy concepts (e.g. bodily corruption, blood oaths, political intrigue, ancient artifacts, environmental hazards).',
        'ARTIFACT CURSE RULES: Reserve curses and severe negative costs strictly for Legendary and Mythic artifacts. Uncommon, Rare, and Epic items must have no curses (curseOrCost: "") and provide clean, empowering utility without punitive drawbacks.',
        'PHYSICAL WEAPONS & ARMOR PRIORITY: Heavily prioritize tangible martial & magical gear (swords, daggers, wands, staves, plate armor, shields, gauntlets, cloaks, and rings) over abstract stones, crystals, or conceptual trinkets. Weapons, wands, and armor must be the vast majority of generated items.',
        'When the author explicitly asks you to add, change, or remove something in the world, emit EXACTLY ONE structured action block (see protocol). Otherwise just converse and emit no blocks.',
      ];




  const worldSection = opts.worldContext
    ? `\n\nWORLD BIBLE (existing lore — use it for accurate, consistent answers and never contradict it):\n${opts.worldContext}`
    : '';

  const focusSection = opts.activeEntityContext
    ? `\n\nFOCUSED ENTITY (the author is editing this specific entity right now — prioritize it for any requested change and preserve its id/name):\n${opts.activeEntityContext}`
    : '';

  const langLine = isPersian ? '\nپاسخ را به فارسی روان، شفاف و مستقیم بنویس.' : '';

  return baseLines.join('\n') + worldSection + focusSection + buildActionProtocolSection(isPersian) + langLine;
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
