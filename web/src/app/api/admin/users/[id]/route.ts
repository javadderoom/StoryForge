import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin permissions required.' },
        { status: 403 }
      );
    }

    const { id: targetUserId } = await params;
    const body = await req.json();
    const { role, creditAdjustment, reason } = body;

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (role && ['READER', 'AUTHOR', 'ADMIN'].includes(role)) {
        dataToUpdate.role = role;
      }

      if (typeof creditAdjustment === 'number' && creditAdjustment !== 0) {
        dataToUpdate.creditBalance = { increment: creditAdjustment };
      }

      const u = await tx.user.update({
        where: { id: targetUserId },
        data: dataToUpdate,
      });

      if (typeof creditAdjustment === 'number' && creditAdjustment !== 0) {
        await tx.userCreditLedger.create({
          data: {
            userId: targetUserId,
            amount: creditAdjustment,
            balanceAfter: u.creditBalance,
            reason: reason || 'ADMIN_MANUAL_ADJUSTMENT',
            metadata: {
              adjustedBy: auth.user.phoneNumber,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }

      return u;
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: updated.id,
          phoneNumber: updated.phoneNumber,
          name: updated.name,
          role: updated.role,
          creditBalance: updated.creditBalance,
        },
      },
      message: 'کاربر با موفقیت به‌روزرسانی شد.',
    });
  } catch (error: any) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}
