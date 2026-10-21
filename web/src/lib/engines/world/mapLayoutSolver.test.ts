import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MapPoint, WorldLocation, WorldMapData, WorldTradeRoute } from '@/lib/types/world';
import {
  buildMapMasks,
  extractDirectionalConstraints,
  isWaterPoint,
  matchesLegacyAnchorSignature,
  solveMapLayout,
  stableSeedFromString,
  createRng,
  SOLVER_DEFAULTS,
} from './mapLayoutSolver';

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------

function loc(
  id: string,
  name: string,
  overrides: Partial<WorldLocation> = {}
): WorldLocation {
  return {
    id,
    name,
    description: '',
    region: 'Test Region',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: '',
    ...overrides,
  };
}

interface FixtureWorld {
  locations: WorldLocation[];
  tradeRoutes: WorldTradeRoute[];
  mapData?: WorldMapData;
}

/** Chain A—B—C—D with D unreachable; one island E connected to nothing. */
function makeFixtureWorld(): FixtureWorld {
  const locations = [
    loc('city_a', 'A', { connectedLocationIds: ['city_b'], coordinates: { x: 200, y: 800 }, coordinatesSource: 'manual' }),
    loc('city_b', 'B', { connectedLocationIds: ['city_a', 'city_c'], coordinatesSource: 'legacy_auto' }),
    loc('city_c', 'C', { connectedLocationIds: ['city_b', 'keep_d'] }),
    loc('keep_d', 'D', { connectedLocationIds: ['city_c'] }),
    loc('isle_e', 'E', { category: 'settlement' }),
    // A child of city_b — must orbit, never enter the global layout.
    loc('child_of_b', 'B Undercellar', { parentLocationId: 'city_b', category: 'dungeon' }),
  ];
  const tradeRoutes = [
    {
      id: 'route_1',
      name: 'Spice Road',
      originLocationId: 'city_a',
      destinationLocationId: 'city_c',
      intermediateLocationIds: ['city_b'],
    },
  ];
  return { locations, tradeRoutes };
}

const SEED = stableSeedFromString('fixture-world-19');

// ---------------------------------------------------------------------------
// Determinism + seeds.
// ---------------------------------------------------------------------------

