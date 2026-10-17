import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorldContextBlocks,
  createContextTelemetry,
  pruneWorldBibleToScope,
} from './worldContext';
import { WorldBible } from '../../types/world';

const locIds = { cave: 'loc_cave_desert', oasis: 'loc_oasis', swamp: 'loc_swamp' };

function bible(): WorldBible {
  return {
    worldId: 'w1',
    worldName: 'Test Realm',
    summary: '',
    themeNotes: '',
    laws: [],
    factions: [
      {
        id: 'fac_border',
        name: 'Border Wardens',
        alignment: 'lawful',
        publicGoals: 'Keep the roads safe',
        territoryIds: [locIds.oasis],
        memberNpcIds: [],
        secretAgendas: '',
      },
      {
        id: 'fac_distant',
        name: 'Distant Thronedom',
        alignment: 'neutral',
        publicGoals: 'Rule far away',
        territoryIds: ['loc_far_away'],
        memberNpcIds: [],
      },
    ],
    locations: [
      {
        id: locIds.cave,
        name: 'Desert Cave',
        description: 'A dry cave',
        region: 'Hiram',
        dangerLevel: 2,
        connectedLocationIds: [locIds.oasis],
        atmosphere: 'dry',
      },
      {
        id: locIds.oasis,
        name: 'Oasis',
        description: 'Water',
        region: 'Hiram',
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: 'wet',
      },
      {
        id: locIds.swamp,
        name: 'Marsh Hollow',
        description: 'Wet',
        region: 'Yazd',
        dangerLevel: 3,
        connectedLocationIds: [],
        atmosphere: 'damp',
      },
    ],
    npcs: [
      {
        id: 'npc_resident',
        name: 'Resident Guide',
        role: 'guide',
        goals: [],
        currentLocationId: locIds.cave,
        applicableLocationIds: undefined,
      },
      {
        id: 'npc_far',
        name: 'Far Merchant',
        role: 'merchant',
        goals: [],
        currentLocationId: locIds.swamp,
      },
    ],
    timeline: [],
    artifacts: [],
    bestiary: [
      {
        id: 'cre_camel',
        name: 'Dune Camel',
        speciesCategory: 'beast',
        dangerLevel: 1,
        behavioralTactics: '',
        weaknesses: [],
        harvestableLoot: [],
        habitatLocationIds: [locIds.cave],
      },
      {
        id: 'cre_marsh_viper',
        name: 'Marsh Viper',
        speciesCategory: 'beast',
        dangerLevel: 3,
        behavioralTactics: '',
        weaknesses: [],
        harvestableLoot: [],
        habitatLocationIds: [locIds.swamp],
      },
      {
        id: 'cre_roamer',
        name: 'Wandering Roamer',
        speciesCategory: 'beast',
        dangerLevel: 1,
        behavioralTactics: '',
        weaknesses: [],
        harvestableLoot: [],
        habitatLocationIds: [],
      },
    ],
    religions: [],
    dramaBonds: [],
    factionRelations: [],
    tradeRoutes: [
      {
        id: 'route_great',
        name: 'Great Caravan Road',
        originLocationId: locIds.oasis,
        destinationLocationId: locIds.swamp,
        commodities: [],
        caravanMasterNpcId: 'npc_master',
        travelingNpcIds: ['npc_retinue'],
        dangerLevel: 2,
        status: 'active',
      },
    ],
    ontology: undefined,
  } as unknown as WorldBible;
}

