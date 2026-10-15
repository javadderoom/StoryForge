import { NextRequest, NextResponse } from 'next/server';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';

export function middleware(req: NextRequest) {
  // Handle CORS preflight requests for all API endpoints
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  const response = NextResponse.next();
  const corsHeaders = buildCorsHeaders(req);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
