import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Get campaign details with email stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        smtpAccount: { select: { name: true, email: true } },
        contactList: { select: { name: true } },
        followUpSteps: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get email status breakdown
    const statusCounts = await prisma.campaignEmail.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true,
    });

    const stats = {
      total: 0,
      queued: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
      failed: 0,
    };

    statusCounts.forEach((sc) => {
      const key = sc.status.toLowerCase() as keyof typeof stats;
      stats[key] = sc._count;
      stats.total += sc._count;
    });

    // Get individual emails (paginated)
    const emails = await prisma.campaignEmail.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        contact: { select: { email: true, firstName: true, lastName: true, company: true } },
      },
    });

    return NextResponse.json({ campaign, stats, emails });
  } catch (error) {
    console.error('Campaign detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

// PATCH: Update campaign status (pause, resume, cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await request.json();

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const transitions: Record<string, { from: string[]; to: string }> = {
      pause:  { from: ['SENDING'],          to: 'PAUSED'    },
      resume: { from: ['PAUSED'],            to: 'SENDING'   },
      cancel: { from: ['DRAFT', 'PAUSED', 'SENDING'], to: 'CANCELLED' },
    };

    const transition = transitions[action];
    if (!transition) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!transition.from.includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} a campaign in ${campaign.status} status` },
        { status: 400 }
      );
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: transition.to as 'PAUSED' | 'SENDING' | 'CANCELLED',
        completedAt: transition.to === 'CANCELLED' ? new Date() : undefined,
      },
    });

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    console.error('Campaign status update error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
