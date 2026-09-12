import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { PlaythroughSession, PlayerState, ChoiceOption } from '@/lib/types/gameplay';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { artifactToGameItem } from '@/lib/play/artifactItems';
import { computeMaxResources } from '@/lib/engines/game/vitalScaling';
import { reconcilePlayerResources } from '@/lib/engines/game/resourcePools';
import { addToPurse } from '@/lib/engines/game/currencyEngine';
import { migrateStoryManifestToUnifiedGraph } from '@/lib/engines/world/graphMigration';
import { isPlaceholderBeat } from '@/lib/engines/world/sceneResolution';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { buildWorldContextBlocks, formatNpcCombatSummary } from '@/lib/engines/narrative/worldContext';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { WorkingContextEnvelope } from '@/lib/types/memory';

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
      alliedFactionIds: f.alliedFactionIds || [],
      rivalFactionIds: f.rivalFactionIds || [],
    })),
    factionRelations: (wb.factionRelations ?? [])
      .filter((r: any) => r.isPublic !== false)
      .map((r: any) => ({
        id: r.id,
        sourceFactionId: r.sourceFactionId,
        targetFactionId: r.targetFactionId,
        value: r.value,
        note: r.note || '',
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
      statModifiers: a.statModifiers || {},
      resourceModifiers: a.resourceModifiers || {},
      slot: a.slot || 'relic',
      powers: a.powers || [],
      curseOrCost: a.curseOrCost || '',
      passiveBuffs: a.passiveBuffs || [],
      startsQuestId: a.startsQuestId || undefined,
      nonEquippable: a.nonEquippable || undefined,
    })),
  };
}

/**
 * When the authored opening beat ships no choices, the AI synthesizes 2-4
 * contextual opening choices at session creation/resume so the reader never
 * sits on an empty decision panel. Returns [] on the mock/offline path so
 * session creation still proceeds (the free-text bar remains usable).
 */
const openingGeminiAdapter = new GeminiAdapter();

