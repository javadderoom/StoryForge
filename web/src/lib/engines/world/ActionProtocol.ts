import type { WorldBible } from '@/lib/types/world';
import {
  ALLOWED_ENTITIES,
  type EntityType,
} from './ActionProtocol.types';

// Re-export modular components for 100% backwards-compatibility
export * from './ActionProtocol.types';
export * from './ActionNormalizer';
export * from './ActionParser';
export * from './ActionPrompts';

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

/**
 * Checks if an entity with the given name (or close alias) already exists
 * in the WorldBible. Prevents duplicate creations in multi-turn Oracle sessions.
 */
export function findExistingEntityByName(
  wb: WorldBible | undefined,
  entity: EntityType,
  name: string
): any | undefined {
  if (!wb || !name || !name.trim()) return undefined;
  const arr = getEntityArray(wb, entity);
  if (!arr || arr.length === 0) return undefined;

  const targetRaw = name.trim();
  const targetNorm = normalizeSearchText(targetRaw);
  const targetBase = targetRaw.replace(/\([^)]*\)/g, '').trim().toLowerCase();

  return arr.find((item) => {
    const itemName = nameOf(entity, item);
    if (!itemName) return false;

    // 1. Direct case-insensitive match
    if (itemName.trim().toLowerCase() === targetRaw.toLowerCase()) return true;

    // 2. Normalized search text match (strips ZWNJ, diacritics, punctuation, Arabic/Persian variants)
    const itemNorm = normalizeSearchText(itemName);
    if (itemNorm && targetNorm && itemNorm === targetNorm) return true;

    // 3. Base name match (stripping parenthetical translations like "گذرگاه هیرام (Hiram Pass)")
    const itemBase = itemName.replace(/\([^)]*\)/g, '').trim().toLowerCase();
    if (itemBase && targetBase) {
      if (itemBase === targetBase) return true;
      if (normalizeSearchText(itemBase) === normalizeSearchText(targetBase)) return true;
    }

    return false;
  });
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
