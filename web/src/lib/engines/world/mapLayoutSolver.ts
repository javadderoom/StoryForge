// ---------------------------------------------------------------------------
// Plan 19: deterministic world-map layout solver.
//
// Location pins on the Cartographer canvas historically came from hardcoded
// auto-allocation anchors (`cartographerEngine.ensureLocationCoordinates`) and
// carry no relation to lore or topology. This module derives coordinates from
// the truth already present in the WorldBible instead:
//
//   - adjacency (`connectedLocationIds`) and trade-route stop order are springs,
//   - same-`region` groups cluster weakly,
//   - FA/EN directional lore ("north of the capital") compiles to axis clamps,
//   - parent/child locations orbit their parent instead of entering the layout,
//   - ocean/sea/lake polygons forbid pins (land polygons define the landmass),
//   - manually dragged pins (`coordinatesSource: 'manual'`) are hard anchors.
//
// Determinism is a hard requirement (same world + same seed → same bytes, in
// the spirit of `travelEngine`'s derived progress): all randomness comes from a
// seeded `mulberry32` PRNG and every iteration walks nodes in sorted-id order.
//
// Zero model calls. Runs client-side in milliseconds for N ≤ ~120 locations.
// ---------------------------------------------------------------------------

import {
  MapPoint,
  WorldLocation,
  WorldMapData,
  WorldTradeRoute,
} from '@/lib/types/world';
import { matchesZoneName, normalizeForMatch } from '@/lib/engines/game/travelEngine';
import { LEGACY_AUTO_ANCHORS } from '@/lib/engines/world/cartographerEngine';

// Re-exported so gameplay/CLI/consumers need only this module (single source
// of truth remains `cartographerEngine.ts`).
export { LEGACY_AUTO_ANCHORS };

// ---------------------------------------------------------------------------
// Public types.
// ---------------------------------------------------------------------------

export type RefitMode = 'legacy' | 'full';

export interface SolveRequest {
  locations: WorldLocation[];
  tradeRoutes?: WorldTradeRoute[];
  mapData?: WorldMapData | null;
  mode: RefitMode;
  /** Stable per-world seed (recommended: `stableSeedFromString(worldId)`). */
  seed: number;
  canvas?: { width?: number; height?: number; inset?: number };
  minSeparation?: number;
}

export interface SolveDiff {
  locationId: string;
  name: string;
  before: MapPoint | null;
  after: MapPoint;
  /** True when the position actually changed (new placements report true). */
  moved: boolean;
  tags: string[];
}

export interface SolveResult {
  /** Ordered placement output (moved free nodes + orbiting children). */
  placements: Array<{ locationId: string; position: MapPoint; tags: string[] }>;
  diffs: SolveDiff[];
  /** Number of unconstrained top-level nodes the solver laid out. */
  freeNodeCount: number;
  /** Count of preserved hard anchors (manual / untouched pins). */
  anchorCount: number;
  iterations: number;
  restarts: number;
  energy: number;
  minSeparation: number;
  /** Observability: constraint families that fired + per-restart energies. */
  stats: { edgeCount: number; directionalCount: number; energies: number[] };
  summaryText: string;
}

export interface DirectionalConstraint {
  sourceId: string;
  targetId: string;
  axis: 'x' | 'y';
  /** Required inequality: `sign * (source[axis] - target[axis]) >= DIR_MIN_PROJ`.
   * e.g. north ⇒ sign -1 on y (source sits above target). */
  sign: 1 | -1;
  weight: number;
  /** Normalized lore snippet that produced the constraint. */
  evidence: string;
}

// ---------------------------------------------------------------------------
// Tunable constants (documented defaults; tests assert invariants, not values).
// ---------------------------------------------------------------------------

