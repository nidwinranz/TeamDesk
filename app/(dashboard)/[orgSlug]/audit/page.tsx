import type { Metadata } from 'next';
import { AuditTable } from '@/components/audit/audit-table';
import { Forbidden } from '@/components/dashboard/forbidden';
import { PageHeader } from '@/components/dashboard/page-header';
import { can } from '@/server/policies/permissions';
import { AUDIT_ACTIONS } from '@/server/services/audit-actions';
import { listAuditLogs } from '@/server/services/audit.service';
import { requireOrgPage } from '../org-context';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const [{ orgSlug }, { action }] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgPage(orgSlug);
  if (!can(ctx.membership, 'audit:read')) return <Forbidden what="the audit log" />;
  const valid =
    action && (AUDIT_ACTIONS as readonly string[]).includes(action) ? action : undefined;
  const page = await listAuditLogs(ctx, { limit: '50', ...(valid ? { action: valid } : {}) });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Audit log"
        description="Append-only record of security-relevant changes in this workspace."
      />
      <AuditTable
        orgSlug={ctx.org.slug}
        actions={AUDIT_ACTIONS}
        initial={page.items.map((r) => ({
          id: r.id,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          metadata: r.metadata,
          createdAt: r.createdAt.toISOString(),
          actor: r.actor ? { name: r.actor.name, email: r.actor.email } : null,
        }))}
        initialCursor={page.nextCursor}
      />
    </div>
  );
}
