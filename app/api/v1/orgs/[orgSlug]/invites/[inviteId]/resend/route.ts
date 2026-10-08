import { ok, orgRoute } from '@/server/lib/api';
import { resendInvite } from '@/server/services/members.service';

export const POST = orgRoute<{ orgSlug: string; inviteId: string }>(async ({ ctx, params }) =>
  ok(await resendInvite(ctx, params.inviteId)),
);
