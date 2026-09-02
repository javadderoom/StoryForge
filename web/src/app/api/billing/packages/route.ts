import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { DEFAULT_CREDIT_PACKAGES } from '@/lib/billing/packages';

/**
 * GET: Returns all active credit packages from DB (auto-seeds defaults if empty)
 */
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({
        success: true,
        data: {
          packages: DEFAULT_CREDIT_PACKAGES,
          currency: 'تومان',
        },
      });
    }

    let packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Auto-seed if database is empty
    if (packages.length === 0) {
      await prisma.creditPackage.createMany({
        data: DEFAULT_CREDIT_PACKAGES,
      });

      packages = await prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        packages,
        currency: 'تومان',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch credit packages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}

/**
 * POST / PUT: Create or update a credit package (Admin / Author only)
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || (auth.user.role !== 'ADMIN' && auth.user.role !== 'AUTHOR')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin permissions required to edit packages.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      id,
      sku,
      title,
      titleEn,
      credits,
      priceToman,
      originalPriceToman,
      discountPercent,
      badge,
      description,
      isActive = true,
      sortOrder = 0,
    } = body;

    if (!sku || !title || credits === undefined || priceToman === undefined) {
      return NextResponse.json(
        { success: false, error: 'sku, title, credits, and priceToman are required.' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const priceRial = priceToman * 10;

    const savedPackage = await prisma.creditPackage.upsert({
      where: { sku },
      update: {
        title,
        titleEn,
        credits: Number(credits),
        priceToman: Number(priceToman),
        priceRial,
        originalPriceToman: originalPriceToman ? Number(originalPriceToman) : null,
        discountPercent: discountPercent ? Number(discountPercent) : 0,
        badge: badge || null,
        description: description || '',
        isActive: Boolean(isActive),
        sortOrder: Number(sortOrder),
      },
      create: {
        sku,
        title,
        titleEn,
        credits: Number(credits),
        priceToman: Number(priceToman),
        priceRial,
        originalPriceToman: originalPriceToman ? Number(originalPriceToman) : null,
        discountPercent: discountPercent ? Number(discountPercent) : 0,
        badge: badge || null,
        description: description || '',
        isActive: Boolean(isActive),
        sortOrder: Number(sortOrder),
      },
    });

    return NextResponse.json({
      success: true,
      data: savedPackage,
      message: 'بسته اعتباری با موفقیت ذخیره شد.',
    });
  } catch (error: any) {
    console.error('Failed to save credit package:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save package' },
      { status: 500 }
    );
  }
}
