import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { getPrisma } from '@/lib/db/client';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { migrateStoryManifestToUnifiedGraph } from '@/lib/engines/world/graphMigration';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { generateValidatedScene } from '@/lib/engines/narrative/narrativeTurn';
import { RemakeValidator, ContinuityIssueType } from '@/lib/engines/narrative/RemakeValidator';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import type { CheckResolution, PlayerState } from '@/lib/types/gameplay';
import type { WorldStateLedger } from '@/lib/types/world';

export const dynamic = 'force-dynamic';

const geminiAdapter = new GeminiAdapter();

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      sessionId,
      storyId,
      turnNumber,
      issueType = 'other' as ContinuityIssueType,
      reason,
    } = body;

    if (!sessionId || !storyId || !turnNumber || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'sessionId, storyId, turnNumber, and reason are required.',
        },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable' },
        { status: 500, headers: buildCorsHeaders(req) }
      );
    }

    // 1. Ownership & Session Verification
    const auth = await getAuthenticatedUser(req);
    const caller = auth ? { id: auth.user.id, role: auth.user.role } : null;
    const session = await SessionRepository.getSessionForUser(sessionId, caller);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found or access denied.' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }

    // 2. Load Story
    const rawStory = await StoryRepository.getStoryById(storyId);
    if (!rawStory) {
      return NextResponse.json(
        { success: false, error: 'Story not found.' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }
    const story = migrateStoryManifestToUnifiedGraph(rawStory);

    // 3. Find the turn to remake
    const targetTurn = await prisma.turnHistory.findFirst({
      where: { sessionId, turnNumber: Number(turnNumber) },
    });

    if (!targetTurn) {
      return NextResponse.json(
        { success: false, error: 'Target turn not found.' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }

    // Must be the latest turn in the playthrough session
    const latestTurn = await prisma.turnHistory.findFirst({
      where: { sessionId },
      orderBy: { turnNumber: 'desc' },
    });

    if (latestTurn && latestTurn.turnNumber !== targetTurn.turnNumber) {
      return NextResponse.json(
        {
          success: false,
          error: story.language === 'fa'
            ? 'تنها آخرین صحنهٔ فعلی بازی قابل بازسازی است.'
            : 'Only the current (latest) scene of the playthrough can be remade.',
        },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    // 4. Enforce 1-Remake Quota per scene
    if (targetTurn.remakeCount >= 1) {
      return NextResponse.json(
        {
          success: false,
          error: story.language === 'fa'
            ? 'این صحنه قبلاً یک بار بازسازی شده است و امکان بازسازی مجدد ندارد.'
            : 'This scene has already been remade once and cannot be remade again.',
        },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    // 5. Prior turns for context
    const allSessionTurns = await prisma.turnHistory.findMany({
      where: { sessionId },
      orderBy: { turnNumber: 'asc' },
    });
    const priorTurns = allSessionTurns.filter((t) => t.turnNumber < targetTurn.turnNumber);

    const resolution = (targetTurn.resolution as CheckResolution | null) || null;
    const playerState = session.playerState as PlayerState;

    // 6. Validate the remake reason through RemakeValidator
    const validation = RemakeValidator.validate({
      issueType,
      reason,
      narrativeProse: targetTurn.narrativeProse,
      playerActionText: targetTurn.playerActionText,
      resolution,
      playerState,
      worldBible: story.worldBible,
      language: story.language,
      sessionTurns: priorTurns,
    });

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          rejectionReason: validation.rejectionReason,
          isGuardrailViolation: true,
        },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    // 7. Generate revised scene with the verified remake directive
    const secretSanitizer = (choices: any[], currentProse?: string) => {
      const priorSnippets = priorTurns
        .slice(-3)
        .map((t) => t.narrativeProse)
        .filter(Boolean);
      return ActionValidator.sanitizeChoices(
        choices,
        playerState,
        story.worldBible,
        story.storyNpcOverrides,
        priorSnippets
      );
    };

    const sceneOutcome = await generateValidatedScene(
      {
        story,
        playerState,
        resolution: resolution || {
          actionDescription: targetTurn.playerActionText,
          outcome: 'success',
          diceRoll: 10,
          diceType: 'd20',
          difficultyClass: 10,
          statModifier: 0,
          environmentalModifier: 0,
          totalScore: 10,
          consequenceSummary: targetTurn.playerActionText,
          stateDiff: {},
        },
        playerActionText: targetTurn.playerActionText,
        ledger: (session.sagaLedger as WorldStateLedger) || {},
        sessionTurns: priorTurns.map((t) => ({
          turnNumber: t.turnNumber,
          narrativeProse: t.narrativeProse,
          playerActionText: t.playerActionText,
          presentedChoices: t.presentedChoices as any,
        })),
        sessionMemories: ((session.memories ?? []) as any[]).filter(
          (m) => typeof m.turnNumber !== 'number' || m.turnNumber < targetTurn.turnNumber
        ),
        activeChapter: session.currentChapterId
          ? story.saga?.chapters.find((c: any) => c.id === session.currentChapterId)
          : null,
        remakeDirective: validation.verifiedDirective,
      },
      geminiAdapter,
      secretSanitizer
    );

    if (sceneOutcome.status === 'mock_unavailable') {
      return NextResponse.json(
        {
          success: false,
          error: 'AI narrative service is temporarily unavailable.',
        },
        { status: 503, headers: buildCorsHeaders(req) }
      );
    }

    const revisedNarrative = sceneOutcome.aiResponse.narrative;
    const revisedChoices = sceneOutcome.aiResponse.choices;

    // 8. Update Turn in DB
    const updatedTurn = await prisma.turnHistory.update({
      where: { id: targetTurn.id },
      data: {
        narrativeProse: revisedNarrative,
        presentedChoices: revisedChoices as any,
        remakeCount: targetTurn.remakeCount + 1,
      },
    });

    await prisma.playthroughSession.update({
      where: { sessionId },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          beat: {
            sceneId: updatedTurn.sceneId,
            narrativeProse: revisedNarrative,
            presentedChoices: revisedChoices,
          },
          turnNumber: updatedTurn.turnNumber,
          remakeCount: updatedTurn.remakeCount,
          message: story.language === 'fa'
            ? 'صحنه با موفقیت بر اساس گزارش شما بازنویسی شد.'
            : 'Scene successfully remade based on your report.',
        },
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('[play/remake] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remake scene',
      },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
