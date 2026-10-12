import { cn } from '@/lib/utils';
import {
  type Priority,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  type Status,
  STATUS_CLASS,
  STATUS_LABEL,
} from '@/lib/format';

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', STATUS_CLASS[status])}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className={cn('text-xs', PRIORITY_CLASS[priority])}>{PRIORITY_LABEL[priority]}</span>
  );
}
