import { afterEach, describe, expect, it, vi } from 'vitest';
import '../helpers/route';
import * as webhookRoute from '@/app/api/webhooks/stripe/route';
import * as checkoutRoute from '@/app/api/v1/orgs/[orgSlug]/billing/checkout/route';
import { getBillingGateway, mockGateway, setBillingGateway } from '@/server/lib/billing-gateway';
import {
  mockCheckoutCompleted,
  mockEvent,
  mockPaymentFailed,
  mockSubscription,
} from '@/server/lib/mock-stripe';
import { signWebhookPayload, type Stripe } from '@/server/lib/stripe';
import * as billing from '@/server/services/billing.service';
import * as projects from '@/server/services/projects.service';
import { handleStripeEvent } from '@/server/services/stripe-webhooks.service';
import { testDb } from '../helpers/db';
import { createOrgWithRoles } from '../helpers/factories';
import { call } from '../helpers/route';

const PRICE = 'price_pro_test';
const t0 = Math.floor(Date.now() / 1000);

function sub(orgId: string, overrides: Partial<Parameters<typeof mockSubscription>[0]> = {}) {
  return mockSubscription({
    id: `sub_${orgId}`,
    orgId,
    customerId: `cus_${orgId}`,
    status: 'active',
    priceId: PRICE,
    ...overrides,
  });
}

const planOf = async (orgId: string) =>
  (await testDb.organization.findUniqueOrThrow({ where: { id: orgId } })).plan;
const subOf = (orgId: string) =>
  testDb.subscription.findUnique({ where: { organizationId: orgId } });
const auditCount = (orgId: string, action: string) =>
  testDb.auditLog.count({ where: { organizationId: orgId, action } });

afterEach(() => setBillingGateway(mockGateway));

