import { describe, expect, it } from 'vitest';
import '../helpers/route';
import * as invitesRoute from '@/app/api/v1/orgs/[orgSlug]/invites/route';
import * as inviteRoute from '@/app/api/v1/orgs/[orgSlug]/invites/[inviteId]/route';
import * as membersRoute from '@/app/api/v1/orgs/[orgSlug]/members/route';
import * as memberRoute from '@/app/api/v1/orgs/[orgSlug]/members/[memberId]/route';
import * as orgsRoute from '@/app/api/v1/orgs/route';
import { call } from '../helpers/route';
import { createOrgWithRoles } from '../helpers/factories';

describe('/api/v1 members & invites', () => {
  it('401 without a session', async () => {
    const { org } = await createOrgWithRoles(['OWNER']);
    const res = await call(membersRoute.GET, { as: null, params: { orgSlug: org.slug } });
    expect(res.status).toBe(401);
    expect(res.json.error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: expect.any(String) as unknown,
    });
  });

  it('lists members with cursor pagination', async () => {
    const { org, ctx } = await createOrgWithRoles();
    const res = await call(membersRoute.GET, {
      as: ctx.OWNER.user,
      params: { orgSlug: org.slug },
      path: '/x?limit=2',
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveLength(2);
    expect(res.json.nextCursor).toEqual(expect.any(String));
  });

  it('400 on malformed JSON and missing content type, 422 on invalid body', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const p = { as: ctx.OWNER.user, params: { orgSlug: org.slug }, method: 'POST' };
    expect(
      (
        await call(invitesRoute.POST, {
          ...p,
          rawBody: '{bad',
          headers: { 'content-type': 'application/json' },
        })
      ).status,
    ).toBe(400);
    expect((await call(invitesRoute.POST, { ...p, rawBody: '{}' })).status).toBe(400);
    const invalid = await call(invitesRoute.POST, { ...p, body: { email: 'nope' } });
    expect(invalid.status).toBe(422);
    expect(invalid.json.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { fieldErrors: { email: expect.any(Array) as unknown } },
    });
  });

  it('201 on invite, 409 on duplicate, 204 on revoke', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const p = { as: ctx.OWNER.user, params: { orgSlug: org.slug }, method: 'POST' };
    const created = await call(invitesRoute.POST, { ...p, body: { email: 'x@example.com' } });
    expect(created.status).toBe(201);
    expect((await call(invitesRoute.POST, { ...p, body: { email: 'x@example.com' } })).status).toBe(
      409,
    );
    const id = (created.json.data as { id: string }).id;
    const revoked = await call(inviteRoute.DELETE, {
      as: ctx.OWNER.user,
      method: 'DELETE',
      params: { orgSlug: org.slug, inviteId: id },
    });
    expect(revoked.status).toBe(204);
  });

  it('403 for a VIEWER mutating, 404 for another tenant', async () => {
    const a = await createOrgWithRoles(['OWNER', 'VIEWER']);
    const b = await createOrgWithRoles(['OWNER', 'MEMBER']);
    const forbidden = await call(invitesRoute.POST, {
      as: a.ctx.VIEWER.user,
      method: 'POST',
      params: { orgSlug: a.org.slug },
      body: { email: 'x@example.com' },
    });
    expect(forbidden.status).toBe(403);

    // Org A owner targeting Org B: by slug, and by id through their own org.
    expect(
      (await call(membersRoute.GET, { as: a.ctx.OWNER.user, params: { orgSlug: b.org.slug } }))
        .status,
    ).toBe(404);
    const crossId = await call(memberRoute.PATCH, {
      as: a.ctx.OWNER.user,
      method: 'PATCH',
      params: { orgSlug: a.org.slug, memberId: b.ctx.MEMBER.membership.id },
      body: { role: 'VIEWER' },
    });
    expect(crossId.status).toBe(404);
    expect(crossId.json.error?.code).toBe('NOT_FOUND');
  });

  it('409 when demoting the last owner', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const res = await call(memberRoute.PATCH, {
      as: ctx.OWNER.user,
      method: 'PATCH',
      params: { orgSlug: org.slug, memberId: ctx.OWNER.membership.id },
      body: { role: 'ADMIN' },
    });
    expect(res.status).toBe(409);
  });

  it('blocks cross-origin writes (CSRF)', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const res = await call(invitesRoute.POST, {
      as: ctx.OWNER.user,
      method: 'POST',
      params: { orgSlug: org.slug },
      body: { email: 'x@example.com' },
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
    const fetchSite = await call(invitesRoute.POST, {
      as: ctx.OWNER.user,
      method: 'POST',
      params: { orgSlug: org.slug },
      body: { email: 'y@example.com' },
      headers: { origin: '', 'sec-fetch-site': 'cross-site' },
    });
    expect(fetchSite.status).toBe(403);
  });

  it('creates and lists organizations for the current user', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    const res = await call(orgsRoute.POST, {
      as: ctx.OWNER.user,
      method: 'POST',
      body: { name: 'Second Org' },
    });
    expect(res.status).toBe(201);
    const list = await call(orgsRoute.GET, { as: ctx.OWNER.user });
    expect(list.json.data).toHaveLength(2);
  });
});
