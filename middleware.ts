import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/server/auth.config';
import { isMemberOfOrgSlug } from '@/server/services/org-access';

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ['/login', '/signup', '/verify', '/reset', '/invite'];
const APP_ROUTES = ['/dashboard', '/onboarding'];

function isPublic(pathname: string) {
  return (
    pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

/**
 * 1. Unauthenticated users are sent to /login (with a callbackUrl).
 * 2. For /[orgSlug]/... the org is resolved and membership checked; non-members
 *    get a 404 so other tenants' workspaces are indistinguishable from typos.
 * Pages and services re-check membership: this is a fast gate, not the only one.
 */
export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const userId = req.auth?.user?.id;
  if (!userId) {
    const url = new URL('/login', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (APP_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return NextResponse.next();

  const slug = pathname.split('/')[1];
  if (slug && !(await isMemberOfOrgSlug(userId, slug))) {
    return NextResponse.rewrite(new URL('/_not-found', req.nextUrl.origin), { status: 404 });
  }
  return NextResponse.next();
});

export const config = {
  runtime: 'nodejs',
  // Skip API routes (they authenticate themselves), Next internals and static files.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