describe('stripe webhook handling', () => {
  it('checkout.session.completed upgrades the org to PRO and links the customer', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    expect(await handleStripeEvent(mockCheckoutCompleted(sub(org.id), org.id))).toBe('processed');
    expect(await planOf(org.id)).toBe('PRO');
    expect(await subOf(org.id)).toMatchObject({
      status: 'active',
      priceId: PRICE,
      stripeSubscriptionId: `sub_${org.id}`,
    });
    expect(
      (await testDb.organization.findUniqueOrThrow({ where: { id: org.id } })).stripeCustomerId,
    ).toBe(`cus_${org.id}`);
  });

  it('the same event replayed twice changes state once', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    const event = mockCheckoutCompleted(sub(org.id), org.id, { id: 'evt_replay_1' });
    expect(await handleStripeEvent(event)).toBe('processed');
    expect(await handleStripeEvent(event)).toBe('duplicate');
    // Concurrent deliveries of the same event are also deduped by the primary key.
    const again = await Promise.all([handleStripeEvent(event), handleStripeEvent(event)]);
    expect(again).toEqual(['duplicate', 'duplicate']);
    expect(await auditCount(org.id, 'billing.subscription_updated')).toBe(1);
    expect(await testDb.webhookEvent.count({ where: { stripeEventId: 'evt_replay_1' } })).toBe(1);
  });

  it('ignores out-of-order (older) events for the same subscription', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    const newer = mockEvent(
      'customer.subscription.updated',
      sub(org.id, { status: 'active', cancelAtPeriodEnd: true }),
      { created: t0 + 10 },
    );
    const older = mockEvent(
      'customer.subscription.updated',
      sub(org.id, { status: 'active', cancelAtPeriodEnd: false }),
      { created: t0 },
    );
    expect(await handleStripeEvent(newer)).toBe('processed');
    expect(await handleStripeEvent(older)).toBe('stale');
    expect(await subOf(org.id)).toMatchObject({ cancelAtPeriodEnd: true });
  });

  it('a late "active" event never revives a deleted subscription', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    await handleStripeEvent(
      mockEvent('customer.subscription.created', sub(org.id), { created: t0 }),
    );
    await handleStripeEvent(
      mockEvent('customer.subscription.deleted', sub(org.id, { status: 'canceled' }), {
        created: t0 + 5,
      }),
    );
    expect(await planOf(org.id)).toBe('FREE');
    // Same-second delivery of an earlier "updated" event, arriving last.
    const late = mockEvent('customer.subscription.updated', sub(org.id, { status: 'active' }), {
      created: t0 + 5,
    });
    expect(await handleStripeEvent(late)).toBe('stale');
    expect(await planOf(org.id)).toBe('FREE');
    expect(await subOf(org.id)).toMatchObject({ status: 'canceled' });
  });

  it('a resubscribe replaces a canceled subscription; a late cancel of the old one is ignored', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    await handleStripeEvent(
      mockEvent('customer.subscription.deleted', sub(org.id, { status: 'canceled' }), {
        created: t0,
      }),
    );
    const fresh = sub(org.id, { id: 'sub_new', status: 'active' });
    expect(
      await handleStripeEvent(mockCheckoutCompleted(fresh, org.id, { created: t0 + 60 })),
    ).toBe('processed');
    expect(await planOf(org.id)).toBe('PRO');
    const lateOldCancel = mockEvent(
      'customer.subscription.deleted',
      sub(org.id, { status: 'canceled' }),
      { created: t0 + 120 },
    );
    expect(await handleStripeEvent(lateOldCancel)).toBe('stale');
    expect(await subOf(org.id)).toMatchObject({
      stripeSubscriptionId: 'sub_new',
      status: 'active',
    });
  });

  it('invoice.payment_failed marks past_due, keeps PRO during the grace period and is audited', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    const s = sub(org.id);
    await handleStripeEvent(mockCheckoutCompleted(s, org.id, { created: t0 }));
    expect(await handleStripeEvent(mockPaymentFailed(s, { created: t0 + 1 }))).toBe('processed');
    expect(await subOf(org.id)).toMatchObject({ status: 'past_due' });
    expect(await planOf(org.id)).toBe('PRO');
    expect(await auditCount(org.id, 'billing.payment_failed')).toBe(1);
    // Stripe gives up → unpaid → FREE.
    await handleStripeEvent(
      mockEvent('customer.subscription.updated', sub(org.id, { status: 'unpaid' }), {
        created: t0 + 2,
      }),
    );
    expect(await planOf(org.id)).toBe('FREE');
  });

  it('retrieves the subscription when checkout carries only its id', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    const s = sub(org.id);
    const retrieveSubscription = vi.fn((_id: string) => Promise.resolve(s));
    setBillingGateway({ ...getBillingGateway(), retrieveSubscription });
    await handleStripeEvent(mockCheckoutCompleted(s, org.id, { expand: false }));
    expect(retrieveSubscription).toHaveBeenCalledWith(s.id);
    expect(await planOf(org.id)).toBe('PRO');
  });

  it('routes by customer id when metadata is missing, and ignores unknown customers and event types', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    await testDb.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: 'cus_known' },
    });
    const noMeta = {
      ...sub(org.id, { customerId: 'cus_known' }),
      metadata: {},
    } as Stripe.Subscription;
    expect(await handleStripeEvent(mockEvent('customer.subscription.updated', noMeta))).toBe(
      'processed',
    );
    expect(await planOf(org.id)).toBe('PRO');
    const stranger = {
      ...sub('nobody', { customerId: 'cus_unknown' }),
      metadata: {},
    } as Stripe.Subscription;
    expect(await handleStripeEvent(mockEvent('customer.subscription.updated', stranger))).toBe(
      'ignored',
    );
    expect(await handleStripeEvent(mockEvent('customer.created', { id: 'cus_x' }))).toBe('ignored');
  });

  it('rolls back the dedupe record when processing fails, so Stripe can retry', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    setBillingGateway({
      ...getBillingGateway(),
      retrieveSubscription: () => Promise.reject(new Error('stripe down')),
    });
    const event = mockCheckoutCompleted(sub(org.id), org.id, { id: 'evt_retry', expand: false });
    await expect(handleStripeEvent(event)).rejects.toThrow('stripe down');
    expect(await testDb.webhookEvent.count({ where: { stripeEventId: 'evt_retry' } })).toBe(0);
    setBillingGateway({
      ...getBillingGateway(),
      retrieveSubscription: () => Promise.resolve(sub(org.id)),
    });
    expect(await handleStripeEvent(event)).toBe('processed');
  });

  it('plan changes immediately change server-side limits', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    for (let i = 0; i < 3; i++) await projects.createProject(ctx.OWNER, { name: `P${i}` });
    await expect(projects.createProject(ctx.OWNER, { name: 'P4' })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
    await handleStripeEvent(mockCheckoutCompleted(sub(org.id), org.id));
    const pro = { ...ctx.OWNER, org: { ...ctx.OWNER.org, plan: 'PRO' as const } };
    await expect(projects.createProject(pro, { name: 'P4' })).resolves.toBeDefined();
  });
});

