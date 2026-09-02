import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { PlaythroughSession, PlayerState } from '@/lib/types/gameplay';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';

/**
 * Lightweight, player-safe projection of the World Bible consumed by the
 * in-game Compendium (Codex + NPC dossiers). Laws are excluded (for world building only).
 */
function buildPlayLore(story: any) {
  const wb = story.worldBible ?? {};
  return {
    locations: (wb.locations ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description || '',
      atmosphere: l.atmosphere || '',
    })),
    npcs: (wb.npcs ?? []).map((n: any) => ({
      id: n.id,
      name: n.name,
      description: n.description || '',
      archetype: n.archetype || '',
    })),
    factions: (wb.factions ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      description: f.description || '',
      alignment: f.alignment || '',
    })),
    bestiary: (wb.bestiary ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      dangerLevel: c.dangerLevel || 1,
    })),
    deities: (wb.religions ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description || '',
      domain: d.domain || '',
    })),
    artifacts: (wb.artifacts ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      description: a.description || '',
      rarity: a.rarity || 'uncommon',
    })),
  };
}

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const session = await SessionRepository.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const story = await StoryRepository.getStoryById(session.storyId);
    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const turns: any[] = (session as any).turns ?? [];
    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;

    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId: session.sessionId,
          story: {
            id: story.id,
            title: story.title,
            language: story.language,
            rpgSystem: story.rpgSystem,
          },
          playerState: session.playerState,
          lore: buildPlayLore(story),
          currentBeat: {
            narrative: lastTurn?.narrativeProse ?? story.initialStoryBeats?.[0]?.narrativeText ?? '',
            choices: lastTurn?.presentedChoices ?? story.initialStoryBeats?.[0]?.choices ?? [],
          },
          turnNumber: session.turnCount ?? 1,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Session resume error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resume session' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId: string | undefined = body?.sessionId;
    const playerState: PlayerState | undefined = body?.playerState;
    if (!sessionId || !playerState) {
      return NextResponse.json(
        { success: false, error: 'sessionId and playerState are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const updated = await SessionRepository.updatePlayerState(sessionId, playerState);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist player state' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true, data: { playerState: updated } }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Session patch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to patch session' },
      { status: 500, headers: corsHeaders }
    );
  }
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
      locationId: story.worldBible.locations[0]?.id || '',
      narrativeText: '',
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
      discoveredLocationIds: initialBeat.locationId ? [initialBeat.locationId] : [],
      relationships: initialRelationships,
      activeQuestIds: ['quest_prologue'],
      completedQuestIds: [],
      currentLocationId: initialBeat.locationId,
    };

    const auth = await getAuthenticatedUser(req);
    const userId = auth?.user?.id || (body.userId && body.userId !== 'guest_user' ? body.userId : null);

    const session: PlaythroughSession = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: userId as any,
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
          lore: buildPlayLore(story),
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
