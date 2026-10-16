import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assembleSceneEnvelope, SceneTurnInput } from './narrativeTurn';
import { WorldBible } from '@/lib/types/world';
import { PlayerState } from '@/lib/types/gameplay';

describe('Plan 15 Bug 3 — Party Roster Isolation in assembleSceneEnvelope', () => {
  const worldBible: WorldBible = {
    worldId: 'world_party_test',
    worldName: 'Party Test Realm',
    summary: '',
    themeNotes: '',
    laws: [],
    factions: [],
    locations: [
      {
        id: 'loc_camp',
        name: 'Caravan Camp',
        region: 'Desert',
        description: 'Tents around a blazing fire.',
        atmosphere: 'Dust and heat around the fire',
        dangerLevel: 1,
        connectedLocationIds: ['loc_ravine'],
      },
      {
        id: 'loc_ravine',
        name: 'Silent Ravine',
        region: 'Desert',
        description: 'Shadowy secluded rocks.',
        atmosphere: 'Echoing wind in the rocks',
        dangerLevel: 3,
        connectedLocationIds: ['loc_camp'],
      },
    ],
    timeline: [],
    npcs: [
      {
        id: 'npc_borzou',
        name: 'Borzou Sangtarash',
        title: 'Caravan Master',
        role: 'companion',
        currentLocationId: 'loc_camp',
        personalityTraits: [],
        speechStyle: 'Gruff',
        goals: [],
        secrets: [],
        initialTrust: 10,
      },
      {
        id: 'npc_sohrab',
        name: 'Sohrab Choob-Dast',
        title: 'Caravan Guard',
        role: 'companion',
        currentLocationId: 'loc_camp',
        personalityTraits: [],
        speechStyle: 'Quiet',
        goals: [],
        secrets: [],
        initialTrust: 5,
      },
    ],
    tradeRoutes: [],
    bestiary: [],
  };

  const baseStory = {
    title: 'Test Journey',
    language: 'en',
    worldBible,
    storyScale: 'local',
  };

  const basePlayerState: PlayerState = {
    characterName: 'Barzin',
    archetypeName: 'Scout',
    currentLocationId: 'loc_camp',
    stats: { might: 12, wits: 14 },
    resources: { hp: 30, stamina: 20 },
    inventory: [],
    equipment: {},
    conditions: [],
    relationships: {},
    discoveredLocationIds: ['loc_camp'],
    activeQuestIds: [],
    completedQuestIds: [],
  };

  const baseResolution: any = {
    outcome: 'success',
    diceRoll: 15,
    finalScore: 18,
    appliedModifiers: [],
    consequence: 'You move silently.',
  };

  const baseLedger: any = {
    factionReputations: [],
    npcStatuses: [
      { npcId: 'npc_borzou', status: 'companion' },
      { npcId: 'npc_sohrab', status: 'companion' },
    ],
    keyItems: [],
    chapterSummaries: [],
    openPlotThreads: [],
  };

  it('keeps left-behind companions as nearby_resident when scouting alone (accompanyingNpcIds = [])', () => {
    // Player went alone; turn 1 prose mentioned Borzou by the campfire
    const input: SceneTurnInput = {
      story: baseStory,
      playerState: {
        ...basePlayerState,
        accompanyingNpcIds: [], // Alone!
      },
      resolution: baseResolution,
      playerActionText: 'I slip into the dark rocks by myself.',
      ledger: baseLedger,
      sessionTurns: [
        {
          turnNumber: 1,
          narrativeProse: 'By the fire, Borzou Sangtarash gestured to the pack camels.',
          playerActionText: 'Talk to Borzou',
        },
      ],
    };

    const envelope = assembleSceneEnvelope(input);
    const borzouDossier = envelope.activeNpcDossiers.find((d) => d.name === 'Borzou Sangtarash');
    assert.ok(borzouDossier, 'Borzou should be in location dossiers');
    assert.equal(
      borzouDossier.presenceStatus,
      'nearby_resident',
      'Left-behind companion Borzou must NOT be marked present in immediate scene'
    );
  });

  it('marks companion as present if explicitly in accompanyingNpcIds', () => {
    // Player brought Sohrab along
    const input: SceneTurnInput = {
      story: baseStory,
      playerState: {
        ...basePlayerState,
        accompanyingNpcIds: ['npc_sohrab'],
      },
      resolution: baseResolution,
      playerActionText: 'I lead the way through the ravine.',
      ledger: baseLedger,
      sessionTurns: [
        {
          turnNumber: 1,
          narrativeProse: 'Sohrab Choob-Dast tightened his grip on his bow.',
          playerActionText: 'Signal Sohrab',
        },
      ],
    };

    const envelope = assembleSceneEnvelope(input);
    const sohrabDossier = envelope.activeNpcDossiers.find((d) => d.name === 'Sohrab Choob-Dast');
    assert.ok(sohrabDossier);
    assert.equal(
      sohrabDossier.presenceStatus,
      'present',
      'Accompanying companion Sohrab must be marked present in immediate scene'
    );

    // Borzou is not accompanying and stays nearby_resident
    const borzouDossier = envelope.activeNpcDossiers.find((d) => d.name === 'Borzou Sangtarash');
    assert.ok(borzouDossier);
    assert.equal(borzouDossier.presenceStatus, 'nearby_resident');
  });

  it('marks left-behind companion as present if directly targeted by the action text', () => {
    const input: SceneTurnInput = {
      story: baseStory,
      playerState: {
        ...basePlayerState,
        accompanyingNpcIds: [], // Alone
      },
      resolution: baseResolution,
      playerActionText: 'I shout back toward Borzou Sangtarash at the fire.',
      ledger: baseLedger,
      sessionTurns: [],
    };

    const envelope = assembleSceneEnvelope(input);
    const borzouDossier = envelope.activeNpcDossiers.find((d) => d.name === 'Borzou Sangtarash');
    assert.ok(borzouDossier);
    assert.equal(
      borzouDossier.presenceStatus,
      'present',
      'Directly targeted companion becomes present to address the action'
    );
  });
});
