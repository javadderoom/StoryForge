import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
});
