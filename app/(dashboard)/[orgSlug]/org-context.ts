import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { isAppError } from '@/server/lib/errors';
import type { OrgContext } from '@/server/services/context';
import { getOrgContext } from '@/server/services/session';

/** Resolves the org context for a page, mapping auth/tenancy errors to Next navigation. */
export async function requireOrgPage(slug: string): Promise<OrgContext> {
  try {
    return await getOrgContext(slug);
  } catch (err) {
    if (isAppError(err) && err.code === 'UNAUTHENTICATED') redirect(`/login?callbackUrl=/${slug}`);
    if (isAppError(err) && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}
