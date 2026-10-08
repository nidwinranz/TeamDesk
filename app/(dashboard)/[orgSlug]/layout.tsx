import Link from 'next/link';
import { type NavItem, SidebarNav } from '@/components/dashboard/sidebar-nav';
import { UserMenu } from '@/components/dashboard/user-menu';
import { WorkspaceSwitcher } from '@/components/dashboard/workspace-switcher';
import { can } from '@/server/policies/permissions';
import { listMyOrganizations } from '@/server/services/organizations.service';
import { requireOrgPage } from './org-context';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requireOrgPage(orgSlug);
  const orgs = await listMyOrganizations(ctx.user.id);
  const base = `/${ctx.org.slug}`;

  const items: NavItem[] = [
    { key: 'overview', label: 'Overview', href: base },
    { key: 'projects', label: 'Projects', href: `${base}/projects` },
    { key: 'requests', label: 'Requests', href: `${base}/requests` },
    ...(can(ctx.membership, 'member:invite')
      ? [{ key: 'members', label: 'Members', href: `${base}/members` } as const]
      : []),
    ...(can(ctx.membership, 'billing:view')
      ? [{ key: 'billing', label: 'Billing', href: `${base}/billing` } as const]
      : []),
    ...(can(ctx.membership, 'audit:read')
      ? [{ key: 'audit', label: 'Audit log', href: `${base}/audit` } as const]
      : []),
    ...(can(ctx.membership, 'org:update')
      ? [{ key: 'settings', label: 'Settings', href: `${base}/settings` } as const]
      : []),
  ];

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <a
        href="#main"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:p-2"
      >
        Skip to content
      </a>
      <aside className="bg-muted/30 flex shrink-0 flex-col gap-4 border-b p-4 md:min-h-svh md:w-60 md:border-r md:border-b-0">
        <Link href={base} className="px-1 text-sm font-semibold tracking-tight">
          TeamDesk
        </Link>
        <WorkspaceSwitcher current={ctx.org} orgs={orgs} />
        <SidebarNav items={items} />
        <div className="mt-auto">
          <UserMenu name={ctx.user.name} email={ctx.user.email} role={ctx.membership.role} />
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
