import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import {
  normalizePhoneNumber,
  isValidIranianPhone,
  hashPassword,
  signJwt,
} from '@/lib/auth/jwt';
import {
  generateVerificationToken,
  getVerificationTokenExpiry,
  getAppBaseUrl,
  sendWelcomeVerificationEmail,
} from '@/lib/email/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phoneNumber, password, name, email, guestSessionId } = body;

    if (!phoneNumber || !password) {
      return NextResponse.json(
        { success: false, error: 'شماره موبایل و رمز عبور الزامی هستند.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!isValidIranianPhone(normalizedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: 'فرمت شماره موبایل نامعتبر است. لطفاً یک شماره موبایل معتبر (مانند ۰۹۱۲۱۲۳۴۵۶۷) وارد کنید.',
        },
        { status: 400 }
      );
    }

    let normalizedEmail: string | null = null;
    if (email && typeof email === 'string' && email.trim().length > 0) {
      normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json(
          { success: false, error: 'فرمت نشانی ایمیل وارد شده معتبر نمی‌باشد.' },
          { status: 400 }
        );
      }
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'سرویس پایگاه داده در حال حاضر در دسترس نیست.' },
        { status: 503 }
      );
    }

    // Check if phone already exists
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'حسابی با این شماره موبایل از قبل وجود دارد.' },
        { status: 409 }
      );
    }

    // Check if email already exists
    if (normalizedEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'یک حساب کاربری با این نشانی ایمیل از قبل در سامانه ثبت شده است.' },
          { status: 409 }
        );
      }
    }

    const passwordHash = hashPassword(password);
    const initialCredits = 15; // Welcome bonus for new adventurers

    const verificationToken = normalizedEmail ? generateVerificationToken() : null;
    const tokenExpiry = normalizedEmail ? getVerificationTokenExpiry(24) : null;

    // Create user and welcome bonus ledger in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          phoneNumber: normalizedPhone,
          passwordHash,
          name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : null,
          email: normalizedEmail,
          emailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiresAt: tokenExpiry,
          role: 'READER',
          creditBalance: initialCredits,
          phoneVerified: false,
        },
      });

      await tx.userCreditLedger.create({
        data: {
          userId: u.id,
          amount: initialCredits,
          balanceAfter: initialCredits,
          reason: 'WELCOME_BONUS',
          metadata: { note: '15 free welcome story scenes' },
        },
      });

      // Claim a guest session for the new account. The `userId: null` predicate
      // is load-bearing: without it, a newly-registered attacker who learns a
      // victim's sessionId could re-parent an already-owned playthrough to
      // their own account. Guest rows are stored as NULL, not 'guest_user' —
      // createSession always supplies the value explicitly, so the Prisma
      // `@default("guest_user")` never fires.
      let claimedGuestSession = false;
      if (guestSessionId && typeof guestSessionId === 'string') {
        const { count } = await tx.playthroughSession.updateMany({
          where: { sessionId: guestSessionId, userId: null },
          data: { userId: u.id },
        });
        claimedGuestSession = count > 0;
      }

      return { user: u, claimedGuestSession };
    });

    let emailSent = false;
    let emailError: string | undefined;

    if (normalizedEmail && verificationToken) {
      const baseUrl = getAppBaseUrl(req);
      const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`;
      const sendResult = await sendWelcomeVerificationEmail({
        to: normalizedEmail,
        name: newUser.user.name,
        verificationUrl,
      });
      emailSent = sendResult.success;
      if (!sendResult.success) {
        emailError = sendResult.error;
        console.warn('[register] Verification email sending error:', sendResult.error);
      }
    }

    const token = signJwt({
      userId: newUser.user.id,
      phoneNumber: newUser.user.phoneNumber,
      role: newUser.user.role,
    });

    const userProfile = {
      id: newUser.user.id,
      phoneNumber: newUser.user.phoneNumber,
      email: newUser.user.email,
      emailVerified: newUser.user.emailVerified,
      name: newUser.user.name,
      role: newUser.user.role,
      creditBalance: newUser.user.creditBalance,
      phoneVerified: newUser.user.phoneVerified,
    };

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
      claimedGuestSession: newUser.claimedGuestSession,
      emailSent,
      emailError: emailError ? 'ایمیل تأیید ارسال نشد؛ می‌توانید بعداً مجدداً درخواست نمایید.' : undefined,
      message: emailSent
        ? 'حساب کاربری با موفقیت ساخته شد و ایمیل تأیید ارسال گردید.'
        : 'حساب کاربری با موفقیت ساخته شد و ۱۵ صحنه رایگان دریافت کردید!',
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
    const message = error instanceof Error ? error.message : 'Internal server error during registration.';
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
