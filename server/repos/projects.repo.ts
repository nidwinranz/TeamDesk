import { prisma, type Tx } from '@/server/lib/prisma';

export function listProjects(orgId: string, opts: { archived: boolean }) {
  return prisma.project.findMany({
    where: { organizationId: orgId, archivedAt: opts.archived ? { not: null } : null },
    include: { _count: { select: { requests: { where: { status: { not: 'DONE' } } } } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

/** Lightweight list for filters and pickers. */
export function listProjectOptions(orgId: string) {
  return prisma.project.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, archivedAt: true },
    orderBy: { name: 'asc' },
  });
}

export function findProject(orgId: string, projectId: string, db: Tx = prisma) {
  return db.project.findUnique({ where: { id: projectId, organizationId: orgId } });
}

export function countActiveProjects(orgId: string, db: Tx = prisma) {
  return db.project.count({ where: { organizationId: orgId, archivedAt: null } });
}

export function createProject(
  orgId: string,
  data: { name: string; description: string },
  db: Tx = prisma,
) {
  return db.project.create({ data: { organizationId: orgId, ...data } });
}

export function updateProject(
  orgId: string,
  projectId: string,
  data: { name?: string; description?: string; archivedAt?: Date | null },
  db: Tx = prisma,
) {
  return db.project.update({ where: { id: projectId, organizationId: orgId }, data });
}
