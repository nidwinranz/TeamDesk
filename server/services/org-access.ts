import { findMembership } from '@/server/repos/memberships.repo';
import { findOrgBySlug } from '@/server/repos/organizations.repo';

/** Lightweight membership check used by the middleware before rendering /[orgSlug] pages. */
export async function isMemberOfOrgSlug(userId: string, slug: string): Promise<boolean> {
  const org = await findOrgBySlug(slug);
  if (!org) return false;
  return (await findMembership(org.id, userId)) !== null;
}
