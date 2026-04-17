import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Record the open (fire-and-forget)
    prisma.campaignEmail
      .update({
        where: { id },
        data: {
          status: 'OPENED',
          openedAt: new Date(),
        },
      })
      .catch(() => {
        // Silently fail - tracking should never break the pixel
      });

    return new NextResponse(PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': String(PIXEL.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch {
    // Return pixel anyway
    return new NextResponse(PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
}