describe('mapLayoutSolver', () => {
  it('rng is deterministic and stable-seed hashing matches across runs', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(12345);
    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];
    assert.deepEqual(seq1, seq2);
    assert.equal(stableSeedFromString('abc'), stableSeedFromString('abc'));
    assert.notEqual(stableSeedFromString('abc'), stableSeedFromString('abd'));
  });

  it('same seed produces byte-identical placements across two runs', () => {
    const world = makeFixtureWorld();
    const runA = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const runB = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    assert.equal(runA.placements.length, runB.placements.length);
    for (let i = 0; i < runA.placements.length; i += 1) {
      assert.equal(runA.placements[i].locationId, runB.placements[i].locationId);
      assert.equal(runA.placements[i].position.x, runB.placements[i].position.x);
      assert.equal(runA.placements[i].position.y, runB.placements[i].position.y);
    }
    assert.deepEqual(runA.diffs, runB.diffs);
  });

  it('a different seed at minimum produces no out-of-bounds placements', () => {
    const world = makeFixtureWorld();
    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED + 1 });
    const inset = SOLVER_DEFAULTS.CANVAS_INSET;
    for (const p of run.placements) {
      assert.ok(p.position.x >= inset && p.position.x <= 2400 - inset, `x out of bounds for ${p.locationId}`);
      assert.ok(p.position.y >= inset && p.position.y <= 1600 - inset, `y out of bounds for ${p.locationId}`);
    }
  });

  // -----------------------------------------------------------------------
  // Mode semantics.
  // -----------------------------------------------------------------------

  it('manual pins are never moved (legacy and full modes)', () => {
    const world = makeFixtureWorld();
    for (const mode of ['legacy', 'full'] as const) {
      const run = solveMapLayout({ ...world, mode, seed: SEED });
      const cityA = run.diffs.find((d) => d.locationId === 'city_a');
      assert.ok(cityA === undefined, `city_a must not appear in diffs (${mode})`);
      const anchorCount = run.anchorCount;
      assert.ok(anchorCount >= 1, `manual anchor counted (${mode})`);
    }
  });

  it('legacy mode refits only legacy remnants + unplaced, preserving unknown coordinates', () => {
    const world = makeFixtureWorld();
    // Add an unclassified pin that legacy mode must keep as an anchor.
    world.locations.push(
      loc('keep_x', 'Keep X', { coordinates: { x: 1200, y: 900 }, connectedLocationIds: ['city_c'] })
    );
    const run = solveMapLayout({ ...world, mode: 'legacy', seed: SEED });
    const ids = run.diffs.map((d) => d.locationId);
    assert.ok(!ids.includes('city_a'), 'manual preserved');
    assert.ok(!ids.includes('keep_x'), 'unknown provenance preserved in legacy mode');
    assert.ok(ids.includes('city_b'), 'legacy_auto remnant refit');
    assert.ok(ids.includes('keep_d'), 'unplaced placed');
    assert.ok(ids.includes('child_of_b'), 'auto child orbits');
    const anchors = run.diffs.find((d) => d.locationId === 'city_b');
    assert.ok(anchors); // refit produced a result
  });

  it('full mode re-solves every non-manual pin including unknown provenance', () => {
    const world = makeFixtureWorld();
    world.locations.push(
      loc('keep_x', 'Keep X', { coordinates: { x: 1200, y: 900 }, connectedLocationIds: ['city_c'] })
    );
    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const ids = run.diffs.map((d) => d.locationId);
    assert.ok(ids.includes('keep_x'));
    assert.ok(!ids.includes('city_a'));
  });

  // -----------------------------------------------------------------------
  // Layout invariants.
  // -----------------------------------------------------------------------

  it('placements honor the minimum separation (non-child pins)', () => {
    const world = makeFixtureWorld();
    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const top = run.placements.filter((p) => !p.tags.includes('child_orbit'));
    for (let i = 0; i < top.length; i += 1) {
      for (let j = i + 1; j < top.length; j += 1) {
        const dx = top[i].position.x - top[j].position.x;
        const dy = top[i].position.y - top[j].position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        assert.ok(
          d >= SOLVER_DEFAULTS.MIN_SEPARATION,
          `pins ${top[i].locationId}/${top[j].locationId} overlap at ${Math.round(d)}px`
        );
      }
    }
  });

  it('connected pins end up closer on average than unconnected pins', () => {
    const world = makeFixtureWorld();
    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const pos = new Map(run.placements.filter((p) => !p.tags.includes('child_orbit')).map((p) => [p.locationId, p.position]));
    // Manual city_a keeps its authored coordinate; mixed with solver pins.
    if (!pos.has('city_a')) pos.set('city_a', { x: 200, y: 800 });
    const conn: number[] = [];
    const unconn: number[] = [];
    const ids = [...pos.keys()];
    const cmp = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const connPairs = new Set([
      cmp('city_a', 'city_b'),
      cmp('city_b', 'city_c'),
      cmp('city_c', 'keep_d'),
    ]);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (connPairs.has(cmp(ids[i], ids[j]))) conn.push(d);
        else unconn.push(d);
      }
    }
    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / Math.max(arr.length, 1);
    assert.ok(
      mean(conn) < mean(unconn),
      `connected mean ${Math.round(mean(conn))} should be below unconnected mean ${Math.round(mean(unconn))}`
    );
  });

  it('children orbit their parent inside the containment envelope', () => {
    const world = makeFixtureWorld();
    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const bPos = run.placements.find((p) => p.locationId === 'city_b')?.position ?? { x: 200, y: 800 };
    const child = run.diffs.find((d) => d.locationId === 'child_of_b');
    assert.ok(child, 'auto child repositioned');
    const d = Math.hypot(child.after.x - bPos.x, child.after.y - bPos.y);
    assert.ok(d >= SOLVER_DEFAULTS.CHILD_MIN_GAP, 'child outside the parent pin envelope');
    assert.ok(d <= 200, `child within orbit reach (d=${Math.round(d)})`);
  });

  it('manual child pins are preserved outright', () => {
    const world = makeFixtureWorld();
    world.locations = world.locations.map((l) =>
      l.id === 'child_of_b'
        ? { ...l, coordinates: { x: 705, y: 415 }, coordinatesSource: 'manual' as const }
        : l
    );
    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    assert.ok(!run.diffs.some((d) => d.locationId === 'child_of_b'));
  });

  // -----------------------------------------------------------------------
  // Water masks.
  // -----------------------------------------------------------------------

  it('pins avoid water and land on dry polygons when masks exist', () => {    const world = makeFixtureWorld();
    const mapData: WorldMapData = {
      version: 1,
      settings: { width: 2400, height: 1600, theme: 'parchment', gridType: 'none', gridSize: 40, showGridCoordinates: false, visibleLayers: {} },
      terrainFeatures: [
        {
          id: 't_land',
          name: 'Main Continent',
          type: 'continent',
          polygon: [
            { x: 40, y: 40 },
            { x: 2360, y: 40 },
            { x: 2360, y: 1100 },
            { x: 40, y: 1100 },
          ],
        },
        {
          id: 't_sea',
          name: 'Southern Sea',
          type: 'sea',
          polygon: [
            { x: 0, y: 1100 },
            { x: 2400, y: 1100 },
            { x: 2400, y: 1600 },
            { x: 0, y: 1600 },
          ],
        },
      ],
    } as unknown as WorldMapData;
    const masks = buildMapMasks(mapData);
    assert.equal(masks.landPolygons.length, 1);
    assert.equal(masks.waterPolygons.length, 1);
    assert.equal(isWaterPoint(masks, { x: 1200, y: 600 }), false, 'continent center is land');
    assert.equal(isWaterPoint(masks, { x: 1200, y: 1400 }), true, 'sea is water');
    assert.equal(isWaterPoint(masks, { x: 1200, y: 1200 }), true, 'outside landmass is water');

    const run = solveMapLayout({ ...world, mapData, mode: 'full', seed: SEED });
    for (const p of run.placements) {
      if (p.tags.includes('child_orbit')) continue; // children never entered global layout
      assert.ok(
        p.position.y <= 1100,
        `${p.locationId} landed on water/sea at y=${p.position.y}`
      );
    }
  });

  it('keeps a family together: a hub is laid out globally, its leaves orbit it', () => {
    const world = makeFixtureWorld();
    // A region (a hub) with two leaves of its own, and a leaf under the hub.
    world.locations = [
      ...world.locations,
      loc('region_x', 'Region X', { parentLocationId: 'city_a' }),
      loc('town_x1', 'Town X1', { parentLocationId: 'region_x' }),
      loc('town_x2', 'Town X2', { parentLocationId: 'region_x' }),
    ];

    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const pos = new Map(run.placements.map((p) => [p.locationId, p.position]));

    // The hub owns places → it is laid out globally (it gets its own pin).
    assert.ok(pos.has('region_x'), 'a hub is placed by the global layout');
    // Its leaves orbit it.
    for (const leaf of ['town_x1', 'town_x2']) {
      assert.ok(pos.has(leaf), `${leaf} is placed`);
      const hub = pos.get('region_x')!;
      const p = pos.get(leaf)!;
      const d = Math.hypot(p.x - hub.x, p.y - hub.y);
      assert.ok(d <= 320, `${leaf} orbits its region (d=${Math.round(d)})`);
      assert.ok(d >= 56, `${leaf} does not sit on its region's pin`);
    }
  });

  it('separates the pins: no two of them end up closer than the minimum spacing', () => {
    const world = makeFixtureWorld();
    // A crowded family: many leaves under one hub.
    const crowd = Array.from({ length: 12 }, (_, i) =>
      loc(`crowd_${i}`, `Crowd ${i}`, { parentLocationId: 'city_b' })
    );
    world.locations = [...world.locations, ...crowd];

    const run = solveMapLayout({ ...world, mode: 'full', seed: SEED });
    const pos = run.placements.map((p) => p.position);
    let worst = Infinity;
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        worst = Math.min(worst, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
      }
    }
    assert.ok(worst >= 50, `closest pair is ${Math.round(worst)}px apart`);
  });

  it('keeps a coastal parent far enough inland for its children to stay on land', () => {
    const world = makeFixtureWorld();
    // A coastal hub whose children would otherwise orbit into the sea.
    world.locations = [
      ...world.locations,
      loc('port_p', 'Port', { parentLocationId: 'city_a' }),
      loc('dock_1', 'Dock 1', { parentLocationId: 'port_p' }),
      loc('dock_2', 'Dock 2', { parentLocationId: 'port_p' }),
    ];
    const mapData: WorldMapData = {
      version: 1,
      settings: { width: 2400, height: 1600, theme: 'parchment', gridType: 'none', gridSize: 40, showGridCoordinates: false, visibleLayers: {} },
      terrainFeatures: [
        {
          id: 't_land',
          name: 'Main Continent',
          type: 'continent',
          polygon: [
            { x: 40, y: 40 },
            { x: 1200, y: 40 },
            { x: 1200, y: 1100 },
            { x: 40, y: 1100 },
          ],
        },
      ],
    } as unknown as WorldMapData;
    const masks = buildMapMasks(mapData);

    const run = solveMapLayout({ ...world, mapData, mode: 'full', seed: SEED });
    const pos = new Map(run.placements.map((p) => [p.locationId, p.position]));
    for (const id of ['port_p', 'dock_1', 'dock_2']) {
      const p = pos.get(id);
      assert.ok(p, `${id} placed`);
      assert.equal(isWaterPoint(masks, p!), false, `${id} must not rest on water`);
    }
  });

  it('sea/ocean-style regions modeled as locations land inside water polygons', () => {
    const world = makeFixtureWorld();
    // Common pattern: the sea itself is a traversal node in the travel graph
    // ("دریای باختر"). Such a pin must sit ON the painted water, not on land.
    world.locations = world.locations.map((l) =>
      l.id === 'isle_e'
        ? loc('southern_sea', 'دریای باختر', { connectedLocationIds: ['keep_d'] })
        : l
    );
    const mapData: WorldMapData = {
      version: 1,
      settings: { width: 2400, height: 1600, theme: 'parchment', gridType: 'none', gridSize: 40, showGridCoordinates: false, visibleLayers: {} },
      terrainFeatures: [
        {
          id: 't_land',
          name: 'Main Continent',
          type: 'continent',
          polygon: [
            { x: 40, y: 40 },
            { x: 2360, y: 40 },
            { x: 2360, y: 1100 },
            { x: 40, y: 1100 },
          ],
        },
        {
          id: 't_sea',
          name: 'Bakhtar Sea',
          type: 'sea',
          polygon: [
            { x: 0, y: 1100 },
            { x: 2400, y: 1100 },
            { x: 2400, y: 1600 },
            { x: 0, y: 1600 },
          ],
        },
      ],
    } as unknown as WorldMapData;
    const run = solveMapLayout({ ...world, mapData, mode: 'full', seed: SEED });
    const sea = run.diffs.find((d) => d.locationId === 'southern_sea');
    assert.ok(sea, 'sea region refit');
    const masks = buildMapMasks(mapData);
    assert.equal(isWaterPoint(masks, sea.after), true, 'sea pin rests on painted water');
    // …while the land pins stay off the water.
    for (const p of run.placements) {
      if (p.locationId === 'southern_sea' || p.tags.includes('child_orbit')) continue;
      assert.equal(isWaterPoint(masks, p.position), false, `${p.locationId} stays on land`);
    }
  });

  // -----------------------------------------------------------------------
  // Legacy signature detection.
  // -----------------------------------------------------------------------

  it('legacy anchor signature matches historical auto allocations only', () => {
    assert.equal(matchesLegacyAnchorSignature({ x: 1185, y: 715 }), true, 'k=0 remnant (anchor -35/-25)');
    assert.equal(matchesLegacyAnchorSignature({ x: 1255, y: 765 }), true, 'k=1 offset');
    assert.equal(matchesLegacyAnchorSignature({ x: 1325, y: 815 }), true, 'k=2 offset');
    assert.equal(matchesLegacyAnchorSignature({ x: 1220, y: 740 }), false, 'the raw anchor itself is not an allocation');
    assert.equal(matchesLegacyAnchorSignature({ x: 1255, y: 715 }), false, 'k must be shared by x and y');
    assert.equal(matchesLegacyAnchorSignature({ x: 1220 + 70, y: 740 }), false, 'pure x drift rejected');
    assert.equal(matchesLegacyAnchorSignature({ x: 933, y: 511 }), false, 'arbitrary coordinates rejected');
  });
});

