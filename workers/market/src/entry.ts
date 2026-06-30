import { assertAuthorActive, requireAdminToken, requireSession, upsertAuthorFromSession, type MarketAuthor, type MarketSession } from './auth.js';
import {
  DEFAULT_PROOF_TTL_SECONDS,
  MarketError,
  PROOF_PREFIX,
  extractIdFromPath,
  isArtifactType,
  isRepoType,
  normalizeGithubRepoUrl,
  normalizeRefType,
  nowSeconds,
  requireSha256,
  requireString,
  signToken,
  validateAllowedUrlHost,
  verifyToken,
} from './shared.js';
import { publishArtifactMutation, publishRepoMutation } from './translators/publish.js';
import { curationUpdate, reviewApproveEntry, reviewRejectEntry, reviewRequestChangesEntry } from './translators/review.js';
import { notifyReview } from './translators/notify.js';
import type { GitHubRepoInfo, JsonObject, MarketEnv, MarketMutation, MarketStore, Row } from './types.js';

interface EntryRoutes {
  publish(request: Request, env: MarketEnv): Promise<JsonObject>;
  publishProof(request: Request, env: MarketEnv): Promise<JsonObject>;
  updateEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  newVersion(request: Request, env: MarketEnv): Promise<JsonObject>;
  resubmitEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  resubmitVersion(request: Request, env: MarketEnv): Promise<JsonObject>;
  deleteEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  deleteVersion(request: Request, env: MarketEnv): Promise<JsonObject>;
  myEntries(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewApprove(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewReject(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewRequestChanges(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewEntries(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject>;
  curationSet(request: Request, env: MarketEnv): Promise<JsonObject>;
}

interface VersionInput { version: string; formatVer: string; minAppVer: string; maxAppVer?: string; changelog?: string; runtimePackageId?: string }
interface EntryUpdateInput { title?: string; description?: string; detail?: string; categoryId?: string; allowPublicUpdates?: boolean }
interface RepoVersionBody { refType: string; refName: string; installConfig?: string }
interface ArtifactAssetBody { kind: string; url: string; ghOwner: string; ghRepo: string; ghReleaseTag: string; assetName: string; sha256: string; projectId?: string; runtimePackageId?: string }
interface ArtifactVersionBody { projectId?: string; runtimePackageId?: string }

export function createEntryRoutes(): EntryRoutes {
  return { publish: handlePublish, publishProof: handlePublishProof, updateEntry: handleUpdateEntry, newVersion: handleNewVersion, resubmitEntry: handleResubmitEntry, resubmitVersion: handleResubmitVersion, deleteEntry: handleDeleteEntry, deleteVersion: handleDeleteVersion, myEntries: handleMyEntries, reviewApprove: handleReviewApprove, reviewReject: handleReviewReject, reviewRequestChanges: handleReviewRequestChanges, reviewEntries: handleReviewEntries, reviewEntryDetail: handleReviewEntryDetail, curationSet: handleCurationSet };
}

function requireStore(env: MarketEnv): MarketStore {
  if (!env.store) throw new MarketError('server_error', 'Market Store is not configured', 500);
  return env.store;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json();
  return isRecord(value) ? value : {};
}

async function handlePublish(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  assertAuthorActive(publisher);
  const body = await readBody(request);
  const type = requireMarketType(body.type);
  const title = requireString(body.title, 'title');
  const description = requireString(body.description, 'description');
  const categoryId = optionalString(body.categoryId);
  const allowPublicUpdates = optionalBoolean(body.allowPublicUpdates) ?? true;
  const versionInput = requireVersionInput(asRecord(body.version));
  if (isRepoType(type)) return publishRepoEntry(env, store, publisher, type, title, description, categoryId, allowPublicUpdates, versionInput, body);
  if (isArtifactType(type)) return publishArtifactEntry(env, store, session, publisher, type, title, description, categoryId, allowPublicUpdates, versionInput, body);
  throw new MarketError('validation_failed', `Unsupported type: ${type}`);
}

async function handlePublishProof(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const body = await readBody(request);
  const secret = env.MARKET_SESSION_SECRET;
  if (!secret) throw new MarketError('server_error', 'Secret not configured', 500);
  const payload = { github_id: session.github_id, owner: requireString(body.owner, 'owner'), repo: requireString(body.repo, 'repo'), releaseTag: requireString(body.releaseTag, 'releaseTag'), assetName: requireString(body.assetName, 'assetName'), sha256: requireSha256(body.sha256), exp: nowSeconds() + DEFAULT_PROOF_TTL_SECONDS, nonce: `proof-${Math.random().toString(36).slice(2, 10)}` };
  return { ok: true, proof: signToken(PROOF_PREFIX, payload, secret) };
}

async function publishRepoEntry(env: MarketEnv, store: MarketStore, publisher: MarketAuthor, type: string, title: string, description: string, categoryId: string | undefined, allowPublicUpdates: boolean, versionInput: VersionInput, body: Record<string, unknown>): Promise<JsonObject> {
  const sourceBody = asRecord(body.source);
  const repoBody = asRecord(body.repoVersion);
  const source = normalizeGithubRepoUrl(sourceBody.url);
  const refType = normalizeRefType(repoBody.refType);
  const refName = requireString(repoBody.refName, 'repoVersion.refName');
  const repo = await getRepo(env, source.owner, source.repo);
  if (!repo.isPublic) throw new MarketError('validation_failed', 'GitHub repo must be public');
  const commitSha = await resolveRef(env, source.owner, source.repo, refType, refName);
  const installConfig = optionalString(repoBody.installConfig);
  const mutation = publishRepoMutation({ type, title, description, ...(categoryId !== undefined ? { categoryId } : {}), allowPublicUpdates, publisherId: publisher.id, authorId: `gh_${repo.ownerId}`, sourceUrl: source.url, refType, refName, ...(installConfig !== undefined ? { installConfig } : {}), commitSha, ...versionInput });
  const applied = await store.apply(mutation);
  return { ok: true, entryId: String(mutation.objects[0]?.id || ''), versionId: String(mutation.objects[1]?.id || ''), materialization: applied.materialization as unknown as JsonObject, stats: applied.stats as unknown as JsonObject };
}

async function publishArtifactEntry(env: MarketEnv, store: MarketStore, session: MarketSession, publisher: MarketAuthor, type: string, title: string, description: string, categoryId: string | undefined, allowPublicUpdates: boolean, versionInput: VersionInput, body: Record<string, unknown>): Promise<JsonObject> {
  const artifact = await validateArtifactVersion(env, session, body);
  await assertVersionGreaterThanExisting(
    versionInput.version,
    await store.d1.listVersionsForArtifactProjectKey(artifact.projectId),
  );
  const mutation = publishArtifactMutation({ type, title, description, ...(categoryId !== undefined ? { categoryId } : {}), allowPublicUpdates, publisherId: publisher.id, authorId: publisher.id, ...versionInput, runtimePackageId: artifact.runtimePackageId, projectKey: artifact.projectId, assets: [artifact.asset] });
  const applied = await store.apply(mutation);
  return { ok: true, entryId: String(mutation.objects[0]?.id || ''), versionId: String(mutation.objects[1]?.id || ''), materialization: applied.materialization as unknown as JsonObject, stats: applied.stats as unknown as JsonObject };
}

async function handleUpdateEntry(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  const entryId = extractIdFromPath(request.url, '/entries/', '');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  if (text(entry.publisher_id) !== publisher.id) throw new MarketError('unauthorized', 'Only the original publisher can update entry metadata', 403);
  const update = parseEntryUpdateInput(await readBody(request));
  const patch = {
    ...update,
    stateCode: 'pending',
    updatedAt: new Date().toISOString(),
  };
  const applied = await store.apply({
    type: 'mutation',
    id: `mut-entry.updated-${entryId}-${Date.now()}`,
    actor: { authorId: publisher.id, role: 'publisher' },
    reason: 'entry.updated',
    objects: [{ kind: 'Entry', operation: 'update', id: entryId, patch }],
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'private.publisherShard', scope: { authorId: publisher.id } },
    ],
  });
  const updated = await store.d1.getEntry(entryId);
  return { ok: true, item: updated ? entryDetail(updated) : { id: entryId }, stats: applied.stats as unknown as JsonObject };
}
async function handleResubmitEntry(request: Request, env: MarketEnv): Promise<JsonObject> { return applyEntryState(env, request, extractIdFromPath(request.url, '/entries/', '/resubmit'), 'pending', 'entry.resubmitted'); }
async function handleDeleteEntry(request: Request, env: MarketEnv): Promise<JsonObject> { return applyEntryState(env, request, extractIdFromPath(request.url, '/entries/', ''), 'withdrawn', 'entry.withdrawn'); }
async function handleResubmitVersion(request: Request, env: MarketEnv): Promise<JsonObject> { return applyVersionState(env, request, extractIdFromPath(request.url, '/versions/', '/resubmit'), 'pending', 'version.resubmitted'); }
async function handleDeleteVersion(request: Request, env: MarketEnv): Promise<JsonObject> { return applyVersionState(env, request, extractIdFromPath(request.url, '/versions/', ''), 'withdrawn', 'version.withdrawn'); }

async function handleNewVersion(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  assertAuthorActive(publisher);
  const entryId = extractIdFromPath(request.url, '/entries/', '/versions');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const originalPublisherId = text(entry.publisher_id);
  if (originalPublisherId !== publisher.id && !bool(entry.allow_public_updates, true)) {
    throw new MarketError('unauthorized', 'This entry does not allow public version updates', 403);
  }
  const body = await readBody(request);
  let versionInput = requireVersionInput(asRecord(body.version));
  await assertVersionGreaterThanExisting(versionInput.version, await store.d1.listVersionsForEntry(entryId));
  const versionId = `${entryId}-v-${versionInput.version.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const objects: MarketMutation['objects'] = [];
  if (isArtifactType(text(entry.type))) {
    const artifact = await validateArtifactVersion(env, session, body);
    versionInput = { ...versionInput, runtimePackageId: artifact.runtimePackageId };
    objects.push({ kind: 'Asset' as const, operation: 'create' as const, id: `asset-${versionId}-${artifact.asset.assetName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, value: { id: `asset-${versionId}-${artifact.asset.assetName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, versionId, kind: artifact.asset.kind, url: artifact.asset.url, sha256: artifact.asset.sha256, assetName: artifact.asset.assetName, createdAt: new Date().toISOString() } });
  }
  objects.unshift({ kind: 'Version', operation: 'create', id: versionId, value: { id: versionId, entryId, ...versionInput, publisherId: publisher.id, stateCode: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  if (isRepoType(text(entry.type))) {
    const spec = await store.d1.getRepoSpecByEntry(entryId);
    if (!spec) throw new MarketError('state_invalid', 'Repo source not found');
    const source = normalizeGithubRepoUrl(spec.source_url);
    const repoBody = asRecord(body.repoVersion);
    const refType = normalizeRefType(repoBody.refType);
    const refName = requireString(repoBody.refName, 'repoVersion.refName');
    const commitSha = await resolveRef(env, source.owner, source.repo, refType, refName);
    objects.push({ kind: 'RepoVersion' as const, operation: 'create' as const, id: `repo-version-${versionId}`, value: { id: `repo-version-${versionId}`, versionId, refType, refName, commitSha, installConfig: optionalString(repoBody.installConfig), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  }
  const effects = withPrivatePublisherShardEffects(
    [{ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } }, { projection: 'entry.shard', scope: { entryId } }, { projection: 'entry.versions', scope: { entryId } }],
    [originalPublisherId, publisher.id],
  );
  const applied = await store.apply({ type: 'mutation', id: `mut-new-version-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason: 'version.created', objects, effects });
  return { ok: true, entryId, versionId, stats: applied.stats as unknown as JsonObject };
}

async function handleMyEntries(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const authorId = `gh_${session.github_id}`;
  const type = new URL(request.url).searchParams.get('type')?.trim().toLowerCase() || '';
  const shard = await store.readProjection({ projection: 'private.publisherShard', scope: { authorId } });
  const shardObject = asRecord(shard);
  const authorBucket = asRecord(asRecord(shardObject.authors)[authorId]);
  const entries = Array.isArray(authorBucket.entries) ? authorBucket.entries : [];
  return {
    ok: true,
    entries: {
      ok: true,
      marketVersion: Number(shardObject.marketVersion || 2),
      ...(optionalString(shardObject.generatedAt) ? { generatedAt: optionalString(shardObject.generatedAt) } : {}),
      shard: optionalString(shardObject.shard) || '',
      entries: type ? entries.filter((entry) => asRecord(entry).type === type) : entries,
    },
  };
}

async function handleReviewEntries(request: Request, env: MarketEnv): Promise<JsonObject> {
  await requireAdminToken(request, env);
  const store = requireStore(env);
  const url = new URL(request.url);
  const stateCode = optionalString(url.searchParams.get('stateCode'));
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '50'), 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);
  const rows = await store.d1.listReviewEntries(stateCode, limit, offset);
  return { ok: true, limit, offset, items: rows.map(entrySummary) };
}

async function handleReviewEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject> {
  await requireAdminToken(request, env);
  const store = requireStore(env);
  const entryId = extractIdFromPath(request.url, '/admin/review/entries/', '');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const versions = await store.d1.listVersionsForEntry(entryId);
  const repoSource = await store.d1.getRepoSpecByEntry(entryId);
  const artifactProject = await store.d1.getArtifactProject(entryId);
  const assets = await store.d1.listAssets(entryId);
  return {
    ok: true,
    item: entryDetail(entry),
    versions: versions.map(versionDetail),
    ...(repoSource ? { repoSource: rowObject(repoSource) } : {}),
    ...(artifactProject ? { artifactProject: rowObject(artifactProject) } : {}),
    assets: assets.map(rowObject),
  };
}

async function handleReviewApprove(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireString(body.entryId, 'entryId');
  const versionId = optionalString(body.versionId);
  const actorId = admin.username;
  const applied = await store.apply(reviewApproveEntry({ entryId, actorId, ...(versionId !== undefined ? { versionId } : {}) }));
  await store.materializeEntryAssets(entryId);
  const entry = await store.d1.getEntry(entryId);
  if (entry) notifyReview(store.d1, entry, 'review_approved', actorId).catch(() => {});
  return { ok: true, entryId, stats: applied.stats as unknown as JsonObject };
}

async function handleReviewReject(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireString(body.entryId, 'entryId');
  const reasonCode = optionalString(body.reasonCode);
  const actorId = admin.username;
  const applied = await store.apply(reviewRejectEntry({ entryId, actorId, ...(reasonCode !== undefined ? { reasonCode } : {}) }));
  const entry = await store.d1.getEntry(entryId);
  if (entry) notifyReview(store.d1, entry, 'review_rejected', actorId).catch(() => {});
  return { ok: true, entryId, stats: applied.stats as unknown as JsonObject };
}

async function handleReviewRequestChanges(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireString(body.entryId, 'entryId');
  const reasonCode = optionalString(body.reasonCode);
  const actorId = admin.username;
  const applied = await store.apply(reviewRequestChangesEntry({ entryId, actorId, ...(reasonCode !== undefined ? { reasonCode } : {}) }));
  const entry = await store.d1.getEntry(entryId);
  if (entry) notifyReview(store.d1, entry, 'review_changes', actorId).catch(() => {});
  return { ok: true, entryId, stats: applied.stats as unknown as JsonObject };
}

async function handleCurationSet(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireString(body.entryId, 'entryId');
  const listKey = requireString(body.listKey, 'listKey');
  const position = Number(body.position ?? 0);
  const operation = optionalString(body.operation) === 'hide' ? 'hide' : undefined;
  const actorId = admin.username;
  const applied = await store.apply(curationUpdate({ entryId, actorId, listKey, position, ...(operation ? { operation } : {}) }));
  return { ok: true, entryId, listKey, stats: applied.stats as unknown as JsonObject };
}

async function applyEntryState(env: MarketEnv, request: Request, entryId: string, stateCode: string, reason: string): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  if (text(entry.publisher_id) !== publisher.id) throw new MarketError('unauthorized', 'Not your entry', 403);
  const versionPublisherIds = (await store.d1.listVersionsForEntry(entryId)).map((version) => text(version.publisher_id));
  const effects = withPrivatePublisherShardEffects(
    [{ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } }, { projection: 'entry.shard', scope: { entryId } }],
    [publisher.id, ...versionPublisherIds],
  );
  const applied = await store.apply({ type: 'mutation', id: `mut-${reason}-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason, objects: [{ kind: 'Entry', operation: 'update', id: entryId, patch: { stateCode, updatedAt: new Date().toISOString() } }], effects });
  return { ok: true, entryId, stateCode, stats: applied.stats as unknown as JsonObject };
}

function withPrivatePublisherShardEffects(effects: MarketMutation['effects'], authorIds: string[]): MarketMutation['effects'] {
  const seen = new Set<string>();
  for (const authorId of authorIds) {
    if (!authorId || seen.has(authorId)) continue;
    seen.add(authorId);
    effects.push({ projection: 'private.publisherShard', scope: { authorId } });
  }
  return effects;
}

async function applyVersionState(env: MarketEnv, request: Request, versionId: string, stateCode: string, reason: string): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  const entryId = String(versionId).replace(/-v-[^-]+(?:-.+)?$/, '');
  const applied = await store.apply({ type: 'mutation', id: `mut-${reason}-${versionId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason, objects: [{ kind: 'Version', operation: 'update', id: versionId, patch: { stateCode, updatedAt: new Date().toISOString() } }], effects: [{ projection: 'entry.shard', scope: { entryId } }, { projection: 'entry.versions', scope: { entryId } }] });
  return { ok: true, versionId, stateCode, stats: applied.stats as unknown as JsonObject };
}

