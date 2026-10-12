import type { CommentDTO, RequestDTO } from '@/lib/types';

interface RequestLike {
  id: string;
  title: string;
  description: string;
  status: RequestDTO['status'];
  priority: RequestDTO['priority'];
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string | null; email: string } | null;
  project: { id: string; name: string };
  commentCount: number;
}

export function toRequestDTO(r: RequestLike): RequestDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueDate: r.dueDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    assignee: r.assignee
      ? { id: r.assignee.id, name: r.assignee.name, email: r.assignee.email }
      : null,
    project: r.project,
    commentCount: r.commentCount,
  };
}

export function toCommentDTO(c: {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string | null; email: string } | null;
}): CommentDTO {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: c.author ? { id: c.author.id, name: c.author.name, email: c.author.email } : null,
  };
}
