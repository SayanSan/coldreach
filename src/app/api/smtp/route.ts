import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';
import { getImapHostFromSmtp } from '@/lib/smtp';

export const dynamic = 'force-dynamic';

// GET: List all SMTP accounts
export async function GET() {
  try {
    const accounts = await prisma.smtpAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Mask passwords
    const masked = accounts.map((a) => ({
      ...a,
      passwordEncrypted: '********',
    }));

    return NextResponse.json({ accounts: masked });
  } catch (error) {
    console.error('SMTP list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMTP accounts' },
      { status: 500 }
    );
  }
}

// POST: Create new SMTP account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      host,
      port,
      username,
      password,
      useTls = true,
      dailyLimit = 500,
      imapHost,
      imapPort = 993,
    } = body;

    if (!name || !email || !host || !port || !username || !password) {
      return NextResponse.json(
        { error: 'All fields are required: name, email, host, port, username, password' },
        { status: 400 }
      );
    }

    const passwordEncrypted = encrypt(password);
    const derivedImapHost = imapHost || getImapHostFromSmtp(host);

    const account = await prisma.smtpAccount.create({
      data: {
        name,
        email,
        host,
        port: parseInt(port),
        username,
        passwordEncrypted,
        useTls,
        dailyLimit: parseInt(dailyLimit),
        imapHost: derivedImapHost,
        imapPort: parseInt(imapPort),
      },
    });

    return NextResponse.json({
      account: { ...account, passwordEncrypted: '********' },
    });
  } catch (error) {
    console.error('SMTP create error:', error);
    return NextResponse.json(
      { error: 'Failed to create SMTP account' },
      { status: 500 }
    );
  }
}

// PUT: Update SMTP account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...rest };

    if (rest.port) updateData.port = parseInt(rest.port);
    if (rest.dailyLimit) updateData.dailyLimit = parseInt(rest.dailyLimit);
    if (rest.imapPort) updateData.imapPort = parseInt(rest.imapPort);

    // Only update password if provided
    if (password && password !== '********') {
      updateData.passwordEncrypted = encrypt(password);
    }
    delete updateData.password;

    const account = await prisma.smtpAccount.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      account: { ...account, passwordEncrypted: '********' },
    });
  } catch (error) {
    console.error('SMTP update error:', error);
    return NextResponse.json(
      { error: 'Failed to update SMTP account' },
      { status: 500 }
    );
  }
}

// DELETE: Remove SMTP account
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    await prisma.smtpAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SMTP delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete SMTP account' },
      { status: 500 }
    );
  }
}
