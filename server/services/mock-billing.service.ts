import 'server-only';
import { z } from 'zod';
import { env } from '@/server/lib/env';
import { notFound } from '@/server/lib/errors';
import {
  mockCheckoutCompleted,
  mockEvent,
  mockPaymentFailed,
  mockSubscription,
} from '@/server/lib/mock-stripe';
import { signWebhookPayload } from '@/server/lib/stripe';
import { parse } from '@/server/lib/validation';
import { findSubscriptionByOrg } from '@/server/repos/subscriptions.repo';
import { assertCan, type OrgContext } from './context';

const schema = z.object({ action: z.enum(['checkout', 'cancel', 'payment_failed']) });

/**
 * Mock billing (BILLING_MODE=mock only): builds a Stripe-shaped event, signs it
 * with the webhook secret and POSTs it to our real webhook endpoint, so the
 * signature check, dedupe and state machine are exercised exactly as in prod.
 */
export async function simulateStripe(ctx: OrgContext, input: unknown, webhookUrl: string) {
  if (env.BILLING_MODE !== 'mock') throw notFound();
  assertCan(ctx, 'billing:manage');
  const { action } = parse(schema, input);
  const customerId = `cus_mock_${ctx.org.id}`;
  const existing = await findSubscriptionByOrg(ctx.org.id);

  const base = { orgId: ctx.org.id, customerId, priceId: env.STRIPE_PRO_PRICE_ID };
  let event;
  if (action === 'checkout') {
    const sub = mockSubscription({
      ...base,
      id: `sub_mock_${ctx.org.id}_${Date.now()}`,
      status: 'active',
    });
    event = mockCheckoutCompleted(sub, ctx.org.id);
  } else {
    if (!existing) throw notFound('Subscription');
    const sub = mockSubscription({
      ...base,
      id: existing.stripeSubscriptionId,
      status: action === 'cancel' ? 'canceled' : 'past_due',
    });
    event =
      action === 'cancel'
        ? mockEvent('customer.subscription.deleted', sub)
        : mockPaymentFailed(sub);
  }

  const payload = JSON.stringify(event);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signWebhookPayload(payload),
    },
    body: payload,
  });
  if (!res.ok) throw new Error(`mock webhook delivery failed: ${res.status}`);
  return (await res.json()) as { outcome: string };
}
