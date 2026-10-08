import { ok, userRoute } from '@/server/lib/api';
import { acceptInvite } from '@/server/services/members.service';

export const POST = userRoute<{ token: string }>(async ({ user, params }) => {
  const org = await acceptInvite(user, params.token);
  return ok({ org });
});
