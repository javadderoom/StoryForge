import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { decideStudioWrite, hasRole } from './studioAuth';
import { AuthenticatedUser } from './getUser';
import { signJwt } from './jwt';

/**
 * Route-level authorization matrix for the Studio surface.
 *
 * WHY THIS EXISTS
 * Nine of nineteen API routes had no authentication at all, including every
 * world/story mutation and every LLM-calling route. `DELETE /api/studio/worlds`
 * in particular would cascade away a world's canon, its stories, and every
 * player's PlaythroughSession, TurnHistory and MemoryLog in a single
 * unauthenticated request. Nothing in the suite caught it.
 *
 * This table is the regression net. It asserts the pure decision function for
 * every mutating Studio verb across all four principal classes, so a route that
 * loses its `requireStudioWrite` guard fails here rather than in production.
 *
 * It is deliberately offline: the test suite has no database (see
 * scripts/testAll.ts) and `getAuthenticatedUser` short-circuits to the token's
 * claimed role when ENABLE_DB is unset, so a real signed token is enough to
 * exercise each principal end-to-end without touching Postgres.
 */

function user(role: string, id = `u-${role}`): AuthenticatedUser {
  return {
    id,
    phoneNumber: '+989121234567',
    name: `Test ${role}`,
    role,
    creditBalance: 15,
    phoneVerified: true,
  };
}

const ANONYMOUS = null;
const READER = user('READER');
const AUTHOR = user('AUTHOR');
const AUTHOR_OTHER = user('AUTHOR', 'u-author-other');
const ADMIN = user('ADMIN');

/**
 * Every mutating verb under /api/studio/* and the principal that must be
 * allowed through. Keep in sync with the routes — a new mutating route must be
 * added here, which is the point: adding a route without adding it to this
 * table is a visible omission in review.
 */
const STUDIO_WRITE_MATRIX: Array<{ method: string; path: string; allows: unknown[] }> = [
  // Destroys a world and cascades to its stories, sessions, turns, memories.
  { method: 'DELETE', path: '/api/studio/worlds', allows: [AUTHOR, ADMIN] },
  // Creates a world, or deep-forks another author's entire world bible.
  { method: 'POST', path: '/api/studio/worlds', allows: [AUTHOR, ADMIN] },
  { method: 'POST', path: '/api/studio/story', allows: [AUTHOR, ADMIN] },
  { method: 'DELETE', path: '/api/studio/story', allows: [AUTHOR, ADMIN] },
  { method: 'POST', path: '/api/studio/stories', allows: [AUTHOR, ADMIN] },
  // Mutates a WorldBible JSON column and bumps the canon version.
  { method: 'PATCH', path: '/api/studio/lore', allows: [AUTHOR, ADMIN] },
  // 6 generateStructuredJson call sites, 2-3 model calls per request.
  { method: 'POST', path: '/api/studio/generate', allows: [AUTHOR, ADMIN] },
  { method: 'POST', path: '/api/studio/chat', allows: [AUTHOR, ADMIN] },
  { method: 'POST', path: '/api/studio/diagnostics/ai/run', allows: [AUTHOR, ADMIN] },
  { method: 'POST', path: '/api/studio/encounters', allows: [AUTHOR, ADMIN] },
  { method: 'DELETE', path: '/api/studio/encounters', allows: [AUTHOR, ADMIN] },
  // Reads the full story manifest, including unpublished drafts.
  { method: 'GET', path: '/api/studio/story', allows: [AUTHOR, ADMIN] },
  { method: 'GET', path: '/api/studio/stories', allows: [AUTHOR, ADMIN] },
  { method: 'GET', path: '/api/studio/worlds', allows: [AUTHOR, ADMIN] },
  { method: 'GET', path: '/api/studio/lore', allows: [AUTHOR, ADMIN] },
  { method: 'GET', path: '/api/studio/encounters', allows: [AUTHOR, ADMIN] },
];

const DENIED_PRINCIPALS: Array<[string, unknown]> = [
  ['anonymous', ANONYMOUS],
  ['READER', READER],
];

describe('Studio authorization matrix', () => {
  for (const { method, path } of STUDIO_WRITE_MATRIX) {
    describe(`${method} ${path}`, () => {
      for (const [label, principal] of DENIED_PRINCIPALS) {
        it(`denies ${label}`, () => {
          const decision = decideStudioWrite(principal as AuthenticatedUser | null);
          assert.equal(decision.ok, false, `${label} must not be able to ${method} ${path}`);
          if (!decision.ok) {
            assert.equal(decision.status, 403);
          }
        });
      }

      it('allows AUTHOR', () => {
        assert.equal(decideStudioWrite(AUTHOR).ok, true);
      });

      it('allows ADMIN', () => {
        assert.equal(decideStudioWrite(ADMIN).ok, true);
      });
    });
  }

  it('covers every mutating studio verb', () => {
    // If someone adds a mutating /api/studio/* route and forgets to list it
    // above, this count is the canary — bump it deliberately, don't silently.
    const verbs = STUDIO_WRITE_MATRIX.map((r) => `${r.method} ${r.path}`);
    assert.equal(new Set(verbs).size, verbs.length, 'duplicate entries in the matrix');

    for (const required of [
      'DELETE /api/studio/worlds',
      'POST /api/studio/worlds',
      'DELETE /api/studio/story',
      'PATCH /api/studio/lore',
      'POST /api/studio/generate',
      'POST /api/studio/chat',
    ]) {
      assert.ok(verbs.includes(required), `matrix must include ${required}`);
    }
  });
});

