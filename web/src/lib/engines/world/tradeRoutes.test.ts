import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarketGoodsForLocation,
  getRouteAvailability,
  getRoutesForLocation,
  formatTradeRouteLine,
} from './tradeRoutes';
import { WorldTradeRouteSchema, WorldBibleSchema } from '@/lib/types/world';
import type { WorldBible, WorldTradeRoute, WorldCreature, WorldLocation } from '@/lib/types/world';

function makeWb(partial: Partial<WorldBible>): WorldBible {
  return {
    worldName: 'Test World',
    summary: '',
    themeNotes: '',
    factions: [],
    locations: [],
    npcs: [],
    artifacts: [],
    bestiary: [],
    religions: [],
    timeline: [],
    laws: [],
    ...partial,
  } as unknown as WorldBible;
}

const IRON = {
  id: 'cre_iron',
  name: 'Azure-Iron Ore',
  speciesCategory: 'mineral',
  habitatLocationIds: ['loc_mines'],
} as unknown as WorldCreature;
const SPICE = {
  id: 'cre_spice',
  name: 'Sun Spice',
  speciesCategory: 'flora',
  habitatLocationIds: ['loc_valley'],
} as unknown as WorldCreature;
const LOCS = [
  { id: 'loc_mines', name: 'Northern Mines' },
  { id: 'loc_capital', name: 'Sunstone Capital' },
  { id: 'loc_pass', name: 'High Pass' },
] as unknown as WorldLocation[];

const baseRoute: WorldTradeRoute = {
  id: 'route_1',
  name: 'The Frost-Peak Highway',
  description: '',
  originLocationId: 'loc_mines',
  destinationLocationId: 'loc_capital',
  intermediateLocationIds: ['loc_pass'],
  commodities: [{ entityId: 'cre_iron', name: 'Azure-Iron Ore', flowDirection: 'forward' }],
  dangerLevel: 3,
  status: 'active',
};

describe('Plan 10 — WorldTradeRoute schema validation', () => {
  it('applies defaults for status, dangerLevel, commodities and waypoints', () => {
    const parsed = WorldTradeRouteSchema.parse({
      id: 'route_x',
      name: 'Salt Road',
      originLocationId: 'a',
      destinationLocationId: 'b',
    });
    assert.equal(parsed.status, 'active');
    assert.equal(parsed.dangerLevel, 2);
    assert.deepEqual(parsed.commodities, []);
    assert.deepEqual(parsed.intermediateLocationIds, []);
  });

  it('rejects an invalid status and out-of-range dangerLevel', () => {
    assert.throws(() =>
      WorldTradeRouteSchema.parse({
        id: 'r',
        name: 'x',
        originLocationId: 'a',
        destinationLocationId: 'b',
        status: 'teleporting',
      })
    );
    assert.throws(() =>
      WorldTradeRouteSchema.parse({
        id: 'r',
        name: 'x',
        originLocationId: 'a',
        destinationLocationId: 'b',
        dangerLevel: 9,
      })
    );
  });

  it('rejects smuggling DC outside 8..25 and empty names', () => {
    assert.throws(() =>
      WorldTradeRouteSchema.parse({
        id: 'r',
        name: 'x',
        originLocationId: 'a',
        destinationLocationId: 'b',
        smugglingRiskDC: 3,
      })
    );
    assert.throws(() =>
      WorldTradeRouteSchema.parse({
        id: 'r',
        name: '',
        originLocationId: 'a',
        destinationLocationId: 'b',
      })
    );
  });

  it('round-trips through the WorldBible schema (tradeRoutes default [])', () => {
    const wb = WorldBibleSchema.parse({
      worldId: 'world_test',
      worldName: 'Test World',
      summary: '',
      themeNotes: '',
    });
    assert.deepEqual(wb.tradeRoutes, []);
  });
});

