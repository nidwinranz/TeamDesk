import type { Prisma } from '@prisma/client';
import { cursorArgs, type PageQuery, toPage } from '@/server/lib/pagination';
import { prisma, type Tx } from '@/server/lib/prisma';

export interface AuditEntry {
  orgId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

export function appendAuditLog(entry: AuditEntry, db: Tx = prisma) {
  return db.auditLog.create({
    data: {
      organizationId: entry.orgId,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? {},
    },
  });
}

export async function listAuditLogs(
  orgId: string,
  page: PageQuery,
  filter: { action?: string } = {},
) {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId: orgId, ...(filter.action ? { action: filter.action } : {}) },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(page),
  });
  return toPage(rows, page.limit);
}
