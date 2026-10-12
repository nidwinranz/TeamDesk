import { noContent, ok, orgRoute, readJson } from '@/server/lib/api';
import { changeMemberRole, removeMember } from '@/server/services/members.service';

type Params = { orgSlug: string; memberId: string };

export const PATCH = orgRoute<Params>(async ({ req, ctx, params }) => {
  const member = await changeMemberRole(ctx, params.memberId, await readJson(req));
  return ok({ id: member.id, role: member.role, user: member.user });
});

export const DELETE = orgRoute<Params>(async ({ ctx, params }) => {
  await removeMember(ctx, params.memberId);
  return noContent();
});