describe('Plan 10 — market availability resolution', () => {
  it('resolves native goods at the extraction habitat', () => {
    const wb = makeWb({ bestiary: [IRON] });
    const goods = getMarketGoodsForLocation('loc_mines', wb);
    const iron = goods.find((g) => g.entityId === 'cre_iron');
    assert.ok(iron);
    assert.equal(iron.provenance, 'native');
  });

  it('resolves imported goods at the destination of an active route', () => {
    const wb = makeWb({ bestiary: [IRON], tradeRoutes: [baseRoute] });
    const goods = getMarketGoodsForLocation('loc_capital', wb);
    const iron = goods.find((g) => g.entityId === 'cre_iron');
    assert.ok(iron);
    assert.equal(iron.provenance, 'imported');
    assert.equal(iron.routeId, 'route_1');
  });

  it('marks goods scarce when the route is raided', () => {
    const wb = makeWb({
      bestiary: [IRON],
      tradeRoutes: [{ ...baseRoute, status: 'raided', rivalRaidingFactionId: 'fac_bandits' }],
    });
    const iron = getMarketGoodsForLocation('loc_capital', wb).find((g) => g.entityId === 'cre_iron');
    assert.ok(iron);
    assert.equal(iron.provenance, 'scarce');
  });

  it('marks goods in shortage when the route is blockaded', () => {
    const wb = makeWb({
      bestiary: [IRON],
      tradeRoutes: [{ ...baseRoute, status: 'blockaded', disruptionReason: 'War' }],
    });
    const iron = getMarketGoodsForLocation('loc_capital', wb).find((g) => g.entityId === 'cre_iron');
    assert.ok(iron);
    assert.equal(iron.provenance, 'shortage');
  });

  it('native presence is never downgraded by a disrupted route', () => {
    const wb = makeWb({
      bestiary: [IRON],
      tradeRoutes: [{ ...baseRoute, status: 'blockaded' }],
    });
    const iron = getMarketGoodsForLocation('loc_mines', wb).find((g) => g.entityId === 'cre_iron');
    assert.ok(iron);
    assert.equal(iron.provenance, 'native');
  });

  it('bilateral commodities also reach the origin market', () => {
    const wb = makeWb({
      bestiary: [SPICE],
      tradeRoutes: [
        {
          ...baseRoute,
          commodities: [{ entityId: 'cre_spice', name: 'Sun Spice', flowDirection: 'bilateral' }],
        },
      ],
    });
    const spice = getMarketGoodsForLocation('loc_mines', wb).find((g) => g.entityId === 'cre_spice');
    assert.ok(spice);
    assert.equal(spice.provenance, 'imported');
  });

  it('forward-only commodities do NOT flow back to the origin market', () => {
    const wb = makeWb({
      bestiary: [SPICE],
      tradeRoutes: [
        {
          ...baseRoute,
          commodities: [{ entityId: 'cre_spice', name: 'Sun Spice', flowDirection: 'forward' }],
        },
      ],
    });
    const spice = getMarketGoodsForLocation('loc_mines', wb).find((g) => g.entityId === 'cre_spice');
    assert.equal(spice, undefined);
  });

  it('getRouteAvailability returns null when no route ever carries the good there', () => {
    const wb = makeWb({ bestiary: [IRON], tradeRoutes: [baseRoute] });
    assert.equal(getRouteAvailability('cre_iron', 'loc_valley', wb), null);
    assert.ok(getRouteAvailability('cre_iron', 'loc_capital', wb));
  });
});

describe('Plan 10 — narrative context & route helpers', () => {
  it('formatTradeRouteLine includes name, status, path and commodities', () => {
    const wb = makeWb({ locations: LOCS, tradeRoutes: [baseRoute] });
    const line = formatTradeRouteLine(baseRoute, wb);
    assert.match(line, /Frost-Peak Highway/);
    assert.match(line, /DANGER/i);
    assert.match(line, /Northern Mines/);
    assert.match(line, /High Pass/);
    assert.match(line, /Sunstone Capital/);
    assert.match(line, /Azure-Iron Ore/);
  });

  it('formatTradeRouteLine appends economic impact for disrupted routes', () => {
    const blockaded: WorldTradeRoute = { ...baseRoute, status: 'blockaded' };
    const wb = makeWb({ tradeRoutes: [blockaded] });
    const line = formatTradeRouteLine(blockaded, wb);
    assert.match(line, /Shortage/i);
  });

  it('getRoutesForLocation matches origin, destination and waypoints', () => {
    const wb = makeWb({ tradeRoutes: [baseRoute] });
    assert.equal(getRoutesForLocation('loc_mines', wb).length, 1);
    assert.equal(getRoutesForLocation('loc_capital', wb).length, 1);
    assert.equal(getRoutesForLocation('loc_pass', wb).length, 1);
    assert.equal(getRoutesForLocation('loc_nowhere', wb).length, 0);
  });
});