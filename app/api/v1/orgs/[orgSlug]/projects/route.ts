import { created, ok, orgRoute, readJson, searchParams } from '@/server/lib/api';
import { createProject, listProjects } from '@/server/services/projects.service';

export const GET = orgRoute(async ({ req, ctx }) => ok(await listProjects(ctx, searchParams(req))));

export const POST = orgRoute(async ({ req, ctx }) =>
  created(await createProject(ctx, await readJson(req))),
);
