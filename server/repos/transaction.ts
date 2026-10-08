import { prisma, type Tx } from '@/server/lib/prisma';

export type { Tx };

/** Runs `fn` in an interactive transaction; services use this instead of touching Prisma directly. */
export function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => fn(tx));
}
