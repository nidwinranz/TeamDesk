import 'server-only';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '@/lib/schemas/projects';
import { isWithinLimit, limitFor } from '@/server/config/plans';
import { notFound, planLimitReached } from '@/server/lib/errors';
import { parse } from '@/server/lib/validation';
import { appendAuditLog } from '@/server/repos/audit.repo';
import * as projects from '@/server/repos/projects.repo';
import { transaction, type Tx } from '@/server/repos/transaction';
import { assertCan, type OrgContext } from './context';

async function assertProjectSlot(ctx: OrgContext, tx: Tx) {
  const active = await projects.countActiveProjects(ctx.org.id, tx);
  if (!isWithinLimit(ctx.org.plan, 'projects', active)) {
    throw planLimitReached(
      `The ${ctx.org.plan} plan includes up to ${limitFor(ctx.org.plan, 'projects')} active projects. Archive one or upgrade.`,
      { limit: 'projects', plan: ctx.org.plan },
    );
  }
}

export async function listProjects(ctx: OrgContext, query: unknown = {}) {
  assertCan(ctx, 'project:read');
  const { archived } = parse(listProjectsQuerySchema, query);
  const rows = await projects.listProjects(ctx.org.id, { archived });
  return rows.map(({ _count, ...p }) => ({ ...p, openRequests: _count.requests }));
}

export async function listProjectOptions(ctx: OrgContext) {
  assertCan(ctx, 'project:read');
  return projects.listProjectOptions(ctx.org.id);
}

export async function getProject(ctx: OrgContext, projectId: string) {
  assertCan(ctx, 'project:read');
  const project = await projects.findProject(ctx.org.id, projectId);
  if (!project) throw notFound('Project');
  return project;
}

export async function createProject(ctx: OrgContext, input: unknown) {
  assertCan(ctx, 'project:create');
  const data = parse(createProjectSchema, input);
  return transaction(
    async (tx) => {
      await assertProjectSlot(ctx, tx);
      const project = await projects.createProject(ctx.org.id, data, tx);
      await appendAuditLog(
        {
          orgId: ctx.org.id,
          actorId: ctx.user.id,
          action: 'project.created',
          targetType: 'project',
          targetId: project.id,
          metadata: { name: project.name },
        },
        tx,
      );
      return project;
    },
    // Serializable so two concurrent creates cannot both squeeze under the limit.
    { isolationLevel: 'Serializable' },
  );
}

export async function updateProject(ctx: OrgContext, projectId: string, input: unknown) {
  const { archived, ...fields } = parse(updateProjectSchema, input);
  if (archived !== undefined) assertCan(ctx, 'project:archive');
  if (Object.keys(fields).length > 0) assertCan(ctx, 'project:update');

  return transaction(
    async (tx) => {
      const existing = await projects.findProject(ctx.org.id, projectId, tx);
      if (!existing) throw notFound('Project');
      const wasArchived = existing.archivedAt !== null;
      const archiveChange = archived !== undefined && archived !== wasArchived;
      if (archiveChange && !archived) await assertProjectSlot(ctx, tx);

      const updated = await projects.updateProject(
        ctx.org.id,
        projectId,
        { ...fields, ...(archiveChange ? { archivedAt: archived ? new Date() : null } : {}) },
        tx,
      );
      if (Object.keys(fields).length > 0) {
        await appendAuditLog(
          {
            orgId: ctx.org.id,
            actorId: ctx.user.id,
            action: 'project.updated',
            targetType: 'project',
            targetId: projectId,
            metadata: fields,
          },
          tx,
        );
      }
      if (archiveChange) {
        await appendAuditLog(
          {
            orgId: ctx.org.id,
            actorId: ctx.user.id,
            action: archived ? 'project.archived' : 'project.unarchived',
            targetType: 'project',
            targetId: projectId,
            metadata: { name: updated.name },
          },
          tx,
        );
      }
      return updated;
    },
    { isolationLevel: 'Serializable' },
  );
}
