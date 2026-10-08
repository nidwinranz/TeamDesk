import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ActionState } from '@/lib/action-state';

/** Announces form-level success/error to screen readers via role="alert". */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <Alert variant={state.ok ? 'default' : 'destructive'}>
      {state.ok ? <CheckCircle2 aria-hidden /> : <AlertCircle aria-hidden />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
