import type { Metadata } from 'next';
import Link from 'next/link';
import { GoogleButton } from '@/components/auth/google-button';
import { SignUpForm } from '@/components/auth/signup-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { googleEnabled } from '@/server/auth';

export const metadata: Metadata = { title: 'Sign up' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { invite, email } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{invite ? 'Create your account' : 'Create your workspace'}</h1>
        </CardTitle>
        <CardDescription>
          {invite
            ? 'You will join the workspace you were invited to.'
            : 'Free for up to 5 members and 3 projects.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignUpForm inviteToken={invite} email={email} />
        {googleEnabled && !invite && <GoogleButton callbackUrl="/onboarding" />}
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        Already have an account?&nbsp;
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
      </CardFooter>
    </Card>
  );
}
