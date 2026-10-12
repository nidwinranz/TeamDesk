import 'server-only';
import { orgNameSchema } from '@/lib/schemas/auth';
import { slugSchema } from '@/lib/schemas/common';
import { conflict, validationFailed } from '@/server/lib/errors';
import { isReservedSlug, slugify, withSuffix } from '@/server/lib/slug';
import { parse } from '@/server/lib/validation';
import { z } from 'zod';
import { appendAuditLog } from '@/server/repos/audit.repo';
import { listMembershipsForUserUnscoped } from '@/server/repos/memberships.repo';
import * as orgs from '@/server/repos/organizations.repo';
import { transaction, type Tx } from '@/server/repos/transaction';
import { assertCan, type OrgContext } from './context';

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  if (!isReservedSlug(base) && !(await orgs.slugExists(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = withSuffix(base);
    if (!(await orgs.slugExists(candidate))) return candidate;
  }
  throw conflict('Could not generate a unique workspace URL, try another name');
}

/** Creates a workspace with the caller as OWNER. Used at sign-up and from onboarding. */
export async function createOrganization(input: { userId: string; name: unknown }, db?: Tx) {
  const name = parse(orgNameSchema, input.name);
  const slug = await uniqueSlug(name);
  const run = async (tx: Tx) => {
    const org = await orgs.createOrganizationWithOwner({ name, slug, ownerId: input.userId }, tx);
    await appendAuditLog(
      {
        orgId: org.id,
        actorId: input.userId,
        action: 'org.created',
        targetType: 'organization',
        targetId: org.id,
        metadata: { name, slug },
      },
      tx,
    );
    return org;
  };
  return db ? run(db) : transaction(run);
}

/** Workspaces the user belongs to, for the switcher and post-login redirect. */
export async function listMyOrganizations(userId: string) {
  const memberships = await listMembershipsForUserUnscoped(userId);
  return memberships.map((m) => ({ ...m.organization, role: m.role }));
}

const updateOrgSchema = z.object({ name: orgNameSchema.optional(), slug: slugSchema.optional() });

export async function updateOrganization(ctx: OrgContext, input: unknown) {
  assertCan(ctx, 'org:update');
  const data = parse(updateOrgSchema, input);
  if (data.slug && data.slug !== ctx.org.slug) {
    if (isReservedSlug(data.slug))
      throw validationFailed('That URL is reserved', { fieldErrors: { slug: ['Reserved'] } });
    if (await orgs.slugExists(data.slug)) throw conflict('That workspace URL is taken');
  }
  return transaction(async (tx) => {
    const org = await orgs.updateOrganization(ctx.org.id, data, tx);
    await appendAuditLog(
      {
        orgId: ctx.org.id,
        actorId: ctx.user.id,
        action: 'org.updated',
        targetType: 'organization',
        targetId: ctx.org.id,
        metadata: data,
      },
      tx,
    );
    return org;
  });
}
