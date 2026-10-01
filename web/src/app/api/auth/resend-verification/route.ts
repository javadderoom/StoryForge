import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import {
  generateVerificationToken,
  getVerificationTokenExpiry,
  getAppBaseUrl,
  sendWelcomeVerificationEmail,
} from '@/lib/email/client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    // If email is not passed in body, try to resolve from active session
    if (!email) {
      const auth = await getAuthenticatedUser(req);
      if (auth?.user.email) {
        email = auth.user.email;
      }
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'نشانی ایمیل الزامی است.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't leak whether the account exists
      return NextResponse.json({
        success: true,
        message: 'اگر حسابی با این ایمیل وجود داشته باشد، پیوند تأیید مجدداً ارسال گردید.',
      });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'این نشانی ایمیل پیش‌تر تأیید شده است.',
        alreadyVerified: true,
      });
    }

    // Rate limiting: Don't allow spamming if token was refreshed less than 60 seconds ago
    if (user.emailVerificationTokenExpiresAt) {
      const msRemaining = user.emailVerificationTokenExpiresAt.getTime() - Date.now();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      const msSinceGenerated = twentyFourHoursMs - msRemaining;
      if (msSinceGenerated < 60 * 1000 && msSinceGenerated > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'لطفاً پیش از درخواست مجدد، ۱ دقیقه شکیبا باشید.',
          },
          { status: 429 }
        );
      }
    }

    const newToken = generateVerificationToken();
    const newExpiry = getVerificationTokenExpiry(24);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: newToken,
        emailVerificationTokenExpiresAt: newExpiry,
      },
    });

    const baseUrl = getAppBaseUrl(req);
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${newToken}`;

    const sendResult = await sendWelcomeVerificationEmail({
      to: user.email!,
      name: user.name,
      verificationUrl,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || 'ارسال ایمیل با خطا مواجه شد. لطفاً بعداً تلاش فرمایید.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ایمیل فعال‌سازی مجدداً برای شما ارسال شد.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطا در ارسال مجدد ایمیل.';
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
