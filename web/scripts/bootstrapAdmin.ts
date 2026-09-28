/**
 * One-shot operational script: create or promote the first ADMIN account.
 *
 * `prisma/seed.ts` is intentionally a no-op (it seeds no sample stories), which
 * means a fresh database has no path to an ADMIN: every signup gets READER, and
 * `PATCH /api/admin/users/[id]` requires an ADMIN token that cannot be issued.
 * Gating the Studio routes on AUTHOR/ADMIN would therefore lock every operator
 * out permanently. This script closes that gap.
 *
 * Safe to re-run: idempotent on phoneNumber.
 * Refuses to demote: never downgrades an existing AUTHOR/ADMIN account.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_PHONE=09121234567 \
 *   BOOTSTRAP_ADMIN_PASSWORD='...' \
 *   BOOTSTRAP_ADMIN_NAME='Studio Owner' \
 *   npx tsx scripts/bootstrapAdmin.ts
 */

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
const loadEnv = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional */
}

import { getPrisma } from '../src/lib/db/client';
import {
  normalizePhoneNumber,
  isValidIranianPhone,
  hashPassword,
} from '../src/lib/auth/jwt';

const PHONE = process.env.BOOTSTRAP_ADMIN_PHONE?.trim();
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const NAME = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Studio Owner';

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  console.log('='.repeat(65));
  console.log('  StoryForge — Bootstrap Admin');
  console.log('='.repeat(65));

  if (!PHONE) fail('BOOTSTRAP_ADMIN_PHONE is required.');
  if (!PASSWORD) fail('BOOTSTRAP_ADMIN_PASSWORD is required.');

  const prisma = getPrisma();
  if (!prisma) {
    fail(
      'Database is disabled. Set ENABLE_DB=true and DATABASE_URL before bootstrapping.\n' +
        '  (getPrisma() returns null when ENABLE_DB !== "true" — see lib/db/client.ts)'
    );
  }

  const phone = normalizePhoneNumber(PHONE);
  if (!isValidIranianPhone(phone)) {
    fail(`"${PHONE}" is not a valid Iranian mobile number. Expected e.g. 09121234567.`);
  }
  if (PASSWORD.length < 6) {
    fail('BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters long.');
  }

  const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });

  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`\n✓ ${phone} is already an ADMIN. Nothing to do.`);
      return;
    }
    if (process.env.BOOTSTRAP_ADMIN_FORCE !== 'true') {
      fail(
        `${phone} already exists with role "${existing.role}".\n` +
          '  Refusing to change an existing account’s role. Set BOOTSTRAP_ADMIN_FORCE=true\n' +
          '  if you are certain this is the correct account.'
      );
    }
    const promoted = await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN' },
    });
    console.log(`\n✓ Promoted ${phone} from ${existing.role} → ${promoted.role}.`);
    return;
  }

  const passwordHash = hashPassword(PASSWORD);
  const initialCredits = 15;

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        phoneNumber: phone,
        passwordHash,
        name: NAME,
        role: 'ADMIN',
        creditBalance: initialCredits,
        phoneVerified: true,
      },
    });
    await tx.userCreditLedger.create({
      data: {
        userId: u.id,
        amount: initialCredits,
        balanceAfter: initialCredits,
        reason: 'WELCOME_BONUS',
        metadata: { note: 'Bootstrap admin welcome credits' },
      },
    });
    return u;
  });

  console.log(`\n✓ Created ADMIN account:`);
  console.log(`    id:    ${created.id}`);
  console.log(`    phone: ${created.phoneNumber}`);
  console.log(`    name:  ${created.name}`);
  console.log(`\n  You can now sign in at /studio with this phone number and password.`);
  console.log('  Rotate BOOTSTRAP_ADMIN_PASSWORD out of your environment after first login.\n');
}

main()
  .catch((e) => {
    console.error('\n✗ Bootstrap failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    if (prisma) await prisma.$disconnect();
  });
