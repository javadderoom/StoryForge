import { NextResponse } from 'next/server';

/**
 * Clears the auth cookie server-side.
 *
 * This must exist because the cookie is `httpOnly`, so client-side
 * `document.cookie = 'token=; expires=...'` cannot remove it. Without this
 * route, "logging out" only cleared localStorage while the browser kept
 * presenting a valid token — meaning any server-side auth guard would still see
 * the user as authenticated after they believed they had signed out.
 *
 * The Flutter client is Bearer-only and ignores cookies entirely; it discards
 * its token in local storage via AuthService.clearSession().
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
