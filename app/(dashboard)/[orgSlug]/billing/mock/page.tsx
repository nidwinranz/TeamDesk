import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MockCheckout } from '@/components/billing/mock-checkout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { env } from '@/server/lib/env';
import { can } from '@/server/policies/permissions';
import { requireOrgPage } from '../../org-context';

export const metadata: Metadata = { title: 'Test checkout' };

/** Stand-in for Stripe Checkout / Customer Portal when BILLING_MODE=mock. */
export default async function MockBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ flow?: string }>;
}) {
  if (env.BILLING_MODE !== 'mock') notFound();
  const [{ orgSlug }, { flow }] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgPage(orgSlug);
  if (!can(ctx.membership, 'billing:manage')) notFound();
  const mode = flow === 'portal' ? 'portal' : 'checkout';
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>
          <h1>{mode === 'checkout' ? 'Test checkout' : 'Test customer portal'}</h1>
        </CardTitle>
        <CardDescription>
          {mode === 'checkout'
            ? `TeamDesk Pro for ${ctx.org.name} — $29 / month. This simulates Stripe Checkout.`
            : 'This simulates the Stripe Customer Portal.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MockCheckout orgSlug={ctx.org.slug} flow={mode} />
      </CardContent>
    </Card>
  );
}
