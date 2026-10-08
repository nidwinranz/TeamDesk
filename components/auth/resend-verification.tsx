'use client';

import { useActionState } from 'react';
import { resendVerificationAction } from '@/app/(auth)/actions';
import { Field } from '@/components/forms/field';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { initialActionState } from '@/lib/action-state';

export function ResendVerification({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action] = useActionState(resendVerificationAction, initialActionState);
  return (
    <form action={action} className="grid gap-3 rounded-md border p-4">
      <FormMessage state={state} />
      <Field
        name="email"
        id="resend-email"
        label="Resend verification link to"
        type="email"
        defaultValue={defaultEmail}
        required
      />
      <SubmitButton variant="outline">Resend link</SubmitButton>
    </form>
  );
}
