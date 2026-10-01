import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db/client';
import {
  normalizePhoneNumber,
  isValidIranianPhone,
  verifyPassword,
  signJwt,
} from '@/lib/auth/jwt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phoneNumber, password, guestSessionId } = body;

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

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No account found with this phone number.' },
        { status: 401 }
      );
    }

    const isMatch = verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password.' },
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
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during login.' },
      { status: 500 }
    );
  }
}
