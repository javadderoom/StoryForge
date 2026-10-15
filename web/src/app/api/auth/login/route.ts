import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import {
  normalizePhoneNumber,
  verifyPassword,
  signJwt,
} from '@/lib/auth/jwt';
import { mergeUserAccounts } from '@/lib/auth/mergeAccounts';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function POST(req: Request) {
  try {
    const corsHeaders = buildCorsHeaders(req);
    const body = await req.json();
    const { identifier, phoneNumber, email, password, guestSessionId, bazaarAccountId } = body;
    const loginInput = (identifier || email || phoneNumber || '').trim();

    if (!loginInput || !password) {
      return NextResponse.json(
        { success: false, error: 'وارد کردن نشانی ایمیل یا شماره موبایل و رمز عبور الزامی است.' },
        { status: 400, headers: corsHeaders }
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
        { status: 503, headers: corsHeaders }
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
        { status: 401, headers: corsHeaders }
      );
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'رمز عبور وارد شده نادرست است.' },
        { status: 401, headers: corsHeaders }
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

    // Auto-link Bazaar account if provided
    let mergedBazaarAccount = false;
    const rawBazaarId = typeof bazaarAccountId === 'string' ? bazaarAccountId.trim() : null;
    if (rawBazaarId) {
      try {
        const existingByBazaar = await prisma.user.findUnique({
          where: { bazaarAccountId: rawBazaarId },
        });

        if (existingByBazaar && existingByBazaar.id !== user.id) {
          console.log(`[login] Merging secondary Bazaar user ${existingByBazaar.id} into primary ${user.id}`);
          await mergeUserAccounts(user.id, existingByBazaar.id, prisma);
          mergedBazaarAccount = true;
        }

        if (user.bazaarAccountId !== rawBazaarId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { bazaarAccountId: rawBazaarId },
          });
        }
      } catch (err) {
        console.warn('[login] Bazaar account linking/merging warning:', err);
      }
    }

    // Refresh user state in case credits or fields changed during merge
    const refreshedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    const finalUser = refreshedUser || user;

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
        claimedGuestSession,
        mergedBazaarAccount,
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
    const message = error instanceof Error ? error.message : 'خطای داخلی سرور در هنگام ورود.';
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
