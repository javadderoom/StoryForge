import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';

export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || (auth.user.role !== 'ADMIN' && auth.user.role !== 'AUTHOR')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin permissions required.' },
        { status: 403 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const [purchases, ledgers, totalUsersCount, totalPurchasesAgg] = await Promise.all([
      prisma.bazaarPurchase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: {
            select: {
              phoneNumber: true,
              name: true,
            },
          },
        },
      }),
      prisma.userCreditLedger.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: {
            select: {
              phoneNumber: true,
              name: true,
            },
          },
        },
      }),
      prisma.user.count(),
      prisma.bazaarPurchase.aggregate({
        _sum: {
          amountPaidRial: true,
          creditsAwarded: true,
        },
        _count: true,
      }),
    ]);

    const totalRevenueToman = (totalPurchasesAgg._sum.amountPaidRial ?? 0) / 10;
    const totalCreditsAwarded = totalPurchasesAgg._sum.creditsAwarded ?? 0;
    const totalPurchasesCount = totalPurchasesAgg._count ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsersCount,
          totalPurchasesCount,
          totalRevenueToman,
          totalCreditsAwarded,
        },
        purchases,
        ledgers,
      },
    });
  } catch (error: any) {
    console.error('Failed to get transactions for admin:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
