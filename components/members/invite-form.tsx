'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field } from '@/components/forms/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formString } from '@/lib/form';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';

export function InviteForm({
  orgSlug,
  grantableRoles,
}: {
  orgSlug: string;
  grantableRoles: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = formString(data, 'email');
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/orgs/${orgSlug}/invites`, {
        method: 'POST',
        body: { email, role: data.get('role') },
      });
      setMessage(`Invite sent to ${email}.`);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError(500, 'UNKNOWN', errorMessage(err), null),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border p-4"
      aria-label="Invite a member"
      noValidate
    >
      <h2 className="font-medium">Invite a member</h2>
      {error?.code === 'PLAN_LIMIT_REACHED' ? (
        <UpgradePrompt orgSlug={orgSlug} message={error.message} />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {message && (
        <p role="status" className="text-success text-sm">
          {message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field
          name="email"
          label="Email"
          type="email"
          required
          errors={error?.fieldErrors.email}
          id="invite-email"
        />
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect id="invite-role" name="role" defaultValue="MEMBER">
            {grantableRoles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send invite'}
        </Button>
      </div>
    </form>
  );
}
