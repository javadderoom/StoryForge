import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from './route';

describe('POST /api/play/session/reset', () => {
  it('returns 400 when storyId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/play/session/reset', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error, /storyId is required/);
  });

  it('handles reset gracefully for unauthenticated or zero-spend user', async () => {
    const req = new NextRequest('http://localhost:3000/api/play/session/reset', {
      method: 'POST',
      body: JSON.stringify({ storyId: 'story_mt4ofllt' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.refundedCredits, 0);
  });
});
