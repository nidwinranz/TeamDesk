/** Shape returned by every server action to its form. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialActionState: ActionState = {};

/** Only same-origin relative paths are accepted as post-login redirects. */
export function safeRedirectPath(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
