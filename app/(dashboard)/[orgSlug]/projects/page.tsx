import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/dashboard/page-header';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { limitFor } from '@/server/config/plans';
import { can } from '@/server/policies/permissions';
import { listProjects } from '@/server/services/projects.service';
import { requireOrgPage } from '../org-context';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  const [{ orgSlug }, { archived }] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgPage(orgSlug);
  const showArchived = archived === 'true';
  const projects = await listProjects(ctx, { archived: showArchived ? 'true' : 'false' });
  const canCreate = can(ctx.membership, 'project:create');
  const limit = limitFor(ctx.org.plan, 'projects');
  const base = `/${ctx.org.slug}/projects`;

  const newButton = canCreate ? (
    <ProjectFormDialog
      orgSlug={ctx.org.slug}
      trigger={
        <Button>
          <Plus aria-hidden /> New project
        </Button>
      }
    />
  ) : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Projects"
        description={
          !showArchived && limit !== null
            ? `${projects.length} of ${limit} active projects on the free plan`
            : undefined
        }
        actions={newButton}
      />
      <nav aria-label="Project filter" className="flex gap-2 text-sm">
        <Link
          href={base}
          aria-current={!showArchived ? 'page' : undefined}
          className={
            !showArchived ? 'font-medium underline underline-offset-4' : 'text-muted-foreground'
          }
        >
          Active
        </Link>
        <Link
          href={`${base}?archived=true`}
          aria-current={showArchived ? 'page' : undefined}
          className={
            showArchived ? 'font-medium underline underline-offset-4' : 'text-muted-foreground'
          }
        >
          Archived
        </Link>
      </nav>
      {projects.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No archived projects' : 'No projects yet'}
          description={
            showArchived ? undefined : 'Create a project to start tracking client requests.'
          }
          action={showArchived ? undefined : newButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`${base}/${p.id}`}
                prefetch={false}
                className="focus-visible:ring-ring/50 block rounded-xl focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <Card className="hover:bg-accent/40 h-full transition-colors">
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {p.description || 'No description'}
                    </CardDescription>
                    <p className="text-muted-foreground text-xs">{p.openRequests} open requests</p>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
