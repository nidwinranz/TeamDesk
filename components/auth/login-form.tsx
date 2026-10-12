'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/app/(auth)/actions';
import { Field } from '@/components/forms/field';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { initialActionState } from '@/lib/action-state';
import { ResendVerification } from './resend-verification';

export function LoginForm({
  callbackUrl,
  defaultEmail,
}: {
  callbackUrl?: string;
  defaultEmail?: string;
}) {
  const [state, action] = useActionState(loginAction, initialActionState);
  const needsVerification = state.fieldErrors?.code?.[0] === 'email_not_verified';
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4" noValidate>
        <FormMessage state={state} />
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ''} />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
        />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end text-sm">
          <Link href="/reset" className="text-muted-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="w-full">Log in</SubmitButton>
      </form>
      {needsVerification && <ResendVerification />}
    </div>
  );
}
