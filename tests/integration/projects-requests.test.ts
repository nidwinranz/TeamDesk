import { describe, expect, it } from 'vitest';
import * as comments from '@/server/services/comments.service';
import * as projects from '@/server/services/projects.service';
import * as requests from '@/server/services/requests.service';
import { testDb } from '../helpers/db';
import { createOrgWithRoles } from '../helpers/factories';

const auditActions = async (orgId: string) =>
  (
    await testDb.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    })
  ).map((a) => a.action);

describe('projects', () => {
  it('creates, updates, archives and unarchives with audit entries', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const p = await projects.createProject(ctx.OWNER, { name: '  Website  ' });
    expect(p).toMatchObject({ name: 'Website', description: '', archivedAt: null });
    await projects.updateProject(ctx.OWNER, p.id, { description: 'New site' });
    const archived = await projects.updateProject(ctx.OWNER, p.id, { archived: true });
    expect(archived.archivedAt).not.toBeNull();
    expect(await projects.listProjects(ctx.OWNER)).toHaveLength(0);
    expect(await projects.listProjects(ctx.OWNER, { archived: 'true' })).toHaveLength(1);
    await projects.updateProject(ctx.OWNER, p.id, { archived: false });
    expect(await auditActions(org.id)).toEqual([
      'project.created',
      'project.updated',
      'project.archived',
      'project.unarchived',
    ]);
  });

  it('MEMBER can create but not edit or archive; VIEWER can only read', async () => {
    const { ctx } = await createOrgWithRoles();
    const p = await projects.createProject(ctx.MEMBER, { name: 'By member' });
    await expect(projects.updateProject(ctx.MEMBER, p.id, { name: 'x' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      projects.updateProject(ctx.MEMBER, p.id, { archived: true }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(projects.createProject(ctx.VIEWER, { name: 'nope' })).rejects.toMatchObject({
      status: 403,
    });
    expect(await projects.listProjects(ctx.VIEWER)).toHaveLength(1);
    await expect(
      projects.updateProject(ctx.ADMIN, p.id, { name: 'Renamed' }),
    ).resolves.toMatchObject({ name: 'Renamed' });
  });

  it('enforces the FREE limit of 3 active projects, counting unarchive', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    // Five concurrent creates: serializable transactions let exactly three through.
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((i) => projects.createProject(ctx.OWNER, { name: `P${i}` })),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(3);
    const first = (fulfilled[0] as PromiseFulfilledResult<{ id: string }>).value;
    await expect(projects.createProject(ctx.OWNER, { name: 'P4' })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
    await projects.updateProject(ctx.OWNER, first.id, { archived: true });
    await projects.createProject(ctx.OWNER, { name: 'P4' });
    await expect(
      projects.updateProject(ctx.OWNER, first.id, { archived: false }),
    ).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
  });

  it('PRO has no project limit', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER'], { plan: 'PRO' });
    for (let i = 0; i < 5; i++) await projects.createProject(ctx.OWNER, { name: `P${i}` });
    expect(await projects.listProjects(ctx.OWNER)).toHaveLength(5);
  });

  it('validates input', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    await expect(projects.createProject(ctx.OWNER, { name: '' })).rejects.toMatchObject({
      status: 422,
    });
    const p = await projects.createProject(ctx.OWNER, { name: 'ok' });
    await expect(projects.updateProject(ctx.OWNER, p.id, {})).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('requests', () => {
  async function setup() {
    const env = await createOrgWithRoles();
    const project = await projects.createProject(env.ctx.OWNER, { name: 'Main' });
    return { ...env, project };
  }

  it('creates and updates requests with status, priority, assignee and due date', async () => {
    const { org, ctx, project } = await setup();
    const r = await requests.createRequest(ctx.MEMBER, {
      projectId: project.id,
      title: 'Fix login',
      priority: 'HIGH',
      assigneeId: ctx.MEMBER.user.id,
      dueDate: '2030-01-15',
    });
    expect(r).toMatchObject({ status: 'OPEN', priority: 'HIGH', assigneeId: ctx.MEMBER.user.id });
    expect(r.dueDate?.toISOString()).toBe('2030-01-15T00:00:00.000Z');

    const u = await requests.updateRequest(ctx.MEMBER, r.id, {
      status: 'DONE',
      assigneeId: null,
      dueDate: null,
    });
    expect(u).toMatchObject({ status: 'DONE', assigneeId: null, dueDate: null });
    const log = await testDb.auditLog.findFirstOrThrow({
      where: { organizationId: org.id, action: 'request.updated' },
    });
    expect(log.metadata).toMatchObject({ status: { from: 'OPEN', to: 'DONE' } });

    await requests.deleteRequest(ctx.MEMBER, r.id);
    await expect(requests.getRequest(ctx.MEMBER, r.id)).rejects.toMatchObject({ status: 404 });
  });

  it('VIEWER is read-only', async () => {
    const { ctx, project } = await setup();
    const r = await requests.createRequest(ctx.OWNER, { projectId: project.id, title: 'x' });
    await expect(
      requests.createRequest(ctx.VIEWER, { projectId: project.id, title: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requests.updateRequest(ctx.VIEWER, r.id, { status: 'DONE' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(requests.deleteRequest(ctx.VIEWER, r.id)).rejects.toMatchObject({ status: 403 });
    await expect(comments.addComment(ctx.VIEWER, r.id, { body: 'hi' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(requests.getRequest(ctx.VIEWER, r.id)).resolves.toMatchObject({ id: r.id });
  });

  it('rejects assignees who are viewers or outside the org (422) and archived projects (409)', async () => {
    const { ctx, project } = await setup();
    const other = await createOrgWithRoles(['OWNER']);
    await expect(
      requests.createRequest(ctx.OWNER, {
        projectId: project.id,
        title: 'x',
        assigneeId: ctx.VIEWER.user.id,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      requests.createRequest(ctx.OWNER, {
        projectId: project.id,
        title: 'x',
        assigneeId: other.ctx.OWNER.user.id,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await projects.updateProject(ctx.OWNER, project.id, { archived: true });
    await expect(
      requests.createRequest(ctx.OWNER, { projectId: project.id, title: 'x' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('filters, sorts and paginates with a cursor', async () => {
    const { ctx, project } = await setup();
    const second = await projects.createProject(ctx.OWNER, { name: 'Second' });
    const specs = [
      { title: 'Alpha bug', status: 'OPEN', priority: 'LOW', dueDate: '2030-01-03' },
      { title: 'Beta feature', status: 'IN_PROGRESS', priority: 'URGENT', dueDate: null },
      {
        title: 'Gamma bug',
        status: 'BLOCKED',
        priority: 'HIGH',
        dueDate: '2030-01-01',
        assigneeId: ctx.MEMBER.user.id,
      },
      { title: 'Delta chore', status: 'DONE', priority: 'MEDIUM', dueDate: '2030-01-02' },
    ] as const;
    for (const s of specs) await requests.createRequest(ctx.OWNER, { projectId: project.id, ...s });
    await requests.createRequest(ctx.OWNER, { projectId: second.id, title: 'Other project bug' });

    const titles = async (q: Record<string, string>) =>
      (await requests.listRequests(ctx.MEMBER, q)).items.map((r) => r.title);

    expect(
      await titles({ projectId: project.id, status: 'OPEN,BLOCKED', sort: 'title', order: 'asc' }),
    ).toEqual(['Alpha bug', 'Gamma bug']);
    expect(await titles({ q: 'BUG', projectId: project.id, sort: 'title', order: 'asc' })).toEqual([
      'Alpha bug',
      'Gamma bug',
    ]);
    expect(await titles({ projectId: project.id, sort: 'priority', order: 'desc' })).toEqual([
      'Beta feature',
      'Gamma bug',
      'Delta chore',
      'Alpha bug',
    ]);
    expect(await titles({ projectId: project.id, sort: 'dueDate', order: 'asc' })).toEqual([
      'Gamma bug',
      'Delta chore',
      'Alpha bug',
      'Beta feature',
    ]);
    expect(await titles({ assignee: 'me' })).toEqual(['Gamma bug']); // MEMBER is the assignee
    expect(await titles({ assignee: ctx.MEMBER.user.id })).toEqual(['Gamma bug']);
    expect((await titles({ assignee: 'none' })).length).toBe(4);
    expect(await titles({ priority: 'URGENT,HIGH', sort: 'title', order: 'asc' })).toEqual([
      'Beta feature',
      'Gamma bug',
    ]);

    // Walk all 5 requests two at a time, sorted by due date (nulls last).
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await requests.listRequests(ctx.MEMBER, {
        sort: 'dueDate',
        order: 'asc',
        limit: '2',
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...page.items.map((r) => r.title));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(seen.slice(0, 3)).toEqual(['Gamma bug', 'Delta chore', 'Alpha bug']);

    await expect(requests.listRequests(ctx.MEMBER, { status: 'NOPE' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(requests.listRequests(ctx.MEMBER, { limit: '500' })).rejects.toMatchObject({
      status: 422,
    });
    expect(await requests.getRequestSummary(ctx.MEMBER)).toMatchObject({ OPEN: 2, DONE: 1 });
  });
});

describe('comments', () => {
  it('adds, lists and deletes comments; authors or admins may delete', async () => {
    const { ctx } = await createOrgWithRoles();
    const project = await projects.createProject(ctx.OWNER, { name: 'P' });
    const r = await requests.createRequest(ctx.OWNER, { projectId: project.id, title: 'R' });
    const mine = await comments.addComment(ctx.MEMBER, r.id, { body: ' Hello ' });
    expect(mine.body).toBe('Hello');
    const ownerComment = await comments.addComment(ctx.OWNER, r.id, { body: 'From owner' });

    const list = await comments.listComments(ctx.VIEWER, r.id);
    expect(list.items.map((c) => c.body)).toEqual(['Hello', 'From owner']);
    expect((await requests.getRequest(ctx.VIEWER, r.id)).commentCount).toBe(2);

    await expect(comments.deleteComment(ctx.MEMBER, ownerComment.id)).rejects.toMatchObject({
      status: 403,
    });
    await comments.deleteComment(ctx.MEMBER, mine.id);
    await comments.deleteComment(ctx.ADMIN, ownerComment.id);
    expect((await comments.listComments(ctx.OWNER, r.id)).items).toHaveLength(0);
    await expect(comments.addComment(ctx.MEMBER, r.id, { body: '   ' })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('tenant isolation (product)', () => {
  it('Org A user gets 404 on every Org B project, request and comment', async () => {
    const a = await createOrgWithRoles(['OWNER']);
    const b = await createOrgWithRoles(['OWNER']);
    const bProject = await projects.createProject(b.ctx.OWNER, { name: 'Secret' });
    const bRequest = await requests.createRequest(b.ctx.OWNER, {
      projectId: bProject.id,
      title: 'Secret request',
    });
    const bComment = await comments.addComment(b.ctx.OWNER, bRequest.id, { body: 'secret' });
    const A = a.ctx.OWNER;

    await expect(projects.getProject(A, bProject.id)).rejects.toMatchObject({ status: 404 });
    await expect(projects.updateProject(A, bProject.id, { name: 'pwned' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(requests.getRequest(A, bRequest.id)).rejects.toMatchObject({ status: 404 });
    await expect(requests.updateRequest(A, bRequest.id, { title: 'pwned' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(requests.deleteRequest(A, bRequest.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      requests.createRequest(A, { projectId: bProject.id, title: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(comments.listComments(A, bRequest.id)).rejects.toMatchObject({ status: 404 });
    await expect(comments.addComment(A, bRequest.id, { body: 'x' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(comments.deleteComment(A, bComment.id)).rejects.toMatchObject({ status: 404 });
    expect((await requests.listRequests(A, {})).items).toHaveLength(0);
    expect(await projects.listProjects(A)).toHaveLength(0);
    expect(await testDb.request.findUniqueOrThrow({ where: { id: bRequest.id } })).toMatchObject({
      title: 'Secret request',
    });
  });
});
