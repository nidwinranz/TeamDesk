'use client';

import { useActionState } from 'react';
import { verifyEmailAction } from '@/app/(auth)/actions';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { initialActionState } from '@/lib/action-state';

/** Verification happens on an explicit POST so link-scanning mail clients cannot burn the token. */
export function VerifyForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmailAction, initialActionState);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full">Confirm my email</SubmitButton>
    </form>
  );
}
