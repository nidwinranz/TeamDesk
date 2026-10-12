import 'server-only';
import { limitFor, PLANS } from '@/server/config/plans';
import { getBillingGateway } from '@/server/lib/billing-gateway';
import { env } from '@/server/lib/env';
import { conflict } from '@/server/lib/errors';
import { appendAuditLog } from '@/server/repos/audit.repo';
import { countPendingInvites } from '@/server/repos/invites.repo';
import { countMembers } from '@/server/repos/memberships.repo';
import { findOrgById } from '@/server/repos/organizations.repo';
import { countActiveProjects } from '@/server/repos/projects.repo';
import { findSubscriptionByOrg } from '@/server/repos/subscriptions.repo';
import { assertCan, type OrgContext } from './context';

/** Stripe statuses that keep PRO features. `past_due` is a grace period while Stripe retries payment. */
export const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function getBillingOverview(ctx: OrgContext) {
  assertCan(ctx, 'billing:view');
  const [subscription, projects, members, invites] = await Promise.all([
    findSubscriptionByOrg(ctx.org.id),
    countActiveProjects(ctx.org.id),
    countMembers(ctx.org.id),
    countPendingInvites(ctx.org.id),
  ]);
  return {
    plan: ctx.org.plan,
    planInfo: PLANS[ctx.org.plan],
    subscription: subscription && {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    usage: {
      projects: { used: projects, limit: limitFor(ctx.org.plan, 'projects') },
      members: { used: members + invites, limit: limitFor(ctx.org.plan, 'members') },
    },
    mock: env.BILLING_MODE === 'mock',
  };
}

export async function startCheckout(ctx: OrgContext) {
  assertCan(ctx, 'billing:manage');
  const subscription = await findSubscriptionByOrg(ctx.org.id);
  if (ctx.org.plan === 'PRO' && subscription && ENTITLED_STATUSES.has(subscription.status)) {
    throw conflict('This workspace is already on Pro. Use "Manage billing" to change it.');
  }
  const org = await findOrgById(ctx.org.id);
  const session = await getBillingGateway().createCheckoutSession({
    orgId: ctx.org.id,
    orgSlug: ctx.org.slug,
    customerId: org?.stripeCustomerId ?? null,
    email: ctx.user.email,
    priceId: env.STRIPE_PRO_PRICE_ID,
  });
  await appendAuditLog({
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    action: 'billing.checkout_started',
    targetType: 'organization',
    targetId: ctx.org.id,
  });
  return session;
}

export async function openBillingPortal(ctx: OrgContext) {
  assertCan(ctx, 'billing:manage');
  const org = await findOrgById(ctx.org.id);
  if (!org?.stripeCustomerId)
    throw conflict('This workspace has no billing account yet. Upgrade first.');
  return getBillingGateway().createPortalSession({
    customerId: org.stripeCustomerId,
    orgSlug: ctx.org.slug,
  });
}
