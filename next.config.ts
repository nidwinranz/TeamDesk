import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { STATIC_SECURITY_HEADERS } from './server/lib/security-headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2', 'pino'],
  headers() {
    // The nonce-based Content-Security-Policy is set per request in middleware.ts.
    return Promise.resolve([{ source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] }]);
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Proxy browser events through our origin: keeps CSP connect-src 'self' and avoids ad blockers.
  tunnelRoute: '/monitoring',
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
