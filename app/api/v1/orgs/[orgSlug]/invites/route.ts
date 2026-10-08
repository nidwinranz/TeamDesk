import { created, ok, orgRoute, readJson } from '@/server/lib/api';
import { inviteMember, listPendingInvites } from '@/server/services/members.service';

export const GET = orgRoute(async ({ ctx }) => {
  const invites = await listPendingInvites(ctx);
  return ok(
    invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt,
      invitedBy: i.invitedBy,
    })),
  );
});

export const POST = orgRoute(async ({ req, ctx }) =>
  created(await inviteMember(ctx, await readJson(req))),
);
