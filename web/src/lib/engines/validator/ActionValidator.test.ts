import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ActionValidator } from './ActionValidator';
import { PlayerState } from '../../types/gameplay';
import { WorldBible } from '../../types/world';
import { RPGSystemSchema } from '../../types/rpg';

describe('ActionValidator - Lore & Inventory Guardrails', () => {
  const sampleWorldBible: WorldBible = {
    worldId: 'world_valoria',
    worldName: 'Valoria',
    summary: 'A dark realm',
    themeNotes: 'Gritty',
    laws: [
      {
        id: 'law_arcane_discipline',
        rule: 'Magic cannot be freely cast without the proper arcane discipline.',
        description: 'Uninitiated mortals cannot cast spells.',
        category: 'magic',
        isImmutable: true,
      },
    ],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
  };

  const sampleRpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [{ id: 'might', name: 'Might', description: '', baseValue: 12 }],
    resources: [],
    skills: [],
    startingInventory: [],
    inventoryCapacity: 10,
  };

  const samplePlayerState: PlayerState = {
    stats: { might: 12 },
    resources: {},
    inventory: [
      { id: 'iron_key', name: 'Iron Key', description: '', type: 'quest_item', quantity: 1 },
    ],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_cell',
  };




  it('rejects using specific items not present in inventory', () => {
    const res = ActionValidator.validateAction(
      'I unlock with the golden skeleton key',
      samplePlayerState,
      sampleWorldBible,
      sampleRpgSystem
    );
    assert.equal(res.isValid, false);
    assert.ok(res.rejectionReason?.includes('inventory'));
  });

  it('accepts valid plausible actions using existing items', () => {
    const res = ActionValidator.validateAction(
      'I unlock with the iron key',
      samplePlayerState,
      sampleWorldBible,
      sampleRpgSystem
    );
    assert.equal(res.isValid, true);
  });

  it('accepts standard physical maneuvers', () => {
    const res = ActionValidator.validateAction(
      'I duck behind the stone bench and draw my knife',
      samplePlayerState,
      sampleWorldBible,
      sampleRpgSystem
    );
    assert.equal(res.isValid, true);
    assert.equal(res.normalizedAction, 'I duck behind the stone bench and draw my knife');
  });
});

describe('ActionValidator - Knowledge Boundary Guardrail', () => {
  const worldBible: WorldBible = {
    worldId: 'world_valoria',
    worldName: 'Valoria',
    summary: 'A dark realm',
    themeNotes: 'Gritty',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [
      {
        id: 'npc_baroness',
        name: 'Baroness Vey',
        title: 'Ruler',
        currentLocationId: 'loc_court',
        personalityTraits: ['cunning'],
        speechStyle: 'Speaks softly',
        goals: ['Hold power'],
        secrets: [
          {
            id: 'secret_poison',
            description: 'The baroness poisoned the royal wine to seize the throne.',
            requiredTrustLevel: 80,
            revealed: false,
          },
        ],
        initialTrust: 0,
      },
    ],
  };

  const rpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [{ id: 'might', name: 'Might', description: '', baseValue: 12 }],
    resources: [],
    skills: [],
    startingInventory: [],
    inventoryCapacity: 10,
  };

  const playerState: PlayerState = {
    stats: { might: 12 },
    resources: {},
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {}, // baroness secret not discovered
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_court',
  };

  it('blocks actions that rely on an undiscovered NPC secret', () => {
    const res = ActionValidator.validateAction(
      'I confront the baroness about how she poisoned the royal wine',
      playerState,
      worldBible,
      rpgSystem
    );
    assert.equal(res.isValid, false);
    assert.equal(res.isGuardrailViolation, true);
    assert.ok(res.rejectionReason?.toLowerCase().includes('secret'));
  });

  it('allows the same action once the secret is discovered', () => {
    const discovered: PlayerState = {
      ...playerState,
      relationships: { npc_baroness: { trust: 85, knownSecrets: ['secret_poison'], notes: [] } },
    };
    const res = ActionValidator.validateAction(
      'I confront the baroness about how she poisoned the royal wine',
      discovered,
      worldBible,
      rpgSystem
    );
    assert.equal(res.isValid, true);
  });

  it('does not flag overlapping terms when the NPC is not named (Plan 08 precision)', () => {
    const res = ActionValidator.validateAction(
      'I examine the poisoned royal wine bottle on the table',
      playerState,
      worldBible,
      rpgSystem
    );
    assert.equal(res.isValid, true);
  });
});

