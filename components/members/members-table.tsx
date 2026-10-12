'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

export interface MemberRow {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

interface Props {
  orgSlug: string;
  members: MemberRow[];
  currentMembershipId: string;
  canChangeRole: boolean;
  canRemove: boolean;
  grantableRoles: string[];
}

const label = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();

export function MembersTable({
  orgSlug,
  members,
  currentMembershipId,
  canChangeRole,
  canRemove,
  grantableRoles,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    members,
    (
      state: MemberRow[],
      action: { type: 'role'; id: string; role: string } | { type: 'remove'; id: string },
    ) =>
      action.type === 'remove'
        ? state.filter((m) => m.id !== action.id)
        : state.map((m) => (m.id === action.id ? { ...m, role: action.role } : m)),
  );

  function mutate(
    action: { type: 'role'; id: string; role: string } | { type: 'remove'; id: string },
  ) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(action);
      try {
        if (action.type === 'role') {
          await api(`/orgs/${orgSlug}/members/${action.id}`, {
            method: 'PATCH',
            body: { role: action.role },
          });
        } else {
          await api(`/orgs/${orgSlug}/members/${action.id}`, { method: 'DELETE' });
        }
      } catch (err) {
        setError(errorMessage(err));
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Table aria-busy={isPending}>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {optimistic.map((m) => {
            const isSelf = m.id === currentMembershipId;
            const editable =
              canChangeRole && (grantableRoles.includes(m.role) || m.role === 'OWNER');
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-medium">
                    {m.user.name ?? m.user.email} {isSelf && <Badge variant="secondary">you</Badge>}
                  </div>
                  <div className="text-muted-foreground text-xs">{m.user.email}</div>
                </TableCell>
                <TableCell>
                  {editable ? (
                    <NativeSelect
                      aria-label={`Role for ${m.user.email}`}
                      className="w-32"
                      value={m.role}
                      onChange={(e) => mutate({ type: 'role', id: m.id, role: e.target.value })}
                    >
                      {[...new Set([...grantableRoles, m.role])].map((r) => (
                        <option key={r} value={r}>
                          {label(r)}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Badge variant="outline">{label(m.role)}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {(canRemove || isSelf) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            isSelf ? 'Leave this workspace?' : `Remove ${m.user.email}?`,
                          )
                        ) {
                          mutate({ type: 'remove', id: m.id });
                        }
                      }}
                    >
                      {isSelf ? 'Leave' : 'Remove'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
