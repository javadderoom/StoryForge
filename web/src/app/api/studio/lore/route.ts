import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('storyId');
    const resource = searchParams.get('resource');

    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId parameter is required' },
        { status: 400 }
      );
    }

    if (!resource) {
      const worldBible = await StoryRepository.getWorldBible(storyId);
      if (!worldBible) {
        return NextResponse.json(
          { success: false, error: 'WorldBible not found for this story' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: worldBible });
    }

    switch (resource) {
      case 'bestiary': {
        const data = await StoryRepository.getBestiary(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'artifacts': {
        const data = await StoryRepository.getArtifacts(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'timeline': {
        const data = await StoryRepository.getTimeline(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'npcs': {
        const data = await StoryRepository.getNpcs(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'religions': {
        const data = await StoryRepository.getReligions(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'locations': {
        const data = await StoryRepository.getLocations(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'factions': {
        const data = await StoryRepository.getFactions(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'laws': {
        const data = await StoryRepository.getLaws(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'dramaBonds': {
        const data = await StoryRepository.getDramaBonds(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      case 'ontology': {
        const data = await StoryRepository.getOntology(storyId);
        return NextResponse.json({ success: true, resource, data });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported resource type: ${resource}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyId, resource, data } = body;

    if (!storyId || !resource || data === undefined) {
      return NextResponse.json(
        { success: false, error: 'storyId, resource, and data fields are required' },
        { status: 400 }
      );
    }

    const validCollections = [
      'laws',
      'factions',
      'locations',
      'npcs',
      'timeline',
      'artifacts',
      'bestiary',
      'religions',
      'dramaBonds',
      'ontology',
    ];

    if (!validCollections.includes(resource)) {
      return NextResponse.json(
        { success: false, error: `Invalid collection: ${resource}` },
        { status: 400 }
      );
    }

    const result = await StoryRepository.updateLoreCollection(storyId, resource, data);

    if (!result.success) {
      const errorMsg = 'error' in result ? result.error : 'Failed to update lore collection';
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storyId,
      resource,
      isMock: 'isMock' in result ? result.isMock : false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
