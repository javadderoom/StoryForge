import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJsonPayload,
  generateStructuredJson,
  getGeminiApiKeys,
  resetGeminiKeyRotationForTests,
} from './geminiClient';
import { GeminiAdapter } from '../providers/GeminiAdapter';
import { isProviderConfigured } from '../providers/narrativeAdapterFactory';

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

  it('maps Gemini 4 thinking budgets onto native thinkingLevel (never MINIMAL)', async () => {
    const lowBody = await captureBody({
      taskType: 'scene',
      preferredModel: 'gemini-4-hydrogen',
      thinkingBudgetTokens: 256,
    });
    assert.deepEqual(lowBody.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });

    const defaultBody = await captureBody({
      taskType: 'scene',
      preferredModel: 'gemini-4-hydrogen',
    });
    assert.deepEqual(defaultBody.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });

    const medBody = await captureBody({
      taskType: 'scene',
      preferredModel: 'gemini-4-hydrogen',
      thinkingBudgetTokens: 2048,
    });
    assert.deepEqual(medBody.generationConfig.thinkingConfig, { thinkingLevel: 'MEDIUM' });
  });

  it('retries transient HTTP 503 on pinned preferredModel before cascading', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    const originalFetch = globalThis.fetch;
    const seenUrls: string[] = [];
    let calls = 0;
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = (async (url: any) => {
      calls++;
      seenUrls.push(String(url));
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => 'high demand',
        } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      } as any;
    }) as any;
    try {
      const result = await generateStructuredJson('prompt', 'system', {
        taskType: 'scene',
        preferredModel: 'gemini-4-hydrogen',
        retryDelayMs: 0,
      });
      assert.ok(result);
      assert.equal(result.modelUsed, 'gemini-4-hydrogen');
      assert.equal(calls, 2);
      assert.ok(seenUrls[0].includes('gemini-4-hydrogen'));
      assert.ok(seenUrls[1].includes('gemini-4-hydrogen'));
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });
});

function withSavedGeminiEnv(fn: () => Promise<void> | void): () => Promise<void> {
  return async () => {
    const keys = [
      'GEMINI_API_KEYS',
      'GEMINI_API_KEY',
      'GEMINI_API_KEY_2',
      'GEMINI_API_KEY_3',
      'GEMINI_API_KEY_4',
    ] as const;
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetGeminiKeyRotationForTests();
    try {
      await fn();
    } finally {
      resetGeminiKeyRotationForTests();
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  };
}

describe('multi-key Gemini round-robin rotation', () => {
  it(
    'collects and deduplicates GEMINI_API_KEY, GEMINI_API_KEY_2..4, and GEMINI_API_KEYS',
    withSavedGeminiEnv(() => {
      assert.deepEqual(getGeminiApiKeys(), []);
      assert.equal(isProviderConfigured('gemini'), false);

      process.env.GEMINI_API_KEY_2 = 'key-two';
      assert.deepEqual(getGeminiApiKeys(), ['key-two']);
      assert.equal(isProviderConfigured('gemini'), true);

      process.env.GEMINI_API_KEY = 'key-one, key-two';
      process.env.GEMINI_API_KEYS = 'key-zero, key-one';
      assert.deepEqual(getGeminiApiKeys(), ['key-zero', 'key-one', 'key-two']);
    })
  );

  it(
    'alternates between two configured Gemini keys on consecutive generateStructuredJson calls',
    withSavedGeminiEnv(async () => {
      const originalFetch = globalThis.fetch;
      const seenKeys: string[] = [];
      process.env.GEMINI_API_KEY = 'alpha-key';
      process.env.GEMINI_API_KEY_2 = 'beta-key';

      globalThis.fetch = (async (url: any) => {
        const parsed = new URL(String(url));
        seenKeys.push(parsed.searchParams.get('key') ?? '');
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
        } as any;
      }) as any;

      try {
        await generateStructuredJson('p1', 'sys', { preferredModel: 'gemini-3.5-flash-lite' });
        await generateStructuredJson('p2', 'sys', { preferredModel: 'gemini-3.5-flash-lite' });
        await generateStructuredJson('p3', 'sys', { preferredModel: 'gemini-4-hydrogen' });
        assert.deepEqual(seenKeys, ['alpha-key', 'beta-key', 'alpha-key']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    })
  );

  it(
    'fails over immediately to the second Gemini key on HTTP 429 before cascading models',
    withSavedGeminiEnv(async () => {
      const originalFetch = globalThis.fetch;
      const calls: Array<{ url: string; key: string }> = [];
      process.env.GEMINI_API_KEY = 'alpha-key';
      process.env.GEMINI_API_KEY_2 = 'beta-key';

      globalThis.fetch = (async (url: any) => {
        const strUrl = String(url);
        const key = new URL(strUrl).searchParams.get('key') ?? '';
        calls.push({ url: strUrl, key });
        if (key === 'alpha-key') {
          return {
            ok: false,
            status: 429,
            text: async () => 'quota exceeded',
          } as any;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
        } as any;
      }) as any;

      try {
        const res = await generateStructuredJson('p1', 'sys', {
          preferredModel: 'gemini-3.5-flash-lite',
        });
        assert.ok(res);
        assert.equal(res.modelUsed, 'gemini-3.5-flash-lite');
        assert.deepEqual(
          calls.map((c) => c.key),
          ['alpha-key', 'beta-key']
        );
        assert.ok(calls[1].url.includes('gemini-3.5-flash-lite'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    })
  );

  it(
    'alternates and fails over across keys inside GeminiAdapter streaming scenes',
    withSavedGeminiEnv(async () => {
      process.env.GEMINI_API_KEY = 'alpha-key';
      process.env.GEMINI_API_KEY_2 = 'beta-key';

      const adapter = new GeminiAdapter(undefined, 'gemini-3.5-flash-lite', {
        preferredModel: 'gemini-3.5-flash-lite',
      });
      const usedOrder: string[] = [];
      let failAlpha = false;

      const makeStubClient = (label: string) => ({
        models: {
          generateContentStream: async () => {
            usedOrder.push(label);
            if (failAlpha && label === 'alpha-key') {
              throw new Error('429 RESOURCE_EXHAUSTED');
            }
            async function* gen() {
              yield { text: '{"narrative":"متن آزمایشی","choices":[]}' };
            }
            return gen();
          },
        },
      });

      (adapter as any).sdkClients.set('alpha-key', makeStubClient('alpha-key'));
      (adapter as any).sdkClients.set('beta-key', makeStubClient('beta-key'));

      const payload = { systemPrompt: 'sys', userPrompt: 'usr' } as any;
      const noopDelta = () => {};

      const r1 = await adapter.generateSceneRaw(payload, { onTextDelta: noopDelta });
      const r2 = await adapter.generateSceneRaw(payload, { onTextDelta: noopDelta });
      failAlpha = true;
      const r3 = await adapter.generateSceneRaw(payload, { onTextDelta: noopDelta });

      assert.equal(r1?.data.narrative, 'متن آزمایشی');
      assert.equal(r2?.data.narrative, 'متن آزمایشی');
      assert.equal(r3?.data.narrative, 'متن آزمایشی');
      assert.deepEqual(usedOrder, ['alpha-key', 'beta-key', 'alpha-key', 'beta-key']);
    })
  );
});
