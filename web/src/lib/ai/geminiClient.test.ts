import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonPayload, generateStructuredJson } from './geminiClient';

describe('extractJsonPayload', () => {
  it('passes clean JSON through untouched', () => {
    assert.equal(extractJsonPayload('{"a":1}'), '{"a":1}');
  });

  it('strips fenced blocks with or without the json tag', () => {
    assert.equal(extractJsonPayload('```json\n{"a":1}\n```'), '{"a":1}');
    assert.equal(extractJsonPayload('```\n{"a":1}\n```\n'), '{"a":1}');
  });

  it('tolerates leading prose and trailing junk', () => {
    assert.equal(
      extractJsonPayload('Sure thing!\n{"a":1}\nHope this helps.'),
      '{"a":1}'
    );
    assert.equal(
      extractJsonPayload('```json\n{"a":1}\n```\nGenerated with care.'),
      '{"a":1}'
    );
  });

  it('returns input unchanged when no brackets exist', () => {
    assert.equal(extractJsonPayload('no json here'), 'no json here');
  });
});

describe('generateStructuredJson thinking budget', () => {
  /** Runs one generation with a stubbed fetch and returns the request body. */
  async function captureBody(
    options: Parameters<typeof generateStructuredJson>[2]
  ): Promise<any> {
    const previousKey = process.env.GEMINI_API_KEY;
    const originalFetch = globalThis.fetch;
    const bodies: any[] = [];
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = (async (_url: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      } as any;
    }) as any;
    try {
      await generateStructuredJson('prompt', 'system', options);
      return bodies[0];
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  }

  it('sends the native thinkingConfig budget when a tier asks for one', async () => {
    const body = await captureBody({
      taskType: 'scene',
      preferredModel: 'gemini-3.8-flash' as never,
      thinkingBudgetTokens: 2048,
    });
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 2048);
  });

  it('keeps thinking switched off (budget 0) when no budget is configured', async () => {
    const body = await captureBody({
      taskType: 'scene',
      preferredModel: 'gemini-3.8-flash' as never,
    });
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
  });

  it('omits thinkingConfig for models that reject it (lite family)', async () => {
    const body = await captureBody({
      taskType: 'scene',
      preferredModel: 'gemini-3.5-flash-lite' as never,
      thinkingBudgetTokens: 2048,
    });
    assert.equal(
      body.generationConfig.thinkingConfig,
      undefined,
      'lite models answer HTTP 400 when thinkingConfig is supplied'
    );
  });
});
