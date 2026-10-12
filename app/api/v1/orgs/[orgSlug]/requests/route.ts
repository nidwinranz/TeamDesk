import { created, orgRoute, paged, readJson, searchParams } from '@/server/lib/api';
import { createRequest, listRequests } from '@/server/services/requests.service';

export const GET = orgRoute(async ({ req, ctx }) =>
  paged(await listRequests(ctx, searchParams(req))),
);

export const POST = orgRoute(async ({ req, ctx }) =>
  created(await createRequest(ctx, await readJson(req))),
);
