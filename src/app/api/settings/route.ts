import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const SENSITIVE_KEYS = new Set(['openai_api_key']);

// GET: Return all settings (sensitive values masked)
export async function GET() {
  try {
    const rows = await prisma.appSettings.findMany();

    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (SENSITIVE_KEYS.has(row.key)) {
        // Return masked value so the UI can show it's set
        settings[row.key] = row.value ? '••••••••' : '';
      } else {
        settings[row.key] = row.value;
      }
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT: Upsert one or more settings
export async function PUT(request: NextRequest) {
  try {
    const body: Record<string, string> = await request.json();

    const upserts = Object.entries(body).map(([key, value]) => {
      // Encrypt sensitive keys
      const storedValue =
        SENSITIVE_KEYS.has(key) && value && value !== '••••••••'
          ? encrypt(value)
          : value;

      return prisma.appSettings.upsert({
        where: { key },
        create: { key, value: storedValue },
        update: { value: storedValue },
      });
    });

    await prisma.$transaction(upserts);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

// Helper exported for other routes to read a decrypted setting
export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.appSettings.findUnique({ where: { key } });
    if (!row) return null;
    if (SENSITIVE_KEYS.has(key) && row.value) {
      return decrypt(row.value);
    }
    return row.value;
  } catch {
    return null;
  }
}
