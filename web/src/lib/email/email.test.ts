import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderWelcomeVerificationEmail,
} from './templates/welcomeVerificationEmail';
import {
  renderPasswordResetEmail,
} from './templates/passwordResetEmail';
import {
  generateVerificationToken,
  getVerificationTokenExpiry,
  getPasswordResetTokenExpiry,
  getDefaultFromEmail,
  getAppBaseUrl,
} from './client';

describe('Resend Email Integration - Afsanehsaz Welcome & Verification', () => {
  describe('renderWelcomeVerificationEmail', () => {
    test('renders with specific adventurer name and verification URL', () => {
      const { subject, html, text } = renderWelcomeVerificationEmail({
        name: 'سورنا',
        verificationUrl: 'https://afsanehsaz.ir/auth/verify-email?token=test_token_123',
      });

      assert.match(subject, /افسانه‌ساز/);
      assert.match(subject, /تأیید نشانی ایمیل/);

      // Adventurer name in body
      assert.ok(html.includes('سورنا'));
      assert.ok(text.includes('سورنا'));

      // Link in body
      assert.ok(html.includes('https://afsanehsaz.ir/auth/verify-email?token=test_token_123'));
      assert.ok(text.includes('https://afsanehsaz.ir/auth/verify-email?token=test_token_123'));

      // RTL direction and Persian typography
      assert.ok(html.includes('dir="rtl"'));
      assert.ok(html.includes('lang="fa"'));

      // Welcome bonus callout
      assert.ok(html.includes('۱۵ صحنه داستانی رایگان'));
      assert.ok(text.includes('۱۵ صحنه داستانی رایگان'));
    });

    test('falls back gracefully to generic adventurer title when name is omitted or empty', () => {
      const { html, text } = renderWelcomeVerificationEmail({
        name: '   ',
        verificationUrl: 'https://afsanehsaz.ir/auth/verify-email?token=xyz',
      });

      assert.ok(html.includes('ماجراجوی گرامی'));
      assert.ok(text.includes('ماجراجوی گرامی'));
    });
  });

  describe('renderPasswordResetEmail', () => {
    test('renders reset email with link and 1-hour expiration notice', () => {
      const { subject, html, text } = renderPasswordResetEmail({
        name: 'آبتین',
        resetUrl: 'https://afsanehsaz.ir/auth/reset-password?token=reset_token_xyz',
      });

      assert.match(subject, /بازنشانی گذرواژه/);
      assert.ok(html.includes('آبتین'));
      assert.ok(text.includes('آبتین'));
      assert.ok(html.includes('https://afsanehsaz.ir/auth/reset-password?token=reset_token_xyz'));
      assert.ok(text.includes('https://afsanehsaz.ir/auth/reset-password?token=reset_token_xyz'));
      assert.ok(html.includes('۱ ساعت'));
      assert.ok(text.includes('۱ ساعت'));
    });

    test('falls back gracefully to generic adventurer name in reset email', () => {
      const { html, text } = renderPasswordResetEmail({
        resetUrl: 'https://afsanehsaz.ir/auth/reset-password?token=reset_token_xyz',
      });

      assert.ok(html.includes('ماجراجوی گرامی'));
      assert.ok(text.includes('ماجراجوی گرامی'));
    });
  });

  describe('Verification & Reset Token Utilities', () => {
    test('generates secure 64-character hex tokens', () => {
      const token1 = generateVerificationToken();
      const token2 = generateVerificationToken();

      assert.equal(typeof token1, 'string');
      assert.equal(token1.length, 64);
      assert.match(token1, /^[0-9a-f]{64}$/);
      assert.notEqual(token1, token2, 'Each token must be uniquely generated');
    });

    test('calculates verification expiration 24 hours into the future', () => {
      const before = Date.now();
      const expiry = getVerificationTokenExpiry(24);
      const after = Date.now();

      const expectedMs = 24 * 60 * 60 * 1000;
      assert.ok(expiry.getTime() >= before + expectedMs);
      assert.ok(expiry.getTime() <= after + expectedMs);
    });

    test('calculates password reset expiration 1 hour into the future', () => {
      const before = Date.now();
      const expiry = getPasswordResetTokenExpiry(1);
      const after = Date.now();

      const expectedMs = 60 * 60 * 1000;
      assert.ok(expiry.getTime() >= before + expectedMs);
      assert.ok(expiry.getTime() <= after + expectedMs);
    });

    test('resolves default sender email with domain afsanehsaz.ir', () => {
      const from = getDefaultFromEmail();
      assert.ok(from.includes('noreply@afsanehsaz.ir'));
    });

    test('resolves app base URL fallback and request origin', () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        headers: { host: 'localhost:3000' },
      });
      const localUrl = getAppBaseUrl(req);
      assert.ok(localUrl.includes('localhost:3000'));

      const prodReq = new Request('https://afsanehsaz.ir/api/auth/register', {
        headers: { host: 'afsanehsaz.ir' },
      });
      const prodUrl = getAppBaseUrl(prodReq);
      assert.equal(prodUrl, 'https://afsanehsaz.ir');
    });
  });
});
