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

    const { id } = await params;
    const body = await req.json();
    const {
      isActive,
      maxUses,
      expiresAt,
      description,
      discountPercent,
      creditBonus,
    } = body;

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const dataToUpdate: any = {};
    if (typeof isActive === 'boolean') dataToUpdate.isActive = isActive;
    if (typeof maxUses === 'number') dataToUpdate.maxUses = maxUses > 0 ? maxUses : null;
    if (expiresAt !== undefined) dataToUpdate.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (typeof description === 'string') dataToUpdate.description = description.trim() || null;
    if (typeof discountPercent === 'number') dataToUpdate.discountPercent = discountPercent > 0 ? discountPercent : null;
    if (typeof creditBonus === 'number') dataToUpdate.creditBonus = creditBonus >= 0 ? creditBonus : 0;

    const updated = await prisma.discountCode.update({
      where: { id },
      data: dataToUpdate,
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { code: updated },
      message: 'کد تخفیف با موفقیت به‌روزرسانی شد.',
    });
  } catch (error: any) {
    console.error('Failed to update discount code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { id } = await params;
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    await prisma.discountCode.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'کد تخفیف با موفقیت حذف گردید.',
    });
  } catch (error: any) {
    console.error('Failed to delete discount code:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
