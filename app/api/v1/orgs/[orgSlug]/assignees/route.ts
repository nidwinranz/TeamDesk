import { ok, orgRoute } from '@/server/lib/api';
import { listAssignees } from '@/server/services/members.service';

export const GET = orgRoute(async ({ ctx }) => ok(await listAssignees(ctx)));
