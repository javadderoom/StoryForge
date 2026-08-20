import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { PlayerState, ActionStyle, RiskLevel, TurnBeat } from '@/lib/types/gameplay';
import { WorkingContextEnvelope, MemoryCategory } from '@/lib/types/memory';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

const geminiAdapter = new GeminiAdapter();

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      storyId = 'ghale_siahsang',
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

    const story = await StoryRepository.getStoryById(storyId);
    const playerState: PlayerState = incomingPlayerState;

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

    const relevantMemories = [
      {
        category: 'player' as MemoryCategory,
        importance: 8,
        summary: `Player performed action "${playerActionText}" with outcome ${resolution.outcome}`,
      },
    ];

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
      recentSceneSnippets: [story.initialStoryBeats[0]?.narrativeText || ''],
      languageDirective: story.language,
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
      await SessionRepository.recordTurn({
        sessionId,
        beat: newBeat,
        resolution,
        updatedPlayerState,
        memories: relevantMemories,
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
  } catch (error: any) {
    console.error('Turn action processing error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process turn' },
      { status: 500, headers: corsHeaders }
    );
  }
}