function requireMarketType(type: unknown): string {
  const value = String(type || '').toLowerCase().trim();
  if (!['script', 'package', 'skill', 'mcp'].includes(value)) throw new MarketError('validation_failed', `Invalid type: ${value}`);
  return value;
}
function entrySummary(entry: Row): JsonObject {
  return {
    id: text(entry.id),
    type: text(entry.type),
    title: text(entry.title),
    description: text(entry.description),
    authorId: text(entry.author_id),
    publisherId: text(entry.publisher_id),
    allowPublicUpdates: bool(entry.allow_public_updates, true),
    author: { id: text(entry.author_id), login: text(entry.author_login), avatar: text(entry.author_avatar) },
    publisher: { id: text(entry.publisher_id), login: text(entry.publisher_login), avatar: text(entry.publisher_avatar) },
    categoryId: text(entry.category_id),
    stateCode: text(entry.state_code),
    createdAt: text(entry.created_at),
    updatedAt: text(entry.updated_at),
    publishedAt: text(entry.published_at),
  };
}
function entryDetail(entry: Row): JsonObject {
  return { ...entrySummary(entry), detail: text(entry.detail) };
}
function versionDetail(version: Row): JsonObject {
  return {
    id: text(version.id),
    entryId: text(version.entry_id),
    version: text(version.version),
    formatVer: text(version.format_ver),
    publisherId: text(version.publisher_id),
    minAppVer: text(version.min_app_ver),
    maxAppVer: text(version.max_app_ver),
    stateCode: text(version.state_code),
    changelog: text(version.changelog),
    createdAt: text(version.created_at),
    updatedAt: text(version.updated_at),
    publishedAt: text(version.published_at),
  };
}

