/**
 * Operational test script: test Resend email delivery.
 *
 * Usage:
 *   npx tsx scripts/testEmail.ts deroom24@gmail.com
 *   or:
 *   RESEND_API_KEY=re_your_api_key npx tsx scripts/testEmail.ts deroom24@gmail.com
 */

const loadEnv = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* optional */
}
try {
  loadEnv?.call(process, '.env.local');
} catch {
  /* optional */
}

import { sendWelcomeVerificationEmail, sendPasswordResetEmail, getDefaultFromEmail } from '../src/lib/email/client';

async function main() {
  const targetEmail = process.argv[2] || 'deroom24@gmail.com';
  const type = process.argv[3] || 'verification';

  console.log('--- Afsanehsaz Resend Email Test ---');
  console.log(`Target Recipient : ${targetEmail}`);
  console.log(`Email Type       : ${type}`);
  console.log(`From Address     : ${getDefaultFromEmail()}`);
  console.log(`API Key Configured: ${process.env.RESEND_API_KEY ? 'YES (' + process.env.RESEND_API_KEY.slice(0, 6) + '...)' : 'NO'}`);

  if (!process.env.RESEND_API_KEY) {
    console.error('\n❌ RESEND_API_KEY is missing from environment or .env file.');
    console.error('Please either:');
    console.error('1. Add RESEND_API_KEY=re_... to web/.env');
    console.error('2. Or run: RESEND_API_KEY=re_... npx tsx scripts/testEmail.ts ' + targetEmail);
    process.exit(1);
  }

  console.log('\nSending email...');

  if (type === 'reset') {
    const res = await sendPasswordResetEmail({
      to: targetEmail,
      name: 'ماجراجو',
      resetUrl: 'https://afsanehsaz.ir/auth/reset-password?token=test_reset_token_123',
    });
    console.log('\nResult:', res);
  } else {
    const res = await sendWelcomeVerificationEmail({
      to: targetEmail,
      name: 'ماجراجو',
      verificationUrl: 'https://afsanehsaz.ir/auth/verify-email?token=test_verification_token_123',
    });
    console.log('\nResult:', res);
  }
}

main().catch((err) => {
  console.error('\n❌ Execution error:', err);
  process.exit(1);
});
