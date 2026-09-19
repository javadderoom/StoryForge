import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { allocateLevelUpRewards } from '@/lib/engines/game/progressionEngine';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { PlayerState } from '@/lib/types/gameplay';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, statAllocations = {}, chosenAbilityId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const session = await SessionRepository.getSession(sessionId);
    if (!session || !session.playerState) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404, headers: corsHeaders }
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
        { status: 400, headers: corsHeaders }
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
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Level-up reward allocation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
