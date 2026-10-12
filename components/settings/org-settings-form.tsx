'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field } from '@/components/forms/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import { formString } from '@/lib/form';

export function OrgSettingsForm({ org }: { org: { name: string; slug: string } }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const { data } = await api<{ data: { slug: string } }>(`/orgs/${org.slug}`, {
        method: 'PATCH',
        body: { name: formString(f, 'name'), slug: formString(f, 'slug') },
      });
      setSaved(true);
      if (data.slug !== org.slug) router.replace(`/${data.slug}/settings`);
      else router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError(500, 'UNKNOWN', 'Something went wrong', null),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <p role="status" className="text-success text-sm">
          Settings saved.
        </p>
      )}
      <Field
        name="name"
        label="Workspace name"
        defaultValue={org.name}
        required
        errors={error?.fieldErrors.name}
      />
      <Field
        name="slug"
        label="Workspace URL"
        defaultValue={org.slug}
        required
        hint="Lowercase letters, numbers and dashes. Changing it breaks old links."
        errors={error?.fieldErrors.slug}
      />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
