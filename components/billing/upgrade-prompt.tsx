import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Shown when the server rejects an action with PLAN_LIMIT_REACHED. */
export function UpgradePrompt({ orgSlug, message }: { orgSlug: string; message: string }) {
  return (
    <Alert>
      <Sparkles aria-hidden />
      <AlertTitle>Plan limit reached</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button asChild size="sm" className="mt-2">
          <Link href={`/${orgSlug}/billing`}>See plans</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
