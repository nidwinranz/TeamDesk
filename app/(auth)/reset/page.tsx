import type { Metadata } from 'next';
import { RequestResetForm, ResetPasswordForm } from '@/components/auth/reset-forms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{token ? 'Choose a new password' : 'Reset your password'}</h1>
        </CardTitle>
        <CardDescription>
          {token
            ? 'This signs you out on every other device.'
            : 'We will email you a link that is valid for 1 hour.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}
      </CardContent>
    </Card>
  );
}
