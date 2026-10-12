import { ok, orgRoute, readJson } from '@/server/lib/api';
import { updateOrganization } from '@/server/services/organizations.service';

export const GET = orgRoute(({ ctx }) =>
  Promise.resolve(ok({ ...ctx.org, role: ctx.membership.role })),
);

export const PATCH = orgRoute(async ({ req, ctx }) => {
  const org = await updateOrganization(ctx, await readJson(req));
  return ok({ id: org.id, name: org.name, slug: org.slug, plan: org.plan });
});
