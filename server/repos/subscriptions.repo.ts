import { prisma, type Tx } from '@/server/lib/prisma';

export interface SubscriptionData {
  stripeSubscriptionId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  lastEventAt: Date;
}

export function findSubscriptionByOrg(orgId: string, db: Tx = prisma) {
  return db.subscription.findUnique({ where: { organizationId: orgId } });
}

export function upsertSubscription(orgId: string, data: SubscriptionData, db: Tx = prisma) {
  return db.subscription.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, ...data },
    update: data,
  });
}

export function updateSubscriptionStatus(
  orgId: string,
  status: string,
  lastEventAt: Date,
  db: Tx = prisma,
) {
  return db.subscription.update({
    where: { organizationId: orgId },
    data: { status, lastEventAt },
  });
}
