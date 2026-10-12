import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'برای ثبت کد تخفیف، ابتدا وارد حساب کاربری شوید.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'لطفاً کد تخفیف را وارد کنید.' },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const discountCode = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
    });

    if (!discountCode) {
      return NextResponse.json(
        { success: false, error: 'کد تخفیف وارد شده معتبر نمی‌باشد.' },
        { status: 404 }
      );
    }

    if (!discountCode.isActive) {
      return NextResponse.json(
        { success: false, error: 'این کد تخفیف در حال حاضر غیرفعال است.' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now < discountCode.startsAt) {
      return NextResponse.json(
        { success: false, error: 'زمان استفاده از این کد تخفیف هنوز آغاز نشده است.' },
        { status: 400 }
      );
    }

    if (discountCode.expiresAt && now > discountCode.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'مهلت استفاده از این کد تخفیف به پایان رسیده است.' },
        { status: 400 }
      );
    }

    if (discountCode.maxUses !== null && discountCode.currentUses >= discountCode.maxUses) {
      return NextResponse.json(
        { success: false, error: 'ظرفیت مجاز استفاده از این کد تخفیف تکمیل شده است.' },
        { status: 400 }
      );
    }

    // Check if current user has already redeemed this code
    const existingRedemption = await prisma.discountCodeRedemption.findUnique({
      where: {
        discountCodeId_userId: {
          discountCodeId: discountCode.id,
          userId: auth.user.id,
        },
      },
    });

    if (existingRedemption) {
      return NextResponse.json(
        { success: false, error: 'شما قبلاً از این کد هدیه/تخفیف استفاده کرده‌اید.' },
        { status: 400 }
      );
    }

    const creditBonus = discountCode.creditBonus ?? 0;

    // Atomically execute redemption
    const result = await prisma.$transaction(async (tx) => {
      // 1. Increment usage
      await tx.discountCode.update({
        where: { id: discountCode.id },
        data: { currentUses: { increment: 1 } },
      });

      // 2. Record redemption
      await tx.discountCodeRedemption.create({
        data: {
          discountCodeId: discountCode.id,
          userId: auth.user.id,
          metadata: {
            code: normalizedCode,
            creditBonus,
            discountPercent: discountCode.discountPercent,
            redeemedAt: now.toISOString(),
          },
        },
      });

      // 3. If there is a credit bonus, add to user balance and record ledger
      let updatedUser = null;
      if (creditBonus > 0) {
        updatedUser = await tx.user.update({
          where: { id: auth.user.id },
          data: { creditBalance: { increment: creditBonus } },
        });

        await tx.userCreditLedger.create({
          data: {
            userId: auth.user.id,
            amount: creditBonus,
            balanceAfter: updatedUser.creditBalance,
            reason: 'DISCOUNT_CODE_REDEEMED',
            metadata: {
              code: normalizedCode,
              creditBonus,
            },
          },
        });
      }

      return updatedUser;
    });

    const newBalance = result ? result.creditBalance : auth.user.creditBalance;
    let message = 'کد با موفقیت اعمال شد.';
    if (creditBonus > 0) {
      message = `کد هدیه با موفقیت فعال شد و ${creditBonus} صحنه به حسابتان اضافه گردید!`;
    } else if (discountCode.discountPercent) {
      message = `کد تخفیف ${discountCode.discountPercent} درصدی با موفقیت ثبت شد.`;
    }

    return NextResponse.json({
      success: true,
      data: {
        code: normalizedCode,
        creditBonus,
        discountPercent: discountCode.discountPercent,
        newBalance,
        message,
      },
    });
  } catch (error: any) {
    console.error('Error redeeming discount code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'خطا در اعمال کد تخفیف' },
      { status: 500 }
    );
  }
}
