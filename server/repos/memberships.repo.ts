import type { Role } from '@prisma/client';
import { cursorArgs, type PageQuery, toPage } from '@/server/lib/pagination';
import { prisma, systemPrisma, type Tx } from '@/server/lib/prisma';
import { publicUserSelect } from './users.repo';

export function findMembership(orgId: string, userId: string, db: Tx = prisma) {
  return db.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId }, organizationId: orgId },
  });
}

export function findMembershipById(orgId: string, membershipId: string, db: Tx = prisma) {
  return db.membership.findUnique({
    where: { id: membershipId, organizationId: orgId },
    include: { user: { select: publicUserSelect } },
  });
}

/** Cross-tenant by design: the orgs a user belongs to (workspace switcher). */
export function listMembershipsForUserUnscoped(userId: string) {
  return systemPrisma.membership.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listMembers(orgId: string, page: PageQuery) {
  const rows = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: { user: { select: publicUserSelect } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...cursorArgs(page),
  });
  return toPage(rows, page.limit);
}

/** Members that can be assigned to requests (excludes viewers). */
export function listAssignableMembers(orgId: string) {
  return prisma.membership.findMany({
    where: { organizationId: orgId, role: { not: 'VIEWER' } },
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: 'asc' },
  });
}

export function countMembers(orgId: string, db: Tx = prisma) {
  return db.membership.count({ where: { organizationId: orgId } });
}

export function countOwners(orgId: string, db: Tx = prisma) {
  return db.membership.count({ where: { organizationId: orgId, role: 'OWNER' } });
}

export function createMembership(
  data: { orgId: string; userId: string; role: Role },
  db: Tx = prisma,
) {
  return db.membership.create({
    data: { organizationId: data.orgId, userId: data.userId, role: data.role },
  });
}

export function updateMembershipRole(
  orgId: string,
  membershipId: string,
  role: Role,
  db: Tx = prisma,
) {
  return db.membership.update({
    where: { id: membershipId, organizationId: orgId },
    data: { role },
    include: { user: { select: publicUserSelect } },
  });
}

export function deleteMembership(orgId: string, membershipId: string, db: Tx = prisma) {
  return db.membership.delete({ where: { id: membershipId, organizationId: orgId } });
}
