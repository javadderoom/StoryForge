import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEnvironmentalContext } from './environmentalContext';
import { WorldBible, MapTerrainFeature, WorldLocation } from '@/lib/types/world';

test('environmentalContext - resolves desert within continent and identifies nearest settlement', () => {
  const continent: MapTerrainFeature = {
    id: 'feat_cont_1',
    name: 'Faravand Continent',
    type: 'continent',
    polygon: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    elevation: 200,
  };

  const desert: MapTerrainFeature = {
    id: 'feat_desert_1',
    name: 'Hiram Steppe',
    type: 'desert',
    polygon: [
      { x: 400, y: 400 },
      { x: 800, y: 400 },
      { x: 800, y: 800 },
      { x: 400, y: 800 },
    ],
    elevation: 450,
    description: 'A vast expanse of treacherous crimson dunes and howling sandstorms.',
  };

  const city: WorldLocation = {
    id: 'loc_zarrin',
    name: 'Zarrin-Pol',
    description: 'The gilded bridge city.',
    region: 'Faravand',
    dangerLevel: 1,
    connectedLocationIds: [],
    atmosphere: 'Bustling bazaar',
    coordinates: { x: 500, y: 400 },
  };

  const mockBible = {
    worldId: 'test_world',
    worldName: 'Faravand',
    summary: 'A desert fantasy world',
    themeNotes: 'Rich sand dunes',
    laws: [],
    factions: [],
    locations: [city],
    timeline: [],
    npcs: [],
    mapData: {
      version: 1,
      settings: {
        width: 2000,
        height: 2000,
        theme: 'vintage',
        gridType: 'none',
        gridSize: 50,
        showGridCoordinates: false,
        kmPerSpatialUnit: 0.5,
      },
      terrainFeatures: [continent, desert],
      placements: [],
    },
  } as unknown as WorldBible;

  // Point inside desert: (500, 500)
  // Distance from city (500, 400) is 100px. At 0.5km/unit, that's 50km.
  // Direction from city to point: dx = 0, dy = +100 -> South!
  const ctx = extractEnvironmentalContext({ x: 500, y: 500 }, mockBible);

  assert.equal(ctx.biome, 'desert');
  assert.equal(ctx.featureName, 'Hiram Steppe');
  assert.equal(ctx.elevation, 450);
  assert.equal(ctx.isWater, false);
  assert.equal(ctx.nearestSettlement?.name, 'Zarrin-Pol');
  assert.equal(ctx.nearestSettlement?.distanceKm, 50);
  assert.equal(ctx.nearestSettlement?.cardinalDirection, 'South');
  assert.match(ctx.badgeText, /Hiram Steppe/);
  assert.match(ctx.badgeText, /50km South of Zarrin-Pol/);
  assert.match(ctx.promptContext, /Crimson dunes/i);
});

test('environmentalContext - handles point in open ocean or outside terrain polygons', () => {
  const mockBible = {
    worldId: 'test_world',
    worldName: 'Faravand',
    summary: 'A desert fantasy world',
    themeNotes: 'Rich sand dunes',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
    mapData: {
      version: 1,
      settings: {
        width: 2000,
        height: 2000,
        theme: 'vintage',
        gridType: 'none',
        gridSize: 50,
        showGridCoordinates: false,
      },
      terrainFeatures: [],
      placements: [],
    },
  } as unknown as WorldBible;

  const ctx = extractEnvironmentalContext({ x: 100, y: 100 }, mockBible);
  assert.equal(ctx.biome, 'plains');
  assert.equal(ctx.elevation, 150);
  assert.equal(ctx.isWater, false);
  assert.equal(ctx.nearestSettlement, null);
  assert.match(ctx.promptContext, /Plains/i);
});

test('environmentalContext - detects river proximity when near polyline river', () => {
  const river: MapTerrainFeature = {
    id: 'feat_river_1',
    name: 'Zarrin River',
    type: 'river',
    points: [
      { x: 100, y: 100 },
      { x: 100, y: 500 },
    ],
    elevation: 50,
  };

  const mockBible = {
    worldId: 'test_world',
    worldName: 'Faravand',
    summary: 'A desert fantasy world',
    themeNotes: 'Rich sand dunes',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
    mapData: {
      version: 1,
      settings: {
        width: 2000,
        height: 2000,
        theme: 'vintage',
        gridType: 'none',
        gridSize: 50,
        showGridCoordinates: false,
        kmPerSpatialUnit: 1.0,
      },
      terrainFeatures: [river],
      placements: [],
    },
  } as unknown as WorldBible;

  // Point 10px from river line (x=100) -> at x=110, y=250
  const ctx = extractEnvironmentalContext({ x: 110, y: 250 }, mockBible);
  assert.equal(ctx.biome, 'river');
  assert.equal(ctx.featureName, 'Zarrin River');
  assert.equal(ctx.isWater, true);
});

test('environmentalContext - resolves linkedLocation and overrides featureName and promptContext', () => {
  const desert: MapTerrainFeature = {
    id: 'feat_desert_hiram',
    name: 'Old Terrain Name',
    type: 'desert',
    polygon: [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 0, y: 500 },
    ],
    elevation: 320,
    locationId: 'loc_hiram_plains',
  };

  const hiramLocation = {
    id: 'loc_hiram_plains',
    name: 'Hiram Plains',
    description: 'An ancient expanse of amber sand and howling winds.',
    category: 'wilderness',
  };

  const settlementLocation = {
    id: 'loc_oasis_outpost',
    name: 'Oasis Outpost',
    category: 'settlement',
    coordinates: { x: 600, y: 250 },
  };

  const mockBible = {
    worldId: 'test_world',
    worldName: 'Faravand',
    summary: 'A desert fantasy world',
    themeNotes: 'Rich sand dunes',
    laws: [],
    factions: [],
    locations: [hiramLocation, settlementLocation],
    timeline: [],
    npcs: [],
    mapData: {
      version: 1,
      settings: {
        width: 2000,
        height: 2000,
        theme: 'vintage',
        gridType: 'none',
        gridSize: 50,
        showGridCoordinates: false,
        kmPerSpatialUnit: 1.0,
      },
      terrainFeatures: [desert],
      placements: [],
    },
  } as unknown as WorldBible;

  const ctx = extractEnvironmentalContext({ x: 250, y: 250 }, mockBible);
  assert.equal(ctx.biome, 'desert');
  assert.equal(ctx.featureName, 'Hiram Plains');
  assert.equal(ctx.linkedLocation?.id, 'loc_hiram_plains');
  assert.match(ctx.badgeText, /Hiram Plains/);
  assert.match(ctx.promptContext, /Canonical Territory \/ World Location: "Hiram Plains"/);
  assert.match(ctx.promptContext, /An ancient expanse of amber sand/);
  assert.equal(ctx.nearestSettlement?.id, 'loc_oasis_outpost');
});
