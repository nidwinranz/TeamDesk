import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../helpers/route';
import * as auditRoute from '@/app/api/v1/orgs/[orgSlug]/audit/route';
import * as orgRoute from '@/app/api/v1/orgs/[orgSlug]/route';
import { listAuditLogs } from '@/server/services/audit.service';
import * as members from '@/server/services/members.service';
import * as orgs from '@/server/services/organizations.service';
import { testDb } from '../helpers/db';
import { createOrgWithRoles } from '../helpers/factories';
import { call } from '../helpers/route';

describe('audit log', () => {
  it('is readable by ADMIN+, filterable by action and cursor paginated', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER', 'ADMIN', 'MEMBER']);
    for (const email of ['a@x.dev', 'b@x.dev']) await members.inviteMember(ctx.OWNER, { email });
    await members.changeMemberRole(ctx.OWNER, ctx.MEMBER.membership.id, { role: 'VIEWER' });

    await expect(listAuditLogs(ctx.MEMBER, {})).rejects.toMatchObject({ status: 403 });
    const all = await listAuditLogs(ctx.ADMIN, { limit: '2' });
    expect(all.items).toHaveLength(2);
    expect(all.items[0]?.action).toBe('member.role_changed'); // newest first
    const next = await listAuditLogs(ctx.ADMIN, { limit: '2', cursor: all.nextCursor });
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeNull();

    const invites = await listAuditLogs(ctx.OWNER, { action: 'invite.sent' });
    expect(invites.items.map((i) => i.action)).toEqual(['invite.sent', 'invite.sent']);
    await expect(listAuditLogs(ctx.OWNER, { action: 'nope' })).rejects.toMatchObject({
      status: 422,
    });

    const res = await call(auditRoute.GET, {
      as: ctx.ADMIN.user,
      params: { orgSlug: org.slug },
      path: '/x?action=invite.sent&limit=1',
    });
    expect(res.status).toBe(200);
    expect(res.json.data).toHaveLength(1);
    expect(res.json.nextCursor).toEqual(expect.any(String));
  });

  it('never shows another tenant’s entries', async () => {
    const a = await createOrgWithRoles(['OWNER']);
    const b = await createOrgWithRoles(['OWNER']);
    await members.inviteMember(b.ctx.OWNER, { email: 'secret@b.dev' });
    expect((await listAuditLogs(a.ctx.OWNER, {})).items).toHaveLength(0);
  });
});

describe('organization settings', () => {
  it('OWNER renames and re-slugs; reserved/taken slugs are rejected; ADMIN is forbidden', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER', 'ADMIN']);
    const other = await createOrgWithRoles(['OWNER']);
    await expect(orgs.updateOrganization(ctx.ADMIN, { name: 'x' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(orgs.updateOrganization(ctx.OWNER, { slug: 'login' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      orgs.updateOrganization(ctx.OWNER, { slug: other.org.slug }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(orgs.updateOrganization(ctx.OWNER, { slug: 'Bad Slug' })).rejects.toMatchObject({
      status: 422,
    });
    const res = await call(orgRoute.PATCH, {
      as: ctx.OWNER.user,
      method: 'PATCH',
      params: { orgSlug: org.slug },
      body: { name: 'Renamed', slug: 'renamed-co' },
    });
    expect(res.json.data).toMatchObject({ name: 'Renamed', slug: 'renamed-co' });
    expect(
      await testDb.auditLog.count({ where: { organizationId: org.id, action: 'org.updated' } }),
    ).toBe(1);
    expect(
      (await call(orgRoute.GET, { as: ctx.OWNER.user, params: { orgSlug: 'renamed-co' } })).json
        .data,
    ).toMatchObject({
      role: 'OWNER',
    });
  });
});

describe('session validation', () => {
  const authMock = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/server/auth', () => ({ auth: authMock }));
    vi.doUnmock('@/server/services/session');
  });

  it('rejects sessions issued before a password reset (sessionVersion mismatch) and deleted users', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    const session = await import('@/server/services/session');
    const user = ctx.OWNER.user;

    authMock.mockResolvedValue({ user: { id: user.id }, sessionVersion: 0 });
    await expect(session.getCurrentUser()).resolves.toMatchObject({ id: user.id });
    await expect(session.getOrgContext(ctx.OWNER.org.slug)).resolves.toMatchObject({
      membership: { role: 'OWNER' },
    });

    await testDb.user.update({ where: { id: user.id }, data: { sessionVersion: 1 } });
    vi.resetModules();
    const fresh = await import('@/server/services/session');
    await expect(fresh.getCurrentUser()).resolves.toBeNull();
    await expect(fresh.requireUser()).rejects.toMatchObject({ status: 401 });

    authMock.mockResolvedValue(null);
    await expect(fresh.getCurrentUser()).resolves.toBeNull();
    authMock.mockResolvedValue({ user: { id: 'deleted-user' }, sessionVersion: 0 });
    await expect(fresh.getCurrentUser()).resolves.toBeNull();
  });
});
