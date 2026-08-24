import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StoryRepository } from './storyRepository';

describe('StoryRepository — Selective Queries & Partial Updates', () => {
  it('exposes granular getter methods for all 10 lore domains', () => {
    assert.equal(typeof StoryRepository.getWorldBible, 'function');
    assert.equal(typeof StoryRepository.getBestiary, 'function');
    assert.equal(typeof StoryRepository.getArtifacts, 'function');
    assert.equal(typeof StoryRepository.getTimeline, 'function');
    assert.equal(typeof StoryRepository.getNpcs, 'function');
    assert.equal(typeof StoryRepository.getReligions, 'function');
    assert.equal(typeof StoryRepository.getLocations, 'function');
    assert.equal(typeof StoryRepository.getFactions, 'function');
    assert.equal(typeof StoryRepository.getLaws, 'function');
    assert.equal(typeof StoryRepository.getDramaBonds, 'function');
    assert.equal(typeof StoryRepository.getOntology, 'function');
  });

  it('exposes partial atomic updater method updateLoreCollection', () => {
    assert.equal(typeof StoryRepository.updateLoreCollection, 'function');
  });

  it('returns empty array / mock response when database is in mock mode', async () => {
    const bestiary = await StoryRepository.getBestiary('story_mock_123');
    assert.ok(Array.isArray(bestiary));

    const artifacts = await StoryRepository.getArtifacts('story_mock_123');
    assert.ok(Array.isArray(artifacts));

    const timeline = await StoryRepository.getTimeline('story_mock_123');
    assert.ok(Array.isArray(timeline));

    const npcs = await StoryRepository.getNpcs('story_mock_123');
    assert.ok(Array.isArray(npcs));

    const religions = await StoryRepository.getReligions('story_mock_123');
    assert.ok(Array.isArray(religions));

    const locations = await StoryRepository.getLocations('story_mock_123');
    assert.ok(Array.isArray(locations));

    const factions = await StoryRepository.getFactions('story_mock_123');
    assert.ok(Array.isArray(factions));

    const laws = await StoryRepository.getLaws('story_mock_123');
    assert.ok(Array.isArray(laws));

    const dramaBonds = await StoryRepository.getDramaBonds('story_mock_123');
    assert.ok(Array.isArray(dramaBonds));

    const result = await StoryRepository.updateLoreCollection('story_mock_123', 'bestiary', []);
    assert.equal(result.success, true);
  });
});
