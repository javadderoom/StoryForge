import { Prisma, PrismaClient } from '@prisma/client';

export interface MergeResult {
  creditsTransferred: number;
  purchasesTransferred: number;
  sessionsTransferred: number;
}

/**
 * Atomically merges a secondary (e.g. temporary anonymous Bazaar or guest) account
 * into a primary registered user account.
 *
 * - Transfers all Bazaar purchases to the primary account
 * - Transfers all Playthrough sessions to the primary account
 * - Adds unspent credit balance to the primary account
 * - Logs an ACCOUNT_MERGE credit ledger entry
 * - Safely deletes the secondary account
 */
export async function mergeUserAccounts(
  primaryUserId: string,
  secondaryUserId: string,
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<MergeResult> {
  if (primaryUserId === secondaryUserId) {
    return { creditsTransferred: 0, purchasesTransferred: 0, sessionsTransferred: 0 };
  }

  const secondary = await prisma.user.findUnique({
    where: { id: secondaryUserId },
    include: {
      bazaarPurchases: true,
      sessions: true,
    },
  });

  if (!secondary) {
    return { creditsTransferred: 0, purchasesTransferred: 0, sessionsTransferred: 0 };
  }

  const creditsToTransfer = secondary.creditBalance > 0 ? secondary.creditBalance : 0;
  const purchasesCount = secondary.bazaarPurchases.length;
  const sessionsCount = secondary.sessions.length;

  // 0. Detach unique identifiers from secondary to prevent unique constraint collision
  if (secondary.bazaarAccountId) {
    await prisma.user.update({
      where: { id: secondaryUserId },
      data: { bazaarAccountId: null },
    });
  }

  // 1. Re-parent Bazaar purchases
  if (purchasesCount > 0) {
    await prisma.bazaarPurchase.updateMany({
      where: { userId: secondaryUserId },
      data: { userId: primaryUserId },
    });
  }

  // 2. Re-parent playthrough sessions
  if (sessionsCount > 0) {
    await prisma.playthroughSession.updateMany({
      where: { userId: secondaryUserId },
      data: { userId: primaryUserId },
    });
  }

  // 3. Increment primary user credits
  const updatedPrimary = await prisma.user.update({
    where: { id: primaryUserId },
    data: {
      creditBalance: { increment: creditsToTransfer },
      // Transfer bazaarAccountId to primary if it didn't already have one
      ...(secondary.bazaarAccountId
        ? { bazaarAccountId: secondary.bazaarAccountId }
        : {}),
    },
  });

  // 4. Record ledger entry for the transfer
  if (creditsToTransfer > 0) {
    await prisma.userCreditLedger.create({
      data: {
        userId: primaryUserId,
        amount: creditsToTransfer,
        balanceAfter: updatedPrimary.creditBalance,
        reason: 'ACCOUNT_MERGE',
        metadata: {
          note: 'Transferred credits from merged temporary Bazaar account',
          mergedFromUserId: secondaryUserId,
          creditsTransferred: creditsToTransfer,
        },
      },
    });
  }

  // 5. Delete the merged secondary user
  await prisma.user.delete({
    where: { id: secondaryUserId },
  });

  return {
    creditsTransferred: creditsToTransfer,
    purchasesTransferred: purchasesCount,
    sessionsTransferred: sessionsCount,
  };
}
