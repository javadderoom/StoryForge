import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { PlaythroughSession, PlayerState } from '@/lib/types/gameplay';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const storyId = body.storyId || 'ghale_siahsang';
    const story = await StoryRepository.getStoryById(storyId);

    // Initialize player state from story RPG definitions
    const initialStats: Record<string, number> = {};
    for (const stat of story.rpgSystem.stats) {
      initialStats[stat.id] = stat.baseValue;
    }

    const initialResources: Record<string, number> = {};
    for (const res of story.rpgSystem.resources) {
      initialResources[res.id] = res.current;
    }

    const initialRelationships: Record<string, any> = {};
    for (const npc of story.worldBible.npcs) {
      initialRelationships[npc.id] = {
        trust: npc.initialTrust,
        knownSecrets: [],
        notes: [],
      };
    }

    const initialBeat = story.initialStoryBeats[0] || {
      sceneId: 'scene_start',
      locationId: 'loc_start',
      narrativeText: 'Your journey begins...',
      choices: [],
    };

    const playerState: PlayerState = {
      stats: initialStats,
      resources: initialResources,
      inventory: JSON.parse(JSON.stringify(story.rpgSystem.startingInventory)),
      discoveredLocationIds: [initialBeat.locationId || 'loc_start'],
      relationships: initialRelationships,
      activeQuestIds: ['quest_prologue'],
      completedQuestIds: [],
      currentLocationId: initialBeat.locationId || 'loc_start',
    };

    const session: PlaythroughSession = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: body.userId || 'guest_user',
      storyId: story.id,
      currentSceneId: initialBeat.sceneId,
      turnCount: 1,
      playerState,
      history: [
        {
          turnNumber: 1,
          sceneId: initialBeat.sceneId,
          playerActionText: 'Awakening',
          actionStyle: 'tactical',
          narrativeProse: initialBeat.narrativeText,
          presentedChoices: initialBeat.choices,
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Persist session into PostgreSQL
    await SessionRepository.createSession(session);

    return NextResponse.json(
      {
        success: true,
        data: {
          session,
          story: {
            id: story.id,
            title: story.title,
            language: story.language,
            rpgSystem: story.rpgSystem,
          },
          currentBeat: {
            narrative: initialBeat.narrativeText,
            choices: initialBeat.choices,
          },
        },
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to initialize session' },
      { status: 500, headers: corsHeaders }
    );
  }
}
