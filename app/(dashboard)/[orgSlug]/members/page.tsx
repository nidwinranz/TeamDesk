import type { Metadata } from 'next';
import { Forbidden } from '@/components/dashboard/forbidden';
import { PageHeader } from '@/components/dashboard/page-header';
import { InviteForm } from '@/components/members/invite-form';
import { MembersTable } from '@/components/members/members-table';
import { PendingInvites } from '@/components/members/pending-invites';
import { limitFor } from '@/server/config/plans';
import { can, ROLE_RANK } from '@/server/policies/permissions';
import { listMembers, listPendingInvites } from '@/server/services/members.service';
import { requireOrgPage } from '../org-context';

export const metadata: Metadata = { title: 'Members' };

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;

export default async function MembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrgPage(orgSlug);
  if (!can(ctx.membership, 'member:invite')) return <Forbidden what="members" />;

  const [members, invites] = await Promise.all([
    listMembers(ctx, { limit: 100 }),
    listPendingInvites(ctx),
  ]);
  const grantable = ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[ctx.membership.role]);
  const limit = limitFor(ctx.org.plan, 'members');
  const used = members.items.length + invites.length;

  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader
        title="Members"
        description={
          limit === null
            ? `${used} seats used`
            : `${used} of ${limit} seats used on the ${ctx.org.plan.toLowerCase()} plan`
        }
      />
      <InviteForm orgSlug={ctx.org.slug} grantableRoles={grantable} />
      <section aria-labelledby="pending-heading" className="grid gap-3">
        <h2 id="pending-heading" className="font-medium">
          Pending invites
        </h2>
        <PendingInvites
          orgSlug={ctx.org.slug}
          invites={invites.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            expiresAt: i.expiresAt.toISOString(),
          }))}
        />
      </section>
      <section aria-labelledby="members-heading" className="grid gap-3">
        <h2 id="members-heading" className="font-medium">
          Current members
        </h2>
        <MembersTable
          orgSlug={ctx.org.slug}
          members={members.items.map((m) => ({ id: m.id, role: m.role, user: m.user }))}
          currentMembershipId={ctx.membership.id}
          canChangeRole={can(ctx.membership, 'member:role')}
          canRemove={can(ctx.membership, 'member:remove')}
          grantableRoles={grantable}
        />
      </section>
    </div>
  );
}
