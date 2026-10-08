import { Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { ArchiveButton } from '@/components/projects/archive-button';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { RequestsView } from '@/components/requests/requests-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isAppError } from '@/server/lib/errors';
import { can } from '@/server/policies/permissions';
import { getProject } from '@/server/services/projects.service';
import { requireOrgPage } from '../../org-context';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ orgSlug, projectId }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgPage(orgSlug);
  const project = await getProject(ctx, projectId).catch((err: unknown) => {
    if (isAppError(err) && err.code === 'NOT_FOUND') notFound();
    throw err;
  });
  const archived = project.archivedAt !== null;

  return (
    <div className="grid gap-6">
      <Link
        href={`/${ctx.org.slug}/projects`}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← All projects
      </Link>
      <PageHeader
        title={project.name}
        description={project.description || undefined}
        actions={
          <>
            {can(ctx.membership, 'project:update') && (
              <ProjectFormDialog
                orgSlug={ctx.org.slug}
                project={project}
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden /> Edit
                  </Button>
                }
              />
            )}
            {can(ctx.membership, 'project:archive') && (
              <ArchiveButton orgSlug={ctx.org.slug} projectId={project.id} archived={archived} />
            )}
          </>
        }
      />
      {archived && (
        <Alert>
          <AlertDescription>
            This project is archived. New requests cannot be added until it is unarchived.
          </AlertDescription>
        </Alert>
      )}
      <RequestsView ctx={ctx} searchParams={sp} projectId={project.id} />
    </div>
  );
}
