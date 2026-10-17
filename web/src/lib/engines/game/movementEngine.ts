// ---------------------------------------------------------------------------
// Plan 15 (Pillar 4 / §7.3): deterministic micro-location (sub-zone) writer.
//
// The Flutter vitality bar renders "Macro • Micro" spatial presence, but
// `PlayerState.currentSubZoneId` had no writer — it was decorative. This
// parser rewrites the sub-zone pointer purely from reader actions with zero
// model calls — same deterministic philosophy as the party roster writer in
// `socialEngine.ts` (§2b¾): the writer LLM only narrates; state writes stay
// deterministic (see action route §2b¾½).
// ---------------------------------------------------------------------------

import { WorldLocation } from '../../types/world';

/** EN verbs that *attempt entry* into a named place. Entry additionally
 * requires an explicit sub-zone name match below, so ambient mentions of the
 * zone in prose descriptions never flip the pointer. */
const SUBZONE_ENTER_KEYWORDS_EN =
  /(?:^|\W)(enter(?:s|ed|ing)?|steps? into|walks? into|slips? into|descend(?:s|ed|ing)?|climbs? down|heads? (?:down|into|toward)|goes? down|went down|ventures? into|explores?|spelunk)(?:\W|$)/i;

/** FA entry verbs: first/third person motion toward a named place. */
const SUBZONE_ENTER_KEYWORDS_FA =
  /وارد|پایین می|فرود می|نزول می|حرکت به سمت|به سمت .* می|می ?رو(م|د) به|رفتن به|عبور به سمت/;

/** EN departure phrases that clear the active micro-location. */
const SUBZONE_LEAVE_KEYWORDS_EN =
  /(?:^|\W)(leaves?|exit(?:s|ed|ing)?|emerges?|climb(?:s)? (?:back )?out|steps? (?:back )?out|surfacing?|back (?:to|at) (?:the )?(?:open|main|hub|camp)|ascend(?:s|ed|ing)?|retrace(?:s)?)(?:\W|$)/i;

/** FA departure phrases that clear the active micro-location. */
const SUBZONE_LEAVE_KEYWORDS_FA = /ترک می|خارج می ?شو|بیرون می ?آ|بالا برمی ?گرد|برگشتن به|بازگشت به|از .* خارج می/;

/** Normalizes Latin + Persian text for robust matching: lowercase, drop ZWNJ,
 * strip diacritics/harakat (U+064B–U+0652) and tatweel, unify Arabic/Persian
 * look-alikes (ي/ی, ك/ک) so authored names match prose. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u200C/g, '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[ىي]/g, 'ی')
    .replace(/ك/g, 'ک');
}

/**
 * Zone-name match: single-token names must hit an exact token (a short
 * bilingual name like "رود"/"gulf" never lights up inside "درود"/"gulfport");
 * multi-token names use substring containment (so "کاروان‌گاه دشت‌بانان"
 * matches with or without a ZWNJ).
 */
function matchesZoneName(normalizedText: string, zoneName: string): boolean {
  const name = normalizeForMatch(zoneName).trim();
  if (name.length < 2) return false;
  if (/\s/.test(name)) return normalizedText.includes(name);
  const tokenPattern = /[^a-z\u0600-\u06FF]+/;
  return normalizedText.split(tokenPattern).includes(name);
}

export interface SubZoneChange {
  kind: 'enter' | 'leave';
  /** New micro-location on `enter`; `undefined` on `leave` (pointer cleared). */
  subZoneId?: string;
  subZoneName?: string;
  /** Localized consequence summary appended to the resolution. */
  note: string;
}

export interface SubZoneChangeOptions {
  isPersian?: boolean;
  /** Current micro-location pointer; required for honest `leave` detection. */
  currentSubZoneId?: string | null;
}

/** Pure detection for the action route. Null = no sub-zone change this turn. */
export function detectSubZoneChange(
  actionText: string,
  location: WorldLocation | null | undefined,
  opts: SubZoneChangeOptions = {}
): SubZoneChange | null {
  if (!actionText || !location?.subZones?.length) return null;
  const normalized = normalizeForMatch(actionText);
  const currentZone = opts.currentSubZoneId
    ? location.subZones.find((z) => z.id === opts.currentSubZoneId)
    : undefined;

  // Pass 1: which zones (if any) does the action name?
  const namedZones = location.subZones.filter((z) => matchesZoneName(normalized, z.name));

  // 1. Explicit departure clears the pointer — mentioning the zone being left
  //    is fine ("I climb back out of the Salt Gallery"); only a *different*
  //    named destination zone defers the leave to the entry pass.
  const namedOtherZones = namedZones.filter((z) => z.id !== currentZone?.id);
  if (
    currentZone &&
    namedOtherZones.length === 0 &&
    (SUBZONE_LEAVE_KEYWORDS_EN.test(normalized) || SUBZONE_LEAVE_KEYWORDS_FA.test(normalized))
  ) {
    const note = opts.isPersian
      ? `قهرمان از ${currentZone.name} خارج شد.`
      : `The protagonist leaves ${currentZone.name}.`;
    return { kind: 'leave', note };
  }

  // 2. Entry needs BOTH the zone name and a matching motion verb.
  for (const zone of namedZones) {
    if (!SUBZONE_ENTER_KEYWORDS_EN.test(normalized) && !SUBZONE_ENTER_KEYWORDS_FA.test(normalized)) {
      continue;
    }
    // Already occupying the named zone: only fatal when it is the sole
    // destination candidate; otherwise a later named zone may win
    // ("step out of the Salt Gallery and enter the Windswept Mouth").
    if (zone.id === opts.currentSubZoneId) {
      if (namedZones.length === 1) return null;
      continue;
    }
    const note = opts.isPersian
      ? `قهرمان به ${zone.name} وارد شد.`
      : `The protagonist enters ${zone.name}.`;
    return { kind: 'enter', subZoneId: zone.id, subZoneName: zone.name, note };
  }

  return null;
}
