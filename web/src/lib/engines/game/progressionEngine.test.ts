import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getXpThresholdForLevel,
  calculateActionXp,
  calculateMilestoneXp,
  applyXpGain,
  allocateLevelUpRewards,
} from './progressionEngine';
import { PlayerState } from '@/lib/types/gameplay';
import { DEFAULT_PROGRESSION_CONFIG, RPGSystemSchema } from '@/lib/types/rpg';

describe('Progression Engine — Hybrid XP, Level-Up & Stat Allocations', () => {
  const basePlayer: PlayerState = {
    characterName: 'برزین',
    level: 1,
    currentXP: 0,
    nextLevelXP: 100,
    totalEarnedXP: 0,
    unspentStatPoints: 0,
    unspentAbilityPicks: 0,
    stats: {
      might: 14,
      agility: 12,
      cunning: 10,
    },
    resources: {
      health: 20,
    },
    maxResources: {
      health: 20,
    },
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_gate',
  };

  const sampleRpg: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [
      {
        id: 'might',
        name: 'نیرو',
        description: 'قدرت فیزیکی',
        baseValue: 10,
        vitalEffect: { targetResourceId: 'health', bonusPerPointAboveBase: 2 },
      },
      { id: 'agility', name: 'چابکی', description: 'سرعت', baseValue: 10 },
      { id: 'cunning', name: 'حیله‌گری', description: 'هوش', baseValue: 10 },
    ],
    resources: [{ id: 'health', name: 'سلامت', current: 20, max: 20, min: 0 }],
    skills: [],
    startingInventory: [],
    inventoryCapacity: 10,
  };

  describe('getXpThresholdForLevel', () => {
    it('returns standard geometric curve thresholds by default', () => {
      assert.equal(getXpThresholdForLevel(1, DEFAULT_PROGRESSION_CONFIG), 100);
      assert.equal(getXpThresholdForLevel(2, DEFAULT_PROGRESSION_CONFIG), 150);
      assert.equal(getXpThresholdForLevel(3, DEFAULT_PROGRESSION_CONFIG), 200);
      assert.equal(getXpThresholdForLevel(4, DEFAULT_PROGRESSION_CONFIG), 250);
    });

    it('returns linear curve when configured', () => {
      const linearConfig = { ...DEFAULT_PROGRESSION_CONFIG, curveType: 'linear' as const };
      assert.equal(getXpThresholdForLevel(1, linearConfig), 100);
      assert.equal(getXpThresholdForLevel(2, linearConfig), 200);
      assert.equal(getXpThresholdForLevel(3, linearConfig), 300);
    });

    it('returns custom thresholds when array is provided', () => {
      const customConfig = {
        ...DEFAULT_PROGRESSION_CONFIG,
        curveType: 'custom' as const,
        customThresholds: [50, 120, 240, 500],
      };
      assert.equal(getXpThresholdForLevel(1, customConfig), 50);
      assert.equal(getXpThresholdForLevel(2, customConfig), 120);
      assert.equal(getXpThresholdForLevel(3, customConfig), 240);
    });
  });

  describe('calculateActionXp', () => {
    it('awards base XP according to risk level on success', () => {
      const low = calculateActionXp({ riskLevel: 'low', outcome: 'success' });
      assert.equal(low.amount, 10);

      const med = calculateActionXp({ riskLevel: 'medium', outcome: 'success' });
      assert.equal(med.amount, 25);

      const high = calculateActionXp({ riskLevel: 'high', outcome: 'success' });
      assert.equal(high.amount, 50);
    });

    it('applies partial success multiplier (0.5x) and failure learning multiplier (0.2x)', () => {
      const partial = calculateActionXp({ riskLevel: 'medium', outcome: 'mixed_success' });
      assert.equal(partial.amount, 13); // round(25 * 0.5)

      const failure = calculateActionXp({ riskLevel: 'high', outcome: 'failure' });
      assert.equal(failure.amount, 10); // round(50 * 0.2)
    });

    it('adds critical bonus for natural 20', () => {
      const crit = calculateActionXp({ riskLevel: 'high', outcome: 'success', diceRoll: 20 });
      assert.equal(crit.amount, 75); // 50 base + 25 crit bonus
      assert.ok(crit.reasonEn.includes('Natural 20'));
      assert.ok(crit.reasonFa.includes('۲۰ طبیعی'));
    });

    it('adds creature danger rating bonus for defeating beasts', () => {
      const beast = calculateActionXp({
        riskLevel: 'medium',
        outcome: 'success',
        creatureDangerLevel: 3,
      });
      // 25 base + (3 * 20) = 85 XP
      assert.equal(beast.amount, 85);
      assert.ok(beast.reasonEn.includes('Threat CR3'));
    });
  });

  describe('calculateMilestoneXp', () => {
    it('calculates quest, chapter, and discovery milestone XP', () => {
      const quest = calculateMilestoneXp('quest');
      assert.equal(quest.amount, 100);

      const chapter = calculateMilestoneXp('chapter');
      assert.equal(chapter.amount, 250);

      const disc = calculateMilestoneXp('discovery');
      assert.equal(disc.amount, 50);
    });
  });

  describe('applyXpGain', () => {
    it('increments currentXP without leveling up when below threshold', () => {
      const res = applyXpGain(basePlayer, 40);
      assert.equal(res.levelUpOccurred, false);
      assert.equal(res.newLevel, 1);
      assert.equal(res.updatedPlayerState.currentXP, 40);
      assert.equal(res.updatedPlayerState.nextLevelXP, 100);
      assert.equal(res.updatedPlayerState.unspentStatPoints, 0);
    });

    it('triggers Level Up when threshold (100) is reached or exceeded', () => {
      const res = applyXpGain(basePlayer, 125, DEFAULT_PROGRESSION_CONFIG, sampleRpg);
      assert.equal(res.levelUpOccurred, true);
      assert.equal(res.previousLevel, 1);
      assert.equal(res.newLevel, 2);
      assert.equal(res.updatedPlayerState.currentXP, 25); // 125 - 100 = 25 rollover
      assert.equal(res.updatedPlayerState.nextLevelXP, 150); // level 2 requires 150
      assert.equal(res.updatedPlayerState.unspentStatPoints, 1);
      assert.equal(res.updatedPlayerState.unspentAbilityPicks, 1); // level 2 unlocked an ability pick
    });

    it('handles multi-level threshold overflows cleanly', () => {
      // 100 (lvl 1->2) + 150 (lvl 2->3) + 30 = 280 XP
      const res = applyXpGain(basePlayer, 280);
      assert.equal(res.levelUpOccurred, true);
      assert.equal(res.newLevel, 3);
      assert.equal(res.updatedPlayerState.currentXP, 30);
      assert.equal(res.updatedPlayerState.unspentStatPoints, 2); // 2 level ups = 2 points
    });

    it('respects maxLevel cap and clamps level and rollover', () => {
      const cappedConfig = { ...DEFAULT_PROGRESSION_CONFIG, maxLevel: 2 };
      const res = applyXpGain(basePlayer, 9999, cappedConfig);
      assert.equal(res.newLevel, 2);
      assert.equal(res.updatedPlayerState.level, 2);
    });

    it('unlocks abilities every N levels when abilityUnlockCadence is every_n_levels', () => {
      const customCadenceConfig = {
        ...DEFAULT_PROGRESSION_CONFIG,
        abilityUnlockCadence: 'every_n_levels' as const,
        abilityUnlockInterval: 3,
      };

      // Level 1 -> Level 2: 2 is not divisible by 3, so 0 ability picks
      const resLvl2 = applyXpGain(basePlayer, 125, customCadenceConfig, sampleRpg);
      assert.equal(resLvl2.newLevel, 2);
      assert.equal(resLvl2.updatedPlayerState.unspentAbilityPicks, 0);

      // Level 2 -> Level 3: 3 % 3 === 0, so 1 ability pick gained
      const playerLvl2: PlayerState = {
        ...resLvl2.updatedPlayerState,
        level: 2,
        currentXP: 0,
        nextLevelXP: 150,
      };
      const resLvl3 = applyXpGain(playerLvl2, 160, customCadenceConfig, sampleRpg);
      assert.equal(resLvl3.newLevel, 3);
      assert.equal(resLvl3.updatedPlayerState.unspentAbilityPicks, 1);
    });
  });

  describe('allocateLevelUpRewards', () => {
    it('allocates stat points and increases stats cleanly', () => {
      const playerWithPoints: PlayerState = {
        ...basePlayer,
        unspentStatPoints: 2,
        stats: { might: 14, agility: 12, cunning: 10 },
      };

      const res = allocateLevelUpRewards(playerWithPoints, { might: 1, agility: 1 }, undefined, sampleRpg);
      assert.equal(res.success, true);
      assert.equal(res.updatedPlayerState.unspentStatPoints, 0);
      assert.equal(res.updatedPlayerState.stats.might, 15);
      assert.equal(res.updatedPlayerState.stats.agility, 13);
      // Might increased from 14 to 15 -> VitalEffect +2 Max Health
      assert.ok((res.updatedPlayerState.maxResources?.health || 0) >= 20);
    });

    it('rejects allocation when spending more points than available', () => {
      const playerWithOnePoint: PlayerState = {
        ...basePlayer,
        unspentStatPoints: 1,
      };

      const res = allocateLevelUpRewards(playerWithOnePoint, { might: 2 });
      assert.equal(res.success, false);
      assert.ok(res.error?.includes('Cannot spend'));
    });

    it('unlocks chosen ability and decrements ability pick slots', () => {
      const playerWithAbilityPick: PlayerState = {
        ...basePlayer,
        unspentStatPoints: 0,
        unspentAbilityPicks: 1,
        abilities: ['ab_caravan'],
      };

      const res = allocateLevelUpRewards(playerWithAbilityPick, {}, 'ab_shield_wall');
      assert.equal(res.success, true);
      assert.ok(res.updatedPlayerState.abilities?.includes('ab_shield_wall'));
      assert.equal(res.updatedPlayerState.unspentAbilityPicks, 0);
    });
  });

  // The pre-existing allocateLevelUpRewards cases above all use stats that are
  // ALREADY present in playerState.stats, on a baseValue-10 fixture. They passed
  // before these fixes and would have kept passing after them, so they prove
  // nothing about the baseline or the validation. These cases do.
  describe('allocateLevelUpRewards — untrusted payload validation', () => {
    it('rejects negative offsets that would otherwise net out to a cheap spend', () => {
      // The original bug: the budget summed a SIGNED total (100 + -99 = 1) while
      // the apply loop only touched entries where b > 0 — so 1 point bought +100
      // might. Unauthenticated via POST /api/play/level-up.
      const player: PlayerState = {
        ...basePlayer,
        unspentStatPoints: 1,
        stats: { might: 10, agility: 10, cunning: 10 },
      };

      const res = allocateLevelUpRewards(player, { might: 100, agility: -99 }, undefined, sampleRpg);

      assert.equal(res.success, false, 'a 1-point budget must not grant +100 might');
      // Nothing partially applied.
      assert.equal(player.stats.might, 10);
    });

    it('rejects phantom stats that the story does not define', () => {
      const player: PlayerState = { ...basePlayer, unspentStatPoints: 4 };
      const res = allocateLevelUpRewards(player, { ghost_stat: 1 }, undefined, sampleRpg);
      assert.equal(res.success, false);
      assert.ok(res.error?.includes('ghost_stat'));
    });

    it('rejects fractional point spends rather than creating fractional stats', () => {
      const player: PlayerState = {
        ...basePlayer,
        unspentStatPoints: 1,
        stats: { might: 10 },
      };
      const res = allocateLevelUpRewards(player, { might: 0.5 }, undefined, sampleRpg);
      assert.equal(res.success, false);
      assert.equal(Number.isInteger(player.stats.might), true);
    });

    it('rejects an ability id the story does not define', () => {
      const player: PlayerState = { ...basePlayer, unspentAbilityPicks: 1 };
      const rpgWithAbilities = {
        ...sampleRpg,
        abilities: [{ id: 'ab_shield_wall', name: 'Shield Wall', description: '' }],
      } as unknown as RPGSystemSchema;

      const res = allocateLevelUpRewards(player, {}, 'ab_not_real', rpgWithAbilities);
      assert.equal(res.success, false);
      assert.ok(res.error?.includes('ab_not_real'));
    });
  });

  describe('allocateLevelUpRewards — story-relative stat baseline', () => {
    it('creates a missing stat at universalBaseValue, not a hardcoded 10', () => {
      const player: PlayerState = { ...basePlayer, unspentStatPoints: 1, stats: {} };
      const lowScaleRpg: RPGSystemSchema = {
        ...sampleRpg,
        universalBaseValue: 5,
      } as RPGSystemSchema;

      const res = allocateLevelUpRewards(player, { might: 1 }, undefined, lowScaleRpg);

      assert.equal(res.success, true);
      // 5 (baseline) + 1 (spent) — the old `|| 10` fallback produced 11.
      assert.equal(res.updatedPlayerState.stats.might, 6);
    });

    it('creates a missing stat at its authored baseValue when there is no universalBaseValue', () => {
      const player: PlayerState = { ...basePlayer, unspentStatPoints: 2, stats: {} };
      const perStatRpg: RPGSystemSchema = {
        ...sampleRpg,
        stats: sampleRpg.stats.map((s) => (s.id === 'might' ? { ...s, baseValue: 3 } : s)),
      } as RPGSystemSchema;

      const res = allocateLevelUpRewards(player, { might: 2 }, undefined, perStatRpg);

      assert.equal(res.success, true);
      // 3 (per-stat baseline) + 2 (spent) — the old `|| 10` fallback produced 12.
      assert.equal(res.updatedPlayerState.stats.might, 5);
    });

    it('prefers universalBaseValue over the per-stat baseValue when both are set', () => {
      const player: PlayerState = { ...basePlayer, unspentStatPoints: 1, stats: {} };
      const both: RPGSystemSchema = {
        ...sampleRpg,
        universalBaseValue: 7,
        stats: sampleRpg.stats.map((s) => (s.id === 'might' ? { ...s, baseValue: 3 } : s)),
      } as RPGSystemSchema;

      const res = allocateLevelUpRewards(player, { might: 1 }, undefined, both);
      assert.equal(res.success, true);
      assert.equal(res.updatedPlayerState.stats.might, 8);
    });

    it('falls back to 10 only when no RPG system context is available at all', () => {
      const player: PlayerState = { ...basePlayer, unspentStatPoints: 1, stats: {} };

      // With no rpgSystem there is nothing to validate against or resolve a
      // baseline from, so isDefinedStat passes through and resolveStatBase
      // returns the classic 10. This is the only path that should still yield 10.
      const res = allocateLevelUpRewards(player, { might: 1 });
      assert.equal(res.success, true);
      assert.equal(res.updatedPlayerState.stats.might, 11);
    });

    it('rejects allocation when the story defines no stats at all', () => {
      const player: PlayerState = { ...basePlayer, unspentStatPoints: 1, stats: {} };
      const noStats: RPGSystemSchema = { ...sampleRpg, stats: [] } as RPGSystemSchema;

      const res = allocateLevelUpRewards(player, { might: 1 }, undefined, noStats);
      assert.equal(res.success, false);
      assert.ok(res.error?.includes('might'));
    });
  });
});