async function generateOpeningChoices(
  story: any,
  beat: { sceneId?: string; locationId?: string; narrativeText?: string },
  playerState: PlayerState
): Promise<ChoiceOption[]> {
  try {
    const wb = story.worldBible ?? {};
    const locationId =
      (typeof beat.locationId === 'string' && beat.locationId) ||
      playerState.currentLocationId ||
      wb.locations?.[0]?.id ||
      'loc_default';
    const location =
      wb.locations?.find((l: any) => l.id === locationId) ||
      wb.locations?.[0] || {
        id: locationId,
        name: 'Citadel',
        description: '',
      };
    const activeNPCs = (wb.npcs ?? []).filter((n: any) => n.currentLocationId === locationId);
    const activeNpcIds = activeNPCs.map((n: any) => n.id);
    const world = buildWorldContextBlocks(story, {
      scopeTier: 'regional',
      locationIds: [locationId],
      npcIds: activeNpcIds,
    });
    const activeChapter = story.saga?.chapters?.[0];

    const activeNpcDossiers: WorkingContextEnvelope['activeNpcDossiers'] = activeNPCs.map(
      (n: any) => ({
        id: n.id,
        name: n.name,
        trust: n.initialTrust ?? 0,
        knownSecrets: [],
        speechStyle: n.speechStyle || 'neutral',
        vitalsLine: formatNpcCombatSummary(n) || undefined,
      })
    );

    const context: WorkingContextEnvelope = {
      storyTitle: story.title,
      worldLaws: world.laws,
      currentLocationName: location.name,
      currentLocationDescription: location.description || '',
      activeNpcDossiers,
      relevantMemories: [],
      playerStatus: {
        stats: playerState.stats || {},
        resources: playerState.resources || {},
        equippedItems: (playerState.inventory || []).map((i: any) => i.name),
      },
      statsConfig: story.rpgSystem?.stats,
      recentSceneSnippets: [String(beat.narrativeText || '')].filter(Boolean),
      languageDirective: (story.language === 'en' ? 'en' : 'fa') as 'en' | 'fa',
      authoredSystemPrompt: world.authoredSystemPrompt,
      worldSummary: world.worldSummary,
      themeNotes: world.themeNotes,
      factions: world.factions,
      factionRelations: world.factionRelations,
      timeline: world.timeline,
      artifacts: world.artifacts,
      bestiary: world.bestiary,
      religions: world.religions,
      dramaBonds: world.dramaBonds,
      ontologySummary: world.ontologySummary,
      locations: world.locations,
      npcs: world.npcs,
      activeChapterTitle: activeChapter
        ? `${activeChapter.chapterNumber}. ${activeChapter.title}`
        : undefined,
      activeChapterGoal: activeChapter?.narrativeGoal || undefined,
    };

        const promptPayload = PromptAssembler.buildNarrativePrompt(context);
    const generated = await openingGeminiAdapter.generateScene(promptPayload);
    if (generated.isMock) {
      console.warn('[session] Opening choice generation unavailable (mock) — opening with authored choices.');
      return [];
    }
    // Defense-in-depth: never present an opening choice that would leak a
    // secret the player has not yet discovered. (The presented-choice bypass
    // would otherwise still block the click, but the text must never appear.)
    return ActionValidator.sanitizeChoices(
      generated.choices,
      playerState,
      story.worldBible,
      (story as any).storyNpcOverrides
    );
  } catch (e) {
    console.warn('[session] Opening choice generation failed — falling back to authored choices:', e);
    return [];
  }
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

    // Reconcile persisted vitals against CURRENT studio Resource Pools so
    // renames / max edits / added pools appear without starting over.
    let reconciledPlayerState: any = session.playerState;
    try {
      const reconciled = reconcilePlayerResources(
        session.playerState as any,
        (story as any).rpgSystem,
        (story as any).worldBible
      );
      reconciledPlayerState = reconciled.playerState;
      if (reconciled.changed) {
        await SessionRepository.updatePlayerState(session.sessionId, reconciledPlayerState).catch(() => null);
      }
    } catch {
      /* non-fatal: serve stored state */
    }

    // Plan: fresh sessions whose opening beat has no choices (and no recorded
    // turn yet) get AI-synthesized opening choices on resume too, so a reload
    // never strands the reader on an empty decision panel.
    let resumeChoices =
      lastTurn?.presentedChoices ??
      (story.initialStoryBeats?.[0]?.choices as any[]) ??
      [];
    if (Array.isArray(resumeChoices) && resumeChoices.length === 0) {
      const resumeBeat =
        story.initialStoryBeats?.find((b: any) => b.sceneId === session.currentSceneId) ||
        story.initialStoryBeats?.[0];
      if (resumeBeat && !isPlaceholderBeat(resumeBeat) && (session as any).playerState) {
        resumeChoices = await generateOpeningChoices(story, resumeBeat, (session as any).playerState);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId: session.sessionId,
          story: {
            id: story.id,
            title: story.title,
            language: story.language,
            coverImageUrl: story.coverImageUrl,
            rpgSystem: story.rpgSystem,
          },
          playerState: reconciledPlayerState,
          lore: buildPlayLore(story),
          currentBeat: {
            narrative: lastTurn?.narrativeProse ?? story.initialStoryBeats?.[0]?.narrativeText ?? '',
            choices: resumeChoices,
            imageUrl:
              story.initialStoryBeats?.find((b) => b.sceneId === session.currentSceneId)?.imageUrl ??
              undefined,
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
    const rawStory = await StoryRepository.getStoryById(storyId);
    if (!rawStory && !body?.draftManifest) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    const baseStory = rawStory || (body.draftManifest as any);
    const storyToMigrate = body?.draftManifest
      ? {
          ...baseStory,
          ...body.draftManifest,
          initialStoryBeats: body.draftManifest.initialStoryBeats?.length
            ? body.draftManifest.initialStoryBeats
            : baseStory.initialStoryBeats,
        }
      : baseStory;
    const story = migrateStoryManifestToUnifiedGraph(storyToMigrate);

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
    let selectedArch: any = undefined;
    let selectedBg: any = undefined;
    let initialPurse: Record<string, number> = {};

    // 1. Apply Archetype if selected
    if (characterSetup?.archetypeId && story.rpgSystem.archetypes) {
      const arch = story.rpgSystem.archetypes.find((a) => a.id === characterSetup.archetypeId);
      if (arch) {
        selectedArch = arch;
        archetypeName = arch.name;
        if (arch.statBonuses) {
          for (const [sKey, bonus] of Object.entries(arch.statBonuses)) {
            initialStats[sKey] = (initialStats[sKey] || 10) + bonus;
          }
        }
        if (arch.startingPurse) {
          initialPurse = addToPurse(initialPurse, arch.startingPurse);
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

    // 2. Apply Background Origin if selected
    if (characterSetup?.backgroundId && story.rpgSystem.backgrounds) {
      const bg = story.rpgSystem.backgrounds.find((b) => b.id === characterSetup.backgroundId);
      if (bg) {
        selectedBg = bg;
        backgroundName = bg.name;
        if (bg.trait) traits.push(bg.trait);
        if (bg.statBonuses) {
          for (const [sKey, bonus] of Object.entries(bg.statBonuses)) {
            initialStats[sKey] = (initialStats[sKey] || 10) + bonus;
          }
        }
        if (bg.startingPurse) {
          initialPurse = addToPurse(initialPurse, bg.startingPurse);
        }
      }
    }

    // 3. Apply Custom Allocated Stats if explicitly customized (authoritative user allocation)
    if (characterSetup?.allocatedStats) {
      for (const [sKey, val] of Object.entries(characterSetup.allocatedStats)) {
        if (typeof val === 'number') {
          initialStats[sKey] = val;
        }
      }
    }

    // Provision archetype equipment from the artifact vault: resolve slot refs
    // (artifact id, or legacy free-typed name) to real inventory GameItems so
    // equipment slots and their stat modifiers resolve in the play HUD.
    const vaultArtifacts: any[] = story.worldBible?.artifacts || [];
    const resolveVaultArtifact = (ref?: string) =>
      ref ? vaultArtifacts.find((a) => a.id === ref || a.name === ref) : undefined;
    const equippedArtifacts: any[] = [];
    for (const slot of ['mainHand', 'offHand', 'armor', 'relic'] as const) {
      const artifact = resolveVaultArtifact(startingEquipment[slot]);
      if (!artifact) continue;
      startingEquipment[slot] = artifact.id;
      equippedArtifacts.push(artifact);
      if (!startingInventory.some((i: any) => i.id === artifact.id)) {
        startingInventory.push(artifactToGameItem(artifact));
      }
    }

    // Enforce weapon grip rule: A two-handed weapon occupies both hands and cannot have an off-hand item equipped
    if (startingEquipment.mainHand) {
      const mainHandItem = startingInventory.find((i: any) => i.id === startingEquipment.mainHand);
      if (mainHandItem?.grip === 'two_handed') {
        delete startingEquipment.offHand;
      }
    }

    const maxResources = computeMaxResources(
      initialStats,
      story.rpgSystem,
      {
        archetype: selectedArch,
        background: selectedBg,
        equippedArtifacts,
      }
    );

    // Pools always start full: current == scaled max. The studio `current`
    // field is kept for backward compatibility but no longer seeds partial
    // pools — a fresh character begins at full strength.
    const initialResources: Record<string, number> = {};
    for (const res of story.rpgSystem.resources || []) {
      initialResources[res.id] = maxResources[res.id] ?? res.max ?? 1;
    }

    const initialRelationships: Record<string, any> = {};
    for (const npc of story.worldBible.npcs) {
      initialRelationships[npc.id] = {
        trust: npc.initialTrust,
        knownSecrets: [],
        notes: [],
      };
    }

    const beats = story.initialStoryBeats || [];
    const designatedBeat = story.initialSceneId
      ? beats.find((b) => b.sceneId === story.initialSceneId && !isPlaceholderBeat(b))
      : null;

    const openingBeat =
      designatedBeat ||
      beats.find((b) => !b.chapterId && !isPlaceholderBeat(b)) ||
      beats.find((b) => !isPlaceholderBeat(b)) ||
      beats[0] || {
        sceneId: story.initialSceneId || 'scene_start',
        locationId: story.worldBible.locations[0]?.id || '',
        narrativeText: '',
        choices: [],
      };

    const initialBeat = openingBeat;

    // 4. Starting abilities from Archetype & Background
    const initialAbilities: string[] = [];
    if (selectedArch?.startingAbilities) {
      for (const abId of selectedArch.startingAbilities) {
        if (!initialAbilities.includes(abId)) initialAbilities.push(abId);
      }
    }
    if (selectedBg?.startingAbilities) {
      for (const abId of selectedBg.startingAbilities) {
        if (!initialAbilities.includes(abId)) initialAbilities.push(abId);
      }
    }

    const playerState: PlayerState = {
      characterName: characterSetup?.characterName || undefined,
      archetypeId: characterSetup?.archetypeId || undefined,
      archetypeName,
      backgroundId: characterSetup?.backgroundId || undefined,
      backgroundName,
      traits: traits.length > 0 ? traits : undefined,
      stats: initialStats,
      resources: initialResources,
      maxResources,
      purse: initialPurse,
      inventory: startingInventory,
      equipment: startingEquipment,
      abilities: initialAbilities.length > 0 ? initialAbilities : undefined,
      discoveredLocationIds: initialBeat.locationId ? [initialBeat.locationId] : [],
      relationships: initialRelationships,
      activeQuestIds: ['quest_prologue'],
      completedQuestIds: [],
      currentLocationId: initialBeat.locationId,
    };

    const auth = await getAuthenticatedUser(req);
    const userId = auth?.user?.id || (body.userId && body.userId !== 'guest_user' ? body.userId : null);

    // Plan: kick-start the AI when the authored opening beat ships no choices,
    // so the reader is never stranded on an empty decision panel. The generated
    // opening choices are persisted into the turn-1 history record so loading /
    // resuming the session shows them again.
    const authoredBeatChoices: any[] = initialBeat.choices || [];
    const openingChoices: ChoiceOption[] =
      authoredBeatChoices.length > 0 || isPlaceholderBeat(initialBeat as any)
        ? authoredBeatChoices
        : await generateOpeningChoices(story, initialBeat, playerState);

    const session: PlaythroughSession = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: userId as any,
      storyId: story.id,
      currentSceneId: initialBeat.sceneId,
      currentChapterId: story.saga?.chapters?.[0]?.id,
      turnCount: 1,
      playerState,
      sagaLedger: {
        factionReputations: [],
        npcStatuses: [],
        keyItems: [],
        chapterSummaries: [],
        openPlotThreads: [],
        worldBibleVersion: (story as unknown as { worldBibleVersion?: number }).worldBibleVersion
          || story.worldBible.worldBibleVersion
          || 1,
      },
      history: [
        {
          turnNumber: 1,
          sceneId: initialBeat.sceneId,
          playerActionText: 'Awakening',
          actionStyle: 'tactical',
          narrativeProse: initialBeat.narrativeText,
          presentedChoices: openingChoices,
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
          sessionId: session.sessionId,
          session,
          playerState,
          turnNumber: 1,
          story: {
            id: story.id,
            title: story.title,
            language: story.language,
            coverImageUrl: story.coverImageUrl,
            rpgSystem: story.rpgSystem,
          },
          lore: buildPlayLore(story),
          currentBeat: {
            narrative: initialBeat.narrativeText,
            choices: openingChoices,
            imageUrl: initialBeat.imageUrl,
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
