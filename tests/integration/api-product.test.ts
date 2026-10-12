import { describe, expect, it } from 'vitest';
import '../helpers/route';
import * as commentRoute from '@/app/api/v1/orgs/[orgSlug]/comments/[commentId]/route';
import * as assigneesRoute from '@/app/api/v1/orgs/[orgSlug]/assignees/route';
import * as projectsRoute from '@/app/api/v1/orgs/[orgSlug]/projects/route';
import * as projectRoute from '@/app/api/v1/orgs/[orgSlug]/projects/[projectId]/route';
import * as requestsRoute from '@/app/api/v1/orgs/[orgSlug]/requests/route';
import * as requestRoute from '@/app/api/v1/orgs/[orgSlug]/requests/[requestId]/route';
import * as commentsRoute from '@/app/api/v1/orgs/[orgSlug]/requests/[requestId]/comments/route';
import { call } from '../helpers/route';
import { createOrgWithRoles } from '../helpers/factories';

describe('/api/v1 projects, requests, comments', () => {
  it('runs a request lifecycle over HTTP', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER', 'MEMBER', 'VIEWER']);
    const as = ctx.MEMBER.user;
    const orgSlug = org.slug;

    const project = await call(projectsRoute.POST, {
      as,
      method: 'POST',
      params: { orgSlug },
      body: { name: 'API project' },
    });
    expect(project.status).toBe(201);
    const projectId = (project.json.data as { id: string }).id;
    expect((await call(projectRoute.GET, { as, params: { orgSlug, projectId } })).status).toBe(200);
    expect((await call(projectsRoute.GET, { as, params: { orgSlug } })).json.data).toHaveLength(1);

    const req = await call(requestsRoute.POST, {
      as,
      method: 'POST',
      params: { orgSlug },
      body: { projectId, title: 'From API', priority: 'URGENT' },
    });
    expect(req.status).toBe(201);
    const requestId = (req.json.data as { id: string }).id;

    const patched = await call(requestRoute.PATCH, {
      as,
      method: 'PATCH',
      params: { orgSlug, requestId },
      body: { status: 'DONE' },
    });
    expect(patched.json.data).toMatchObject({ status: 'DONE' });

    const list = await call(requestsRoute.GET, {
      as,
      params: { orgSlug },
      path: '/x?status=DONE&limit=1',
    });
    expect(list.json).toMatchObject({ data: [{ id: requestId }], nextCursor: null });

    const comment = await call(commentsRoute.POST, {
      as,
      method: 'POST',
      params: { orgSlug, requestId },
      body: { body: 'Nice' },
    });
    expect(comment.status).toBe(201);
    expect(
      (await call(commentsRoute.GET, { as, params: { orgSlug, requestId } })).json.data,
    ).toHaveLength(1);
    const commentId = (comment.json.data as { id: string }).id;
    expect(
      (await call(commentRoute.DELETE, { as, method: 'DELETE', params: { orgSlug, commentId } }))
        .status,
    ).toBe(204);

    expect((await call(assigneesRoute.GET, { as, params: { orgSlug } })).json.data).toHaveLength(2);

    const viewerPatch = await call(requestRoute.PATCH, {
      as: ctx.VIEWER.user,
      method: 'PATCH',
      params: { orgSlug, requestId },
      body: { status: 'OPEN' },
    });
    expect(viewerPatch.status).toBe(403);
    expect(viewerPatch.json.error?.code).toBe('FORBIDDEN');

    expect(
      (await call(requestRoute.DELETE, { as, method: 'DELETE', params: { orgSlug, requestId } }))
        .status,
    ).toBe(204);
    expect((await call(requestRoute.GET, { as, params: { orgSlug, requestId } })).status).toBe(404);
  });

  it('returns 403 PLAN_LIMIT_REACHED with details at the project limit', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const as = ctx.OWNER.user;
    for (let i = 0; i < 3; i++) {
      await call(projectsRoute.POST, {
        as,
        method: 'POST',
        params: { orgSlug: org.slug },
        body: { name: `P${i}` },
      });
    }
    const res = await call(projectsRoute.POST, {
      as,
      method: 'POST',
      params: { orgSlug: org.slug },
      body: { name: 'P4' },
    });
    expect(res.status).toBe(403);
    expect(res.json.error).toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      details: { limit: 'projects', plan: 'FREE' },
    });
  });

  it('returns 404 for another tenant’s request id, even through your own org slug', async () => {
    const a = await createOrgWithRoles(['OWNER']);
    const b = await createOrgWithRoles(['OWNER']);
    const p = await call(projectsRoute.POST, {
      as: b.ctx.OWNER.user,
      method: 'POST',
      params: { orgSlug: b.org.slug },
      body: { name: 'B' },
    });
    const projectId = (p.json.data as { id: string }).id;
    const r = await call(requestsRoute.POST, {
      as: b.ctx.OWNER.user,
      method: 'POST',
      params: { orgSlug: b.org.slug },
      body: { projectId, title: 'B secret' },
    });
    const requestId = (r.json.data as { id: string }).id;
    const res = await call(requestRoute.GET, {
      as: a.ctx.OWNER.user,
      params: { orgSlug: a.org.slug, requestId },
    });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.json)).not.toContain('B secret');
  });
});
