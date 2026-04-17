import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List leads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const score = searchParams.get('score');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (stage) where.stage = stage;
    if (score) where.leadScore = score;

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { email: true, firstName: true, lastName: true, company: true, title: true } },
        campaignEmail: {
          select: { personalizedSubject: true, campaign: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// PUT: Update lead (stage, notes)
export async function PUT(request: NextRequest) {
  try {
    const { id, stage, notes, leadScore } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (stage) data.stage = stage;
    if (notes !== undefined) data.notes = notes;
    if (leadScore) data.leadScore = leadScore;

    const lead = await prisma.lead.update({ where: { id }, data });
    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Lead update error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}
