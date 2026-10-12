import { created, orgRoute, paged, readJson, searchParams } from '@/server/lib/api';
import { addComment, listComments } from '@/server/services/comments.service';

type Params = { orgSlug: string; requestId: string };

export const GET = orgRoute<Params>(async ({ req, ctx, params }) =>
  paged(await listComments(ctx, params.requestId, searchParams(req))),
);

export const POST = orgRoute<Params>(async ({ req, ctx, params }) =>
  created(await addComment(ctx, params.requestId, await readJson(req))),
);
