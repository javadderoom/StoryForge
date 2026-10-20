import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MapPoint, WorldBible, WorldLocation, WorldMapData } from '@/lib/types/world';
import { LEGACY_AUTO_ANCHORS } from '@/lib/engines/world/cartographerEngine';
import {
  auditWorldMapLayout,
  classifyCoordinates,
} from './mapLayoutAuditor';
import { matchesLegacyAnchorSignature } from './mapLayoutSolver';

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

describe('classifyCoordinates', () => {
  it('trusts stored provenance stamps before any signature detection', () => {
    assert.equal(
      classifyCoordinates({ coordinates: { x: 1220, y: 740 }, coordinatesSource: 'manual' }),
      'manual',
      'a manually dragged pin ON an anchor is still manual'
    );
    assert.equal(
      classifyCoordinates({ coordinates: { x: 3, y: 3 }, coordinatesSource: 'solver' }),
      'solver'
    );
    // The allocator never sits ON an anchor — it emits anchor + (k*70-35, k*50-25).
    assert.equal(classifyCoordinates({ coordinates: { x: 1220, y: 740 } }), 'unknown');
    assert.equal(classifyCoordinates({ coordinates: { x: 1185, y: 715 } }), 'legacy_auto');
    assert.equal(classifyCoordinates({ coordinates: { x: 933, y: 511 } }), 'unknown');
    assert.equal(classifyCoordinates({}), 'unplaced');
  });

  it('legacy anchor signature bridge stays in sync with the cartographer engine', () => {
    // Every canonical anchor's FIRST allocation ring position must be detected.
    for (const anchor of LEGACY_AUTO_ANCHORS) {
      assert.equal(
        matchesLegacyAnchorSignature({ x: anchor.x - 35, y: anchor.y - 25 }, LEGACY_AUTO_ANCHORS),
        true,
        `k=0 remnant of anchor ${anchor.x},${anchor.y} must classify as legacy`
      );
    }
  });

  it('matches the historical orbital-offset pattern (k ≥ 0, shared k)', () => {
    const base = LEGACY_AUTO_ANCHORS[0];
    for (const k of [0, 1, 2, 5]) {
      assert.equal(
        matchesLegacyAnchorSignature({ x: base.x + k * 70 - 35, y: base.y + k * 50 - 25 }),
        true,
        `k=${k} offset must be legacy`
      );
    }
    assert.equal(
      matchesLegacyAnchorSignature({ x: base.x + 35, y: base.y - 75 }), // kx=1, ky=-1
      false
    );
  });
});

