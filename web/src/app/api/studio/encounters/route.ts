import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { StoryEncounter, StoryEncounterSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('storyId');
    if (!storyId) {
      return NextResponse.json({ success: false, error: 'storyId required' }, { status: 400 });
    }

    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
      return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
    }

    const encounters: StoryEncounter[] = story.encounters || [];
    return NextResponse.json({ success: true, data: encounters });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || (auth.user.role !== 'ADMIN' && auth.user.role !== 'AUTHOR')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin or Author permissions required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { storyId, encounter } = body;

    if (!storyId || !encounter) {
      return NextResponse.json(
        { success: false, error: 'storyId and encounter payload required' },
        { status: 400 }
      );
    }

    const validatedEncounter = StoryEncounterSchema.parse(encounter);

    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
      return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
    }

    const manifest = { ...story };
    const existingEncounters: StoryEncounter[] = manifest.encounters || [];

    const index = existingEncounters.findIndex((e) => e.id === validatedEncounter.id);
    if (index >= 0) {
      existingEncounters[index] = validatedEncounter;
    } else {
      existingEncounters.push(validatedEncounter);
    }
    manifest.encounters = existingEncounters;

    await StoryRepository.saveStory(manifest);

    return NextResponse.json({
      success: true,
      data: validatedEncounter,
      message: 'Encounter saved successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save encounter' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || (auth.user.role !== 'ADMIN' && auth.user.role !== 'AUTHOR')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin or Author permissions required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('storyId');
    const encounterId = searchParams.get('encounterId');

    if (!storyId || !encounterId) {
      return NextResponse.json(
        { success: false, error: 'storyId and encounterId required' },
        { status: 400 }
      );
    }

    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
      return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
    }

    const manifest = { ...story };
    manifest.encounters = (manifest.encounters || []).filter((e: StoryEncounter) => e.id !== encounterId);

    await StoryRepository.saveStory(manifest);

    return NextResponse.json({
      success: true,
      message: 'Encounter deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete encounter' },
      { status: 500 }
    );
  }
}
