import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'توکن تأیید ایمیل الزامی است.' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'توکن تأیید نامعتبر است یا پیش‌تر استفاده شده است.' },
        { status: 400 }
      );
    }

    if (
      user.emailVerificationTokenExpiresAt &&
      user.emailVerificationTokenExpiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'مهلت زمانی استفاده از این پیوند منقضی شده است. لطفاً درخواست لینک جدید نمایید.',
          expired: true,
          email: user.email,
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'نشانی ایمیل شما با موفقیت تأیید گردید.',
      email: user.email,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطا در تأیید ایمیل.';
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/auth/verify-email?status=missing', req.url));
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.redirect(new URL('/auth/verify-email?status=db_error', req.url));
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
  });

  if (!user) {
    return NextResponse.redirect(new URL('/auth/verify-email?status=invalid', req.url));
  }

  if (
    user.emailVerificationTokenExpiresAt &&
    user.emailVerificationTokenExpiresAt.getTime() < Date.now()
  ) {
    return NextResponse.redirect(
      new URL(`/auth/verify-email?status=expired&email=${encodeURIComponent(user.email || '')}`, req.url)
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  return NextResponse.redirect(
    new URL(`/auth/verify-email?status=success&email=${encodeURIComponent(user.email || '')}`, req.url)
  );
}
