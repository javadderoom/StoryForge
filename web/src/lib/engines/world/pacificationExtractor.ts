/**
 * Biological and Alchemical Pacification Entity Extractor
 * Extracts missing plant, mineral, animal, or reagent entities from
 * nonCombatPacificationMethod text for the bestiary ghost-species tracker.
 *
 * Hardening: Persian pacification prose is full of verb phrases
 * ("برای سرگرم کردن", "به دام انداختن") and prepositional fragments.
 * Without verb-awareness these leak in as ghost fauna. `add()` therefore
 * strips leading particles and rejects any candidate containing a
 * light-verb token before it can become a suggested entity.
 */

export type PacificationCategory = 'flora' | 'beast' | 'mineral';

export interface PacificationEntity {
  name: string;
  category: PacificationCategory;
}

export const isFloraName = (str: string) =>
  /گیاه|قارچ|گل|ریشه|نیلوفر|سنبل|گون|گَوَن|خزه|درخت|بوته|پیچک|علف|بذر|برگ|بلوط|کاج|نسترن|پونه|سدر|بابونه|زعفران|lotus|lily|mushroom|fungus|root|moss|bloom|herb|fern|ivy|berry/i.test(str);

export const isMineralName = (str: string) =>
  /نمک|گوگرد|بلور|کریستال|ابسیدین|معدنی|سنگ|جیوه|کانی|یاقوت|زمرد|عقیق|خاکستر|شفق|سیلیس|کوارتز|چخماق|آهک|شوره|salt|mineral|ore|crystal|obsidian|sulfur|brimstone|quartz|gem/i.test(str);

export const resolveSuggestedCategory = (str: string): PacificationCategory => {
  if (isMineralName(str)) return 'mineral';
  if (isFloraName(str)) return 'flora';
  return 'beast';
};

/** Leading prepositions / conjunctions / demonstratives that are never part of an entity name. */
const LEADING_PARTICLE_REGEX =
  /^(?:بر روی|روی|در|برای|به|با|از|تا|جهت|سپس|که|و|یا|چون|زیرا|اگر|هنگام|هنگامی|پس|نیز|هم|را|این|آن)\s+/u;

/**
 * Persian light-verb tokens. Any candidate containing one as a standalone
 * token is an action description, not an entity ("سرگرم کردن" = to entertain,
 * "به دام انداختن" = to trap, "آرام شدن" = to calm down).
 */
const VERB_TOKENS = new Set([
  'کردن', 'شدن', 'نمودن', 'فرمودن', 'ساختن', 'دادن', 'گرفتن', 'آوردن', 'بردن',
  'رفتن', 'آمدن', 'دیدن', 'شنیدن', 'خوردن', 'نوشیدن', 'آشامیدن', 'پوشیدن', 'انداختن',
  'کرد', 'شد', 'نمود', 'ساخت', 'داد', 'گرفت', 'آورد', 'برد', 'رفت', 'آمد',
  'دهد', 'کند', 'شود', 'شوند', 'کنند', 'دهند', 'سازند', 'کن', 'شو', 'ده', 'گیر',
]);

/** Returns true when the candidate is a verb phrase rather than a nameable entity. */
export function isVerbPhrase(clean: string): boolean {
  const tokens = clean.split(/[\s\u200C\u200D]+/).filter(Boolean);
  return tokens.some((t) => VERB_TOKENS.has(t));
}

