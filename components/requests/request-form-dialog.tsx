'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api-client';
import { PRIORITY_LABEL } from '@/lib/format';
import type { ProjectOption, UserDTO } from '@/lib/types';

interface Props {
  orgSlug: string;
  projects: ProjectOption[];
  assignees: UserDTO[];
  defaultProjectId?: string;
}

export function RequestFormDialog({ orgSlug, projects, assignees, defaultProjectId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const active = projects.filter((p) => !p.archived);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const due = f.get('dueDate');
    const assignee = f.get('assigneeId');
    setPending(true);
    setError(null);
    try {
      await api(`/orgs/${orgSlug}/requests`, {
        method: 'POST',
        body: {
          projectId: f.get('projectId'),
          title: f.get('title'),
          description: f.get('description'),
          priority: f.get('priority'),
          assigneeId: assignee ? assignee : null,
          dueDate: due ? due : null,
        },
      });
      setOpen(false);
      router.refresh();
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
      <DialogTrigger asChild>
        <Button disabled={active.length === 0}>
          <Plus aria-hidden /> New request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>New request</DialogTitle>
            <DialogDescription>Capture what the client asked for.</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Field
            name="title"
            label="Title"
            required
            errors={error?.fieldErrors.title}
            id="request-title"
          />
          <div className="grid gap-2">
            <Label htmlFor="request-project">Project</Label>
            <NativeSelect
              id="request-project"
              name="projectId"
              defaultValue={defaultProjectId ?? active[0]?.id}
            >
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="request-priority">Priority</Label>
              <NativeSelect id="request-priority" name="priority" defaultValue="MEDIUM">
                {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="request-assignee">Assignee</Label>
              <NativeSelect id="request-assignee" name="assigneeId" defaultValue="">
                <option value="">Unassigned</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Field
              name="dueDate"
              label="Due date"
              type="date"
              id="request-due"
              errors={error?.fieldErrors.dueDate}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="request-description">Description</Label>
            <Textarea id="request-description" name="description" rows={4} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
