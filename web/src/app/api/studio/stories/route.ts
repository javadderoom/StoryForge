import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { StoryManifest } from '@/lib/types';

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('id');

    if (storyId) {
      const story = await StoryRepository.getStoryById(storyId);
      return NextResponse.json({ success: true, data: story }, { headers: corsHeaders });
    }

    const stories = await StoryRepository.getAllStories();
    return NextResponse.json({ success: true, data: stories }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch studio stories' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StoryManifest;

    if (!body.id || !body.title) {
      return NextResponse.json(
        { success: false, error: 'id and title are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const saved = await StoryRepository.saveStory(body);
    return NextResponse.json(
      { success: true, data: saved, message: 'Story and World Bible saved successfully' },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save studio story' },
      { status: 500, headers: corsHeaders }
    );
  }
}
