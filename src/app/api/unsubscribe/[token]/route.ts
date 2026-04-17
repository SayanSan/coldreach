import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/tokens';

// GET: Show unsubscribe confirmation page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribe</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0d1117; color: #e6edf3; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 48px; text-align: center; max-width: 480px; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        p { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
        button { background: linear-gradient(135deg, #388bfd, #2563eb); color: white; border: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        button:hover { opacity: 0.9; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .done { color: #3fb950; font-size: 28px; }
        .error { color: #f85149; }
      </style>
    </head>
    <body>
      <div class="card" id="card">
        <h1>Unsubscribe</h1>
        <p>Click below to unsubscribe from future emails. You will no longer receive messages from this sender.</p>
        <button id="btn" onclick="doUnsubscribe()">Unsubscribe Me</button>
      </div>
      <script>
        async function doUnsubscribe() {
          const btn = document.getElementById('btn');
          btn.disabled = true;
          btn.textContent = 'Processing...';
          try {
            const res = await fetch(window.location.pathname, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
              document.getElementById('card').innerHTML = '<div class="done">&#10003;</div><h1>Unsubscribed</h1><p>You have been successfully unsubscribed and will no longer receive emails from us.</p>';
            } else {
              document.getElementById('card').innerHTML = '<h1 class="error">Error</h1><p>' + (data.error || 'Something went wrong. Please try again.') + '</p>';
            }
          } catch {
            document.getElementById('card').innerHTML = '<h1 class="error">Error</h1><p>Something went wrong. Please try again.</p>';
          }
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// POST: Process unsubscribe
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Verify the HMAC-signed token
    const contactId = verifyUnsubscribeToken(token);

    if (!contactId) {
      return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    if (contact.isUnsubscribed) {
      return NextResponse.json({ success: true, message: 'Already unsubscribed' });
    }

    // Mark contact as unsubscribed
    await prisma.contact.update({
      where: { id: contactId },
      data: { isUnsubscribed: true },
    });

    // Log the unsubscribe
    await prisma.unsubscribeLog.create({
      data: {
        contactId,
        reason: 'User clicked unsubscribe link',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
}
