export const STATUS_LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
} as const;
export const PRIORITY_LABEL = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const;

export type Status = keyof typeof STATUS_LABEL;
export type Priority = keyof typeof PRIORITY_LABEL;

export const STATUS_CLASS: Record<Status, string> = {
  OPEN: 'bg-secondary text-secondary-foreground',
  IN_PROGRESS: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  BLOCKED: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  DONE: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-foreground',
  HIGH: 'text-orange-800 dark:text-orange-300',
  URGENT: 'text-red-800 font-semibold dark:text-red-300',
};

const dateFmt = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTimeFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
/** `YYYY-MM-DD` for <input type="date">. */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export const isOverdue = (iso: string | null, status: Status) =>
  iso !== null && status !== 'DONE' && new Date(iso).getTime() < Date.now() - 86_400_000;
