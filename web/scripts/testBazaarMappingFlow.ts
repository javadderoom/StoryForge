import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';
import { mergeUserAccounts } from '../src/lib/auth/mergeAccounts';
import { hashPassword } from '../src/lib/auth/jwt';

async function main() {
  console.log('--- Starting Cafe Bazaar Account Mapping & Merge Test ---');
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Prisma database client not available.');
  }

  const testBazaarId = `test_bazaar_${Date.now()}`;
  const testPhone = `0912${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testEmail = `test_hero_${Date.now()}@storyforge.local`;
  const passwordHash = hashPassword('Secret123!');

  console.log(`[Test] Generating temporary Bazaar account: ${testBazaarId}`);

  // 1. Create temporary anonymous Bazaar user
  const tempBazaarUser = await prisma.user.create({
    data: {
      bazaarAccountId: testBazaarId,
      name: 'ماجراجوی موقت کافه‌بازار',
      creditBalance: 30, // Accumulated credits
      passwordHash,
      role: 'READER',
    },
  });

  // Add dummy purchase for temp user
  const dummyPurchase = await prisma.bazaarPurchase.create({
    data: {
      userId: tempBazaarUser.id,
      sku: 'pack_30',
      token: `token_${Date.now()}`,
      status: 'COMPLETED',
      amountPaidRial: 250000,
      creditsAwarded: 30,
    },
  });

  console.log(`[Test] Created temp user ${tempBazaarUser.id} with 30 credits and purchase ${dummyPurchase.id}`);

  // 2. Create primary user (registered with phone/email)
  const primaryUser = await prisma.user.create({
    data: {
      phoneNumber: testPhone,
      email: testEmail,
      name: 'پهلوان زروان',
      creditBalance: 15,
      passwordHash,
      role: 'READER',
    },
  });

  console.log(`[Test] Created primary user ${primaryUser.id} with 15 credits, phone ${testPhone}`);

  // 3. Perform atomic merge
  console.log(`[Test] Merging temp user ${tempBazaarUser.id} into primary ${primaryUser.id}...`);
  const mergeResult = await mergeUserAccounts(primaryUser.id, tempBazaarUser.id, prisma);
  console.log(`[Test] Merge result:`, mergeResult);

  // 4. Verify outcomes
  const updatedPrimary = await prisma.user.findUnique({
    where: { id: primaryUser.id },
    include: { bazaarPurchases: true },
  });

  if (!updatedPrimary) {
    throw new Error('Updated primary user not found!');
  }

  console.log(`[Test] Primary user credit balance after merge: ${updatedPrimary.creditBalance} (Expected: 45)`);
  if (updatedPrimary.creditBalance !== 45) {
    throw new Error(`Credit balance mismatch! Expected 45, got ${updatedPrimary.creditBalance}`);
  }

  console.log(`[Test] Primary user bazaarAccountId: ${updatedPrimary.bazaarAccountId} (Expected: ${testBazaarId})`);
  if (updatedPrimary.bazaarAccountId !== testBazaarId) {
    throw new Error(`Bazaar account ID not attached to primary user!`);
  }

  console.log(`[Test] Primary user bazaar purchases count: ${updatedPrimary.bazaarPurchases.length} (Expected: 1)`);
  if (updatedPrimary.bazaarPurchases.length !== 1) {
    throw new Error(`Purchases were not re-parented!`);
  }

  const deletedTemp = await prisma.user.findUnique({
    where: { id: tempBazaarUser.id },
  });

  if (deletedTemp) {
    throw new Error('Secondary temp user was NOT deleted!');
  }
  console.log(`[Test] Verified secondary temp user was safely deleted.`);

  // Clean up test data
  console.log(`[Test] Cleaning up test records...`);
  await prisma.bazaarPurchase.deleteMany({ where: { userId: primaryUser.id } });
  await prisma.userCreditLedger.deleteMany({ where: { userId: primaryUser.id } });
  await prisma.user.delete({ where: { id: primaryUser.id } });

  console.log('✅ ALL CAFE BAZAAR ACCOUNT MAPPING & MERGE TESTS PASSED CLEANLY!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
