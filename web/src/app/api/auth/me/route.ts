import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function GET(req: Request) {
  try {
    const corsHeaders = buildCorsHeaders(req);
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: auth.user,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Failed to get current user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
