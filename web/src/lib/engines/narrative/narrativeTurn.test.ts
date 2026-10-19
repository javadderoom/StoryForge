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

  it('carries the Plan 18 failure plan and localization into the writer envelope', () => {
    const input: SceneTurnInput = {
      story: baseStory,
      playerState: basePlayerState,
      resolution: {
        ...baseResolution,
        outcome: 'failure',
        failureMode: 'reveal',
        failureSecondaryMode: 'complication',
        failureActionKind: 'investigative',
        failureDirective: {
          en: 'Expose a new fact, but do not grant the goal.',
          fa: 'حقیقتی تازه را آشکار کن، اما هدف را محقق نکن.',
        },
        stuckAllowed: false,
        previousFailedAttempts: 0,
        stateDiff: { locationChange: 'loc_ravine' },
      },
      playerActionText: 'Search the ravine for tracks.',
      ledger: baseLedger,
      sessionTurns: [],
    };

    const envelope = assembleSceneEnvelope(input);
    assert.equal(envelope.resolvedGameOutcome?.failureMode, 'reveal');
    assert.equal(envelope.resolvedGameOutcome?.failureSecondaryMode, 'complication');
    assert.equal(
      envelope.resolvedGameOutcome?.failureDirective,
      'Expose a new fact, but do not grant the goal.'
    );
    assert.equal(envelope.resolvedGameOutcome?.stuckAllowed, false);
    assert.equal(envelope.resolvedGameOutcome?.locationChanged, true);
  });

  it('localizes the failure directive for Persian stories', () => {
    const input: SceneTurnInput = {
      story: { ...baseStory, language: 'fa' },
      playerState: basePlayerState,
      resolution: {
        ...baseResolution,
        outcome: 'failure',
        failureMode: 'escalation',
        failureDirective: {
          en: 'Advance the danger.',
          fa: 'خطر را پیش ببر.',
        },
        stuckAllowed: true,
        stuckReason: 'این روش بسته است.',
        failureRequirementHint: 'مهر برنزی لازم است.',
        stateDiff: {},
      },
      playerActionText: 'جستجوی دره',
      ledger: baseLedger,
      sessionTurns: [],
    };

    const envelope = assembleSceneEnvelope(input);
    assert.equal(envelope.resolvedGameOutcome?.failureDirective, 'خطر را پیش ببر.');
    assert.equal(envelope.resolvedGameOutcome?.stuckAllowed, true);
    assert.equal(envelope.resolvedGameOutcome?.stuckReason, 'این روش بسته است.');
    assert.equal(
      envelope.resolvedGameOutcome?.failureRequirementHint,
      'مهر برنزی لازم است.'
    );
  });
});

// ---------------------------------------------------------------------------
// Plan 17 (§4.5): corridor scoping + journey envelope derivation.
// ---------------------------------------------------------------------------

