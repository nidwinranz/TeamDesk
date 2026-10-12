import { noContent, orgRoute } from '@/server/lib/api';
import { deleteComment } from '@/server/services/comments.service';

export const DELETE = orgRoute<{ orgSlug: string; commentId: string }>(async ({ ctx, params }) => {
  await deleteComment(ctx, params.commentId);
  return noContent();
});
