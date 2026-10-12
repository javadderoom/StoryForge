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

    const codes = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { codes },
    });
  } catch (error: any) {
    console.error('Failed to list discount codes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin permissions required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      code,
      description,
      discountPercent,
      creditBonus,
      maxUses,
      startsAt,
      expiresAt,
      isActive,
    } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'کد تخفیف الزامی است.' },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const existing = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `کد تخفیف ${normalizedCode} قبلاً ثبت شده است.` },
        { status: 409 }
      );
    }

    const newCode = await prisma.discountCode.create({
      data: {
        code: normalizedCode,
        description: description?.trim() || null,
        discountPercent: typeof discountPercent === 'number' && discountPercent > 0 ? discountPercent : null,
        creditBonus: typeof creditBonus === 'number' && creditBonus > 0 ? creditBonus : 0,
        maxUses: typeof maxUses === 'number' && maxUses > 0 ? maxUses : null,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== false,
      },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { code: newCode },
      message: 'کد تخفیف با موفقیت ایجاد شد.',
    });
  } catch (error: any) {
    console.error('Failed to create discount code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
