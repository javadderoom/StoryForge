import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { normalizePhoneNumber, signJwt, hashPassword } from '@/lib/auth/jwt';
import crypto from 'node:crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bazaarAccountId, phoneNumber, name, guestSessionId } = body;

    const rawId = typeof bazaarAccountId === 'string' ? bazaarAccountId.trim() : '';
    const rawPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';

    if (!rawId && !rawPhone) {
      return NextResponse.json(
        { success: false, error: 'شناسه یا اطلاعات حساب کافه‌بازار دریافت نشد.' },
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

    const normalizedPhone = rawPhone ? normalizePhoneNumber(rawPhone) : null;
    const lookupKey = normalizedPhone || (rawId ? `bazaar_${rawId}` : null);

    if (!lookupKey) {
      return NextResponse.json(
        { success: false, error: 'شناسه حساب کافه‌بازار نامعتبر است.' },
        { status: 400 }
      );
    }

    // Try finding existing user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
          { phoneNumber: lookupKey },
        ],
      },
    });

    // If not found, create a new user with 15 welcome scenes
    if (!user) {
      const generatedPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(generatedPassword);
      const initialCredits = 15;

      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            phoneNumber: lookupKey,
            passwordHash,
            name: (name && typeof name === 'string' && name.trim().length > 0)
              ? name.trim()
              : 'ماجراجوی کافه‌بازار',
            creditBalance: initialCredits,
            phoneVerified: true,
          },
        });

        await tx.userCreditLedger.create({
          data: {
            userId: u.id,
            amount: initialCredits,
            balanceAfter: initialCredits,
            reason: 'welcome_bonus',
            metadata: {
              source: 'cafebazaar_quick_login',
              bazaarAccountId: rawId,
              timestamp: new Date().toISOString(),
            },
          },
        });

        return u;
      });
    }

    // Reassign guest session if provided
    if (guestSessionId && typeof guestSessionId === 'string') {
      try {
        await prisma.playthroughSession.updateMany({
          where: {
            sessionId: guestSessionId,
            userId: null,
          },
          data: {
            userId: user.id,
          },
        });
      } catch {
        /* non-fatal */
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
      name: user.name,
      role: user.role,
      creditBalance: user.creditBalance,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
    };

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
    });

    // Set HTTP-only session cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('[API /api/auth/bazaar-login] Error:', error);
    return NextResponse.json(
      { success: false, error: 'خطای داخلی در فرآیند ورود با کافه‌بازار.' },
      { status: 500 }
    );
  }
}
