import 'server-only';
import { createCommentSchema } from '@/lib/schemas/requests';
import { forbidden, notFound } from '@/server/lib/errors';
import { pageQuerySchema } from '@/server/lib/pagination';
import { parse } from '@/server/lib/validation';
import { ROLE_RANK } from '@/server/policies/permissions';
import * as comments from '@/server/repos/comments.repo';
import { findRequest } from '@/server/repos/requests.repo';
import { assertCan, type OrgContext } from './context';

async function assertRequestExists(ctx: OrgContext, requestId: string) {
  if (!(await findRequest(ctx.org.id, requestId))) throw notFound('Request');
}

export async function listComments(
  ctx: OrgContext,
  requestId: string,
  query: Record<string, unknown> = {},
) {
  assertCan(ctx, 'comment:read');
  await assertRequestExists(ctx, requestId);
  return comments.listComments(ctx.org.id, requestId, parse(pageQuerySchema, query));
}

export async function addComment(ctx: OrgContext, requestId: string, input: unknown) {
  assertCan(ctx, 'comment:create');
  const { body } = parse(createCommentSchema, input);
  await assertRequestExists(ctx, requestId);
  return comments.createComment(ctx.org.id, { requestId, authorId: ctx.user.id, body });
}

/** Authors may delete their own comments; ADMIN and OWNER may delete any. */
export async function deleteComment(ctx: OrgContext, commentId: string) {
  assertCan(ctx, 'comment:delete');
  const comment = await comments.findComment(ctx.org.id, commentId);
  if (!comment) throw notFound('Comment');
  if (comment.authorId !== ctx.user.id && ROLE_RANK[ctx.membership.role] < ROLE_RANK.ADMIN) {
    throw forbidden('You can only delete your own comments');
  }
  await comments.deleteComment(ctx.org.id, commentId);
}