describe('Plan 15 Phase 4 — context envelope telemetry', () => {
  it('records bestiary exclusions with an explicit habitat reason (Marsh Viper out of a desert cave)', () => {
    const telemetry = createContextTelemetry();
    pruneWorldBibleToScope(bible(), {
      scopeTier: 'street',
      locationIds: [locIds.cave],
      npcIds: ['npc_resident'],
      telemetry,
    });
    const viper = telemetry.excluded.find((r) => r.kind === 'bestiary' && r.id === 'cre_marsh_viper');
    assert.ok(viper, 'Marsh Viper should be excluded');
    assert.match(viper.reason!, /habitat outside the scene/);
    assert.match(viper.reason!, /Marsh Hollow/);

    const camel = telemetry.included.find((r) => r.kind === 'bestiary' && r.id === 'cre_camel');
    assert.ok(camel, 'Dune Camel should be included');
    const roamer = telemetry.included.find((r) => r.kind === 'bestiary' && r.id === 'cre_roamer');
    assert.ok(roamer, 'empty-habitat fauna stays eligible');
  });

  it('records NPC exclusions for characters based elsewhere with no scene party', () => {
    const telemetry = createContextTelemetry();
    pruneWorldBibleToScope(bible(), {
      scopeTier: 'street',
      locationIds: [locIds.cave],
      npcIds: ['npc_resident'],
      telemetry,
    });
    const far = telemetry.excluded.find((r) => r.kind === 'npc' && r.id === 'npc_far');
    assert.ok(far);
    assert.match(far.reason!, /based elsewhere/);
  });

  it('records retinue names withheld from trade-route lines (Plan 15 Bug 2 visibility)', () => {
    const telemetry = createContextTelemetry();
    buildWorldContextBlocks(
      { worldBible: bible(), storyNpcOverrides: {} },
      {
        scopeTier: 'street',
        locationIds: [locIds.cave],
        npcIds: ['npc_resident'],
        telemetry,
      }
    );
    const retinue = telemetry.excluded.filter(
      (r) => r.kind === 'npc' && /retinue of caravan/.test(r.reason!)
    );
    const ids = new Set(retinue.map((r) => r.id));
    assert.ok(ids.has('npc_master') && ids.has('npc_retinue'), 'master + retinue withheld');
    assert.match(retinue[0].reason!, /not physically at the scene/);
  });

  it('stays byte-identical without a telemetry collector (zero-overhead contract)', () => {
    const story = { worldBible: bible(), storyNpcOverrides: {} };
    const options = { scopeTier: 'street' as const, locationIds: [locIds.cave], npcIds: ['npc_resident'] };
    const withTelemetry = createContextTelemetry();
    const a = JSON.stringify(pruneWorldBibleToScope(story.worldBible!, options));
    const b = JSON.stringify(
      pruneWorldBibleToScope(story.worldBible!, { ...options, telemetry: withTelemetry })
    );
    assert.equal(a, b);
    assert.equal(
      JSON.stringify(buildWorldContextBlocks(story, options)),
      JSON.stringify(buildWorldContextBlocks(story, { ...options, telemetry: withTelemetry }))
    );
  });

  it('records token-cap truncations in scoped (non-Studio) mode only', () => {
    const wb = bible();
    // 12 scene-relevant NPCs at street tier (cap 4): pinned resident + 11 residents.
    (wb.npcs as unknown as Array<{ id: string }>).push(
      ...Array.from({ length: 11 }, (_, i) => ({
        id: `npc_extra_${i}`,
        name: `Extra ${i}`,
        role: 'guard',
        goals: [],
        currentLocationId: locIds.cave,
      }))
    );
    const telemetry = createContextTelemetry();
    const story = { worldBible: wb, storyNpcOverrides: {} };
    const options = { scopeTier: 'street' as const, locationIds: [locIds.cave], npcIds: ['npc_resident'] };
    buildWorldContextBlocks(story, { ...options, telemetry });
    const truncation = telemetry.truncated.find((t) => t.kind === 'npc');
    assert.ok(truncation, 'npc truncation recorded');
    assert.equal(truncation.withheld, 8); // 12 scene NPCs − 4 injected
    assert.equal(
      telemetry.excluded.filter((r) => r.kind === 'npc' && /token cap/.test(r.reason!)).length,
      8
    );
  });
});

