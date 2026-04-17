import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const [
      emailsSentToday,
      emailsSentWeek,
      emailsSentMonth,
      totalSent,
      totalOpened,
      totalReplied,
      totalBounced,
      activeCampaigns,
      totalContacts,
      hotLeads,
      smtpAccounts,
    ] = await Promise.all([
      prisma.campaignEmail.count({
        where: { sentAt: { gte: todayStart }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } },
      }),
      prisma.campaignEmail.count({
        where: { sentAt: { gte: weekStart }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } },
      }),
      prisma.campaignEmail.count({
        where: { sentAt: { gte: monthStart }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } },
      }),
      prisma.campaignEmail.count({
        where: { status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] } },
      }),
      prisma.campaignEmail.count({
        where: { status: { in: ['OPENED', 'REPLIED'] } },
      }),
      prisma.campaignEmail.count({
        where: { status: 'REPLIED' },
      }),
      prisma.campaignEmail.count({
        where: { status: 'BOUNCED' },
      }),
      prisma.campaign.count({
        where: { status: { in: ['SENDING', 'SCHEDULED'] } },
      }),
      prisma.contact.count(),
      prisma.lead.count({
        where: { leadScore: 'HOT' },
      }),
      prisma.smtpAccount.count({
        where: { isActive: true },
      }),
    ]);

    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
    const bounceRate = totalSent > 0 ? Math.round((totalBounced / (totalSent + totalBounced)) * 100) : 0;

    return NextResponse.json({
      emailsSentToday,
      emailsSentWeek,
      emailsSentMonth,
      openRate,
      replyRate,
      bounceRate,
      activeCampaigns,
      totalContacts,
      hotLeads,
      smtpAccounts,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
