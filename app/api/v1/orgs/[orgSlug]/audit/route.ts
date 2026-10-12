import { orgRoute, paged, searchParams } from '@/server/lib/api';
import { listAuditLogs } from '@/server/services/audit.service';

export const GET = orgRoute(async ({ req, ctx }) =>
  paged(await listAuditLogs(ctx, searchParams(req))),
);
