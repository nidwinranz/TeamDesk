import * as Sentry from '@sentry/nextjs';

/** Browser-side Sentry. A no-op unless NEXT_PUBLIC_SENTRY_DSN is set at build time. */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
