// ---------------------------------------------------------------------------
// Plan 19: world-map layout auditor.
//
// Classifies coordinate provenance (manual / solver / legacy remnant / none)
// and produces an issue report used by (a) the Cartographer auto-fit modal,
// (b) the CLI refit script, and (c) tests. It never mutates state.
//
// Detection strategy: honor a stored `coordinatesSource` stamp first; fall
// back to the historical auto-allocation signature (exact anchor match or the
// `dx = k*70 - 35 / dy = k*50 - 25` orbital pattern) so pre-Plan-19 worlds
// are quarantined without any migration.
// ---------------------------------------------------------------------------

import {
  MapPoint,
  WorldBible,
  WorldLocation,
  WorldMapData,
  WorldTradeRoute,
} from '@/lib/types/world';
import { LEGACY_AUTO_ANCHORS } from '@/lib/engines/world/cartographerEngine';
import {
  extractDirectionalConstraints,
  isWaterPoint,
  matchesLegacyAnchorSignature,
  buildMapMasks,
  prefersWaterRegion,
} from '@/lib/engines/world/mapLayoutSolver';

export type CoordinateClass = 'manual' | 'solver' | 'legacy_auto' | 'unplaced' | 'unknown';

export interface MapAuditIssue {
  code:
    | 'legacy_coordinates'
    | 'unplaced_locations'
    | 'min_separation'
    | 'topology_uninformative'
    | 'directional_violations'
    | 'water_violations'
    | 'parent_flung';
  fa: string;
  en: string;
  /** Up to a handful of offending location ids for UI jump-to-pin. */
  exampleIds: string[];
}

export interface MapAuditReport {
  counts: { manual: number; solver: number; legacy_auto: number; unplaced: number; unknown: number };
  minSeparationViolations: Array<{ a: string; b: string; distance: number }>;
  parentFlungIds: string[];
  waterViolationIds: string[];
  directional: { satisfied: number; violated: number; unresolvable: number };
  topologySeparation: {
    connectedMean: number;
    unconnectedMedian: number;
    informative: boolean;
    computable: boolean;
  };
  /** At least one legacy remnant or unplaced location exists. */
  legacyDetected: boolean;
  /** Truncated issue list for UI display. */
  issues: MapAuditIssue[];
}

/**
 * Classifies a location's coordinates. Stamps win; the historical auto-anchor
 * signature catches pre-Plan-19 worlds, and unknown carries through untouched
 * by legacy-mode refits (safe default).
 */
