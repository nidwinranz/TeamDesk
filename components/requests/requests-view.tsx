import 'server-only';
import { EmptyState } from '@/components/dashboard/empty-state';
import { toRequestDTO } from '@/server/lib/dto';
import { can } from '@/server/policies/permissions';
import type { OrgContext } from '@/server/services/context';
import { listAssignees } from '@/server/services/members.service';
import { listProjectOptions } from '@/server/services/projects.service';
import { listRequests } from '@/server/services/requests.service';
import { RequestFilters } from './request-filters';
import { RequestFormDialog } from './request-form-dialog';
import { RequestsTable } from './requests-table';

const FILTER_KEYS = ['projectId', 'status', 'priority', 'assignee', 'q', 'sort', 'order'] as const;

/** Server-rendered first page + client-side "load more" and inline edits. Shared by /requests and project pages. */
export async function RequestsView({
  ctx,
  searchParams,
  projectId,
}: {
  ctx: OrgContext;
  searchParams: Record<string, string | undefined>;
  projectId?: string;
}) {
  const query: Record<string, string> = {};
  for (const k of FILTER_KEYS) {
    const v = searchParams[k];
    if (v) query[k] = v;
  }
  if (projectId) query.projectId = projectId;

  const [page, assignees, projects] = await Promise.all([
    listRequests(ctx, { ...query, limit: '25' }),
    listAssignees(ctx),
    listProjectOptions(ctx),
  ]);
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    archived: p.archivedAt !== null,
  }));
  const canCreate = can(ctx.membership, 'request:create');
  const filtered = FILTER_KEYS.some((k) => k !== 'sort' && k !== 'order' && searchParams[k]);
  const qs = new URLSearchParams({ ...query, limit: '25' }).toString();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <RequestFilters projects={projectId ? undefined : projectOptions} assignees={assignees} />
        </div>
        {canCreate && (
          <RequestFormDialog
            orgSlug={ctx.org.slug}
            projects={projectOptions}
            assignees={assignees}
            defaultProjectId={projectId}
          />
        )}
      </div>
      {page.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No requests match these filters' : 'No requests yet'}
          description={
            filtered
              ? 'Try clearing a filter.'
              : canCreate
                ? 'Create the first request for this workspace.'
                : undefined
          }
        />
      ) : (
        <RequestsTable
          orgSlug={ctx.org.slug}
          initial={page.items.map(toRequestDTO)}
          initialCursor={page.nextCursor}
          query={qs}
          canEdit={can(ctx.membership, 'request:update')}
          showProject={!projectId}
        />
      )}
    </div>
  );
}
