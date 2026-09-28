import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { allocateLevelUpRewards } from '@/lib/engines/game/progressionEngine';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { PlayerState } from '@/lib/types/gameplay';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, statAllocations = {}, chosenAbilityId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    // Ownership-scoped lookup. Previously this route imported no auth at all,
    // so anyone holding a sessionId could spend that session's stat points.
    const auth = await getAuthenticatedUser(req);
    const session = await SessionRepository.getSessionForUser(
      sessionId,
      auth ? { id: auth.user.id, role: auth.user.role } : null
    );
    if (!session || !session.playerState) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }

    const story = await StoryRepository.getStoryById(session.storyId);
    const playerState = session.playerState as PlayerState;

    const result = allocateLevelUpRewards(
      playerState,
      statAllocations,
      chosenAbilityId,
      story?.rpgSystem
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to allocate level-up rewards' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    await SessionRepository.updatePlayerState(sessionId, result.updatedPlayerState);

    return NextResponse.json(
      {
        success: true,
        data: {
          updatedPlayerState: result.updatedPlayerState,
        },
        message: 'Level-up rewards allocated successfully',
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Level-up reward allocation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
