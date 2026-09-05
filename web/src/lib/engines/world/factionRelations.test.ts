import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Faction, FactionRelation } from '@/lib/types/world';
import {
  mergeFactionRelations,
  normalizeRelationValue,
  resolveTargetFactionId,
  syncLegacyFactionLinks,
} from './factionRelations';

describe('factionRelations — normalization, target resolution & merging', () => {
  const dummyFactions: Faction[] = [
    {
      id: 'fac_vanguard',
      name: 'Iron Vanguard',
      description: 'Armored legion',
      alignment: 'Lawful Martial',
      territoryIds: [],
      rivalFactionIds: [],
      alliedFactionIds: [],
      publicGoals: 'Order',
    },
    {
      id: 'fac_silver',
      name: 'Silver Dawn',
      description: 'Holy paladins',
      alignment: 'Good Radiant',
      territoryIds: [],
      rivalFactionIds: [],
      alliedFactionIds: [],
      publicGoals: 'Light',
    },
    {
      id: 'fac_cabal',
      name: 'Shadow Cabal',
      description: 'Underground spies',
      alignment: 'Chaotic Stealth',
      territoryIds: [],
      rivalFactionIds: [],
      alliedFactionIds: [],
      publicGoals: 'Power',
    },
  ];

  it('normalizes relation spectrum values correctly', () => {
    assert.equal(normalizeRelationValue('allied'), 'allied');
    assert.equal(normalizeRelationValue('ally'), 'allied');
    assert.equal(normalizeRelationValue('allies'), 'allied');
    assert.equal(normalizeRelationValue('favorable'), 'favorable');
    assert.equal(normalizeRelationValue('friendly'), 'favorable');
    assert.equal(normalizeRelationValue('neutral'), 'neutral');
    assert.equal(normalizeRelationValue('rival'), 'rival');
    assert.equal(normalizeRelationValue('competitor'), 'rival');
    assert.equal(normalizeRelationValue('hostile'), 'hostile');
    assert.equal(normalizeRelationValue('enemy'), 'hostile');
    assert.equal(normalizeRelationValue('war'), 'hostile');
    assert.equal(normalizeRelationValue('unknown_nonsense'), 'neutral');
  });

  it('resolves target factions by ID, exact name, loose name, and substring', () => {
    assert.equal(resolveTargetFactionId('fac_silver', 'fac_vanguard', dummyFactions), 'fac_silver');
    assert.equal(resolveTargetFactionId('Silver Dawn', 'fac_vanguard', dummyFactions), 'fac_silver');
    assert.equal(resolveTargetFactionId('silver dawn', 'fac_vanguard', dummyFactions), 'fac_silver');
    assert.equal(resolveTargetFactionId('Shadow', 'fac_vanguard', dummyFactions), 'fac_cabal');
    // Ignores self
    assert.equal(resolveTargetFactionId('Iron Vanguard', 'fac_vanguard', dummyFactions), null);
    assert.equal(resolveTargetFactionId('fac_vanguard', 'fac_vanguard', dummyFactions), null);
    // Unknown returns null
    assert.equal(resolveTargetFactionId('Martian Empire', 'fac_vanguard', dummyFactions), null);
  });

  it('merges AI array relations into factionRelations', () => {
    const existing: FactionRelation[] = [
      {
        id: 'frel_1',
        sourceFactionId: 'fac_vanguard',
        targetFactionId: 'fac_silver',
        value: 'neutral',
        note: 'Old truce',
      },
    ];

    const updated = {
      relations: [
        {
          targetFactionId: 'fac_silver',
          value: 'hostile',
          note: 'Border skirmishes erupted',
        },
        {
          targetFactionName: 'Shadow Cabal',
          value: 'favorable',
          note: 'Clandestine trade agreement',
        },
      ],
    };

    const merged = mergeFactionRelations('fac_vanguard', updated, dummyFactions, existing);
    assert.equal(merged.length, 2);

    const silverRel = merged.find(
      (r) =>
        (r.sourceFactionId === 'fac_vanguard' && r.targetFactionId === 'fac_silver') ||
        (r.sourceFactionId === 'fac_silver' && r.targetFactionId === 'fac_vanguard')
    );
    assert.ok(silverRel);
    assert.equal(silverRel.value, 'hostile');
    assert.equal(silverRel.note, 'Border skirmishes erupted');

    const cabalRel = merged.find(
      (r) =>
        (r.sourceFactionId === 'fac_vanguard' && r.targetFactionId === 'fac_cabal') ||
        (r.sourceFactionId === 'fac_cabal' && r.targetFactionId === 'fac_vanguard')
    );
    assert.ok(cabalRel);
    assert.equal(cabalRel.value, 'favorable');
    assert.equal(cabalRel.note, 'Clandestine trade agreement');
  });

  it('merges dictionary/map relations from forms', () => {
    const updated = {
      relations: {
        fac_silver: { value: 'allied', note: 'Holy alliance' },
      },
    };

    const merged = mergeFactionRelations('fac_vanguard', updated, dummyFactions, []);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].value, 'allied');
    assert.equal(merged[0].note, 'Holy alliance');
  });

  it('falls back to alliedFactionIds / rivalFactionIds when explicit relations not given', () => {
    const updated = {
      alliedFactionIds: ['Silver Dawn'],
      rivalFactionIds: ['fac_cabal'],
    };

    const merged = mergeFactionRelations('fac_vanguard', updated, dummyFactions, []);
    assert.equal(merged.length, 2);

    const ally = merged.find((r) => r.targetFactionId === 'fac_silver' || r.sourceFactionId === 'fac_silver');
    assert.ok(ally);
    assert.equal(ally.value, 'allied');

    const rival = merged.find((r) => r.targetFactionId === 'fac_cabal' || r.sourceFactionId === 'fac_cabal');
    assert.ok(rival);
    assert.equal(rival.value, 'rival');
  });

  it('syncs legacy faction links reciprocally across factions', () => {
    const relations: FactionRelation[] = [
      {
        id: 'r1',
        sourceFactionId: 'fac_vanguard',
        targetFactionId: 'fac_silver',
        value: 'allied',
      },
      {
        id: 'r2',
        sourceFactionId: 'fac_vanguard',
        targetFactionId: 'fac_cabal',
        value: 'hostile',
      },
    ];

    const synced = syncLegacyFactionLinks(dummyFactions, relations);
    const vanguard = synced.find((f) => f.id === 'fac_vanguard')!;
    const silver = synced.find((f) => f.id === 'fac_silver')!;
    const cabal = synced.find((f) => f.id === 'fac_cabal')!;

    assert.deepEqual(vanguard.alliedFactionIds, ['fac_silver']);
    assert.deepEqual(vanguard.rivalFactionIds, ['fac_cabal']);

    assert.deepEqual(silver.alliedFactionIds, ['fac_vanguard']);
    assert.deepEqual(silver.rivalFactionIds, []);

    assert.deepEqual(cabal.alliedFactionIds, []);
    assert.deepEqual(cabal.rivalFactionIds, ['fac_vanguard']);
  });
});
