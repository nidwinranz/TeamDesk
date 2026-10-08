import 'server-only';
import type { Role } from '@prisma/client';
import { changeRoleSchema, inviteSchema } from '@/lib/schemas/members';
import { tokenSchema } from '@/lib/schemas/auth';
import { limitFor, isWithinLimit } from '@/server/config/plans';
import { generateToken, hashToken } from '@/server/lib/crypto';
import { inviteTemplate } from '@/server/lib/email-templates';
import { env } from '@/server/lib/env';
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  planLimitReached,
} from '@/server/lib/errors';
import { sendEmail } from '@/server/lib/mailer';
import type { PageQuery } from '@/server/lib/pagination';
import { parse } from '@/server/lib/validation';
import { ROLE_RANK } from '@/server/policies/permissions';
import { appendAuditLog } from '@/server/repos/audit.repo';
import * as invites from '@/server/repos/invites.repo';
import * as memberships from '@/server/repos/memberships.repo';
import { transaction, type Tx } from '@/server/repos/transaction';
import { findUserByEmail } from '@/server/repos/users.repo';
import { assertCan, type OrgContext, type SessionUser } from './context';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

const inviteUrl = (token: string) => `${env.APP_URL}/invite/${token}`;

/** Members + pending invites count against the plan's seat limit. */
async function assertSeatAvailable(ctx: OrgContext, db?: Tx) {
  const [members, pending] = await Promise.all([
    memberships.countMembers(ctx.org.id, db),
    invites.countPendingInvites(ctx.org.id, db),
  ]);
  if (!isWithinLimit(ctx.org.plan, 'members', members + pending)) {
    throw planLimitReached(
      `The ${ctx.org.plan} plan includes up to ${limitFor(ctx.org.plan, 'members')} members. Upgrade to add more.`,
      {
        limit: 'members',
        plan: ctx.org.plan,
      },
    );
  }
}

/** Nobody can grant a role above their own; only OWNERs grant OWNER. */
function assertCanGrant(ctx: OrgContext, role: Role) {
  if (ROLE_RANK[role] > ROLE_RANK[ctx.membership.role])
    throw forbidden('You cannot grant a role higher than your own');
}

export async function listMembers(ctx: OrgContext, page: PageQuery) {
  assertCan(ctx, 'member:invite');
  return memberships.listMembers(ctx.org.id, page);
}

export async function listPendingInvites(ctx: OrgContext) {
  assertCan(ctx, 'member:invite');
  return invites.listPendingInvites(ctx.org.id);
}

/** Members that can be assigned to requests; visible to anyone who can edit requests. */
export async function listAssignees(ctx: OrgContext) {
  assertCan(ctx, 'request:read');
  const rows = await memberships.listAssignableMembers(ctx.org.id);
  return rows.map((m) => m.user);
}

export async function inviteMember(ctx: OrgContext, input: unknown) {
  assertCan(ctx, 'member:invite');
  const { email, role } = parse(inviteSchema, input);
  assertCanGrant(ctx, role);

  const existingUser = await findUserByEmail(email);
  if (existingUser && (await memberships.findMembership(ctx.org.id, existingUser.id))) {
    throw conflict('That person is already a member of this workspace');
  }
  if (await invites.findPendingInviteByEmail(ctx.org.id, email)) {
    throw conflict('An invite is already pending for that email. Resend it instead.');
  }
  await assertSeatAvailable(ctx);

  const token = generateToken();
  const invite = await transaction(async (tx) => {
    const created = await invites.createInvite(
      {
        orgId: ctx.org.id,
        email,
        role,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        invitedById: ctx.user.id,
      },
      tx,
    );
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'invite.sent',
        targetType: 'invite',
        targetId: created.id,
        metadata: { email, role },
      },
      tx,
    );
    return created;
  });
  await sendEmail(
    inviteTemplate(email, ctx.org.name, ctx.user.name ?? ctx.user.email, role, inviteUrl(token)),
  );
  return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
}

export async function resendInvite(ctx: OrgContext, inviteId: string) {
  assertCan(ctx, 'member:invite');
  const invite = await invites.findInvite(ctx.org.id, inviteId);
  if (!invite || invite.acceptedAt || invite.revokedAt) throw notFound('Invite');
  const token = generateToken();
  const updated = await transaction(async (tx) => {
    const rotated = await invites.rotateInviteToken(
      ctx.org.id,
      invite.id,
      hashToken(token),
      new Date(Date.now() + INVITE_TTL_MS),
      tx,
    );
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'invite.resent',
        targetType: 'invite',
        targetId: invite.id,
        metadata: { email: invite.email },
      },
      tx,
    );
    return rotated;
  });
  await sendEmail(
    inviteTemplate(
      invite.email,
      ctx.org.name,
      ctx.user.name ?? ctx.user.email,
      invite.role,
      inviteUrl(token),
    ),
  );
  return { id: updated.id, expiresAt: updated.expiresAt };
}