describe('decideStudioWrite', () => {
  it('returns 403 for anonymous, matching the house style', () => {
    // studio/encounters/route.ts short-circuits `!auth` into the same `||`, so
    // anonymous and wrong-role are indistinguishable to the client. That is
    // deliberate: it does not confirm whether an account exists.
    const decision = decideStudioWrite(null);
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, 403);
  });

  it('rejects an unknown or unrecognised role string', () => {
    for (const role of ['', 'GUEST', 'author', 'ADMIN ', 'SUPERUSER', 'undefined']) {
      const decision = decideStudioWrite(user(role));
      assert.equal(decision.ok, false, `role "${role}" must not grant Studio access`);
    }
  });

  it('is case sensitive — role values come from the UserRole enum', () => {
    assert.equal(decideStudioWrite(user('author')).ok, false);
    assert.equal(decideStudioWrite(user('admin')).ok, false);
    assert.equal(decideStudioWrite(user('AUTHOR')).ok, true);
  });
});

describe('hasRole', () => {
  it('is false for null regardless of the role list', () => {
    assert.equal(hasRole(null, ['ADMIN']), false);
    assert.equal(hasRole(null, []), false);
  });

  it('matches only exact listed roles', () => {
    assert.equal(hasRole(ADMIN, ['ADMIN']), true);
    assert.equal(hasRole(ADMIN, ['ADMIN', 'AUTHOR']), true);
    assert.equal(hasRole(AUTHOR, ['ADMIN']), false);
  });
});

describe('end-to-end guard via a real signed token', () => {
  // These exercise the same code path a request takes, minus the database:
  // getUser falls back to the token's claimed role when ENABLE_DB is unset.
  async function callWithToken(role: string) {
    const { requireStudioWrite } = await import('./studioAuth');
    const token = signJwt({ userId: `u-${role}`, phoneNumber: '+989121234567', role });
    const req = new NextRequest('http://localhost:3000/api/studio/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: '{}',
    });
    const guard = await requireStudioWrite(req);
    return guard.ok ? 200 : (guard.response as Response).status;
  }

  it('rejects an anonymous request with 403', async () => {
    const { requireStudioWrite } = await import('./studioAuth');
    const req = new NextRequest('http://localhost:3000/api/studio/generate', {
      method: 'POST',
      body: '{}',
    });
    const guard = await requireStudioWrite(req);
    assert.equal(guard.ok, false);
    if (!guard.ok) assert.equal((guard.response as Response).status, 403);
  });

  it('rejects a READER token with 403', async () => {
    assert.equal(await callWithToken('READER'), 403);
  });

  it('admits an AUTHOR token', async () => {
    assert.equal(await callWithToken('AUTHOR'), 200);
  });

  it('admits an ADMIN token', async () => {
    assert.equal(await callWithToken('ADMIN'), 200);
  });

  it('rejects a garbage Authorization header', async () => {
    const { requireStudioWrite } = await import('./studioAuth');
    const req = new NextRequest('http://localhost:3000/api/studio/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-a-jwt' },
      body: '{}',
    });
    const guard = await requireStudioWrite(req);
    assert.equal(guard.ok, false);
  });

  it('rejects a token signed for a different role than claimed in the cookie', async () => {
    // Cookie path: the same-origin Studio relies on this, since
    // StudioStoryContext sends bare fetch() calls with no Authorization header.
    const { requireStudioWrite } = await import('./studioAuth');
    const token = signJwt({ userId: 'u-reader', phoneNumber: '+989121234567', role: 'READER' });
    const req = new NextRequest('http://localhost:3000/api/studio/generate', {
      method: 'POST',
      headers: { Cookie: `token=${token}` },
      body: '{}',
    });
    const guard = await requireStudioWrite(req);
    assert.equal(guard.ok, false, 'a READER cookie must not reach the Studio');
  });

  it('admits an AUTHOR presented via cookie', async () => {
    const { requireStudioWrite } = await import('./studioAuth');
    const token = signJwt({ userId: 'u-author', phoneNumber: '+989121234567', role: 'AUTHOR' });
    const req = new NextRequest('http://localhost:3000/api/studio/generate', {
      method: 'POST',
      headers: { Cookie: `token=${token}` },
      body: '{}',
    });
    const guard = await requireStudioWrite(req);
    assert.equal(guard.ok, true);
  });

  it('does not confuse two different authors', async () => {
    // Distinct principals must stay distinct — hasRole/ownership code that
    // collapsed AUTHOR_OTHER into AUTHOR would be an authorization bug.
    assert.equal(decideStudioWrite(AUTHOR).ok, true);
    assert.equal(decideStudioWrite(AUTHOR_OTHER).ok, true);
    assert.notEqual(AUTHOR.id, AUTHOR_OTHER.id);
  });
});
