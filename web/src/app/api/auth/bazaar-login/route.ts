import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { normalizePhoneNumber, signJwt, hashPassword } from '@/lib/auth/jwt';
import { mergeUserAccounts } from '@/lib/auth/mergeAccounts';
import crypto from 'node:crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bazaarAccountId, phoneNumber, email, name, guestSessionId } = body;

    const rawId = typeof bazaarAccountId === 'string' ? bazaarAccountId.trim() : '';
    const rawPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!rawId && !rawPhone && !rawEmail) {
      return NextResponse.json(
        { success: false, error: 'شناسه حساب کافه‌بازار یا شماره موبایل/ایمیل الزامی است.' },
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
    const normalizedEmail = rawEmail && rawEmail.includes('@') ? rawEmail : null;

    // 1. Look for existing users by Contact (Phone or Email) and by Bazaar Account ID
    const existingByPhone = normalizedPhone
      ? await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } })
      : null;

    const existingByEmail = normalizedEmail
      ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
      : null;

    const existingByBazaar = rawId
      ? await prisma.user.findUnique({ where: { bazaarAccountId: rawId } })
      : null;

    let targetUser: any = null;
    let mergedOrphan = false;

    // Case A: Existing registered user with this phone or email was found
    const existingPrimary = existingByPhone || existingByEmail;
    if (existingPrimary) {
      targetUser = existingPrimary;

      // If a separate temporary Bazaar account existed with this rawId, merge it!
      if (existingByBazaar && existingByBazaar.id !== targetUser.id) {
        console.log(`[bazaar-login] Merging temporary Bazaar user ${existingByBazaar.id} into primary ${targetUser.id}`);
        await mergeUserAccounts(targetUser.id, existingByBazaar.id, prisma);
        mergedOrphan = true;
      }

      // Link bazaarAccountId and update missing contact info on the primary account
      targetUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          ...(rawId ? { bazaarAccountId: rawId } : {}),
          ...(!targetUser.phoneNumber && normalizedPhone ? { phoneNumber: normalizedPhone } : {}),
          ...(!targetUser.email && normalizedEmail ? { email: normalizedEmail } : {}),
        },
      });
    }
    // Case B: No user found by phone/email, but existing user found by bazaarAccountId
    else if (existingByBazaar) {
      targetUser = existingByBazaar;

      // Enrich with phone/email if now supplied
      if (normalizedPhone || normalizedEmail) {
        targetUser = await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            ...(!targetUser.phoneNumber && normalizedPhone ? { phoneNumber: normalizedPhone } : {}),
            ...(!targetUser.email && normalizedEmail ? { email: normalizedEmail } : {}),
          },
        });
      }
    }
    // Case C: Neither exists - create a fresh user with proper mapping
    else {
      const generatedPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(generatedPassword);
      const initialCredits = 15;

      targetUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            bazaarAccountId: rawId || null,
            phoneNumber: normalizedPhone,
            email: normalizedEmail,
            passwordHash,
            name: (name && typeof name === 'string' && name.trim().length > 0)
              ? name.trim()
              : 'ماجراجوی کافه‌بازار',
            creditBalance: initialCredits,
            phoneVerified: Boolean(normalizedPhone),
            emailVerified: false,
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
            userId: targetUser.id,
          },
        });
      } catch {
        /* non-fatal */
      }
    }

    const token = signJwt({
      userId: targetUser.id,
      phoneNumber: targetUser.phoneNumber,
      email: targetUser.email,
      role: targetUser.role,
    });

    const userProfile = {
      id: targetUser.id,
      phoneNumber: targetUser.phoneNumber,
      email: targetUser.email,
      bazaarAccountId: targetUser.bazaarAccountId,
      name: targetUser.name,
      role: targetUser.role,
      creditBalance: targetUser.creditBalance,
      phoneVerified: targetUser.phoneVerified,
      emailVerified: targetUser.emailVerified,
    };

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
      mergedOrphan,
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
