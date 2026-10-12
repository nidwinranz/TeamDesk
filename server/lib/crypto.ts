import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, base64url-encoded: the raw token sent to the user. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Only this hash is persisted; a DB leak does not expose usable tokens. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