function parseEntryUpdateInput(body: Record<string, unknown>): EntryUpdateInput {
  const update: EntryUpdateInput = {};
  const title = optionalString(body.title);
  const description = optionalString(body.description);
  const detail = optionalString(body.detail);
  const categoryId = optionalString(body.categoryId);
  const allowPublicUpdates = optionalBoolean(body.allowPublicUpdates);
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (detail !== undefined) update.detail = detail;
  if (categoryId !== undefined) update.categoryId = categoryId;
  if (allowPublicUpdates !== undefined) update.allowPublicUpdates = allowPublicUpdates;
  return update;
}
function rowObject(row: Row): JsonObject {
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(row)) out[key] = value;
  return out;
}
async function assertVersionGreaterThanExisting(nextVersion: string, existingVersions: Row[]): Promise<void> {
  const latest = existingVersions
    .map((row) => text(row.version))
    .filter(Boolean)
    .sort(compareVersions)
    .at(-1);
  if (latest && compareVersions(nextVersion, latest) <= 0) {
    throw new MarketError('version_conflict', `Version ${nextVersion} must be greater than existing version ${latest}`, 409);
  }
}
function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const length = Math.max(a.parts.length, b.parts.length);
  for (let index = 0; index < length; index++) {
    const diff = (a.parts[index] ?? 0) - (b.parts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  if (a.suffix === b.suffix) return 0;
  if (!a.suffix) return 1;
  if (!b.suffix) return -1;
  return a.suffix.localeCompare(b.suffix);
}
function parseVersion(value: string): { parts: number[]; suffix: string } {
  const normalized = String(value || '').trim().replace(/^[vV]/, '');
  const [core = '', suffix = ''] = normalized.split(/[-+]/, 2);
  const parts = core.split('.').map((part) => Number.parseInt(part, 10)).map((part) => Number.isFinite(part) ? part : 0);
  return { parts, suffix };
}
function requireVersionInput(input: Record<string, unknown>): VersionInput {
  return { version: requireString(input.version, 'version.version'), formatVer: requireString(input.formatVer, 'version.formatVer'), minAppVer: requireString(input.minAppVer, 'version.minAppVer'), ...(input.maxAppVer !== undefined ? { maxAppVer: requireString(input.maxAppVer, 'version.maxAppVer') } : {}), ...(input.changelog !== undefined ? { changelog: requireString(input.changelog, 'version.changelog') } : {}), ...(input.runtimePackageId !== undefined ? { runtimePackageId: requireString(input.runtimePackageId, 'version.runtimePackageId') } : {}) };
}
async function validateArtifactVersion(env: MarketEnv, session: MarketSession, body: Record<string, unknown>): Promise<{ projectId: string; runtimePackageId: string; asset: { kind: string; url: string; sha256: string; assetName: string } }> {
  const v = asRecord(body.version) as ArtifactVersionBody;
  const a = asRecord(body.asset) as unknown as ArtifactAssetBody;
  const asset = { kind: requireString(a.kind, 'asset.kind'), url: requireString(a.url, 'asset.url'), ghOwner: requireString(a.ghOwner, 'asset.ghOwner'), ghRepo: requireString(a.ghRepo, 'asset.ghRepo'), ghReleaseTag: requireString(a.ghReleaseTag, 'asset.ghReleaseTag'), assetName: requireString(a.assetName, 'asset.assetName'), sha256: requireSha256(a.sha256) };
  validateAllowedUrlHost(asset.url);
  const assetInfo = await (env.mockGitHubGetAsset || realGitHubGetAsset)(asset.ghOwner, asset.ghRepo, asset.ghReleaseTag, asset.assetName, env);
  if (assetInfo.sha256 && assetInfo.sha256 !== asset.sha256) throw new MarketError('proof_invalid', 'Asset sha256 does not match GitHub release metadata');
  const release = await (env.mockGitHubGetRelease || realGitHubGetRelease)(asset.ghOwner, asset.ghRepo, asset.ghReleaseTag, env);
  const proofToken = extractProofFromBody(release.body);
  if (!proofToken) throw new MarketError('proof_missing', 'Release proof block is missing');
  const proof = verifyToken(PROOF_PREFIX, proofToken, env.MARKET_SESSION_SECRET || '') as Record<string, unknown>;
  if (Number(proof.exp || 0) <= nowSeconds()) throw new MarketError('proof_expired', 'Release proof expired');
  if (Number(proof.github_id) !== session.github_id) throw new MarketError('proof_invalid', 'Release proof github_id mismatch');
  return { projectId: requireString(v.projectId || a.projectId, 'version.projectId'), runtimePackageId: requireString(v.runtimePackageId || a.runtimePackageId, 'version.runtimePackageId'), asset };
}
function extractProofFromBody(body: string): string { return /<!--\s*operit-market-proof\s*([\s\S]*?)\s*-->/i.exec(body)?.[1]?.trim() || ''; }
async function getRepo(env: MarketEnv, owner: string, repo: string): Promise<GitHubRepoInfo> { return (env.mockGitHubGetRepo || realGitHubGetRepo)(owner, repo, env); }
async function resolveRef(env: MarketEnv, owner: string, repo: string, refType: string, refName: string): Promise<string> { return (env.mockGitHubResolveRef || realGitHubResolveRef)(owner, repo, refType, refName, env); }
async function realGitHubGetRepo(owner: string, repo: string, _env: MarketEnv): Promise<GitHubRepoInfo> { const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`); if (!response.ok) throw new MarketError('validation_failed', 'GitHub repo is not accessible'); const data = await response.json() as { owner?: { id?: number; login?: string; avatar_url?: string }; private?: boolean }; return { ownerId: Number(data.owner?.id || 0), ownerLogin: String(data.owner?.login || ''), ...(data.owner?.avatar_url !== undefined ? { ownerAvatar: data.owner.avatar_url } : {}), isPublic: !data.private }; }
async function realGitHubResolveRef(owner: string, repo: string, refType: string, refName: string, _env: MarketEnv): Promise<string> { if (refType === 'commit') return refName; const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/${refType === 'tag' ? 'ref/tags' : 'refs/heads'}/${refName}`); if (!response.ok) throw new MarketError('validation_failed', 'GitHub ref cannot be resolved'); const data = await response.json() as { object?: { sha?: string } }; return requireString(data.object?.sha, 'commitSha'); }
async function realGitHubGetAsset(owner: string, repo: string, tag: string, assetName: string, _env: MarketEnv): Promise<{ sha256?: string }> { const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`); if (!response.ok) throw new MarketError('validation_failed', 'GitHub release not found'); const data = await response.json() as { assets?: { name?: string; sha256?: string }[] }; const sha256 = data.assets?.find((asset) => asset.name === assetName)?.sha256; return sha256 !== undefined ? { sha256 } : {}; }
async function realGitHubGetRelease(owner: string, repo: string, tag: string, _env: MarketEnv): Promise<{ body: string }> { const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`); if (!response.ok) throw new MarketError('validation_failed', 'GitHub release not found'); const data = await response.json() as { body?: string }; return { body: data.body || '' }; }
function requireDb(env: MarketEnv) { if (!env.db) throw new MarketError('server_error', 'D1 database is not configured', 500); return env.db; }
function asRecord(value: unknown): Record<string, unknown> { return isRecord(value) ? value : {}; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function optionalString(value: unknown): string | undefined { const text = String(value ?? '').trim(); return text ? text : undefined; }
function text(value: Row[string] | undefined): string { return value === undefined || value === null ? '' : String(value); }
function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1;
  throw new MarketError('validation_failed', 'Boolean fields must be boolean or 0/1');
}
function bool(value: Row[string] | undefined, defaultValue = false): boolean {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1;
  return defaultValue;
}
