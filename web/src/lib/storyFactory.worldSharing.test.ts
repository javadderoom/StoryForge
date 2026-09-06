import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEmptyStoryManifest, getEmptyStoryInWorld } from './storyFactory';
import type { WorldLocation } from './types/world';

describe('Shared World 1:N Stories — storyFactory', () => {
  it('fresh story carries its own new worldId (solo universe by default)', () => {
    const m = getEmptyStoryManifest('en');
    assert.ok(m.id.startsWith('story_'));
    assert.ok(m.worldId && m.worldId.startsWith('world_'));
    assert.equal(m.worldBible.worldId, m.worldId);
  });

  it('second story in the same world links the SAME worldId and inherits lore', () => {
    const first = getEmptyStoryManifest('en');
    first.worldBible.worldName = 'The Obsidian Realm';
    const gate: WorldLocation = {
      id: 'loc_gate',
      name: 'Ashen Gate',
      description: 'A gate.',
      region: 'North',
      dangerLevel: 2,
      connectedLocationIds: [],
      atmosphere: 'Ashen',
    };
    first.worldBible.locations = [gate];

    const second = getEmptyStoryInWorld(
      { worldId: first.worldId!, worldBible: first.worldBible, rpgSystem: first.rpgSystem },
      'en'
    );

    // Same world link — no duplication.
    assert.equal(second.worldId, first.worldId);
    assert.equal(second.worldBible.worldName, 'The Obsidian Realm');
    assert.equal(second.worldBible.locations[0].id, 'loc_gate');

    // Story shell is fresh and independent.
    assert.notEqual(second.id, first.id);
    assert.ok(second.initialStoryBeats.length >= 1);
    assert.equal(second.initialStoryBeats[0].locationId, 'loc_gate');
    assert.equal(second.published, false);
  });

  it('stories in different worlds stay isolated', () => {
    const a = getEmptyStoryManifest('en');
    const b = getEmptyStoryManifest('en');
    assert.notEqual(a.worldId, b.worldId);
  });
});
