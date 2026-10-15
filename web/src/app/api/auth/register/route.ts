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
import { mergeUserAccounts } from '@/lib/auth/mergeAccounts';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function POST(req: Request) {
  try {
    const corsHeaders = buildCorsHeaders(req);
    const body = await req.json();
    const { phoneNumber, password, name, email, guestSessionId, bazaarAccountId } = body;
    const rawBazaarId = typeof bazaarAccountId === 'string' && bazaarAccountId.trim().length > 0
      ? bazaarAccountId.trim()
      : null;

    const hasPhone = typeof phoneNumber === 'string' && phoneNumber.trim().length > 0;
    const hasEmail = typeof email === 'string' && email.trim().length > 0;

    if (!hasPhone && !hasEmail) {
      return NextResponse.json(
        { success: false, error: 'وارد کردن نشانی ایمیل یا شماره موبایل الزامی است.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    let normalizedPhone: string | null = null;
    if (hasPhone) {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!isValidIranianPhone(normalizedPhone)) {
        return NextResponse.json(
          {
            success: false,
            error: 'فرمت شماره موبایل نامعتبر است. لطفاً یک شماره موبایل معتبر (مانند ۰۹۱۲۱۲۳۴۵۶۷) وارد کنید.',
          },
          { status: 400 }
        );
      }
    }

    let normalizedEmail: string | null = null;
    if (hasEmail) {
      normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json(
          { success: false, error: 'فرمت نشانی ایمیل وارد شده معتبر نمی‌باشد.' },
          { status: 400 }
        );
      }
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'سرویس پایگاه داده در حال حاضر در دسترس نیست.' },
        { status: 503 }
      );
    }

    // Check if phone already exists
    if (normalizedPhone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phoneNumber: normalizedPhone },
      });

      if (existingPhone) {
        return NextResponse.json(
          { success: false, error: 'حسابی با این شماره موبایل از قبل وجود دارد.' },
          { status: 409 }
        );
      }
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

    let existingBazaarUser = null;
    if (rawBazaarId) {
      existingBazaarUser = await prisma.user.findUnique({
        where: { bazaarAccountId: rawBazaarId },
      });
    }

    // Create user and welcome bonus ledger in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          bazaarAccountId: existingBazaarUser ? null : rawBazaarId,
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

    // Merge existing temporary Bazaar account if present
    if (existingBazaarUser) {
      try {
        console.log(`[register] Merging temporary Bazaar user ${existingBazaarUser.id} into newly registered ${newUser.user.id}`);
        await mergeUserAccounts(newUser.user.id, existingBazaarUser.id, prisma);
      } catch (err) {
        console.warn('[register] Warning merging Bazaar user:', err);
      }
    }

    const refreshedUser = await prisma.user.findUnique({
      where: { id: newUser.user.id },
    });
    const finalUser = refreshedUser || newUser.user;

    let emailSent = false;
    let emailError: string | undefined;

    if (normalizedEmail && verificationToken) {
      const baseUrl = getAppBaseUrl(req);
      const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`;
      const sendResult = await sendWelcomeVerificationEmail({
        to: normalizedEmail,
        name: finalUser.name,
        verificationUrl,
      });
      emailSent = sendResult.success;
      if (!sendResult.success) {
        emailError = sendResult.error;
        console.warn('[register] Verification email sending error:', sendResult.error);
      }
    }

    const token = signJwt({
      userId: finalUser.id,
      phoneNumber: finalUser.phoneNumber,
      email: finalUser.email,
      role: finalUser.role,
    });

    const userProfile = {
      id: finalUser.id,
      phoneNumber: finalUser.phoneNumber,
      email: finalUser.email,
      bazaarAccountId: finalUser.bazaarAccountId,
      emailVerified: finalUser.emailVerified,
      name: finalUser.name,
      role: finalUser.role,
      creditBalance: finalUser.creditBalance,
      phoneVerified: finalUser.phoneVerified,
    };

    const response = NextResponse.json(
      {
        success: true,
        token,
        user: userProfile,
        claimedGuestSession: newUser.claimedGuestSession,
        emailSent,
        emailError: emailError ? 'ایمیل تأیید ارسال نشد؛ می‌توانید بعداً مجدداً درخواست نمایید.' : undefined,
        message: emailSent
          ? 'حساب کاربری با موفقیت ساخته شد و ایمیل تأیید ارسال گردید.'
          : 'حساب کاربری با موفقیت ساخته شد و ۱۵ صحنه رایگان دریافت کردید!',
      },
      { headers: corsHeaders }
    );

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
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
