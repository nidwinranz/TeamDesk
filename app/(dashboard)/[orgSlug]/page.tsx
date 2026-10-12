import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_LABEL, type Status } from '@/lib/format';
import { getRequestSummary } from '@/server/services/requests.service';
import { requireOrgPage } from './org-context';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrgPage(orgSlug);
  const summary = await getRequestSummary(ctx);
  const statuses = Object.keys(STATUS_LABEL) as Status[];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={ctx.org.name}
        description={`You are signed in as ${ctx.membership.role.toLowerCase()}.`}
      />
      <section aria-labelledby="summary-heading" className="grid gap-3">
        <h2 id="summary-heading" className="font-medium">
          Requests in active projects
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statuses.map((s) => (
            <li key={s}>
              <Link
                href={`/${ctx.org.slug}/requests?status=${s}`}
                className="focus-visible:ring-ring/50 block rounded-xl focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <Card className="hover:bg-accent/40 gap-2 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-muted-foreground text-sm font-normal">
                      {STATUS_LABEL[s]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-semibold tabular-nums">
                    {summary[s] ?? 0}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
