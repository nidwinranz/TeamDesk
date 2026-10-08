'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api-client';

export interface InviteRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function PendingInvites({ orgSlug, invites }: { orgSlug: string; invites: InviteRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, kind: 'resend' | 'revoke', email: string) {
    setBusy(id);
    setStatus(null);
    try {
      if (kind === 'resend') await api(`/orgs/${orgSlug}/invites/${id}/resend`, { method: 'POST' });
      else await api(`/orgs/${orgSlug}/invites/${id}`, { method: 'DELETE' });
      setStatus(kind === 'resend' ? `Invite to ${email} resent.` : `Invite to ${email} revoked.`);
      router.refresh();
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (invites.length === 0)
    return <p className="text-muted-foreground text-sm">No pending invites.</p>;
  return (
    <div className="grid gap-2">
      <p role="status" className="text-muted-foreground min-h-5 text-sm">
        {status}
      </p>
      <ul className="divide-y rounded-lg border">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div>
              <span className="font-medium">{i.email}</span>{' '}
              <Badge variant="outline">{i.role.toLowerCase()}</Badge>
              <p className="text-muted-foreground text-xs">
                Expires {new Date(i.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy === i.id}
                onClick={() => act(i.id, 'resend', i.email)}
              >
                Resend
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === i.id}
                onClick={() => act(i.id, 'revoke', i.email)}
              >
                Revoke
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
