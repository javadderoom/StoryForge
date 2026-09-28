import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCorsOrigin, buildCorsHeaders, corsHeaders } from './cors';

/**
 * Regression tests for the CORS policy.
 *
 * The previous configuration was `Access-Control-Allow-Origin: '*'` together
 * with `Access-Control-Allow-Credentials: 'true'` in next.config.ts. That pair
 * is rejected by browsers per the Fetch spec, and the naive remediation —
 * reflecting the request Origin — would have credentialed every origin on the
 * internet and made the `token` cookie replayable from any site.
 */
describe('CORS policy', () => {
  const ORIGINAL = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = 'https://afsanehsaz.ir,https://story-forge-rouge.vercel.app,http://localhost:3000';
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = ORIGINAL;
  });

  describe('resolveCorsOrigin', () => {
    it('allows an explicitly allowlisted origin', () => {
      assert.equal(resolveCorsOrigin('https://afsanehsaz.ir'), 'https://afsanehsaz.ir');
      assert.equal(resolveCorsOrigin('https://story-forge-rouge.vercel.app'), 'https://story-forge-rouge.vercel.app');
    });

    it('allows a configured local dev origin', () => {
      assert.equal(resolveCorsOrigin('http://localhost:3000'), 'http://localhost:3000');
    });

    it('rejects an arbitrary origin', () => {
      assert.equal(resolveCorsOrigin('https://evil.example.com'), null);
    });

    it('rejects a subdomain-suffix trick (attacker-controlled prefix)', () => {
      // A naive `endsWith` or `includes` check would let this through.
      assert.equal(resolveCorsOrigin('https://story-forge-rouge.vercel.app.evil.com'), null);
      assert.equal(resolveCorsOrigin('https://evil.com/story-forge-rouge.vercel.app'), null);
    });

    it('rejects an origin that differs only by scheme or port', () => {
      assert.equal(resolveCorsOrigin('http://story-forge-rouge.vercel.app'), null);
      assert.equal(resolveCorsOrigin('https://story-forge-rouge.vercel.app:8443'), null);
    });

    it('rejects a missing origin', () => {
      assert.equal(resolveCorsOrigin(null), null);
      assert.equal(resolveCorsOrigin(''), null);
    });

    it('normalizes a trailing slash', () => {
      assert.equal(resolveCorsOrigin('http://localhost:3000/'), 'http://localhost:3000');
    });
  });

  describe('buildCorsHeaders', () => {
    it('emits a concrete origin plus credentials for an allowlisted origin', () => {
      const h = buildCorsHeaders(
        new Request('http://localhost:3000/api/play/stories', {
          headers: { Origin: 'http://localhost:3000' },
        })
      );
      assert.equal(h['Access-Control-Allow-Origin'], 'http://localhost:3000');
      assert.equal(h['Access-Control-Allow-Credentials'], 'true');
      assert.equal(h.Vary, 'Origin');
    });

    it('emits NO allow-origin and NO credentials for a disallowed origin', () => {
      const h = buildCorsHeaders(
        new Request('http://localhost:3000/api/play/stories', {
          headers: { Origin: 'https://evil.example.com' },
        })
      );
      assert.equal(h['Access-Control-Allow-Origin'], undefined);
      assert.equal(h['Access-Control-Allow-Credentials'], undefined);
    });

    it('never emits a wildcard origin, even with credentials allowed', () => {
      for (const origin of [
        'http://localhost:3000',
        'https://story-forge-rouge.vercel.app',
        'https://evil.example.com',
      ]) {
        const h = buildCorsHeaders(
          new Request('http://localhost:3000/api/play/stories', { headers: { Origin: origin } })
        );
        assert.notEqual(h['Access-Control-Allow-Origin'], '*');
      }
    });

    it('keeps Authorization allowed so the Bearer-only Flutter client works', () => {
      const h = buildCorsHeaders(null);
      assert.ok(h['Access-Control-Allow-Headers']?.includes('Authorization'));
    });

    it('keeps responses uncached', () => {
      assert.ok(buildCorsHeaders(null)['Cache-Control']?.includes('no-store'));
    });
  });

  describe('static corsHeaders fallback', () => {
    it('is safe to spread when a route forgets to pass the request', () => {
      // The old value was '*'. A route that forgets to thread `req` must still
      // not open the API to every origin.
      assert.notEqual(corsHeaders['Access-Control-Allow-Origin'], '*');
      assert.equal(corsHeaders['Access-Control-Allow-Credentials'], undefined);
    });
  });

  describe('ALLOWED_ORIGINS configuration', () => {
    it('falls back to local dev origins rather than a wildcard when unset', () => {
      delete process.env.ALLOWED_ORIGINS;
      assert.equal(resolveCorsOrigin('http://localhost:3000'), 'http://localhost:3000');
      assert.equal(resolveCorsOrigin('https://anything.example.com'), null);
    });

    it('trims whitespace and trailing slashes from the configured list', () => {
      process.env.ALLOWED_ORIGINS = '  https://a.example.com/ , https://b.example.com  ';
      assert.equal(resolveCorsOrigin('https://a.example.com'), 'https://a.example.com');
      assert.equal(resolveCorsOrigin('https://b.example.com'), 'https://b.example.com');
    });
  });
});
