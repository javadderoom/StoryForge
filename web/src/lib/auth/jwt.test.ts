import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  normalizePhoneNumber,
  isValidIranianPhone,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
} from './jwt';

describe('Auth Utilities & JWT', () => {
  describe('Phone Number Normalization & Validation', () => {
    it('normalizes 09xxxxxxxxx to +989xxxxxxxxx', () => {
      assert.equal(normalizePhoneNumber('09123456789'), '+989123456789');
      assert.equal(normalizePhoneNumber('۰۹۱۲۳۴۵۶۷۸۹'), '+989123456789');
    });

    it('normalizes +98 or 0098 correctly', () => {
      assert.equal(normalizePhoneNumber('+989123456789'), '+989123456789');
      assert.equal(normalizePhoneNumber('00989123456789'), '+989123456789');
    });

    it('validates genuine Iranian mobile numbers', () => {
      assert.equal(isValidIranianPhone('09121234567'), true);
      assert.equal(isValidIranianPhone('+989351234567'), true);
      assert.equal(isValidIranianPhone('۰۹۹۰۱۲۳۴۵۶۷'), true);
      assert.equal(isValidIranianPhone('02112345678'), false); // Landline
      assert.equal(isValidIranianPhone('123456'), false);
    });
  });

  describe('Password Hashing & Salt Verification', () => {
    it('hashes passwords securely and verifies correctly', () => {
      const password = 'SecretPassword!123';
      const hash = hashPassword(password);

      assert.notEqual(hash, password);
      assert.ok(hash.includes(':'));
      assert.equal(verifyPassword(password, hash), true);
      assert.equal(verifyPassword('WrongPassword', hash), false);
    });
  });

  describe('JWT Signing & Verification', () => {
    it('signs and verifies payload correctly', () => {
      const payload = {
        userId: 'user_123',
        phoneNumber: '+989121234567',
        role: 'READER',
      };

      const token = signJwt(payload, 3600);
      assert.ok(token);

      const decoded = verifyJwt(token);
      assert.ok(decoded);
      assert.equal(decoded.userId, 'user_123');
      assert.equal(decoded.phoneNumber, '+989121234567');
      assert.equal(decoded.role, 'READER');
    });

    it('rejects tampered tokens', () => {
      const token = signJwt({ userId: 'u1', phoneNumber: '+98912', role: 'READER' });
      const tampered = token.slice(0, -4) + 'abcd';
      assert.equal(verifyJwt(tampered), null);
    });
  });

  // The pre-existing suite only covered the happy path plus one tamper case.
  // These are the cases an auth guard actually depends on: a route that treats
  // a malformed or expired token as valid is an authentication bypass.
  describe('Token Rejection', () => {
    it('rejects an empty string', () => {
      assert.equal(verifyJwt(''), null);
    });

    it('rejects a non-JWT string', () => {
      assert.equal(verifyJwt('not-a-jwt'), null);
    });

    it('rejects a token with the wrong number of segments', () => {
      assert.equal(verifyJwt('only.two'), null);
      assert.equal(verifyJwt('a.b.c.d'), null);
    });

    it('rejects a token with a valid shape but garbage payload', () => {
      const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(
        '{"userId":"u1","role":"ADMIN"}'
      ).toString('base64url')}.c2lnbmF0dXJl`;
      assert.equal(verifyJwt(token), null);
    });

    it('rejects an expired token', () => {
      // expiresIn -1 second puts exp in the past.
      const token = signJwt({ userId: 'u1', phoneNumber: '+98912', role: 'ADMIN' }, -1);
      assert.equal(verifyJwt(token), null, 'an expired ADMIN token must not authenticate');
    });

    it('rejects a token whose signature is from a different payload', () => {
      // Take a valid token and swap in a different payload — the classic
      // "none algorithm"/payload-substitution shape of attack.
      const good = signJwt({ userId: 'u1', phoneNumber: '+98912', role: 'READER' });
      const [header, , sig] = good.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ userId: 'u1', phoneNumber: '+98912', role: 'ADMIN' })
      ).toString('base64url');
      assert.equal(verifyJwt(`${header}.${forgedPayload}.${sig}`), null);
    });

    it('rejects a token signed by another key', () => {
      // Simulates the pre-fix committed fallback being replaced: a token minted
      // under the old hardcoded secret must not verify once JWT_SECRET is real.
      const data = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(
        JSON.stringify({ userId: 'u1', phoneNumber: '+98912', role: 'ADMIN', exp: 99999999999 })
      ).toString('base64url')}`;
      const sig = crypto
        .createHmac('sha256', 'the-old-committed-fallback-secret')
        .update(data)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      assert.equal(verifyJwt(`${data}.${sig}`), null);
    });
  });
});
