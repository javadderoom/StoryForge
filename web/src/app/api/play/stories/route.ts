import { NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function GET() {
  try {
    const stories = await StoryRepository.getAllStories();
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
    console.error('Error fetching stories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load stories' },
      { status: 500, headers: corsHeaders }
    );
  }
}
