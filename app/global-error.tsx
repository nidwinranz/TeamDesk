'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/** Last-resort boundary for errors in the root layout; reports to Sentry when configured. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <h1>Something went wrong</h1>
        <p>The error has been reported{error.digest ? ` (ref ${error.digest})` : ''}.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
