import 'server-only';
import Stripe from 'stripe';
import { env } from './env';

/**
 * Pinned Stripe API version. Note: since `2025-03-31.basil`, `current_period_end`
 * lives on subscription *items* and invoices reference their subscription via
 * `parent.subscription_details`. See docs/adr/0003-webhook-idempotency.md.
 */
export const STRIPE_API_VERSION = '2025-08-27.basil' as const;

let client: Stripe | undefined;

/** Lazily created so builds and mock mode never need a real key. */
export function stripe(): Stripe {
  client ??= new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder_for_signature_checks', {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: 'TeamDesk' },
    maxNetworkRetries: 2,
  });
  return client;
}

/** Verifies the `stripe-signature` header against the raw request body. Throws on mismatch. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

/** Signs a payload the way Stripe does; used by mock billing and tests. */
export function signWebhookPayload(payload: string, secret = env.STRIPE_WEBHOOK_SECRET): string {
  return stripe().webhooks.generateTestHeaderString({ payload, secret });
}

export type { Stripe };
