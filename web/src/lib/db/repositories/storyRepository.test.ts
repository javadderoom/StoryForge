import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StoryRepository } from './storyRepository';
import { SessionRepository } from './sessionRepository';
import { PlaythroughSession, PlayerState } from '@/lib/types/gameplay';

describe('StoryForge Database Repositories', () => {
  it('should retrieve seeded stories from database', async () => {
    const stories = await StoryRepository.getAllStories();
    assert.ok(stories.length >= 2, 'Should have at least 2 seeded stories');

    const ghale = stories.find((s) => s.id === 'ghale_siahsang');
    assert.ok(ghale, 'ghale_siahsang story should exist');
    assert.strictEqual(ghale.language, 'fa');

    const citadel = stories.find((s) => s.id === 'obsidian_citadel');
    assert.ok(citadel, 'obsidian_citadel story should exist');
    assert.strictEqual(citadel.language, 'en');
  });

  it('should retrieve full StoryManifest by ID with WorldBible and RpgSystem', async () => {
    const manifest = await StoryRepository.getStoryById('ghale_siahsang');
    assert.strictEqual(manifest.id, 'ghale_siahsang');
    assert.ok(manifest.worldBible.laws.length > 0, 'WorldBible laws should be populated');
    assert.ok(manifest.rpgSystem.stats.length > 0, 'RpgSystem stats should be populated');
  });

  it('should persist playthrough session and record turns', async () => {
    const testSessionId = `test_sess_${Date.now()}`;
    const mockPlayerState: PlayerState = {
      stats: { might: 12, agility: 14, cunning: 10, arcana: 8 },
      resources: { hp: 100, stamina: 50, gold: 30 },
      inventory: [],
      discoveredLocationIds: ['loc_dungeon_cell'],
      relationships: {},
      activeQuestIds: ['quest_test'],
      completedQuestIds: [],
      currentLocationId: 'loc_dungeon_cell',
    };

    const session: PlaythroughSession = {
      sessionId: testSessionId,
      userId: 'test_player',
      storyId: 'ghale_siahsang',
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
  });
});
