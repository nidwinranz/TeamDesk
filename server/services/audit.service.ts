import 'server-only';
import { z } from 'zod';
import { pageQuerySchema } from '@/server/lib/pagination';
import { parse } from '@/server/lib/validation';
import { listAuditLogs as listAuditLogsRepo } from '@/server/repos/audit.repo';
import { AUDIT_ACTIONS } from './audit-actions';
import { assertCan, type OrgContext } from './context';

const filterSchema = z.object({ action: z.enum(AUDIT_ACTIONS).optional() });

export async function listAuditLogs(ctx: OrgContext, query: Record<string, unknown>) {
  assertCan(ctx, 'audit:read');
  const page = parse(pageQuerySchema, query);
  const filter = parse(filterSchema, { action: query.action || undefined });
  return listAuditLogsRepo(ctx.org.id, page, filter);
}
