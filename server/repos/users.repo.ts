import { prisma, type Tx } from '@/server/lib/prisma';

export const publicUserSelect = { id: true, email: true, name: true, image: true } as const;

export function findUserByEmail(email: string, db: Tx = prisma) {
  return db.user.findUnique({ where: { email: email.toLowerCase() } });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(
  data: {
    email: string;
    name?: string | null;
    passwordHash?: string | null;
    emailVerifiedAt?: Date | null;
    image?: string | null;
  },
  db: Tx = prisma,
) {
  return db.user.create({ data: { ...data, email: data.email.toLowerCase() } });
}

export function markEmailVerified(userId: string, db: Tx = prisma) {
  return db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

/** Sets a new password and bumps sessionVersion so existing sessions are invalidated. */
export function updatePassword(userId: string, passwordHash: string, db: Tx = prisma) {
  return db.user.update({
    where: { id: userId },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
}

export function updateUserProfile(
  userId: string,
  data: { name?: string; image?: string | null },
  db: Tx = prisma,
) {
  return db.user.update({ where: { id: userId }, data });
}

export function findAccount(provider: string, providerAccountId: string) {
  return prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
}

export function linkAccount(
  userId: string,
  provider: string,
  providerAccountId: string,
  db: Tx = prisma,
) {
  return db.account.create({ data: { userId, provider, providerAccountId } });
}
