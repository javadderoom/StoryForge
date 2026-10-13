import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import {
  normalizePhoneNumber,
  isValidIranianPhone,
  hashPassword,
  verifyPassword,
  signJwt,
} from '@/lib/auth/jwt';
import { mergeUserAccounts } from '@/lib/auth/mergeAccounts';

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { phoneNumber, email, password, existingAccountPassword } = body;

    const rawPhone = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';
    const existingPassword = typeof existingAccountPassword === 'string'
      ? existingAccountPassword
      : rawPassword;

    if (!rawPhone && !rawEmail) {
      return NextResponse.json(
        { success: false, error: 'وارد کردن حداقل یک نشانی ایمیل یا شماره موبایل الزامی است.' },
        { status: 400 }
      );
    }

    let normalizedPhone: string | null = null;
    if (rawPhone) {
      normalizedPhone = normalizePhoneNumber(rawPhone);
      if (!isValidIranianPhone(normalizedPhone)) {
        return NextResponse.json(
          { success: false, error: 'فرمت شماره موبایل نامعتبر است. لطفاً شماره معتبر وارد کنید.' },
          { status: 400 }
        );
      }
    }

    let normalizedEmail: string | null = null;
    if (rawEmail) {
      normalizedEmail = rawEmail;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json(
          { success: false, error: 'فرمت نشانی ایمیل نامعتبر است.' },
          { status: 400 }
        );
      }
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'سرویس پایگاه داده در دسترس نیست.' },
        { status: 503 }
      );
    }

    const currentUserId = auth.user.id;

    // Check if phone or email already belongs to a DIFFERENT user
    const conflictClauses = [];
    if (normalizedPhone) conflictClauses.push({ phoneNumber: normalizedPhone });
    if (normalizedEmail) conflictClauses.push({ email: normalizedEmail });

    const existingOtherUser = await prisma.user.findFirst({
      where: {
        id: { not: currentUserId },
        OR: conflictClauses,
      },
    });

    // Case 1: The contact belongs to an existing account.
    // If the user provides the correct password for that account, merge them!
    if (existingOtherUser) {
      if (!existingPassword) {
        return NextResponse.json(
          {
            success: false,
            error: 'این شماره یا ایمیل قبلاً ثبت‌نام شده است. برای اتصال و ادغام حساب‌ها، رمز عبور آن حساب را وارد نمایید.',
            requiresExistingPassword: true,
          },
          { status: 409 }
        );
      }

      const isMatch = verifyPassword(existingPassword, existingOtherUser.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          {
            success: false,
            error: 'رمز عبور حساب موجود نادرست است. ادغام انجام نشد.',
            requiresExistingPassword: true,
          },
          { status: 401 }
        );
      }

      // Merge current temporary account into the existing primary account
      console.log(`[link-contact] Merging user ${currentUserId} into existing registered account ${existingOtherUser.id}`);
      await mergeUserAccounts(existingOtherUser.id, currentUserId, prisma);

      const refreshedPrimary = await prisma.user.findUnique({
        where: { id: existingOtherUser.id },
      });
      const finalUser = refreshedPrimary || existingOtherUser;

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

      const response = NextResponse.json({
        success: true,
        merged: true,
        token,
        user: userProfile,
        message: 'حساب‌های کاربری با موفقیت ادغام شدند.',
      });

      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });

      return response;
    }

    // Case 2: Contact is free. Update the current user.
    if (rawPassword && rawPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' },
        { status: 400 }
      );
    }

    const updateData: {
      phoneNumber?: string;
      email?: string;
      passwordHash?: string;
    } = {};

    if (normalizedPhone) updateData.phoneNumber = normalizedPhone;
    if (normalizedEmail) updateData.email = normalizedEmail;
    if (rawPassword) updateData.passwordHash = hashPassword(rawPassword);

    const updatedUser = await prisma.user.update({
      where: { id: currentUserId },
      data: updateData,
    });

    const token = signJwt({
      userId: updatedUser.id,
      phoneNumber: updatedUser.phoneNumber,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const userProfile = {
      id: updatedUser.id,
      phoneNumber: updatedUser.phoneNumber,
      email: updatedUser.email,
      bazaarAccountId: updatedUser.bazaarAccountId,
      emailVerified: updatedUser.emailVerified,
      name: updatedUser.name,
      role: updatedUser.role,
      creditBalance: updatedUser.creditBalance,
      phoneVerified: updatedUser.phoneVerified,
    };

    const response = NextResponse.json({
      success: true,
      merged: false,
      token,
      user: userProfile,
      message: 'مشخصات تماس با موفقیت به حساب شما متصل شد.',
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطای داخلی در اتصال مشخصات تماس.';
    console.error('[API /api/auth/link-contact] Error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
