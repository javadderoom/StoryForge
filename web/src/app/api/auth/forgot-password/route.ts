import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import {
  generateVerificationToken,
  getPasswordResetTokenExpiry,
  getAppBaseUrl,
  sendPasswordResetEmail,
} from '@/lib/email/client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'لطفاً یک نشانی ایمیل معتبر وارد فرمایید.' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'سرویس پایگاه داده در دسترس نیست.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't leak whether the account exists
      return NextResponse.json({
        success: true,
        message: 'اگر حسابی با این نشانی ایمیل وجود داشته باشد، پیوند بازنشانی ارسال گردید.',
      });
    }

    // Rate limiting: prevent spamming requests if a token was issued less than 60s ago
    if (user.passwordResetTokenExpiresAt) {
      const msRemaining = user.passwordResetTokenExpiresAt.getTime() - Date.now();
      const oneHourMs = 60 * 60 * 1000;
      const msSinceGenerated = oneHourMs - msRemaining;
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

    const resetToken = generateVerificationToken();
    const expiry = getPasswordResetTokenExpiry(1);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: expiry,
      },
    });

    const baseUrl = getAppBaseUrl(req);
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

    const sendResult = await sendPasswordResetEmail({
      to: user.email!,
      name: user.name,
      resetUrl,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || 'ارسال ایمیل بازنشانی با خطا مواجه شد.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'پیوند بازنشانی گذرواژه به ایمیل شما ارسال شد.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطای داخلی هنگام درخواست بازنشانی رمز.';
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
