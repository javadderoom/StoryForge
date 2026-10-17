import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { requireStudioWrite } from '@/lib/auth/studioAuth';
import { migrateStoryManifestToUnifiedGraph } from '@/lib/engines/world/graphMigration';
import { getActiveNpcsForLocation } from '@/lib/engines/world/tradeRoutes';
import {
  buildWorldContextBlocks,
  createContextTelemetry,
  formatWorldContext,
  normalizeScopeTier,
  resolveAccompanyingIds,
} from '@/lib/engines/narrative/worldContext';
import type { PlayerState } from '@/lib/types/gameplay';
import type { WorldLocation } from '@/lib/types/world';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/studio/sandbox/envelope — Plan 15 Phase 4: Studio Context
 * Envelope Inspector.
 *
 * Rebuilds the exact world-context envelope the play-time narrator uses for a
 * given (story, location, scope tier, party) and returns every include /
 * exclude / token-cap decision with an explicit reason, plus the rendered
 * prompt block string. Author-only (requireStudioWrite) because the envelope
 * embeds undiscovered secrets and hidden agendas that must never reach a
 * reader client — this endpoint is deliberately NOT wired into
 * /api/play/action responses.
 */

interface EnvelopeRequestBody {
  storyId?: string;
  locationId?: string;
  subZoneId?: string;
  scopeTier?: string;
  chapterNumber?: number;
  accompanyingNpcIds?: string[];
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(req: NextRequest) {
  try {
    // Gated: returns the full pruned World Bible blocks (hidden faction
    // agendas, NPC secrets) — author/admin surface only.
    const guard = await requireStudioWrite(req);
    if (!guard.ok) return guard.response;

    const body = (await req.json()) as EnvelopeRequestBody;
    const storyId = typeof body?.storyId === 'string' ? body.storyId : '';
    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    const rawStory = await StoryRepository.getStoryById(storyId);
    if (!rawStory) {
      return NextResponse.json(
        { success: false, error: 'Story not found (or database inactive)' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }
    // Same canonicalization the play path applies before envelope assembly.
    const story = migrateStoryManifestToUnifiedGraph(rawStory);

    const wb = story.worldBible;
    const fallbackLocationId =
      (typeof story.initialStoryBeats?.[0]?.locationId === 'string' &&
        story.initialStoryBeats[0].locationId) ||
      wb?.locations?.[0]?.id ||
      'loc_default';
    const locationId =
      (typeof body?.locationId === 'string' && body.locationId) || fallbackLocationId;
    const scopeTier = normalizeScopeTier(body?.scopeTier);
    const currentChapterNumber =
      typeof body?.chapterNumber === 'number' && body.chapterNumber > 0
        ? Math.floor(body.chapterNumber)
        : undefined;

    // Party roster: explicit caller selection wins; otherwise resolve the
    // roster the play path would resolve (companion ledger fallback).
    const fakePlayerState = {
      accompanyingNpcIds: Array.isArray(body?.accompanyingNpcIds) ? body.accompanyingNpcIds : undefined,
    } as unknown as PlayerState;
    const accompanyingNpcIds = resolveAccompanyingIds(fakePlayerState, story.saga?.ledger ?? null);

    // Scene NPC set mirrors assembleSceneEnvelope: location residents + party.
    const location: WorldLocation | undefined = wb?.locations?.find((l) => l.id === locationId);
    const { activeNpcIds } = getActiveNpcsForLocation(
      locationId,
      wb,
      story.language === 'fa' ? 'fa' : 'en'
    );

    const telemetry = createContextTelemetry();
    const startedAt = Date.now();
    const blocks = buildWorldContextBlocks(story, {
      scopeTier,
      locationIds: [locationId],
      npcIds: activeNpcIds,
      accompanyingNpcIds,
      currentChapterNumber,
      telemetry,
    });
    const elapsedMs = Date.now() - startedAt;

    const subZone =
      typeof body?.subZoneId === 'string' && body.subZoneId
        ? location?.subZones?.find((z) => z.id === body.subZoneId)
        : undefined;

    const counts = {
      included: telemetry.included.length,
      excluded: telemetry.excluded.length,
      truncatedEntries: telemetry.truncated.length,
      truncatedEntities: telemetry.truncated.reduce((sum, t) => sum + t.withheld, 0),
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          storyId,
          locationId,
          locationName: location?.name,
          subZone: subZone ? { id: subZone.id, name: subZone.name, subType: subZone.subType } : null,
          scopeTier,
          currentChapterNumber,
          partySize: accompanyingNpcIds.length,
          elapsedMs,
          counts,
          included: telemetry.included,
          excluded: telemetry.excluded,
          truncated: telemetry.truncated,
          sectionCounts: Object.fromEntries(
            Object.entries(blocks)
              .filter(([, v]) => Array.isArray(v))
              .map(([k, v]) => [k, (v as unknown[]).length])
          ),
          prompt: formatWorldContext(blocks),
        },
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (err) {
    console.error('studio/sandbox/envelope failed:', err);
    return NextResponse.json(
      { success: false, error: 'Envelope inspection failed' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