export async function revokeInvite(ctx: OrgContext, inviteId: string) {
  assertCan(ctx, 'member:invite');
  const invite = await invites.findInvite(ctx.org.id, inviteId);
  if (!invite || invite.acceptedAt || invite.revokedAt) throw notFound('Invite');
  await transaction(async (tx) => {
    await invites.revokeInvite(ctx.org.id, invite.id, tx);
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'invite.revoked',
        targetType: 'invite',
        targetId: invite.id,
        metadata: { email: invite.email },
      },
      tx,
    );
  });
}

export type InviteStatus = 'valid' | 'expired' | 'revoked' | 'accepted';

/** Public preview for the accept page. Unknown tokens are a 404. */
export async function getInvitePreview(token: unknown) {
  const raw = parse(tokenSchema, token);
  const invite = await invites.findInviteByTokenHashUnscoped(hashToken(raw));
  if (!invite) throw notFound('Invite');
  const status: InviteStatus = invite.acceptedAt
    ? 'accepted'
    : invite.revokedAt
      ? 'revoked'
      : invite.expiresAt <= new Date()
        ? 'expired'
        : 'valid';
  return {
    status,
    email: invite.email,
    role: invite.role,
    org: invite.organization,
    invitedBy: invite.invitedBy?.name ?? invite.invitedBy?.email ?? null,
  };
}

/**
 * Accepts an invite for the signed-in user. The user's email must match the
 * invited address so a forwarded link cannot be used by someone else.
 */
export async function acceptInvite(user: SessionUser, token: unknown, db?: Tx) {
  const raw = parse(tokenSchema, token);
  const invite = await invites.findInviteByTokenHashUnscoped(hashToken(raw));
  if (!invite) throw notFound('Invite');
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError(
      'FORBIDDEN',
      `This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
    );
  }
  const orgId = invite.organizationId;

  const run = async (tx: Tx) => {
    const existing = await memberships.findMembership(orgId, user.id, tx);
    if (existing) {
      await invites.markInviteAccepted(orgId, invite.id, tx);
      return invite.organization;
    }
    if (!(await invites.markInviteAccepted(orgId, invite.id, tx))) {
      throw badRequest('This invite has expired, been revoked or already been used');
    }
    const membership = await memberships.createMembership(
      { orgId, userId: user.id, role: invite.role },
      tx,
    );
    await appendAuditLog(
      {
        orgId,
        actorId: user.id,
        action: 'invite.accepted',
        targetType: 'membership',
        targetId: membership.id,
        metadata: { email: invite.email, role: invite.role },
      },
      tx,
    );
    return invite.organization;
  };
  return db ? run(db) : transaction(run);
}

export async function changeMemberRole(ctx: OrgContext, membershipId: string, input: unknown) {
  assertCan(ctx, 'member:role');
  const { role } = parse(changeRoleSchema, input);
  return transaction(
    async (tx) => {
      const target = await memberships.findMembershipById(ctx.org.id, membershipId, tx);
      if (!target) throw notFound('Member');
      if (target.role === role) return target;
      // Changing an OWNER, or granting OWNER, is reserved for OWNERs.
      assertCanGrant(ctx, role);
      if (ROLE_RANK[target.role] > ROLE_RANK[ctx.membership.role])
        throw forbidden('You cannot change the role of an owner');
      if (target.role === 'OWNER' && (await memberships.countOwners(ctx.org.id, tx)) <= 1) {
        throw conflict('A workspace must keep at least one owner. Promote someone else first.');
      }
      const updated = await memberships.updateMembershipRole(ctx.org.id, membershipId, role, tx);
      await appendAuditLog(
        {
          orgId: ctx.org.id,
          actorId: ctx.user.id,
          action: 'member.role_changed',
          targetType: 'membership',
          targetId: membershipId,
          metadata: {
            userId: target.userId,
            email: target.user.email,
            from: target.role,
            to: role,
          },
        },
        tx,
      );
      return updated;
    },
    { isolationLevel: 'Serializable' },
  );
}

/** Removes a member. Anyone may leave a workspace themselves; removing others needs `member:remove`. */
export async function removeMember(ctx: OrgContext, membershipId: string) {
  const isSelf = membershipId === ctx.membership.id;
  if (!isSelf) assertCan(ctx, 'member:remove');
  await transaction(
    async (tx) => {
      const target = await memberships.findMembershipById(ctx.org.id, membershipId, tx);
      if (!target) throw notFound('Member');
      if (!isSelf && ROLE_RANK[target.role] > ROLE_RANK[ctx.membership.role])
        throw forbidden('You cannot remove an owner');
      if (target.role === 'OWNER' && (await memberships.countOwners(ctx.org.id, tx)) <= 1) {
        throw conflict('A workspace must keep at least one owner.');
      }
      await memberships.deleteMembership(ctx.org.id, membershipId, tx);
      await appendAuditLog(
        {
          orgId: ctx.org.id,
          actorId: ctx.user.id,
          action: 'member.removed',
          targetType: 'membership',
          targetId: membershipId,
          metadata: {
            userId: target.userId,
            email: target.user.email,
            role: target.role,
            self: isSelf,
          },
        },
        tx,
      );
    },
    { isolationLevel: 'Serializable' },
  );
}
