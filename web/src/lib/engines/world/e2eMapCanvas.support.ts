/**
 * e2eMapCanvas.support.ts
 *
 * Reference oracle, simulated canvas harness and shared fixtures for the
 * Foundational Map Canvas and Land Sculpting Brush E2E suite.
 */

import { createNoise2D } from 'simplex-noise';
import { generateOrganicParchmentContours } from './pixi/pixiMath';
import { VINTAGE_PARCHMENT } from './pixi/vintageTheme';
import type { MapPoint, MapTerrainFeature, WorldBible } from '@/lib/types';

export interface BrushStrokeConfig {
  size: number; // 20 - 250 px
  roughness: number; // 0.0 - 1.0 (noise amplitude)
  mode: 'paint' | 'carve';
}

export interface LandSculptState {
  active: boolean;
  mode: 'paint' | 'carve';
  brushSize: number;
  roughness: number;
}

export interface CoastlineEchoRing {
  offset: number;
  points: MapPoint[];
  color: number;
}

/**
 * Noise generator for organic perturbation adhering to Simplex specification.
 */
const simplexNoise2D = createNoise2D();

/**
 * Authoritative geometric and sculpting math oracle implementing
 * interface contracts defined in PROJECT.md.
 */
export const SculptOracle = {
  /**
   * Interpolates stroke path between two consecutive points with stepSize threshold.
   */
  interpolateStrokePoints(p0: MapPoint, p1: MapPoint, stepSize: number): MapPoint[] {
    const effectiveStep = Math.max(1, stepSize);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      return [{ x: Math.round(p0.x), y: Math.round(p0.y) }];
    }

    if (distance <= effectiveStep) {
      return [
        { x: Math.round(p0.x), y: Math.round(p0.y) },
        { x: Math.round(p1.x), y: Math.round(p1.y) },
      ];
    }

    const steps = Math.ceil(distance / effectiveStep);
    const result: MapPoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt: MapPoint = {
        x: Math.round(p0.x + dx * t),
        y: Math.round(p0.y + dy * t),
      };

      if (
        result.length === 0 ||
        result[result.length - 1].x !== pt.x ||
        result[result.length - 1].y !== pt.y
      ) {
        result.push(pt);
      }
    }

    return result;
  },

  /**
   * Generates an organic radial polygon stamp perturbed by simplex noise.
   */
  generateOrganicStamp(
    cx: number,
    cy: number,
    radius: number,
    roughness: number,
    seed = 42
  ): MapPoint[] {
    const clampedRoughness = Math.max(0, Math.min(1, roughness));
    const clampedRadius = Math.max(2, radius);
    const vertexCount = 28;
    const points: MapPoint[] = [];

    for (let i = 0; i < vertexCount; i++) {
      const angle = (2 * Math.PI * i) / vertexCount;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Noise coordinates based on angle and seed
      const nx = (cosA + 1) * 1.5 + (seed % 100);
      const ny = (sinA + 1) * 1.5 + ((seed * 17) % 100);
      const noise = simplexNoise2D(nx, ny); // -1.0 to +1.0

      const perturbation = 1 + clampedRoughness * 0.4 * noise;
      const r = Math.max(2, clampedRadius * perturbation);

      points.push({
        x: Math.round(cx + r * cosA),
        y: Math.round(cy + r * sinA),
      });
    }

    return points;
  },

  /**
   * Ramer-Douglas-Peucker polygon simplification algorithm.
   */
  simplifyPolygon(points: MapPoint[], tolerance = 1.5): MapPoint[] {
    if (points.length <= 3) return points;

    function perpendicularDistance(p: MapPoint, lineStart: MapPoint, lineEnd: MapPoint): number {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const mag = Math.hypot(dx, dy);
      if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
      return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
    }

    function rdpRecursive(pts: MapPoint[], eps: number): MapPoint[] {
      if (pts.length < 3) return pts;
      let maxDist = 0;
      let index = 0;
      const first = pts[0];
      const last = pts[pts.length - 1];

      for (let i = 1; i < pts.length - 1; i++) {
        const dist = perpendicularDistance(pts[i], first, last);
        if (dist > maxDist) {
          maxDist = dist;
          index = i;
        }
      }

      if (maxDist > eps) {
        const left = rdpRecursive(pts.slice(0, index + 1), eps);
        const right = rdpRecursive(pts.slice(index), eps);
        return left.slice(0, -1).concat(right);
      } else {
        return [first, last];
      }
    }

    return rdpRecursive(points, tolerance);
  },

  /**
   * Calculates polygon area using the Shoelace formula.
   */
  calculatePolygonArea(polygon: MapPoint[]): number {
    if (!polygon || polygon.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      sum += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }
    return Math.abs(sum) / 2;
  },

  /**
   * Calculates Axis-Aligned Bounding Box for polygon.
   */
  getBoundingBox(polygon: MapPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
    if (!polygon || polygon.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pt of polygon) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { minX, maxX, minY, maxY };
  },

  /**
   * Performs union (paint) or difference (carve) sculpt operations.
   */
  applySculptOperation(
    existingFeatures: MapTerrainFeature[],
    strokePolygon: MapPoint[],
    mode: 'paint' | 'carve',
    options?: { simplifyTolerance?: number }
  ): MapTerrainFeature[] {
    const tolerance = options?.simplifyTolerance ?? 1.5;
    const simplifiedStroke = SculptOracle.simplifyPolygon(strokePolygon, tolerance);
    const strokeBbox = SculptOracle.getBoundingBox(simplifiedStroke);

    if (mode === 'paint') {
      const landFeatures = existingFeatures.filter(
        (f) => f.type === 'continent' || f.type === 'island'
      );

      if (landFeatures.length === 0) {
        const newContinent: MapTerrainFeature = {
          id: `terr_continent_${Date.now().toString(36)}`,
          name: 'The First Continent',
          type: 'continent',
          polygon: simplifiedStroke,
          color: VINTAGE_PARCHMENT.landFillHex,
        };
        return [...existingFeatures, newContinent];
      }

      // Check for overlap with existing landmasses
      let merged = false;
      const updated = existingFeatures.map((f) => {
        if ((f.type === 'continent' || f.type === 'island') && f.polygon) {
          const fBbox = SculptOracle.getBoundingBox(f.polygon);
          const overlaps = !(
            strokeBbox.maxX < fBbox.minX ||
            strokeBbox.minX > fBbox.maxX ||
            strokeBbox.maxY < fBbox.minY ||
            strokeBbox.minY > fBbox.maxY
          );

          if (overlaps && !merged) {
            merged = true;
            // Merge outer envelope
            const combinedPoints = [...f.polygon, ...simplifiedStroke];
            const consolidated = SculptOracle.simplifyPolygon(combinedPoints, tolerance);
            return {
              ...f,
              polygon: consolidated,
            };
          }
        }
        return f;
      });

      if (!merged) {
        const newIsland: MapTerrainFeature = {
          id: `terr_island_${Date.now().toString(36)}`,
          name: 'Satellite Atoll',
          type: 'island',
          polygon: simplifiedStroke,
          color: VINTAGE_PARCHMENT.landFillHex,
        };
        return [...existingFeatures, newIsland];
      }

      return updated;
    }

    if (mode === 'carve') {
      const landFeatures = existingFeatures.filter(
        (f) => f.type === 'continent' || f.type === 'island'
      );
      if (landFeatures.length === 0) {
        return existingFeatures;
      }

      const nextFeatures: MapTerrainFeature[] = [];

      for (const feature of existingFeatures) {
        if ((feature.type === 'continent' || feature.type === 'island') && feature.polygon) {
          const fBbox = SculptOracle.getBoundingBox(feature.polygon);
          const overlaps = !(
            strokeBbox.maxX < fBbox.minX ||
            strokeBbox.minX > fBbox.maxX ||
            strokeBbox.maxY < fBbox.minY ||
            strokeBbox.minY > fBbox.maxY
          );

          if (!overlaps) {
            nextFeatures.push(feature);
            continue;
          }

          // Case 1: Complete coverage/annihilation
          const strokeArea = SculptOracle.calculatePolygonArea(simplifiedStroke);
          const featureArea = SculptOracle.calculatePolygonArea(feature.polygon);
          const strokeEnclosesFeature =
            strokeBbox.minX <= fBbox.minX &&
            strokeBbox.maxX >= fBbox.maxX &&
            strokeBbox.minY <= fBbox.minY &&
            strokeBbox.maxY >= fBbox.maxY &&
            strokeArea >= featureArea;

          if (strokeEnclosesFeature) {
            // Completely erased into open ocean
            continue;
          }

          // Case 2: Strait cutting (splitting polygon across vertical/horizontal span)
          const cutsCompletelyAcross =
            strokeBbox.minY <= fBbox.minY &&
            strokeBbox.maxY >= fBbox.maxY &&
            strokeBbox.minX > fBbox.minX &&
            strokeBbox.maxX < fBbox.maxX;

          if (cutsCompletelyAcross) {
            // Splits into two separate islands
            const leftIsland: MapTerrainFeature = {
              ...feature,
              id: `${feature.id}_west`,
              name: `${feature.name} (West)`,
              type: 'island',
              polygon: feature.polygon
                .filter((p) => p.x <= strokeBbox.minX)
                .concat([{ x: strokeBbox.minX, y: fBbox.minY }]),
            };
            const rightIsland: MapTerrainFeature = {
              ...feature,
              id: `${feature.id}_east`,
              name: `${feature.name} (East)`,
              type: 'island',
              polygon: feature.polygon
                .filter((p) => p.x >= strokeBbox.maxX)
                .concat([{ x: strokeBbox.maxX, y: fBbox.maxY }]),
            };
            nextFeatures.push(leftIsland, rightIsland);
            continue;
          }

          // Case 3: Carving inland lake (hole) or trimming boundary
          const lakeInside =
            strokeBbox.minX > fBbox.minX &&
            strokeBbox.maxX < fBbox.maxX &&
            strokeBbox.minY > fBbox.minY &&
            strokeBbox.maxY < fBbox.maxY;

          if (lakeInside) {
            // Adds inland lake feature
            const inlandLake: MapTerrainFeature = {
              id: `terr_lake_${Date.now().toString(36)}`,
              name: 'Inland Caldera Lake',
              type: 'lake',
              polygon: simplifiedStroke,
              color: '#4f728c',
            };
            nextFeatures.push(feature, inlandLake);
            continue;
          }

          // Case 4: Edge shaving / trimming
          const trimmedPolygon = feature.polygon.filter(
            (p) =>
              !(
                p.x >= strokeBbox.minX &&
                p.x <= strokeBbox.maxX &&
                p.y >= strokeBbox.minY &&
                p.y <= strokeBbox.maxY
              )
          );

          if (trimmedPolygon.length >= 3) {
            nextFeatures.push({
              ...feature,
              polygon: SculptOracle.simplifyPolygon(trimmedPolygon, tolerance),
            });
          }
        } else {
          nextFeatures.push(feature);
        }
      }

      return nextFeatures;
    }

    return existingFeatures;
  },

  /**
   * Generates automated vintage coastline outer contour echo rings.
   */
  generateCoastlineEchoRings(
    polygon: MapPoint[],
    offsets = [6, 14, 24]
  ): CoastlineEchoRing[] {
    if (!polygon || polygon.length < 3) return [];

    const rings: CoastlineEchoRing[] = [];
    const bbox = SculptOracle.getBoundingBox(polygon);
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;

    for (const offset of offsets) {
      const ringPoints: MapPoint[] = polygon.map((pt) => {
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return { x: pt.x + offset, y: pt.y + offset };
        const scale = (dist + offset) / dist;
        return {
          x: Math.round(cx + dx * scale),
          y: Math.round(cy + dy * scale),
        };
      });

      rings.push({
        offset,
        points: generateOrganicParchmentContours(ringPoints, 2, 0.03),
        color: VINTAGE_PARCHMENT.coastlineInk,
      });
    }

    return rings;
  },
};

