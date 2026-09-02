import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import {
  normalizePhoneNumber,
  isValidIranianPhone,
  hashPassword,
  signJwt,
} from '@/lib/auth/jwt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phoneNumber, password, name, guestSessionId } = body;

    if (!phoneNumber || !password) {
      return NextResponse.json(
        { success: false, error: 'Phone number and password are required.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!isValidIranianPhone(normalizedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number format. Please enter a valid Iranian mobile number (e.g. 09121234567).',
        },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this phone number already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const initialCredits = 15; // Welcome bonus for new adventurers

    // Create user and welcome bonus ledger in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          phoneNumber: normalizedPhone,
          passwordHash,
          name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : null,
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

      // Migrate guest session if provided
      if (guestSessionId && typeof guestSessionId === 'string') {
        await tx.playthroughSession.updateMany({
          where: { sessionId: guestSessionId },
          data: { userId: u.id },
        });
      }

      return u;
    });

    const token = signJwt({
      userId: newUser.id,
      phoneNumber: newUser.phoneNumber,
      role: newUser.role,
    });

    const userProfile = {
      id: newUser.id,
      phoneNumber: newUser.phoneNumber,
      name: newUser.name,
      role: newUser.role,
      creditBalance: newUser.creditBalance,
      phoneVerified: newUser.phoneVerified,
    };

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
      message: 'Account created successfully with 15 bonus scene credits!',
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
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during registration.' },
      { status: 500 }
    );
  }
}