export const SOLVER_DEFAULTS = {
  CANVAS_WIDTH: 2400,
  CANVAS_HEIGHT: 1600,
  CANVAS_INSET: 160,
  MIN_SEPARATION: 56,
  EDGE_IDEAL_CONNECTION: 420,
  EDGE_IDEAL_ROUTE: 460,
  EDGE_IDEAL_REGION: 620,
  EDGE_WEIGHT_CONNECTION: 1.0,
  EDGE_WEIGHT_ROUTE: 1.1,
  EDGE_WEIGHT_REGION: 0.12,
  DIR_MIN_PROJ: 240,
  DIR_WEIGHT: 0.6,
  DIR_WINDOW: 28, // normalized-text window after a direction word
  RESTARTS: 6,
  ITERATIONS: 400,
  T0: 30,
  T1: 2,
  COLLISION_PASSES: 60,
  WATER_PASSES: 20,
  REPULSION_C: 900000,
  REPULSION_RANGE: 800,
  SPRING_RATE: 0.06,
  DIR_RATE: 0.12,
  /** Weak pull of free nodes toward the live centroid — keeps near-empty worlds
   * centered on the canvas instead of splaying anneal noise to the borders. */
  COHESION_RATE: 0.01,
  COHESION_ENERGY: 0.00002,
  /** Ring base keeps adjacent siblings ≥ ~60px apart on ring 0 (8 per ring). */
  CHILD_RING_BASE: 80,
  CHILD_RING_STEP: 24,
  CHILD_MIN_GAP: 48,
  SETTLEMENT_MASS: 1.4,
  DEFAULT_MASS: 1.0,
} as const;

const GOLDEN_ANGLE = 2.399963229728653;

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

// ---------------------------------------------------------------------------
// Deterministic PRNG + stable seed hashing.
// ---------------------------------------------------------------------------

