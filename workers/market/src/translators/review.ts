import { isoNow } from '../shared.js';
import type { MarketMutation, MarketObjectOperation } from '../types.js';

interface ReviewEntryInput { entryId: string; actorId: string; versionId?: string; publishedAt?: string }
interface ReviewVersionInput { entryId: string; actorId: string; versionId: string; publishedAt?: string }
interface ReviewReasonInput { entryId: string; actorId: string; reasonCode?: string; versionId: string }
interface ReviewVersionReasonInput extends ReviewReasonInput { versionId: string }
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

export function reviewApproveVersion({ entryId, actorId, versionId, publishedAt }: ReviewVersionInput): MarketMutation {
  const time = publishedAt || isoNow();
  return {
    type: 'mutation',
    id: `mut-review-approve-version-${versionId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.version_approved',
    createdAt: time,
    objects: [{
      kind: 'Version', operation: 'approve', id: versionId,
      patch: { stateCode: 'approved', publishedAt: time, updatedAt: time },
    }],
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
    ],
  };
}

export function reviewRejectEntry({ entryId, actorId, reasonCode, versionId }: ReviewReasonInput): MarketMutation {
  const time = isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Entry', operation: 'reject', id: entryId,
    patch: { stateCode: 'rejected', updatedAt: time },
  }];
  objects.push({
    kind: 'Version', operation: 'reject', id: versionId,
    patch: { stateCode: 'rejected', updatedAt: time },
  });
  if (reasonCode !== undefined) {
    objects.push({
      kind: 'ReviewReason', operation: 'create', id: `reason-version-${versionId}-${reasonCode}`,
      value: { versionId, reasonCode, createdAt: time },
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
      { projection: 'entry.versions', scope: { entryId } },
    ],
  };
}

export function reviewRejectVersion({ entryId, versionId, actorId, reasonCode }: ReviewVersionReasonInput): MarketMutation {
  const time = isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Version', operation: 'reject', id: versionId,
    patch: { stateCode: 'rejected', updatedAt: time },
  }];
  if (reasonCode !== undefined) {
    objects.push({
      kind: 'ReviewReason', operation: 'create', id: `reason-version-${versionId}-${reasonCode}`,
      value: { versionId, reasonCode, createdAt: time },
    });
  }
  return {
    type: 'mutation',
    id: `mut-review-reject-version-${versionId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.version_rejected',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
    ],
  };
}

export function reviewRequestChangesEntry({ entryId, actorId, reasonCode, versionId }: ReviewReasonInput): MarketMutation {
  const time = isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Entry', operation: 'request_changes', id: entryId,
    patch: { stateCode: 'changes_requested', updatedAt: time },
  }];
  objects.push({
    kind: 'Version', operation: 'request_changes', id: versionId,
    patch: { stateCode: 'changes_requested', updatedAt: time },
  });
  if (reasonCode !== undefined) {
    objects.push({
      kind: 'ReviewReason', operation: 'create', id: `reason-version-${versionId}-${reasonCode}`,
      value: { versionId, reasonCode, createdAt: time },
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
      { projection: 'entry.versions', scope: { entryId } },
    ],
  };
}

export function reviewRequestChangesVersion({ entryId, versionId, actorId, reasonCode }: ReviewVersionReasonInput): MarketMutation {
  const time = isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Version', operation: 'request_changes', id: versionId,
    patch: { stateCode: 'changes_requested', updatedAt: time },
  }];
  if (reasonCode !== undefined) {
    objects.push({
      kind: 'ReviewReason', operation: 'create', id: `reason-version-${versionId}-${reasonCode}`,
      value: { versionId, reasonCode, createdAt: time },
    });
  }
  return {
    type: 'mutation',
    id: `mut-review-changes-version-${versionId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.version_changes_requested',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
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
    effects: [
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
    ],
  };
}
