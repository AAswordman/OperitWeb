import { isoNow } from '../shared.js';
import type { D1Backend, Row } from '../types.js';

export interface NotificationInput {
  recipient: string;
  kind: 'comment_reply' | 'comment_new' | 'review_approved' | 'review_rejected' | 'review_changes' | 'entry_curated';
  entryId?: string;
  commentId?: string;
  actorId: string;
  title: string;
  body?: string;
}

export function buildNotification(input: NotificationInput) {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    body: input.body || '',
    createdAt: isoNow(),
  };
}

export async function notifyCommentCreated(
  d1: D1Backend,
  entry: Row,
  comment: { id: string; authorId: string; parentId?: string | null; body: string },
) {
  const entryAuthorId = String(entry.publisher_id || entry.author_id || '');
  const entryTitle = String(entry.title || '');

  // Notify entry publisher of new comment
  if (entryAuthorId && entryAuthorId !== comment.authorId) {
    await d1.createNotification(buildNotification({
      recipient: entryAuthorId,
      kind: 'comment_new',
      entryId: String(entry.id),
      commentId: comment.id,
      actorId: comment.authorId,
      title: `New comment on "${entryTitle}"`,
      body: comment.body.slice(0, 200),
    }));
  }

  // Notify parent comment author of reply
  if (comment.parentId) {
    const parentComment = await d1.getComment(comment.parentId);
    if (parentComment) {
      const parentAuthorId = String(parentComment.author_id);
      if (parentAuthorId && parentAuthorId !== comment.authorId && parentAuthorId !== entryAuthorId) {
        await d1.createNotification(buildNotification({
          recipient: parentAuthorId,
          kind: 'comment_reply',
          entryId: String(entry.id),
          commentId: comment.id,
          actorId: comment.authorId,
          title: `Reply to your comment on "${entryTitle}"`,
          body: comment.body.slice(0, 200),
        }));
      }
    }
  }
}

export async function notifyReview(
  d1: D1Backend,
  entry: Row,
  kind: 'review_approved' | 'review_rejected' | 'review_changes',
  adminId: string,
) {
  const publisherId = String(entry.publisher_id || '');
  if (!publisherId || publisherId === adminId) return;
  const entryTitle = String(entry.title || '');
  const kindLabel = kind === 'review_approved' ? 'approved' : kind === 'review_rejected' ? 'rejected' : 'returned for changes';
  await d1.createNotification(buildNotification({
    recipient: publisherId,
    kind,
    entryId: String(entry.id),
    actorId: adminId,
    title: `"${entryTitle}" ${kindLabel}`,
    body: `Your plugin "${entryTitle}" was ${kindLabel} by a reviewer.`,
  }));
}
