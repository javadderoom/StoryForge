import type { WorldBible, WorldNpc } from '@/lib/types/world';

/**
 * Common Persian honorific, rank, and occupational prefixes that must NOT match
 * as a standalone given name when an NPC carries a full multi-word name
 * (e.g. "کاروان‌سالار رادمان دشت‌پیما" must not trigger on prose saying "کاروان‌سالار").
 */
const GENERIC_NPC_ROLE_PREFIXES = new Set([
  'کاروانسالار',
  'کاروان‌سالار',
  'فرمانده',
  'دادرس',
  'دادستان',
  'کدخدا',
  'استاد',
  'موبد',
  'ناخدا',
  'سرگزمه',
  'سردار',
  'ممیز',
  'بانو',
  'پیربزرگ',
  'master',
  'commander',
  'captain',
  'lord',
  'lady',
  'elder',
]);

/** Collective/group prefixes whose following tokens usually name a place or faction rather than a personal first name. */
const COLLECTIVE_GROUP_PREFIXES = new Set([
  'ساکنین',
  'ساربانان',
  'قراولان',
  'کمیننشینان',
  'کمین‌نشینان',
  'نیزه‌داران',
  'دیده‌بانان',
  'برادران',
  'گزمه‌های',
  'مسافران',
]);

/** Normalizes Persian/Arabic orthography and strips diacritics and punctuation for NPC discovery matching. */
export function normalizeNpcMatchText(text: string): string {
  return (text || '')
    .replace(/[\u200C\u200D\u200E\u200F\u00AD]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[.,،؟!؛:()«»"'`\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function proseSpacingVariants(normalizedProse: string): string[] {
  return normalizedProse.includes('‌')
    ? [normalizedProse, normalizedProse.replace(/‌/g, ' ')]
    : [normalizedProse];
}

/**
 * Resolves the first distinctive personal token for an NPC name (skipping generic title/role prefixes
 * so "کاروان‌سالار" in prose never falsely registers an unrelated distant caravan master, and
 * disabling single-token matching for collective groups like "ساکنین زرین پل").
 */
export function resolvePersonalFirstToken(normalizedName: string, isGroupTemplate?: boolean): string {
  const tokens = normalizedName.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return isGroupTemplate ? '' : tokens[0];
  if (isGroupTemplate || COLLECTIVE_GROUP_PREFIXES.has(tokens[0])) {
    return '';
  }
  if (GENERIC_NPC_ROLE_PREFIXES.has(tokens[0])) {
    return tokens[1] || '';
  }
  return tokens[0];
}

/**
 * Finds all NPCs whose full name, distinctive personal token, or title appears in any of the given text inputs.
 */
export function findMentionedNpcs(
  npcs: WorldNpc[],
  texts: string[],
  excludeIds?: Set<string>
): WorldNpc[] {
  const combinedNorm = texts.map(normalizeNpcMatchText).filter(Boolean).join(' ');
  if (!combinedNorm) return [];
  const combinedVariants = proseSpacingVariants(combinedNorm);
  const wordSet = new Set(combinedVariants.flatMap((v) => v.split(' ')));

  const matched: WorldNpc[] = [];
  for (const npc of npcs) {
    if (excludeIds?.has(npc.id)) continue;
    const normalizedName = normalizeNpcMatchText(npc.name || '');
    const normalizedTitle = normalizeNpcMatchText(npc.title || '');
    const nameForms = proseSpacingVariants(normalizedName);
    const personalToken = resolvePersonalFirstToken(normalizedName, npc.kind === 'template');

    const isMentioned = Boolean(
      (normalizedName && nameForms.some((f) => combinedNorm.includes(f))) ||
        (personalToken && wordSet.has(personalToken)) ||
        (normalizedTitle && combinedNorm.includes(normalizedTitle))
    );
    if (isMentioned) matched.push(npc);
  }
  return matched;
}

/** Resolves caravan master and retinue IDs traveling from an origin along a trade route. */
export function resolveDepartingCaravanCompanionIds(
  wb: WorldBible,
  routeId: string | undefined,
  originLocationId: string,
  existingCompanionIds: string[] = []
): string[] {
  if (!routeId) return [...existingCompanionIds];
  const route = (wb.tradeRoutes ?? []).find((r) => r.id === routeId);
  if (!route) return [...existingCompanionIds];

  const merged = new Set(existingCompanionIds);
  const candidateIds = [route.caravanMasterNpcId, ...(route.travelingNpcIds ?? [])].filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  for (const npcId of candidateIds) {
    const npc = (wb.npcs ?? []).find((n) => n.id === npcId);
    if (!npc) continue;
    if (
      npc.currentLocationId === originLocationId ||
      (npc.applicableLocationIds ?? []).includes(originLocationId)
    ) {
      merged.add(npc.id);
    }
  }
  return Array.from(merged);
}
