import { getPrisma } from '@/lib/db/client';
import { verifyJwt, JwtUserPayload } from './jwt';

export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  name: string | null;
  role: string;
  creditBalance: number;
  phoneVerified: boolean;
}

/**
 * Extracts Bearer token or cookie from a Request and verifies it
 */
export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );
    if (cookies.token) return cookies.token;
    if (cookies.auth_token) return cookies.auth_token;
  }

  return null;
}

/**
 * Retrieves the current authenticated user and their live credit balance
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<{ user: AuthenticatedUser; payload: JwtUserPayload } | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  const payload = verifyJwt(token);
  if (!payload || !payload.userId) return null;

  const prisma = getPrisma();
  if (!prisma) {
    // Return payload-based session when DB is in memory-only mode
    return {
      user: {
        id: payload.userId,
        phoneNumber: payload.phoneNumber,
        name: null,
        role: payload.role || 'READER',
        creditBalance: 15,
        phoneVerified: false,
      },
      payload,
    };
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        role: true,
        creditBalance: true,
        phoneVerified: true,
      },
    });

    if (!dbUser) return null;

    return {
      user: dbUser,
      payload,
    };
  } catch (error) {
    console.error('Failed to query authenticated user from database:', error);
    return null;
  }
}