describe('Plan 08 - World Lore Guardrails (Check 3)', () => {
  const rpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    stats: [{ id: 'might', name: 'Might', description: '', baseValue: 12 }],
    resources: [],
    skills: [],
    startingInventory: [],
    inventoryCapacity: 10,
  };

  const basePlayer: PlayerState = {
    stats: { might: 12 },
    resources: {},
    inventory: [{ id: 'iron_key', name: 'Iron Key', description: '', type: 'quest_item', quantity: 1 }],
    equipment: {},
    discoveredLocationIds: ['loc_alley'],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_alley',
  };

  it('rejects summoning creatures declared extinct by an immutable law', () => {
    const world: WorldBible = {
      worldId: 'w1',
      worldName: 'W',
      summary: 's',
      themeNotes: 't',
      laws: [
        {
          id: 'law_dragons',
          rule: 'Dragons have been extinct for three hundred years.',
          description: 'None remain anywhere in the realm.',
          category: 'creatures',
          isImmutable: true,
        },
      ],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [],
      bestiary: [
        {
          id: 'cre_dragon',
          name: 'Dragon',
          speciesCategory: 'draconic',
          dangerLevel: 5,
          habitatLocationIds: [],
          behavioralTactics: '',
          weaknesses: [],
          resistances: [],
          harvestableLoot: [],
          loreDescription: '',
        },
      ],
    };

    const res = ActionValidator.validateAction(
      'I summon a dragon to burn down the gates',
      basePlayer,
      world,
      rpgSystem
    );
    assert.equal(res.isValid, false);
    assert.ok(res.rejectionReason?.toLowerCase().includes('extinct'));
  });

  it('rejects claiming a world artifact the player does not possess', () => {
    const world: WorldBible = {
      worldId: 'w2',
      worldName: 'W',
      summary: 's',
      themeNotes: 't',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [],
      artifacts: [
        {
          id: 'art_ledger',
          name: 'Sealed Ledger',
          title: '',
          originEra: '',
          rarity: 'rare',
          description: '',
          powers: [],
          currentHolderType: 'location',
          currentHolderId: 'loc_vault',
        },
      ],
    };

    const reject = ActionValidator.validateAction(
      'I brandish the Sealed Ledger before the court',
      basePlayer,
      world,
      rpgSystem
    );
    assert.equal(reject.isValid, false);
    assert.ok(reject.rejectionReason?.includes('Sealed Ledger'));

    const owner: PlayerState = {
      ...basePlayer,
      inventory: [...basePlayer.inventory, { id: 'art_ledger', name: 'Sealed Ledger', description: '', type: 'quest_item', quantity: 1 }],
    };
    const accept = ActionValidator.validateAction(
      'I brandish the Sealed Ledger before the court',
      owner,
      world,
      rpgSystem
    );
    assert.equal(accept.isValid, true);
  });

  it('enforces movement plausibility against the location graph', () => {
    const world: WorldBible = {
      worldId: 'w3',
      worldName: 'W',
      summary: 's',
      themeNotes: 't',
      laws: [],
      factions: [],
      locations: [
        {
          id: 'loc_alley',
          name: 'Rat Alley',
          region: 'q',
          description: '',
          dangerLevel: 2,
          connectedLocationIds: ['loc_hall'],
          atmosphere: '',
        },
        {
          id: 'loc_hall',
          name: 'Guild Hall',
          region: 'q',
          description: '',
          dangerLevel: 3,
          connectedLocationIds: ['loc_alley'],
          atmosphere: '',
        },
        {
          id: 'loc_capital',
          name: 'Imperial Capital',
          region: 'far',
          description: '',
          dangerLevel: 4,
          connectedLocationIds: [],
          atmosphere: '',
        },
      ],
      timeline: [],
      npcs: [],
    };

    const unreachable = ActionValidator.validateAction(
      'I travel to the Imperial Capital immediately',
      basePlayer,
      world,
      rpgSystem
    );
    assert.equal(unreachable.isValid, false);
    assert.ok(unreachable.rejectionReason?.includes('not directly reachable'));

    const reachable = ActionValidator.validateAction(
      'I walk over to the Guild Hall',
      basePlayer,
      world,
      rpgSystem
    );
    assert.equal(reachable.isValid, true);
  });
});
