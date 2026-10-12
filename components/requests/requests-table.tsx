'use client';

import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api-client';
import { formatDate, isOverdue, type Status, STATUS_LABEL } from '@/lib/format';
import type { RequestDTO } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PriorityLabel, StatusBadge } from './badges';
import { useCreatedRequests } from './requests-store';

interface Props {
  orgSlug: string;
  initial: RequestDTO[];
  initialCursor: string | null;
  /** Query string (without cursor) that produced `initial`; used for "Load more". */
  query: string;
  canEdit: boolean;
  showProject: boolean;
  /** Rendered when there are no rows (server-provided so it can say why). */
  empty?: React.ReactNode;
}

export function RequestsTable({
  orgSlug,
  initial,
  initialCursor,
  query,
  canEdit,
  showProject,
  empty,
}: Props) {
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { created } = useCreatedRequests();
  const merged = useMemo(
    () => [...created.filter((c) => !rows.some((r) => r.id === c.id)), ...rows],
    [created, rows],
  );
  const [optimisticRows, setOptimisticStatus] = useOptimistic(
    merged,
    (state, u: { id: string; status: Status }) =>
      state.map((r) => (r.id === u.id ? { ...r, status: u.status } : r)),
  );

  // A new server render (filters changed) replaces the list.
  useEffect(() => {
    setRows(initial);
    setCursor(initialCursor);
  }, [initial, initialCursor]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const sep = query ? '&' : '';
      const res = await api<{ data: RequestDTO[]; nextCursor: string | null }>(
        `/orgs/${orgSlug}/requests?${query}${sep}cursor=${encodeURIComponent(cursor)}`,
      );
      setRows((prev) => [...prev, ...res.data]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function changeStatus(id: string, status: Status) {
    setError(null);
    startTransition(async () => {
      setOptimisticStatus({ id, status });
      try {
        const res = await api<{ data: RequestDTO }>(`/orgs/${orgSlug}/requests/${id}`, {
          method: 'PATCH',
          body: { status },
        });
        setRows((prev) =>
          prev.some((r) => r.id === id)
            ? prev.map((r) => (r.id === id ? { ...r, status: res.data.status } : r))
            : [res.data, ...prev],
        );
      } catch (err) {
        setError(errorMessage(err)); // optimistic value is discarded automatically
      }
    });
  }

  if (optimisticRows.length === 0 && !error) return <>{empty}</>;

  return (
    <div className="grid gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            {showProject && <TableHead>Project</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {optimisticRows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-xs whitespace-normal">
                <Link
                  href={`/${orgSlug}/requests/${r.id}`}
                  prefetch={false}
                  className="font-medium hover:underline"
                >
                  {r.title}
                </Link>
                {r.commentCount > 0 && (
                  <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs">
                    <MessageSquare className="size-3" aria-hidden />
                    <span>
                      {r.commentCount}
                      <span className="sr-only"> comments</span>
                    </span>
                  </span>
                )}
              </TableCell>
              {showProject && (
                <TableCell className="text-muted-foreground">{r.project.name}</TableCell>
              )}
              <TableCell>
                {canEdit ? (
                  <NativeSelect
                    aria-label={`Status of ${r.title}`}
                    className="h-8 w-36"
                    value={r.status}
                    onChange={(e) => changeStatus(r.id, e.target.value as Status)}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </TableCell>
              <TableCell>
                <PriorityLabel priority={r.priority} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.assignee?.name ?? r.assignee?.email ?? 'Unassigned'}
              </TableCell>
              <TableCell
                className={cn(isOverdue(r.dueDate, r.status) && 'text-destructive font-medium')}
              >
                {formatDate(r.dueDate)}
                {isOverdue(r.dueDate, r.status) && <span className="sr-only"> (overdue)</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {cursor && (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={loadingMore}
          className="justify-self-center"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  );
}
