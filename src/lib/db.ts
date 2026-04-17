import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { Pool as PgPool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Required for serverless environments
if (typeof globalThis.WebSocket === 'undefined') {
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

// ── Lazy singleton ─────────────────────────────────────────────────────────────
// Client is NOT created at import time — only on first use.
// This prevents Vercel build failures when DATABASE_URL is not set during build.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    const client = globalForPrisma.prisma;
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
