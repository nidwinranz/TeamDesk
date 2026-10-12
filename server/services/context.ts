import type { Plan, Role } from '@prisma/client';
import { type Action, can } from '@/server/policies/permissions';
import { forbidden, notFound } from '@/server/lib/errors';
import { findMembership } from '@/server/repos/memberships.repo';
import { findOrgBySlug } from '@/server/repos/organizations.repo';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** Everything a tenant-scoped service call needs: who is acting, in which org, with which role. */
export interface OrgContext {
  user: SessionUser;
  org: { id: string; slug: string; name: string; plan: Plan };
  membership: { id: string; role: Role };
}

/**
 * Resolves the org by slug and checks membership. Non-members get a 404 (not
 * 403) so the existence of other tenants' workspaces is never revealed.
 */
export async function resolveOrgContext(user: SessionUser, slug: string): Promise<OrgContext> {
  const org = await findOrgBySlug(slug);
  if (!org) throw notFound('Workspace');
  const membership = await findMembership(org.id, user.id);
  if (!membership) throw notFound('Workspace');
  return {
    user,
    org: { id: org.id, slug: org.slug, name: org.name, plan: org.plan },
    membership: { id: membership.id, role: membership.role },
  };
}

export function assertCan(ctx: OrgContext, action: Action): void {
  if (!can(ctx.membership, action)) throw forbidden();
}
