import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/server/lib/prisma';

export type { Tx };

const MAX_ATTEMPTS = 5;

const isSerializationFailure = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';

/**
 * Runs `fn` in an interactive transaction; services use this instead of touching Prisma directly.
 * Pass `isolationLevel: 'Serializable'` for invariants that span rows (e.g. plan limits, "keep one
 * OWNER"). Serialization failures are retried with jitter, then surface as a 409.
 */
export async function transaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => fn(tx), options);
    } catch (err) {
      if (!isSerializationFailure(err) || attempt >= MAX_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, 10 * attempt + Math.random() * 20));
    }
  }
}
