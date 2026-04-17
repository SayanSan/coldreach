import crypto from 'crypto';

/**
 * Generate a signed HMAC token for unsubscribe links.
 * Format: base64url( contactId + ':' + hmac_sha256(contactId)[0..31] )
 */
export function generateUnsubscribeToken(contactId: string): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const hmac = crypto.createHmac('sha256', secret).update(contactId).digest('hex');
  const payload = `${contactId}:${hmac.slice(0, 32)}`;
  return Buffer.from(payload).toString('base64url');
}

/**
 * Verify an unsubscribe token.
 * Returns the contactId if valid, null if tampered or malformed.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const payload = Buffer.from(token, 'base64url').toString('utf8');
    const colonIdx = payload.lastIndexOf(':');
    if (colonIdx === -1) return null;

    const contactId = payload.slice(0, colonIdx);
    const providedHmac = payload.slice(colonIdx + 1);

    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(contactId)
      .digest('hex')
      .slice(0, 32);

    // Constant-time comparison to prevent timing attacks
    if (providedHmac.length !== expectedHmac.length) return null;
    const valid = crypto.timingSafeEqual(
      Buffer.from(providedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );

    return valid ? contactId : null;
  } catch {
    return null;
  }
}
