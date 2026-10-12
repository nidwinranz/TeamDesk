import type { Prisma, RequestPriority, RequestStatus } from '@prisma/client';
import type { ListRequestsQuery } from '@/lib/schemas/requests';
import { cursorArgs, type PageQuery, toPage } from '@/server/lib/pagination';
import { prisma, type Tx } from '@/server/lib/prisma';
import { publicUserSelect } from './users.repo';

const listInclude = {
  assignee: { select: publicUserSelect },
  project: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} as const;

export type RequestFilter = Omit<ListRequestsQuery, 'assignee'> & { assigneeId?: string | null };

function orderBy(
  sort: RequestFilter['sort'],
  order: 'asc' | 'desc',
): Prisma.RequestOrderByWithRelationInput[] {
  const primary: Prisma.RequestOrderByWithRelationInput =
    sort === 'dueDate' ? { dueDate: { sort: order, nulls: 'last' } } : { [sort]: order };
  return [primary, { id: order }];
}

export async function listRequests(orgId: string, filter: RequestFilter, page: PageQuery) {
  const where: Prisma.RequestWhereInput = {
    organizationId: orgId,
    ...(filter.projectId ? { projectId: filter.projectId } : {}),
    ...(filter.status?.length ? { status: { in: filter.status } } : {}),
    ...(filter.priority?.length ? { priority: { in: filter.priority } } : {}),
    ...(filter.assigneeId !== undefined ? { assigneeId: filter.assigneeId } : {}),
    ...(filter.q ? { title: { contains: filter.q, mode: 'insensitive' } } : {}),
  };
  const rows = await prisma.request.findMany({
    where,
    include: listInclude,
    orderBy: orderBy(filter.sort, filter.order),
    ...cursorArgs(page),
  });
  return toPage(rows, page.limit);
}

export function findRequest(orgId: string, requestId: string, db: Tx = prisma) {
  return db.request.findUnique({
    where: { id: requestId, organizationId: orgId },
    include: { ...listInclude, createdBy: { select: publicUserSelect } },
  });
}

export function createRequest(
  orgId: string,
  data: {
    projectId: string;
    title: string;
    description: string;
    status: RequestStatus;
    priority: RequestPriority;
    assigneeId: string | null;
    dueDate: Date | null;
    createdById: string;
  },
  db: Tx = prisma,
) {
  return db.request.create({ data: { organizationId: orgId, ...data }, include: listInclude });
}

export function updateRequest(
  orgId: string,
  requestId: string,
  data: Partial<{
    title: string;
    description: string;
    status: RequestStatus;
    priority: RequestPriority;
    assigneeId: string | null;
    dueDate: Date | null;
  }>,
  db: Tx = prisma,
) {
  return db.request.update({
    where: { id: requestId, organizationId: orgId },
    data,
    include: listInclude,
  });
}

export function deleteRequest(orgId: string, requestId: string, db: Tx = prisma) {
  return db.request.delete({ where: { id: requestId, organizationId: orgId } });
}

export async function countRequestsByStatus(orgId: string) {
  const rows = await prisma.request.groupBy({
    by: ['status'],
    where: { organizationId: orgId, project: { archivedAt: null } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<
    Record<RequestStatus, number>
  >;
}
