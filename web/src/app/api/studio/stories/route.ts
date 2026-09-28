import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { StoryManifest } from '@/lib/types';
import { canPublish } from '@/lib/engines/world/publishGate';
import { requireStudioWrite } from '@/lib/auth/studioAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('id');

    if (storyId) {
      const story = await StoryRepository.getStoryById(storyId);
      return NextResponse.json({ success: true, data: story }, { headers: buildCorsHeaders(req) });
    }

    const stories = await StoryRepository.getAllStories();
    return NextResponse.json({ success: true, data: stories }, { headers: buildCorsHeaders(req) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch studio stories' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const body = (await req.json()) as StoryManifest;

    if (!body.id || !body.title) {
      return NextResponse.json(
        { success: false, error: 'id and title are required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    let publishGateResult: any = null;
    if ((body as StoryManifest).published === true) {
      const statIds = ((body as StoryManifest).rpgSystem?.stats || []).map((s) => s.id).filter(Boolean);
      publishGateResult = canPublish(
        (body as StoryManifest).worldBible as unknown as Parameters<typeof canPublish>[0],
        ((body as StoryManifest) as { saga?: Parameters<typeof canPublish>[1] }).saga ?? null,
        statIds
      );
      if (!publishGateResult.ok) {
        (body as StoryManifest).published = false;
      }
    }

    if (!(await StoryRepository.canModifyStory(body.id, guard.user))) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to modify this story.' },
        { status: 403, headers: buildCorsHeaders(req) }
      );
    }

    const saved = await StoryRepository.saveStory(body, guard.user.id);
    return NextResponse.json(
      {
        success: true,
        data: saved,
        message: 'Story and World Bible saved successfully',
        publishGate: publishGateResult,
        publishedDowngraded: publishGateResult && !publishGateResult.ok,
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save studio story' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
