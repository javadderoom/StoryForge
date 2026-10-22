import type { MapPoint, WorldLocation, WorldMapData, WorldTradeRoute } from '@/lib/types/world';

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
  /** Ring base keeps adjacent siblings ≥ ~80px apart on ring 0 (8 per ring). */
  CHILD_RING_BASE: 110,
  /**
   * Radial distance between rings. It must stay above the minimum pin
   * separation, otherwise a ring and the one outside it nearly touch.
   */
  CHILD_RING_STEP: 72,
  /**
   * Closest a child may sit to its parent. It must not be smaller than the
   * auditor's minimum separation, or every parent/child pair would be
   * reported as an overlap.
   */
  CHILD_MIN_GAP: 56,
  /** How many children share one orbit ring. */
  CHILDREN_PER_RING: 8,
  /** Cap on the halo a parent must keep clear of the wrong side of the mask. */
  CLEARANCE_MAX: 320,
  /**
   * How many levels below a root are laid out globally. 0 = only the roots
   * (everything else orbits them), 1 = roots AND their direct children (the
   * regions of a continent), so a deep hierarchy is not crushed into a single
   * hub with dozens of pins stacked on top of each other.
   */
  GLOBAL_LAYOUT_DEPTH: 1,
  /** Ideal distance between a place and its parent on the same map scale. */
  EDGE_IDEAL_HIERARCHY: 520,
  EDGE_WEIGHT_HIERARCHY: 0.9,
  SETTLEMENT_MASS: 1.4,
  DEFAULT_MASS: 1.0,
} as const;
