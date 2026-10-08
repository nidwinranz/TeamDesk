import { cursorArgs, type PageQuery, toPage } from '@/server/lib/pagination';
import { prisma, type Tx } from '@/server/lib/prisma';
import { publicUserSelect } from './users.repo';

export async function listComments(orgId: string, requestId: string, page: PageQuery) {
  const rows = await prisma.comment.findMany({
    where: { organizationId: orgId, requestId },
    include: { author: { select: publicUserSelect } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...cursorArgs(page),
  });
  return toPage(rows, page.limit);
}

export function findComment(orgId: string, commentId: string, db: Tx = prisma) {
  return db.comment.findUnique({ where: { id: commentId, organizationId: orgId } });
}

export function createComment(
  orgId: string,
  data: { requestId: string; authorId: string; body: string },
  db: Tx = prisma,
) {
  return db.comment.create({
    data: { organizationId: orgId, ...data },
    include: { author: { select: publicUserSelect } },
  });
}

export function deleteComment(orgId: string, commentId: string, db: Tx = prisma) {
  return db.comment.delete({ where: { id: commentId, organizationId: orgId } });
}
