export const DEFAULT_SIMPLIFY_EPSILON = 1.5; // pixels
export const MIN_FEATURE_AREA = 15.0; // sq pixels (discard outer slivers)
export const MIN_HOLE_AREA = 20.0; // sq pixels (discard needle pinholes)
export const DUPLICATE_TOLERANCE_SQ = 1e-4; // sq pixels (~0.01 px)
export const COLLINEAR_CROSS_TOLERANCE = 1e-5;
export const CONTINENT_AREA_THRESHOLD = 150000; // sq pixels

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BrushStrokeConfig {
  size: number; // 20 - 250 px
  roughness: number; // 0.0 - 1.0 (noise amplitude)
  mode: 'paint' | 'carve';
}

export interface SculptOptions {
  simplifyTolerance?: number; // Epsilon for Douglas-Peucker (default 1.5)
  minArea?: number; // Minimum polygon area to keep (default 15.0)
  minHoleArea?: number; // Minimum hole area to keep (default 20.0)
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
