import 'server-only';
import { cache } from 'react';
import { auth } from '@/server/auth';
import { unauthenticated } from '@/server/lib/errors';
import { findUserById } from '@/server/repos/users.repo';
import { type OrgContext, resolveOrgContext, type SessionUser } from './context';

/**
 * The signed-in user, re-validated against the database on every request so
 * that deleted users and sessions issued before a password reset are rejected.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await findUserById(session.user.id);
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return { id: user.id, email: user.email, name: user.name };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

/** Per-request cached org context for RSC pages and route handlers. */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext> => {
  const user = await requireUser();
  return resolveOrgContext(user, slug);
});
