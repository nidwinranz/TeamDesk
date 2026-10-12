import { orgRoute, paged, searchParams } from '@/server/lib/api';
import { pageQuerySchema } from '@/server/lib/pagination';
import { parse } from '@/server/lib/validation';
import { listMembers } from '@/server/services/members.service';

export const GET = orgRoute(async ({ req, ctx }) => {
  const page = parse(pageQuerySchema, searchParams(req));
  return paged(await listMembers(ctx, page));
});
