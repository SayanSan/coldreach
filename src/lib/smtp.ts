import nodemailer from 'nodemailer';
import { SmtpAccount } from '@prisma/client';
import { decrypt } from './encryption';

export function createTransporter(account: SmtpAccount) {
  const password = decrypt(account.passwordEncrypted);

  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.port === 465,
    auth: {
      user: account.username,
      pass: password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function testSmtpConnection(account: {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
}): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: account.host,
      port: account.port,
      secure: account.port === 465,
      auth: {
        user: account.username,
        pass: account.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.verify();
    return { success: true, message: 'SMTP connection successful!' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return { success: false, message };
  }
}

export function getImapHostFromSmtp(smtpHost: string): string {
  // Common mappings
  const mappings: Record<string, string> = {
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp.office365.com': 'outlook.office365.com',
    'smtp.outlook.com': 'outlook.office365.com',
    'smtp.mail.yahoo.com': 'imap.mail.yahoo.com',
    'smtp.zoho.com': 'imap.zoho.com',
  };

  if (mappings[smtpHost]) {
    return mappings[smtpHost];
  }

  // Generic mapping: replace smtp with imap
  return smtpHost.replace(/^smtp\./, 'imap.');
}
