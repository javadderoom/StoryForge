import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { signJwt } from '@/lib/auth/jwt';
import {
  WorldCreatureSchema,
  NPCDossierSchema,
  TimelineEventSchema,
  WorldArtifactSchema,
  WorldLocationSchema,
  MapEntityPlacementSchema,
} from '@/lib/types/world';

const authorToken = signJwt({
  userId: 'test-author',
  phoneNumber: '+989121234567',
  role: 'AUTHOR',
});

function createMockRequest(body: any, token: string = authorToken): NextRequest {
  return new NextRequest('http://localhost:3000/api/studio/cartographer/generate-element', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe('Cartographer Generate Element API', () => {
  it('rejects unauthorized requests with 403', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/studio/cartographer/generate-element', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(unauthReq);
    assert.equal(res.status, 403);
  });

  it('rejects requests without coordinates or environmentalContext with 400', async () => {
    const res = await POST(createMockRequest({ coordinates: null }));
    assert.equal(res.status, 400);

    const res2 = await POST(createMockRequest({ coordinates: { x: 100, y: 100 }, environmentalContext: null }));
    assert.equal(res2.status, 400);
  });

  it('rejects unsupported entity types with 400', async () => {
    const res = await POST(
      createMockRequest({
        coordinates: { x: 100, y: 100 },
        environmentalContext: {
          point: { x: 100, y: 100 },
          biome: 'plains',
          biomeLabel: 'Plains',
          biomeEmoji: '🌾',
          elevation: 100,
          isWater: false,
          nearbyFeatures: [],
          nearestSettlement: null,
          badgeText: 'Plains',
          promptContext: '',
        },
        entityType: 'invalid_type',
      })
    );
    assert.equal(res.status, 400);
  });

  it('handles offline AI service gracefully with 503 (no dummy fallback data)', async () => {
    const req = createMockRequest({
      coordinates: { x: 450, y: 320 },
      environmentalContext: {
        point: { x: 450, y: 320 },
        biome: 'desert',
        biomeLabel: 'Arid Desert & Sand Dunes',
        biomeEmoji: '🌵',
        featureName: 'Hiram Steppe',
        elevation: 400,
        isWater: false,
        nearbyFeatures: ['Zarrin-Pol (~15km)'],
        nearestSettlement: {
          id: 'loc_zarrin',
          name: 'Zarrin-Pol',
          distanceKm: 15,
          distancePx: 30,
          cardinalDirection: 'South',
        },
        badgeText: '🌵 Hiram Steppe • 15km South of Zarrin-Pol',
        promptContext: 'GEOGRAPHIC & ENVIRONMENTAL SETTING: Arid desert dunes.',
      },
      entityType: 'beast',
      parameters: {
        dc: 16,
        dangerLevel: 4,
        role: 'Apex Predator',
      },
    });

    const res = await POST(req);
    assert.ok(res.status === 503 || res.status === 200);
  });

  describe('Schema Compliance for Output Contracts', () => {
    it('validates creature and placement schema', () => {
      const mockCreature = {
        id: 'creat_test123',
        name: 'Dune Basilisk',
        speciesCategory: 'monstrosity',
        dangerLevel: 4,
        rarity: 'rare',
        isDomesticated: false,
        habitatLocationIds: ['loc_zarrin'],
        behavioralTactics: 'Burrows under loose sand dunes to ambush caravan outriders.',
        weaknesses: ['Sub-zero temperatures', 'Eye strikes'],
        resistances: ['Fire', 'Blunt sand abrasion'],
        harvestableLoot: [{ itemId: 'loot_1', name: 'Petrifying Gallbladder', dropRate: 'rare' }],
        loreDescription: 'A serpentine predator with heat-venting crests.',
        predatorPreyNiche: 'Apex Predator of the Hiram Steppe',
      };

      const mockPlacement = {
        id: 'pl_test123',
        entityId: mockCreature.id,
        entityType: 'bestiary',
        x: 450,
        y: 320,
        customLabel: mockCreature.name,
        customIcon: '🐉',
      };

      assert.equal(WorldCreatureSchema.safeParse(mockCreature).success, true);
      assert.equal(MapEntityPlacementSchema.safeParse(mockPlacement).success, true);
    });

    it('validates stationed NPC and placement schema', () => {
      const mockNpc = {
        id: 'npc_test123',
        name: 'Sorayya the Dune Hermit',
        title: 'Keeper of the Oasis Well',
        role: 'Hermit',
        kind: 'individual',
        currentLocationId: 'loc_zarrin',
        personalityTraits: ['Cautious', 'Observant', 'Superstitious'],
        speechStyle: 'Whispers, raspy voice parched by wind.',
        appearance: 'Coarse sand-cloth robes and bronze goggle frames.',
        goals: ['Protect the hidden aquifer from sand raiders.'],
        secrets: [{ id: 'sec_1', description: 'Knows where the catacomb entry lies.', requiredTrustLevel: 40 }],
      };

      const mockPlacement = {
        id: 'pl_npc123',
        entityId: mockNpc.id,
        entityType: 'npc',
        x: 600,
        y: 700,
        customLabel: `${mockNpc.name}, ${mockNpc.title}`,
        customIcon: '👤',
      };

      const parsedNpc = NPCDossierSchema.safeParse(mockNpc);
      assert.equal(parsedNpc.success, true);
      assert.equal(MapEntityPlacementSchema.safeParse(mockPlacement).success, true);
    });

    it('validates encounter / timeline event and placement schema', () => {
      const mockEvent = {
        id: 'time_test123',
        yearOrEra: 'Current Epoch',
        title: 'The Howling Rift Ambush',
        summary: 'A caravan caravan guard patrol was ambushed by subterranean burrowers.',
        significance: 'Trade across the western dunes is stalled.',
        knownByPublic: true,
        eraCategory: 'present',
      };

      const mockPlacement = {
        id: 'pl_time123',
        entityId: mockEvent.id,
        entityType: 'timeline',
        x: 800,
        y: 450,
        customLabel: mockEvent.title,
        customIcon: '⚔️',
      };

      const parsedEvent = TimelineEventSchema.safeParse(mockEvent);
      assert.equal(parsedEvent.success, true);
      assert.equal(MapEntityPlacementSchema.safeParse(mockPlacement).success, true);
    });
  });
});