export function extractPacificationEntities(text: string): PacificationEntity[] {
  if (!text || typeof text !== 'string') return [];
  const results: PacificationEntity[] = [];
  const seen = new Set<string>();

  const add = (rawName: string, explicitCat?: PacificationCategory) => {
    let clean = rawName
      .replace(/[ً-ٰٟ]/g, '') // strip diacritics like Fat-ha in گَوَن
      .replace(/[«»"'״]/g, '')
      .trim();

    // Strip common action, preparation, and sensory adjective prefixes iteratively
    const prefixRegex = /^(?:پاشیدن|مالیدن|خوراندن|تعارف|دود کردن|سوزاندن|استخراج|ریختن|آغشتن|عصارهٔ?|روغن|پودر|شیرهٔ?|دم‌کردهٔ?|جوشاندهٔ?|تخم|ریشه(?:های|‌های)?|ریشهٔ?|برگ(?:های|‌های)?|گلبرگ(?:های|‌های)?|بلور(?:های|‌های)?|بلور|گیاه|قارچ|تخمیرشدهٔ?|تخمیرشده|غلیظ شدهٔ?|غلیظ‌شدهٔ?|خشک شدهٔ?|خشک‌شدهٔ?|ساییده شدهٔ?|ساییدهٔ?|پختهٔ?|خام|تازهٔ?|تلخ|غلیظ|شور|تند|خالص|ناخالص|و)\s+/gu;
    let prev = '';
    while (prev !== clean) {
      prev = clean;
      clean = clean.replace(prefixRegex, '').trim();
    }

    // Strip leading prepositions / conjunctions / demonstratives iteratively.
    // Without this, "برای سرگرم کردن" survives intact: the trailing-particle
    // strip below requires whitespace BEFORE the particle, which fails when
    // the particle opens the phrase — and the verb phrase then leaks in as fauna.
    let prevLead = '';
    while (prevLead !== clean) {
      prevLead = clean;
      clean = clean.replace(LEADING_PARTICLE_REGEX, '').trim();
    }

    // Strip trailing sensory adjectives
    const suffixAdjectives = /\s+(?:خالص|ناخالص|تلخ|شیرین|غلیظ|شور|تند|تازه|کهنه|خام|پخته|ساییده|آسیاب‌شده)$/gu;
    clean = clean.replace(suffixAdjectives, '').trim();

    // Strip trailing prepositional particles and stop words
    clean = clean.replace(/\s+(?:بر روی|روی|در|برای|به|با|که|تا|و|از|سپس|جهت|را).*$/gu, '').trim();

    if (!clean || clean.length < 2 || clean.length > 35) return;
    // Actions are not entities — drop verb phrases ("سرگرم کردن", "آرام شدن").
    if (isVerbPhrase(clean)) return;
    const norm = clean.toLowerCase();
    if (seen.has(norm)) return;
    seen.add(norm);

    const category = explicitCat || resolveSuggestedCategory(clean);
    results.push({ name: clean, category });
  };

  // 1. Quoted entities in text (e.g. «نیلوفر مردابی», "Silver Lotus")
  const quotes = text.match(/[«"']([^»"']{2,35})[»"']/g);
  if (quotes) {
    quotes.forEach((q) => add(q));
  }

  // 2. Split clauses on conjunctions (یا / و) and punctuation to prevent bleeding
  const fragments = text.split(/\s+یا\s+|[;؛\n]+/u);
  for (const frag of fragments) {
    // Direct Anchor words followed by regional/descriptive modifiers (e.g. "نمک معدنی", "گون کوهی", "نیلوفر مردابی")
    const directAnchorRegex = /(?:^|[\s«"'(،,;؛])(نیلوفر|سنبل|قارچ|خزه|پیچک|گَ?وَن|گون|گوزن|گرگ|خرس|گراز|شاهین|عقاب|افعی|مانتیکور|نمک|گوگرد|بلور|کوارتز|ابسیدین)\s+([\u0600-\u06FF]{2,20})(?=$|[\s»"')،,;؛])/gu;
    let match;
    while ((match = directAnchorRegex.exec(frag)) !== null) {
      add(`${match[1]} ${match[2]}`);
    }

    // Bio / Mineral prep patterns
    const bioAnchorsRegex = /(?:عصارهٔ?|روغن|پودر|شیرهٔ?|دم‌کردهٔ?|جوشاندهٔ?|ریشه(?:های|‌های)?|ریشهٔ?|برگ(?:های|‌های)?|گلبرگ(?:های|‌های)?|بذر|گوشت|خون|زهر|بلور|سنگ|نمک|کانی)\s+(?:(?:غلیظ شدهٔ?|غلیظ‌شدهٔ?|تخمیرشدهٔ?|تخمیرشده|خشک شدهٔ?|خشک‌شدهٔ?|ساییدهٔ?|پختهٔ?|تازهٔ?|خام|تلخ|غلیظ|شور|تند|خالص|ناخالص|و)\s+)*(?:(?:ریشه(?:های|‌های)?|ریشهٔ?|برگ(?:های|‌های)?|تخم|گیاه|سنگ|بلور)\s+)*([\u0600-\u06FF\s]{2,30}?)(?=\s+(?:بر روی|روی|در|برای|به|با|که|تا|و|از|سپس|جهت|را|[.,،;؛]|$))/gu;
    while ((match = bioAnchorsRegex.exec(frag)) !== null) {
      if (match[1]) {
        add(match[1]);
      }
    }
  }

  return results;
}
