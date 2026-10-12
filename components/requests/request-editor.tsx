'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { formString } from '@/lib/form';
import { api, errorMessage } from '@/lib/api-client';
import { formatDate, PRIORITY_LABEL, STATUS_LABEL, toDateInput } from '@/lib/format';
import type { RequestDTO, UserDTO } from '@/lib/types';
import { PriorityLabel, StatusBadge } from './badges';

interface Props {
  orgSlug: string;
  request: RequestDTO;
  assignees: UserDTO[];
  canEdit: boolean;
  canDelete: boolean;
}

/** Each field saves on change (optimistically); failures roll back and are announced. */
export function RequestEditor({ orgSlug, request, assignees, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(request);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(
    patch: Partial<Record<keyof RequestDTO | 'assigneeId', unknown>>,
    optimistic: Partial<RequestDTO>,
  ) {
    const previous = value;
    setValue({ ...value, ...optimistic });
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ data: RequestDTO }>(`/orgs/${orgSlug}/requests/${request.id}`, {
        method: 'PATCH',
        body: patch,
      });
      setValue((v) => ({ ...v, ...res.data, dueDate: res.data.dueDate }));
      router.refresh();
    } catch (err) {
      setValue(previous);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this request and its comments?')) return;
    try {
      await api(`/orgs/${orgSlug}/requests/${request.id}`, { method: 'DELETE' });
      router.push(`/${orgSlug}/requests`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!canEdit) {
    return (
      <dl className="grid gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">Status</dt>
          <dd>
            <StatusBadge status={value.status} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Priority</dt>
          <dd>
            <PriorityLabel priority={value.priority} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Assignee</dt>
          <dd className="text-sm">
            {value.assignee?.name ?? value.assignee?.email ?? 'Unassigned'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Due</dt>
          <dd className="text-sm">{formatDate(value.dueDate)}</dd>
        </div>
        <div className="sm:col-span-4">
          <dt className="text-muted-foreground text-xs">Description</dt>
          <dd className="text-sm whitespace-pre-wrap">{value.description || 'No description.'}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="grid gap-4" aria-busy={saving}>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p role="status" className="sr-only">
        {saving ? 'Saving…' : ''}
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-status">Status</Label>
          <NativeSelect
            id="edit-status"
            value={value.status}
            onChange={(e) =>
              save({ status: e.target.value }, { status: e.target.value as RequestDTO['status'] })
            }
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-priority">Priority</Label>
          <NativeSelect
            id="edit-priority"
            value={value.priority}
            onChange={(e) =>
              save(
                { priority: e.target.value },
                { priority: e.target.value as RequestDTO['priority'] },
              )
            }
          >
            {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-assignee">Assignee</Label>
          <NativeSelect
            id="edit-assignee"
            value={value.assignee?.id ?? ''}
            onChange={(e) =>
              save(
                { assigneeId: e.target.value || null },
                { assignee: assignees.find((u) => u.id === e.target.value) ?? null },
              )
            }
          >
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-due">Due date</Label>
          <Input
            id="edit-due"
            type="date"
            value={toDateInput(value.dueDate)}
            onChange={(e) =>
              save(
                { dueDate: e.target.value || null },
                { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null },
              )
            }
          />
        </div>
      </div>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const title = formString(f, 'title');
          const description = formString(f, 'description');
          void save({ title, description }, { title, description });
        }}
      >
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" name="title" defaultValue={value.title} required maxLength={200} />
        <Label htmlFor="edit-description" className="mt-2">
          Description
        </Label>
        <Textarea
          id="edit-description"
          name="description"
          defaultValue={value.description}
          rows={5}
          maxLength={5000}
        />
        <div className="flex justify-between gap-2">
          <Button type="submit" variant="secondary" disabled={saving}>
            Save text
          </Button>
          {canDelete && (
            <Button type="button" variant="ghost" onClick={remove} className="text-destructive">
              <Trash2 aria-hidden /> Delete request
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
