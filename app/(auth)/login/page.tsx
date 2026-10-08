import type { Metadata } from 'next';
import Link from 'next/link';
import { GoogleButton } from '@/components/auth/google-button';
import { LoginForm } from '@/components/auth/login-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { googleEnabled } from '@/server/auth';
import { env } from '@/server/lib/env';
import { DEMO_ACCOUNTS } from '@/lib/demo';

export const metadata: Metadata = { title: 'Log in' };

const NOTICES: Record<string, string> = {
  verified: 'Email verified. You can log in now.',
  reset: 'Password updated. Log in with your new password.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => params[k]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Log in to TeamDesk</h1>
        </CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice && (
          <Alert>
            <AlertDescription>{NOTICES[notice]}</AlertDescription>
          </Alert>
        )}
        {params.error === 'OAuthAccountNotLinked' || params.error === 'AccessDenied' ? (
          <Alert variant="destructive">
            <AlertDescription>We could not sign you in with that provider.</AlertDescription>
          </Alert>
        ) : null}
        {env.DEMO_MODE && (
          <Alert>
            <AlertDescription>
              <span>
                Demo: <code>{DEMO_ACCOUNTS.owner.email}</code> (owner) or{' '}
                <code>{DEMO_ACCOUNTS.viewer.email}</code> (viewer), password{' '}
                <code>{DEMO_ACCOUNTS.password}</code>
              </span>
            </AlertDescription>
          </Alert>
        )}
        <LoginForm callbackUrl={params.callbackUrl} />
        {googleEnabled && <GoogleButton callbackUrl={params.callbackUrl} />}
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        New to TeamDesk?&nbsp;
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}