export function classifyCoordinates(
  loc: Pick<WorldLocation, 'coordinates' | 'coordinatesSource'>,
  anchors: ReadonlyArray<MapPoint> = LEGACY_AUTO_ANCHORS
): CoordinateClass {
  if (!loc.coordinates) return 'unplaced';
  if (loc.coordinatesSource === 'manual') return 'manual';
  if (loc.coordinatesSource === 'solver') return 'solver';
  if (loc.coordinatesSource === 'legacy_auto') return 'legacy_auto';
  if (matchesLegacyAnchorSignature(loc.coordinates, anchors)) return 'legacy_auto';
  return 'unknown';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const dist = (a: MapPoint, b: MapPoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export function auditWorldMapLayout(
  wb: Pick<WorldBible, 'locations' | 'tradeRoutes'>,
  mapData?: WorldMapData | null,
  options: { minSeparation?: number; flungRadius?: number; hubFlungRadius?: number } = {}
): MapAuditReport {
  const minSeparation = options.minSeparation ?? 56;
  const flungRadius = options.flungRadius ?? 320;
  const locations = (wb.locations ?? []).filter((l) => l?.id);
  const tradeRoutes: WorldTradeRoute[] = wb.tradeRoutes ?? [];
  const masks = buildMapMasks(mapData);

  const counts = { manual: 0, solver: 0, legacy_auto: 0, unplaced: 0, unknown: 0 };
  for (const loc of locations) {
    const c = classifyCoordinates(loc);
    counts[c] += 1;
  }

  // Overlap detection.
  const placed = locations.filter((l) => l.coordinates);
  const minSeparationViolations: MapAuditReport['minSeparationViolations'] = [];
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i].coordinates!;
      const b = placed[j].coordinates!;
      const d = dist(a, b);
      if (d < minSeparation) {
        minSeparationViolations.push({ a: placed[i].id, b: placed[j].id, distance: Math.round(d) });
      }
    }
  }
  minSeparationViolations.sort((x, y) => x.distance - y.distance);

  // Parent containment (children must stay near their parent's pin).
  //
  // The tolerance depends on the child's own scale: a region of a continent is
  // laid out globally and legitimately sits a long way from the continent's
  // pin, while a quarter of a city must stay on its doorstep. A child that
  // owns places of its own is a hub → wide tolerance; a leaf → the tight one.
  const byId = new Map(locations.map((l) => [l.id, l]));
  const childCounts = new Map<string, number>();
  for (const loc of locations) {
    if (!loc.parentLocationId || !byId.has(loc.parentLocationId)) continue;
    childCounts.set(loc.parentLocationId, (childCounts.get(loc.parentLocationId) ?? 0) + 1);
  }
  const hubFlungRadius = options.hubFlungRadius ?? 900;
  const parentFlungIds: string[] = [];
  for (const loc of placed) {
    const parent = loc.parentLocationId ? byId.get(loc.parentLocationId) : undefined;
    if (!parent?.coordinates) continue;
    const isHub = (childCounts.get(loc.id) ?? 0) > 0;
    const limit = isHub ? hubFlungRadius : flungRadius;
    if (dist(loc.coordinates!, parent.coordinates) > limit) parentFlungIds.push(loc.id);
  }

  // Water violations — sea/ocean-style locations want water, everything else
  // wants land (mirrors the solver's `waterLegal` rule).
  const waterViolationIds = masks.hasAnyMask
    ? placed
        .filter((l) => (prefersWaterRegion(l) ? !isWaterPoint(masks, l.coordinates!) : isWaterPoint(masks, l.coordinates!)))
        .map((l) => l.id)
    : [];

  // Directional satisfaction.
  const constraints = extractDirectionalConstraints(locations);
  const directional = { satisfied: 0, violated: 0, unresolvable: 0 };
  for (const c of constraints) {
    const a = byId.get(c.sourceId);
    const b = byId.get(c.targetId);
    if (!a?.coordinates || !b?.coordinates) {
      directional.unresolvable += 1;
      continue;
    }
    const proj = c.sign * ((c.axis === 'x' ? a.coordinates.x : a.coordinates.y) -
      (c.axis === 'x' ? b.coordinates.x : b.coordinates.y));
    if (proj >= 0) directional.satisfied += 1;
    else directional.violated += 1;
  }

  // Topology informativeness: connected pairs closer than unconnected median.
  const withCoords = placed;
  const idSet = new Set(withCoords.map((l) => l.id));
  const connected: number[] = [];
  const connectedPairKeys = new Set<string>();
  for (const l of withCoords) {
    for (const c of l.connectedLocationIds ?? []) {
      if (!idSet.has(c)) continue;
      const key = l.id < c ? `${l.id}|${c}` : `${c}|${l.id}`;
      connectedPairKeys.add(key);
    }
  }
  for (const route of tradeRoutes) {
    const stops = [
      route.originLocationId,
      ...(route.intermediateLocationIds ?? []),
      route.destinationLocationId,
    ];
    for (let i = 0; i + 1 < stops.length; i += 1) {
      if (idSet.has(stops[i]) && idSet.has(stops[i + 1])) {
        const key = stops[i] < stops[i + 1] ? `${stops[i]}|${stops[i + 1]}` : `${stops[i + 1]}|${stops[i]}`;
        connectedPairKeys.add(key);
      }
    }
  }
  for (const key of connectedPairKeys) {
    const [a, b] = key.split('|');
    const la = byId.get(a);
    const lb = byId.get(b);
    if (la?.coordinates && lb?.coordinates) connected.push(dist(la.coordinates, lb.coordinates));
  }
  const connectedMean =
    connected.length > 0 ? connected.reduce((s, v) => s + v, 0) / connected.length : 0;
  const unconnected: number[] = [];
  for (let i = 0; i < withCoords.length && unconnected.length < 20000; i += 1) {
    for (let j = i + 1; j < withCoords.length; j += 1) {
      const key = withCoords[i].id < withCoords[j].id
        ? `${withCoords[i].id}|${withCoords[j].id}`
        : `${withCoords[j].id}|${withCoords[i].id}`;
      if (connectedPairKeys.has(key)) continue;
      unconnected.push(dist(withCoords[i].coordinates!, withCoords[j].coordinates!));
    }
  }
  const unconnectedMedian = median(unconnected);
  const topologyComputable = connectedMean > 0 && unconnectedMedian > 0;
  const informative = topologyComputable && connectedMean < unconnectedMedian * 0.9;

  const legacyDetected = counts.legacy_auto + counts.unplaced > 0;

  const issues: MapAuditIssue[] = [];
  if (counts.legacy_auto > 0) {
    issues.push({
      code: 'legacy_coordinates',
      fa: `${counts.legacy_auto} مختصات بازماندهٔ قدیمی شناسایی شد که قابل بازچینی است.`,
      en: `${counts.legacy_auto} legacy auto-allocation remnants detected and safe to refit.`,
      exampleIds: locations.filter((l) => classifyCoordinates(l) === 'legacy_auto').slice(0, 8).map((l) => l.id),
    });
  }
  if (counts.unplaced > 0) {
    issues.push({
      code: 'unplaced_locations',
      fa: `${counts.unplaced} موقعیت روی نقشه قرار نگرفته است.`,
      en: `${counts.unplaced} location(s) have no map coordinates.`,
      exampleIds: locations.filter((l) => classifyCoordinates(l) === 'unplaced').slice(0, 8).map((l) => l.id),
    });
  }
  if (minSeparationViolations.length > 0) {
    issues.push({
      code: 'min_separation',
      fa: `${minSeparationViolations.length} جفت نشان هم‌پوشان (حداقل فاصله ${minSeparation}px).`,
      en: `${minSeparationViolations.length} overlapping pin pair(s) (min ${minSeparation}px).`,
      exampleIds: minSeparationViolations.slice(0, 8).flatMap((v) => [v.a, v.b]),
    });
  }
  if (topologyComputable && !informative) {
    issues.push({
      code: 'topology_uninformative',
      fa: 'فاصلهٔ مکان‌های متصل از مکان‌های غیرمتمایز کمتر نیست؛ نقشه اطلاعات توپولوژیکی ندارد.',
      en: 'Connected locations are not closer than unconnected ones; the layout carries no topological information.',
      exampleIds: [],
    });
  }
  if (directional.violated > 0) {
    issues.push({
      code: 'directional_violations',
      fa: `${directional.violated} ادعای جهتی متن نقض شده است (مثلاً «شمالِ پایتخت»).`,
      en: `${directional.violated} directional lore claim(s) violated by the current layout.`,
      exampleIds: [],
    });
  }
  if (waterViolationIds.length > 0) {
    issues.push({
      code: 'water_violations',
      fa: `${waterViolationIds.length} نشان روی آب قرار دارد.`,
      en: `${waterViolationIds.length} pin(s) land on water polygons.`,
      exampleIds: waterViolationIds.slice(0, 8),
    });
  }
  if (parentFlungIds.length > 0) {
    issues.push({
      code: 'parent_flung',
      fa: `${parentFlungIds.length} زیرموقعیت بیش از حد از والد خود فاصله دارد.`,
      en: `${parentFlungIds.length} sub-location(s) sit too far from their parent's pin.`,
      exampleIds: parentFlungIds.slice(0, 8),
    });
  }

  return {
    counts,
    minSeparationViolations,
    parentFlungIds,
    waterViolationIds,
    directional,
    topologySeparation: {
      connectedMean: Math.round(connectedMean),
      unconnectedMedian: Math.round(unconnectedMedian),
      informative,
      computable: topologyComputable,
    },
    legacyDetected,
    issues,
  };
}
