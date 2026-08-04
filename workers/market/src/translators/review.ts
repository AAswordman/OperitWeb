import { isoNow } from '../shared.js';
import type { MarketMutation, MarketObjectOperation } from '../types.js';

interface EntryPatch { title?: string; description?: string; detail?: string; categoryId?: string; allowPublicUpdates?: boolean }
interface ReviewEntryInput { entryId: string; actorId: string; versionId?: string; publishedAt?: string; entryPatch?: EntryPatch; reviewDetail?: string }
interface ReviewVersionInput { entryId: string; actorId: string; versionId: string; publishedAt?: string; entryPatch?: EntryPatch; reviewDetail?: string }
interface ReviewReasonInput { entryId: string; actorId: string; reasonCode?: string; versionId: string; reviewDetail?: string }
interface ReviewVersionReasonInput extends ReviewReasonInput { versionId: string }
interface CurationInput { entryId: string; actorId: string; listKey: string; position: number; operation?: Extract<MarketObjectOperation, 'create' | 'update' | 'hide'> }

export function reviewApproveEntry({ entryId, actorId, versionId, publishedAt, entryPatch, reviewDetail }: ReviewEntryInput): MarketMutation {
  const time = publishedAt || isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Entry', operation: 'approve', id: entryId,
    patch: { ...entryPatch, stateCode: 'approved', publishedAt: time, updatedAt: time },
  }];
  if (versionId !== undefined) {
    objects.push({
      kind: 'Version', operation: 'approve', id: versionId,
      patch: { stateCode: 'approved', publishedAt: time, updatedAt: time },
    });
    appendReviewDetail(objects, versionId, reviewDetail, actorId, time);
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

export function reviewApproveVersion({ entryId, actorId, versionId, publishedAt, entryPatch, reviewDetail }: ReviewVersionInput): MarketMutation {
  const time = publishedAt || isoNow();
  const objects: MarketMutation['objects'] = [{
    kind: 'Version', operation: 'approve', id: versionId,
    patch: { stateCode: 'approved', publishedAt: time, updatedAt: time },
  }];
  if (entryPatch) {
    objects.push({
      kind: 'Entry', operation: 'update', id: entryId,
      patch: { ...entryPatch, updatedAt: time },
    });
  }
  appendReviewDetail(objects, versionId, reviewDetail, actorId, time);
  return {
    type: 'mutation',
    id: `mut-review-approve-version-${versionId}-${Date.now()}`,
    actor: { authorId: actorId, role: 'admin' },
    reason: 'review.version_approved',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
    ],
  };
}

export function reviewRejectEntry({ entryId, actorId, reasonCode, versionId, reviewDetail }: ReviewReasonInput): MarketMutation {
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
  appendReviewDetail(objects, versionId, reviewDetail, actorId, time);
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

export function reviewRejectVersion({ entryId, versionId, actorId, reasonCode, reviewDetail }: ReviewVersionReasonInput): MarketMutation {
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
  appendReviewDetail(objects, versionId, reviewDetail, actorId, time);
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

export function reviewRequestChangesEntry({ entryId, actorId, reasonCode, versionId, reviewDetail }: ReviewReasonInput): MarketMutation {
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
  appendReviewDetail(objects, versionId, reviewDetail, actorId, time);
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

export function reviewRequestChangesVersion({ entryId, versionId, actorId, reasonCode, reviewDetail }: ReviewVersionReasonInput): MarketMutation {
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
  appendReviewDetail(objects, versionId, reviewDetail, actorId, time);
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

function appendReviewDetail(objects: MarketMutation['objects'], versionId: string, reviewDetail: string | undefined, actorId: string, time: string): void {
  if (!reviewDetail) return;
  objects.push({
    kind: 'ReviewDetail', operation: 'create', id: `review-detail-version-${versionId}`,
    value: { versionId, detail: reviewDetail, reviewerId: actorId, createdAt: time, updatedAt: time },
  });
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
