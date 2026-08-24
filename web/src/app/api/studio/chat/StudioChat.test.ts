import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';
import { NextRequest } from 'next/server';

function createMockRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/studio/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('StudioChat API - AI Oracle (Context-Aware)', () => {
  let originalFetch: any;
  const captured: any[] = [];

  before(() => {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    originalFetch = global.fetch;
    global.fetch = (async (_url: any, init: any) => {
      captured.push(init);
      const replyText =
        'Here is my answer, grounded in your lore.\n\n```storyforge-action\n' +
        '{"op":"create","entity":"faction","prompt":"A smuggler syndicate controlling the harbor"}\n' +
        '```';
      return {
        status: 200,
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: replyText }] } }],
        }),
      };
    }) as any;
  });

  after(() => {
    global.fetch = originalFetch;
  });

  it('rejects requests with no messages (400)', async () => {
    const req = createMockRequest({ worldContext: '', isPersian: false });
    const res = await POST(req);
    assert.equal(res.status, 400);
  });

  it('returns a grounded Oracle reply and injects the world context into the prompt', async () => {
    captured.length = 0;
    const req = createMockRequest({
      messages: [{ role: 'user', content: 'Summarize my factions' }],
      worldContext: 'FACTIONS:\n- The Lead-Soled Brotherhood',
      isPersian: false,
    });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.match(json.reply, /storyforge-action/);
    assert.ok(captured.length >= 1, 'should have called the Gemini endpoint');

    const sentBody = JSON.parse(captured[0].body);
    const systemText = sentBody.systemInstruction.parts[0].text;
    assert.match(systemText, /Lead-Soled Brotherhood/, 'world context must be injected');
    assert.match(systemText, /storyforge-action/, 'action protocol must be instructed');

    const lastUser = [...sentBody.contents].reverse().find((c: any) => c.role === 'user');
    assert.match(lastUser.parts[0].text, /Summarize my factions/);
  });

  it('localizes the Oracle system prompt for Persian', async () => {
    captured.length = 0;
    const req = createMockRequest({
      messages: [{ role: 'user', content: 'خلاصه جناح‌ها' }],
      worldContext: '',
      isPersian: true,
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const sentBody = JSON.parse(captured[0].body);
    const systemText = sentBody.systemInstruction.parts[0].text;
    assert.match(systemText, /جهان‌سازی/);

  });

  it('injects the selected persona prompt and focused-entity context', async () => {
    captured.length = 0;
    const req = createMockRequest({
      messages: [{ role: 'user', content: 'Stress-test my magic system' }],
      worldContext: 'LAWS:\n- Blood magic petrifies the caster into basalt',
      isPersian: false,
      persona: 'cosmologist',
      activeEntityContext: '{"id":"law_1","rule":"Blood magic petrifies the caster into basalt"}',

    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.persona, 'cosmologist');
    const sentBody = JSON.parse(captured[0].body);
    const systemText = sentBody.systemInstruction.parts[0].text;
    assert.match(systemText, /COSMOLOGIST/i, 'persona core must be injected');
    assert.match(systemText, /FOCUSED ENTITY/, 'focused-entity context must be injected');
    assert.match(systemText, /law_1/, 'focused entity JSON must appear');
  });

  it('falls back to the oracle persona for an unknown persona id', async () => {
    captured.length = 0;
    const req = createMockRequest({
      messages: [{ role: 'user', content: 'hi' }],
      worldContext: '',
      isPersian: false,
      persona: 'banana',
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.persona, 'oracle');
  });

  it('injects permanent author directives and canon memories into system instruction', async () => {
    captured.length = 0;
    const req = createMockRequest({
      messages: [{ role: 'user', content: 'Advise me on emperor' }],
      worldContext: '',
      isPersian: false,
      persona: 'oracle',
      directives: [
        {
          id: 'dir_1',
          directive: 'The Silver Emperor is secretly an automaton',
          category: 'canon_fact',
          isActive: true,
        },
      ],
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const sentBody = JSON.parse(captured[0].body);
    const systemText = sentBody.systemInstruction.parts[0].text;
    assert.match(systemText, /PERMANENT AUTHOR DIRECTIVES/i, 'directives header must appear');
    assert.match(systemText, /Silver Emperor is secretly an automaton/, 'directive content must appear');
  });
});
