'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { formString } from '@/lib/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/format';
import type { ProjectOption, UserDTO } from '@/lib/types';

interface Props {
  projects?: ProjectOption[];
  assignees: UserDTO[];
}

/** Filters live in the URL so views are shareable and the server renders the first page. */
export function RequestFilters({ projects, assignees }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const sortValue = `${params.get('sort') ?? 'createdAt'}:${params.get('order') ?? 'desc'}`;

  return (
    <form
      role="search"
      aria-label="Filter requests"
      aria-busy={pending}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        set('q', formString(new FormData(e.currentTarget), 'q'));
      }}
    >
      <div className="grid gap-1.5 lg:col-span-2">
        <Label htmlFor="filter-q">Search</Label>
        <Input
          id="filter-q"
          name="q"
          type="search"
          placeholder="Title contains…"
          defaultValue={params.get('q') ?? ''}
        />
      </div>
      {projects && (
        <div className="grid gap-1.5">
          <Label htmlFor="filter-project">Project</Label>
          <NativeSelect
            id="filter-project"
            value={params.get('projectId') ?? ''}
            onChange={(e) => set('projectId', e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? ' (archived)' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <NativeSelect
          id="filter-status"
          value={params.get('status') ?? ''}
          onChange={(e) => set('status', e.target.value)}
        >
          <option value="">Any status</option>
          <option value="OPEN,IN_PROGRESS,BLOCKED">Not done</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-priority">Priority</Label>
        <NativeSelect
          id="filter-priority"
          value={params.get('priority') ?? ''}
          onChange={(e) => set('priority', e.target.value)}
        >
          <option value="">Any priority</option>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-assignee">Assignee</Label>
        <NativeSelect
          id="filter-assignee"
          value={params.get('assignee') ?? ''}
          onChange={(e) => set('assignee', e.target.value)}
        >
          <option value="">Anyone</option>
          <option value="me">Me</option>
          <option value="none">Unassigned</option>
          {assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-sort">Sort by</Label>
        <NativeSelect
          id="filter-sort"
          value={sortValue}
          onChange={(e) => {
            const [sort = 'createdAt', order = 'desc'] = e.target.value.split(':');
            const next = new URLSearchParams(params);
            next.set('sort', sort);
            next.set('order', order);
            startTransition(() =>
              router.replace(`${pathname}?${next.toString()}`, { scroll: false }),
            );
          }}
        >
          <option value="createdAt:desc">Newest</option>
          <option value="createdAt:asc">Oldest</option>
          <option value="updatedAt:desc">Recently updated</option>
          <option value="dueDate:asc">Due date</option>
          <option value="priority:desc">Priority (high first)</option>
          <option value="title:asc">Title A–Z</option>
        </NativeSelect>
      </div>
    </form>
  );
}
