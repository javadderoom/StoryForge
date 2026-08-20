import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './GameEngine';
import { PlayerState } from '../../types/gameplay';
import { RPGSystemSchema } from '../../types/rpg';

describe('GameEngine - Deterministic Mechanics & Math', () => {
  const sampleRpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [
      { id: 'might', name: 'Might', description: 'Strength', baseValue: 14 },
      { id: 'agility', name: 'Agility', description: 'Speed', baseValue: 12 },
      { id: 'cunning', name: 'Cunning', description: 'Wit', baseValue: 8 },
    ],
    resources: [
      { id: 'hp', name: 'Health', current: 100, max: 100, min: 0 },
      { id: 'stamina', name: 'Stamina', current: 50, max: 50, min: 0 },
      { id: 'gold', name: 'Gold', current: 50, max: 9999, min: 0 },
    ],
    skills: [
      { id: 'swordsmanship', name: 'Swordsmanship', description: 'Blade mastery', linkedStatId: 'might', tier: 1, bonusModifier: 2 },
    ],
    startingInventory: [],
    inventoryCapacity: 10,
  };

  const initialPlayerState: PlayerState = {
    stats: { might: 14, agility: 12, cunning: 8 },
    resources: { hp: 100, stamina: 50, gold: 50 },
    inventory: [
      { id: 'iron_dagger', name: 'Iron Dagger', description: 'Sharp edge', type: 'weapon', quantity: 1, statModifiers: { agility: 1 } },
    ],
    equipment: {},
    discoveredLocationIds: ['loc_dungeon_cell'],
    relationships: {
      npc_rolan: { trust: 10, knownSecrets: [], notes: [] },
    },
    activeQuestIds: ['quest_escape'],
    completedQuestIds: [],
    currentLocationId: 'loc_dungeon_cell',
  };

  describe('Stat Modifiers', () => {
    it('calculates correct D20 modifiers for various stat levels', () => {
      assert.equal(GameEngine.getStatModifier(10), 0);
      assert.equal(GameEngine.getStatModifier(11), 0);
      assert.equal(GameEngine.getStatModifier(12), 1);
      assert.equal(GameEngine.getStatModifier(14), 2);
      assert.equal(GameEngine.getStatModifier(18), 4);
      assert.equal(GameEngine.getStatModifier(8), -1);
      assert.equal(GameEngine.getStatModifier(6), -2);
    });
  });

  describe('Dice Rolling', () => {
    it('respects forced rolls for deterministic outcomes', () => {
      const nat20 = GameEngine.rollDice('d20', 20);
      assert.equal(nat20.roll, 20);
      assert.equal(nat20.isNatMax, true);
      assert.equal(nat20.isNatMin, false);

      const nat1 = GameEngine.rollDice('d20', 1);
      assert.equal(nat1.roll, 1);
      assert.equal(nat1.isNatMin, true);
      assert.equal(nat1.isNatMax, false);
    });

    it('rolls within valid bounds when using RNG', () => {
      for (let i = 0; i < 50; i++) {
        const d20 = GameEngine.rollDice('d20');
        assert.ok(d20.roll >= 1 && d20.roll <= 20);

        const d26 = GameEngine.rollDice('2d6');
        assert.ok(d26.roll >= 2 && d26.roll <= 12);
      }
    });
  });

  describe('Action Resolution Checks', () => {
    it('resolves a Critical Success on a Natural 20', () => {
      const res = GameEngine.resolveActionCheck(
        'Strike the dragon',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'might', forcedDiceRoll: 20, targetDC: 15 }
      );
      assert.equal(res.outcome, 'critical_success');
      assert.equal(res.diceRoll, 20);
    });

    it('resolves a Critical Failure on a Natural 1 with automatic damage penalty', () => {
      const res = GameEngine.resolveActionCheck(
        'Pick the heavy vault lock',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'agility', forcedDiceRoll: 1, targetDC: 10 }
      );
      assert.equal(res.outcome, 'critical_failure');
      assert.equal(res.stateDiff.resourceChanges?.hp, -15);
    });

    it('resolves standard Success when score meets DC', () => {
      const res = GameEngine.resolveActionCheck(
        'Force the iron gate open',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'might', forcedDiceRoll: 11, targetDC: 12 }
      );
      assert.equal(res.outcome, 'success');
      assert.equal(res.totalScore, 13);
    });

    it('resolves Mixed Success (with cost) when score is within 3 of DC', () => {
      const res = GameEngine.resolveActionCheck(
        'Bribe the guard',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'cunning', forcedDiceRoll: 12, targetDC: 13 }
      );
      assert.equal(res.outcome, 'mixed_success');
      assert.ok(res.stateDiff.resourceChanges?.hp !== undefined);
    });

    it('resolves Failure when score is significantly below DC', () => {
      const res = GameEngine.resolveActionCheck(
        'Decipher the ancient runes',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'cunning', forcedDiceRoll: 5, targetDC: 14 }
      );
      assert.equal(res.outcome, 'failure');
    });

    it('correctly includes skill bonuses in total calculation', () => {
      const res = GameEngine.resolveActionCheck(
        'Parry the enemy sword',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'might', skillId: 'swordsmanship', forcedDiceRoll: 10, targetDC: 13 }
      );
      assert.equal(res.totalScore, 14);
      assert.equal(res.outcome, 'success');
    });
  });

  describe('State Mutations & Reducer Integrity', () => {
    it('applies resource damage and clamps to minimum zero', () => {
      const mutated = GameEngine.applyStateMutation(
        initialPlayerState,
        { resourceChanges: { hp: -150 } },
        sampleRpgSystem
      );
      assert.equal(mutated.resources.hp, 0);
    });

    it('adds new inventory items or stacks quantities for existing items', () => {
      const mutated = GameEngine.applyStateMutation(initialPlayerState, {
        itemsAdded: [
          { id: 'iron_dagger', name: 'Iron Dagger', description: '', type: 'weapon', quantity: 2 },
          { id: 'bronze_key', name: 'Bronze Key', description: 'Opens cell', type: 'quest_item', quantity: 1 },
        ],
      });

      const dagger = mutated.inventory.find((i) => i.id === 'iron_dagger');
      assert.equal(dagger?.quantity, 3);

      const key = mutated.inventory.find((i) => i.id === 'bronze_key');
      assert.equal(key?.quantity, 1);
    });

    it('decrements item quantity by 1 for stacked items', () => {
      const stackedState = {
        ...initialPlayerState,
        inventory: [
          { id: 'smoke_pellet', name: 'Smoke Pellet', description: '', type: 'consumable' as const, quantity: 2 },
        ],
      };
      const mutated = GameEngine.applyStateMutation(stackedState, {
        itemsRemovedIds: ['smoke_pellet'],
      });
      const pellet = mutated.inventory.find((i) => i.id === 'smoke_pellet');
      assert.equal(pellet?.quantity, 1);

      const secondMutation = GameEngine.applyStateMutation(mutated, {
        itemsRemovedIds: ['smoke_pellet'],
      });
      assert.equal(secondMutation.inventory.length, 0);
    });

    it('triggers tactical smoke pellet environmental bonus and item removal in action text', () => {
      const stateWithPellet = {
        ...initialPlayerState,
        inventory: [
          { id: 'smoke_pellet', name: 'Alchemical Smoke Pellet', description: '', type: 'consumable' as const, quantity: 2 },
        ],
      };
      const res = GameEngine.resolveActionCheck('Throw alchemical smoke pellet to escape guards', stateWithPellet, sampleRpgSystem, {
        forcedDiceRoll: 10,
      });

      assert.equal(res.environmentalModifier, 4);
      assert.ok(res.stateDiff.itemsRemovedIds?.includes('smoke_pellet'));
    });

    it('triggers potion healing and item removal in action text', () => {
      const stateWithPotion = {
        ...initialPlayerState,
        inventory: [
          { id: 'healing_tincture', name: 'Healing Tincture', description: '', type: 'consumable' as const, quantity: 1, healValue: 30 },
        ],
      };
      const res = GameEngine.resolveActionCheck('Drink healing tincture quickly behind cover', stateWithPotion, sampleRpgSystem, {
        forcedDiceRoll: 10,
      });

      assert.equal(res.stateDiff.resourceChanges?.hp, 30);
      assert.ok(res.stateDiff.itemsRemovedIds?.includes('healing_tincture'));
    });
  });
});
