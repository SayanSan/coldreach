import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List all contact lists
export async function GET() {
  try {
    const lists = await prisma.contactList.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true, campaigns: true },
        },
      },
    });

    return NextResponse.json({ lists });
  } catch (error) {
    console.error('Contact lists error:', error);
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

// POST: Create contact list
export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const list = await prisma.contactList.create({
      data: { name, description },
    });

    return NextResponse.json({ list });
  } catch (error) {
    console.error('List create error:', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}

// PUT: Update contact list
export async function PUT(request: NextRequest) {
  try {
    const { id, name, description } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
    }

    const list = await prisma.contactList.update({
      where: { id },
      data: { name, description },
    });

    return NextResponse.json({ list });
  } catch (error) {
    console.error('List update error:', error);
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}

// DELETE: Remove contact list
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
    }

    await prisma.contactList.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('List delete error:', error);
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
