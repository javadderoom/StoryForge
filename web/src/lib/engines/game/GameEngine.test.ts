import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './GameEngine';
import { PlayerState } from '../../types/gameplay';
import { RPGSystemSchema } from '../../types/rpg';
import { WorldBible, NPCDossier } from '../../types/world';

describe('GameEngine - Deterministic Mechanics & Math', () => {
  const sampleRpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [
      { id: 'might', name: 'Might', description: 'Strength', baseValue: 10 },
      { id: 'agility', name: 'Agility', description: 'Speed', baseValue: 10 },
      { id: 'cunning', name: 'Cunning', description: 'Wit', baseValue: 10 },
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
    it('calculates correct D20 modifiers for various stat levels with default baseValue 10', () => {
      assert.equal(GameEngine.getStatModifier(10), 0);
      assert.equal(GameEngine.getStatModifier(11), 0);
      assert.equal(GameEngine.getStatModifier(12), 1);
      assert.equal(GameEngine.getStatModifier(14), 2);
      assert.equal(GameEngine.getStatModifier(18), 4);
      assert.equal(GameEngine.getStatModifier(8), -1);
      assert.equal(GameEngine.getStatModifier(6), -2);
    });

    it('calculates correct modifiers dynamically when custom baseValue is provided', () => {
      // 1-10 attribute system where baseValue is 3
      assert.equal(GameEngine.getStatModifier(3, 3), 0);
      assert.equal(GameEngine.getStatModifier(4, 3), 0);
      assert.equal(GameEngine.getStatModifier(5, 3), 1);
      assert.equal(GameEngine.getStatModifier(7, 3), 2);
      assert.equal(GameEngine.getStatModifier(2, 3), -1);
      assert.equal(GameEngine.getStatModifier(1, 3), -1);

      // System with baseValue 5
      assert.equal(GameEngine.getStatModifier(5, 5), 0);
      assert.equal(GameEngine.getStatModifier(7, 5), 1);
      assert.equal(GameEngine.getStatModifier(3, 5), -1);
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
        'Engage in sword duel',
        initialPlayerState,
        sampleRpgSystem,
        { statId: 'might', skillId: 'swordsmanship', forcedDiceRoll: 10, targetDC: 12 }
      );
      assert.equal(res.totalScore, 14); // 10 (roll) + 2 (might mod 14-10)/2 + 2 (swordsmanship)
      assert.equal(res.outcome, 'success');
    });

    it('respects custom authored stat baseline without penalizing baseline stats', () => {
      const customRpgSystem: RPGSystemSchema = {
        hasCombat: true,
        diceType: 'd20',
        stats: [
          { id: 'might', name: 'Might', description: '', baseValue: 3, minValue: 1, maxValue: 10 },
          { id: 'agility', name: 'Agility', description: '', baseValue: 3, minValue: 1, maxValue: 10 },
        ],
        resources: [{ id: 'hp', name: 'Health', current: 100, max: 100, min: 0 }],
        skills: [],
        startingInventory: [],
        inventoryCapacity: 10,
      };
      const baselinePlayer: PlayerState = {
        ...initialPlayerState,
        stats: { might: 3, agility: 5 },
      };

      // Stat at baseline 3 -> modifier MUST be 0, NOT -4!
      const resBaseline = GameEngine.resolveActionCheck(
        'Lift the heavy portcullis',
        baselinePlayer,
        customRpgSystem,
        { statId: 'might', forcedDiceRoll: 10, targetDC: 10 }
      );
      assert.equal(resBaseline.statModifier, 0);
      assert.equal(resBaseline.totalScore, 10);
      assert.equal(resBaseline.outcome, 'success');

      // Stat above baseline (5 vs base 3) -> modifier is +1
      const resAbove = GameEngine.resolveActionCheck(
        'Dodge the falling chandelier',
        baselinePlayer,
        customRpgSystem,
        { statId: 'agility', forcedDiceRoll: 10, targetDC: 11 }
      );
      assert.equal(resAbove.statModifier, 1);
      assert.equal(resAbove.totalScore, 11);
      assert.equal(resAbove.outcome, 'success');
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

  describe('Pressure Revelation (coercion vs breaking point)', () => {
    const baroness: NPCDossier = {
      id: 'npc_baroness',
      name: 'Baroness Vey',
      title: 'Baroness',
      currentLocationId: 'loc_court',
      personalityTraits: [],
      speechStyle: 'Cold',
      goals: [],
      secrets: [
        { id: 'secret_debt', description: 'Owes the syndicate a fortune in gambling debts', requiredTrustLevel: 40, revealed: false },
        { id: 'secret_core', description: 'Murdered her own brother to inherit the title', requiredTrustLevel: 95, revealed: false },
      ],
      initialTrust: 0,
      voiceGuide: {
        npcName: 'Baroness Vey',
        speechQuirks: [],
        sampleDialogue: [],
        negotiationVulnerabilities: [],
        psychologicalBreakingPoint: 'Threats to her children',
      },
    };

    it('detects pressure intent in English and Persian, ignoring plain actions', () => {
      assert.equal(GameEngine.isPressureAction('Threaten Baroness Vey until she talks'), true);
      assert.equal(GameEngine.isPressureAction('I interrogate the prisoner about the vault'), true);
      assert.equal(GameEngine.isPressureAction('بارونس را تهدید می‌کنم تا حرف بزند'), true);
      assert.equal(GameEngine.isPressureAction('I persuade Baroness Vey to help us'), false);
      assert.equal(GameEngine.isPressureAction('I attack Baroness Vey with my dagger'), false);
    });

    it('targets the named NPC, or null without pressure or a name', () => {
      assert.equal(
        GameEngine.detectPressureTarget('Threaten Baroness Vey until she talks', [baroness])?.id,
        'npc_baroness'
      );
      assert.equal(GameEngine.detectPressureTarget('Threaten them until someone talks', [baroness]), null);
      assert.equal(GameEngine.detectPressureTarget('I greet Baroness Vey warmly', [baroness]), null);
    });

    it('cracks the lowest-threshold secret on success, costing trust scaled to the -100..100 range', () => {
      const out = GameEngine.applyPressureOutcome('success', baroness);
      assert.equal(out.revealedSecretId, 'secret_debt');
      assert.equal(out.trustDelta, -30);
      assert.ok(out.note.includes('gambling debts'));
      assert.ok(out.note.includes('Threats to her children'));
    });

    it('cuts deeper when the threat targets loved ones', () => {
      const plain = GameEngine.applyPressureOutcome(
        'success',
        baroness,
        [],
        'Threaten Baroness Vey over her debts'
      );
      assert.equal(plain.trustDelta, -30);
      const severe = GameEngine.applyPressureOutcome(
        'success',
        baroness,
        [],
        'Threaten her children unless Baroness Vey talks'
      );
      assert.equal(severe.revealedSecretId, 'secret_debt');
      assert.equal(severe.trustDelta, -40);
      assert.ok(severe.note.includes('never forgive'));
      const severeFa = GameEngine.applyPressureOutcome(
        'critical_failure',
        baroness,
        [],
        'اگر حرف نزنی بچه‌هایت را می‌کشم'
      );
      assert.equal(severeFa.trustDelta, -40);
    });

    it('resists unbreakable core secrets on plain success', () => {
      const coreOnly: NPCDossier = {
        ...baroness,
        secrets: [baroness.secrets![1]],
      };
      const out = GameEngine.applyPressureOutcome('success', coreOnly);
      assert.equal(out.revealedSecretId, undefined);
      assert.equal(out.trustDelta, -15);
    });

    it('cracks anything on critical success', () => {
      const coreOnly: NPCDossier = {
        ...baroness,
        secrets: [baroness.secrets![1]],
      };
      const out = GameEngine.applyPressureOutcome('critical_success', coreOnly);
      assert.equal(out.revealedSecretId, 'secret_core');
      assert.equal(out.trustDelta, -25);
    });

    it('skips already-known secrets and punishes failed pressure', () => {
      const out = GameEngine.applyPressureOutcome('success', baroness, ['secret_debt']);
      assert.equal(out.revealedSecretId, undefined); // only the 95-threshold core remains
      assert.equal(GameEngine.applyPressureOutcome('mixed_success', baroness).trustDelta, -15);
      assert.equal(GameEngine.applyPressureOutcome('failure', baroness).trustDelta, -15);
      assert.equal(GameEngine.applyPressureOutcome('critical_failure', baroness).trustDelta, -30);
      assert.equal(GameEngine.applyPressureOutcome('critical_failure', baroness).revealedSecretId, undefined);
    });

    it('costs trust even when there is nothing left to reveal', () => {
      const bare: NPCDossier = { ...baroness, secrets: [] };
      const out = GameEngine.applyPressureOutcome('success', bare);
      assert.equal(out.revealedSecretId, undefined);
      assert.equal(out.trustDelta, -10);
    });
  });

  describe('Secret reveal methods (trust / pressure / item / ritual / quest / custom)', () => {
    const surgeon: NPCDossier = {
      id: 'npc_surgeon_case',
      name: 'Patient Zero',
      title: 'Patient',
      currentLocationId: 'loc_clinic',
      personalityTraits: [],
      speechStyle: 'Mumbling',
      goals: [],
      secrets: [
        {
          id: 'secret_implant',
          description: 'A syndicate tracking implant is buried behind the left eye',
          requiredTrustLevel: 60,
          revealed: false,
          revealMethods: [
            { kind: 'trust', trustThreshold: 60 },
            { kind: 'ritual', ritual: 'surgery', detail: 'at the clinic, patient sedated' },
          ],
        },
        {
          id: 'secret_cache',
          description: 'Stash coordinates tattooed under the scalp',
          requiredTrustLevel: 30,
          revealed: false,
          revealMethods: [{ kind: 'pressure' }],
        },
      ],
      initialTrust: 0,
    };

    it('labels methods without leaking the secret', () => {
      assert.equal(GameEngine.describeRevealMethod({ kind: 'trust', trustThreshold: 60 }, 60), 'trust 60');
      assert.equal(GameEngine.describeRevealMethod({ kind: 'pressure' }, 30), 'pressure');
      assert.equal(
        GameEngine.describeRevealMethod({ kind: 'ritual', ritual: 'surgery', detail: 'sedated' }, 60),
        'surgery (sedated)'
      );
      assert.equal(
        GameEngine.describeRevealMethod({ kind: 'custom', detail: 'only while sedated' }, 60),
        'only while sedated'
      );
      const summary = GameEngine.describeHiddenSecrets(surgeon);
      assert.ok(summary.startsWith('2 hidden'));
      assert.ok(summary.includes('surgery'));
      assert.ok(!summary.includes('implant'));
    });

    it('gates pressure: surgery-bound secrets do not crack under threats', () => {
      assert.equal(
        GameEngine.isPressureCrackable(surgeon.secrets[0]),
        false
      );
      assert.equal(GameEngine.isPressureCrackable(surgeon.secrets[1]), true);
      assert.equal(GameEngine.isPressureCrackable({}), true); // legacy: no methods
      const out = GameEngine.applyPressureOutcome('success', {
        ...surgeon,
        secrets: [surgeon.secrets[0]],
      });
      assert.equal(out.revealedSecretId, undefined);
      assert.equal(out.trustDelta, -15);
      assert.ok(out.note.includes('surgery'));
    });

    it('checks engine-observable methods and leaves ritual/custom to the narrator', () => {
      assert.equal(
        GameEngine.isRevealMethodSatisfied({ kind: 'trust', trustThreshold: 60 }, 60, { trust: 70 }),
        true
      );
      assert.equal(
        GameEngine.isRevealMethodSatisfied({ kind: 'trust' }, 60, { trust: 10 }),
        false
      );
      assert.equal(
        GameEngine.isRevealMethodSatisfied({ kind: 'item', itemName: 'Surgical Kit' }, 60, {
          inventoryTerms: ['iron_dagger', 'surgical kit'],
        }),
        true
      );
      assert.equal(
        GameEngine.isRevealMethodSatisfied({ kind: 'quest', questId: 'q_probe' }, 60, {
          completedQuestIds: ['q_probe'],
        }),
        true
      );
      assert.equal(
        GameEngine.isRevealMethodSatisfied({ kind: 'ritual', ritual: 'surgery' }, 60, { trust: 100 }),
        false
      );
      assert.equal(
        GameEngine.isRevealMethodSatisfied({ kind: 'pressure' }, 30, { trust: 100 }),
        false
      );
    });

    it('unlocks trust- and quest-bound secrets passively, lowest first', () => {
      const none = GameEngine.findTrustUnlockedSecret(surgeon, 10, [], []);
      assert.equal(none, null);
      const trustHit = GameEngine.findTrustUnlockedSecret(surgeon, 65, [], []);
      assert.equal(trustHit?.id, 'secret_implant');
      const questNpc: NPCDossier = {
        ...surgeon,
        secrets: [
          {
            id: 'secret_oath',
            description: 'Swore a blood oath to the river cult during initiation',
            requiredTrustLevel: 90,
            revealed: false,
            revealMethods: [{ kind: 'quest', questId: 'q_cult' }],
          },
        ],
      };
      assert.equal(GameEngine.findTrustUnlockedSecret(questNpc, 0, [], []), null);
      const questHit = GameEngine.findTrustUnlockedSecret(questNpc, 0, [], ['q_cult']);
      assert.equal(questHit?.id, 'secret_oath');
    });
  });

  describe('Archetype & Character Creation Resolution', () => {
    it('applies archetype stat bonuses and custom point allocations', () => {
      const baseStats = { might: 12, agility: 14, cunning: 10 };
      const shadowbladeBonus = { agility: 2, cunning: 1 };
      
      const combined: Record<string, number> = { ...baseStats };
      for (const [k, v] of Object.entries(shadowbladeBonus)) {
        combined[k] = (combined[k] || 10) + v;
      }

      assert.equal(combined.might, 12);
      assert.equal(combined.agility, 16);
      assert.equal(combined.cunning, 11);
      assert.equal(GameEngine.getStatModifier(combined.agility), 3); // 16 -> +3
    });

    it('ensures two-handed weapons do not allow off-hand equipment', () => {
      const startingEquipment: Record<string, string | undefined> = {
        mainHand: 'greatsword_valoria',
        offHand: 'ashwood_buckler',
      };
      const items = [
        { id: 'greatsword_valoria', grip: 'two_handed' },
        { id: 'ashwood_buckler', grip: 'off_hand_only' },
      ];

      const mainItem = items.find((i) => i.id === startingEquipment.mainHand);
      if (mainItem?.grip === 'two_handed') {
        delete startingEquipment.offHand;
      }

      assert.equal(startingEquipment.mainHand, 'greatsword_valoria');
      assert.equal(startingEquipment.offHand, undefined);
    });
  });
});

describe('Plan 08 - Living World State Ledger derivation', () => {
  const worldBible = {
    worldId: 'w1',
    worldName: 'W',
    summary: 's',
    themeNotes: 't',
    laws: [],
    factions: [
      { id: 'fac_guild', name: 'Iron Guild', description: '', alignment: '', territoryIds: [], rivalFactionIds: [], alliedFactionIds: [], publicGoals: '' },
    ],
    locations: [],
    timeline: [],
    npcs: [
      {
        id: 'npc_bren',
        name: 'Quartermaster Bren',
        title: '',
        role: 'smuggler',
        factionId: 'fac_guild',
        currentLocationId: 'loc_hall',
        personalityTraits: [],
        speechStyle: '',
        goals: [],
        secrets: [],
        initialTrust: 0,
      },
      {
        id: 'npc_lonely',
        name: 'No Faction Ned',
        title: '',
        currentLocationId: 'loc_docks',
        personalityTraits: [],
        speechStyle: '',
        goals: [],
        secrets: [],
        initialTrust: 0,
      },
    ],
    artifacts: [],
    bestiary: [],
    religions: [],
    dramaBonds: [],
  } as WorldBible;

  it('derives faction reputation drift from NPC relationship changes', () => {
    const patch = GameEngine.deriveLedgerPatch(
      { relationshipChanges: { npc_bren: { trustDelta: 30 } } },
      worldBible
    );

    assert.ok(patch.factionReputations?.length === 1);
    assert.equal(patch.factionReputations![0].factionId, 'fac_guild');
    assert.equal(patch.factionReputations![0].score, 30);
    assert.ok(patch.npcStatuses?.some((n) => n.npcId === 'npc_bren'));
  });

  it('flags story-critical item gains as key ledger items', () => {
    const patch = GameEngine.deriveLedgerPatch(
      {
        itemsAdded: [
          { id: 'item_sealed_ledger', name: 'Sealed Ledger', description: 'Proof.', type: 'quest_item', quantity: 1 },
          { id: 'apple', name: 'Apple', description: '', type: 'consumable', quantity: 2 },
        ],
      },
      worldBible
    );

    assert.equal(patch.keyItems?.length, 1);
    assert.equal(patch.keyItems![0].itemId, 'item_sealed_ledger');
  });

  it('merges patches cumulatively and clamps reputation scores', () => {
    const base = GameEngine.mergeLedgerPatch(null, {
      factionReputations: [{ factionId: 'fac_guild', factionName: 'Iron Guild', score: 80, stance: 'friendly' }],
      npcStatuses: [{ npcId: 'npc_bren', npcName: 'Quartermaster Bren', status: 'alive' }],
      keyItems: [{ itemId: 'item_a', name: 'A', isStoryCritical: true }],
    });

    const merged = GameEngine.mergeLedgerPatch(base, {
      factionReputations: [{ factionId: 'fac_guild', factionName: 'Iron Guild', score: 60, stance: 'hostile' }],
      npcStatuses: [{ npcId: 'npc_bren', npcName: 'Quartermaster Bren', status: 'dead' as const, note: 'Slain' }],
      keyItems: [{ itemId: 'item_b', name: 'B', isStoryCritical: false }],
    });

    assert.equal(merged.factionReputations[0].score, 100); // clamped at +100
    assert.equal(merged.factionReputations[0].stance, 'hostile');
    assert.equal(merged.npcStatuses[0].status, 'dead');
    assert.deepEqual(merged.keyItems.map((k) => k.itemId), ['item_a', 'item_b']);
  });
});

// =====================================================================
// Social Trust Detection & Positive Trust Awards (Plan 11)
// =====================================================================
describe('GameEngine - Social Trust Detection', () => {
  const baroness: NPCDossier = {
    id: 'npc_baroness',
    name: 'Baroness Vey',
    role: 'noble',
    personality: 'cunning',
    speechStyle: 'formal',
    initialTrust: 20,
    secrets: [],
  } as unknown as NPCDossier;

  const merchant: NPCDossier = {
    id: 'npc_merchant',
    name: 'Kael the Merchant',
    role: 'merchant',
    personality: 'friendly',
    speechStyle: 'casual',
    initialTrust: 30,
    secrets: [],
  } as unknown as NPCDossier;

  describe('isSocialAction', () => {
    it('detects positive social keywords (EN)', () => {
      assert.equal(GameEngine.isSocialAction('I greet the merchant warmly'), true);
      assert.equal(GameEngine.isSocialAction('Thank Baroness Vey for her help'), true);
      assert.equal(GameEngine.isSocialAction('Offer a gift to the elder'), true);
      assert.equal(GameEngine.isSocialAction('I help the injured guard'), true);
    });

    it('detects positive social keywords (FA)', () => {
      assert.equal(GameEngine.isSocialAction('سلام و تشکر از بارونس'), true);
      assert.equal(GameEngine.isSocialAction('هدیه دادن به تاجر'), true);
    });

    it('rejects non-social actions', () => {
      assert.equal(GameEngine.isSocialAction('I attack the guard'), false);
      assert.equal(GameEngine.isSocialAction('Search the room for traps'), false);
    });

    it('pressure overrides social (mutually exclusive)', () => {
      // "threaten" is pressure, even if "help" is also present
      assert.equal(GameEngine.isSocialAction('Threaten to help nobody'), false);
    });
  });

  describe('detectSocialTarget', () => {
    it('finds named NPC in social action', () => {
      assert.equal(
        GameEngine.detectSocialTarget('Greet Baroness Vey warmly', [baroness, merchant])?.id,
        'npc_baroness'
      );
    });

    it('returns null for social action without named NPC', () => {
      assert.equal(
        GameEngine.detectSocialTarget('Greet the stranger warmly', [baroness, merchant]),
        null
      );
    });

    it('returns null for non-social action even with NPC name', () => {
      assert.equal(
        GameEngine.detectSocialTarget('Attack Baroness Vey', [baroness, merchant]),
        null
      );
    });
  });

  describe('applySocialOutcome', () => {
    it('awards maximum trust on critical success', () => {
      const result = GameEngine.applySocialOutcome('critical_success', 'diplomatic');
      assert.equal(result.trustDelta, 17); // 15 + 2 diplomatic bonus
    });

    it('awards standard trust on success', () => {
      const result = GameEngine.applySocialOutcome('success', 'aggressive');
      assert.equal(result.trustDelta, 8); // no diplomatic bonus
    });

    it('awards small trust on failure (tried)', () => {
      const result = GameEngine.applySocialOutcome('failure', 'diplomatic');
      assert.equal(result.trustDelta, 2); // no bonus on failure
    });

    it('penalizes on critical failure', () => {
      const result = GameEngine.applySocialOutcome('critical_failure', 'diplomatic');
      assert.equal(result.trustDelta, -3);
    });
  });
});

// =====================================================================
// Option C Hybrid Defeat System
// =====================================================================
describe('GameEngine - Hybrid Defeat System', () => {
  const rpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [
      { id: 'might', name: 'Might', description: 'Strength', baseValue: 10 },
      { id: 'agility', name: 'Agility', description: 'Speed', baseValue: 10 },
    ],
    resources: [
      { id: 'hp', name: 'Health', current: 100, max: 100, min: 0 },
      { id: 'gold', name: 'Gold', current: 200, max: 9999, min: 0 },
    ],
    skills: [],
    startingInventory: [],
    inventoryCapacity: 10,
  };

  const baseState: PlayerState = {
    stats: { might: 14, agility: 12 },
    resources: { hp: 0, gold: 200 },
    inventory: [
      { id: 'sword', name: 'Iron Sword', type: 'weapon', quantity: 1, description: '' },
      { id: 'quest_scroll', name: 'Sacred Scroll', type: 'quest_item', quantity: 1, description: '' },
    ],
    equipment: {},
    discoveredLocationIds: ['loc_village', 'loc_dungeon'],
    relationships: {
      npc_rolan: { trust: 30, knownSecrets: [], notes: [] },
      npc_mira: { trust: 50, knownSecrets: [], notes: [] },
    },
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_dungeon',
    defeatCount: 0,
  };

  it('1st defeat: 50% gold loss, revive at 25% HP, trust -5, relocation', () => {
    const { diff, defeatCount, narrativeHint } = GameEngine.resolveDefeat(baseState, rpgSystem);

    assert.equal(defeatCount, 1);
    assert.equal(diff.resourceChanges!['gold'], -100); // 50% of 200
    assert.equal(diff.resourceChanges!['hp'], 25); // 25% of 100 - 0 current
    assert.equal(diff.locationChange, 'loc_village'); // first discovered location
    assert.equal(diff.relationshipChanges!['npc_rolan'].trustDelta, -5);
    assert.equal(diff.relationshipChanges!['npc_mira'].trustDelta, -5);
    assert.ok(!diff.itemsRemovedIds); // no item loss on 1st defeat
    assert.ok(!diff.statChanges); // no stat penalty on 1st defeat
    assert.ok(narrativeHint.includes('DEFEAT'));
    assert.ok(narrativeHint.includes('1st'));
  });

  it('2nd defeat: also loses a random non-quest item', () => {
    const state2 = { ...baseState, defeatCount: 1 };
    const { diff, defeatCount } = GameEngine.resolveDefeat(state2, rpgSystem);

    assert.equal(defeatCount, 2);
    // Should remove a non-quest item (only 'sword' is eligible)
    assert.ok(diff.itemsRemovedIds);
    assert.equal(diff.itemsRemovedIds!.length, 1);
    assert.equal(diff.itemsRemovedIds![0], 'sword'); // quest_scroll is protected
    assert.ok(!diff.statChanges); // no stat penalty on 2nd defeat
  });

  it('3rd+ defeat: also applies permanent stat penalty', () => {
    const state3 = { ...baseState, defeatCount: 2 };
    const { diff, defeatCount, narrativeHint } = GameEngine.resolveDefeat(state3, rpgSystem, 'might');

    assert.equal(defeatCount, 3);
    assert.ok(diff.statChanges);
    assert.equal(diff.statChanges!['might'], -1); // -1 to the checked stat
    assert.ok(narrativeHint.includes('Permanent scar'));
  });

  it('quest items are never lost', () => {
    // Only quest_scroll in inventory — should not be removable
    const questOnlyState: PlayerState = {
      ...baseState,
      inventory: [{ id: 'quest_scroll', name: 'Sacred Scroll', type: 'quest_item', quantity: 1, description: '' }],
      defeatCount: 1,
    };
    const { diff } = GameEngine.resolveDefeat(questOnlyState, rpgSystem);
    assert.ok(!diff.itemsRemovedIds || diff.itemsRemovedIds.length === 0);
  });
});
