import { z } from 'zod';

export const REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;
export const REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const REQUEST_SORTS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'] as const;

export const statusSchema = z.enum(REQUEST_STATUSES);
export const prioritySchema = z.enum(REQUEST_PRIORITIES);

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Enter a title')
  .max(200, 'Use at most 200 characters');
const descriptionSchema = z.string().trim().max(5000, 'Use at most 5000 characters');
/** Accepts `YYYY-MM-DD` or a full ISO timestamp; `null` clears the date. */
const dueDateSchema = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .transform((v) => new Date(v))
  .nullable();

export const createRequestSchema = z.object({
  projectId: z.string().min(1).max(64),
  title: titleSchema,
  description: descriptionSchema.default(''),
  status: statusSchema.default('OPEN'),
  priority: prioritySchema.default('MEDIUM'),
  assigneeId: z.string().min(1).max(64).nullable().default(null),
  dueDate: dueDateSchema.default(null),
});

export const updateRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: z.string().min(1).max(64).nullable().optional(),
    dueDate: dueDateSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/** Comma-separated query values, e.g. `?status=OPEN,BLOCKED`. */
const splitCsv = z.string().transform((s) => s.split(',').filter(Boolean));

export const listRequestsQuerySchema = z.object({
  projectId: z.string().min(1).max(64).optional(),
  status: splitCsv.pipe(z.array(statusSchema).max(10)).optional(),
  priority: splitCsv.pipe(z.array(prioritySchema).max(10)).optional(),
  /** A user id, `me`, or `none` (unassigned). */
  assignee: z.string().min(1).max(64).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(REQUEST_SORTS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment').max(5000, 'Use at most 5000 characters'),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
