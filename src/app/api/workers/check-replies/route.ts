import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getSetting } from '@/app/api/settings/route';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ── AI classification ─────────────────────────────────────────────────────────

async function classifyReply(
  replyBody: string,
  subject: string
): Promise<{
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'OUT_OF_OFFICE' | 'UNSUBSCRIBE';
  leadScore: 'HOT' | 'WARM' | 'COLD';
  aiSummary: string;
}> {
  const openaiKey = await getSetting('openai_api_key');
  const model = (await getSetting('ai_model')) || 'gpt-4o-mini';

  if (!openaiKey) {
    return { sentiment: 'NEUTRAL', leadScore: 'WARM', aiSummary: '' };
  }

  try {
    const client = new OpenAI({ apiKey: openaiKey });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a sales assistant classifying cold email replies.
Respond with JSON only (no markdown):
{
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "OUT_OF_OFFICE" | "UNSUBSCRIBE",
  "leadScore": "HOT" | "WARM" | "COLD",
  "summary": "1-2 sentence summary of the reply and its intent"
}

Scoring guide:
- POSITIVE + HOT: expresses interest, asks for a call/demo, wants more info
- POSITIVE + WARM: friendly but not immediately actionable
- NEUTRAL + WARM: non-committal, asks a question
- NEGATIVE + COLD: not interested, bad timing
- OUT_OF_OFFICE: auto-reply or vacation message
- UNSUBSCRIBE: explicitly asks to be removed`,
        },
        {
          role: 'user',
          content: `Subject: ${subject}\n\nReply:\n${replyBody.slice(0, 2000)}`,
        },
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return {
      sentiment: parsed.sentiment || 'NEUTRAL',
      leadScore: parsed.leadScore || 'WARM',
      aiSummary: parsed.summary || '',
    };
  } catch (err) {
    console.error('AI classification error:', err);
    return { sentiment: 'NEUTRAL', leadScore: 'WARM', aiSummary: '' };
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

export async function POST() {
  const results = {
    accountsChecked: 0,
    repliesFound: 0,
    leadsCreated: 0,
    errors: [] as string[],
  };

  // Get all active SMTP accounts that have IMAP configured
  const accounts = await prisma.smtpAccount.findMany({
    where: { isActive: true, imapHost: { not: null } },
  });

  for (const account of accounts) {
    results.accountsChecked++;

    let connection: imapSimple.ImapSimple | null = null;
    try {
      const password = decrypt(account.passwordEncrypted);

      connection = await imapSimple.connect({
        imap: {
          user: account.username,
          password,
          host: account.imapHost!,
          port: account.imapPort || 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 10000,
        },
      });

      await connection.openBox('INBOX');

      // Search for emails in the past 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const messages = await connection.search(['SINCE', since], {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false,
      });

      // Get all message IDs we've sent so we can match In-Reply-To
      const sentMessageIds = await prisma.campaignEmail.findMany({
        where: {
          smtpAccountId: account.id,
          messageId: { not: null },
          status: { in: ['SENT', 'DELIVERED', 'OPENED'] },
        },
        select: { id: true, contactId: true, campaignId: true, messageId: true },
      });

      const messageIdMap = new Map(sentMessageIds.map((e) => [e.messageId!, e]));

      for (const msg of messages) {
        try {
          const fullPart = msg.parts.find((p) => p.which === '');
          if (!fullPart) continue;

          // Parse the full email
          const parsed = await simpleParser(fullPart.body as string);

          const inReplyTo = parsed.inReplyTo || '';
          const references = (parsed.references as string[] | string) || [];
          const refList = Array.isArray(references) ? references : [references];
          const allIds = [inReplyTo, ...refList].map((id) => id.trim()).filter(Boolean);

          // Find matching sent email
          let matchedEmail: (typeof sentMessageIds)[number] | undefined;
          for (const msgId of allIds) {
            if (messageIdMap.has(msgId)) {
              matchedEmail = messageIdMap.get(msgId);
              break;
            }
          }

          if (!matchedEmail) continue;
          results.repliesFound++;

          // Check if lead already exists for this email
          const existingLead = await prisma.lead.findFirst({
            where: { campaignEmailId: matchedEmail.id },
          });
          if (existingLead) continue;

          // Extract reply body
          const htmlContent = typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]+>/g, '') : '';
          const replyBody = parsed.text || htmlContent || '';
          const replySubject = typeof parsed.subject === 'string' ? parsed.subject : '';
          const replyMessageId = typeof parsed.messageId === 'string' ? parsed.messageId : undefined;

          // AI classification
          const classification = await classifyReply(replyBody, replySubject);

          // Create lead
          await prisma.lead.create({
            data: {
              contactId: matchedEmail.contactId,
              campaignEmailId: matchedEmail.id,
              replyBody: replyBody.slice(0, 5000),
              replyMessageId,
              sentiment: classification.sentiment,
              leadScore: classification.leadScore,
              aiSummary: classification.aiSummary,
              stage: classification.sentiment === 'UNSUBSCRIBE' ? 'LOST' : 'REPLIED',
            },
          });

          // Update campaign email status
          await prisma.campaignEmail.update({
            where: { id: matchedEmail.id },
            data: { status: 'REPLIED', repliedAt: new Date() },
          });

          // If unsubscribe request, mark contact as unsubscribed
          if (classification.sentiment === 'UNSUBSCRIBE') {
            await prisma.contact.update({
              where: { id: matchedEmail.contactId },
              data: { isUnsubscribed: true },
            });
            await prisma.unsubscribeLog.create({
              data: {
                contactId: matchedEmail.contactId,
                campaignEmailId: matchedEmail.id,
                reason: 'Unsubscribe request detected via AI in reply',
              },
            });
          }

          results.leadsCreated++;
        } catch (msgErr) {
          console.error('Error processing message:', msgErr);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Account ${account.email}: ${msg}`);
      console.error(`IMAP error for ${account.email}:`, err);
    } finally {
      try {
        connection?.end();
      } catch {
        // ignore cleanup errors
      }
    }
  }

  const message = `Checked ${results.accountsChecked} account(s). Found ${results.repliesFound} replies, created ${results.leadsCreated} lead(s).`;
  return NextResponse.json({ success: true, message, ...results });
}
