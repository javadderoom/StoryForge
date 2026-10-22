// ---------------------------------------------------------------------------
// Plan 19: deterministic world-map layout solver.
//
// The implementation lives in ./mapLayout/*. This module is the stable public
// barrel: gameplay, CLI tooling, the Cartographer page and the tests all keep
// importing from the original path.
// ---------------------------------------------------------------------------

export { LEGACY_AUTO_ANCHORS } from '@/lib/engines/world/cartographerEngine';
export type {
  RefitMode,
  SolveRequest,
  SolveDiff,
  SolveResult,
  DirectionalConstraint,
} from './mapLayout/types';
export { SOLVER_DEFAULTS } from './mapLayout/types';
export { createRng, stableSeedFromString } from './mapLayout/random';
export {
  pointInPolygon,
  buildMapMasks,
  isWaterPoint,
  matchesLegacyAnchorSignature,
  type MapMasks,
} from './mapLayout/geometry';
export {
  prefersWaterRegion,
  extractDirectionalConstraints,
} from './mapLayout/constraints';
export { solveMapLayout } from './mapLayout/solve';
