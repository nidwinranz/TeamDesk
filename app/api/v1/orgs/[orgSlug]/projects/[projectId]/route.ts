import { ok, orgRoute, readJson } from '@/server/lib/api';
import { getProject, updateProject } from '@/server/services/projects.service';

type Params = { orgSlug: string; projectId: string };

export const GET = orgRoute<Params>(async ({ ctx, params }) =>
  ok(await getProject(ctx, params.projectId)),
);

export const PATCH = orgRoute<Params>(async ({ req, ctx, params }) =>
  ok(await updateProject(ctx, params.projectId, await readJson(req))),
);
