import { noContent, orgRoute } from '@/server/lib/api';
import { revokeInvite } from '@/server/services/members.service';

export const DELETE = orgRoute<{ orgSlug: string; inviteId: string }>(async ({ ctx, params }) => {
  await revokeInvite(ctx, params.inviteId);
  return noContent();
});
