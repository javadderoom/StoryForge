import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { buildCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const storyId: string | undefined = body?.storyId;
    const sessionId: string | undefined = body?.sessionId;

    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    const auth = await getAuthenticatedUser(req);
    const prisma = getPrisma();

    let refundedCredits = 0;
    let newCreditBalance: number | null = auth?.user?.creditBalance ?? null;

    if (auth && prisma) {
      // Find all credit ledgers for this user to calculate net spent credits on this story
      const ledgers = await prisma.userCreditLedger.findMany({
        where: { userId: auth.user.id },
      });

      let spentCredits = 0;
      let alreadyRefunded = 0;

      for (const entry of ledgers) {
        const meta = (entry.metadata as any) || {};
        if (meta.storyId === storyId) {
          if (entry.reason === 'SCENE_PLAY' && entry.amount < 0) {
            spentCredits += Math.abs(entry.amount);
          } else if (entry.reason === 'STORY_RESET_REFUND' && entry.amount > 0) {
            alreadyRefunded += entry.amount;
          }
        }
      }

      const netToRefund = Math.max(0, spentCredits - alreadyRefunded);

      if (netToRefund > 0) {
        const updatedUser = await prisma.user.update({
          where: { id: auth.user.id },
          data: { creditBalance: { increment: netToRefund } },
          select: { creditBalance: true },
        });

        await prisma.userCreditLedger.create({
          data: {
            userId: auth.user.id,
            amount: netToRefund,
            balanceAfter: updatedUser.creditBalance,
            reason: 'STORY_RESET_REFUND',
            metadata: {
              storyId,
              refundedCredits: netToRefund,
              previousSpent: spentCredits,
              note: 'Story revamp reset credit refund',
            },
          },
        });

        refundedCredits = netToRefund;
        newCreditBalance = updatedUser.creditBalance;
      }

      // Delete all sessions for this user on this story
      await prisma.playthroughSession.deleteMany({
        where: {
          userId: auth.user.id,
          storyId,
        },
      });
    }

    // Also clean up specific session in repository (covers in-memory & guest sessions)
    if (sessionId) {
      await SessionRepository.deleteSession(sessionId);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          refundedCredits,
          newCreditBalance,
        },
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error: any) {
    console.error('Session reset error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset session' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
