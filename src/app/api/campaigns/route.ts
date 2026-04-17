import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List campaigns with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        smtpAccount: { select: { name: true, email: true } },
        contactList: { select: { name: true } },
        _count: { select: { campaignEmails: true, followUpSteps: true } },
      },
    });

    // Get stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (c) => {
        const [sent, opened, replied, bounced] = await Promise.all([
          prisma.campaignEmail.count({ where: { campaignId: c.id, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } } }),
          prisma.campaignEmail.count({ where: { campaignId: c.id, status: { in: ['OPENED', 'REPLIED'] } } }),
          prisma.campaignEmail.count({ where: { campaignId: c.id, status: 'REPLIED' } }),
          prisma.campaignEmail.count({ where: { campaignId: c.id, status: 'BOUNCED' } }),
        ]);
        return { ...c, sent, opened, replied, bounced };
      })
    );

    return NextResponse.json({ campaigns: campaignsWithStats });
  } catch (error) {
    console.error('Campaigns list error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST: Create campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, subject, bodyHtml, bodyText, fromName,
      smtpAccountId, contactListId, sendRatePerHour,
      scheduledAt, followUpSteps,
    } = body;

    if (!name || !subject || !smtpAccountId || !contactListId) {
      return NextResponse.json(
        { error: 'name, subject, smtpAccountId, and contactListId are required' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        subject,
        bodyHtml,
        bodyText,
        fromName,
        smtpAccountId,
        contactListId,
        sendRatePerHour: sendRatePerHour || 50,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'DRAFT',
      },
    });

    // Create follow-up steps if provided
    if (followUpSteps && Array.isArray(followUpSteps)) {
      for (let i = 0; i < followUpSteps.length; i++) {
        const step = followUpSteps[i];
        await prisma.followUpStep.create({
          data: {
            campaignId: campaign.id,
            stepNumber: i + 1,
            delayDays: step.delayDays || 3,
            delayHours: step.delayHours || 0,
            subject: step.subject,
            bodyHtml: step.bodyHtml,
            bodyText: step.bodyText,
            condition: step.condition || 'NO_REPLY',
          },
        });
      }
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Campaign create error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

// PUT: Update campaign
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Campaign update error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
