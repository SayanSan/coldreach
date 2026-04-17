import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: List contacts with pagination and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const listId = searchParams.get('listId');
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (listId) {
      where.listMemberships = {
        some: { listId },
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          listMemberships: {
            include: { list: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      contacts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Contacts list error:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST: Create contact(s) - supports single and bulk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Bulk import (CSV parsed data)
    if (Array.isArray(body.contacts)) {
      const contacts = body.contacts;
      let created = 0;
      let skipped = 0;

      for (const c of contacts) {
        if (!c.email) {
          skipped++;
          continue;
        }
        try {
          await prisma.contact.upsert({
            where: { email: c.email.toLowerCase().trim() },
            create: {
              email: c.email.toLowerCase().trim(),
              firstName: c.firstName || c.first_name || null,
              lastName: c.lastName || c.last_name || null,
              company: c.company || null,
              title: c.title || null,
              customFields: c.customFields || null,
            },
            update: {
              firstName: c.firstName || c.first_name || undefined,
              lastName: c.lastName || c.last_name || undefined,
              company: c.company || undefined,
              title: c.title || undefined,
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }

      // Add to list if specified
      if (body.listId) {
        const allContacts = await prisma.contact.findMany({
          where: {
            email: { in: contacts.map((c: { email: string }) => c.email?.toLowerCase().trim()).filter(Boolean) },
          },
          select: { id: true },
        });

        for (const contact of allContacts) {
          try {
            await prisma.contactListMember.upsert({
              where: {
                contactId_listId: { contactId: contact.id, listId: body.listId },
              },
              create: { contactId: contact.id, listId: body.listId },
              update: {},
            });
          } catch { /* skip duplicates */ }
        }
      }

      return NextResponse.json({ created, skipped, total: contacts.length });
    }

    // Single contact
    const { email, firstName, lastName, company, title, listId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        email: email.toLowerCase().trim(),
        firstName,
        lastName,
        company,
        title,
      },
    });

    if (listId) {
      await prisma.contactListMember.create({
        data: { contactId: contact.id, listId },
      });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Contact create error:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}

// DELETE: Remove contact
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact delete error:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