// ---------------------------------------------------------------------------
// Directional constraint extraction.
// ---------------------------------------------------------------------------

describe('extractDirectionalConstraints', () => {
  it('extracts FA "A north of B" from A lore (quoted ezafe form)', () => {
    const locations = [
      loc('keep_d', 'دژ سران', {
        description: 'دژ سران در شمالِ «پایتخت» و بر فراز كوهستان قرار دارد.',
      }),
      loc('city_a', 'پایتخت'),
    ];
    const constraints = extractDirectionalConstraints(locations);
    assert.ok(constraints.length >= 1);
    const north = constraints[0];
    assert.equal(north.sourceId, 'keep_d');
    assert.equal(north.targetId, 'city_a');
    assert.equal(north.axis, 'y');
    assert.equal(north.sign, -1, 'north requires source above target');
  });

  it('extracts EN "east of the capital" with axis x sign +1', () => {
    const locations = [
      loc('port_s', 'Port Satin', { description: 'A smuggler haven east of the Capital.' }),
      loc('city_capital', 'Capital'),
    ];
    const constraints = extractDirectionalConstraints(locations);
    assert.ok(constraints.length >= 1);
    const east = constraints[0];
    assert.equal(east.sourceId, 'port_s');
    assert.equal(east.targetId, 'city_capital');
    assert.equal(east.axis, 'x');
    assert.equal(east.sign, 1);
  });

  it('compounds like northeast match as a single x-axis clamp (no double-count)', () => {
    const locations = [
      loc('shrine_n', 'Shrine N', { description: 'Built northeast of the Apex Tower.' }),
      loc('apex_t', 'Apex Tower'),
    ];
    const constraints = extractDirectionalConstraints(locations);
    const axes = constraints.filter((c) => c.sourceId === 'shrine_n').map((c) => c.axis).sort();
    assert.deepEqual(axes, ['x'], 'northeast wins over its north/east prefixes at the scan index');
  });

  it('ignores directions whose window has no resolvable location name', () => {
    const locations = [
      loc('solo_1', 'Solo', { description: 'Far north across the dunes of time.' }),
    ];
    assert.equal(extractDirectionalConstraints(locations).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Solve-request edge cases.
// ---------------------------------------------------------------------------

describe('solveMapLayout edge cases', () => {
  it('empty locations produce an empty, non-throwing result', () => {
    const run = solveMapLayout({ locations: [], mode: 'full', seed: SEED });
    assert.equal(run.placements.length, 0);
    assert.equal(run.diffs.length, 0);
  });

  it('a single unplaced node gets a finite in-bounds position', () => {
    const run = solveMapLayout({
      locations: [loc('lonely', 'Lonely')],
      mode: 'full',
      seed: SEED,
    });
    const firstDiffs = run.diffs;
    assert.equal(firstDiffs.length, 1);
    assert.ok(Number.isFinite(firstDiffs[0].after.x) && Number.isFinite(firstDiffs[0].after.y));
  });

  it('legacy mode with nothing to do reports zero movement and no placements', () => {
    const run = solveMapLayout({
      locations: [loc('only', 'Only', { coordinates: { x: 500, y: 500 }, coordinatesSource: 'manual' })],
      mode: 'legacy',
      seed: SEED,
    });
    assert.equal(run.placements.length, 0);
    assert.equal(run.diffs.length, 0);
    assert.equal(run.anchorCount, 1);
  });

  it('invalid/NaN legacy coordinates are treated as unplaced, never crash', () => {
    const bogus = { x: Number.NaN, y: Number.NaN } as unknown as MapPoint;
    const run = solveMapLayout({
      locations: [loc('bad', 'Bad Coords', { coordinates: bogus })],
      mode: 'full',
      seed: SEED,
    });
    assert.equal(run.diffs.length, 1);
    assert.ok(Number.isFinite(run.diffs[0].after.x));
    assert.ok(Number.isFinite(run.diffs[0].after.y));
  });
});
