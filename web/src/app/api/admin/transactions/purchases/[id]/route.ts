import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || (auth.user.role !== 'ADMIN' && auth.user.role !== 'AUTHOR')) {
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

    const existing = await prisma.bazaarPurchase.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Purchase record not found.' },
        { status: 404 }
      );
    }

    await prisma.bazaarPurchase.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'رکورد خرید با موفقیت حذف گردید.',
    });
  } catch (error: any) {
    console.error('Failed to delete purchase record:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
