import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createTransporter } from '@/lib/smtp';
import { generateUnsubscribeToken } from '@/lib/tokens';
import { Contact } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ── Merge fields ──────────────────────────────────────────────────────────────

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

function buildFollowUpHtml(
  bodyHtml: string,
  followUpEmailId: string,
  unsubscribeUrl: string,
  baseUrl: string,
  canSpamAddress: string
): string {
  const trackingPixel = `<img src="${baseUrl}/api/track/open/followup/${followUpEmailId}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
  ${canSpamAddress ? `<p style="margin:0 0 6px 0;">${canSpamAddress.replace(/\n/g, '<br>')}</p>` : ''}
  <p style="margin:0;">
    <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
  </p>
</div>`;

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

// ── Worker ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    `${request.nextUrl.protocol}//${request.headers.get('host')}`;

  const results = {
    emailsChecked: 0,
    followUpsSent: 0,
    followUpsFailed: 0,
    errors: [] as string[],
  };

  // Load CAN-SPAM address
  let canSpamAddress = process.env.NEXT_PUBLIC_CAN_SPAM_ADDRESS || '';
  try {
    const setting = await prisma.appSettings.findUnique({ where: { key: 'can_spam_address' } });
    if (setting?.value) canSpamAddress = setting.value;
  } catch {
    // AppSettings may not exist yet
  }

  // Find all SENDING campaigns that have follow-up steps
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ['SENDING', 'COMPLETED'] }, followUpSteps: { some: { isActive: true } } },
    include: {
      followUpSteps: { where: { isActive: true }, orderBy: { stepNumber: 'asc' } },
      smtpAccount: true,
    },
  });

  for (const campaign of campaigns) {
    if (campaign.followUpSteps.length === 0) continue;

    // Get all sent emails for this campaign that haven't replied
    const sentEmails = await prisma.campaignEmail.findMany({
      where: {
        campaignId: campaign.id,
        status: { in: ['SENT', 'DELIVERED', 'OPENED'] },
        sentAt: { not: null },
      },
      include: { contact: true },
    });

    for (const sentEmail of sentEmails) {
      results.emailsChecked++;

      for (const step of campaign.followUpSteps) {
        // Check condition
        if (step.condition === 'NO_REPLY') {
          // Skip if this email has already been replied to
          const hasReply = await prisma.lead.findFirst({
            where: { campaignEmailId: sentEmail.id },
          });
          if (hasReply) continue;
        } else if (step.condition === 'NO_OPEN') {
          // Skip if email was opened
          if (sentEmail.openedAt) continue;
        }

        // Check if follow-up already scheduled/sent for this step + email combo
        const existing = await prisma.followUpEmail.findFirst({
          where: { stepId: step.id, originalEmailId: sentEmail.id },
        });
        if (existing) continue;

        // Check if the delay has passed
        const sentAt = sentEmail.sentAt!;
        const dueAt = new Date(sentAt);
        dueAt.setDate(dueAt.getDate() + step.delayDays);
        dueAt.setHours(dueAt.getHours() + step.delayHours);

        if (new Date() < dueAt) continue; // Not due yet

        // Skip unsubscribed / bounced contacts
        const contact = sentEmail.contact;
        if (contact.isUnsubscribed || contact.bounceCount >= 3) continue;

        // Create follow-up email record
        const followUpRecord = await prisma.followUpEmail.create({
          data: {
            stepId: step.id,
            originalEmailId: sentEmail.id,
            contactId: contact.id,
            smtpAccountId: campaign.smtpAccountId,
            status: 'QUEUED',
          },
        });

        // Send the follow-up email
        try {
          const subject = applyMergeFields(step.subject, contact);
          const bodyHtml = step.bodyHtml
            ? applyMergeFields(step.bodyHtml, contact)
            : `<p>${applyMergeFields(step.bodyText || '', contact).replace(/\n/g, '<br>')}</p>`;

          const unsubToken = generateUnsubscribeToken(contact.id);
          const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubToken}`;

          const html = buildFollowUpHtml(bodyHtml, followUpRecord.id, unsubscribeUrl, baseUrl, canSpamAddress);
          const text = `${applyMergeFields(step.bodyText || '', contact)}\n\n${canSpamAddress}\n\nUnsubscribe: ${unsubscribeUrl}`;

          const transporter = createTransporter(campaign.smtpAccount);

          const info = await transporter.sendMail({
            from: campaign.fromName
              ? `"${campaign.fromName}" <${campaign.smtpAccount.email}>`
              : campaign.smtpAccount.email,
            to: contact.email,
            subject: `Re: ${campaign.subject}`,
            html,
            text,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              // Thread it to the original email
              'In-Reply-To': sentEmail.messageId || '',
              References: sentEmail.messageId || '',
            },
          });

          await prisma.followUpEmail.update({
            where: { id: followUpRecord.id },
            data: { status: 'SENT', sentAt: new Date(), messageId: info.messageId, scheduledFor: dueAt },
          });

          await prisma.smtpAccount.update({
            where: { id: campaign.smtpAccountId },
            data: { sentToday: { increment: 1 } },
          });

          results.followUpsSent++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await prisma.followUpEmail.update({
            where: { id: followUpRecord.id },
            data: { status: 'FAILED' },
          });
          results.followUpsFailed++;
          results.errors.push(`Follow-up to ${contact.email}: ${errorMsg}`);
          console.error(`Follow-up send error for ${contact.email}:`, err);
        }
      }
    }
  }

  const message = `Checked ${results.emailsChecked} emails. Sent ${results.followUpsSent} follow-up(s), ${results.followUpsFailed} failed.`;
  return NextResponse.json({ success: true, message, ...results });
}
