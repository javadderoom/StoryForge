import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCandidateEncounters,
  resolveTurnEncounter,
  settlePendingEncounterRewards,
} from './EncounterEvaluator';
import { StoryEncounter, PlayerState } from '@/lib/types';
import type { WorldBible } from '@/lib/types/world';

function createMockPlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    characterName: 'Sohrab',
    stats: { agility: 12, might: 14 },
    resources: { hp: 100 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: ['loc_marsh'],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_marsh',
    completedEncounterIds: [],
    ...overrides,
  };
}

describe('EncounterEvaluator', () => {
  const viperEncounter: StoryEncounter = {
    id: 'enc_viper_ambush',
    title: 'کمین افعی رسوبی در نیزار',
    narrativeText: 'از میان آب گل‌آلود نیزار، سایه‌ای سیاه و پیچان برمی‌خیزد...',
    locationId: 'loc_marsh',
    locationTags: ['marsh'],
    triggerConditions: {
      triggerType: 'on_explore',
      weight: 80,
      repeatable: false,
      requiredItemIds: [],
      requiredCompletedEventIds: [],
      forbiddenEventIds: [],
    },
  };

  it('triggers an encounter when location matches and conditions are met', () => {
    const state = createMockPlayerState({ currentLocationId: 'loc_marsh' });
    const result = evaluateCandidateEncounters({
      encounters: [viperEncounter],
      playerState: state,
      currentLocationId: 'loc_marsh',
    });

    assert.ok(result);
    assert.equal(result.id, 'enc_viper_ambush');
  });

  it('does not trigger a one-shot encounter if already completed', () => {
    const state = createMockPlayerState({
      currentLocationId: 'loc_marsh',
      completedEncounterIds: ['enc_viper_ambush'],
    });
    const result = evaluateCandidateEncounters({
      encounters: [viperEncounter],
      playerState: state,
      currentLocationId: 'loc_marsh',
    });

    assert.equal(result, null);
  });

  describe('Item Trigger Conditions', () => {
    const relicEncounter: StoryEncounter = {
      id: 'enc_relic_resonance',
      title: 'پژواک سنگ کهن',
      narrativeText: 'سنگ بلورین درون کوله‌پشتی‌ات شروع به تابیدن می‌کند...',
      locationTags: [],
      triggerConditions: {
        triggerType: 'item_trigger',
        weight: 90,
        repeatable: false,
        requiredItemIds: ['item_ancient_stone'],
        requiredCompletedEventIds: [],
        forbiddenEventIds: [],
      },
    };

    it('fails to trigger if player lacks the required item', () => {
      const state = createMockPlayerState({ inventory: [] });
      const result = evaluateCandidateEncounters({
        encounters: [relicEncounter],
        playerState: state,
        currentLocationId: 'loc_marsh',
      });
      assert.equal(result, null);
    });

    it('triggers successfully when player possesses the required item', () => {
      const state = createMockPlayerState({
        inventory: [{ id: 'item_ancient_stone', name: 'سنگ باستانی', quantity: 1, type: 'relic', description: 'Old stone' }],
      });
      const result = evaluateCandidateEncounters({
        encounters: [relicEncounter],
        playerState: state,
        currentLocationId: 'loc_marsh',
      });
      assert.ok(result);
      assert.equal(result.id, 'enc_relic_resonance');
    });
  });

  describe('Quest Conditions', () => {
    const questEncounter: StoryEncounter = {
      id: 'enc_patrol_encounter',
      title: 'ساربانان مظنون',
      narrativeText: 'ساربانان مسلح مسیر را مسدود کرده‌اند...',
      locationTags: [],
      triggerConditions: {
        triggerType: 'on_explore',
        weight: 70,
        repeatable: false,
        requiredQuestId: 'quest_infiltrate_bridge',
        requiredQuestStatus: 'active',
        requiredItemIds: [],
        requiredCompletedEventIds: [],
        forbiddenEventIds: [],
      },
    };

    it('does not trigger if the quest is not active', () => {
      const state = createMockPlayerState({ activeQuestIds: [] });
      const result = evaluateCandidateEncounters({
        encounters: [questEncounter],
        playerState: state,
        currentLocationId: 'loc_marsh',
      });
      assert.equal(result, null);
    });

    it('triggers when the quest is active', () => {
      const state = createMockPlayerState({ activeQuestIds: ['quest_infiltrate_bridge'] });
      const result = evaluateCandidateEncounters({
        encounters: [questEncounter],
        playerState: state,
        currentLocationId: 'loc_marsh',
      });
      assert.ok(result);
      assert.equal(result.id, 'enc_patrol_encounter');
    });
  });

  describe('Event Chaining (End of an event triggers another)', () => {
    const chainedNestEncounter: StoryEncounter = {
      id: 'enc_serpent_nest',
      title: 'کشف لانه افعی‌های باستانی',
      narrativeText: 'رد خون افعی شکست‌خورده تو را به دهانه سوراخی تاریک در پایاب پل هدایت می‌کند...',
      locationTags: [],
      triggerConditions: {
        triggerType: 'event_chain',
        weight: 100,
        repeatable: false,
        triggerAfterEventId: 'enc_viper_ambush',
        requiredItemIds: [],
        requiredCompletedEventIds: [],
        forbiddenEventIds: [],
      },
    };

    it('does not trigger before the parent encounter has completed', () => {
      const state = createMockPlayerState({ completedEncounterIds: [] });
      const result = evaluateCandidateEncounters({
        encounters: [chainedNestEncounter],
        playerState: state,
        currentLocationId: 'loc_marsh',
      });
      assert.equal(result, null);
    });

    it('immediately triggers as a direct cascade when parent event just completed', () => {
      const state = createMockPlayerState({ completedEncounterIds: ['enc_viper_ambush'] });
      const result = evaluateCandidateEncounters({
        encounters: [chainedNestEncounter],
        playerState: state,
        currentLocationId: 'loc_marsh',
        lastCompletedEventId: 'enc_viper_ambush',
      });
      assert.ok(result);
      assert.equal(result.id, 'enc_serpent_nest');
    });
  });

  describe('resolveTurnEncounter & settlePendingEncounterRewards', () => {
    it('triggers on_enter at an intermediate waypoint during active caravan travel and honors minTensionClock: 2', () => {
      const waypointEnter: StoryEncounter = {
        id: 'enc_waypoint_enter',
        title: 'Waypoint Gate',
        narrativeText: 'Arrival at rabat cistern.',
        locationId: 'loc_rabat',
        locationTags: [],
        triggerConditions: {
          triggerType: 'on_enter',
          weight: 95,
          repeatable: false,
          requiredItemIds: [],
          requiredCompletedEventIds: [],
          forbiddenEventIds: [],
        },
      };
      const clockEscalation: StoryEncounter = {
        id: 'enc_dust_squall',
        title: 'Dust Squall',
        narrativeText: 'Storm breaks out.',
        locationId: 'loc_desert',
        locationTags: [],
        triggerConditions: {
          triggerType: 'threat_escalation',
          weight: 90,
          minTensionClock: 2,
          repeatable: false,
          requiredItemIds: [],
          requiredCompletedEventIds: [],
          forbiddenEventIds: [],
        },
      };
      const wb = {
        locations: [
          { id: 'loc_origin', name: 'Well', parentLocationId: 'loc_desert' },
          { id: 'loc_rabat', name: 'Rabat', parentLocationId: 'loc_desert' },
          { id: 'loc_desert', name: 'Desert' },
        ],
        tradeRoutes: [],
        artifacts: [
          { id: 'art_tally', name: 'Water Tally', rarity: 'common', nonEquippable: true, description: 'Brass tally.' },
        ],
      } as unknown as WorldBible;

      const state = createMockPlayerState({
        currentLocationId: 'loc_rabat',
        travel: {
          originLocationId: 'loc_origin',
          destinationLocationId: 'loc_dest',
          waypointIds: ['loc_rabat'],
          mode: 'caravan',
          departedTurn: 2,
          totalTurns: 3,
        },
      });

      const enc = resolveTurnEncounter({
        authoredEncounters: [clockEscalation, waypointEnter],
        playerState: state,
        worldBible: wb,
        preTurnLocationId: 'loc_origin',
        advanceMovedToId: 'loc_rabat',
      });
      assert.equal(enc?.id, 'enc_waypoint_enter');

      const desertState = createMockPlayerState({
        currentLocationId: 'loc_desert',
        activeTensionClocks: [{ id: 'clock_desert', name: 'Water', currentSegments: 2, maxSegments: 5, crisisDescription: '' }],
        travel: {
          originLocationId: 'loc_origin',
          destinationLocationId: 'loc_dest',
          waypointIds: [],
          mode: 'caravan',
          departedTurn: 2,
          totalTurns: 3,
        },
      });
      const squall = resolveTurnEncounter({
        authoredEncounters: [clockEscalation],
        playerState: desertState,
        worldBible: wb,
        preTurnLocationId: 'loc_desert',
      });
      assert.equal(squall?.id, 'enc_dust_squall');

      const pendingState = createMockPlayerState({
        pendingEncounterRewards: [{ encounterId: 'enc_waypoint_enter', rewardItemIds: ['art_tally'] }],
      });
      assert.equal(settlePendingEncounterRewards(pendingState, wb, 'failure'), null);
      const settled = settlePendingEncounterRewards(pendingState, wb, 'success');
      assert.ok(settled?.itemsAdded?.some((i) => i.id === 'art_tally'));
      assert.deepEqual(settled?.pendingEncounterRewards, []);
    });
  });
});
