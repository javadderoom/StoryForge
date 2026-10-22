import type { WorldLocation } from '@/lib/types/world';
import { matchesZoneName, normalizeForMatch } from '@/lib/engines/game/travelEngine';
import { SOLVER_DEFAULTS, type DirectionalConstraint } from './types';

// ---------------------------------------------------------------------------
// Directional constraint extraction.
// ---------------------------------------------------------------------------

interface DirToken {
  token: string;
  axis: 'x' | 'y';
  sign: 1 | -1;
  /** Compound tokens win over their prefixes (longest match at an index). */
  length: number;
}

const DIR_TOKENS: DirToken[] = [
  { token: 'northeast', axis: 'x', sign: 1, length: 9 },
  { token: 'northwest', axis: 'x', sign: -1, length: 9 },
  { token: 'southeast', axis: 'x', sign: 1, length: 9 },
  { token: 'southwest', axis: 'x', sign: -1, length: 9 },
  { token: 'north', axis: 'y', sign: -1, length: 5 },
  { token: 'south', axis: 'y', sign: 1, length: 5 },
  { token: 'east', axis: 'x', sign: 1, length: 4 },
  { token: 'west', axis: 'x', sign: -1, length: 4 },
  { token: 'شمال', axis: 'y', sign: -1, length: 4 },
  { token: 'جنوب', axis: 'y', sign: 1, length: 4 },
  { token: 'شرق', axis: 'x', sign: 1, length: 3 },
  { token: 'غرب', axis: 'x', sign: -1, length: 3 },
];

/**
 * Sea/ocean/lake regions modeled as *locations* (common in these worlds: the
 * sea is a traversal node) prefer water polygons. Detected from the pin name in
 * FA + EN — deterministic, no schema change required.
 */
const WATER_REGION_RE =
  /(دریا|دریاچه|اقیانوس|خلیج|آبراه|تالاب|منطقهٔ دریایی|sea|ocean|lake|gulf|strait|bay|waters)/i;

export function prefersWaterRegion(loc: Pick<WorldLocation, 'name'>): boolean {
  return WATER_REGION_RE.test(loc?.name ?? '');
}

const WORD_CHAR = /[\u0600-\u06FFa-z0-9]/;

/**
 * Scans each location's own lore text for `DIR + other-location-name` within a
 * short window (~28 normalized chars) and compiles "A is north of B" into the
 * clamp `sign * (A[axis] - B[axis]) >= DIR_MIN_PROJ`. Known limitation (soft
 * weight): inverted-perspective prose ("the capital lies south of it") yields
 * the mirrored constraint — the auditor reports satisfaction counts instead of
 * treating this as canon-breaking.
 */
export function extractDirectionalConstraints(
  locations: WorldLocation[],
  weight = SOLVER_DEFAULTS.DIR_WEIGHT
): DirectionalConstraint[] {
  const constraints: DirectionalConstraint[] = [];
  const seen = new Set<string>();

  for (const loc of locations) {
    const block = [
      loc.description ?? '',
      loc.region ?? '',
      loc.atmosphere ?? '',
      ...(loc.specialRules ?? []),
    ]
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .join(' ');
    if (!block) continue;
    const norm = normalizeForMatch(block);

    for (let i = 0; i < norm.length; i += 1) {
      if (i > 0 && WORD_CHAR.test(norm[i - 1])) continue; // not a word start
      let matched: DirToken | null = null;
      for (const t of DIR_TOKENS) {
        if (matched && t.length <= matched.length) continue; // longest wins
        if (!norm.startsWith(t.token, i)) continue;
        if (WORD_CHAR.test(norm[i + t.token.length] ?? ' ')) continue; // prefix of a word
        matched = t;
      }
      if (!matched) continue;

      const window = norm.slice(i + matched.length, i + matched.length + SOLVER_DEFAULTS.DIR_WINDOW);
      if (!window || window.trim().length < 2) continue;

      for (const other of locations) {
        if (!other?.name || other.id === loc.id) continue;
        const name = normalizeForMatch(other.name).trim();
        if (name.length < 2) continue;
        if (!matchesZoneName(window, other.name)) continue;

        const key = `${loc.id}|${other.id}|${matched.axis}|${matched.sign}`;
        if (seen.has(key)) break;
        seen.add(key);
        constraints.push({
          sourceId: loc.id,
          targetId: other.id,
          axis: matched.axis,
          sign: matched.sign,
          weight,
          evidence: norm
            .slice(i, Math.min(norm.length, i + matched.length + SOLVER_DEFAULTS.DIR_WINDOW))
            .trim(),
        });
        break; // one target per direction occurrence
      }
      i += matched.length - 1; // the loop's i += 1 completes the skip
    }
  }

  return constraints.sort(
    (a, b) =>
      a.sourceId.localeCompare(b.sourceId) ||
      a.targetId.localeCompare(b.targetId) ||
      a.axis.localeCompare(b.axis) ||
      a.sign - b.sign
  );
}
