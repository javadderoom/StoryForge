import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  CustomPlaceCategory,
  MapTerrainFeature,
  WorldLocation,
} from '@/lib/types/world';
import {
  findTerrainCandidatesForPlace,
  placeAcceptsTerrainType,
} from './terrainPlacePairing';

function place(over: Partial<WorldLocation> = {}): WorldLocation {
  return {
    id: 'loc_ashen_river',
    name: 'Ashen River',
    description: '',
    region: 'The Reach',
    category: 'waterway',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: '',
    ...over,
  } as WorldLocation;
}

function terrain(over: Partial<MapTerrainFeature> = {}): MapTerrainFeature {
  return {
    id: 'terr_1',
    name: 'River',
    type: 'river',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    ...over,
  } as MapTerrainFeature;
}

describe('terrainPlacePairing — compatible candidates', () => {
  it('offers river and lake drawings for a waterway place', () => {
    const candidates = findTerrainCandidatesForPlace(place(), [
      terrain({ id: 'terr_river', name: 'Ashen River', type: 'river' }),
      terrain({ id: 'terr_lake', name: 'Ashen Mere', type: 'lake', polygon: [] }),
      terrain({ id: 'terr_forest', name: 'Ashen Wood', type: 'forest', polygon: [] }),
    ]);

    assert.deepEqual(
      candidates.map((candidate) => candidate.feature.id),
      ['terr_river', 'terr_lake']
    );
    assert.equal(candidates[0].nameMatch, 'exact');
  });

  it('excludes drawings that already belong to another place', () => {
    const candidates = findTerrainCandidatesForPlace(place(), [
      terrain({ id: 'terr_linked', locationId: 'loc_other' }),
      terrain({ id: 'terr_free' }),
    ]);

    assert.deepEqual(
      candidates.map((candidate) => candidate.feature.id),
      ['terr_free']
    );
  });

  it('prefers the category terrain order when names and distance tie', () => {
    const candidates = findTerrainCandidatesForPlace(place({ name: 'Long Water' }), [
      terrain({ id: 'terr_lake', name: 'Still Water', type: 'lake', polygon: [] }),
      terrain({ id: 'terr_river', name: 'Running Water', type: 'river' }),
    ]);

    assert.deepEqual(
      candidates.map((candidate) => candidate.feature.id),
      ['terr_river', 'terr_lake']
    );
  });

  it('uses the place pin to rank nearby drawings', () => {
    const candidates = findTerrainCandidatesForPlace(
      place({ name: 'Long Water', coordinates: { x: 0, y: 0 } }),
      [
        terrain({ id: 'terr_far', name: 'Far Run', points: [{ x: 900, y: 0 }] }),
        terrain({ id: 'terr_near', name: 'Near Run', points: [{ x: 50, y: 0 }] }),
      ]
    );

    assert.deepEqual(
      candidates.map((candidate) => candidate.feature.id),
      ['terr_near', 'terr_far']
    );
    assert.ok(candidates[0].distance !== null);
    assert.ok(candidates[0].distance! < candidates[1].distance!);
  });

  it('honours custom category terrain types', () => {
    const categories: CustomPlaceCategory[] = [
      {
        id: 'ash_river',
        name: 'Ash River',
        description: '',
        color: '#38BDF8',
        renderAs: 'line',
        geometryKind: 'line',
        mapTerrainTypes: ['river'],
      },
    ];

    const candidates = findTerrainCandidatesForPlace(
      place({ category: 'ash_river' }),
      [
        terrain({ id: 'terr_river' }),
        terrain({ id: 'terr_lake', type: 'lake', polygon: [] }),
      ],
      categories
    );

    assert.deepEqual(
      candidates.map((candidate) => candidate.feature.id),
      ['terr_river']
    );
  });

  it('does not offer drawings for point places', () => {
    const candidates = findTerrainCandidatesForPlace(
      place({ category: 'settlement' }),
      [terrain()]
    );

    assert.deepEqual(candidates, []);
    assert.equal(placeAcceptsTerrainType({ category: 'settlement' }, 'river'), false);
  });

  it('reports compatibility without depending on a location instance', () => {
    assert.equal(placeAcceptsTerrainType({ category: 'waterway' }, 'river'), true);
    assert.equal(placeAcceptsTerrainType({ category: 'waterway' }, 'mountain_range'), false);
  });
});