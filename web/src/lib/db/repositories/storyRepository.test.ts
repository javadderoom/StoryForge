import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StoryRepository } from './storyRepository';
import { SessionRepository } from './sessionRepository';
import { PlaythroughSession, PlayerState } from '@/lib/types/gameplay';
import { getEmptyStoryManifest } from '../../storyFactory';

describe('StoryForge Database Repositories', () => {
  const isDbActive = process.env.ENABLE_DB === 'true';

  it('should save and retrieve a story by ID with WorldBible and RpgSystem', async (t) => {
    if (!isDbActive) {
      t.skip('Database tests skipped because ENABLE_DB is not true');
      return;
    }
    const manifest = getEmptyStoryManifest('en');
    await StoryRepository.saveStory(manifest);

    const fetched = await StoryRepository.getStoryById(manifest.id);
    assert.ok(fetched, 'Saved story should be retrievable by ID');
    assert.strictEqual(fetched?.id, manifest.id);
    assert.ok(fetched?.worldBible.laws.length >= 0, 'WorldBible should be present');
    assert.ok(fetched?.rpgSystem.stats.length > 0, 'RpgSystem stats should be populated');

    // Cleanup
    await StoryRepository.deleteStory(manifest.id);
  });

  it('should return null for a non-existent story', async () => {
    const manifest = await StoryRepository.getStoryById('does_not_exist_12345');
    assert.strictEqual(manifest, null);
  });

  it('should distinguish published from draft stories in getAllStories', async (t) => {
    if (!isDbActive) {
      t.skip('Database tests skipped because ENABLE_DB is not true');
      return;
    }
    const draft = getEmptyStoryManifest('fa');
    draft.published = false;
    await StoryRepository.saveStory(draft);

    const all = await StoryRepository.getAllStories();
    assert.ok(all.some((s) => s.id === draft.id), 'Draft should appear in unfiltered list');

    const publishedOnly = await StoryRepository.getAllStories(true);
    assert.ok(
      !publishedOnly.some((s) => s.id === draft.id),
      'Draft should NOT appear in published-only list'
    );

    // Cleanup
    await StoryRepository.deleteStory(draft.id);
  });


  it('should persist playthrough session and record turns', async () => {
    const story = getEmptyStoryManifest('en');
    await StoryRepository.saveStory(story);

    const testSessionId = `test_sess_${Date.now()}`;
    const mockPlayerState: PlayerState = {
      stats: { might: 12, agility: 14, cunning: 10, arcana: 8 },
      resources: { hp: 100, stamina: 50, gold: 30 },
      inventory: [],
      equipment: {},
      discoveredLocationIds: ['loc_dungeon_cell'],
      relationships: {},
      activeQuestIds: ['quest_test'],
      completedQuestIds: [],
      currentLocationId: 'loc_dungeon_cell',
    };

    const session: PlaythroughSession = {
      sessionId: testSessionId,
      userId: 'test_player',
      storyId: story.id,
      currentSceneId: 'scene_prologue',
      turnCount: 1,
      playerState: mockPlayerState,
      history: [
        {
          turnNumber: 1,
          sceneId: 'scene_prologue',
          playerActionText: 'Awakening in the dark',
          actionStyle: 'tactical',
          narrativeProse: 'The cold stones press against your back...',
          presentedChoices: [],
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 1. Create Session
    const created = await SessionRepository.createSession(session);
    assert.ok(created, 'Session should be created in DB');

    // 2. Fetch Session
    const fetched = await SessionRepository.getSession(testSessionId);
    assert.ok(fetched, 'Fetched session should not be null');
    assert.strictEqual(fetched?.sessionId, testSessionId);
    assert.strictEqual(fetched?.turns.length, 1);

    // 3. Record a Turn
    const recordedTurn = await SessionRepository.recordTurn({
      sessionId: testSessionId,
      beat: {
        turnNumber: 2,
        sceneId: 'scene_cell_door',
        playerActionText: 'Search the bench',
        actionStyle: 'tactical',
        narrativeProse: 'Under the bench, you find a rusty iron nail.',
        presentedChoices: [],
        timestamp: Date.now(),
      },
      updatedPlayerState: {
        ...mockPlayerState,
        inventory: [
          {
            id: 'iron_nail',
            name: 'Iron Nail',
            type: 'quest_item',
            description: 'A sharp rusty nail',
            quantity: 1,
          },
        ],
      },
      memories: [
        {
          category: 'player',
          importance: 7,
          summary: 'Player found an iron nail under the prison bench',
        },
      ],
    });

    assert.ok(recordedTurn, 'Turn should be recorded');
    assert.strictEqual(recordedTurn?.turnNumber, 2);

    // 4. Verify updated session state
    const updatedSession = await SessionRepository.getSession(testSessionId);
    assert.strictEqual(updatedSession?.turns.length, 2);
    assert.strictEqual(updatedSession?.memories.length, 1);

    // Cleanup
    await StoryRepository.deleteStory(story.id);
  });
});
