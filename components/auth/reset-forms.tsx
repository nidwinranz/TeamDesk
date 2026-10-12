'use client';

import { useActionState } from 'react';
import { requestResetAction, resetPasswordAction } from '@/app/(auth)/actions';
import { Field } from '@/components/forms/field';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { initialActionState } from '@/lib/action-state';

export function RequestResetForm() {
  const [state, action] = useActionState(requestResetAction, initialActionState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialActionState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton className="w-full">Set new password</SubmitButton>
    </form>
  );
}
