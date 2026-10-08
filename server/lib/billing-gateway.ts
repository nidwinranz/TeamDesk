import 'server-only';
import { env } from './env';
import { stripe, type Stripe } from './stripe';

export interface CheckoutInput {
  orgId: string;
  orgSlug: string;
  customerId: string | null;
  email: string;
  priceId: string;
}

/** The slice of Stripe the app depends on; swapped for a fake in mock mode and tests. */
export interface BillingGateway {
  createCheckoutSession(input: CheckoutInput): Promise<{ url: string }>;
  createPortalSession(input: { customerId: string; orgSlug: string }): Promise<{ url: string }>;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
}

const billingUrl = (slug: string) => `${env.APP_URL}/${slug}/billing`;

export const liveGateway: BillingGateway = {
  async createCheckoutSession(input) {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      client_reference_id: input.orgId,
      ...(input.customerId ? { customer: input.customerId } : { customer_email: input.email }),
      metadata: { organizationId: input.orgId },
      subscription_data: { metadata: { organizationId: input.orgId } },
      allow_promotion_codes: true,
      success_url: `${billingUrl(input.orgSlug)}?checkout=success`,
      cancel_url: `${billingUrl(input.orgSlug)}?checkout=cancelled`,
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { url: session.url };
  },
  async createPortalSession({ customerId, orgSlug }) {
    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: billingUrl(orgSlug),
    });
    return { url: session.url };
  },
  retrieveSubscription(id) {
    return stripe().subscriptions.retrieve(id);
  },
};

/**
 * Mock mode (local dev / E2E without Stripe keys): "checkout" and "portal" are
 * local pages that post signed fake events to our real webhook endpoint.
 */
export const mockGateway: BillingGateway = {
  createCheckoutSession: (input) =>
    Promise.resolve({ url: `${billingUrl(input.orgSlug)}/mock?flow=checkout` }),
  createPortalSession: ({ orgSlug }) =>
    Promise.resolve({ url: `${billingUrl(orgSlug)}/mock?flow=portal` }),
  retrieveSubscription: (id) =>
    Promise.reject(new Error(`mock gateway cannot retrieve ${id}; events carry expanded objects`)),
};

let current: BillingGateway = env.BILLING_MODE === 'live' ? liveGateway : mockGateway;

export const getBillingGateway = () => current;
/** Test seam. */
export const setBillingGateway = (g: BillingGateway) => {
  current = g;
};
