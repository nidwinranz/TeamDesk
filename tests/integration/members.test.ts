import { beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '@/server/lib/crypto';
import { getMailer, type MemoryMailer } from '@/server/lib/mailer';
import * as auth from '@/server/services/auth.service';
import * as members from '@/server/services/members.service';
import { testDb } from '../helpers/db';
import { addMember, createOrgWithRoles, createUser } from '../helpers/factories';

const mailer = getMailer() as MemoryMailer;
const tokenFromInvite = () => {
  const m = /\/invite\/([A-Za-z0-9_-]+)/.exec(mailer.last()?.text ?? '');
  if (!m?.[1]) throw new Error('no invite link');
  return m[1];
};
const actions = async (orgId: string) =>
  (
    await testDb.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    })
  ).map((a) => a.action);

beforeEach(() => mailer.clear());

describe('invites', () => {
  it('sends an invite with a 32-byte token whose SHA-256 hash alone is stored, expiring in 7 days', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const invite = await members.inviteMember(ctx.OWNER, {
      email: 'New@Example.com',
      role: 'MEMBER',
    });
    const token = tokenFromInvite();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);

    const row = await testDb.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(row.email).toBe('new@example.com');
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toContain(token);
    const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
    expect(await actions(org.id)).toEqual(['invite.sent']);
  });

  it('accepts once for the matching email, creating a membership with the invited role', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    await members.inviteMember(ctx.OWNER, { email: 'joiner@example.com', role: 'VIEWER' });
    const token = tokenFromInvite();
    const joiner = await createUser({ email: 'joiner@example.com' });

    expect(await members.getInvitePreview(token)).toMatchObject({
      status: 'valid',
      role: 'VIEWER',
    });
    const result = await members.acceptInvite(joiner, token);
    expect(result.slug).toBe(org.slug);
    const m = await testDb.membership.findFirstOrThrow({ where: { userId: joiner.id } });
    expect(m.role).toBe('VIEWER');
    expect((await members.getInvitePreview(token)).status).toBe('accepted');

    const other = await createUser({ email: 'other@example.com' });
    await expect(members.acceptInvite(other, token)).rejects.toMatchObject({ status: 403 });
    expect(await actions(org.id)).toEqual(['invite.sent', 'invite.accepted']);
  });

  it('rejects accepting with a different email (forwarded link)', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    await members.inviteMember(ctx.OWNER, { email: 'a@example.com' });
    const wrong = await createUser({ email: 'b@example.com' });
    await expect(members.acceptInvite(wrong, tokenFromInvite())).rejects.toThrow(
      /sent to a@example.com/,
    );
  });

  it('rejects expired, revoked and unknown tokens', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    const user = await createUser({ email: 'late@example.com' });
    const invite = await members.inviteMember(ctx.OWNER, { email: 'late@example.com' });
    const token = tokenFromInvite();
    await testDb.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect((await members.getInvitePreview(token)).status).toBe('expired');
    await expect(members.acceptInvite(user, token)).rejects.toMatchObject({ status: 400 });

    await expect(members.acceptInvite(user, 'x'.repeat(43))).rejects.toMatchObject({ status: 404 });

    const invite2 = await members.inviteMember(ctx.OWNER, { email: 'revoked@example.com' });
    const token2 = tokenFromInvite();
    await members.revokeInvite(ctx.OWNER, invite2.id);
    expect((await members.getInvitePreview(token2)).status).toBe('revoked');
  });

  it('resend rotates the token so the old link stops working', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    const invite = await members.inviteMember(ctx.OWNER, { email: 'r@example.com' });
    const oldToken = tokenFromInvite();
    await members.resendInvite(ctx.OWNER, invite.id);
    const newToken = tokenFromInvite();
    expect(newToken).not.toBe(oldToken);
    await expect(members.getInvitePreview(oldToken)).rejects.toMatchObject({ status: 404 });
    expect((await members.getInvitePreview(newToken)).status).toBe('valid');
    expect(await actions(org.id)).toEqual(['invite.sent', 'invite.resent']);
  });

  it('rejects duplicate invites and inviting existing members with 409', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER', 'MEMBER']);
    await members.inviteMember(ctx.OWNER, { email: 'dup@example.com' });
    await expect(
      members.inviteMember(ctx.OWNER, { email: 'dup@example.com' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      members.inviteMember(ctx.OWNER, { email: ctx.MEMBER.user.email }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('enforces permissions: MEMBER/VIEWER cannot invite; ADMIN cannot invite an OWNER', async () => {
    const { ctx } = await createOrgWithRoles();
    await expect(
      members.inviteMember(ctx.MEMBER, { email: 'x@example.com' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      members.inviteMember(ctx.VIEWER, { email: 'x@example.com' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      members.inviteMember(ctx.ADMIN, { email: 'x@example.com', role: 'OWNER' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      members.inviteMember(ctx.ADMIN, { email: 'x@example.com', role: 'ADMIN' }),
    ).resolves.toBeDefined();
  });

  it('validates input with 422', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    await expect(members.inviteMember(ctx.OWNER, { email: 'nope' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      members.inviteMember(ctx.OWNER, { email: 'a@b.co', role: 'GOD' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('counts pending invites against the FREE seat limit', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER', 'ADMIN', 'MEMBER']);
    await members.inviteMember(ctx.OWNER, { email: 'four@example.com' });
    await members.inviteMember(ctx.OWNER, { email: 'five@example.com' });
    await expect(
      members.inviteMember(ctx.OWNER, { email: 'six@example.com' }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'PLAN_LIMIT_REACHED',
    });
  });

  it('sign-up through an invite joins that workspace verified, without creating a new one', async () => {
    const { org, ctx } = await createOrgWithRoles(['OWNER']);
    await members.inviteMember(ctx.OWNER, { email: 'fresh@example.com', role: 'MEMBER' });
    const token = tokenFromInvite();
    const before = await testDb.organization.count();
    await expect(
      auth.signUp(
        {
          name: 'Fresh',
          email: 'fresh@example.com',
          password: 'a-long-password',
          inviteToken: token,
        },
        { ip: '1.1.1.1' },
      ),
    ).resolves.toEqual({ status: 'joined', orgSlug: org.slug });
    expect(await testDb.organization.count()).toBe(before);
    const user = await testDb.user.findUniqueOrThrow({
      where: { email: 'fresh@example.com' },
      include: { memberships: true },
    });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.memberships).toMatchObject([{ organizationId: org.id, role: 'MEMBER' }]);

    await expect(
      auth.signUp(
        {
          name: 'X',
          email: 'someone@example.com',
          password: 'a-long-password',
          inviteToken: token,
        },
        { ip: '1.1.1.1' },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sign-up through an invite requires the invited email', async () => {
    const { ctx } = await createOrgWithRoles(['OWNER']);
    await members.inviteMember(ctx.OWNER, { email: 'right@example.com' });
    await expect(
      auth.signUp(
        {
          name: 'X',
          email: 'wrong@example.com',
          password: 'a-long-password',
          inviteToken: tokenFromInvite(),
        },
        { ip: '1.1.1.1' },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('roles and removal', () => {
  it('changes roles with an audit entry', async () => {
    const { org, ctx } = await createOrgWithRoles();
    const updated = await members.changeMemberRole(ctx.OWNER, ctx.MEMBER.membership.id, {
      role: 'ADMIN',
    });
    expect(updated.role).toBe('ADMIN');
    const log = await testDb.auditLog.findFirstOrThrow({
      where: { organizationId: org.id, action: 'member.role_changed' },
    });
    expect(log.metadata).toMatchObject({ from: 'MEMBER', to: 'ADMIN' });
  });

  it('cannot demote or remove the last OWNER', async () => {
    const { ctx } = await createOrgWithRoles();
    await expect(
      members.changeMemberRole(ctx.OWNER, ctx.OWNER.membership.id, { role: 'ADMIN' }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(members.removeMember(ctx.OWNER, ctx.OWNER.membership.id)).rejects.toMatchObject({
      status: 409,
    });

    // With a second owner, the first can step down.
    await members.changeMemberRole(ctx.OWNER, ctx.ADMIN.membership.id, { role: 'OWNER' });
    await expect(
      members.changeMemberRole(ctx.OWNER, ctx.OWNER.membership.id, { role: 'ADMIN' }),
    ).resolves.toMatchObject({
      role: 'ADMIN',
    });
  });

  it('ADMIN cannot promote to OWNER or touch an OWNER', async () => {
    const { ctx } = await createOrgWithRoles();
    await expect(
      members.changeMemberRole(ctx.ADMIN, ctx.MEMBER.membership.id, { role: 'OWNER' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      members.changeMemberRole(ctx.ADMIN, ctx.OWNER.membership.id, { role: 'VIEWER' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(members.removeMember(ctx.ADMIN, ctx.OWNER.membership.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      members.changeMemberRole(ctx.ADMIN, ctx.MEMBER.membership.id, { role: 'VIEWER' }),
    ).resolves.toBeDefined();
  });

  it('MEMBER cannot change roles or remove others, but can leave', async () => {
    const { org, ctx } = await createOrgWithRoles();
    await expect(
      members.changeMemberRole(ctx.MEMBER, ctx.VIEWER.membership.id, { role: 'MEMBER' }),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(members.removeMember(ctx.MEMBER, ctx.VIEWER.membership.id)).rejects.toMatchObject({
      status: 403,
    });
    await members.removeMember(ctx.MEMBER, ctx.MEMBER.membership.id);
    expect(await testDb.membership.count({ where: { organizationId: org.id } })).toBe(3);
    expect(await actions(org.id)).toContain('member.removed');
  });

  it('lists assignable members without viewers', async () => {
    const { ctx } = await createOrgWithRoles();
    const assignees = await members.listAssignees(ctx.VIEWER);
    expect(assignees).toHaveLength(3);
  });

  it('paginates members with a cursor', async () => {
    const { ctx } = await createOrgWithRoles();
    const first = await members.listMembers(ctx.OWNER, { limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();
    const second = await members.listMembers(ctx.OWNER, { limit: 3, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    await expect(members.listMembers(ctx.MEMBER, { limit: 3 })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('tenant isolation', () => {
  it('Org A users get 404 for Org B members and invites', async () => {
    const a = await createOrgWithRoles(['OWNER']);
    const b = await createOrgWithRoles(['OWNER', 'MEMBER']);
    const bInvite = await members.inviteMember(b.ctx.OWNER, { email: 'b-invitee@example.com' });

    await expect(
      members.changeMemberRole(a.ctx.OWNER, b.ctx.MEMBER.membership.id, { role: 'VIEWER' }),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      members.removeMember(a.ctx.OWNER, b.ctx.MEMBER.membership.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(members.revokeInvite(a.ctx.OWNER, bInvite.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(members.resendInvite(a.ctx.OWNER, bInvite.id)).rejects.toMatchObject({
      status: 404,
    });
    const list = await members.listMembers(a.ctx.OWNER, { limit: 50 });
    expect(list.items.map((m) => m.id)).toEqual([a.ctx.OWNER.membership.id]);
    expect(await testDb.membership.count({ where: { organizationId: b.org.id } })).toBe(2);
  });

  it('a user in both orgs only acts with the role of the org in context', async () => {
    const a = await createOrgWithRoles(['OWNER']);
    const b = await createOrgWithRoles(['OWNER']);
    await addMember(b.org.id, a.ctx.OWNER.user.id, 'VIEWER');
    const { resolveOrgContext } = await import('@/server/services/context');
    const ctxInB = await resolveOrgContext(a.ctx.OWNER.user, b.org.slug);
    expect(ctxInB.membership.role).toBe('VIEWER');
    await expect(members.inviteMember(ctxInB, { email: 'x@example.com' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('resolveOrgContext returns 404 for non-members and unknown slugs', async () => {
    const a = await createOrgWithRoles(['OWNER']);
    const b = await createOrgWithRoles(['OWNER']);
    const { resolveOrgContext } = await import('@/server/services/context');
    await expect(resolveOrgContext(a.ctx.OWNER.user, b.org.slug)).rejects.toMatchObject({
      status: 404,
    });
    await expect(resolveOrgContext(a.ctx.OWNER.user, 'does-not-exist')).rejects.toMatchObject({
      status: 404,
    });
  });
});
