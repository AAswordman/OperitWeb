import { MarketError, isoNow } from '../../shared.js';
import type { D1Backend, MarketObjectChange, ObjectRegistry } from '../../types.js';

const OBJECTS: Record<string, { operations: Set<string>; createFields?: Set<string>; updateFields?: Set<string>; aggregateFields?: Set<string> }> = {
  Author: { operations: new Set(['create', 'update', 'hide']) },
  Entry: { operations: new Set(['create', 'update', 'withdraw', 'approve', 'reject', 'request_changes']), createFields: fields('id type title description detail authorId publisherId allowPublicUpdates categoryId stateCode createdAt updatedAt publishedAt'), updateFields: fields('title description detail categoryId allowPublicUpdates stateCode publishedAt updatedAt') },
  Version: { operations: new Set(['create', 'update', 'approve', 'reject', 'request_changes']), createFields: fields('id entryId version formatVer publisherId minAppVer maxAppVer stateCode changelog createdAt updatedAt publishedAt runtimePkg runtimePackageId'), updateFields: fields('stateCode changelog publishedAt updatedAt') },
  RepoSource: { operations: new Set(['create', 'update']), createFields: fields('id entryId sourceUrl createdAt updatedAt'), updateFields: fields('updatedAt') },
  RepoVersion: { operations: new Set(['create', 'update']), createFields: fields('id versionId refType refName commitSha installConfig createdAt updatedAt') },
  Asset: { operations: new Set(['create', 'update', 'hide']), createFields: fields('id versionId kind url sha256 createdAt') },
  ArtifactProject: { operations: new Set(['create', 'update']), createFields: fields('id entryId projectKey runtimePkg createdAt updatedAt') },
  Comment: { operations: new Set(['create', 'update', 'hide']), createFields: fields('id entryId parentId authorId body source status createdAt updatedAt'), updateFields: fields('body status updatedAt') },
  ReactionStat: { operations: new Set(['aggregate']), aggregateFields: fields('id entryId reaction ghCount cfCount totalCount updatedAt') },
  Curation: { operations: new Set(['create', 'update', 'hide']), createFields: fields('id entryId listKey position note startsAt endsAt createdAt updatedAt'), updateFields: fields('position note startsAt endsAt updatedAt') },
  ReviewReason: { operations: new Set(['create', 'hide']), createFields: fields('id entryId versionId reasonCode createdAt'), updateFields: fields('updatedAt') },
};

export function createObjectRegistry(): ObjectRegistry {
  return {
    assertAllowed(kind: string, operation: string, value: object, patch: object): void {
      const config = OBJECTS[kind];
      if (!config) throw new MarketError('validation_failed', `Invalid object kind: ${kind}`);
      if (!config.operations.has(operation)) throw new MarketError('validation_failed', `Operation is not allowed: ${kind}.${operation}`);
      if (operation === 'create') assertFields(`${kind}.create`, value, config.createFields || new Set<string>());
      if (operation === 'aggregate') assertFields(`${kind}.aggregate`, value, config.aggregateFields || new Set<string>());
      if (operation === 'update' || operation === 'hide') assertFields(`${kind}.update`, patch, config.updateFields || new Set<string>());
      if (kind === 'Comment') validateComment(operation, value as Record<string, unknown>, patch as Record<string, unknown>);
    },
    async apply(change: MarketObjectChange, backend: D1Backend): Promise<unknown> {
      switch (change.kind) {
        case 'Comment': return applyComment(change, backend);
        case 'Entry': return applyEntry(change, backend);
        case 'Version': return applyVersion(change, backend);
        case 'RepoSource': return change.operation === 'create' ? backend.createRepoSource({ id: change.id, ...(change.value || {}) }) : backend.updateRepoSource(change.id, change.patch || {});
        case 'RepoVersion': return backend.createRepoVersion({ id: change.id, ...(change.value || {}) });
        case 'Asset': return backend.createAsset({ id: change.id, ...(change.value || {}) });
        case 'ArtifactProject': return backend.createArtifactProject({ id: change.id, ...(change.value || {}) });
        case 'ReviewReason': return backend.createReviewReason({ id: change.id, ...(change.value || {}) });
        case 'Curation': return change.operation === 'hide' ? backend.hideCuration(change.id, change.patch || {}) : backend.createCuration({ id: change.id, ...(change.value || {}) });
        case 'ReactionStat': return backend.aggregateReaction({ id: change.id, ...(change.value || {}) });
        default: throw new MarketError('not_implemented', `Object kind is not implemented: ${change.kind}`, 501);
      }
    },
  };
}

function applyComment(change: MarketObjectChange, backend: D1Backend): Promise<unknown> {
  if (change.operation === 'create') return backend.createComment({ id: change.id, ...(change.value || {}) });
  if (change.operation === 'update') return backend.updateComment(change.id, change.patch || {});
  if (change.operation === 'hide') return backend.updateComment(change.id, { ...(change.patch || {}), status: 'deleted' });
  throw new MarketError('validation_failed', `Unsupported Comment operation: ${change.operation}`);
}

function applyEntry(change: MarketObjectChange, backend: D1Backend): Promise<unknown> {
  if (change.operation === 'create') return backend.createEntry({ id: change.id, ...(change.value || {}) });
  const patch = change.patch || {};
  const statePatch = change.operation === 'withdraw' ? { ...patch, stateCode: 'withdrawn' } : change.operation === 'approve' ? { ...patch, stateCode: 'approved', publishedAt: (patch as { publishedAt?: unknown }).publishedAt || isoNow() } : change.operation === 'reject' ? { ...patch, stateCode: 'rejected' } : change.operation === 'request_changes' ? { ...patch, stateCode: 'changes_requested' } : patch;
  return backend.updateEntry(change.id, statePatch);
}

function applyVersion(change: MarketObjectChange, backend: D1Backend): Promise<unknown> {
  if (change.operation === 'create') return backend.createVersion({ id: change.id, ...(change.value || {}) });
  const patch = change.patch || {};
  const statePatch = change.operation === 'approve' ? { ...patch, stateCode: 'approved', publishedAt: (patch as { publishedAt?: unknown }).publishedAt || isoNow() } : change.operation === 'reject' ? { ...patch, stateCode: 'rejected' } : change.operation === 'request_changes' ? { ...patch, stateCode: 'changes_requested' } : patch;
  return backend.updateVersion(change.id, statePatch);
}

function validateComment(operation: string, value: Record<string, unknown>, patch: Record<string, unknown>): void {
  if (operation === 'create') {
    requireText(value.id, 'Comment.id'); requireText(value.entryId, 'Comment.entryId'); requireText(value.authorId, 'Comment.authorId'); requireText(value.body, 'Comment.body'); requireText(value.createdAt, 'Comment.createdAt'); requireText(value.updatedAt, 'Comment.updatedAt');
    if (String(value.body).length > 5000) throw new MarketError('validation_failed', 'Comment body exceeds 5000 character limit');
  }
  if ((operation === 'update' || operation === 'hide') && patch.body !== undefined && String(patch.body).length > 5000) throw new MarketError('validation_failed', 'Comment body exceeds 5000 character limit');
}
function assertFields(label: string, payload: object, allowed: Set<string>): void { for (const field of Object.keys(payload)) if (!allowed.has(field)) throw new MarketError('validation_failed', `Field is not allowed: ${label}.${field}`); }
function requireText(value: unknown, field: string): string { const text = String(value || '').trim(); if (!text) throw new MarketError('validation_failed', `${field} is required`); return text; }
function fields(text: string): Set<string> { return new Set(text.split(/\s+/).filter(Boolean)); }
