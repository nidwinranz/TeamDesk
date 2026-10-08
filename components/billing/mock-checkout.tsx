'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api-client';

type Action = 'checkout' | 'cancel' | 'payment_failed';

export function MockCheckout({ orgSlug, flow }: { orgSlug: string; flow: 'checkout' | 'portal' }) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setPending(action);
    setError(null);
    try {
      await api(`/orgs/${orgSlug}/billing/mock`, { method: 'POST', body: { action } });
      router.push(`/${orgSlug}/billing${action === 'checkout' ? '?checkout=success' : ''}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  }

  return (
    <div className="grid gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {flow === 'checkout' ? (
        <Button onClick={() => run('checkout')} disabled={pending !== null}>
          {pending ? 'Processing…' : 'Pay $29 and subscribe'}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => run('cancel')} disabled={pending !== null}>
            Cancel subscription
          </Button>
          <Button
            variant="outline"
            onClick={() => run('payment_failed')}
            disabled={pending !== null}
          >
            Simulate failed payment
          </Button>
        </div>
      )}
      <Button variant="ghost" onClick={() => router.push(`/${orgSlug}/billing`)}>
        Back to TeamDesk
      </Button>
    </div>
  );
}
