import type { WorldLocation, WorldTradeRoute } from '@/lib/types/world';
import { SOLVER_DEFAULTS } from './types';
import type { PinEdge } from './layoutTypes';

export function buildEdges(
  topLocations: WorldLocation[],
  tradeRoutes: WorldTradeRoute[],
  relevantIds: Set<string>
): PinEdge[] {
  const edges: PinEdge[] = [];
  const best = new Map<string, PinEdge>();
  const put = (edge: PinEdge) => {
    const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`;
    const prev = best.get(key);
    // Route stops outrank plain adjacency; region kinship never overrides.
    if (!prev || prev.kind === 'region' || (edge.kind !== 'region' && edge.weight > prev.weight)) {
      best.set(key, edge);
    }
  };

  for (const loc of topLocations) {
    if (!relevantIds.has(loc.id)) continue;
    for (const c of loc.connectedLocationIds ?? []) {
      if (relevantIds.has(c)) {
        put({
          a: loc.id,
          b: c,
          kind: 'connection',
          weight: SOLVER_DEFAULTS.EDGE_WEIGHT_CONNECTION,
          ideal: SOLVER_DEFAULTS.EDGE_IDEAL_CONNECTION,
        });
      }
    }
  }

  // Hierarchy springs: a place and its parent sit on the same map scale when
  // both are laid out globally — without this the regions of a continent have
  // no signal at all and would scatter arbitrarily.
  for (const loc of topLocations) {
    const parentId = loc.parentLocationId;
    if (!parentId || !relevantIds.has(loc.id) || !relevantIds.has(parentId)) continue;
    put({
      a: parentId,
      b: loc.id,
      kind: 'hierarchy',
      weight: SOLVER_DEFAULTS.EDGE_WEIGHT_HIERARCHY,
      ideal: SOLVER_DEFAULTS.EDGE_IDEAL_HIERARCHY,
    });
  }
  for (const route of tradeRoutes ?? []) {
    const stops = [
      route.originLocationId,
      ...(route.intermediateLocationIds ?? []),
      route.destinationLocationId,
    ];
    for (let i = 0; i + 1 < stops.length; i += 1) {
      if (relevantIds.has(stops[i]) && relevantIds.has(stops[i + 1])) {
        put({
          a: stops[i],
          b: stops[i + 1],
          kind: 'route',
          weight: SOLVER_DEFAULTS.EDGE_WEIGHT_ROUTE,
          ideal: SOLVER_DEFAULTS.EDGE_IDEAL_ROUTE,
        });
      }
    }
  }
  for (const edge of best.values()) edges.push(edge);
  // Region kinship: weak star attraction to the first member of each group.
  const grouped = new Map<string, WorldLocation>();
  for (const loc of topLocations) {
    const region = (loc.region ?? '').trim();
    if (region.length < 3 || !relevantIds.has(loc.id)) continue;
    if (!grouped.has(region)) {
      grouped.set(region, loc);
      continue;
    }
    const hub = grouped.get(region)!;
    edges.push({
      a: hub.id,
      b: loc.id,
      kind: 'region',
      weight: SOLVER_DEFAULTS.EDGE_WEIGHT_REGION,
      ideal: SOLVER_DEFAULTS.EDGE_IDEAL_REGION,
    });
  }
  return edges;
}
