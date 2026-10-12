import type { Metadata } from 'next';
import Link from 'next/link';
import { AcceptInviteButton } from '@/components/members/accept-invite-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isAppError } from '@/server/lib/errors';
import { getInvitePreview } from '@/server/services/members.service';
import { getCurrentUser } from '@/server/services/session';

export const metadata: Metadata = { title: 'Accept invite' };

const STATUS_TEXT = {
  expired: 'This invite has expired. Ask for a new one.',
  revoked: 'This invite was revoked.',
  accepted: 'This invite has already been used.',
} as const;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getInvitePreview(token).catch((err: unknown) => {
    if (isAppError(err) && (err.code === 'NOT_FOUND' || err.code === 'VALIDATION_FAILED'))
      return null;
    throw err;
  });
  const user = await getCurrentUser();

  let body: React.ReactNode;
  if (!preview) {
    body = <p>This invite link is not valid.</p>;
  } else if (preview.status !== 'valid') {
    body = <p>{STATUS_TEXT[preview.status]}</p>;
  } else if (!user) {
    const back = encodeURIComponent(`/invite/${token}`);
    body = (
      <div className="grid gap-3">
        <Button asChild>
          <Link href={`/signup?invite=${token}&email=${encodeURIComponent(preview.email)}`}>
            Create an account
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/login?callbackUrl=${back}`}>I already have an account</Link>
        </Button>
      </div>
    );
  } else if (user.email.toLowerCase() !== preview.email.toLowerCase()) {
    body = (
      <p>
        You are signed in as <strong>{user.email}</strong>, but this invite is for{' '}
        <strong>{preview.email}</strong>. Log out and sign in with the invited email.
      </p>
    );
  } else {
    body = <AcceptInviteButton token={token} />;
  }

  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{preview ? `Join ${preview.org.name}` : 'Invite not found'}</h1>
          </CardTitle>
          {preview && (
            <CardDescription>
              {preview.invitedBy ? `${preview.invitedBy} invited ` : 'You were invited '}
              {preview.email} as {preview.role.toLowerCase()}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="text-sm">{body}</CardContent>
      </Card>
    </main>
  );
}
