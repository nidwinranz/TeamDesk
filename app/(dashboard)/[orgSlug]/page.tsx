import type { Metadata } from 'next';
import { PageHeader } from '@/components/dashboard/page-header';
import { requireOrgPage } from './org-context';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrgPage(orgSlug);
  return (
    <PageHeader
      title={ctx.org.name}
      description={`You are signed in as ${ctx.membership.role.toLowerCase()}.`}
    />
  );
}
