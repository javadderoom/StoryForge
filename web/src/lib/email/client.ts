import { Resend } from 'resend';
import crypto from 'node:crypto';
import { renderWelcomeVerificationEmail } from './templates/welcomeVerificationEmail';
import { renderPasswordResetEmail } from './templates/passwordResetEmail';

let resendInstance: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export function getDefaultFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'افسانه‌ساز <noreply@afsanehsaz.ir>';
}

/**
 * Resolves the application base URL from environment or request headers.
 */
export function getAppBaseUrl(req?: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const origin = req.headers.get('origin');
    if (origin) return origin.replace(/\/$/, '');
    const host = req.headers.get('host');
    if (host) {
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
      const proto = req.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  }
  return 'https://afsanehsaz.ir';
}

/**
 * Generates a cryptographically secure random token for email verification.
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculates expiration date (default: 24 hours from now).
 */
export function getVerificationTokenExpiry(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export interface SendVerificationEmailParams {
  to: string;
  name?: string | null;
  verificationUrl: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Dispatches the branded Afsanehsaz welcome and verification email via Resend.
 */
export async function sendWelcomeVerificationEmail({
  to,
  name,
  verificationUrl,
}: SendVerificationEmailParams): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY is not configured. Email dispatch skipped for:', to);
    return {
      success: false,
      error: 'Email service is not configured (RESEND_API_KEY missing).',
    };
  }

  const { subject, html, text } = renderWelcomeVerificationEmail({
    name,
    verificationUrl,
  });

  try {
    const from = getDefaultFromEmail();
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('[email] Resend API error:', result.error);
      return {
        success: false,
        error: result.error.message || 'Failed to send verification email.',
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email] Unexpected error sending email via Resend:', error);
    return {
      success: false,
      error: message || 'Failed to dispatch email.',
    };
  }
}

/**
 * Calculates password reset expiration date (default: 1 hour from now).
 */
export function getPasswordResetTokenExpiry(hours = 1): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export interface SendPasswordResetEmailParams {
  to: string;
  name?: string | null;
  resetUrl: string;
}

/**
 * Dispatches the branded Afsanehsaz password reset email via Resend.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY is not configured. Password reset email skipped for:', to);
    return {
      success: false,
      error: 'Email service is not configured (RESEND_API_KEY missing).',
    };
  }

  const { subject, html, text } = renderPasswordResetEmail({
    name,
    resetUrl,
  });

  try {
    const from = getDefaultFromEmail();
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('[email] Resend API error on password reset:', result.error);
      return {
        success: false,
        error: result.error.message || 'Failed to send password reset email.',
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email] Unexpected error sending password reset email via Resend:', error);
    return {
      success: false,
      error: message || 'Failed to dispatch email.',
    };
  }
}

export default {
  getResendClient,
  getDefaultFromEmail,
  getAppBaseUrl,
  generateVerificationToken,
  getVerificationTokenExpiry,
  sendWelcomeVerificationEmail,
  getPasswordResetTokenExpiry,
  sendPasswordResetEmail,
};
