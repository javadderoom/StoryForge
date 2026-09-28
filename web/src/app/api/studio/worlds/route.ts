import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireStudioWrite } from '@/lib/auth/studioAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

// GET /api/studio/worlds -> list all shared worlds (id, name, storyCount)
// GET /api/studio/worlds?worldId=... -> world bible + stories on that world
export async function GET(req: NextRequest) {
  try {
    // Gated: this returns whole world bibles (laws, factions, NPCs, artifacts)
    // and, via getAllStories(), every story including unpublished drafts.
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('worldId');

    if (worldId) {
      const worldBible = await StoryRepository.getWorldBibleByWorldId(worldId);
      if (!worldBible) {
        return NextResponse.json(
          { success: false, error: 'World not found' },
          { status: 404, headers: buildCorsHeaders(req) }
        );
      }
      const stories = (await StoryRepository.getAllStories()).filter(
        (s: { worldId?: string; id: string }) =>
          (s.worldId || s.id) === worldId || s.worldId === worldBible.worldId
      );
      return NextResponse.json(
        { success: true, data: { worldBible, stories } },
        { headers: buildCorsHeaders(req) }
      );
    }

    const worlds = await StoryRepository.getAllWorlds();
    return NextResponse.json({ success: true, data: worlds }, { headers: buildCorsHeaders(req) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch worlds' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}

// POST /api/studio/worlds { name, summary?, themeNotes? } -> create empty world
// POST /api/studio/worlds { forkFromWorldId | forkFromStoryId, name } -> deep-copy world
export async function POST(req: NextRequest) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const forkSource = body.forkFromWorldId || body.forkFromStoryId;

    if (forkSource) {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { success: false, error: 'name is required when forking a world' },
          { status: 400, headers: buildCorsHeaders(req) }
        );
      }
      // The fork is a fresh, unowned world; whoever saves a story into it
      // becomes that story's author.
      const forked = await StoryRepository.forkWorld(forkSource, body.name.trim());
      return NextResponse.json({ success: true, data: forked }, { headers: buildCorsHeaders(req) });
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }
    const created = await StoryRepository.createWorld({
      name: body.name.trim(),
      summary: body.summary || '',
      themeNotes: body.themeNotes || '',
    });
    return NextResponse.json({ success: true, data: created }, { headers: buildCorsHeaders(req) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create world' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}

// DELETE /api/studio/worlds?worldId=... -> delete world + its stories
// DESTRUCTIVE: cascades to every story on the world and, from there, to every
// PlaythroughSession, TurnHistory and MemoryLog. Author-gated.
export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('worldId');
    if (!worldId) {
      return NextResponse.json(
        { success: false, error: 'worldId is required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }
    const result = await StoryRepository.deleteWorld(worldId);
    return NextResponse.json({ success: true, data: result }, { headers: buildCorsHeaders(req) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete world' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
