import type { Metadata } from 'next';
import { Forbidden } from '@/components/dashboard/forbidden';
import { PageHeader } from '@/components/dashboard/page-header';
import { OrgSettingsForm } from '@/components/settings/org-settings-form';
import { can } from '@/server/policies/permissions';
import { requireOrgPage } from '../org-context';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrgPage(orgSlug);
  if (!can(ctx.membership, 'org:update')) return <Forbidden what="workspace settings" />;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Workspace name and URL. Only owners can change these."
      />
      <OrgSettingsForm org={ctx.org} />
    </div>
  );
}
