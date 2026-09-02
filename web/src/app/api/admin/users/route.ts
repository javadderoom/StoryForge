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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const where = search
      ? {
          OR: [
            { phoneNumber: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        role: true,
        creditBalance: true,
        phoneVerified: true,
        createdAt: true,
        _count: {
          select: {
            sessions: true,
            bazaarPurchases: true,
          },
        },
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: { users },
    });
  } catch (error: any) {
    console.error('Failed to list users for admin:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
