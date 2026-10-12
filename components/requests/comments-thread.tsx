'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formString } from '@/lib/form';
import { api, errorMessage } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import type { CommentDTO, UserDTO } from '@/lib/types';

interface Props {
  orgSlug: string;
  requestId: string;
  initial: CommentDTO[];
  me: UserDTO;
  canComment: boolean;
  canModerate: boolean;
}

export function CommentsThread({
  orgSlug,
  requestId,
  initial,
  me,
  canComment,
  canModerate,
}: Props) {
  const [comments, setComments] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [optimistic, addOptimistic] = useOptimistic(comments, (state, c: CommentDTO) => [
    ...state,
    c,
  ]);

  function submit(form: FormData) {
    const body = formString(form, 'body').trim();
    if (!body) return;
    setError(null);
    formRef.current?.reset();
    startTransition(async () => {
      addOptimistic({
        id: `pending-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        author: me,
        pending: true,
      });
      try {
        const res = await api<{ data: CommentDTO }>(
          `/orgs/${orgSlug}/requests/${requestId}/comments`,
          {
            method: 'POST',
            body: { body },
          },
        );
        setComments((prev) => [...prev, res.data]);
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  async function remove(id: string) {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    try {
      await api(`/orgs/${orgSlug}/comments/${id}`, { method: 'DELETE' });
    } catch (err) {
      setComments(previous);
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="grid gap-4">
      <h2 id="comments-heading" className="font-medium">
        Comments ({optimistic.length})
      </h2>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {optimistic.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      ) : (
        <ol className="grid gap-3">
          {optimistic.map((c) => (
            <li key={c.id} className="rounded-lg border p-3" aria-busy={c.pending}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  {c.author?.name ?? c.author?.email ?? 'Former member'}
                </span>
                <span className="text-muted-foreground">
                  {c.pending ? 'Sending…' : formatDateTime(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
              {!c.pending && (c.author?.id === me.id || canModerate) && canComment && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => remove(c.id)}
                >
                  Delete<span className="sr-only"> comment</span>
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
      {canComment && (
        <form ref={formRef} action={submit} className="grid gap-2">
          <Label htmlFor="new-comment">Add a comment</Label>
          <Textarea id="new-comment" name="body" rows={3} required maxLength={5000} />
          <Button type="submit" className="justify-self-end">
            Comment
          </Button>
        </form>
      )}
    </section>
  );
}
