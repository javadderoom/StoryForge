import crypto from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'storyforge-secret-jwt-key-2026-secure-token-void';
const JWT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface JwtUserPayload {
  userId: string;
  phoneNumber: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Normalizes Iranian phone numbers to E.164 standard (+989XXXXXXXXX)
 */
export function normalizePhoneNumber(input: string): string {
  if (!input) return '';
  // Remove spaces, dashes, parentheses
  let cleaned = input.trim().replace(/[\s\-\(\)]/g, '');

  // Convert Persian/Arabic digits to English digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '۸', '۹'];
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
  }

  if (cleaned.startsWith('0098')) {
    cleaned = '+98' + cleaned.slice(4);
  } else if (cleaned.startsWith('98') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('09') && cleaned.length === 11) {
    cleaned = '+98' + cleaned.slice(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    cleaned = '+98' + cleaned;
  }

  return cleaned;
}

/**
 * Validates if the phone number is a valid Iranian mobile format (+989XXXXXXXXX)
 */
export function isValidIranianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^\+989\d{9}$/.test(normalized);
}

/**
 * Hashes a plaintext password with a random salt using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored salt:hash string
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL decoding helper
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Signs a JWT token with HMAC-SHA256
 */
export function signJwt(payload: Omit<JwtUserPayload, 'iat' | 'exp'>, expiresIn = JWT_EXPIRES_IN_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JwtUserPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

/**
 * Verifies and decodes a JWT token
 */
export function verifyJwt(token: string): JwtUserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) {
      return null;
    }

    const payloadStr = base64UrlDecode(payloadB64);
    const payload: JwtUserPayload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
}
