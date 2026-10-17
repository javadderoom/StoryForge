process.env.ENABLE_DB = 'true';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from './route';

describe('POST /api/play/remake', () => {
  it('returns 400 when required arguments are missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/play/remake', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error, /required/);
  });

  it('returns 404 when session does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/play/remake', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'non_existent_session_99999',
        storyId: 'story_mt4ofllt',
        turnNumber: 2,
        issueType: 'repeated_event',
        reason: 'This event repeats the water rations conversation from last turn',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
  });
});
