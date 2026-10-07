import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSeedTerrainFeatures,
  getOrInitializeWorldMapData,
  ensureLocationCoordinates,
  calculateMapDistance,
  calculateCaravanTravelDays,
  pointsToSmoothSvgPath,
  polygonToSvgPath,
  generateDefaultCaravanWaypoints,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_MAP_SETTINGS,
} from './cartographerEngine';
import {
  WorldBible,
  WorldLocation,
  WorldMapDataSchema,
  MapTerrainFeature,
  MapPoint,
} from '@/lib/types';

test('Cartographer Engine - Seed Terrain Generation', async (t) => {
  await t.test('generates full natural terrain seed (continents, mountains, rivers, biomes, valleys)', () => {
    const seed = createSeedTerrainFeatures(true);
    assert.ok(seed.length >= 8, 'Expected at least 8 natural terrain features');

    const continent = seed.find((f) => f.type === 'continent');
    assert.ok(continent, 'Should include at least one major continental landmass');
    assert.ok(continent.polygon && continent.polygon.length >= 5, 'Continent should have polygon vertices');

    const mountain = seed.find((f) => f.type === 'mountain_range');
    assert.ok(mountain, 'Should include mountain spine');
    assert.ok(mountain.points && mountain.points.length >= 3, 'Mountain should have ridge points');

    const river = seed.find((f) => f.type === 'river');
    assert.ok(river, 'Should include winding river');

    const valley = seed.find((f) => f.type === 'canyon' || f.type === 'valley');
    assert.ok(valley, 'Should include deep valley / canyon gorge');

    const biome = seed.find((f) => f.type === 'forest' || f.type === 'desert');
    assert.ok(biome, 'Should include planetary biome regions');
  });

  await t.test('bilingual names for Persian vs English seeds', () => {
    const seedFa = createSeedTerrainFeatures(true);
    const seedEn = createSeedTerrainFeatures(false);

    assert.ok(seedFa[0].name.includes('قاره'), 'Persian seed should have Persian name');
    assert.ok(seedEn[0].name.includes('Continent'), 'English seed should have English name');
  });
});

test('Cartographer Engine - Map Initialization & Defaults', async (t) => {
  await t.test('initializes default map data when worldBible.mapData is empty', () => {
    const mockWb: WorldBible = {
      worldId: 'world_test_1',
      worldName: 'Afsaneh Realm',
      summary: 'A testing world',
      themeNotes: 'Epic',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [],
    };

    const mapData = getOrInitializeWorldMapData(mockWb, false);
    assert.equal(mapData.version, 1);
    assert.equal(mapData.settings.width, CANVAS_WIDTH);
    assert.equal(mapData.settings.height, CANVAS_HEIGHT);
    assert.equal(mapData.settings.theme, 'parchment');
    assert.ok(mapData.terrainFeatures.length > 0, 'Terrain features should be populated');
  });

  await t.test('preserves existing mapData and overrides settings cleanly', () => {
    const customTerrain: MapTerrainFeature[] = [
      {
        id: 'terr_custom_1',
        name: 'Custom Isle',
        type: 'island',
        polygon: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }],
      },
    ];

    const mockWb: WorldBible = {
      worldId: 'world_test_2',
      worldName: 'Custom World',
      summary: 'Custom',
      themeNotes: '',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [],
      mapData: {
        version: 2,
        settings: {
          ...DEFAULT_MAP_SETTINGS,
          theme: 'dark_fantasy',
        },
        terrainFeatures: customTerrain,
        placements: [],
      },
    };

    const mapData = getOrInitializeWorldMapData(mockWb, false);
    assert.equal(mapData.version, 2);
    assert.equal(mapData.settings.theme, 'dark_fantasy');
    assert.equal(mapData.terrainFeatures.length, 1);
    assert.equal(mapData.terrainFeatures[0].id, 'terr_custom_1');
  });
});

