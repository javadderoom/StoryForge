import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';
import { NextRequest } from 'next/server';
import {
  WorldLocationSchema,
  NPCDossierSchema,
  WorldArtifactSchema,
  WorldCreatureSchema,
  WorldDeitySchema,
  TimelineEventSchema,
  WorldLawSchema,
} from '../../../../lib/types/world';

function createMockRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('StudioGenerate API - AI Co-Pilot & Procedural Synthesis Engine', () => {
  const types = [
    { type: 'location', schema: WorldLocationSchema },
    { type: 'npc', schema: NPCDossierSchema },
    { type: 'artifact', schema: WorldArtifactSchema },
    { type: 'creature', schema: WorldCreatureSchema },
    { type: 'deity', schema: WorldDeitySchema },
    { type: 'timeline_event', schema: TimelineEventSchema },
    { type: 'world_law', schema: WorldLawSchema },
  ] as const;

  describe('Persian (Farsi) Generation', () => {
    types.forEach(({ type, schema }) => {
      it(`generates schema-compliant ${type} in Persian`, async () => {
        const req = createMockRequest({ type, isPersian: true });
        const res = await POST(req);
        assert.equal(res.status, 200);

        const json = await res.json();
        assert.equal(json.success, true);
        assert.ok(json.data, `Expected data payload for ${type}`);

        // Validate payload against Zod schema
        const parseResult = schema.safeParse(json.data);
        if (!parseResult.success) {
          console.error(`Validation failure for ${type}:`, parseResult.error.format());
        }
        assert.equal(parseResult.success, true, `Generated ${type} must conform to schema`);
      });
    });
  });

  describe('English Generation', () => {
    types.forEach(({ type, schema }) => {
      it(`generates schema-compliant ${type} in English`, async () => {
        const req = createMockRequest({ type, isPersian: false });
        const res = await POST(req);
        assert.equal(res.status, 200);

        const json = await res.json();
        assert.equal(json.success, true);
        assert.ok(json.data, `Expected data payload for ${type}`);

        const parseResult = schema.safeParse(json.data);
        assert.equal(parseResult.success, true, `Generated English ${type} must conform to schema`);
      });
    });
  });
});
