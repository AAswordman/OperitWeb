import { isoNow } from '../shared.js';
import type { MarketMutation } from '../types.js';

export interface CommentDraft {
  id: string;
  entryId: string;
  parentId?: string;
  authorId: string;
  body: string;
  source?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function commentCreateMutation({ comment, actorId }: { comment: CommentDraft; actorId: string }): MarketMutation {
  const createdAt = comment.createdAt || isoNow();
  return {
    type: 'mutation',
    id: `mut-comment-create-${comment.id}`,
    actor: { authorId: actorId, role: 'publisher' },
    reason: 'comment.created',
    createdAt,
    objects: [{
      kind: 'Comment',
      operation: 'create',
      id: comment.id,
      value: {
        id: comment.id,
        entryId: comment.entryId,
        ...(comment.parentId !== undefined ? { parentId: comment.parentId } : {}),
        authorId: comment.authorId,
        body: comment.body,
        source: comment.source || 'cf',
        status: comment.status || 'active',
        createdAt,
        updatedAt: comment.updatedAt || createdAt,
      },
    }],
    effects: [{ projection: 'comments.page', scope: { entryId: comment.entryId, page: 1 } }],
  };
}

export function commentUpdateMutation({ commentId, entryId, actorId, patch, updatedAt }: { commentId: string; entryId: string; actorId: string; patch: { body?: string }; updatedAt?: string }): MarketMutation {
  const time = updatedAt || isoNow();
  return {
    type: 'mutation',
    id: `mut-comment-update-${commentId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'publisher' },
    reason: 'comment.updated',
    createdAt: time,
    objects: [{
      kind: 'Comment',
      operation: 'update',
      id: commentId,
      patch: { ...patch, updatedAt: time },
    }],
    effects: [{ projection: 'comments.page', scope: { entryId, page: 1 } }],
  };
}

export function commentHideMutation({ commentId, entryId, actorId, hiddenAt }: { commentId: string; entryId: string; actorId: string; hiddenAt?: string }): MarketMutation {
  const time = hiddenAt || isoNow();
  return {
    type: 'mutation',
    id: `mut-comment-hide-${commentId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'publisher' },
    reason: 'comment.hidden',
    createdAt: time,
    objects: [{
      kind: 'Comment',
      operation: 'hide',
      id: commentId,
      patch: { status: 'deleted', updatedAt: time },
    }],
    effects: [{ projection: 'comments.page', scope: { entryId, page: 1 } }],
  };
}
