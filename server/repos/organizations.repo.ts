import type { Plan, Role } from '@prisma/client';
import { prisma, type Tx } from '@/server/lib/prisma';

export function findOrgBySlug(slug: string) {
  return prisma.organization.findUnique({ where: { slug } });
}

export function findOrgById(id: string, db: Tx = prisma) {
  return db.organization.findUnique({ where: { id } });
}

export function findOrgByStripeCustomerId(stripeCustomerId: string, db: Tx = prisma) {
  return db.organization.findUnique({ where: { stripeCustomerId } });
}

export async function slugExists(slug: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  return org !== null;
}

export function createOrganizationWithOwner(
  data: { name: string; slug: string; ownerId: string; ownerRole?: Role },
  db: Tx = prisma,
) {
  return db.organization.create({
    data: {
      name: data.name,
      slug: data.slug,
      memberships: { create: { userId: data.ownerId, role: data.ownerRole ?? 'OWNER' } },
    },
  });
}

export function updateOrganization(
  id: string,
  data: { name?: string; slug?: string },
  db: Tx = prisma,
) {
  return db.organization.update({ where: { id }, data });
}

export function setOrganizationPlan(id: string, plan: Plan, db: Tx = prisma) {
  return db.organization.update({ where: { id }, data: { plan } });
}

export function setStripeCustomerId(id: string, stripeCustomerId: string, db: Tx = prisma) {
  return db.organization.update({ where: { id }, data: { stripeCustomerId } });
}
