'use client';

import { useActionState } from 'react';
import { signUpAction } from '@/app/(auth)/actions';
import { Field } from '@/components/forms/field';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { initialActionState } from '@/lib/action-state';

export function SignUpForm({ inviteToken, email }: { inviteToken?: string; email?: string }) {
  const [state, action] = useActionState(signUpAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field name="name" label="Your name" autoComplete="name" required errors={e.name} />
      <Field
        name="email"
        label="Work email"
        type="email"
        autoComplete="email"
        required
        defaultValue={email}
        errors={e.email}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        errors={e.password}
      />
      {inviteToken ? (
        <input type="hidden" name="inviteToken" value={inviteToken} />
      ) : (
        <Field
          name="orgName"
          label="Workspace name"
          placeholder="Acme Studio"
          required
          errors={e.orgName}
        />
      )}
      <SubmitButton className="w-full">Create account</SubmitButton>
    </form>
  );
}
