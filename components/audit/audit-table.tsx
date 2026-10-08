'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { formatDateTime } from '@/lib/format';

export interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
  actor: { name: string | null; email: string } | null;
}

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

function summarize(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([k, v]: [string, unknown]) => {
      if (v && typeof v === 'object' && 'from' in v && 'to' in v)
        return `${k}: ${show(v.from)} → ${show(v.to)}`;
      return `${k}: ${show(v)}`;
    })
    .join(' · ');
}

export function AuditTable({
  orgSlug,
  actions,
  initial,
  initialCursor,
}: {
  orgSlug: string;
  actions: readonly string[];
  initial: AuditRow[];
  initialCursor: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const action = params.get('action') ?? '';
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initial);
    setCursor(initialCursor);
  }, [initial, initialCursor]);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: '50', cursor, ...(action ? { action } : {}) });
      const res = await api<{ data: AuditRow[]; nextCursor: string | null }>(
        `/orgs/${orgSlug}/audit?${qs.toString()}`,
      );
      setRows((prev) => [...prev, ...res.data]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="audit-action">Action</Label>
        <NativeSelect
          id="audit-action"
          value={action}
          onChange={(e) =>
            router.replace(e.target.value ? `${pathname}?action=${e.target.value}` : pathname)
          }
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </NativeSelect>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No audit entries{action ? ' for this action' : ''}.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </TableCell>
                <TableCell>{r.actor ? (r.actor.name ?? r.actor.email) : 'System'}</TableCell>
                <TableCell>
                  <code className="text-xs">{r.action}</code>
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-md truncate text-xs"
                  title={summarize(r.metadata)}
                >
                  {summarize(r.metadata)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {cursor && (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={loading}
          className="justify-self-center"
        >
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  );
}
