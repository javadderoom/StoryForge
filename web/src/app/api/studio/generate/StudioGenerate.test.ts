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
import { z } from 'zod';

function createMockRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const WorldSynthesisSchema = z.object({
  worldName: z.string().min(2),
  summary: z.string().min(5),
  themeNotes: z.string(),
  aiSystemPrompt: z.string().optional(),
  laws: z.array(z.any()).default([]),
  factions: z.array(z.any()).default([]),
});

const SceneSynthesisSchema = z.object({
  sceneId: z.string(),
  locationId: z.string(),
  narrativeText: z.string().min(5),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1),
      style: z.enum(['defensive', 'agile', 'aggressive', 'diplomatic', 'inquisitive']),
      riskLevel: z.enum(['low', 'medium', 'high']),
      targetDC: z.number().optional(),
      requiredStatId: z.string().optional(),
    })
  ).min(1),
});

describe('StudioGenerate API - AI Co-Pilot & Procedural Synthesis Engine', () => {
  const types = [
    { type: 'world', schema: WorldSynthesisSchema },
    { type: 'location', schema: WorldLocationSchema },
    { type: 'npc', schema: NPCDossierSchema },
    { type: 'artifact', schema: WorldArtifactSchema },
    { type: 'creature', schema: WorldCreatureSchema },
    { type: 'deity', schema: WorldDeitySchema },
    { type: 'timeline_event', schema: TimelineEventSchema },
    { type: 'world_law', schema: WorldLawSchema },
    { type: 'scene', schema: SceneSynthesisSchema },
  ] as const;

  describe('Persian (Farsi) Generation with Custom System Prompt', () => {
    types.forEach(({ type, schema }) => {
      it(`generates schema-compliant ${type} in Persian`, async () => {
        const req = createMockRequest({
          type,
          isPersian: true,
          customSystemPrompt: 'تو راوی ارشد هستی.',
          taskType: type === 'world' ? 'world' : 'scene',
        });
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

  describe('English Generation with Custom System Prompt', () => {
    types.forEach(({ type, schema }) => {
      it(`generates schema-compliant ${type} in English`, async () => {
        const req = createMockRequest({
          type,
          isPersian: false,
          customSystemPrompt: 'You are the Master Storyteller.',
          taskType: type === 'world' ? 'world' : 'scene',
        });
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

  describe('Edit Mode with Existing Entity Payload', () => {
    it('generates schema-compliant deity update when editing existing entity', async () => {
      const existingDeity = {
        id: 'deity_artavan_01',
        name: 'آرتاوان',
        title: 'ایزد نظم و آغاز بیبدل',
        domain: 'light',
        sacredSymbol: 'نماد خورشید زرین و زنجیر زرین',
        coreDogma: 'اصول اولیه',
        taboos: ['شک در آفرینش'],
        divineBlessings: ['نور حقیقت'],
        affiliatedFactionIds: [],
        holyLocationIds: [],
      };

      const requestedChange = 'اصول دین را با ۵ اصل جدید جایگزین کن: ۱. آغاز بیبدل ۲. کنترل آگاهی ۳. حقیقت بسته ۴. پاسداری از زنجیرها ۵. سکوت';
      const editPrompt = `Current entity JSON:\n${JSON.stringify(existingDeity, null, 2)}\n\nRequested changes to apply:\n${requestedChange}\n\nReturn the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Output valid JSON only matching the entity schema.`;
      const editSystem = 'تو در حال ویرایش یک موجودیت موجود هستی. خروجی را به صورت شیء JSON کامل شامل تمام فیلدهای پیشین (با اعمال تغییرات) برگردان. نام و شناسه را حفظ کن. فقط JSON معتبر خروجی بده.\n\n';

      const req = createMockRequest({
        type: 'deity',
        isPersian: true,
        prompt: requestedChange,
        customSystemPrompt: editSystem + editPrompt,
      });

      const res = await POST(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data, 'Expected data payload for deity update');

      const parseResult = WorldDeitySchema.safeParse(json.data);
      assert.equal(parseResult.success, true, 'Updated deity must conform to WorldDeitySchema');
    });
  });
});
