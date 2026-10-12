import type { Priority, Status } from './format';

/** Serialisable shapes passed from server components to client components. */
export interface UserDTO {
  id: string;
  name: string | null;
  email: string;
}

export interface RequestDTO {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserDTO | null;
  project: { id: string; name: string };
  commentCount: number;
}

export interface CommentDTO {
  id: string;
  body: string;
  createdAt: string;
  author: UserDTO | null;
  pending?: boolean;
}

export interface ProjectOption {
  id: string;
  name: string;
  archived: boolean;
}
