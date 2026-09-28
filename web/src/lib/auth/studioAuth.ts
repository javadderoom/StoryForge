import { NextResponse } from 'next/server';
import { getAuthenticatedUser, AuthenticatedUser } from './getUser';

/**
 * Authorization helpers for the Studio authoring surface.
 *
 * The Studio is a same-origin, author-only application: nothing under
 * /api/studio/* should ever be reachable by an anonymous visitor, because those
 * routes create and destroy worlds, mutate canon, and spend LLM budget.
 *
 * `decideStudioWrite` is deliberately a pure function so the authorization
 * decision can be unit-tested without a database or a running server — the test
 * suite is entirely offline (see scripts/testAll.ts).
 */

export type StudioRole = 'AUTHOR' | 'ADMIN';

const STUDIO_ROLES: readonly StudioRole[] = ['AUTHOR', 'ADMIN'];

export type AuthzDecision =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Pure authorization decision for a Studio write.
 *
 * Anonymous callers get 403 rather than 401, matching the established house
 * style in studio/encounters/route.ts — `!auth` short-circuits the same `||`.
 */
export function decideStudioWrite(auth: AuthenticatedUser | null): AuthzDecision {
  if (!auth) {
    return {
      ok: false,
      status: 403,
      error: 'Unauthorized. Admin or Author permissions required.',
    };
  }
  if (!STUDIO_ROLES.includes(auth.role as StudioRole)) {
    return {
      ok: false,
      status: 403,
      error: 'Unauthorized. Admin or Author permissions required.',
    };
  }
  return { ok: true, user: auth };
}

/** True when the user holds one of the given roles. */
export function hasRole(user: AuthenticatedUser | null, roles: readonly string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Route-handler wrapper. Returns either the authenticated user or a ready-made
 * 403 NextResponse — call it as the FIRST statement inside `try`, before
 * `req.json()`, so an unauthorized request never reaches its handler body.
 *
 * ```ts
 * const guard = await requireStudioWrite(req);
 * if (!guard.ok) return guard.response;
 * ```
 */
export async function requireStudioWrite(req: Request): Promise<
  { ok: true; user: AuthenticatedUser; response?: never } | { ok: false; response: NextResponse }
> {
  const auth = await getAuthenticatedUser(req);
  const decision = decideStudioWrite(auth?.user ?? null);
  if (!decision.ok) {
    return { ok: false, response: NextResponse.json({ success: false, error: decision.error }, { status: decision.status }) };
  }
  return { ok: true, user: decision.user };
}
