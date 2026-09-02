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

    // Migrate guest session if provided
    if (guestSessionId && typeof guestSessionId === 'string') {
      try {
        await prisma.playthroughSession.updateMany({
          where: { sessionId: guestSessionId },
          data: { userId: user.id },
        });
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
      name: user.name,
      role: user.role,
      creditBalance: user.creditBalance,
      phoneVerified: user.phoneVerified,
    };

    const response = NextResponse.json({
      success: true,
      token,
      user: userProfile,
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
