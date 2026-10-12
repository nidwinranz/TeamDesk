/**
 * Security headers. The CSP is nonce-based ('strict-dynamic'), generated per
 * request in middleware; the static headers are applied in next.config.ts.
 */
export function buildCsp(nonce: string, opts: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(opts.dev ? ["'unsafe-eval'"] : []),
    ],
    // React style attributes (e.g. progress widths) need inline styles.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
    'font-src': ["'self'", 'data:'],
    // Sentry is tunnelled through /monitoring, so no third-party connect targets are needed.
    'connect-src': ["'self'", ...(opts.dev ? ['ws:'] : [])],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    // OAuth sign-in submits a form that redirects to Google; Chrome checks form-action on redirects.
    'form-action': ["'self'", 'https://accounts.google.com'],
  };
  const csp = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!opts.dev) csp.push('upgrade-insecure-requests');
  return csp.join('; ');
}

export const STATIC_SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
] as const;

export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}
