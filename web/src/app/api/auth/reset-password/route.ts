import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/jwt';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, newPassword } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'توکن بازنشانی گذرواژه الزامی است.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'گذرواژه جدید باید حداقل ۶ کاراکتر باشد.' },
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
      where: { passwordResetToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'پیوند بازنشانی نامعتبر است یا پیش‌تر استفاده شده است.' },
        { status: 400 }
      );
    }

    if (
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'مهلت زمانی استفاده از این پیوند (۱ ساعت) به پایان رسیده است. لطفاً مجدداً درخواست دهید.',
          expired: true,
        },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'گذرواژه شما با موفقیت به‌روزرسانی شد. اکنون می‌توانید با گذرواژه جدید وارد شوید.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطای سرور هنگام بازنشانی گذرواژه.';
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
