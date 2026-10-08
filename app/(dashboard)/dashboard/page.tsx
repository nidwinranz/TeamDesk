import { redirect } from 'next/navigation';
import { listMyOrganizations } from '@/server/services/organizations.service';
import { getCurrentUser } from '@/server/services/session';

/** Post-login landing: go to the first workspace, or create one. */
export default async function DashboardRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const orgs = await listMyOrganizations(user.id);
  redirect(orgs[0] ? `/${orgs[0].slug}` : '/onboarding');
}
