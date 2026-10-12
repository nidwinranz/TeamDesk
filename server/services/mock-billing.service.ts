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
import { constructWebhookEvent, signWebhookPayload } from '@/server/lib/stripe';
import { parse } from '@/server/lib/validation';
import { findSubscriptionByOrg } from '@/server/repos/subscriptions.repo';
import { assertCan, type OrgContext } from './context';
import { handleStripeEvent } from './stripe-webhooks.service';

const schema = z.object({ action: z.enum(['checkout', 'cancel', 'payment_failed']) });

/**
 * Mock billing (BILLING_MODE=mock only): builds a Stripe-shaped event, signs it
 * with the webhook secret, then verifies and processes it with the same code the
 * webhook route uses (signature check, dedupe, state machine). It runs in-process:
 * a server calling its own URL is fragile behind proxies and CI networking.
 */
export async function simulateStripe(ctx: OrgContext, input: unknown) {
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
  const verified = constructWebhookEvent(payload, signWebhookPayload(payload));
  return { outcome: await handleStripeEvent(verified) };
}
