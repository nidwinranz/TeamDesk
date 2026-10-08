import type { Role } from '@prisma/client';
import { prisma, systemPrisma, type Tx } from '@/server/lib/prisma';

const pending = (orgId: string) => ({
  organizationId: orgId,
  acceptedAt: null,
  revokedAt: null,
  expiresAt: { gt: new Date() },
});

export function createInvite(
  data: {
    orgId: string;
    email: string;
    role: Role;
    tokenHash: string;
    expiresAt: Date;
    invitedById: string;
  },
  db: Tx = prisma,
) {
  return db.invite.create({
    data: {
      organizationId: data.orgId,
      email: data.email,
      role: data.role,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      invitedById: data.invitedById,
    },
  });
}

export function findInvite(orgId: string, inviteId: string, db: Tx = prisma) {
  return db.invite.findUnique({ where: { id: inviteId, organizationId: orgId } });
}

export function findPendingInviteByEmail(orgId: string, email: string, db: Tx = prisma) {
  return db.invite.findFirst({ where: { ...pending(orgId), email } });
}

/** Cross-tenant by design: the token is the only thing the invitee has. */
export function findInviteByTokenHashUnscoped(tokenHash: string) {
  return systemPrisma.invite.findUnique({
    where: { tokenHash },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
}

export function listPendingInvites(orgId: string) {
  return prisma.invite.findMany({
    where: pending(orgId),
    include: { invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export function countPendingInvites(orgId: string, db: Tx = prisma) {
  return db.invite.count({ where: pending(orgId) });
}

export function revokeInvite(orgId: string, inviteId: string, db: Tx = prisma) {
  return db.invite.update({
    where: { id: inviteId, organizationId: orgId },
    data: { revokedAt: new Date() },
  });
}

/** Rotates the token (resend): the old link stops working. */
export function rotateInviteToken(
  orgId: string,
  inviteId: string,
  tokenHash: string,
  expiresAt: Date,
  db: Tx = prisma,
) {
  return db.invite.update({
    where: { id: inviteId, organizationId: orgId },
    data: { tokenHash, expiresAt },
  });
}

/** Single use, enforced in SQL: only an unaccepted, unrevoked, unexpired invite can be claimed. */
export async function markInviteAccepted(orgId: string, inviteId: string, db: Tx = prisma) {
  const { count } = await db.invite.updateMany({
    where: { id: inviteId, ...pending(orgId) },
    data: { acceptedAt: new Date() },
  });
  return count === 1;
}