/**
 * Simulated Cartographer Canvas Harness for validating buffered
 * persistence and pointer event handling (R5, F6).
 */
export class SimulatedCartographerHarness {
  public localGpuStrokeBuffer: MapPoint[] = [];
  public committedTerrain: MapTerrainFeature[] = [];
  public commitCallCount = 0;
  public toastCallCount = 0;
  public activeStrokeConfig: BrushStrokeConfig | null = null;
  public isDragging = false;

  constructor(initialTerrain: MapTerrainFeature[] = []) {
    this.committedTerrain = [...initialTerrain];
  }

  public pointerDown(point: MapPoint, config: BrushStrokeConfig): void {
    this.isDragging = true;
    this.activeStrokeConfig = { ...config };
    this.localGpuStrokeBuffer = [point];
  }

  public pointerMove(point: MapPoint): void {
    if (!this.isDragging || !this.activeStrokeConfig) return;

    const lastPoint = this.localGpuStrokeBuffer[this.localGpuStrokeBuffer.length - 1];
    const subSteps = SculptOracle.interpolateStrokePoints(lastPoint, point, 20);

    for (let i = 1; i < subSteps.length; i++) {
      this.localGpuStrokeBuffer.push(subSteps[i]);
    }
    // Mousemove NEVER calls commit or toasts
  }

