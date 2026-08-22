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
    const body = await req.json().catch(() => ({}));
    const storyId = body?.storyId;
    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const characterSetup = body?.characterSetup;

    // Initialize player state from story RPG definitions
    const initialStats: Record<string, number> = {};
    for (const stat of story.rpgSystem.stats) {
      initialStats[stat.id] = stat.baseValue;
    }

    let archetypeName: string | undefined;
    let backgroundName: string | undefined;
    const traits: string[] = [];
    let startingEquipment: any = {
      mainHand: 'iron_dagger',
    };
    const startingInventory = JSON.parse(JSON.stringify(story.rpgSystem.startingInventory));

    // 1. Apply Archetype if selected
    if (characterSetup?.archetypeId && story.rpgSystem.archetypes) {
      const arch = story.rpgSystem.archetypes.find((a) => a.id === characterSetup.archetypeId);
      if (arch) {
        archetypeName = arch.name;
        if (arch.statBonuses) {
          for (const [sKey, bonus] of Object.entries(arch.statBonuses)) {
            initialStats[sKey] = (initialStats[sKey] || 10) + bonus;
          }
        }
        if (arch.startingEquipment) {
          startingEquipment = { ...startingEquipment, ...arch.startingEquipment };
        }
        if (arch.bonusItems) {
          for (const bItem of arch.bonusItems) {
            const existing = startingInventory.find((i: any) => i.id === bItem.id);
            if (existing) {
              existing.quantity += bItem.quantity || 1;
            } else {
              startingInventory.push(JSON.parse(JSON.stringify(bItem)));
            }
          }
        }
      }
    }

    // 2. Apply Custom Allocated Stats if explicitly customized
    if (characterSetup?.allocatedStats) {
      for (const [sKey, val] of Object.entries(characterSetup.allocatedStats)) {
        if (typeof val === 'number') {
          initialStats[sKey] = val;
        }
      }
    }

    // 3. Apply Background Origin if selected
    if (characterSetup?.backgroundId && story.rpgSystem.backgrounds) {
      const bg = story.rpgSystem.backgrounds.find((b) => b.id === characterSetup.backgroundId);
      if (bg) {
        backgroundName = bg.name;
        if (bg.trait) traits.push(bg.trait);
        if (bg.statBonuses) {
          for (const [sKey, bonus] of Object.entries(bg.statBonuses)) {
            initialStats[sKey] = (initialStats[sKey] || 10) + bonus;
          }
        }
      }
    }

    // Enforce weapon grip rule: A two-handed weapon occupies both hands and cannot have an off-hand item equipped
    if (startingEquipment.mainHand) {
      const mainHandItem = startingInventory.find((i: any) => i.id === startingEquipment.mainHand);
      if (mainHandItem?.grip === 'two_handed') {
        delete startingEquipment.offHand;
      }
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
      characterName: characterSetup?.characterName || undefined,
      archetypeId: characterSetup?.archetypeId || undefined,
      archetypeName,
      backgroundId: characterSetup?.backgroundId || undefined,
      backgroundName,
      traits: traits.length > 0 ? traits : undefined,
      stats: initialStats,
      resources: initialResources,
      inventory: startingInventory,
      equipment: startingEquipment,
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
