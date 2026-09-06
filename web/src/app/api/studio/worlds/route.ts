import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsPreflight();
}

// GET /api/studio/worlds -> list all shared worlds (id, name, storyCount)
// GET /api/studio/worlds?worldId=... -> world bible + stories on that world
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('worldId');

    if (worldId) {
      const worldBible = await StoryRepository.getWorldBibleByWorldId(worldId);
      if (!worldBible) {
        return NextResponse.json(
          { success: false, error: 'World not found' },
          { status: 404, headers: corsHeaders }
        );
      }
      const stories = (await StoryRepository.getAllStories()).filter(
        (s: { worldId?: string; id: string }) =>
          (s.worldId || s.id) === worldId || s.worldId === worldBible.worldId
      );
      return NextResponse.json(
        { success: true, data: { worldBible, stories } },
        { headers: corsHeaders }
      );
    }

    const worlds = await StoryRepository.getAllWorlds();
    return NextResponse.json({ success: true, data: worlds }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch worlds' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/studio/worlds { name, summary?, themeNotes? } -> create empty world
// POST /api/studio/worlds { forkFromWorldId | forkFromStoryId, name } -> deep-copy world
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forkSource = body.forkFromWorldId || body.forkFromStoryId;

    if (forkSource) {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { success: false, error: 'name is required when forking a world' },
          { status: 400, headers: corsHeaders }
        );
      }
      const forked = await StoryRepository.forkWorld(forkSource, body.name.trim());
      return NextResponse.json({ success: true, data: forked }, { headers: corsHeaders });
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    const created = await StoryRepository.createWorld({
      name: body.name.trim(),
      summary: body.summary || '',
      themeNotes: body.themeNotes || '',
    });
    return NextResponse.json({ success: true, data: created }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create world' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE /api/studio/worlds?worldId=... -> delete world + its stories
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const worldId = searchParams.get('worldId');
    if (!worldId) {
      return NextResponse.json(
        { success: false, error: 'worldId is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    const result = await StoryRepository.deleteWorld(worldId);
    return NextResponse.json({ success: true, data: result }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete world' },
      { status: 500, headers: corsHeaders }
    );
  }
}
