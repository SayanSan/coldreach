import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { Pool as PgPool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Required for serverless environments
if (typeof globalThis.WebSocket === 'undefined') {
  // Only import ws in Node.js environments (not edge)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require('ws');
    neonConfig.webSocketConstructor = ws;
  } catch {
    // In edge runtime, WebSocket is available globally
  }
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (connectionString.includes('neon.tech')) {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool as any);
    return new PrismaClient({ adapter });
  }

  // Fallback to standard pg Pool for local environments
  const pgPool = new PgPool({ connectionString });
  const pgAdapter = new PrismaPg(pgPool);
  return new PrismaClient({ adapter: pgAdapter } as any);
};

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
