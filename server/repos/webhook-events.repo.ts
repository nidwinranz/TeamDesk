import { prisma, type Tx } from '@/server/lib/prisma';

/**
 * Records a Stripe event id with `INSERT ... ON CONFLICT DO NOTHING`. Returns
 * false if it was already recorded. Run inside the same transaction as the
 * state change: a crash rolls both back, so Stripe's retry is processed again.
 */
export async function recordWebhookEventOnce(
  stripeEventId: string,
  type: string,
  db: Tx = prisma,
): Promise<boolean> {
  const { count } = await db.webhookEvent.createMany({
    data: [{ stripeEventId, type }],
    skipDuplicates: true,
  });
  return count === 1;
}
