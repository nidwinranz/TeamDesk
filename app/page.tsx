import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6">
      <div className="grid gap-4">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          TeamDesk
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Client requests and projects, in one tidy workspace.
        </h1>
        <p className="text-muted-foreground text-lg">
          Invite your team, give clients view-only access, and track every request from open to
          done.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Start free</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
