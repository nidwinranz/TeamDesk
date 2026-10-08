import type { Metadata } from 'next';
import { PageHeader } from '@/components/dashboard/page-header';
import { RequestsView } from '@/components/requests/requests-view';
import { requireOrgPage } from '../org-context';

export const metadata: Metadata = { title: 'Requests' };

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ orgSlug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgPage(orgSlug);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Requests"
        description="Everything your clients have asked for, across projects."
      />
      <RequestsView ctx={ctx} searchParams={sp} />
    </div>
  );
}
