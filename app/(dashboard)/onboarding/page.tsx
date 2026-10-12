import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateOrgForm } from '@/components/dashboard/create-org-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/server/services/session';

export const metadata: Metadata = { title: 'New workspace' };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/onboarding');
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Create a workspace</h1>
          </CardTitle>
          <CardDescription>A workspace holds your projects, requests and team.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </main>
  );
}
