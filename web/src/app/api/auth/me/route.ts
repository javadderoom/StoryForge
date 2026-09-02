import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';

export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: auth.user,
    });
  } catch (error: any) {
    console.error('Failed to get current user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
