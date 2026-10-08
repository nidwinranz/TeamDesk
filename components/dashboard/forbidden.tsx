import { ShieldAlert } from 'lucide-react';

export function Forbidden({ what }: { what: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <ShieldAlert className="size-6" aria-hidden />
      <h1 className="text-foreground text-lg font-medium">No access</h1>
      <p className="text-sm">Your role does not allow you to view {what}. Ask a workspace owner.</p>
    </div>
  );
}