test('Cartographer Engine - Location Spatial Placement', async (t) => {
  await t.test('assigns valid coordinates and elevation to unplaced locations', () => {
    const unplacedLocs: WorldLocation[] = [
      {
        id: 'loc_citadel',
        name: 'The Citadel',
        description: 'Imperial stronghold',
        region: 'North',
        dangerLevel: 3,
        connectedLocationIds: [],
        atmosphere: 'Cold',
        category: 'stronghold',
      },
      {
        id: 'loc_port',
        name: 'Azure Port',
        description: 'Harbor',
        region: 'South',
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: 'Breezy',
        category: 'settlement',
      },
    ];

    const resolved = ensureLocationCoordinates(unplacedLocs, new Map());
    assert.equal(resolved.length, 2);
    assert.ok(resolved[0].coordinates && resolved[0].coordinates.x > 0);
    assert.ok(resolved[0].coordinates.y > 0);
    assert.ok(resolved[1].coordinates && resolved[1].coordinates.x > 0);
    assert.ok(resolved[0].coordinates.x !== resolved[1].coordinates.x, 'Locations should have distinct coordinates');
    assert.equal(resolved[0].elevation, 1200, 'Stronghold should have mountain/elevation');
  });

  await t.test('preserves already assigned coordinates', () => {
    const placedLocs: WorldLocation[] = [
      {
        id: 'loc_fixed',
        name: 'Fixed Shrine',
        description: '',
        region: '',
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: '',
        coordinates: { x: 777, y: 888 },
      },
    ];

    const resolved = ensureLocationCoordinates(placedLocs, new Map());
    assert.equal(resolved[0].coordinates?.x, 777);
    assert.equal(resolved[0].coordinates?.y, 888);
  });
});

test('Cartographer Engine - Distance & Caravan Math', async (t) => {
  await t.test('calculates Euclidean distance accurately', () => {
    const p1: MapPoint = { x: 100, y: 100 };
    const p2: MapPoint = { x: 400, y: 500 };
    const dist = calculateMapDistance(p1, p2);
    // dx = 300, dy = 400, hypotenuse = 500
    assert.equal(dist, 500);
  });

  await t.test('calculates caravan travel days with danger friction', () => {
    const dist = 450;
    const safeDays = calculateCaravanTravelDays(dist, 1);
    const perilousDays = calculateCaravanTravelDays(dist, 5);

    assert.ok(safeDays >= 10, 'Base safe travel should take ~10 days');
    assert.ok(perilousDays > safeDays, 'Perilous routes should take longer due to hazards/detours');
  });

  await t.test('generates natural intermediate waypoints bending around terrain', () => {
    const start: MapPoint = { x: 200, y: 400 };
    const end: MapPoint = { x: 800, y: 400 };
    const waypoints = generateDefaultCaravanWaypoints(start, end, 2);

    assert.equal(waypoints.length, 2);
    assert.ok(waypoints[0].x > 200 && waypoints[0].x < 800);
    assert.ok(waypoints[1].x > waypoints[0].x && waypoints[1].x < 800);
    assert.notEqual(waypoints[0].y, 400, 'Should have subtle perpendicular deflection curve');
  });
});

test('Cartographer Engine - SVG Path Geometry', async (t) => {
  await t.test('generates smooth Catmull-Rom cubic bezier SVG path commands', () => {
    const points: MapPoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 250 },
      { x: 350, y: 220 },
      { x: 500, y: 400 },
    ];
    const path = pointsToSmoothSvgPath(points);

    assert.ok(path.startsWith('M 100 100'), 'Should start with move to origin');
    assert.ok(path.includes('C'), 'Should include cubic bezier curve segment commands');
  });

  await t.test('generates closed polygon SVG paths', () => {
    const points: MapPoint[] = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 200, y: 300 },
    ];
    const polygonPath = polygonToSvgPath(points);

    assert.ok(polygonPath.endsWith('Z'), 'Closed polygon should end with Z');
  });
});

test('Cartographer Schema - Runtime Validation', async (t) => {
  await t.test('validates full WorldMapData payload with Zod', () => {
    const payload = {
      version: 1,
      settings: {
        width: 2400,
        height: 1600,
        theme: 'topographic',
        gridType: 'hex',
        gridSize: 50,
        showGridCoordinates: true,
        visibleLayers: {
          terrain: true,
          water: true,
          mountains: true,
          valleys: true,
          biomes: true,
          settlements: true,
          caravanRoutes: true,
          npcs: true,
          bestiary: true,
          relics: true,
          deities: true,
          timeline: true,
          factionBorders: true,
          labels: true,
          grid: true,
        },
      },
      terrainFeatures: [
        {
          id: 'feat_1',
          name: 'Mount Damavand',
          type: 'peak',
          elevation: 5610,
        },
      ],
      placements: [
        {
          id: 'pin_1',
          entityId: 'npc_rostam',
          entityType: 'npc',
          x: 450,
          y: 620,
        },
      ],
    };

    const parsed = WorldMapDataSchema.parse(payload);
    assert.equal(parsed.settings.theme, 'topographic');
    assert.equal(parsed.terrainFeatures[0].name, 'Mount Damavand');
    assert.equal(parsed.placements[0].entityType, 'npc');
  });
});
