import dotenv from 'dotenv';
dotenv.config();

process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function backfill() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('Database connection unavailable.');
    process.exit(1);
  }

  console.log('Scanning for legacy bazaar users in User table...');
  const legacyUsers = await prisma.user.findMany({
    where: {
      phoneNumber: {
        startsWith: 'bazaar_',
      },
    },
  });

  console.log(`Found ${legacyUsers.length} legacy bazaar user(s).`);

  for (const u of legacyUsers) {
    const rawBazaarId = u.phoneNumber?.replace(/^bazaar_/, '') || u.phoneNumber!;
    console.log(`Migrating user ${u.id}: setting bazaarAccountId = "${rawBazaarId}", clearing phoneNumber...`);
    await prisma.user.update({
      where: { id: u.id },
      data: {
        bazaarAccountId: rawBazaarId,
        phoneNumber: null,
      },
    });
  }

  console.log('Backfill completed successfully.');
}

backfill()
  .catch(console.error)
  .finally(() => process.exit(0));
