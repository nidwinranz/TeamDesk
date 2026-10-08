import 'server-only';
import { getBillingGateway } from '@/server/lib/billing-gateway';
import { logger } from '@/server/lib/logger';
import type { Stripe } from '@/server/lib/stripe';
import { appendAuditLog } from '@/server/repos/audit.repo';
import {
  findOrgByStripeCustomerId,
  setOrganizationPlan,
  setStripeCustomerId,
} from '@/server/repos/organizations.repo';
import {
  findSubscriptionByOrg,
  updateSubscriptionStatus,
  upsertSubscription,
} from '@/server/repos/subscriptions.repo';
import { transaction, type Tx } from '@/server/repos/transaction';
import { recordWebhookEventOnce } from '@/server/repos/webhook-events.repo';
import { ENTITLED_STATUSES } from './billing.service';

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored' | 'stale';

const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === 'string' ? v : (v?.id ?? null);

/** Normalises a Stripe subscription (basil API: period end lives on items). */
export function normalizeSubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  return {
    id: sub.id,
    customerId: idOf(sub.customer),
    orgId: sub.metadata?.organizationId ?? null,
    status: sub.status,
    priceId: item?.price.id ?? 'unknown',
    currentPeriodEnd: new Date((item?.current_period_end ?? sub.created) * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

async function resolveOrgId(tx: Tx, orgId: string | null, customerId: string | null) {
  if (orgId) return orgId;
  if (!customerId) return null;
  return (await findOrgByStripeCustomerId(customerId, tx))?.id ?? null;
}

/**
 * Applies a subscription snapshot if it is not older than what we already have.
 * - Monotonic: events created before `lastEventAt` for the same subscription are stale.
 * - Terminal: a canceled subscription is never revived by a late event (Stripe cannot reactivate it).
 * - A different subscription only replaces the current one if the current one is no longer entitled
 *   or the incoming one is entitled (a resubscribe), never a late cancel of an old subscription.
 */
async function applySubscription(
  tx: Tx,
  raw: Stripe.Subscription,
  eventCreated: Date,
  orgHint: string | null,
): Promise<WebhookOutcome> {
  const sub = normalizeSubscription(raw);
  const orgId = await resolveOrgId(tx, orgHint ?? sub.orgId, sub.customerId);
  if (!orgId) {
    logger.warn({ subscriptionId: sub.id }, 'stripe subscription without a matching organization');
    return 'ignored';
  }
  const existing = await findSubscriptionByOrg(orgId, tx);
  if (existing) {
    if (existing.stripeSubscriptionId === sub.id) {
      if (eventCreated < existing.lastEventAt) return 'stale';
      if (existing.status === 'canceled' && sub.status !== 'canceled') return 'stale';
    } else if (ENTITLED_STATUSES.has(existing.status) && !ENTITLED_STATUSES.has(sub.status)) {
      return 'stale';
    }
  }

  await upsertSubscription(
    orgId,
    {
      stripeSubscriptionId: sub.id,
      status: sub.status,
      priceId: sub.priceId,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      lastEventAt: eventCreated,
    },
    tx,
  );
  if (sub.customerId) await setStripeCustomerId(orgId, sub.customerId, tx);
  const plan = ENTITLED_STATUSES.has(sub.status) ? 'PRO' : 'FREE';
  await setOrganizationPlan(orgId, plan, tx);
  await appendAuditLog(
    {
      orgId,
      actorId: null,
      action: 'billing.subscription_updated',
      targetType: 'subscription',
      targetId: sub.id,
      metadata: { status: sub.status, plan, cancelAtPeriodEnd: sub.cancelAtPeriodEnd },
    },
    tx,
  );
  return 'processed';
}

async function handlePaymentFailed(
  tx: Tx,
  invoice: Stripe.Invoice,
  eventCreated: Date,
): Promise<WebhookOutcome> {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  const orgId = await resolveOrgId(
    tx,
    invoice.parent?.subscription_details?.metadata?.organizationId ?? null,
    idOf(invoice.customer),
  );
  if (!orgId) return 'ignored';
  const existing = await findSubscriptionByOrg(orgId, tx);
  if (
    existing &&
    existing.stripeSubscriptionId === subscriptionId &&
    eventCreated >= existing.lastEventAt &&
    existing.status !== 'canceled'
  ) {
    // Plan stays PRO during Stripe's retry window; a later subscription.updated/deleted settles it.
    await updateSubscriptionStatus(orgId, 'past_due', eventCreated, tx);
  }
  await appendAuditLog(
    {
      orgId,
      actorId: null,
      action: 'billing.payment_failed',
      targetType: 'invoice',
      targetId: invoice.id ?? 'unknown',
      metadata: { amountDue: invoice.amount_due, attempt: invoice.attempt_count },
    },
    tx,
  );
  return 'processed';
}

/**
 * Idempotent webhook processing. The event id is recorded in the same
 * transaction as its effects, so a replay is a no-op and a failure is retried.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  const created = new Date(event.created * 1000);

  // Network calls happen before the transaction so it stays short.
  let checkoutSubscription: Stripe.Subscription | null = null;
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object.subscription;
    if (s)
      checkoutSubscription =
        typeof s === 'string' ? await getBillingGateway().retrieveSubscription(s) : s;
  }

  const outcome = await transaction(async (tx) => {
    if (!(await recordWebhookEventOnce(event.id, event.type, tx))) return 'duplicate' as const;
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.client_reference_id ?? session.metadata?.organizationId ?? null;
        const customerId = idOf(session.customer);
        if (orgId && customerId) await setStripeCustomerId(orgId, customerId, tx);
        if (!checkoutSubscription) return 'ignored' as const;
        return applySubscription(tx, checkoutSubscription, created, orgId);
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return applySubscription(tx, event.data.object, created, null);
      case 'invoice.payment_failed':
        return handlePaymentFailed(tx, event.data.object, created);
      default:
        return 'ignored' as const;
    }
  });
  logger.info({ eventId: event.id, type: event.type, outcome }, 'stripe webhook');
  return outcome;
}
