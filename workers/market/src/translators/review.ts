import { isoNow } from '../shared.js';
import type { MarketMutation, MarketObjectOperation } from '../types.js';

interface ReviewEntryInput { entryId: string; actorId: string; versionId?: string; publishedAt?: string }
interface ReviewReasonInput { entryId: string; actorId: string; reasonCode?: string }
interface CurationInput { entryId: string; actorId: string; listKey: string; position: number; operation?: Extract<MarketObjectOperation, 'create' | 'update' | 'hide'> }

export function reviewApproveEntry({ entryId, actorId, versionId, publishedAt }: ReviewEntryInput): MarketMutation {
  const time = publishedAt || isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Entry', operation: 'approve', id: entryId,
    patch: { stateCode: 'approved', publishedAt: time, updatedAt: time },
  }];
  if (versionId !== undefined) {
    objects.push({
      kind: 'Version', operation: 'approve', id: versionId,
      patch: { stateCode: 'approved', publishedAt: time, updatedAt: time },
    });
  }
  return {
    type: 'mutation',
    id: `mut-review-approve-${entryId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.approved',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
    ],
  };
}

export function reviewRejectEntry({ entryId, actorId, reasonCode }: ReviewReasonInput): MarketMutation {
  const time = isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Entry', operation: 'reject', id: entryId,
    patch: { stateCode: 'rejected', updatedAt: time },
  }];
  if (reasonCode !== undefined) {
    objects.push({
      kind: 'ReviewReason', operation: 'create', id: `reason-entry-${entryId}-${reasonCode}`,
      value: { entryId, reasonCode, createdAt: time },
    });
  }
  return {
    type: 'mutation',
    id: `mut-review-reject-${entryId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.rejected',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
    ],
  };
}

export function reviewRequestChangesEntry({ entryId, actorId, reasonCode }: ReviewReasonInput): MarketMutation {
  const time = isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Entry', operation: 'request_changes', id: entryId,
    patch: { stateCode: 'changes_requested', updatedAt: time },
  }];
  if (reasonCode !== undefined) {
    objects.push({
      kind: 'ReviewReason', operation: 'create', id: `reason-entry-${entryId}-${reasonCode}`,
      value: { entryId, reasonCode, createdAt: time },
    });
  }
  return {
    type: 'mutation',
    id: `mut-review-changes-${entryId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.changes_requested',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
    ],
  };
}

export function curationUpdate({ entryId, actorId, listKey, position, operation }: CurationInput): MarketMutation {
  const time = isoNow();
  return {
    type: 'mutation',
    id: `mut-curation-${entryId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'curation.updated',
    createdAt: time,
    objects: [{
      kind: 'Curation', operation: operation || 'create', id: `curation-${entryId}`,
      value: { id: `curation-${entryId}`, entryId, listKey, position, createdAt: time, updatedAt: time },
    }],
    effects: [{ projection: 'list.page', scope: { list: { featured: listKey }, sort: 'manual', page: 1 } }],
  };
}