describe('auditWorldMapLayout', () => {
  it('flags legacy remnants and unplaced locations with actionable issues', () => {
    const wb = {
      locations: [
        loc('pinned', 'Pinned', { coordinates: { x: 500, y: 500 }, coordinatesSource: 'manual' as const }),
        loc('remnant', 'Remnant', { coordinates: { x: 685, y: 355 } }), // anchor-2 k=0 remnant
        loc('ghost', 'Ghost'), // unplaced
      ],
      tradeRoutes: [],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const report = auditWorldMapLayout(wb);
    assert.equal(report.counts.manual, 1);
    assert.equal(report.counts.legacy_auto, 1);
    assert.equal(report.counts.unplaced, 1);
    assert.equal(report.legacyDetected, true);
    const codes = report.issues.map((i) => i.code);
    assert.ok(codes.includes('legacy_coordinates'));
    assert.ok(codes.includes('unplaced_locations'));
    // Both issue kinds carry FA + EN text.
    for (const code of ['legacy_coordinates', 'unplaced_locations']) {
      const issue = report.issues.find((i) => i.code === code)!;
      assert.ok(issue.fa.length > 0);
      assert.ok(issue.en.length > 0);
    }
  });

  it('marks a legacy remnant map as topology-uninformative', () => {
    const wb = {
      locations: [
        loc('a', 'A', { connectedLocationIds: ['b'], region: 'R1' }),
        loc('b', 'B', { connectedLocationIds: ['a'], region: 'R1' }),
        loc('c', 'C', { connectedLocationIds: [], region: 'R2' }),
        loc('d', 'D', { connectedLocationIds: [], region: 'R2' }),
      ],
      tradeRoutes: [],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const report = auditWorldMapLayout(wb);
    assert.equal(report.topologySeparation.computable, false, 'no coordinates at all');
    assert.equal(report.legacyDetected, true);
  });

  it('computes topology separation and overlapping-pin issues on a placed map', () => {
    const wb = {
      locations: [
        loc('a', 'A', { coordinates: { x: 100, y: 100 }, connectedLocationIds: ['b'], coordinatesSource: 'manual' as const }),
        loc('b', 'B', { coordinates: { x: 300, y: 100 }, connectedLocationIds: ['a'], coordinatesSource: 'manual' as const }),
        loc('c', 'C', { coordinates: { x: 2200, y: 1400 }, coordinatesSource: 'manual' as const }),
        loc('d', 'D', { coordinates: { x: 2000, y: 1200 }, coordinatesSource: 'manual' as const }),
        loc('x', 'X', { coordinates: { x: 2240, y: 1440 }, coordinatesSource: 'manual' as const }), // 56px from c exactly
      ],
      tradeRoutes: [],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const report = auditWorldMapLayout(wb);
    assert.equal(report.topologySeparation.computable, true);
    assert.equal(report.topologySeparation.informative, true, 'connected pair 200px, unconnected median large');
    assert.equal(report.minSeparationViolations.length, 0, 'c/x exactly at threshold');
    // Push X one pixel closer → flagged.
    const wbTight = {
      ...wb,
      locations: wb.locations.map((l) =>
        l.id === 'x' ? { ...l, coordinates: { x: 2239, y: 1439 } } : l
      ),
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const tight = auditWorldMapLayout(wbTight);
    assert.equal(tight.minSeparationViolations.length, 1);
    const flagged = tight.minSeparationViolations[0];
    assert.ok([flagged.a, flagged.b].includes('c'));
    assert.ok([flagged.a, flagged.b].includes('x'));
  });

  it('directional satisfaction uses axis projection with the specified thresholds', () => {
    // keep_a claims (implicitly) nothing; we audit claims produced from text.
    const wb = {
      locations: [
        loc('north_thing', 'Thing', {
          description: 'هاست: در شمالِ پایتخت است.',
          coordinates: { x: 600, y: 300 },
          coordinatesSource: 'manual' as const,
        }),
        loc('capital', 'پایتخت', {
          coordinates: { x: 600, y: 700 },
          coordinatesSource: 'manual' as const,
        }),
      ],
      tradeRoutes: [],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const report = auditWorldMapLayout(wb);
    assert.equal(report.directional.unresolvable, 0);
    assert.equal(report.directional.satisfied, 1, 'thing at y=300 sits north of capital y=700');
    assert.equal(report.directional.violated, 0);

    // Mirror it south — the claim flips to violated.
    const wbFlipped = {
      ...wb,
      locations: [wb.locations[0], { ...wb.locations[1], coordinates: { x: 600, y: 100 } }],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const flipped = auditWorldMapLayout(wbFlipped);
    assert.equal(flipped.directional.violated, 1);
    assert.equal(flipped.issues.some((i) => i.code === 'directional_violations'), true);
  });

  it('flags water violations symmetrically: land pins on water AND sea regions on land', () => {
    const mapData = {
      version: 1,
      settings: { width: 2400, height: 1600, theme: 'parchment', gridType: 'none', gridSize: 40, showGridCoordinates: false, visibleLayers: {} },
      terrainFeatures: [
        {
          id: 't_sea',
          name: 'Sea',
          type: 'sea',
          polygon: [
            { x: 0, y: 1200 },
            { x: 2400, y: 1200 },
            { x: 2400, y: 1600 },
            { x: 0, y: 1600 },
          ],
        },
      ],
    } as unknown as WorldMapData;
    const wb = {
      locations: [
        loc('coast_a', 'Coast A', { coordinates: { x: 500, y: 800 }, coordinatesSource: 'manual' as const }),
        loc('drowned', 'Drowned', { coordinates: { x: 500, y: 1400 }, coordinatesSource: 'manual' as const }),
        // The sea itself modeled as a location, but pinned on land — wrong side.
        loc('southern_sea', 'Southern Sea', { coordinates: { x: 900, y: 400 }, coordinatesSource: 'manual' as const }),
      ],
      tradeRoutes: [],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const report = auditWorldMapLayout(wb, mapData);
    assert.deepEqual(
      [...report.waterViolationIds].sort((a, b) => a.localeCompare(b)),
      ['drowned', 'southern_sea']
    );
    assert.ok(report.issues.some((i) => i.code === 'water_violations'));
  });

  it('family of parent/child flung detection', () => {
    const wb = {
      locations: [
        loc('parent', 'Parent', { coordinates: { x: 1000, y: 800 }, coordinatesSource: 'manual' as const }),
        loc('near_child', 'Near Child', { parentLocationId: 'parent', coordinates: { x: 1064, y: 864 }, coordinatesSource: 'manual' as const }),
        loc('far_child', 'Far Child', { parentLocationId: 'parent', coordinates: { x: 2000, y: 300 }, coordinatesSource: 'manual' as const }),
      ],
      tradeRoutes: [],
    } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>;
    const report = auditWorldMapLayout(wb);
    assert.deepEqual(report.parentFlungIds, ['far_child']);
    assert.ok(report.issues.some((i) => i.code === 'parent_flung'));
  });

  it('never throws on degenerate world data (no locations, bogus polygons)', () => {
    const report = auditWorldMapLayout({ locations: [], tradeRoutes: [] });
    assert.equal(report.legacyDetected, false);
    const bogusMapData = {
      version: 1,
      settings: { width: 2400, height: 1600, theme: 'parchment', gridType: 'none', gridSize: 40, showGridCoordinates: false, visibleLayers: {} },
      terrainFeatures: [
        { id: 'bad_poly', name: 'Bad', type: 'sea' as const, polygon: [{ x: Number.NaN, y: 1 }, { x: 2, y: 3 }] },
      ],
    } as unknown as WorldMapData;
    const report2 = auditWorldMapLayout(
      {
        locations: [loc('p', 'P', { coordinates: { x: 100, y: 100 } })],
        tradeRoutes: [],
      } as unknown as Pick<WorldBible, 'locations' | 'tradeRoutes'>,
      bogusMapData
    );
    assert.equal(report2.waterViolationIds.length, 0, 'degenerate polygons are treated as outside');
  });
});
