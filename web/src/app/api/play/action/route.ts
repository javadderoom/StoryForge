import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { buildWorldContextBlocks } from '@/lib/engines/narrative/worldContext';
import { MemoryEngine } from '@/lib/engines/memory/MemoryEngine';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { PlayerState, ActionStyle, RiskLevel, TurnBeat } from '@/lib/types/gameplay';
import { WorkingContextEnvelope, MemoryCategory, MemoryEntry } from '@/lib/types/memory';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

const geminiAdapter = new GeminiAdapter();

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      storyId,
      sessionId,
      playerActionText,
      actionStyle = 'free_text' as ActionStyle,
      riskLevel = 'medium' as RiskLevel,
      statId,
      targetDC,
      playerState: incomingPlayerState,
      turnNumber = 2,
      forcedDiceRoll,
    } = body;

    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const story = await StoryRepository.getStoryById(storyId);
    const playerState: PlayerState = incomingPlayerState;

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (!playerActionText || typeof playerActionText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'playerActionText is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Guardrail Validation
    const validation = ActionValidator.validateAction(
      playerActionText,
      playerState,
      story.worldBible,
      story.rpgSystem
    );

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          rejectionReason: validation.rejectionReason,
          suggestedAction: validation.suggestedAction,
          isGuardrailViolation: true,
        },
        { headers: corsHeaders }
      );
    }

    // 2. Deterministic Game Engine Check Resolution
    const resolution = GameEngine.resolveActionCheck(
      playerActionText,
      playerState,
      story.rpgSystem,
      {
        statId,
        riskLevel,
        targetDC,
        forcedDiceRoll: typeof forcedDiceRoll === 'number' ? forcedDiceRoll : undefined,
      }
    );

    // 3. Apply State Mutation Diff
    const updatedPlayerState = GameEngine.applyStateMutation(
      playerState,
      resolution.stateDiff,
      story.rpgSystem
    );

    // 4. Assemble AI Prompt Context Envelope
    const session = sessionId ? await SessionRepository.getSession(sessionId) : null;

    const world = buildWorldContextBlocks(story);

    const currentLocation =
      story.worldBible.locations.find((l) => l.id === updatedPlayerState.currentLocationId) ||
      story.worldBible.locations[0] || {
        id: 'loc_default',
        name: 'Citadel',
        description: 'Dark fortress',
      };

    const activeNPCs = story.worldBible.npcs.filter(
      (npc) => npc.currentLocationId === updatedPlayerState.currentLocationId
    );
    const activeNpcIds = activeNPCs.map((n) => n.id);

    // Hierarchical memory retrieval from the persisted session log
    const turnSceneByNumber = new Map<number, string>();
    for (const t of (session?.turns ?? []) as Array<{ turnNumber: number; sceneId?: string }>) {
      turnSceneByNumber.set(t.turnNumber, t.sceneId ?? currentLocation.id);
    }
    const memoryLogs = (session?.memories ?? []) as Array<{
      category: string;
      importance?: number;
      summary: string;
      turnNumber?: number;
    }>;
    const memoryEntries = memoryLogs.map((m, i) => ({
      id: `mem_${m.turnNumber ?? 0}_${i}`,
      category: m.category,
      importance: typeof m.importance === 'number' ? m.importance : 5,
      summary: m.summary,
      tags: [],
      sceneId: turnSceneByNumber.get(m.turnNumber ?? 0) ?? currentLocation.id,
      turnNumber: m.turnNumber ?? 0,
      createdAt: m.turnNumber ?? 0,
    })) as unknown as MemoryEntry[];
    const retrieved = memoryEntries.length
      ? new MemoryEngine(memoryEntries).getRelevantMemories(
          updatedPlayerState.currentLocationId,
          activeNpcIds,
          6
        )
      : [];
    const relevantMemories = [
      ...retrieved.map((m) => ({ category: m.category, importance: m.importance, summary: m.summary })),
      {
        category: 'player' as MemoryCategory,
        importance: 8,
        summary: `Player performed action "${playerActionText}" with outcome ${resolution.outcome}`,
      },
    ];

    // Sliding-window recent prose from prior turns (fallback to opening beat)
    const priorProse = ((session?.turns ?? []) as Array<{ narrativeProse?: string }>)
      .slice(-3)
      .map((t) => t.narrativeProse)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    const recentSceneSnippets =
      priorProse.length > 0 ? priorProse : [story.initialStoryBeats[0]?.narrativeText || ''];

    const contextEnvelope: WorkingContextEnvelope = {
      storyTitle: story.title,
      worldLaws: story.worldBible.laws.map((l) => `${l.rule}: ${l.description}`),
      currentLocationName: currentLocation.name,
      currentLocationDescription: currentLocation.description,
      activeNpcDossiers: activeNPCs.map((npc) => ({
        name: npc.name,
        trust: updatedPlayerState.relationships[npc.id]?.trust || 0,
        knownSecrets: updatedPlayerState.relationships[npc.id]?.knownSecrets || [],
        speechStyle: npc.speechStyle,
      })),
      relevantMemories,
      playerStatus: {
        stats: updatedPlayerState.stats,
        resources: updatedPlayerState.resources,
        equippedItems: updatedPlayerState.inventory.map((i) => i.name),
      },
      resolvedGameOutcome: {
        actionText: playerActionText,
        outcome: resolution.outcome,
        consequence: resolution.consequenceSummary,
      },
      recentSceneSnippets,
      languageDirective: story.language,
      authoredSystemPrompt: world.authoredSystemPrompt,
      worldSummary: world.worldSummary,
      themeNotes: world.themeNotes,
      factions: world.factions,
      timeline: world.timeline,
      artifacts: world.artifacts,
      bestiary: world.bestiary,
      religions: world.religions,
      dramaBonds: world.dramaBonds,
      ontologySummary: world.ontologySummary,
    };

    // 5. Build prompt and generate prose with Gemini
    const promptPayload = PromptAssembler.buildNarrativePrompt(contextEnvelope);
    const aiResponse = await geminiAdapter.generateScene(promptPayload);

    const newBeat: TurnBeat = {
      turnNumber,
      sceneId: `scene_turn_${turnNumber}`,
      playerActionText,
      actionStyle,
      resolution,
      narrativeProse: aiResponse.narrative,
      presentedChoices: aiResponse.choices,
      timestamp: Date.now(),
    };

    // 6. Persist Turn Record to Database if sessionId provided
    if (sessionId) {
      const turnMemories = [
        {
          category: 'player' as const,
          importance: 8,
          summary: `Player performed action "${playerActionText}" with outcome ${resolution.outcome}`,
        },
        ...aiResponse.extractedMemories.map((m) => ({
          category: m.category,
          importance: m.importance,
          summary: m.summary,
        })),
      ];
      await SessionRepository.recordTurn({
        sessionId,
        beat: newBeat,
        resolution,
        updatedPlayerState,
        memories: turnMemories,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          beat: newBeat,
          resolution,
          updatedPlayerState,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Turn action processing error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process turn';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
