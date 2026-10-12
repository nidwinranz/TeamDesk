import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { CommentsThread } from '@/components/requests/comments-thread';
import { RequestEditor } from '@/components/requests/request-editor';
import { Separator } from '@/components/ui/separator';
import { toCommentDTO, toRequestDTO } from '@/server/lib/dto';
import { isAppError } from '@/server/lib/errors';
import { formatDateTime } from '@/lib/format';
import { can, ROLE_RANK } from '@/server/policies/permissions';
import { listComments } from '@/server/services/comments.service';
import { listAssignees } from '@/server/services/members.service';
import { getRequest } from '@/server/services/requests.service';
import { requireOrgPage } from '../../org-context';

export const metadata: Metadata = { title: 'Request' };

export default async function RequestPage({
  params,
}: {
  params: Promise<{ orgSlug: string; requestId: string }>;
}) {
  const { orgSlug, requestId } = await params;
  const ctx = await requireOrgPage(orgSlug);
  const request = await getRequest(ctx, requestId).catch((err: unknown) => {
    if (isAppError(err) && err.code === 'NOT_FOUND') notFound();
    throw err;
  });
  const [comments, assignees] = await Promise.all([
    listComments(ctx, requestId, { limit: '100' }),
    listAssignees(ctx),
  ]);
  const dto = toRequestDTO(request);

  return (
    <div className="grid max-w-3xl gap-6">
      <Link
        href={`/${ctx.org.slug}/projects/${request.project.id}`}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← {request.project.name}
      </Link>
      <PageHeader
        title={request.title}
        description={`Created ${formatDateTime(dto.createdAt)}${request.createdBy ? ` by ${request.createdBy.name ?? request.createdBy.email}` : ''}`}
      />
      <RequestEditor
        orgSlug={ctx.org.slug}
        request={dto}
        assignees={assignees}
        canEdit={can(ctx.membership, 'request:update')}
        canDelete={can(ctx.membership, 'request:delete')}
      />
      <Separator />
      <CommentsThread
        orgSlug={ctx.org.slug}
        requestId={request.id}
        initial={comments.items.map(toCommentDTO)}
        me={{ id: ctx.user.id, name: ctx.user.name, email: ctx.user.email }}
        canComment={can(ctx.membership, 'comment:create')}
        canModerate={ROLE_RANK[ctx.membership.role] >= ROLE_RANK.ADMIN}
      />
    </div>
  );
}