/** Seeded mulberry32 (reference implementation). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit string hash — stable across runs and processes. */
export function stableSeedFromString(input: string): number {
  let h = 0x811c9dc5;
  const s = input || 'storyforge';
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Geometry helpers.
// ---------------------------------------------------------------------------

function distance(a: MapPoint, b: MapPoint): number {
  const dx = finite(b.x) - finite(a.x);
  const dy = finite(b.y) - finite(a.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Ray-cast point-in-polygon; degenerate or NaN-containing polygons are "outside". */
export function pointInPolygon(p: MapPoint, polygon: MapPoint[] | undefined): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = finite(polygon[i].x);
    const yi = finite(polygon[i].y);
    const xj = finite(polygon[j].x);
    const yj = finite(polygon[j].y);
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Land/water mask built from `mapData.terrainFeatures`. */
export interface MapMasks {
  landPolygons: MapPoint[][];
  waterPolygons: MapPoint[][];
  hasAnyMask: boolean;
}

export function buildMapMasks(mapData: WorldMapData | null | undefined): MapMasks {
  const terrain = mapData?.terrainFeatures ?? [];
  const landPolygons: MapPoint[][] = [];
  const waterPolygons: MapPoint[][] = [];
  for (const f of terrain) {
    const isWater = f.type === 'ocean' || f.type === 'sea' || f.type === 'lake';
    const isLand = f.type === 'continent' || f.type === 'island';
    if (isWater && f.polygon && f.polygon.length >= 3) waterPolygons.push(f.polygon);
    else if (isLand && f.polygon && f.polygon.length >= 3) landPolygons.push(f.polygon);
    // Water cut-outs carved as holes in landmass polygons count as water.
    if (isLand && f.holes) {
      for (const hole of f.holes) {
        if (hole && hole.length >= 3) waterPolygons.push(hole);
      }
    }
  }
  return {
    landPolygons,
    waterPolygons,
    hasAnyMask: landPolygons.length > 0 || waterPolygons.length > 0,
  };
}

/**
 * True when a pin may not rest here: inside a water polygon (including inland
 * water holes in landmasses), or outside every defined landmass when the world
 * paints continents. Worlds with no map geometry are entirely placeable.
 */
export function isWaterPoint(masks: MapMasks, p: MapPoint): boolean {
  if (!masks.hasAnyMask) return false;
  if (masks.waterPolygons.some((poly) => pointInPolygon(p, poly))) return true;
  if (masks.landPolygons.length > 0) {
    return !masks.landPolygons.some((poly) => pointInPolygon(p, poly));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Legacy remnant signature (mirrors `ensureLocationCoordinates` allocation:
// dx = k*70 - 35 and dy = k*50 - 25 for the same integer k ≥ 0 from a base
// anchor). Stored `coordinatesSource: 'legacy_auto'` stamps take precedence.
// ---------------------------------------------------------------------------

export function matchesLegacyAnchorSignature(
  p: MapPoint,
  anchors: ReadonlyArray<MapPoint> = LEGACY_AUTO_ANCHORS
): boolean {
  for (const anchor of anchors) {
    const dx = Math.round(finite(p.x)) - Math.round(anchor.x);
    const dy = Math.round(finite(p.y)) - Math.round(anchor.y);
    const kx = dx + 35;
    const ky = dy + 25;
    if (kx % 70 !== 0 || ky % 50 !== 0) continue;
    const kRx = kx / 70;
    const kRy = ky / 50;
    if (kRx >= 0 && kRx === kRy) return true;
  }
  return false;
}

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

// ---------------------------------------------------------------------------
// Solver internals.
// ---------------------------------------------------------------------------

interface PinEdge {
  a: string;
  b: string;
  kind: 'route' | 'connection' | 'region';
  weight: number;
  ideal: number;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  mass: number;
  /** false = hard anchor (never moved). */
  free: boolean;
  /** Sea/ocean-style regions modeled as locations WANT water polygons. */
  wantsWater: boolean;
  waterHits: number;
  dirHits: number;
  edgeHits: number;
}

interface LayoutContext {
  width: number;
  height: number;
  inset: number;
  minSeparation: number;
  edges: PinEdge[];
  directional: DirectionalConstraint[];
  masks: MapMasks;
  nodes: LayoutNode[];
  idToNode: Map<string, LayoutNode>;
}

function buildEdges(
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

function clampToBounds(node: LayoutNode, ctx: LayoutContext): void {
  node.x = Math.min(ctx.width - ctx.inset, Math.max(ctx.inset, finite(node.x)));
  node.y = Math.min(ctx.height - ctx.inset, Math.max(ctx.inset, finite(node.y)));
}

function massBonus(loc: WorldLocation | undefined): number {
  return loc?.category === 'settlement' || loc?.category === 'stronghold'
    ? SOLVER_DEFAULTS.SETTLEMENT_MASS
    : SOLVER_DEFAULTS.DEFAULT_MASS;
}

/** Init — sunflower spiral, clipped to the canvas inset. */
function initPositions(
  freeNodes: LayoutNode[],
  ctx: LayoutContext,
  restart: number,
  rng: () => number
): void {
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  const maxR = Math.max(80, Math.min(ctx.width, ctx.height) / 2 - ctx.inset - 20);
  const n = Math.max(freeNodes.length, 1);
  const offset = restart * 0.9 + rng() * 0.4;
  freeNodes.forEach((node, i) => {
    const r = maxR * Math.sqrt((i + 0.5) / n);
    const theta = i * GOLDEN_ANGLE + offset;
    node.x = finite(cx + r * Math.cos(theta));
    node.y = finite(cy + r * Math.sin(theta));
    clampToBounds(node, ctx);
  });
}

/** True when this pin is legally resting at `p` given its water preference. */
function waterLegal(masks: MapMasks, node: LayoutNode, p: MapPoint): boolean {
  if (!masks.hasAnyMask) return true;
  if (node.wantsWater) {
    if (masks.waterPolygons.length > 0) return isWaterPoint(masks, p);
    // No explicit water painted, no land either → anything goes.
    if (masks.landPolygons.length === 0) return true;
    return !masks.landPolygons.some((poly) => pointInPolygon(p, poly));
  }
  return !isWaterPoint(masks, p);
}

/** Water/land steering: sample 16 compass directions toward a legal position. */
function applyWaterAvoidance(node: LayoutNode, ctx: LayoutContext): void {
  if (!ctx.masks.hasAnyMask) return;
  const probe: MapPoint = { x: node.x, y: node.y };
  if (waterLegal(ctx.masks, node, probe)) return;
  node.waterHits += 1;
  for (const step of [60, 120, 240, 480]) {
    for (let d = 0; d < 16; d += 1) {
      const angle = (d / 16) * Math.PI * 2;
      const nx = finite(node.x + Math.cos(angle) * step);
      const ny = finite(node.y + Math.sin(angle) * step);
      if (nx < ctx.inset || nx > ctx.width - ctx.inset) continue;
      if (ny < ctx.inset || ny > ctx.height - ctx.inset) continue;
      if (waterLegal(ctx.masks, node, { x: nx, y: ny })) {
        node.x += Math.cos(angle) * 4;
        node.y += Math.sin(angle) * 4;
        return;
      }
    }
  }
  // Fully enclosed sample space → gravitate toward the map center.
  node.x += Math.sign(ctx.width / 2 - node.x || 1) * 4;
  node.y += Math.sign(ctx.height / 2 - node.y || 1) * 4;
}

function stepLayout(ctx: LayoutContext, temperature: number): void {
  // Phase 1 — accumulate forces into a displacement buffer.
  const dx = new Map<string, number>();
  const dy = new Map<string, number>();
  for (const node of ctx.nodes) {
    dx.set(node.id, 0);
    dy.set(node.id, 0);
  }

  // Springs (edges).
  for (const edge of ctx.edges) {
    const a = ctx.idToNode.get(edge.a)!;
    const b = ctx.idToNode.get(edge.b)!;
    const d = Math.max(distance(a, b), 1);
    const f = ((d - edge.ideal) * edge.weight * SOLVER_DEFAULTS.SPRING_RATE) / d;
    const ex = (b.x - a.x) * f;
    const ey = (b.y - a.y) * f;
    if (a.free) {
      dx.set(a.id, finite(dx.get(a.id)!) + finite(ex));
      dy.set(a.id, finite(dy.get(a.id)!) + finite(ey));
      a.edgeHits += 1;
    }
    if (b.free) {
      dx.set(b.id, finite(dx.get(b.id)!) - finite(ex));
      dy.set(b.id, finite(dy.get(b.id)!) - finite(ey));
      b.edgeHits += 1;
    }
  }

  // Local repulsion.
  for (let i = 0; i < ctx.nodes.length; i += 1) {
    for (let j = i + 1; j < ctx.nodes.length; j += 1) {
      const a = ctx.nodes[i];
      const b = ctx.nodes[j];
      const d = Math.max(distance(a, b), 1);
      if (d > SOLVER_DEFAULTS.REPULSION_RANGE) continue;
      const rep = Math.min(
        (SOLVER_DEFAULTS.REPULSION_C * a.mass * b.mass) / (d * d),
        temperature * 2
      );
      const ux = (b.x - a.x) / d;
      const uy = (b.y - a.y) / d;
      if (a.free) {
        dx.set(a.id, finite(dx.get(a.id)!) - ux * rep);
        dy.set(a.id, finite(dy.get(a.id)!) - uy * rep);
      }
      if (b.free) {
        dx.set(b.id, finite(dx.get(b.id)!) + ux * rep);
        dy.set(b.id, finite(dy.get(b.id)!) + uy * rep);
      }
    }
  }

  // Directional clamps.
  for (const c of ctx.directional) {
    const a = ctx.idToNode.get(c.sourceId);
    const b = ctx.idToNode.get(c.targetId);
    if (!a || !b) continue;
    const proj = c.sign * (finite(a[c.axis]) - finite(b[c.axis]));
    const deficit = SOLVER_DEFAULTS.DIR_MIN_PROJ - proj;
    if (deficit <= 0) continue;
    const push = deficit * c.weight * SOLVER_DEFAULTS.DIR_RATE;
    if (a.free) {
      if (c.axis === 'x') dx.set(a.id, finite(dx.get(a.id)!) + c.sign * push);
      else dy.set(a.id, finite(dy.get(a.id)!) + c.sign * push);
      a.dirHits += 1;
    }
    if (b.free) {
      if (c.axis === 'x') dx.set(b.id, finite(dx.get(b.id)!) - c.sign * push);
      else dy.set(b.id, finite(dy.get(b.id)!) - c.sign * push);
      b.dirHits += 1;
    }
  }

  // Weak global cohesion toward the live centroid (anchors + free nodes).
  if (ctx.nodes.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const node of ctx.nodes) {
      sx += node.x;
      sy += node.y;
    }
    const cx = sx / ctx.nodes.length;
    const cy = sy / ctx.nodes.length;
    for (const node of ctx.nodes) {
      if (node.free) {
        dx.set(node.id, finite(dx.get(node.id)!) + (cx - node.x) * SOLVER_DEFAULTS.COHESION_RATE);
        dy.set(node.id, finite(dy.get(node.id)!) + (cy - node.y) * SOLVER_DEFAULTS.COHESION_RATE);
      }
    }
  }

  // Phase 2 — apply with per-axis temperature clamp, then bounds.
  for (const node of ctx.nodes) {
    if (node.free) {
      const stepX = Math.max(-temperature, Math.min(temperature, finite(dx.get(node.id)!)));
      const stepY = Math.max(-temperature, Math.min(temperature, finite(dy.get(node.id)!)));
      node.x = finite(node.x + stepX);
      node.y = finite(node.y + stepY);
      applyWaterAvoidance(node, ctx);
    }
    clampToBounds(node, ctx);
  }
}

/** Deterministic pairwise separation projection (60% overlap per move). */
function projectCollisions(ctx: LayoutContext, passes: number): void {
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false;
    for (let i = 0; i < ctx.nodes.length; i += 1) {
      for (let j = i + 1; j < ctx.nodes.length; j += 1) {
        const a = ctx.nodes[i];
        const b = ctx.nodes[j];
        const d = distance(a, b);
        if (d >= ctx.minSeparation) continue;
        if (d === 0) {
          if (a.free) {
            a.x += ctx.minSeparation / 2;
            clampToBounds(a, ctx);
            moved = true;
          }
          if (b.free) {
            b.x -= ctx.minSeparation / 2;
            clampToBounds(b, ctx);
            moved = true;
          }
          continue;
        }
        const overlap = ctx.minSeparation - d;
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        const totalMass = a.mass + b.mass;
        if (a.free) {
          const share = (b.mass / totalMass) * overlap * 0.6;
          a.x -= ux * share;
          a.y -= uy * share;
          clampToBounds(a, ctx);
          moved = moved || share > 0.5;
        }
        if (b.free) {
          const share = (a.mass / totalMass) * overlap * 0.6;
          b.x += ux * share;
          b.y += uy * share;
          clampToBounds(b, ctx);
          moved = moved || share > 0.5;
        }
      }
    }
    if (!moved) break;
  }
}

/** Deterministic water projection: teleport offending pins to legal terrain. */
function projectWater(ctx: LayoutContext, passes: number): void {
  if (!ctx.masks.hasAnyMask) return;
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false;
    for (const node of ctx.nodes) {
      if (!node.free) continue;
      if (waterLegal(ctx.masks, node, { x: node.x, y: node.y })) continue;
      let resolved = false;
      outer: for (const step of [40, 80, 160, 320, 640]) {
        for (let d = 0; d < 16; d += 1) {
          const angle = (d / 16) * Math.PI * 2;
          const nx = finite(node.x + Math.cos(angle) * step);
          const ny = finite(node.y + Math.sin(angle) * step);
          if (nx < ctx.inset || nx > ctx.width - ctx.inset) continue;
          if (ny < ctx.inset || ny > ctx.height - ctx.inset) continue;
          if (waterLegal(ctx.masks, node, { x: nx, y: ny })) {
            node.x = nx;
            node.y = ny;
            resolved = true;
            moved = true;
            break outer;
          }
        }
      }
      if (!resolved) {
        node.x = finite(ctx.width / 2);
        node.y = finite(ctx.height / 2);
        node.x = Math.min(ctx.width - ctx.inset, Math.max(ctx.inset, node.x));
        node.y = Math.min(ctx.height - ctx.inset, Math.max(ctx.inset, node.y));
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function configEnergy(ctx: LayoutContext): number {
  let energy = 0;
  for (const edge of ctx.edges) {
    const a = ctx.idToNode.get(edge.a)!;
    const b = ctx.idToNode.get(edge.b)!;
    const d = distance(a, b);
    energy += (edge.weight * (d - edge.ideal) * (d - edge.ideal)) / edge.ideal;
  }
  for (let i = 0; i < ctx.nodes.length; i += 1) {
    for (let j = i + 1; j < ctx.nodes.length; j += 1) {
      const deficit = ctx.minSeparation - distance(ctx.nodes[i], ctx.nodes[j]);
      if (deficit > 0) energy += deficit * deficit * 2;
    }
  }
  for (const c of ctx.directional) {
    const a = ctx.idToNode.get(c.sourceId);
    const b = ctx.idToNode.get(c.targetId);
    if (!a || !b) continue;
    const deficit = SOLVER_DEFAULTS.DIR_MIN_PROJ - c.sign * (finite(a[c.axis]) - finite(b[c.axis]));
    if (deficit > 0) energy += deficit * deficit * c.weight;
  }
  // Cohesion comparator: penalize free configs that hug canvas borders when the
  // constraint set is sparse (keeps restart selection meaningful).
  if (ctx.nodes.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const node of ctx.nodes) {
      sx += node.x;
      sy += node.y;
    }
    const cx = sx / ctx.nodes.length;
    const cy = sy / ctx.nodes.length;
    for (const node of ctx.nodes) {
      if (!node.free) continue;
      const dx = node.x - cx;
      const dy = node.y - cy;
      energy += SOLVER_DEFAULTS.COHESION_ENERGY * (dx * dx + dy * dy);
    }
  }
  return energy;
}

function zeroInfluenceCounters(ctx: LayoutContext): void {
  for (const node of ctx.nodes) {
    node.waterHits = 0;
    node.dirHits = 0;
    node.edgeHits = 0;
  }
}

// ---------------------------------------------------------------------------
// Child orbits.
// ---------------------------------------------------------------------------

interface ChildOrbit {
  locationId: string;
  parentLocationId: string;
  position: MapPoint;
}

function computeChildOrbits(
  locations: WorldLocation[],
  resolvedTopPositions: Map<string, MapPoint>,
  ctx: Pick<LayoutContext, 'width' | 'height' | 'inset'>
): ChildOrbit[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const groups = new Map<string, WorldLocation[]>();
  for (const loc of locations) {
    const parentId = loc.parentLocationId;
    if (!parentId || !byId.has(parentId)) continue;
    const list = groups.get(parentId) ?? [];
    list.push(loc);
    groups.set(parentId, list);
  }
  const orbits: ChildOrbit[] = [];

  // Working position map for orbit bases: seeded with solved top-level pins,
  // then extended pass-by-pass so nested children orbit their parent's NEW
  // position rather than a stale pre-refit pin.
  const basePositions = new Map<string, MapPoint>(resolvedTopPositions);
  const parentIds = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  let pending = new Set(parentIds);

  // Up to `parentIds.size` passes; each pass resolves parents whose base is
  // known, so deep chains settle in ≤ depth iterations. Deterministic order.
  for (let pass = 0; pass < parentIds.length && pending.size > 0; pass += 1) {
    let progressed = false;
    for (const parentId of parentIds) {
      if (!pending.has(parentId)) continue;
      const parent = byId.get(parentId)!;
      const parentPos = basePositions.get(parentId) ?? (parent.coordinates ? { x: finite(parent.coordinates.x), y: finite(parent.coordinates.y) } : null);
      if (!parentPos && !pendingDeep(parentId, groups, byId, pending)) {
        // Parent has no pin and never will (orphan chain) — skip for good.
        pending.delete(parentId);
        progressed = true;
        continue;
      }
      if (!parentPos) continue; // resolve after its own parent lands next pass
      const children = [...groups.get(parentId)!].sort((a, b) => a.id.localeCompare(b.id));
      children.forEach((child, i) => {
        if (child.coordinates && child.coordinatesSource === 'manual') {
          // Manual child pins are preserved; their position is still a legal
          // orbit base for grandchildren.
          basePositions.set(child.id, { x: finite(child.coordinates.x), y: finite(child.coordinates.y) });
          return;
        }
        const ring = Math.floor(i / 8);
        const radius = SOLVER_DEFAULTS.CHILD_RING_BASE + ring * SOLVER_DEFAULTS.CHILD_RING_STEP;
        const angle = i * GOLDEN_ANGLE;
        let px = finite(parentPos.x + Math.cos(angle) * radius);
        let py = finite(parentPos.y + Math.sin(angle) * radius);
        const ddx = px - parentPos.x;
        const ddy = py - parentPos.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        if (d < SOLVER_DEFAULTS.CHILD_MIN_GAP) {
          // Radial push-out of the parent's collision envelope.
          const scale = SOLVER_DEFAULTS.CHILD_MIN_GAP / d;
          px = finite(parentPos.x + ddx * scale);
          py = finite(parentPos.y + ddy * scale);
        }
        px = Math.min(ctx.width - ctx.inset, Math.max(ctx.inset, px));
        py = Math.min(ctx.height - ctx.inset, Math.max(ctx.inset, py));
        const position = { x: Math.round(px), y: Math.round(py) };
        orbits.push({ locationId: child.id, parentLocationId: parentId, position });
        basePositions.set(child.id, position);
      });
      pending.delete(parentId);
      progressed = true;
    }
    if (!progressed) break;
  }

  return orbits;
}

/** True when this parent still depends on a pending ancestor for its base. */
function pendingDeep(
  parentId: string,
  groups: Map<string, WorldLocation[]>,
  byId: Map<string, WorldLocation>,
  pending: Set<string>
): boolean {
  const parent = byId.get(parentId);
  const chainId = parent?.parentLocationId;
  return !!chainId && pending.has(chainId) && groups.has(chainId);
}

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
  const topLocations = locations.filter(isTopLevel);

  const needsPlacement = (l: WorldLocation): boolean => {
    if (l.coordinatesSource === 'manual') return false;
    if (request.mode === 'full') return true;
    if (!l.coordinates) return true;
    if (l.coordinatesSource === 'legacy_auto') return true;
    return matchesLegacyAnchorSignature(l.coordinates);
  };

  const freeIds = new Set(topLocations.filter(needsPlacement).map((l) => l.id));
  const anchorIds = new Set(
    topLocations.filter((l) => !freeIds.has(l.id) && l.coordinates).map((l) => l.id)
  );
  const relevantIds = new Set([...freeIds, ...anchorIds]);

  const edges = buildEdges(topLocations, tradeRoutes, relevantIds);
  const directional = extractDirectionalConstraints(locations).filter(
    (c) => relevantIds.has(c.sourceId) && relevantIds.has(c.targetId)
  );

  const nodes: LayoutNode[] = topLocations
    .filter((l) => relevantIds.has(l.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((l) => ({
      id: l.id,
      x: finite(l.coordinates?.x ?? 0),
      y: finite(l.coordinates?.y ?? 0),
      mass: massBonus(l),
      free: freeIds.has(l.id),
      wantsWater: prefersWaterRegion(l),
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
  const freeSorted = topLocations
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
  const orbits = computeChildOrbits(locations, resolvedTop, { width, height, inset });
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