describe('POST /api/webhooks/stripe', () => {
  const post = (body: string, signature?: string) =>
    call(webhookRoute.POST, {
      method: 'POST',
      rawBody: body,
      headers: signature ? { 'stripe-signature': signature } : {},
    });

  it('verifies the signature against the raw body', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    const payload = JSON.stringify(mockCheckoutCompleted(sub(org.id), org.id));
    expect((await post(payload)).status).toBe(400);
    expect((await post(payload, 't=1,v1=deadbeef')).status).toBe(400);
    expect((await post(payload, signWebhookPayload(payload, 'whsec_wrong'))).status).toBe(400);
    // Re-serialising the body breaks the signature: proves we verify raw bytes.
    const tampered = JSON.stringify(JSON.parse(payload), null, 2);
    expect((await post(tampered, signWebhookPayload(payload))).status).toBe(400);

    const ok = await post(payload, signWebhookPayload(payload));
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ received: true, outcome: 'processed' });
    expect((await post(payload, signWebhookPayload(payload))).json).toMatchObject({
      outcome: 'duplicate',
    });
  });

  it('returns 500 (so Stripe retries) when processing throws', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    setBillingGateway({
      ...getBillingGateway(),
      retrieveSubscription: () => Promise.reject(new Error('boom')),
    });
    const payload = JSON.stringify(mockCheckoutCompleted(sub(org.id), org.id, { expand: false }));
    expect((await post(payload, signWebhookPayload(payload))).status).toBe(500);
  });
});

describe('billing service', () => {
  it('only OWNERs start checkout; ADMINs can view', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER', 'ADMIN']);
    await expect(billing.startCheckout(ctx.ADMIN)).rejects.toMatchObject({ status: 403 });
    await expect(billing.getBillingOverview(ctx.ADMIN)).resolves.toMatchObject({
      plan: 'FREE',
      usage: { projects: { used: 0, limit: 3 }, members: { used: 2, limit: 5 } },
    });
    const res = await call(checkoutRoute.POST, {
      as: ctx.OWNER.user,
      method: 'POST',
      params: { orgSlug: org.slug },
    });
    expect(res.status).toBe(200);
    expect((res.json.data as { url: string }).url).toContain(`/${org.slug}/billing/mock`);
    expect(await auditCount(org.id, 'billing.checkout_started')).toBe(1);
  });

  it('409 for checkout when already PRO and for the portal without a customer', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    await expect(billing.openBillingPortal(ctx.OWNER)).rejects.toMatchObject({ status: 409 });
    await handleStripeEvent(mockCheckoutCompleted(sub(org.id), org.id));
    const pro = { ...ctx.OWNER, org: { ...ctx.OWNER.org, plan: 'PRO' as const } };
    await expect(billing.startCheckout(pro)).rejects.toMatchObject({ status: 409 });
    await expect(billing.openBillingPortal(pro)).resolves.toMatchObject({
      url: expect.stringContaining('flow=portal') as unknown,
    });
  });

  it('passes org, customer and price to the gateway', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const createCheckoutSession = vi.fn(() =>
      Promise.resolve({ url: 'https://checkout.stripe.test/x' }),
    );
    setBillingGateway({ ...getBillingGateway(), createCheckoutSession });
    await billing.startCheckout(ctx.OWNER);
    expect(createCheckoutSession).toHaveBeenCalledWith({
      orgId: org.id,
      orgSlug: org.slug,
      customerId: null,
      email: ctx.OWNER.user.email,
      priceId: PRICE,
    });
  });
});

describe('mock billing (BILLING_MODE=mock)', () => {
  it('signs, verifies and processes events through the webhook handler', async () => {
    const { simulateStripe } = await import('@/server/services/mock-billing.service');
    {
      const { org, ctx } = await createOrgWithRoles(['OWNER', 'ADMIN']);
      await expect(simulateStripe(ctx.ADMIN, { action: 'checkout' })).rejects.toMatchObject({
        status: 403,
      });
      await expect(simulateStripe(ctx.OWNER, { action: 'cancel' })).rejects.toMatchObject({
        status: 404,
      });
      expect(await simulateStripe(ctx.OWNER, { action: 'checkout' })).toMatchObject({
        outcome: 'processed',
      });
      expect(await planOf(org.id)).toBe('PRO');
      await simulateStripe(ctx.OWNER, { action: 'payment_failed' });
      expect(await subOf(org.id)).toMatchObject({ status: 'past_due' });
      await simulateStripe(ctx.OWNER, { action: 'cancel' });
      expect(await planOf(org.id)).toBe('FREE');
      expect(await testDb.webhookEvent.count()).toBe(3);
    }
  });
});
