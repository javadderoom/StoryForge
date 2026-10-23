/**
 * landSculptEngine.ts
 *
 * Stable public barrel for continuous land sculpting. The implementation is
 * split across ./landSculpt/* so each stage (noise, geometry, stamps,
 * simplification, GeoJSON conversion and boolean sculpting) can be reviewed and
 * tested in isolation. Existing imports keep working unchanged.
 */

export {
  DEFAULT_SIMPLIFY_EPSILON,
  MIN_FEATURE_AREA,
  MIN_HOLE_AREA,
  DUPLICATE_TOLERANCE_SQ,
  COLLINEAR_CROSS_TOLERANCE,
  CONTINENT_AREA_THRESHOLD,
} from './landSculpt/types';
export type { BrushStrokeConfig, SculptOptions, BoundingBox } from './landSculpt/types';
export {
  makeRng,
  MAX_NOISE_CACHE_SIZE,
  getNoiseCacheSize,
  getNoiseFunction,
} from './landSculpt/noise';
export {
  getSqDist,
  getSqSegmentDist,
  calculateSignedArea,
  calculatePolygonArea,
  getBoundingBox,
  doAABBIntersect,
  getPolygonCentroid,
  isPointInPolygon,
} from './landSculpt/geometry';
export {
  MAX_INTERPOLATION_STEPS,
  interpolateStrokePoints,
  generateOrganicStamp,
} from './landSculpt/stamp';
export {
  removeDuplicateVertices,
  removeCollinearVertices,
  ensureOpenRing,
  ensureClosedRing,
  isDegeneratePolygon,
  simplifyRadialDist,
  simplifyPolyline,
  simplifyPolygonRing,
  simplifyDouglasPeucker,
  sanitizePolygonRing,
  sanitizeAndSimplifyPolygon,
} from './landSculpt/simplify';
export {
  mapPointsToGeoRing,
  geoRingToMapPoints,
  featureToGeoPolygon,
  featuresToGeoMultiPolygon,
} from './landSculpt/geojson';
export { applySculptOperation } from './landSculpt/sculpt';
export {
  normalizeLandWaterFeatures,
  findBestLakeMatch,
  createInlandLake,
  isPointInLakeWater,
  lakeWaterGeometry,
  buildLakeWaterMultiPolygon,
  findNestedLandFeatures,
} from './landSculpt/waterFeatures';
