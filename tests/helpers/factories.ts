import type { Role } from '@prisma/client';
import { hashPassword } from '@/server/lib/password';
import type { OrgContext } from '@/server/services/context';
import { testDb } from './db';

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export const PASSWORD = 'correct-horse-battery';

export async function createUser(
  overrides: { email?: string; name?: string; verified?: boolean } = {},
) {
  return testDb.user.create({
    data: {
      email: overrides.email ?? `user-${uid()}@test.dev`,
      name: overrides.name ?? 'Test User',
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: overrides.verified === false ? null : new Date(),
    },
  });
}

export async function createOrg(
  overrides: { name?: string; slug?: string; plan?: 'FREE' | 'PRO' } = {},
) {
  const id = uid();
  return testDb.organization.create({
    data: {
      name: overrides.name ?? `Org ${id}`,
      slug: overrides.slug ?? `org-${id}`,
      plan: overrides.plan ?? 'FREE',
    },
  });
}

export async function addMember(orgId: string, userId: string, role: Role) {
  return testDb.membership.create({ data: { organizationId: orgId, userId, role } });
}

/** Creates an org with one user per requested role and returns ready-made service contexts. */
export async function createOrgWithRoles(
  roles: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  orgOverrides = {},
) {
  const org = await createOrg(orgOverrides);
  const ctx = {} as Record<Role, OrgContext>;
  for (const role of roles) {
    const user = await createUser({ name: `${role} user` });
    const m = await addMember(org.id, user.id, role);
    ctx[role] = {
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: org.id, slug: org.slug, name: org.name, plan: org.plan },
      membership: { id: m.id, role },
    };
  }
  return { org, ctx };
}

export async function createProject(orgId: string, name = 'Project') {
  return testDb.project.create({ data: { organizationId: orgId, name } });
}
