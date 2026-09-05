import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { StoryManifest } from '@/lib/types';
import { canPublish } from '@/lib/engines/world/publishGate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const manifest: StoryManifest = body.storyManifest || body.manifest || body;

    if (!manifest || !manifest.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid story manifest payload' },
        { status: 400 }
      );
    }

    if (manifest.published === true) {
      const statIds = (manifest.rpgSystem?.stats || []).map((s) => s.id).filter(Boolean);
      const gate = canPublish(
        manifest.worldBible as unknown as Parameters<typeof canPublish>[0],
        (manifest as { saga?: Parameters<typeof canPublish>[1] }).saga ?? null,
        statIds
      );
      if (!gate.ok) {
        return NextResponse.json(
          {
            success: false,
            error: 'Story failed consistency publish gate. Resolve errors before publishing.',
            score: gate.score,
            errors: gate.errors,
            warnings: gate.warnings.slice(0, 20),
          },
          { status: 409 }
        );
      }
    }

    const saved = await StoryRepository.saveStory(manifest);
    return NextResponse.json({
      success: true,
      message: 'Story manifest updated successfully',
      data: saved,
    });
  } catch (error: any) {
    console.error('Error saving story manifest in studio:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save story manifest' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('storyId');

    if (!storyId) {
      const stories = await StoryRepository.getAllStories();
      return NextResponse.json({ success: true, data: stories });
    }

    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: story });
  } catch (error: any) {
    console.error('Error fetching story manifest in studio:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch story manifest' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('storyId');

    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400 }
      );
    }

    const result = await StoryRepository.deleteStory(storyId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error deleting story manifest in studio:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete story manifest' },
      { status: 500 }
    );
  }
}
