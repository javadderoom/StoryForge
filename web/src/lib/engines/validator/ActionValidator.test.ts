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
        id: 'law_dragons_extinct',
        rule: 'Dragons became extinct 300 years ago.',
        description: '',
        category: 'creatures',
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
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_cell',
  };

  it('rejects actions that violate immutable world laws (e.g. summoning extinct dragons)', () => {
    const res = ActionValidator.validateAction(
      'I summon my pet dragon to melt the bars',
      samplePlayerState,
      sampleWorldBible,
      sampleRpgSystem
    );
    assert.equal(res.isValid, false);
    assert.equal(res.violatesLawId, 'law_dragons_extinct');
    assert.ok(res.rejectionReason?.includes('extinct'));
  });

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
