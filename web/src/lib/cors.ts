import { NextResponse } from 'next/server';

/**
 * CORS policy for the play API.
 *
 * WHY THIS IS NOT A WILDCARD
 * The previous value was `Access-Control-Allow-Origin: '*'` alongside
 * `Access-Control-Allow-Credentials: 'true'`. That pair is invalid per the Fetch
 * spec — browsers reject `*` when credentials are allowed — so it was both
 * broken AND advertised a fully open policy. The obvious "fix" of reflecting the
 * request Origin would have been strictly WORSE: it would have credentialed
 * every origin on the internet and made the `token` cookie replayable from any
 * site. Authorization (see lib/auth/studioAuth.ts) had to land first.
 *
 * The Flutter client is Bearer-only and ignores cookies entirely, so it needs
 * CORS permission but never credentials.
 */

/**
 * Origins permitted to call the API. Configure per environment:
 *   ALLOWED_ORIGINS="https://story-forge-rouge.vercel.app,http://localhost:3000"
 *
 * When unset we fall back to the local dev origins rather than `*`. This is
 * deliberately restrictive: a missing env var should break a deploy loudly
 * during testing, not silently open the API to the internet in production.
 */
function getAllowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

/**
 * Resolve the `Access-Control-Allow-Origin` value for a request.
 * Returns the origin only when it is allowlisted; otherwise no CORS headers are
 * emitted at all (the browser then blocks the response).
 */
export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  const normalized = requestOrigin.replace(/\/+$/, '');
  return getAllowedOrigins().includes(normalized) ? normalized : null;
}

/**
 * Static headers safe to attach unconditionally (no origin-dependent values).
 *
 * The `Authorization` header is explicitly allowed because the Flutter client
 * is Bearer-only. `X-CSRF-Token` was previously advertised but never issued or
 * verified — cookie auth relies on `sameSite: 'lax'` — so it is dropped to avoid
 * implying a CSRF defence that does not exist.
 */
const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

/**
 * Build CORS headers for a request. Includes `Access-Control-Allow-Credentials`
 * ONLY when the origin is allowlisted, since the header is meaningless (and the
 * browser will reject it) without a concrete origin.
 */
export function buildCorsHeaders(req?: Request | null): Record<string, string> {
  const origin = req ? resolveCorsOrigin(req.headers.get('origin')) : null;
  if (!origin) return { ...BASE_CORS_HEADERS };
  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

/**
 * Convenience for the many routes that already import `corsHeaders` as a
 * constant. Prefer `buildCorsHeaders(req)` — this fallback exists so a route
 * that forgets to pass the request still gets safe (non-credentialed) headers
 * rather than the old unconditional wildcard.
 */
export const corsHeaders: Record<string, string> = { ...BASE_CORS_HEADERS };

export function handleCorsPreflight(req?: Request | null) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req),
  });
}
