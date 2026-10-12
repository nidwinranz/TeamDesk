import type { Metadata } from 'next';
import { ResendVerification } from '@/components/auth/resend-verification';
import { VerifyForm } from '@/components/auth/verify-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Verify email' };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token, email } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{token ? 'Confirm your email' : 'Check your inbox'}</h1>
        </CardTitle>
        <CardDescription>
          {token
            ? 'One click and you are in.'
            : 'We sent you a verification link. It expires in 24 hours.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {token ? <VerifyForm token={token} /> : <ResendVerification defaultEmail={email} />}
      </CardContent>
    </Card>
  );
}
