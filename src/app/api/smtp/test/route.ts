import { NextRequest, NextResponse } from 'next/server';
import { testSmtpConnection } from '@/lib/smtp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, username, password, useTls } = body;

    if (!host || !port || !username || !password) {
      return NextResponse.json(
        { error: 'host, port, username, and password are required' },
        { status: 400 }
      );
    }

    const result = await testSmtpConnection({
      host,
      port: parseInt(port),
      username,
      password,
      useTls: useTls ?? true,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('SMTP test error:', error);
    return NextResponse.json(
      { success: false, message: 'Connection test failed' },
      { status: 500 }
    );
  }
}
