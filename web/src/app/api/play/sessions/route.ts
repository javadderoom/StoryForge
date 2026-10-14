import { NextRequest, NextResponse } from 'next/server';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function GET(req: NextRequest) {
  try {
    const storyId = req.nextUrl.searchParams.get('storyId');
    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    const auth = await getAuthenticatedUser(req);
    if (!auth?.user) {
      return NextResponse.json(
        { success: true, sessions: [] },
        { headers: buildCorsHeaders(req) }
      );
    }

    const sessions = await SessionRepository.getUserSessionsForStory(auth.user.id, storyId);

    const characterSessions = sessions.map((s: any) => {
      let playerState: any = {};
      try {
        playerState = typeof s.playerState === 'string' ? JSON.parse(s.playerState) : (s.playerState || {});
      } catch {
        playerState = s.playerState || {};
      }

      return {
        sessionId: s.sessionId,
        storyId: s.storyId,
        currentSceneId: s.currentSceneId,
        turnCount: s.turnCount ?? 1,
        characterName: playerState.characterName || 'بی‌نام',
        archetypeId: playerState.archetypeId,
        archetypeName: playerState.archetypeName || 'ماجراجو',
        backgroundId: playerState.backgroundId,
        backgroundName: playerState.backgroundName || 'سرگردان',
        level: playerState.level ?? 1,
        currentLocationId: playerState.currentLocationId,
        stats: playerState.stats || {},
        resources: playerState.resources || {},
        maxResources: playerState.maxResources || {},
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json(
      {
        success: true,
        sessions: characterSessions,
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Error fetching story sessions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch story sessions' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
