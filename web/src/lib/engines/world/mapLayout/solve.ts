import type { MapPoint, WorldLocation } from '@/lib/types/world';
import { SOLVER_DEFAULTS } from './types';
import { createRng } from './random';
import { buildMapMasks, finite, matchesLegacyAnchorSignature } from './geometry';
import { prefersWaterRegion, extractDirectionalConstraints } from './constraints';
import { buildEdges } from './edges';
import {
  massBonus,
  zeroInfluenceCounters,
  initPositions,
  stepLayout,
  projectCollisions,
  projectWater,
  configEnergy,
} from './layoutStep';
import { computeChildOrbits, separateChildOrbits } from './childOrbits';
import type { SolveDiff, SolveRequest, SolveResult } from './types';
import type { LayoutContext, LayoutNode } from './layoutTypes';

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export function solveMapLayout(request: SolveRequest): SolveResult {
  const locations = (request.locations ?? []).filter((l) => l && l.id && l.name);
  const tradeRoutes = request.tradeRoutes ?? [];
  const width =
    request.canvas?.width ?? request.mapData?.settings?.width ?? SOLVER_DEFAULTS.CANVAS_WIDTH;
  const height =
    request.canvas?.height ?? request.mapData?.settings?.height ?? SOLVER_DEFAULTS.CANVAS_HEIGHT;
  const inset = request.canvas?.inset ?? SOLVER_DEFAULTS.CANVAS_INSET;
  const minSeparation = request.minSeparation ?? SOLVER_DEFAULTS.MIN_SEPARATION;
  const masks = buildMapMasks(request.mapData);

  const byId = new Map(locations.map((l) => [l.id, l]));
  const isTopLevel = (l: WorldLocation) =>
    !l.parentLocationId || !byId.has(l.parentLocationId);
  // Children per location — the count decides whether a place is a hub (a
  // region that owns cities) or a leaf (a quarter, a shop, a dungeon).
  const allChildCounts = new Map<string, number>();
  for (const loc of locations) {
    if (!loc.parentLocationId || !byId.has(loc.parentLocationId)) continue;
    allChildCounts.set(loc.parentLocationId, (allChildCounts.get(loc.parentLocationId) ?? 0) + 1);
  }

  /**
   * Which places are laid out globally (they get real springs) and which
   * orbit a parent.
   *
   * - A ROOT is always global (the continent, the seas).
   * - A place that OWNS places of its own is a hub (a region with cities, a
   *   city with quarters): global too, otherwise every level of a deep
   *   hierarchy would collapse onto one pin and the map would be unreadable.
   * - Everything else is a leaf and orbits its parent (a quarter under a
   *   city, a dungeon under a keep, a shop under a quarter).
   */
  const isGlobal = (l: WorldLocation): boolean => {
    if (isTopLevel(l)) return true;
    return (allChildCounts.get(l.id) ?? 0) > 0;
  };
  const globallyPlaced = locations.filter(isGlobal);
  const globallyPlacedIds = new Set(globallyPlaced.map((l) => l.id));

  const needsPlacement = (l: WorldLocation): boolean => {
    if (l.coordinatesSource === 'manual') return false;
    if (request.mode === 'full') return true;
    if (!l.coordinates) return true;
    if (l.coordinatesSource === 'legacy_auto') return true;
    return matchesLegacyAnchorSignature(l.coordinates);
  };

  const freeIds = new Set(globallyPlaced.filter(needsPlacement).map((l) => l.id));
  const anchorIds = new Set(
    globallyPlaced.filter((l) => !freeIds.has(l.id) && l.coordinates).map((l) => l.id)
  );
  const relevantIds = new Set([...freeIds, ...anchorIds]);

  const edges = buildEdges(globallyPlaced, tradeRoutes, relevantIds);
  const directional = extractDirectionalConstraints(locations).filter(
    (c) => relevantIds.has(c.sourceId) && relevantIds.has(c.targetId)
  );

  // A parent's children orbit in a halo around it — the halo must fit on the
  // legal side of the mask, so the parent's clearance is the outermost ring
  // its ORBITING children need. Children that are laid out globally (the
  // regions of a continent) do not orbit and do not consume clearance.
  const childCounts = new Map<string, number>();
  for (const loc of locations) {
    if (!loc.parentLocationId || !byId.has(loc.parentLocationId)) continue;
    if (globallyPlacedIds.has(loc.id)) continue;
    childCounts.set(loc.parentLocationId, (childCounts.get(loc.parentLocationId) ?? 0) + 1);
  }
  const clearanceFor = (id: string): number => {
    const count = childCounts.get(id) ?? 0;
    if (count <= 0) return 0;
    const rings = Math.ceil(count / SOLVER_DEFAULTS.CHILDREN_PER_RING);
    const radius =
      SOLVER_DEFAULTS.CHILD_RING_BASE + (rings - 1) * SOLVER_DEFAULTS.CHILD_RING_STEP;
    return Math.min(radius, SOLVER_DEFAULTS.CLEARANCE_MAX);
  };

  const nodes: LayoutNode[] = globallyPlaced
    .filter((l) => relevantIds.has(l.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((l) => ({
      id: l.id,
      x: finite(l.coordinates?.x ?? 0),
      y: finite(l.coordinates?.y ?? 0),
      mass: massBonus(l),
      free: freeIds.has(l.id),
      wantsWater: prefersWaterRegion(l),
      clearanceRadius: clearanceFor(l.id),
      waterHits: 0,
      dirHits: 0,
      edgeHits: 0,
    }));

  const ctx: LayoutContext = {
    width,
    height,
    inset,
    minSeparation,
    edges,
    directional,
    masks,
    nodes,
    idToNode: new Map(nodes.map((n) => [n.id, n])),
  };

  // Multi-restart annealing; best (lowest-energy) configuration wins.
  let bestNodes: LayoutNode[] | null = null;
  let bestEnergy = Number.POSITIVE_INFINITY;
  let bestTags = new Map<string, string[]>();
  const restartEnergies: number[] = [];
  for (let restart = 0; restart < SOLVER_DEFAULTS.RESTARTS; restart += 1) {
    const rng = createRng((request.seed + restart * 0x9e3779b9) >>> 0);
    zeroInfluenceCounters(ctx);
    initPositions(
      ctx.nodes.filter((n) => n.free),
      ctx,
      restart,
      rng
    );
    for (let it = 0; it < SOLVER_DEFAULTS.ITERATIONS; it += 1) {
      const t =
        SOLVER_DEFAULTS.T0 +
        ((SOLVER_DEFAULTS.T1 - SOLVER_DEFAULTS.T0) * it) / (SOLVER_DEFAULTS.ITERATIONS - 1);
      stepLayout(ctx, t);
    }
    projectCollisions(ctx, SOLVER_DEFAULTS.COLLISION_PASSES);
    projectWater(ctx, SOLVER_DEFAULTS.WATER_PASSES);
    projectCollisions(ctx, 12);
    projectWater(ctx, 6); // repair water/land legality after collision pushes

    const energy = configEnergy(ctx);
    restartEnergies.push(energy);
    if (energy < bestEnergy) {
      bestEnergy = energy;
      bestNodes = ctx.nodes.map((n) => ({ ...n }));
      const tags = new Map<string, string[]>();
      for (const n of ctx.nodes) {
        if (!n.free) continue;
        const t: string[] = [];
        if (n.edgeHits > 0) t.push('topology');
        if (n.dirHits > 0) t.push('directional');
        if (n.waterHits > 0) t.push('water');
        tags.set(n.id, t);
      }
      bestTags = tags;
    }
  }

  if (!bestNodes) {
    return {
      placements: [],
      diffs: [],
      freeNodeCount: 0,
      anchorCount: anchorIds.size,
      iterations: 0,
      restarts: SOLVER_DEFAULTS.RESTARTS,
      energy: Number.POSITIVE_INFINITY,
      minSeparation,
      stats: { edgeCount: edges.length, directionalCount: directional.length, energies: [] },
      summaryText: 'No placement candidates in legacy mode.',
    };
  }

  // Materialize the best configuration.
  const resolvedTop = new Map<string, MapPoint>();
  for (const node of bestNodes) {
    resolvedTop.set(node.id, { x: Math.round(finite(node.x)), y: Math.round(finite(node.y)) });
  }

  const parentTags = bestTags;
  const placements: SolveResult['placements'] = [];
  const diffs: SolveDiff[] = [];
  const freeSorted = globallyPlaced
    .filter((l) => freeIds.has(l.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const loc of freeSorted) {
    const after = resolvedTop.get(loc.id)!;
    const before = loc.coordinates
      ? { x: Math.round(finite(loc.coordinates.x)), y: Math.round(finite(loc.coordinates.y)) }
      : null;
    const tags = ['solver', ...(parentTags.get(loc.id) ?? [])];
    if (!before) tags.push('was_unplaced');
    if (
      loc.coordinatesSource === 'legacy_auto' ||
      (before && matchesLegacyAnchorSignature(before))
    ) {
      tags.push('legacy_auto');
    }
    placements.push({ locationId: loc.id, position: after, tags });
    diffs.push({
      locationId: loc.id,
      name: loc.name,
      before,
      after,
      moved: !before || before.x !== after.x || before.y !== after.y,
      tags,
    });
  }

  // Children orbit their parents (manual children are preserved outright).
  const orbits = computeChildOrbits(
    locations,
    resolvedTop,
    { width, height, inset },
    masks,
    globallyPlacedIds
  );
  // Orbits are geometric, so they can still land on top of each other (two
  // families whose parents sit close, a ring that folds onto its neighbour).
  separateChildOrbits(
    orbits,
    resolvedTop,
    minSeparation,
    { width, height, inset },
    masks,
    (id) => {
      const loc = byId.get(id);
      return loc ? prefersWaterRegion(loc) : false;
    }
  );
  for (const orbit of orbits) {
    const child = byId.get(orbit.locationId)!;
    const before = child.coordinates
      ? { x: Math.round(finite(child.coordinates.x)), y: Math.round(finite(child.coordinates.y)) }
      : null;
    const tags = ['solver', 'child_orbit'];
    placements.push({ locationId: orbit.locationId, position: orbit.position, tags });
    diffs.push({
      locationId: orbit.locationId,
      name: child.name,
      before,
      after: orbit.position,
      moved: !before || before.x !== orbit.position.x || before.y !== orbit.position.y,
      tags,
    });
  }

  const movedCount = diffs.filter((d) => d.moved).length;
  const summaryText =
    movedCount === 0
      ? `Nothing to move (${anchorIds.size} pin(s) preserved).`
      : `Moved ${movedCount} location(s); preserved ${anchorIds.size} manual/untouched pin(s).`;

  return {
    placements,
    diffs,
    freeNodeCount: freeIds.size,
    anchorCount: anchorIds.size,
    iterations: SOLVER_DEFAULTS.ITERATIONS,
    restarts: SOLVER_DEFAULTS.RESTARTS,
    energy: bestEnergy,
    minSeparation,
    stats: { edgeCount: edges.length, directionalCount: directional.length, energies: restartEnergies.map((e) => Math.round(e)) },
    summaryText,
  };
}
