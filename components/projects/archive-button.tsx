'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api-client';

export function ArchiveButton({
  orgSlug,
  projectId,
  archived,
}: {
  orgSlug: string;
  projectId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await api(`/orgs/${orgSlug}/projects/${projectId}`, {
        method: 'PATCH',
        body: { archived: !archived },
      });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button variant="outline" onClick={toggle} disabled={pending}>
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? 'Unarchive' : 'Archive'}
      </Button>
    </div>
  );
}
