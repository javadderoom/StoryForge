import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { StoryManifest } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const manifest: StoryManifest = body.storyManifest;

    if (!manifest || !manifest.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid story manifest payload' },
        { status: 400 }
      );
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
    return NextResponse.json({ success: true, data: story });
  } catch (error: any) {
    console.error('Error fetching story manifest in studio:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch story manifest' },
      { status: 500 }
    );
  }
}
