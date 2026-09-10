import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { artifactToGameItem } from './artifactItems';
import type { WorldArtifact } from '@/lib/types/world';

function makeArtifact(partial: Partial<WorldArtifact>): WorldArtifact {
  return {
    id: 'art_test',
    name: 'Test Relic',
    title: 'The Test',
    originEra: 'Age of Tests',
    rarity: 'rare',
    description: 'A test artifact.',
    powers: [],
    currentHolderType: 'vault',
    currentHolderId: '',
    ...partial,
  };
}

describe('artifactToGameItem', () => {
  it('maps a two-handed weapon slot to a two_handed weapon GameItem', () => {
    const item = artifactToGameItem(
      makeArtifact({
        id: 'art_greatsword',
        name: 'Greatsword of Valoria',
        slot: 'two_handed',
        statModifiers: { might: 2 },
      })
    );

    assert.equal(item.id, 'art_greatsword');
    assert.equal(item.type, 'weapon');
    assert.equal(item.grip, 'two_handed');
    assert.equal(item.quantity, 1);
    assert.deepEqual(item.statModifiers, { might: 2 });
  });

  it('maps an off_hand shield to a non-two-handed off-hand shield GameItem', () => {
    const item = artifactToGameItem(
      makeArtifact({
        id: 'art_buckler',
        name: 'Ashwood Buckler',
        slot: 'shield',
      })
    );

    assert.equal(item.type, 'shield');
    assert.equal(item.grip, 'off_hand_only');
  });

  it('maps relic/armor slots to matching GameItem types', () => {
    const relic = artifactToGameItem(makeArtifact({ slot: 'relic' }));
    const armor = artifactToGameItem(makeArtifact({ slot: 'armor' }));
    assert.equal(relic.type, 'relic');
    assert.equal(armor.type, 'armor');
  });

  it('defaults an artifact without a slot to a relic', () => {
    const item = artifactToGameItem(makeArtifact({ slot: undefined }));
    assert.equal(item.type, 'relic');
  });

  it('folds mythic rarity down to legendary (GameItem has no mythic tier)', () => {
    const item = artifactToGameItem(makeArtifact({ rarity: 'mythic' }));
    assert.equal(item.rarity, 'legendary');
  });

  it('appends curseOrCost to the description so the cost of wielding is visible', () => {
    const item = artifactToGameItem(
      makeArtifact({ description: 'Bright blade.', curseOrCost: 'Drains 1 HP per dawn.' })
    );
    assert.match(item.description, /Bright blade\./);
    assert.match(item.description, /Drains 1 HP per dawn\./);
  });

  it('preserves startsQuestId and nonEquippable plot-token flags', () => {
    const item = artifactToGameItem(
      makeArtifact({
        slot: 'relic',
        startsQuestId: 'quest_sigil',
        nonEquippable: true,
      })
    );
    assert.equal(item.startsQuestId, 'quest_sigil');
    assert.equal(item.nonEquippable, true);
  });
});