import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './GameEngine';
import { PlayerState } from '@/lib/types/gameplay';
import { WorldBible, WorldQuest, NPCDossier, WorldQuestSchema, QuestObjectiveSchema } from '@/lib/types/world';

describe('Plan 11: Quests, Quest Lines & NPC Trust Progression', () => {
  const dummyNpc: NPCDossier = {
    id: 'npc_blacksmith',
    name: 'Kenneth Iron-Hand',
    title: 'Master Blacksmith',
    currentLocationId: 'loc_forge',
    personalityTraits: ['gruff', 'loyal'],
    speechStyle: 'terse',
    goals: ['repair ancient forge'],
    secrets: [
      {
        id: 'sec_moon_forge',
        description: 'Knows the forbidden secret of forging moon-silver relics.',
        requiredTrustLevel: 50,
        revealed: false,
        revealMethods: [{ kind: 'quest', questId: 'quest_moon_silver' }],
      },
    ],
    initialTrust: 10,
  };

  const sampleQuest: WorldQuest = {
    id: 'quest_moon_silver',
    title: 'Ore of the High Peaks',
    summary: 'Retrieve 2 Moon-Silver Ingots for Master Kenneth.',
    category: 'personal_errand',
    giverNpcId: 'npc_blacksmith',
    originLocationId: 'loc_forge',
    prerequisites: {
      requiredCompletedQuestIds: [],
      requiredTrustLevel: 10,
      requiredPossessedItemIds: [],
    },
    objectives: [
      {
        id: 'obj_1',
        description: 'Collect 2 Moon-Silver Ingots',
        type: 'fetch',
        requiredItemId: 'item_moon_silver',
        requiredQuantity: 2,
        consumeItemOnComplete: true,
        isOptional: false,
      },
      {
        id: 'obj_2',
        description: 'Return to Kenneth at the Forge',
        type: 'deliver',
        targetNpcId: 'npc_blacksmith',
        targetLocationId: 'loc_forge',
        isOptional: false,
        consumeItemOnComplete: false,
        requiredQuantity: 1,
      },
    ],
    rewards: {
      trustRewards: [{ npcId: 'npc_blacksmith', trustDelta: 30 }],
      unlockedSecretIds: [],
      goldReward: 50,
      itemRewards: [
        { id: 'item_relic_hammer', name: 'Runic Smithing Hammer', quantity: 1 },
      ],
      narrativeResolution: 'Kenneth claps your shoulder and unveils the secret of the Moon Forge.',
    },
    nextQuestId: 'quest_moon_blade',
  };

  const nextQuestInLine: WorldQuest = {
    id: 'quest_moon_blade',
    title: 'Forging the Moon Blade',
    summary: 'Aid Kenneth in hammering the celestial alloy into an heirloom weapon.',
    category: 'main_arc',
    giverNpcId: 'npc_blacksmith',
    questLineId: 'ql_celestial_armory',
    questLineName: 'The Celestial Armory',
    orderInLine: 2,
    prerequisites: {
      requiredCompletedQuestIds: ['quest_moon_silver'],
      requiredTrustLevel: 30,
      requiredPossessedItemIds: [],
    },
    objectives: [
      {
        id: 'obj_forge_weapon',
        description: 'Stoke the ancient bellows and hammer the blade',
        type: 'slay',
        targetLocationId: 'loc_forge',
        isOptional: false,
        consumeItemOnComplete: false,
        requiredQuantity: 1,
      },
    ],
    rewards: {
      trustRewards: [{ npcId: 'npc_blacksmith', trustDelta: 20 }],
      unlockedSecretIds: [],
      goldReward: 0,
      itemRewards: [],
    },
  };

  const itemTriggeredQuest: WorldQuest = {
    id: 'quest_sealed_letter',
    title: 'The Blood-Stained Sigil',
    summary: 'Investigate the cryptic raven sigil found on the courier.',
    category: 'investigation',
    triggerItemId: 'item_sealed_letter',
    prerequisites: {
      requiredCompletedQuestIds: [],
      requiredPossessedItemIds: [],
    },
    objectives: [
      {
        id: 'obj_read_letter',
        description: 'Find a scholar who can read the cipher',
        type: 'discover',
        targetLocationId: 'loc_archive',
        isOptional: false,
        consumeItemOnComplete: false,
        requiredQuantity: 1,
      },
    ],
    rewards: {
      trustRewards: [],
      unlockedSecretIds: [],
      goldReward: 0,
      itemRewards: [],
    },
  };

  const mockWorldBible: WorldBible = {
    worldId: 'test_world',
    worldName: 'Test World',
    summary: 'Test',
    themeNotes: 'Test',
    laws: [],
    factions: [],
    locations: [
      {
        id: 'loc_forge',
        name: 'The Iron Forge',
        description: 'Heat and sparks fill the air.',
        region: 'Lower District',
        dangerLevel: 1,
        atmosphere: 'Smoky and loud',
        connectedLocationIds: ['loc_archive'],
      },
      {
        id: 'loc_archive',
        name: 'The Grand Archive',
        description: 'Dusty scrolls and ancient codices.',
        region: 'Upper District',
        dangerLevel: 1,
        atmosphere: 'Quiet and scholarly',
        connectedLocationIds: ['loc_forge'],
      },
    ],
    timeline: [],
    npcs: [dummyNpc],
    quests: [sampleQuest, nextQuestInLine, itemTriggeredQuest],
  };

  const createInitialPlayerState = (): PlayerState => ({
    stats: { might: 14, agility: 12 },
    resources: { hp: 100, gold: 20 },
    inventory: [
      {
        id: 'item_moon_silver',
        name: 'Moon-Silver Ingot',
        quantity: 2,
        type: 'quest_item',
        description: 'A shimmering raw bar of moon-silver.',
      },
    ],
    equipment: {},
    discoveredLocationIds: ['loc_forge'],
    relationships: {
      npc_blacksmith: { trust: 15, knownSecrets: [], notes: [] },
    },
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_forge',
  });

  describe('Item-Triggered Quest Activation', () => {
    it('automatically activates quest when player possesses trigger item', () => {
      const state = createInitialPlayerState();
      state.inventory.push({
        id: 'item_sealed_letter',
        name: 'Blood-Stained Courier Letter',
        quantity: 1,
        type: 'document',
        description: 'A sealed wax missive.',
        startsQuestId: 'quest_sealed_letter',
      });

      const triggerResult = GameEngine.evaluateQuestItemTriggers(state, mockWorldBible);
      assert.ok(triggerResult);
      assert.equal(triggerResult.activatedQuests.length, 1);
      assert.equal(triggerResult.activatedQuests[0].id, 'quest_sealed_letter');
      assert.equal(triggerResult.diff.questUpdates?.[0].status, 'active');

      const mutated = GameEngine.applyStateMutation(state, triggerResult.diff);
      assert.ok(mutated.activeQuestIds.includes('quest_sealed_letter'));
    });

    it('does not re-trigger quests that are already active or completed', () => {
      const state = createInitialPlayerState();
      state.activeQuestIds = ['quest_sealed_letter'];
      state.inventory.push({
        id: 'item_sealed_letter',
        name: 'Letter',
        quantity: 1,
        type: 'document',
        description: '',
        startsQuestId: 'quest_sealed_letter',
      });

      const result = GameEngine.evaluateQuestItemTriggers(state, mockWorldBible);
      assert.equal(result, null);
    });
  });

  describe('Quest Prerequisites & Offering', () => {
    it('approves quest offering when trust and prerequisites are met', () => {
      const state = createInitialPlayerState();
      assert.equal(GameEngine.canOfferQuest(sampleQuest, state), true);
    });

    it('rejects quest offering if trust is below requirement', () => {
      const state = createInitialPlayerState();
      state.relationships.npc_blacksmith.trust = 5; // Required is 10
      assert.equal(GameEngine.canOfferQuest(sampleQuest, state), false);
    });

    it('rejects chained quest if prerequisite quest is not completed', () => {
      const state = createInitialPlayerState();
      // nextQuestInLine requires 'quest_moon_silver' in completedQuestIds
      assert.equal(GameEngine.canOfferQuest(nextQuestInLine, state), false);

      state.completedQuestIds = ['quest_moon_silver'];
      state.relationships.npc_blacksmith.trust = 40; // Required is 30
      assert.equal(GameEngine.canOfferQuest(nextQuestInLine, state), true);
    });
  });

  describe('Objective Fulfillment & Quest Completion', () => {
    it('detects when all objectives are satisfied', () => {
      const state = createInitialPlayerState();
      state.activeQuestIds = ['quest_moon_silver'];

      const evalResult = GameEngine.evaluateActiveQuests(state, mockWorldBible, {
        targetNpcId: 'npc_blacksmith',
      });
      assert.equal(evalResult.readyToComplete.length, 1);
      assert.equal(evalResult.readyToComplete[0].id, 'quest_moon_silver');
    });

    it('does not complete fetch quest if required items are missing or insufficient', () => {
      const state = createInitialPlayerState();
      state.activeQuestIds = ['quest_moon_silver'];
      state.inventory = [
        {
          id: 'item_moon_silver',
          name: 'Moon-Silver Ingot',
          quantity: 1, // Needs 2
          type: 'quest_item',
          description: '',
        },
      ];

      const evalResult = GameEngine.evaluateActiveQuests(state, mockWorldBible, {
        targetNpcId: 'npc_blacksmith',
      });
      assert.equal(evalResult.readyToComplete.length, 0);
    });

    it('completes quest: consumes turn-in item, grants trust, gold, rewards, unmasks secret, and advances line', () => {
      const state = createInitialPlayerState();
      state.activeQuestIds = ['quest_moon_silver'];

      const { diff, narrativeSummary } = GameEngine.completeQuest(
        sampleQuest,
        state,
        mockWorldBible
      );

      // 1. Items consumed
      assert.ok(diff.itemsRemovedIds?.includes('item_moon_silver'));

      // 2. Trust awarded
      assert.equal(diff.relationshipChanges!['npc_blacksmith'].trustDelta, 30);

      // 3. Secret unmasked (via SecretRevealMethodKind = 'quest')
      assert.equal(
        diff.relationshipChanges!['npc_blacksmith'].newSecret,
        'sec_moon_forge'
      );

      // 4. Gold and items awarded
      assert.equal(diff.resourceChanges!['gold'], 50);
      assert.equal(diff.itemsAdded?.[0].id, 'item_relic_hammer');

      // 5. Quest completed and next quest queued
      assert.ok(diff.questUpdates?.some((u) => u.questId === 'quest_moon_silver' && u.status === 'completed'));
      assert.ok(diff.questUpdates?.some((u) => u.questId === 'quest_moon_blade' && u.status === 'active'));

      // 6. Narrative summary
      assert.ok(narrativeSummary.includes('Moon Forge'));

      // Apply state mutation and verify updated state integrity
      const updated = GameEngine.applyStateMutation(state, diff);
      assert.ok(updated.completedQuestIds.includes('quest_moon_silver'));
      assert.ok(!updated.activeQuestIds.includes('quest_moon_silver'));
      assert.ok(updated.activeQuestIds.includes('quest_moon_blade')); // Chained line
      assert.equal(updated.relationships.npc_blacksmith.trust, 45); // 15 + 30
      assert.ok(updated.relationships.npc_blacksmith.knownSecrets.includes('sec_moon_forge'));
      assert.equal(updated.resources.gold, 70); // 20 + 50
      assert.ok(updated.inventory.some((i) => i.id === 'item_relic_hammer'));
      assert.equal(updated.inventory.find((i) => i.id === 'item_moon_silver')?.quantity, 1); // 2 - 1 removed
    });
  });

  describe('Zod Schema Boundary Validations', () => {
    it('validates a correct WorldQuest payload and defaults optional structures', () => {
      const parsed = WorldQuestSchema.parse({
        id: 'q_valid',
        title: 'Valid Quest',
        summary: 'A legitimate test quest',
        objectives: [
          {
            id: 'obj_1',
            description: 'Scout the perimeter',
            type: 'discover',
          },
        ],
      });

      assert.equal(parsed.category, 'personal_errand');
      assert.equal(parsed.objectives[0].consumeItemOnComplete, true);
      assert.equal(parsed.rewards.goldReward, 0);
      assert.deepEqual(parsed.rewards.trustRewards, []);
    });

    it('rejects an objective with an invalid type', () => {
      assert.throws(() => {
        QuestObjectiveSchema.parse({
          id: 'obj_bad',
          description: 'Bad type objective',
          type: 'teleport_unknown' as any,
        });
      });
    });

    it('rejects a quest with zero objectives', () => {
      assert.throws(() => {
        WorldQuestSchema.parse({
          id: 'q_no_obj',
          title: 'Empty Objectives',
          summary: 'Should fail',
          objectives: [],
        });
      });
    });
  });
});
