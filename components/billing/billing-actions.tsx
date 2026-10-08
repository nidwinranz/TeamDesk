'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api-client';

/** Redirects to Stripe Checkout / Customer Portal (or their mock pages). */
export function BillingActions({
  orgSlug,
  isPro,
  hasCustomer,
}: {
  orgSlug: string;
  isPro: boolean;
  hasCustomer: boolean;
}) {
  const [pending, setPending] = useState<'checkout' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: 'checkout' | 'portal') {
    setPending(kind);
    setError(null);
    try {
      const { data } = await api<{ data: { url: string } }>(`/orgs/${orgSlug}/billing/${kind}`, {
        method: 'POST',
      });
      window.location.assign(data.url);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {!isPro && (
          <Button onClick={() => go('checkout')} disabled={pending !== null}>
            {pending === 'checkout' ? 'Redirecting…' : 'Upgrade to Pro'}
          </Button>
        )}
        {hasCustomer && (
          <Button variant="outline" onClick={() => go('portal')} disabled={pending !== null}>
            {pending === 'portal' ? 'Redirecting…' : 'Manage billing'}
          </Button>
        )}
      </div>
    </div>
  );
}
