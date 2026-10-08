'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <AlertTriangle className="text-destructive size-6" aria-hidden />
      <h1 className="text-lg font-medium">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        The error has been reported{error.digest ? ` (ref ${error.digest})` : ''}. You can try
        again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
