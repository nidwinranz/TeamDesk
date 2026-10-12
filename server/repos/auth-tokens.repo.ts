import type { AuthTokenType } from '@prisma/client';
import { prisma, type Tx } from '@/server/lib/prisma';

export function createAuthToken(
  data: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date },
  db: Tx = prisma,
) {
  return db.authToken.create({ data });
}

/** Invalidates outstanding tokens of a type (e.g. when a new reset link is issued). */
export function invalidateAuthTokens(userId: string, type: AuthTokenType, db: Tx = prisma) {
  return db.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/**
 * Atomically marks a token as used. Returns the owning userId, or null when the
 * token is unknown, expired or already used (single-use is enforced in SQL).
 */
export async function consumeAuthToken(tokenHash: string, type: AuthTokenType, db: Tx = prisma) {
  const token = await db.authToken.findUnique({ where: { tokenHash } });
  if (!token || token.type !== type) return null;
  const { count } = await db.authToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return count === 1 ? token.userId : null;
}