describe('Plan 17 — journey envelope & corridor scoping', () => {
  const travelWorldBible = {
    worldId: 'world_travel_test',
    worldName: 'Travel Test Realm',
    summary: '',
    themeNotes: '',
    laws: [],
    factions: [
      { id: 'faction_raiders', name: 'Ashfang Raiders', description: '', goals: [], territoryIds: [] },
      { id: 'faction_guard', name: 'Road Wardens', description: '', goals: [], territoryIds: [] },
    ],
    locations: [
      {
        id: 'loc_camp',
        name: 'Caravan Camp',
        region: 'Desert',
        description: 'Tents around a blazing fire.',
        atmosphere: '',
        dangerLevel: 1,
        connectedLocationIds: ['loc_ravine'],
      },
      {
        id: 'loc_ravine',
        name: 'Silent Ravine',
        region: 'Desert',
        description: 'Shadowy secluded rocks.',
        atmosphere: '',
        dangerLevel: 3,
        connectedLocationIds: ['loc_camp', 'loc_harbor'],
      },
      {
        id: 'loc_harbor',
        name: 'Brine Harbor',
        region: 'Coast',
        description: 'Salt-stained docks.',
        atmosphere: '',
        dangerLevel: 2,
        connectedLocationIds: ['loc_mine'],
      },
      {
        id: 'loc_mine',
        name: 'Salt Mine',
        region: 'Badlands',
        description: 'A gaping mine mouth.',
        atmosphere: '',
        dangerLevel: 3,
        connectedLocationIds: [],
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
        currentLocationId: 'loc_harbor',
        personalityTraits: [],
        speechStyle: 'Quiet',
        goals: [],
        secrets: [],
        initialTrust: 5,
      },
    ],
    tradeRoutes: [
      {
        id: 'route_salt',
        name: 'Salt Road',
        originLocationId: 'loc_camp',
        destinationLocationId: 'loc_mine',
        intermediateLocationIds: ['loc_harbor'],
        caravanMasterNpcId: 'npc_borzou',
        travelingNpcIds: ['npc_sohrab'],
        dangerLevel: 3,
        status: 'active',
        rivalRaidingFactionId: 'faction_raiders',
        patrollingFactionId: 'faction_guard',
      },
    ],
    bestiary: [],
  } as unknown as WorldBible;

  const travelStory = {
    title: 'Test Journey',
    language: 'en',
    worldBible: travelWorldBible,
    storyScale: 'local',
    initialStoryBeats: [],
  };

  const baseLedger: any = {
    factionReputations: [],
    npcStatuses: [],
    keyItems: [],
    chapterSummaries: [],
    openPlotThreads: [],
  };

  const baseResolution: any = {
    outcome: 'success',
    diceRoll: 15,
    finalScore: 18,
    appliedModifiers: [],
    consequence: 'The caravan moves.',
  };

  function makeTravelingState(currentLocationId: string): PlayerState {
    return {
      characterName: 'Barzin',
      currentLocationId,
      stats: {},
      resources: { hp: 30, stamina: 20 },
      inventory: [],
      equipment: {},
      conditions: [],
      relationships: {},
      discoveredLocationIds: ['loc_camp', 'loc_harbor'],
      activeQuestIds: [],
      completedQuestIds: [],
      travel: {
        originLocationId: 'loc_camp',
        destinationLocationId: 'loc_mine',
        routeId: 'route_salt',
        waypointIds: ['loc_harbor'],
        mode: 'caravan',
        departedTurn: 5,
        totalTurns: 4,
      },
    };
  }

  it('derives the journey block from travel + absolute turn number', () => {
    const envelope = assembleSceneEnvelope({
      story: travelStory,
      playerState: makeTravelingState('loc_harbor'),
      resolution: baseResolution,
      playerActionText: 'Ride on toward the mine.',
      ledger: baseLedger,
      turnNumber: 7, // departed 5 → 2 legs elapsed of 4
    } as SceneTurnInput);

    assert.ok(envelope.travel, 'envelope must carry the active journey');
    assert.equal(envelope.travel!.originName, 'Caravan Camp');
    assert.equal(envelope.travel!.destinationName, 'Salt Mine');
    assert.equal(envelope.travel!.routeName, 'Salt Road');
    assert.equal(envelope.travel!.currentStopName, 'Brine Harbor');
    assert.equal(envelope.travel!.nextStopName, 'Salt Mine');
    assert.equal(envelope.travel!.dayOnRoad, 3);
    assert.equal(envelope.travel!.turnsRemaining, 2);
    assert.equal(envelope.travel!.totalTurns, 4);
    assert.equal(envelope.travel!.mode, 'caravan');
    assert.equal(envelope.travel!.arriving, undefined);
    // Caravan roster fallback (no explicit caravanNpcIds on the travel state).
    assert.deepEqual(envelope.travel!.caravanNpcNames, ['Borzou Sangtarash', 'Sohrab Choob-Dast']);
    assert.ok(envelope.travel!.roadNote?.includes('Danger 3'));
    assert.ok(envelope.travel!.roadNote?.includes('Ashfang Raiders'));
    assert.ok(envelope.travel!.roadNote?.includes('Road Wardens'));
  });

  it('scopes the world corridor to the stops ahead while traveling', () => {
    const envelope = assembleSceneEnvelope({
      story: travelStory,
      playerState: makeTravelingState('loc_harbor'),
      resolution: baseResolution,
      playerActionText: 'Ride on.',
      ledger: baseLedger,
      turnNumber: 7,
    } as SceneTurnInput);

    const locationLines = (envelope.locations ?? []).join('\n');
    assert.ok(locationLines.includes('Salt Mine'), 'destination must enter the corridor scope');
    assert.ok(locationLines.includes('Brine Harbor'), 'current stop must stay in scope');

    // Grounded control: at the camp only the camp + 1-hop ravine are in scope.
    const grounded = assembleSceneEnvelope({
      story: travelStory,
      playerState: { ...makeTravelingState('loc_camp'), travel: null },
      resolution: baseResolution,
      playerActionText: 'Keep watch.',
      ledger: baseLedger,
      turnNumber: 7,
    } as SceneTurnInput);
    assert.equal(grounded.travel, undefined);
    assert.ok(!(grounded.locations ?? []).join('\n').includes('Salt Mine'));
  });

  it('marks the final leg as arriving and keeps the destination in scope', () => {
    const envelope = assembleSceneEnvelope({
      story: travelStory,
      playerState: makeTravelingState('loc_harbor'),
      resolution: baseResolution,
      playerActionText: 'The mine appears ahead.',
      ledger: baseLedger,
      turnNumber: 8, // departed 5 → 3 legs of 4: final leg
    } as SceneTurnInput);

    assert.equal(envelope.travel?.arriving, true);
    assert.equal(envelope.travel?.turnsRemaining, 1);
  });

  it('maps the arrival input into the envelope and drops the journey block', () => {
    const envelope = assembleSceneEnvelope({
      story: travelStory,
      playerState: { ...makeTravelingState('loc_mine'), travel: null },
      resolution: baseResolution,
      playerActionText: 'Step through the mine gates.',
      ledger: baseLedger,
      turnNumber: 9,
      travelArrival: { locationId: 'loc_mine', name: 'Salt Mine' },
    } as SceneTurnInput);

    assert.equal(envelope.travel, undefined);
    assert.deepEqual(envelope.travelArrival, { destinationName: 'Salt Mine' });
  });
});
