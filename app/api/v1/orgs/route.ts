import { created, ok, readJson, userRoute } from '@/server/lib/api';
import { createOrganization, listMyOrganizations } from '@/server/services/organizations.service';

export const GET = userRoute(async ({ user }) => ok(await listMyOrganizations(user.id)));

export const POST = userRoute(async ({ req, user }) => {
  const body = (await readJson(req)) as { name?: unknown } | null;
  const org = await createOrganization({ userId: user.id, name: body?.name });
  return created({ id: org.id, name: org.name, slug: org.slug, plan: org.plan });
});