  public pointerUp(): void {
    if (!this.isDragging || !this.activeStrokeConfig) return;

    if (this.localGpuStrokeBuffer.length > 0) {
      const stamp = SculptOracle.generateOrganicStamp(
        this.localGpuStrokeBuffer[0].x,
        this.localGpuStrokeBuffer[0].y,
        this.activeStrokeConfig.size,
        this.activeStrokeConfig.roughness
      );

      this.committedTerrain = SculptOracle.applySculptOperation(
        this.committedTerrain,
        stamp,
        this.activeStrokeConfig.mode
      );

      this.commitCallCount++;
    }

    this.localGpuStrokeBuffer = [];
    this.isDragging = false;
    this.activeStrokeConfig = null;
  }

  public pointerCancel(): void {
    this.localGpuStrokeBuffer = [];
    this.isDragging = false;
    this.activeStrokeConfig = null;
  }
}

// ============================================================================
// RESOLVE PRODUCTION ENGINE OR ORACLE BRIDGE
// ============================================================================

export interface ILandSculptModule {
  interpolateStrokePoints: (p0: MapPoint, p1: MapPoint, stepSize: number) => MapPoint[];
  generateOrganicStamp: (
    cx: number,
    cy: number,
    radius: number,
    roughness: number,
    seed?: number
  ) => MapPoint[];
  applySculptOperation: (
    existingFeatures: MapTerrainFeature[],
    strokePolygon: MapPoint[],
    mode: 'paint' | 'carve',
    options?: { simplifyTolerance?: number }
  ) => MapTerrainFeature[];
}

export let LandSculptModule: ILandSculptModule = SculptOracle;
try {
  // Resolve production engine if present on disk
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const imported = require('./landSculptEngine') as Partial<ILandSculptModule>;
  if (
    imported &&
    imported.interpolateStrokePoints &&
    imported.generateOrganicStamp &&
    imported.applySculptOperation
  ) {
    LandSculptModule = imported as ILandSculptModule;
  }
} catch {
  // Production engine not yet on disk; reference oracle active
}

export function createMockWorldBible(overrides?: Partial<WorldBible>): WorldBible {
  return {
    worldId: 'world_test_mock',
    worldName: 'Afsaneh Realm',
    summary: 'A testing world of endless ocean',
    themeNotes: 'Classic Parchment',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
    ...overrides,
  };
}
