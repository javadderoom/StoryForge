import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { getAuthenticatedUser } from '@/lib/auth/getUser';

export const DEFAULT_CREDIT_PACKAGES = [
  {
    sku: 'afsanehsaz_credits_50',
    title: 'بسته کاوشگر تازه',
    titleEn: 'Starter Scout Pack',
    credits: 50,
    priceToman: 29000,
    priceRial: 290000,
    originalPriceToman: 29000,
    discountPercent: 0,
    badge: null,
    description: '۵۰ صحنه داستانی تعاملی با هوش مصنوعی',
    isActive: true,
    sortOrder: 1,
  },
  {
    sku: 'afsanehsaz_credits_150',
    title: 'بسته ماجراجوی شجاع',
    titleEn: 'Brave Adventurer Pack',
    credits: 150,
    priceToman: 69000,
    priceRial: 690000,
    originalPriceToman: 87000,
    discountPercent: 20,
    badge: 'محبوب‌ترین',
    description: '۱۵۰ صحنه داستانی + ۲۰٪ اعتبار هدیه',
    isActive: true,
    sortOrder: 2,
  },
  {
    sku: 'afsanehsaz_credits_500',
    title: 'بسته افسانه‌ای والوریا',
    titleEn: 'Legendary Realm Pack',
    credits: 500,
    priceToman: 189000,
    priceRial: 1890000,
    originalPriceToman: 290000,
    discountPercent: 35,
    badge: 'بیشترین تخفیف (۳۵٪)',
    description: '۵۰۰ صحنه داستانی برای روایت‌های طولانی و نبردهای حماسی',
    isActive: true,
    sortOrder: 3,
  },
];

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
