'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';
import { Field } from '@/components/forms/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api-client';

interface Props {
  orgSlug: string;
  project?: { id: string; name: string; description: string };
  trigger: React.ReactNode;
}

/** Create (no `project`) or edit (with `project`) a project. */
export function ProjectFormDialog({ orgSlug, project, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = { name: data.get('name'), description: data.get('description') };
    setPending(true);
    setError(null);
    try {
      if (project) {
        await api(`/orgs/${orgSlug}/projects/${project.id}`, { method: 'PATCH', body });
        router.refresh();
      } else {
        const res = await api<{ data: { id: string } }>(`/orgs/${orgSlug}/projects`, {
          method: 'POST',
          body,
        });
        router.push(`/${orgSlug}/projects/${res.data.id}`);
      }
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError(500, 'UNKNOWN', 'Something went wrong', null),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), setError(null))}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
            <DialogDescription>
              Projects group the requests you track for a client or initiative.
            </DialogDescription>
          </DialogHeader>
          {error?.code === 'PLAN_LIMIT_REACHED' ? (
            <UpgradePrompt orgSlug={orgSlug} message={error.message} />
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}
          <Field
            name="name"
            label="Name"
            required
            defaultValue={project?.name}
            errors={error?.fieldErrors.name}
            id="project-name"
          />
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              name="description"
              defaultValue={project?.description}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : project ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
