import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import {
  normalizePhoneNumber,
  verifyPassword,
  signJwt,
} from '@/lib/auth/jwt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, phoneNumber, email, password, guestSessionId } = body;
    const loginInput = (identifier || email || phoneNumber || '').trim();

    if (!loginInput || !password) {
      return NextResponse.json(
        { success: false, error: 'وارد کردن نشانی ایمیل یا شماره موبایل و رمز عبور الزامی است.' },
        { status: 400 }
      );
    }

    const isEmail = loginInput.includes('@');
    let normalizedPhone: string | null = null;
    let normalizedEmail: string | null = null;

    if (isEmail) {
      normalizedEmail = loginInput.toLowerCase();
    } else {
      normalizedPhone = normalizePhoneNumber(loginInput);
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'سرویس پایگاه داده در دسترس نیست.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: normalizedEmail }
        : { phoneNumber: normalizedPhone },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'حساب کاربری با این مشخصات یافت نشد.' },
        { status: 401 }
      );
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'رمز عبور وارد شده نادرست است.' },
        { status: 401 }
      );
    }

    // Claim a guest session for this account. The `userId: null` predicate is
    // load-bearing: without it, anyone who learns a victim's sessionId could
    // re-parent an already-owned playthrough to their own account. Guest rows
    // are stored as NULL (createSession always supplies the value explicitly,
    // so the Prisma `@default("guest_user")` never fires).
    let claimedGuestSession = false;
    if (guestSessionId && typeof guestSessionId === 'string') {
      try {
        const { count } = await prisma.playthroughSession.updateMany({
          where: { sessionId: guestSessionId, userId: null },
          data: { userId: user.id },
        });
        claimedGuestSession = count > 0;
      } catch (err) {
        console.warn('Session migration warning on login:', err);
      }
    }

    const token = signJwt({
      userId: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
    });

    const userProfile = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      role: user.role,
      creditBalance: user.creditBalance,
      phoneVerified: user.phoneVerified,
    };

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
      // Lets the client tell the difference between "claimed your guest save"
      // and "that session did not exist or was already owned" — previously a
      // failed claim was a silent no-op indistinguishable from success.
      claimedGuestSession,
    });

    // Set HTTP-only cookie for web clients
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطای داخلی سرور در هنگام ورود.';
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
