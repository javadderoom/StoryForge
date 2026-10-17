import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SubQAdapter } from './SubQAdapter';

describe('SubQAdapter — Decisions API client', () => {
  it('reports isConfigured false when no API key is set', () => {
    const adapter = new SubQAdapter('');
    assert.equal(adapter.isConfigured(), false);
  });

  it('reports isConfigured true when an API key is provided', () => {
    const adapter = new SubQAdapter('test-subq-key-123');
    assert.equal(adapter.isConfigured(), true);
  });

  it('fails gracefully when evaluate is called without API key', async () => {
    const adapter = new SubQAdapter('');
    const res = await adapter.evaluate({
      state: 'The player tries to climb the wall.',
      questions: {
        feasibility: {
          type: 'score',
          instructions: 'Is this feasible?',
        },
      },
    });

    assert.equal(res.success, false);
    assert.match(res.error || '', /missing SUBQ_API_KEY/i);
    assert.deepEqual(res.answers, {});
  });

  it('handles simulated successful Decisions API response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.match(String(url), /api\.subq\.ai/);
      const auth = (init?.headers as Record<string, string>)?.['Authorization'];
      assert.equal(auth, 'Bearer mock-subq-key');

      return new Response(
        JSON.stringify({
          model: 'subq-snap-preview',
          answers: {
            escalate: { noul: false, probability: 0.12 },
            priority: { score: 4 },
            route: { choice: 'stealth_infiltrate' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof globalThis.fetch;

    try {
      const adapter = new SubQAdapter('mock-subq-key');
      const res = await adapter.evaluate({
        state: 'Player sneaking through the shadowy alley.',
        questions: {
          escalate: { type: 'noul', instructions: 'Escalate to combat?' },
          priority: { type: 'score', instructions: 'Tactical priority' },
          route: { type: 'choice', instructions: 'Route chosen' },
        },
      });

      assert.equal(res.success, true);
      assert.equal(res.model, 'subq-snap-preview');
      assert.equal(res.answers.priority.score, 4);
      assert.equal(res.answers.route.choice, 'stealth_infiltrate');
      assert.ok(typeof res.latencyMs === 'number');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles HTTP error responses from SubQ API', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response('Rate limit exceeded', { status: 429 });
    }) as unknown as typeof globalThis.fetch;

    try {
      const adapter = new SubQAdapter('mock-subq-key');
      const res = await adapter.evaluate({
        state: 'Test state',
        questions: {},
      });

      assert.equal(res.success, false);
      assert.match(res.error || '', /HTTP 429/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('aborts on the caller signal and reports caller cancellation distinctly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal?.aborted) {
        throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
      }
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))
        );
      });
    }) as unknown as typeof globalThis.fetch;

    try {
      const adapter = new SubQAdapter('mock-subq-key');
      const controller = new AbortController();
      const pending = adapter.evaluate(
        { state: 'Dwell prediction', questions: {} },
        { timeoutMs: 5000, signal: controller.signal }
      );
      controller.abort();
      const res = await pending;

      assert.equal(res.success, false);
      assert.match(res.error || '', /aborted by caller/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('still enforces the internal timeout when a caller signal is provided', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))
        );
      })) as unknown as typeof globalThis.fetch;

    try {
      const adapter = new SubQAdapter('mock-subq-key');
      const neverAborted = new AbortController(); // simulates a dwell window that stays open
      const res = await adapter.evaluate(
        { state: 'Dwell prediction', questions: {} },
        { timeoutMs: 25, signal: neverAborted.signal }
      );

      assert.equal(res.success, false);
      assert.match(res.error || '', /timed out after 25ms/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
