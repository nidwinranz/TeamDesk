import NextAuth from 'next-auth';
import { type NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/server/auth.config';
import { buildCsp, generateNonce } from '@/server/lib/security-headers';
import { isMemberOfOrgSlug } from '@/server/services/org-access';

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ['/login', '/signup', '/verify', '/reset', '/invite'];
const APP_ROUTES = ['/dashboard', '/onboarding'];
const isDev = process.env.NODE_ENV === 'development';

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Forwards a per-request CSP nonce to rendering (Next applies it to its scripts) and sets the header. */
function withCsp(req: NextRequest, build: (headers: Headers) => NextResponse) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce, { dev: isDev });
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = build(headers);
  res.headers.set('content-security-policy', csp);
  return res;
}

/**
 * 1. Every page gets a nonce-based CSP.
 * 2. Unauthenticated users are sent to /login (with a callbackUrl).
 * 3. For /[orgSlug]/... the org is resolved and membership checked; non-members
 *    get a 404 so other tenants' workspaces are indistinguishable from typos.
 * Pages and services re-check membership: this is a fast gate, not the only one.
 */
export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const next = () => withCsp(req, (headers) => NextResponse.next({ request: { headers } }));

  if (pathname === '/' || matches(pathname, PUBLIC_PREFIXES)) return next();

  const userId = req.auth?.user?.id;
  if (!userId) {
    const url = new URL('/login', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (matches(pathname, APP_ROUTES)) return next();

  const slug = pathname.split('/')[1];
  if (slug && !(await isMemberOfOrgSlug(userId, slug))) {
    return withCsp(req, (headers) =>
      NextResponse.rewrite(new URL('/_not-found', req.nextUrl.origin), {
        status: 404,
        request: { headers },
      }),
    );
  }
  return next();
});

export const config = {
  runtime: 'nodejs',
  // Skip API routes (they authenticate themselves), Next internals, the Sentry tunnel and static files.
  matcher: [
    '/((?!api|monitoring|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
