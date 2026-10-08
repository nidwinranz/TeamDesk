'use client';

import { useActionState } from 'react';
import { createOrgAction } from '@/app/(dashboard)/actions';
import { Field } from '@/components/forms/field';
import { FormMessage } from '@/components/forms/form-message';
import { SubmitButton } from '@/components/forms/submit-button';
import { initialActionState } from '@/lib/action-state';

export function CreateOrgForm() {
  const [state, action] = useActionState(createOrgAction, initialActionState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="name"
        label="Workspace name"
        placeholder="Acme Studio"
        required
        errors={state.fieldErrors?.name}
      />
      <SubmitButton className="w-full">Create workspace</SubmitButton>
    </form>
  );
}
