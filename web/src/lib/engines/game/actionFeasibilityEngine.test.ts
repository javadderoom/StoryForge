import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFeasibilityHeuristics,
  assessActionFeasibility,
} from './actionFeasibilityEngine';
import { GameEngine } from './GameEngine';
import { PlayerState } from '@/lib/types/gameplay';
import { RPGSystemSchema } from '@/lib/types/rpg';

describe('Universal Action Feasibility & Proportionate Consequence Engine', () => {
  const basePlayer: PlayerState = {
    currentLocationId: 'loc_bridge',
    stats: { might: 14, agility: 12, cunning: 10, charisma: 8, arcana: 6 },
    resources: { hp: 40, stamina: 30, mana: 20 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
  };

  const baseRpg: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    skills: [],
    startingInventory: [],
    inventoryCapacity: 10,
    stats: [
      { id: 'might', name: 'Might', description: 'Strength', baseValue: 10 },
      { id: 'agility', name: 'Agility', description: 'Speed', baseValue: 10 },
      { id: 'cunning', name: 'Cunning', description: 'Wit', baseValue: 10 },
      { id: 'charisma', name: 'Charisma', description: 'Presence', baseValue: 10 },
      { id: 'arcana', name: 'Arcana', description: 'Magic', baseValue: 10 },
    ],
    resources: [
      { id: 'hp', name: 'Health', min: 0, max: 50, current: 40 },
      { id: 'stamina', name: 'Stamina', min: 0, max: 40, current: 30 },
    ],
  };

  describe('Heuristic Feasibility Classifier', () => {
    it('flags solo assault on military squads / garrisons as impossible with overwhelming_violence', () => {
      const faAction = 'با شمشیر و سپر به سمت صف گزمه‌های روی پل یورش می‌برم و سد معبر را با زور باز می‌کنم.';
      const resFa = evaluateFeasibilityHeuristics(faAction, { isPersian: true });
      assert.equal(resFa.tier, 'impossible');
      assert.equal(resFa.reaction, 'overwhelming_violence');

      const enAction = 'I charge the armed garrison spear wall alone and smash through them.';
      const resEn = evaluateFeasibilityHeuristics(enAction, { isPersian: false });
      assert.equal(resEn.tier, 'impossible');
      assert.equal(resEn.reaction, 'overwhelming_violence');
    });

    it('flags demanding the king’s crown / throne as impossible with imprisonment_or_law', () => {
      const faAction = 'رو به پادشاه فریاد می‌زنم و دستور می‌دهم تا تاج را تسلیم من کند.';
      const resFa = evaluateFeasibilityHeuristics(faAction, { isPersian: true });
      assert.equal(resFa.tier, 'impossible');
      assert.equal(resFa.reaction, 'imprisonment_or_law');

      const enAction = 'I demand the King surrender his crown to me right now.';
      const resEn = evaluateFeasibilityHeuristics(enAction, { isPersian: false });
      assert.equal(resEn.tier, 'impossible');
      assert.equal(resEn.reaction, 'imprisonment_or_law');
    });

    it('flags bare-bodied physical defiance (jumping 100ft chasm) as impossible with lethal_hazard', () => {
      const faAction = 'بدون هیچ وسیله‌ای با یک جهش بلند از روی دره صدمتری می‌پرم.';
      const resFa = evaluateFeasibilityHeuristics(faAction, { isPersian: true });
      assert.equal(resFa.tier, 'impossible');
      assert.equal(resFa.reaction, 'lethal_hazard');

      const enAction = 'I leap across the 100 foot canyon bare-bodied.';
      const resEn = evaluateFeasibilityHeuristics(enAction, { isPersian: false });
      assert.equal(resEn.tier, 'impossible');
      assert.equal(resEn.reaction, 'lethal_hazard');
    });

    it('leaves standard adventurer actions as feasible', () => {
      const action1 = 'بررسی پایه‌های چوبی پل برای یافتن راه عبور';
      assert.equal(evaluateFeasibilityHeuristics(action1).tier, 'feasible');

      const action2 = 'Quietly pick the lock on the chest with a needle';
      assert.equal(evaluateFeasibilityHeuristics(action2).tier, 'feasible');
    });
  });

  describe('Impossible Action Resolution & Proportionate Consequences', () => {
    it('resolves solo garrison assault on Nat 20 as miraculous survival instead of clean victory', () => {
      const action = 'با شمشیر به صف گزمه‌ها یورش می‌برم و سد معبر را با زور باز می‌کنم.';
      const feasibility = evaluateFeasibilityHeuristics(action, { isPersian: true });

      const res = GameEngine.resolveActionCheck(action, basePlayer, baseRpg, {
        forcedDiceRoll: 20, // Natural 20
        isPersian: true,
        feasibility,
      });

      // Capped at mixed_success (miraculous survival)
      assert.equal(res.outcome, 'mixed_success');
      assert.ok(res.consequenceSummary.includes('بقا در واپسین دم'));
      assert.equal(res.stateDiff.resourceChanges?.hp, -5); // Takes chip damage rather than 0 damage
      assert.equal(res.feasibilityTier, 'impossible');
      assert.equal(res.expectedReaction, 'overwhelming_violence');
    });

    it('resolves solo garrison assault on normal high roll as failure with severe beatdown', () => {
      const action = 'با شمشیر به صف گزمه‌ها یورش می‌برم و سد معبر را با زور باز می‌کنم.';
      const feasibility = evaluateFeasibilityHeuristics(action, { isPersian: true });

      const res = GameEngine.resolveActionCheck(action, basePlayer, baseRpg, {
        forcedDiceRoll: 16, // Roll 16 + 2 (Might) = 18 vs DC 15
        targetDC: 15,
        isPersian: true,
        feasibility,
      });

      // Even though score 18 exceeds DC 15, impossibility caps it to failure with proportionate reprisal
      assert.equal(res.outcome, 'failure');
      assert.ok(res.consequenceSummary.includes('شکست در برابر فزونی نفرات'));
      assert.equal(res.stateDiff.resourceChanges?.hp, -15);
    });

    it('resolves demanding the king’s crown on Nat 20 as jester amusement / leniency', () => {
      const action = 'رو به پادشاه فریاد می‌زنم و دستور می‌دهم تا تاج را تسلیم من کند.';
      const feasibility = evaluateFeasibilityHeuristics(action, { isPersian: true });

      const res = GameEngine.resolveActionCheck(action, basePlayer, baseRpg, {
        forcedDiceRoll: 20,
        isPersian: true,
        feasibility,
      });

      // Goal refused, but spared execution
      assert.equal(res.outcome, 'mixed_success');
      assert.ok(res.consequenceSummary.includes('پادشاه از شدت نامعقول بودن خواسته به خنده افتاد'));
      assert.equal(res.feasibilityTier, 'impossible');
      assert.equal(res.expectedReaction, 'imprisonment_or_law');
    });

    it('resolves demanding the king’s crown on normal roll as high treason arrest', () => {
      const action = 'رو به پادشاه فریاد می‌زنم و دستور می‌دهم تا تاج را تسلیم من کند.';
      const feasibility = evaluateFeasibilityHeuristics(action, { isPersian: true });

      const res = GameEngine.resolveActionCheck(action, basePlayer, baseRpg, {
        forcedDiceRoll: 14,
        isPersian: true,
        feasibility,
      });

      assert.equal(res.outcome, 'failure');
      assert.ok(res.consequenceSummary.includes('خیانت به تاج‌وتخت'));
      assert.ok(res.consequenceSummary.includes('سیاهچال'));
    });
  });
});
