import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">
        This page does not exist, or you do not have access to it.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Go to my workspaces</Link>
      </Button>
    </main>
  );
}
