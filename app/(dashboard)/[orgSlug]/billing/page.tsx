import type { Metadata } from 'next';
import { BillingActions } from '@/components/billing/billing-actions';
import { UsageMeter } from '@/components/billing/usage-meter';
import { Forbidden } from '@/components/dashboard/forbidden';
import { PageHeader } from '@/components/dashboard/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS } from '@/server/config/plans';
import { can } from '@/server/policies/permissions';
import { getBillingOverview } from '@/server/services/billing.service';
import { requireOrgPage } from '../org-context';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [{ orgSlug }, { checkout }] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgPage(orgSlug);
  if (!can(ctx.membership, 'billing:view')) return <Forbidden what="billing" />;
  const billing = await getBillingOverview(ctx);
  const canManage = can(ctx.membership, 'billing:manage');
  const sub = billing.subscription;

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Billing" description="Plans are enforced per workspace." />
      {checkout === 'success' && (
        <Alert>
          <AlertDescription>
            {billing.plan === 'PRO'
              ? 'Thanks! Your workspace is now on Pro.'
              : 'Payment received. Your plan will update as soon as Stripe confirms it — refresh in a few seconds.'}
          </AlertDescription>
        </Alert>
      )}
      {sub?.status === 'past_due' && (
        <Alert variant="destructive">
          <AlertDescription>
            Your last payment failed. Update your payment method to keep Pro features.
          </AlertDescription>
        </Alert>
      )}
      {billing.mock && (
        <Alert>
          <AlertDescription>
            Test mode: billing uses a local mock of Stripe. No real payments are taken.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge data-testid="current-plan">{billing.planInfo.name}</Badge>
          </CardTitle>
          <CardDescription>
            {sub
              ? `Subscription ${sub.status.replace('_', ' ')}${sub.cancelAtPeriodEnd ? ', cancels' : ', renews'} on ${sub.currentPeriodEnd.toLocaleDateString('en', { dateStyle: 'medium' })}`
              : 'No active subscription.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <UsageMeter label="Active projects" {...billing.usage.projects} />
          <UsageMeter label="Members and pending invites" {...billing.usage.members} />
          {canManage ? (
            <BillingActions
              orgSlug={ctx.org.slug}
              isPro={billing.plan === 'PRO'}
              hasCustomer={sub !== null}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Only workspace owners can change the plan.
            </p>
          )}
        </CardContent>
      </Card>
      <section aria-labelledby="plans-heading" className="grid gap-3">
        <h2 id="plans-heading" className="font-medium">
          Plans
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {(['FREE', 'PRO'] as const).map((p) => (
            <li key={p} className="rounded-lg border p-4">
              <p className="font-medium">
                {PLANS[p].name}{' '}
                <span className="text-muted-foreground font-normal">· {PLANS[p].priceLabel}</span>
              </p>
              <p className="text-muted-foreground text-sm">
                {PLANS[p].limits.projects ?? 'Unlimited'} projects ·{' '}
                {PLANS[p].limits.members ?? 'Unlimited'} members
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
