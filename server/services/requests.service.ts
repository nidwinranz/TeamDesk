import 'server-only';
import {
  createRequestSchema,
  listRequestsQuerySchema,
  updateRequestSchema,
} from '@/lib/schemas/requests';
import { conflict, notFound, validationFailed } from '@/server/lib/errors';
import { pageQuerySchema } from '@/server/lib/pagination';
import { parse } from '@/server/lib/validation';
import { appendAuditLog, toAuditJson } from '@/server/repos/audit.repo';
import { findMembership } from '@/server/repos/memberships.repo';
import { findProject } from '@/server/repos/projects.repo';
import * as requests from '@/server/repos/requests.repo';
import { transaction, type Tx } from '@/server/repos/transaction';
import { assertCan, type OrgContext } from './context';

/** Assignees must be non-viewer members of the same org; anything else is a 422, never a leak. */
async function assertAssignable(ctx: OrgContext, assigneeId: string | null | undefined, tx?: Tx) {
  if (!assigneeId) return;
  const m = await findMembership(ctx.org.id, assigneeId, tx);
  if (!m || m.role === 'VIEWER') {
    throw validationFailed('Assignee must be a member of this workspace', {
      fieldErrors: { assigneeId: ['Choose a workspace member'] },
    });
  }
}

export async function listRequests(ctx: OrgContext, query: Record<string, unknown>) {
  assertCan(ctx, 'request:read');
  const filter = parse(listRequestsQuerySchema, query);
  const page = parse(pageQuerySchema, query);
  const assigneeId =
    filter.assignee === undefined
      ? undefined
      : filter.assignee === 'none'
        ? null
        : filter.assignee === 'me'
          ? ctx.user.id
          : filter.assignee;
  const result = await requests.listRequests(ctx.org.id, { ...filter, assigneeId }, page);
  return {
    ...result,
    items: result.items.map(({ _count, ...r }) => ({ ...r, commentCount: _count.comments })),
  };
}

export async function getRequest(ctx: OrgContext, requestId: string) {
  assertCan(ctx, 'request:read');
  const request = await requests.findRequest(ctx.org.id, requestId);
  if (!request) throw notFound('Request');
  const { _count, ...rest } = request;
  return { ...rest, commentCount: _count.comments };
}

export async function getRequestSummary(ctx: OrgContext) {
  assertCan(ctx, 'request:read');
  return requests.countRequestsByStatus(ctx.org.id);
}

export async function createRequest(ctx: OrgContext, input: unknown) {
  assertCan(ctx, 'request:create');
  const data = parse(createRequestSchema, input);
  return transaction(async (tx) => {
    const project = await findProject(ctx.org.id, data.projectId, tx);
    if (!project) throw notFound('Project');
    if (project.archivedAt)
      throw conflict('This project is archived. Unarchive it to add requests.');
    await assertAssignable(ctx, data.assigneeId, tx);
    const created = await requests.createRequest(
      ctx.org.id,
      { ...data, createdById: ctx.user.id },
      tx,
    );
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'request.created',
        targetType: 'request',
        targetId: created.id,
        metadata: { title: created.title, projectId: project.id },
      },
      tx,
    );
    return created;
  });
}

export async function updateRequest(ctx: OrgContext, requestId: string, input: unknown) {
  assertCan(ctx, 'request:update');
  const data = parse(updateRequestSchema, input);
  return transaction(async (tx) => {
    const existing = await requests.findRequest(ctx.org.id, requestId, tx);
    if (!existing) throw notFound('Request');
    await assertAssignable(ctx, data.assigneeId, tx);
    const updated = await requests.updateRequest(ctx.org.id, requestId, data, tx);
    const changes = Object.fromEntries(
      Object.keys(data).map((k) => {
        const key = k as keyof typeof data;
        return [k, { from: existing[key] ?? null, to: updated[key] ?? null }];
      }),
    );
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'request.updated',
        targetType: 'request',
        targetId: requestId,
        metadata: toAuditJson(changes),
      },
      tx,
    );
    return updated;
  });
}

export async function deleteRequest(ctx: OrgContext, requestId: string) {
  assertCan(ctx, 'request:delete');
  await transaction(async (tx) => {
    const existing = await requests.findRequest(ctx.org.id, requestId, tx);
    if (!existing) throw notFound('Request');
    await requests.deleteRequest(ctx.org.id, requestId, tx);
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'request.deleted',
        targetType: 'request',
        targetId: requestId,
        metadata: { title: existing.title },
      },
      tx,
    );
  });
}
