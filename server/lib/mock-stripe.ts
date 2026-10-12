import 'server-only';
import type { Stripe } from './stripe';

/**
 * Builds minimal-but-typed Stripe event payloads for mock billing (dev/E2E) and tests.
 * Only the fields our webhook handler reads are populated.
 */
let seq = 0;
const now = () => Math.floor(Date.now() / 1000);

export function mockSubscription(opts: {
  id: string;
  orgId: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  priceId: string;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}): Stripe.Subscription {
  const periodEnd = opts.periodEnd ?? now() + 30 * 86_400;
  return {
    id: opts.id,
    object: 'subscription',
    customer: opts.customerId,
    status: opts.status,
    metadata: { organizationId: opts.orgId },
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    created: now(),
    items: {
      object: 'list',
      data: [{ id: `si_${opts.id}`, price: { id: opts.priceId }, current_period_end: periodEnd }],
      has_more: false,
      url: '',
    },
  } as unknown as Stripe.Subscription;
}

export function mockEvent<T extends Stripe.Event['type']>(
  type: T,
  object: unknown,
  opts: { id?: string; created?: number } = {},
): Stripe.Event {
  return {
    id: opts.id ?? `evt_mock_${Date.now()}_${seq++}`,
    object: 'event',
    type,
    created: opts.created ?? now(),
    api_version: '2025-08-27.basil',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object },
  } as unknown as Stripe.Event;
}

export function mockCheckoutCompleted(
  sub: Stripe.Subscription,
  orgId: string,
  opts?: { id?: string; created?: number; expand?: boolean },
) {
  return mockEvent(
    'checkout.session.completed',
    {
      id: `cs_mock_${sub.id}`,
      object: 'checkout.session',
      client_reference_id: orgId,
      customer: sub.customer,
      subscription: opts?.expand === false ? sub.id : sub,
      metadata: { organizationId: orgId },
    },
    opts,
  );
}

export function mockPaymentFailed(
  sub: Stripe.Subscription,
  opts?: { id?: string; created?: number },
) {
  return mockEvent(
    'invoice.payment_failed',
    {
      id: `in_mock_${Date.now()}`,
      object: 'invoice',
      customer: sub.customer,
      amount_due: 2900,
      attempt_count: 1,
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: sub.id, metadata: sub.metadata },
      },
    },
    opts,
  );
}
