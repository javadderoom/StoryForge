import { NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET() {
  try {
    const stories = await StoryRepository.getAllStories(true);
    return NextResponse.json(
      {
        success: true,
        data: stories,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.warn('API error fetching published stories from DB:', error);
    return NextResponse.json(
      { success: true, data: [] },
      { headers: corsHeaders }
    );
  }
}
