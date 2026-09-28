import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function GET(req: NextRequest) {
  try {
    const stories = await StoryRepository.getAllStories(true);
    return NextResponse.json(
      {
        success: true,
        data: stories,
      },
      {
        headers: buildCorsHeaders(req),
      }
    );
  } catch (error: any) {
    console.warn('API error fetching published stories from DB:', error);
    return NextResponse.json(
      { success: true, data: [] },
      { headers: buildCorsHeaders(req) }
    );
  }
}
