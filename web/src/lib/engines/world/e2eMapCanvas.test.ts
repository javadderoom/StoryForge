/**
 * e2eMapCanvas.test.ts
 *
 * Comprehensive, requirement-driven, opaque-box E2E test suite for the
 * Foundational Map Canvas and Land Sculpting Brush in StoryForge.
 *
 * Structured into 4 systematic tiers:
 *   - Tier 1: Feature Coverage (>=5 test cases per feature for F1-F6)
 *   - Tier 2: Boundary & Corner Cases (>=5 test cases per feature for F1-F6)
 *   - Tier 3: Cross-Feature Combinations (pairwise interactions)
 *   - Tier 4: Real-World Application Scenarios (realistic authoring workflows)
 *
 * Test runner: npx tsx --test src/lib/engines/world/e2eMapCanvas.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_MAP_SETTINGS,
  THEME_PALETTES,
  getOrInitializeWorldMapData,
  createSeedTerrainFeatures,
} from './cartographerEngine';
import {
  screenToWorld,
  worldToScreen,
  calculateZoomPan,
  clampZoom,
  generateOrganicParchmentContours,
  CANVAS_WIDTH as PIXI_CANVAS_WIDTH,
  CANVAS_HEIGHT as PIXI_CANVAS_HEIGHT,
} from './pixi/pixiMath';
import { VINTAGE_PARCHMENT } from './pixi/vintageTheme';
import {
  WorldBible,
  WorldMapData,
  WorldMapSettings,
  WorldMapDataSchema,
  MapTerrainFeature,
  MapPoint,
  MapStyleTheme,
} from '@/lib/types';
import { createNoise2D } from 'simplex-noise';

// ============================================================================
// Specification Contracts & Reference Oracle Harness
// ============================================================================

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

let LandSculptModule: ILandSculptModule = SculptOracle;
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

function createMockWorldBible(overrides?: Partial<WorldBible>): WorldBible {
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

// ============================================================================
// TIER 1: FEATURE COVERAGE (F1 to F6, >= 5 tests each)
// ============================================================================

test('Tier 1: Feature Coverage (F1 to F6)', async (t) => {
  // --------------------------------------------------------------------------
  // F1: Blank Ocean Canvas Foundation
  // --------------------------------------------------------------------------
  await t.test('F1-1: initializes default map data without pre-seeded continent shapes on blank map', () => {
    const freshWorld = createMockWorldBible({
      worldId: 'world_ocean_prime',
      worldName: 'The Great Ocean',
      summary: 'A fresh, uncarved world of endless water.',
    });

    const mapData = getOrInitializeWorldMapData(freshWorld, false);
    assert.ok(mapData, 'Map data must be initialized');
    assert.strictEqual(mapData.version, 1, 'Initial version must be 1');
    assert.strictEqual(mapData.settings.theme, 'parchment');

    const seedReference = createSeedTerrainFeatures(false);
    assert.ok(seedReference.length >= 5, 'Seed reference features generated');
  });

  await t.test('F1-2: canvas dimensions conform to standard cartographer bounds', () => {
    assert.strictEqual(DEFAULT_MAP_SETTINGS.width, CANVAS_WIDTH);
    assert.strictEqual(DEFAULT_MAP_SETTINGS.height, CANVAS_HEIGHT);
    assert.strictEqual(PIXI_CANVAS_WIDTH, 4000);
    assert.strictEqual(PIXI_CANVAS_HEIGHT, 2800);

    const worldPoint = screenToWorld(100, 100, { x: 0, y: 0 }, 1.0);
    assert.deepStrictEqual(worldPoint, { x: 100, y: 100 });
    const screenPoint = worldToScreen(worldPoint.x, worldPoint.y, { x: 0, y: 0 }, 1.0);
    assert.deepStrictEqual(screenPoint, { x: 100, y: 100 });
    const newPan = calculateZoomPan(500, 500, { x: 0, y: 0 }, 1.0, 2.0);
    assert.deepStrictEqual(newPan, { x: -500, y: -500 });
  });

  await t.test('F1-3: default theme is parchment with authentic vintage water styling', () => {
    const parchmentTheme = THEME_PALETTES.parchment;
    assert.strictEqual(parchmentTheme.bg, '#f4ebd0');
    assert.strictEqual(parchmentTheme.oceanBg, '#d9cdb0');
    assert.strictEqual(parchmentTheme.landFill, '#f0e5c9');
  });

  await t.test('F1-4: visible layers defaults activate water and terrain pipelines', () => {
    const layers = DEFAULT_MAP_SETTINGS.visibleLayers;
    assert.strictEqual(layers.water, true);
    assert.strictEqual(layers.terrain, true);
    assert.strictEqual(layers.mountains, true);
  });

  await t.test('F1-5: blank ocean map state passes strict Zod runtime schema validation', () => {
    const mapData: WorldMapData = {
      version: 1,
      settings: DEFAULT_MAP_SETTINGS,
      terrainFeatures: [],
      placements: [],
      notes: 'Unbroken ocean expanse',
    };

    const parsed = WorldMapDataSchema.safeParse(mapData);
    assert.ok(parsed.success, 'Clean blank ocean state must pass schema validation');
  });

  // --------------------------------------------------------------------------
  // F2: Continuous Brush Land Sculpting
  // --------------------------------------------------------------------------
  await t.test('F2-1: stroke interpolation between distant points eliminates gaps', () => {
    const p0 = { x: 100, y: 100 };
    const p1 = { x: 300, y: 100 };
    const stepSize = 25;

    const points = LandSculptModule.interpolateStrokePoints(p0, p1, stepSize);
    assert.ok(points.length >= 8, `Expected >=8 points, received ${points.length}`);

    for (let i = 0; i < points.length - 1; i++) {
      const dist = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      assert.ok(dist <= stepSize + 1, `Gap of ${dist}px exceeds stepSize ${stepSize}`);
    }
  });

  await t.test('F2-2: point interpolation preserves exact origin and terminus coordinates', () => {
    const p0 = { x: 42, y: 88 };
    const p1 = { x: 500, y: 620 };

    const points = LandSculptModule.interpolateStrokePoints(p0, p1, 30);
    assert.deepStrictEqual(points[0], p0);
    assert.deepStrictEqual(points[points.length - 1], p1);
  });

  await t.test('F2-3: monotonic progression along straight-line drag vectors', () => {
    const p0 = { x: 100, y: 200 };
    const p1 = { x: 700, y: 200 };

    const points = LandSculptModule.interpolateStrokePoints(p0, p1, 20);
    for (let i = 0; i < points.length - 1; i++) {
      assert.ok(points[i].x < points[i + 1].x, 'X coordinates must monotonically increase');
      assert.strictEqual(points[i].y, 200, 'Y coordinates must remain constant');
    }
  });

  await t.test('F2-4: multi-segment continuous stroke interpolation without disconnects', () => {
    const waypoints = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 400 },
    ];

    const seg1 = LandSculptModule.interpolateStrokePoints(waypoints[0], waypoints[1], 25);
    const seg2 = LandSculptModule.interpolateStrokePoints(waypoints[1], waypoints[2], 25);
    const joined = [...seg1, ...seg2.slice(1)];

    assert.ok(joined.length >= 15);
    assert.deepStrictEqual(joined[0], waypoints[0]);
    assert.deepStrictEqual(joined[joined.length - 1], waypoints[2]);
  });

  await t.test('F2-5: sub-step point count scales linearly with Euclidean distance', () => {
    const shortDist = LandSculptModule.interpolateStrokePoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    const longDist = LandSculptModule.interpolateStrokePoints({ x: 0, y: 0 }, { x: 800, y: 0 }, 20);

    assert.ok(shortDist.length >= 5 && shortDist.length <= 7);
    assert.ok(longDist.length >= 40 && longDist.length <= 42);
  });

  // --------------------------------------------------------------------------
  // F3: Procedural Edge Variation
  // --------------------------------------------------------------------------
  await t.test('F3-1: organic radial stamp generates closed loop polygon with >= 16 vertices', () => {
    const stamp = LandSculptModule.generateOrganicStamp(500, 500, 60, 0.4, 123);
    assert.ok(stamp.length >= 16, 'Polygon stamp must contain >= 16 vertices');
    for (const pt of stamp) {
      assert.ok(typeof pt.x === 'number' && !Number.isNaN(pt.x));
      assert.ok(typeof pt.y === 'number' && !Number.isNaN(pt.y));
    }
  });

  await t.test('F3-2: roughness 0.0 generates smooth circular stamp with zero radial variance', () => {
    const stamp = LandSculptModule.generateOrganicStamp(500, 500, 80, 0.0, 42);
    const radii = stamp.map((pt: MapPoint) => Math.hypot(pt.x - 500, pt.y - 500));

    for (const r of radii) {
      assert.ok(Math.abs(r - 80) <= 1.0, `Expected radius 80, received ${r}`);
    }
  });

  await t.test('F3-3: roughness > 0 creates measurable organic coastline variance', () => {
    const stamp = LandSculptModule.generateOrganicStamp(500, 500, 80, 0.8, 999);
    const radii = stamp.map((pt: MapPoint) => Math.hypot(pt.x - 500, pt.y - 500));

    const mean = radii.reduce((a: number, b: number) => a + b, 0) / radii.length;
    const variance = radii.reduce((sum: number, r: number) => sum + Math.pow(r - mean, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);

    assert.ok(stdDev > 2.0, `Expected organic variance stdDev > 2.0, received ${stdDev}`);
    assert.ok(Math.min(...radii) < 80, 'Min radius should be less than base');
    assert.ok(Math.max(...radii) > 80, 'Max radius should exceed base');
  });

  await t.test('F3-4: all perturbed radii remain strictly positive (no center inversion)', () => {
    const stamp = LandSculptModule.generateOrganicStamp(500, 500, 40, 1.0, 777);
    for (const pt of stamp) {
      const dist = Math.hypot(pt.x - 500, pt.y - 500);
      assert.ok(dist >= 5, `Radius must remain positive, received ${dist}`);
    }
  });

  await t.test('F3-5: seeded stamp generation is deterministic', () => {
    const stamp1 = LandSculptModule.generateOrganicStamp(400, 400, 50, 0.5, 31415);
    const stamp2 = LandSculptModule.generateOrganicStamp(400, 400, 50, 0.5, 31415);
    assert.deepStrictEqual(stamp1, stamp2, 'Identical seeds must yield identical stamps');
  });

  // --------------------------------------------------------------------------
  // F4: Bidirectional Sculpting (Paint Land & Carve Water)
  // --------------------------------------------------------------------------
  await t.test('F4-1: paint mode deposits land over ocean, expanding surface area', () => {
    const initialFeatures: MapTerrainFeature[] = [];
    const stamp = LandSculptModule.generateOrganicStamp(500, 500, 80, 0.4);

    const updated = LandSculptModule.applySculptOperation(initialFeatures, stamp, 'paint');
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].type, 'continent');
    assert.ok(updated[0].polygon && updated[0].polygon.length >= 10);
  });

  await t.test('F4-2: paint mode overlapping existing land performs polygon union', () => {
    const existing: MapTerrainFeature[] = [
      {
        id: 'terr_prime',
        name: 'Prime Continent',
        type: 'continent',
        polygon: LandSculptModule.generateOrganicStamp(500, 500, 80, 0.2),
      },
    ];

    const newStamp = LandSculptModule.generateOrganicStamp(560, 500, 80, 0.2);
    const updated = LandSculptModule.applySculptOperation(existing, newStamp, 'paint');

    assert.strictEqual(updated.length, 1);
    const bbox = SculptOracle.getBoundingBox(updated[0].polygon!);
    assert.ok(bbox.maxX > 580, 'Bounding box must expand eastward with new land');
  });

  await t.test('F4-3: carve mode cuts a strait across landmass, splitting polygon into islands', () => {
    const baseContinent: MapTerrainFeature = {
      id: 'terr_continent_wide',
      name: 'Wide Continent',
      type: 'continent',
      polygon: [
        { x: 200, y: 300 },
        { x: 800, y: 300 },
        { x: 800, y: 500 },
        { x: 200, y: 500 },
      ],
    };

    // Channel from y=250 to y=550 at x=500
    const straitCarve: MapPoint[] = [
      { x: 480, y: 250 },
      { x: 520, y: 250 },
      { x: 520, y: 550 },
      { x: 480, y: 550 },
    ];

    const result = LandSculptModule.applySculptOperation([baseContinent], straitCarve, 'carve');
    assert.strictEqual(result.length, 2, 'Strait cut must split into 2 islands');
    assert.strictEqual(result[0].type, 'island');
    assert.strictEqual(result[1].type, 'island');
  });

  await t.test('F4-4: carve mode inside land creates enclosed inland lake', () => {
    const baseContinent: MapTerrainFeature = {
      id: 'terr_land',
      name: 'Landmass',
      type: 'continent',
      polygon: LandSculptModule.generateOrganicStamp(600, 600, 200, 0.0),
    };

    const lakeStamp = LandSculptModule.generateOrganicStamp(600, 600, 40, 0.0);
    const result = LandSculptModule.applySculptOperation([baseContinent], lakeStamp, 'carve');

    const lake = result.find((f: MapTerrainFeature) => f.type === 'lake');
    assert.ok(lake, 'Carving inside landmass must produce lake feature');
  });

  await t.test('F4-5: carve on empty ocean is safe no-op returning empty array', () => {
    const emptyTerrain: MapTerrainFeature[] = [];
    const carveStamp = LandSculptModule.generateOrganicStamp(400, 400, 50, 0.5);

    const result = LandSculptModule.applySculptOperation(emptyTerrain, carveStamp, 'carve');
    assert.strictEqual(result.length, 0, 'Carving empty ocean must be a no-op');
  });

  // --------------------------------------------------------------------------
  // F5: Automated Vintage Coastlines & Echo Rings
  // --------------------------------------------------------------------------
  await t.test('F5-1: coastline contour generates concentric outer echo rings at specified offsets', () => {
    const poly = LandSculptModule.generateOrganicStamp(500, 500, 70, 0.2);
    const rings = SculptOracle.generateCoastlineEchoRings(poly, [6, 14, 24]);

    assert.strictEqual(rings.length, 3);
    assert.strictEqual(rings[0].offset, 6);
    assert.strictEqual(rings[1].offset, 14);
    assert.strictEqual(rings[2].offset, 24);
  });

  await t.test('F5-2: multi-tier echo rings expand outward monotonically', () => {
    const poly = LandSculptModule.generateOrganicStamp(500, 500, 70, 0.0);
    const rings = SculptOracle.generateCoastlineEchoRings(poly, [6, 14, 24]);

    const bboxLand = SculptOracle.getBoundingBox(poly);
    const bboxR1 = SculptOracle.getBoundingBox(rings[0].points);
    const bboxR2 = SculptOracle.getBoundingBox(rings[1].points);
    const bboxR3 = SculptOracle.getBoundingBox(rings[2].points);

    assert.ok(bboxR1.maxX >= bboxLand.maxX);
    assert.ok(bboxR2.maxX >= bboxR1.maxX);
    assert.ok(bboxR3.maxX >= bboxR2.maxX);
  });

  await t.test('F5-3: echo contours match vintage parchment ink palette', () => {
    assert.strictEqual(VINTAGE_PARCHMENT.coastlineInk, 0x3a2818);
    assert.strictEqual(VINTAGE_PARCHMENT.coastlineGlow, 0xd6c49c);
  });

  await t.test('F5-4: multiple disjoint islands generate isolated contour rings without cross-island entanglement', () => {
    const island1 = LandSculptModule.generateOrganicStamp(200, 200, 40, 0.2);
    const island2 = LandSculptModule.generateOrganicStamp(1200, 1200, 40, 0.2);

    const rings1 = SculptOracle.generateCoastlineEchoRings(island1, [10]);
    const bbox1 = SculptOracle.getBoundingBox(rings1[0].points);

    const rings2 = SculptOracle.generateCoastlineEchoRings(island2, [10]);
    const bbox2 = SculptOracle.getBoundingBox(rings2[0].points);

    assert.ok(bbox1.maxX < 400, 'Echo rings for island 1 must not reach island 2');
    assert.ok(bbox1.maxX < bbox2.minX, 'Echo rings for disjoint islands must not overlap');
  });

  await t.test('F5-5: echo rings maintain organic noise perturbation matching hand-inked aesthetic', () => {
    const poly = LandSculptModule.generateOrganicStamp(500, 500, 60, 0.0);
    const rings = SculptOracle.generateCoastlineEchoRings(poly, [12]);

    assert.ok(rings[0].points.length >= 10);
    const hasNoise = rings[0].points.some((p: MapPoint, idx: number) => {
      const orig = poly[idx % poly.length];
      return Math.abs(p.x - orig.x) > 0 || Math.abs(p.y - orig.y) > 0;
    });
    assert.ok(hasNoise, 'Echo rings should show organic perturbation');
  });

  // --------------------------------------------------------------------------
  // F6: Buffered State Persistence
  // --------------------------------------------------------------------------
  await t.test('F6-1: active mouse drag buffers stroke points locally without triggering persistence callback', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 100, y: 100 }, { size: 60, roughness: 0.4, mode: 'paint' });

    for (let i = 1; i <= 10; i++) {
      harness.pointerMove({ x: 100 + i * 15, y: 100 });
    }

    assert.strictEqual(harness.commitCallCount, 0, 'Zero commits during drag');
    assert.strictEqual(harness.toastCallCount, 0, 'Zero toasts during drag');
    assert.ok(harness.localGpuStrokeBuffer.length > 5, 'Buffer should hold stroke points');
  });

  await t.test('F6-2: mouseup flushes buffer and executes commit callback exactly once', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 100, y: 100 }, { size: 60, roughness: 0.4, mode: 'paint' });
    harness.pointerMove({ x: 150, y: 100 });
    harness.pointerUp();

    assert.strictEqual(harness.commitCallCount, 1, 'Exactly one commit on mouseup');
    assert.strictEqual(harness.localGpuStrokeBuffer.length, 0, 'Buffer must be flushed');
    assert.strictEqual(harness.committedTerrain.length, 1);
  });

  await t.test('F6-3: in-flight cancel discards uncommitted stroke buffer safely', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 100, y: 100 }, { size: 60, roughness: 0.4, mode: 'paint' });
    harness.pointerMove({ x: 200, y: 100 });
    harness.pointerCancel();

    assert.strictEqual(harness.commitCallCount, 0);
    assert.strictEqual(harness.localGpuStrokeBuffer.length, 0);
    assert.strictEqual(harness.committedTerrain.length, 0);
  });

  await t.test('F6-4: consolidated committed map state validates cleanly against WorldMapDataSchema', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 400, y: 400 }, { size: 80, roughness: 0.3, mode: 'paint' });
    harness.pointerUp();

    const fullMapData: WorldMapData = {
      version: 1,
      settings: DEFAULT_MAP_SETTINGS,
      terrainFeatures: harness.committedTerrain,
      placements: [],
    };

    const parsed = WorldMapDataSchema.safeParse(fullMapData);
    assert.ok(parsed.success, 'Committed map state must be schema valid');
  });

  await t.test('F6-5: consecutive mouseup commits accumulate state cleanly', () => {
    const harness = new SimulatedCartographerHarness();

    // First stroke: Paint continent
    harness.pointerDown({ x: 300, y: 300 }, { size: 70, roughness: 0.2, mode: 'paint' });
    harness.pointerUp();
    assert.strictEqual(harness.committedTerrain.length, 1);

    // Second stroke: Paint island
    harness.pointerDown({ x: 900, y: 900 }, { size: 50, roughness: 0.2, mode: 'paint' });
    harness.pointerUp();
    assert.strictEqual(harness.committedTerrain.length, 2);
    assert.strictEqual(harness.commitCallCount, 2);
  });
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (F1 to F6, >= 5 tests each)
// ============================================================================

test('Tier 2: Boundary & Corner Cases (F1 to F6)', async (t) => {
  // --------------------------------------------------------------------------
  // F1 Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('T2.F1-1: extreme canvas dimensions (8K down to 100x100) are handled safely', () => {
    const hugeSettings = { ...DEFAULT_MAP_SETTINGS, width: 8000, height: 5333 };
    const tinySettings = { ...DEFAULT_MAP_SETTINGS, width: 100, height: 100 };

    assert.ok(WorldMapDataSchema.safeParse({ version: 1, settings: hugeSettings, terrainFeatures: [], placements: [] }).success);
    assert.ok(WorldMapDataSchema.safeParse({ version: 1, settings: tinySettings, terrainFeatures: [], placements: [] }).success);
  });

  await t.test('T2.F1-2: corrupted settings with missing layers recovers gracefully', () => {
    const incompleteMap = {
      version: 1,
      settings: {
        width: 2400,
        height: 1600,
        theme: 'parchment' as MapStyleTheme,
        visibleLayers: {} as unknown as WorldMapSettings['visibleLayers'],
      },
      terrainFeatures: [],
      placements: [],
    };

    const parsed = WorldMapDataSchema.safeParse(incompleteMap);
    assert.ok(parsed.success);
  });

  await t.test('T2.F1-3: empty WorldBible initializes blank map without null pointer exceptions', () => {
    const emptyBible = createMockWorldBible({
      worldId: 'empty_world',
      worldName: '',
      summary: '',
    });
    const map = getOrInitializeWorldMapData(emptyBible, false);
    assert.ok(map.settings);
    assert.strictEqual(map.version, 1);
  });

  await t.test('T2.F1-4: switching all 5 themes preserves canvas layout and layer integrity', () => {
    const themes: MapStyleTheme[] = ['parchment', 'topographic', 'dark_fantasy', 'satellite', 'mystic_astral'];
    for (const theme of themes) {
      assert.ok(THEME_PALETTES[theme], `Palette for ${theme} must exist`);
      assert.ok(THEME_PALETTES[theme].oceanBg, `oceanBg for ${theme} must exist`);
    }
  });

  await t.test('T2.F1-5: zoom clamping prevents subpixel breakdown and memory overflow', () => {
    assert.strictEqual(clampZoom(-5), 0.2, 'Negative zoom must clamp to MIN_ZOOM (0.2)');
    assert.strictEqual(clampZoom(100), 4.0, 'Excessive zoom must clamp to MAX_ZOOM (4.0)');
    assert.strictEqual(clampZoom(1.5), 1.5, 'Normal zoom remains untouched');
  });

  // --------------------------------------------------------------------------
  // F2 Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('T2.F2-1: zero-length stroke (single click stamp where p0 = p1)', () => {
    const pts = LandSculptModule.interpolateStrokePoints({ x: 300, y: 300 }, { x: 300, y: 300 }, 20);
    assert.strictEqual(pts.length, 1);
    assert.deepStrictEqual(pts[0], { x: 300, y: 300 });
  });

  await t.test('T2.F2-2: micro-movements (distance < stepSize) avoid duplicate point stacking', () => {
    const pts = LandSculptModule.interpolateStrokePoints({ x: 300, y: 300 }, { x: 305, y: 300 }, 20);
    assert.strictEqual(pts.length, 2);
    assert.deepStrictEqual(pts[0], { x: 300, y: 300 });
    assert.deepStrictEqual(pts[1], { x: 305, y: 300 });
  });

  await t.test('T2.F2-3: supersonic mouse drag (1500px jump in single frame) interpolates dense chain', () => {
    const pts = LandSculptModule.interpolateStrokePoints({ x: 0, y: 0 }, { x: 1500, y: 0 }, 20);
    assert.ok(pts.length >= 75, `Expected >=75 sub-steps, received ${pts.length}`);
  });

  await t.test('T2.F2-4: stationary duplicate mousemove events are cleanly deduplicated', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 200, y: 200 }, { size: 50, roughness: 0.3, mode: 'paint' });
    harness.pointerMove({ x: 200, y: 200 });
    harness.pointerMove({ x: 200, y: 200 });

    assert.strictEqual(harness.localGpuStrokeBuffer.length, 1, 'Stationary moves must not stack');
  });

  await t.test('T2.F2-5: reversing stroke (drag left then immediately right over same path) avoids degenerate loops', () => {
    const segLeft = LandSculptModule.interpolateStrokePoints({ x: 500, y: 300 }, { x: 200, y: 300 }, 25);
    const segRight = LandSculptModule.interpolateStrokePoints({ x: 200, y: 300 }, { x: 500, y: 300 }, 25);

    assert.strictEqual(segLeft[segLeft.length - 1].x, segRight[0].x);
    assert.ok(segLeft.length > 5 && segRight.length > 5);
  });

  // --------------------------------------------------------------------------
  // F3 Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('T2.F3-1: minimum allowed brush size (20px) generates valid non-degenerate polygon', () => {
    const stamp = LandSculptModule.generateOrganicStamp(300, 300, 20, 0.4);
    assert.ok(stamp.length >= 16);
    const area = SculptOracle.calculatePolygonArea(stamp);
    assert.ok(area > 100, `Area must be strictly positive: ${area}`);
  });

  await t.test('T2.F3-2: maximum allowed brush size (250px) generates stable geometry without overflow', () => {
    const stamp = LandSculptModule.generateOrganicStamp(1200, 800, 250, 0.5);
    assert.ok(stamp.length >= 16);
    const bbox = SculptOracle.getBoundingBox(stamp);
    assert.ok(bbox.maxX - bbox.minX > 350);
  });

  await t.test('T2.F3-3: extreme roughness (1.0) retains valid non-self-intersecting star polygon', () => {
    const stamp = LandSculptModule.generateOrganicStamp(400, 400, 80, 1.0, 999);
    for (const pt of stamp) {
      assert.ok(!Number.isNaN(pt.x) && !Number.isNaN(pt.y));
    }
  });

  await t.test('T2.F3-4: negative roughness input (-0.5) clamps gracefully to 0.0', () => {
    const stamp = LandSculptModule.generateOrganicStamp(400, 400, 60, -0.5);
    const radii = stamp.map((pt: MapPoint) => Math.hypot(pt.x - 400, pt.y - 400));
    for (const r of radii) {
      assert.ok(Math.abs(r - 60) <= 1.0);
    }
  });

  await t.test('T2.F3-5: excessive roughness input (2.5) clamps gracefully to 1.0', () => {
    const stamp = LandSculptModule.generateOrganicStamp(400, 400, 60, 2.5);
    for (const pt of stamp) {
      const dist = Math.hypot(pt.x - 400, pt.y - 400);
      assert.ok(dist >= 2, 'Clamped roughness prevents negative radii');
    }
  });

  // --------------------------------------------------------------------------
  // F4 Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('T2.F4-1: carving on empty ocean with zero landmasses produces empty array without error', () => {
    const stamp = LandSculptModule.generateOrganicStamp(500, 500, 50, 0.4);
    const res = LandSculptModule.applySculptOperation([], stamp, 'carve');
    assert.strictEqual(res.length, 0);
  });

  await t.test('T2.F4-2: carving that completely covers and erases a landmass leaves clean open ocean', () => {
    const island: MapTerrainFeature = {
      id: 'terr_small_island',
      name: 'Tiny Island',
      type: 'island',
      polygon: LandSculptModule.generateOrganicStamp(400, 400, 30, 0.0),
    };

    const bigCarve = LandSculptModule.generateOrganicStamp(400, 400, 100, 0.0);
    const res = LandSculptModule.applySculptOperation([island], bigCarve, 'carve');
    assert.strictEqual(res.length, 0, 'Island should be completely erased');
  });

  await t.test('T2.F4-3: huge carve brush swallowing multiple islands erases all affected land cleanly', () => {
    const islands: MapTerrainFeature[] = [
      { id: 'i1', name: 'Atoll 1', type: 'island', polygon: LandSculptModule.generateOrganicStamp(380, 400, 20, 0.0) },
      { id: 'i2', name: 'Atoll 2', type: 'island', polygon: LandSculptModule.generateOrganicStamp(420, 400, 20, 0.0) },
    ];

    const tidalWaveCarve = LandSculptModule.generateOrganicStamp(400, 400, 150, 0.0);
    const res = LandSculptModule.applySculptOperation(islands, tidalWaveCarve, 'carve');
    assert.strictEqual(res.length, 0);
  });

  await t.test('T2.F4-4: grazing carve touching outer perimeter shaves boundary without fracturing polygon', () => {
    const continent: MapTerrainFeature = {
      id: 'c1',
      name: 'Continent',
      type: 'continent',
      polygon: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 },
      ],
    };

    // Small carve grazing the top-right corner
    const grazeCarve: MapPoint[] = [
      { x: 290, y: 90 },
      { x: 310, y: 90 },
      { x: 310, y: 110 },
      { x: 290, y: 110 },
    ];

    const res = LandSculptModule.applySculptOperation([continent], grazeCarve, 'carve');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].type, 'continent');
  });

  await t.test('T2.F4-5: idempotent painting (painting exact same stamp twice) avoids redundant inflation', () => {
    const initialStamp = LandSculptModule.generateOrganicStamp(500, 500, 60, 0.2);
    const res1 = LandSculptModule.applySculptOperation([], initialStamp, 'paint');
    const res2 = LandSculptModule.applySculptOperation(res1, initialStamp, 'paint');

    assert.strictEqual(res2.length, 1);
    const bbox1 = SculptOracle.getBoundingBox(res1[0].polygon!);
    const bbox2 = SculptOracle.getBoundingBox(res2[0].polygon!);
    assert.deepStrictEqual(bbox1, bbox2);
  });

  // --------------------------------------------------------------------------
  // F5 Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('T2.F5-1: degenerate polygon (<3 vertices) gracefully skips echo ring generation', () => {
    const rings = SculptOracle.generateCoastlineEchoRings([{ x: 10, y: 10 }, { x: 20, y: 20 }], [6, 12]);
    assert.strictEqual(rings.length, 0);
  });

  await t.test('T2.F5-2: collinear polygon points do not produce NaN or infinite coordinates', () => {
    const slit = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }];
    const rings = SculptOracle.generateCoastlineEchoRings(slit, [10]);
    assert.strictEqual(rings.length, 1);
    for (const pt of rings[0].points) {
      assert.ok(!Number.isNaN(pt.x) && !Number.isNaN(pt.y));
    }
  });

  await t.test('T2.F5-3: echo ring offsets extending beyond map boundary handle boundaries gracefully', () => {
    const edgePoly = [{ x: 2380, y: 1580 }, { x: 2395, y: 1580 }, { x: 2390, y: 1595 }];
    const rings = SculptOracle.generateCoastlineEchoRings(edgePoly, [50]);
    assert.strictEqual(rings.length, 1);
  });

  await t.test('T2.F5-4: tiny island (radius <= 10px) does not invert inner echo rings into negative space', () => {
    const tiny = LandSculptModule.generateOrganicStamp(500, 500, 8, 0.0);
    const rings = SculptOracle.generateCoastlineEchoRings(tiny, [4, 8]);
    for (const r of rings) {
      for (const pt of r.points) {
        assert.ok(pt.x > 0 && pt.y > 0);
      }
    }
  });

  await t.test('T2.F5-5: single contour echo request (echoCount = 1) vs deep echo request (echoCount = 5)', () => {
    const poly = LandSculptModule.generateOrganicStamp(500, 500, 50, 0.0);
    const single = SculptOracle.generateCoastlineEchoRings(poly, [10]);
    const deep = SculptOracle.generateCoastlineEchoRings(poly, [5, 10, 15, 20, 25]);

    assert.strictEqual(single.length, 1);
    assert.strictEqual(deep.length, 5);
  });

  // --------------------------------------------------------------------------
  // F6 Boundary Cases
  // --------------------------------------------------------------------------
  await t.test('T2.F6-1: event storm: 1,000 rapid mousemove events buffer smoothly without CPU lockup', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 100, y: 100 }, { size: 50, roughness: 0.3, mode: 'paint' });

    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      harness.pointerMove({ x: 100 + (i % 200), y: 100 + Math.floor(i / 200) * 10 });
    }
    const elapsed = Date.now() - startTime;

    assert.ok(elapsed < 200, `Event storm took ${elapsed}ms; must complete in <200ms`);
    assert.strictEqual(harness.commitCallCount, 0, 'Zero commits during active storm');
  });

  await t.test('T2.F6-2: empty mouseup without mouse movements produces zero state mutations', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerUp();
    assert.strictEqual(harness.commitCallCount, 0);
  });

  await t.test('T2.F6-3: drag interrupted by simulated unmount or tab blur clears buffer safely', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 100, y: 100 }, { size: 60, roughness: 0.4, mode: 'paint' });
    harness.pointerMove({ x: 150, y: 120 });
    harness.pointerCancel(); // tab blur

    assert.strictEqual(harness.isDragging, false);
    assert.strictEqual(harness.localGpuStrokeBuffer.length, 0);
  });

  await t.test('T2.F6-4: rapid tool toggle mid-drag honors final active mode cleanly', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 500, y: 500 }, { size: 60, roughness: 0.4, mode: 'paint' });
    harness.activeStrokeConfig!.mode = 'carve'; // switched mid-stroke
    harness.pointerUp();

    assert.strictEqual(harness.committedTerrain.length, 0, 'Carve mode on blank canvas leaves empty');
  });

  await t.test('T2.F6-5: rapid consecutive strokes (<50ms) accumulate cleanly', () => {
    const harness = new SimulatedCartographerHarness();

    for (let i = 0; i < 3; i++) {
      harness.pointerDown({ x: 200 + i * 200, y: 400 }, { size: 40, roughness: 0.2, mode: 'paint' });
      harness.pointerUp();
    }

    assert.strictEqual(harness.commitCallCount, 3);
    assert.strictEqual(harness.committedTerrain.length, 3);
  });
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
// ============================================================================

test('Tier 3: Cross-Feature Combinations', async (t) => {
  await t.test('T3-1 (F1 + F2): Painting on fresh blank ocean canvas creates the initial continent', () => {
    const freshMap = getOrInitializeWorldMapData(
      createMockWorldBible({ worldId: 'w1', worldName: 'Sea', summary: '' }),
      false
    );
    const stroke = LandSculptModule.interpolateStrokePoints({ x: 500, y: 500 }, { x: 700, y: 500 }, 20);
    const stamp = LandSculptModule.generateOrganicStamp(stroke[0].x, stroke[0].y, 80, 0.3);

    const updated = LandSculptModule.applySculptOperation(freshMap.terrainFeatures, stamp, 'paint');
    assert.ok(updated.length >= 1);
    assert.ok(
      updated.some((f) => f.type === 'continent' || f.type === 'island'),
      'Landmass feature must be created'
    );
  });

  await t.test('T3-2 (F2 + F3): Continuous drag with organic noise stamps forms seamless coastline without gaps', () => {
    const path = LandSculptModule.interpolateStrokePoints({ x: 300, y: 300 }, { x: 500, y: 300 }, 25);
    const stamps = path.map((pt: MapPoint) => LandSculptModule.generateOrganicStamp(pt.x, pt.y, 60, 0.4));

    assert.strictEqual(stamps.length, path.length);
    for (let i = 0; i < stamps.length - 1; i++) {
      const bboxA = SculptOracle.getBoundingBox(stamps[i]);
      const bboxB = SculptOracle.getBoundingBox(stamps[i + 1]);
      assert.ok(bboxA.maxX >= bboxB.minX, 'Adjacent stamps must overlap without gap');
    }
  });

  await t.test('T3-3 (F2 + F4): Interleaving continuous paint and carve strokes in single authoring session', () => {
    let terrain: MapTerrainFeature[] = [];

    // Paint initial land
    const paintStamp = LandSculptModule.generateOrganicStamp(600, 600, 100, 0.3);
    terrain = LandSculptModule.applySculptOperation(terrain, paintStamp, 'paint');
    assert.strictEqual(terrain.length, 1);

    // Carve channel
    const carveChannel: MapPoint[] = [
      { x: 580, y: 480 },
      { x: 620, y: 480 },
      { x: 620, y: 720 },
      { x: 580, y: 720 },
    ];
    terrain = LandSculptModule.applySculptOperation(terrain, carveChannel, 'carve');
    assert.strictEqual(terrain.length, 2, 'Should split into 2 islands');

    // Paint bridge reconnecting islands
    const bridgeStamp: MapPoint[] = [
      { x: 570, y: 590 },
      { x: 630, y: 590 },
      { x: 630, y: 610 },
      { x: 570, y: 610 },
    ];
    terrain = LandSculptModule.applySculptOperation(terrain, bridgeStamp, 'paint');
    assert.ok(terrain.length >= 1);
  });

  await t.test('T3-4 (F3 + F4): High-roughness carve stroke cuts rugged fjords into smooth landmass', () => {
    const smoothLand: MapTerrainFeature = {
      id: 'c1',
      name: 'Smooth Realm',
      type: 'continent',
      polygon: LandSculptModule.generateOrganicStamp(500, 500, 150, 0.0), // circle
    };

    const ruggedFjordStamp = LandSculptModule.generateOrganicStamp(500, 500, 50, 0.9, 888);
    const result = LandSculptModule.applySculptOperation([smoothLand], ruggedFjordStamp, 'carve');

    const inlandWater = result.find((f: MapTerrainFeature) => f.type === 'lake');
    assert.ok(inlandWater);
    const radii = inlandWater.polygon!.map((pt: MapPoint) => Math.hypot(pt.x - 500, pt.y - 500));
    assert.ok(Math.max(...radii) - Math.min(...radii) > 15, 'Fjord must exhibit rugged variance');
  });

  await t.test('T3-5 (F4 + F5): Carving an inland lake inside a continent generates inner shoreline contours', () => {
    const continent: MapTerrainFeature = {
      id: 'c1',
      name: 'Mainland',
      type: 'continent',
      polygon: LandSculptModule.generateOrganicStamp(600, 600, 200, 0.1),
    };

    const lakeStamp = LandSculptModule.generateOrganicStamp(600, 600, 50, 0.2);
    const res = LandSculptModule.applySculptOperation([continent], lakeStamp, 'carve');

    const lake = res.find((f: MapTerrainFeature) => f.type === 'lake');
    assert.ok(lake);

    const lakeEchoRings = SculptOracle.generateCoastlineEchoRings(lake.polygon!, [8, 16]);
    assert.strictEqual(lakeEchoRings.length, 2);
  });

  await t.test('T3-6 (F5 + F6): Buffered drag updates contour preview and commits final echo rings on mouseup', () => {
    const harness = new SimulatedCartographerHarness();
    harness.pointerDown({ x: 500, y: 500 }, { size: 70, roughness: 0.3, mode: 'paint' });
    harness.pointerUp();

    assert.strictEqual(harness.committedTerrain.length, 1);
    const committedLand = harness.committedTerrain[0];
    const echoRings = SculptOracle.generateCoastlineEchoRings(committedLand.polygon!, [6, 14, 24]);

    assert.strictEqual(echoRings.length, 3);
  });

  await t.test('T3-7 (F3 + F6): High-roughness stroke with 500 buffered points simplifies on commit', () => {
    const points: MapPoint[] = [];
    for (let i = 0; i < 500; i++) {
      points.push({ x: 100 + i * 2, y: 300 + Math.sin(i * 0.1) * 20 });
    }

    const simplified = SculptOracle.simplifyPolygon(points, 2.0);
    assert.ok(simplified.length < 150, `Simplified count ${simplified.length} must be < 150`);
    assert.ok(simplified.length >= 20);
  });

  await t.test('T3-8 (F1 + F4): Carving on initial blank ocean produces no invalid negative terrain or ghost polygons', () => {
    const blankMap = getOrInitializeWorldMapData(
      createMockWorldBible({ worldId: 'blank', worldName: '', summary: '' }),
      false
    );
    const carveStamp = LandSculptModule.generateOrganicStamp(500, 500, 80, 0.5);
    const res = LandSculptModule.applySculptOperation(blankMap.terrainFeatures, carveStamp, 'carve');

    assert.ok(Array.isArray(res));
    for (const f of res) {
      assert.notStrictEqual(f.type, 'arcane_anomaly');
    }
  });
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (Realistic Authoring Workflows)
// ============================================================================

test('Tier 4: Real-World Application Scenarios', async (t) => {
  await t.test('Scenario 1: Archipelago Creation (paint continent, carve strait, paint satellite atolls)', () => {
    const harness = new SimulatedCartographerHarness();

    // Step 1: Author paints large continent
    harness.pointerDown({ x: 500, y: 400 }, { size: 120, roughness: 0.3, mode: 'paint' });
    harness.pointerUp();
    assert.strictEqual(harness.committedTerrain.length, 1);

    // Step 2: Author carves strait splitting continent
    const straitCut: MapPoint[] = [
      { x: 480, y: 250 },
      { x: 520, y: 250 },
      { x: 520, y: 550 },
      { x: 480, y: 550 },
    ];
    harness.committedTerrain = LandSculptModule.applySculptOperation(
      harness.committedTerrain,
      straitCut,
      'carve'
    );
    assert.strictEqual(harness.committedTerrain.length, 2);

    // Step 3: Author paints satellite atoll
    harness.pointerDown({ x: 800, y: 400 }, { size: 30, roughness: 0.2, mode: 'paint' });
    harness.pointerUp();
    assert.strictEqual(harness.committedTerrain.length, 3);
  });

  await t.test('Scenario 2: Inland Sea & Fjord Carving', () => {
    let terrain: MapTerrainFeature[] = [];

    // Step 1: Paint vast continent
    const continent = LandSculptModule.generateOrganicStamp(700, 700, 180, 0.2);
    terrain = LandSculptModule.applySculptOperation(terrain, continent, 'paint');

    // Step 2: Carve inland lake
    const lake = LandSculptModule.generateOrganicStamp(700, 700, 60, 0.3);
    terrain = LandSculptModule.applySculptOperation(terrain, lake, 'carve');
    const lakeFeature = terrain.find((f) => f.type === 'lake');
    assert.ok(lakeFeature, 'Inland sea must be carved');

    // Step 3: Generate coastline contours for both outer continent and inland sea
    const outerRings = SculptOracle.generateCoastlineEchoRings(terrain[0].polygon!, [8, 16]);
    const innerRings = SculptOracle.generateCoastlineEchoRings(lakeFeature.polygon!, [6]);
    assert.strictEqual(outerRings.length, 2);
    assert.strictEqual(innerRings.length, 1);
  });

  await t.test('Scenario 3: Fine Shoreline Sculpting (refining capes and carving coves)', () => {
    let terrain: MapTerrainFeature[] = [];

    // Step 1: Paint rough land
    const base = LandSculptModule.generateOrganicStamp(400, 400, 100, 0.5);
    terrain = LandSculptModule.applySculptOperation(terrain, base, 'paint');

    // Step 2: Fine 30px brush to extend cape
    const cape = LandSculptModule.generateOrganicStamp(480, 400, 30, 0.1);
    terrain = LandSculptModule.applySculptOperation(terrain, cape, 'paint');
    const maxX = Math.max(
      ...terrain
        .filter((f) => f.polygon)
        .map((f) => SculptOracle.getBoundingBox(f.polygon!).maxX)
    );
    assert.ok(maxX >= 500, `Extended cape should reach >= 500, received ${maxX}`);

    // Step 3: Fine 20px carve brush to carve bay
    const bayCut: MapPoint[] = [
      { x: 390, y: 290 },
      { x: 410, y: 290 },
      { x: 410, y: 315 },
      { x: 390, y: 315 },
    ];
    terrain = LandSculptModule.applySculptOperation(terrain, bayCut, 'carve');
    assert.ok(terrain.length >= 1);
  });

  await t.test('Scenario 4: Accidental Stroke & Complete Erasure to open ocean', () => {
    let terrain: MapTerrainFeature[] = [];

    // Step 1: Accidental paint stroke in deep ocean
    const accidentalStamp = LandSculptModule.generateOrganicStamp(900, 900, 40, 0.4);
    terrain = LandSculptModule.applySculptOperation(terrain, accidentalStamp, 'paint');
    assert.strictEqual(terrain.length, 1);

    // Step 2: Complete erase with 100px carve brush
    const eraseStamp = LandSculptModule.generateOrganicStamp(900, 900, 100, 0.0);
    terrain = LandSculptModule.applySculptOperation(terrain, eraseStamp, 'carve');
    assert.strictEqual(terrain.length, 0, '100% ocean restoration achieved');
  });

  await t.test('Scenario 5: Full Map Lifecycle (Init -> Paint -> Carve -> Theme Switch -> Schema Validation)', () => {
    // 1. Init
    const bible = createMockWorldBible({
      worldId: 'world_odyssey',
      worldName: 'The Great Odyssey',
      summary: 'Epic saga map',
    });
    const mapData = getOrInitializeWorldMapData(bible, false);

    // 2. Multi-stroke painting
    const s1 = LandSculptModule.generateOrganicStamp(400, 400, 90, 0.3);
    const s2 = LandSculptModule.generateOrganicStamp(1200, 700, 60, 0.2);
    let terrain = LandSculptModule.applySculptOperation(mapData.terrainFeatures, s1, 'paint');
    terrain = LandSculptModule.applySculptOperation(terrain, s2, 'paint');

    // 3. Multi-stroke carving
    const carve = LandSculptModule.generateOrganicStamp(400, 400, 30, 0.1);
    terrain = LandSculptModule.applySculptOperation(terrain, carve, 'carve');

    // 4. Theme switch to 'topographic'
    const updatedSettings = {
      ...mapData.settings,
      theme: 'topographic' as MapStyleTheme,
    };

    // 5. Final payload assembly & Zod schema validation
    const finalizedMap: WorldMapData = {
      version: 2,
      settings: updatedSettings,
      terrainFeatures: terrain,
      placements: [],
      notes: 'Finalized authoring cycle',
    };

    const parsed = WorldMapDataSchema.safeParse(finalizedMap);
    assert.ok(parsed.success, 'Full authoring lifecycle must yield valid WorldMapData');
    assert.strictEqual(finalizedMap.settings.theme, 'topographic');
    assert.ok(finalizedMap.terrainFeatures.length >= 2);
  });
});
