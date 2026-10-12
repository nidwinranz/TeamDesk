import { noContent, ok, orgRoute, readJson } from '@/server/lib/api';
import { deleteRequest, getRequest, updateRequest } from '@/server/services/requests.service';

type Params = { orgSlug: string; requestId: string };

export const GET = orgRoute<Params>(async ({ ctx, params }) =>
  ok(await getRequest(ctx, params.requestId)),
);

export const PATCH = orgRoute<Params>(async ({ req, ctx, params }) =>
  ok(await updateRequest(ctx, params.requestId, await readJson(req))),
);

export const DELETE = orgRoute<Params>(async ({ ctx, params }) => {
  await deleteRequest(ctx, params.requestId);
  return noContent();
});
