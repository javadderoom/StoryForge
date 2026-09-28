import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const isProduction = process.env.NODE_ENV === 'production';

export function getPrisma(): PrismaClient | null {
  if (process.env.ENABLE_DB !== 'true') {
    if (isProduction && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw new Error(
        'ENABLE_DB must be "true" in production. The database is mandatory; without it ' +
          'authentication degrades to a fail-open path and repositories silently no-op.'
      );
    }
    return null;
  }
  if (!globalForPrisma.prisma) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgrespassword@localhost:5432/storyforge?schema=public';
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
    });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: ['error'],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrisma();
    if (!client) {
      throw new Error('Database is disabled. Set ENABLE_DB=true to enable database connection.');
    }
    return Reflect.get(client, prop, receiver);
  },
});


