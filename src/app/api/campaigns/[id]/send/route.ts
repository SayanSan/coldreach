import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createTransporter } from '@/lib/smtp';
import { generateUnsubscribeToken } from '@/lib/tokens';
import { Contact } from '@prisma/client';

export const dynamic = 'force-dynamic';
// Allow up to 5 minutes for large campaigns
export const maxDuration = 300;

// ── Merge field substitution ──────────────────────────────────────────────────

function applyMergeFields(
  template: string,
  contact: Pick<Contact, 'email' | 'firstName' | 'lastName' | 'company' | 'title'>
): string {
  const fullName =
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email;
  return template
    .replace(/\{\{firstName\}\}/gi, contact.firstName || '')
    .replace(/\{\{lastName\}\}/gi, contact.lastName || '')
    .replace(/\{\{fullName\}\}/gi, fullName)
    .replace(/\{\{company\}\}/gi, contact.company || '')
    .replace(/\{\{title\}\}/gi, contact.title || '')
    .replace(/\{\{email\}\}/gi, contact.email);
}

// ── Build full HTML email ─────────────────────────────────────────────────────

function buildEmailHtml(
  bodyHtml: string,
  campaignEmailId: string,
  unsubscribeUrl: string,
  trackingBaseUrl: string,
  canSpamAddress: string
): string {
  const trackingPixel = `<img src="${trackingBaseUrl}/api/track/open/${campaignEmailId}" width="1" height="1" style="display:none;border:0;width:1px;height:1px;" alt="" />`;

  const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
  ${canSpamAddress ? `<p style="margin:0 0 6px 0;">${canSpamAddress.replace(/\n/g, '<br>')}</p>` : ''}
  <p style="margin:0;">
    You received this email because you are in our outreach list.
    If you no longer want to receive emails from us,
    <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">unsubscribe here</a>.
  </p>
</div>`;

  // If body already looks like a full HTML document, inject before </body>
  if (/<\/body>/i.test(bodyHtml)) {
    return bodyHtml.replace(/<\/body>/i, `${footer}${trackingPixel}</body>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;line-height:1.6;margin:0;padding:20px;">
${bodyHtml}
${footer}
${trackingPixel}
</body>
</html>`;
}

// ── Text fallback ─────────────────────────────────────────────────────────────

function buildEmailText(
  bodyText: string | null,
  bodyHtml: string | null,
  unsubscribeUrl: string,
  canSpamAddress: string
): string {
  const body = bodyText || stripHtml(bodyHtml || '');
  const addressBlock = canSpamAddress ? `\n\n${canSpamAddress}` : '';
  return `${body}${addressBlock}\n\nTo unsubscribe: ${unsubscribeUrl}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// ── POST: Initiate campaign sending ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Base URL for tracking links
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${request.nextUrl.protocol}//${request.headers.get('host')}`;

    // ── Load campaign ─────────────────────────────────────────────────────────
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        smtpAccount: true,
        contactList: {
          include: {
            members: { include: { contact: true } },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}` },
        { status: 400 }
      );
    }

    // ── Filter eligible contacts ───────────────────────────────────────────────
    const eligibleContacts = campaign.contactList.members
      .map((m) => m.contact)
      .filter((c) => !c.isUnsubscribed && c.bounceCount < 3);

    if (eligibleContacts.length === 0) {
      return NextResponse.json(
        { error: 'No eligible contacts in this list' },
        { status: 400 }
      );
    }

    // ── Create CampaignEmail records (idempotent) ──────────────────────────────
    const existingCount = await prisma.campaignEmail.count({
      where: { campaignId: campaign.id },
    });

    if (existingCount === 0) {
      await prisma.campaignEmail.createMany({
        data: eligibleContacts.map((contact) => ({
          campaignId: campaign.id,
          contactId: contact.id,
          smtpAccountId: campaign.smtpAccountId,
          status: 'QUEUED' as const,
        })),
      });
    }

    // ── Mark campaign as SENDING ───────────────────────────────────────────────
    await prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() },
    });

    // ── Load all QUEUED emails ────────────────────────────────────────────────
    const queuedEmails = await prisma.campaignEmail.findMany({
      where: { campaignId: campaign.id, status: 'QUEUED' },
      include: { contact: true },
    });

    if (queuedEmails.length === 0) {
      // All already sent; mark completed
      await prisma.campaign.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: 'Campaign already sent.' });
    }

    // ── Load CAN-SPAM address from settings ───────────────────────────────────
    let canSpamAddress = process.env.NEXT_PUBLIC_CAN_SPAM_ADDRESS || '';
    try {
      const setting = await prisma.appSettings.findUnique({ where: { key: 'can_spam_address' } });
      if (setting?.value) canSpamAddress = setting.value;
    } catch {
      // AppSettings table may not exist yet; fall through
    }

    // ── Create SMTP transporter ────────────────────────────────────────────────
    const transporter = createTransporter(campaign.smtpAccount);

    let sentCount = 0;
    let failedCount = 0;

    // ── Send each email ───────────────────────────────────────────────────────
    for (const emailRecord of queuedEmails) {
      // Re-check campaign hasn't been paused/cancelled between sends
      const freshStatus = await prisma.campaign.findUnique({
        where: { id },
        select: { status: true },
      });
      if (freshStatus?.status === 'PAUSED' || freshStatus?.status === 'CANCELLED') {
        break;
      }

      const contact = emailRecord.contact;

      try {
        // Personalise subject and body
        const personalizedSubject = applyMergeFields(campaign.subject, contact);
        const personalizedBodyHtml = campaign.bodyHtml
          ? applyMergeFields(campaign.bodyHtml, contact)
          : `<p>${applyMergeFields(campaign.bodyText || '', contact).replace(/\n/g, '<br>')}</p>`;

        // Signed unsubscribe token
        const unsubToken = generateUnsubscribeToken(contact.id);
        const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubToken}`;

        // Full HTML with footer + tracking pixel
        const htmlBody = buildEmailHtml(
          personalizedBodyHtml,
          emailRecord.id,
          unsubscribeUrl,
          baseUrl,
          canSpamAddress
        );

        const textBody = buildEmailText(
          campaign.bodyText ? applyMergeFields(campaign.bodyText, contact) : null,
          personalizedBodyHtml,
          unsubscribeUrl,
          canSpamAddress
        );

        // ── Send via Nodemailer ──────────────────────────────────────────────
        const info = await transporter.sendMail({
          from: campaign.fromName
            ? `"${campaign.fromName}" <${campaign.smtpAccount.email}>`
            : campaign.smtpAccount.email,
          to: contact.email,
          subject: personalizedSubject,
          html: htmlBody,
          text: textBody,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Campaign-Id': campaign.id,
          },
        });

        // ── Update email record ──────────────────────────────────────────────
        await prisma.campaignEmail.update({
          where: { id: emailRecord.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            messageId: info.messageId,
            personalizedSubject,
            personalizedBody: htmlBody,
          },
        });

        // Increment SMTP daily counter
        await prisma.smtpAccount.update({
          where: { id: campaign.smtpAccountId },
          data: { sentToday: { increment: 1 } },
        });

        sentCount++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await prisma.campaignEmail.update({
          where: { id: emailRecord.id },
          data: { status: 'FAILED', errorMessage },
        });
        failedCount++;
        console.error(`Failed to send email to ${contact.email}:`, err);
      }
    }

    // ── Mark campaign completed (or paused if interrupted) ────────────────────
    const remaining = await prisma.campaignEmail.count({
      where: { campaignId: campaign.id, status: 'QUEUED' },
    });

    const finalStatus = remaining === 0 ? 'COMPLETED' : 'PAUSED';
    await prisma.campaign.update({
      where: { id },
      data: {
        status: finalStatus,
        completedAt: finalStatus === 'COMPLETED' ? new Date() : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign ${finalStatus.toLowerCase()}. Sent: ${sentCount}, Failed: ${failedCount}.`,
      sentCount,
      failedCount,
    });
  } catch (error) {
    console.error('Campaign send error:', error);
    return NextResponse.json({ error: 'Failed to start campaign' }, { status: 500 });
  }
}
