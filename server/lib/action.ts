import 'server-only';
import type { ActionState } from '@/lib/action-state';
import { isAppError } from './errors';
import { logger } from './logger';

/** Converts a thrown error into form state; unexpected errors are logged, not leaked. */
export function toActionState(err: unknown): ActionState {
  if (isAppError(err)) {
    const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return { ok: false, message: err.message, fieldErrors: details?.fieldErrors };
  }
  logger.error({ err }, 'unexpected server action error');
  return { ok: false, message: 'Something went wrong. Please try again.' };
}
