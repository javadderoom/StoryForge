import type { DirectionalConstraint } from './types';
import type { MapMasks } from './geometry';

// ---------------------------------------------------------------------------
// Solver internals.
// ---------------------------------------------------------------------------

export interface PinEdge {
  a: string;
  b: string;
  kind: 'route' | 'connection' | 'region' | 'hierarchy';
  weight: number;
  ideal: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  mass: number;
  /** false = hard anchor (never moved). */
  free: boolean;
  /** Sea/ocean-style regions modeled as locations WANT water polygons. */
  wantsWater: boolean;
  /**
   * Radius that must ALSO rest on the legal side of the mask — the halo a
   * parent's children orbit in. Without it a coastal parent lands legally but
   * its children spill into the sea.
   */
  clearanceRadius: number;
  waterHits: number;
  dirHits: number;
  edgeHits: number;
}

export interface LayoutContext {
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
