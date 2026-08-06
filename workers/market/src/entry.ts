import { assertAuthorActive, requireAdminToken, requireSession, upsertAuthorFromGithubOwner, upsertAuthorFromSession, type MarketAuthor, type MarketSession } from './auth.js';
import { githubApiFetch } from './github.js';
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
  REVISION_SUBMISSION_COOLDOWN_MS,
  requireSha256,
  requireString,
  signToken,
  slug,
} from './shared.js';
import { publishArtifactMutation, publishRepoMutation } from './translators/publish.js';
import { curationUpdate, reviewApproveEntry, reviewApproveVersion, reviewRejectEntry, reviewRejectVersion, reviewRequestChangesEntry, reviewRequestChangesVersion } from './translators/review.js';
import { withdrawAndBlockAuthor } from './translators/moderation.js';
import { notifyReview } from './translators/notify.js';
import { buildEntryItem } from './store/renderers/entryBundle.js';
import type { GitHubReleaseInfo, GitHubRepoInfo, JsonObject, MarketEnv, MarketMutation, MarketStore, Row } from './types.js';

interface EntryRoutes {
  publish(request: Request, env: MarketEnv, waitUntil?: PublishWaitUntil): Promise<JsonObject>;
  publishProof(request: Request, env: MarketEnv): Promise<JsonObject>;
  updateEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  newVersion(request: Request, env: MarketEnv): Promise<JsonObject>;
  resubmitEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  resubmitVersion(request: Request, env: MarketEnv): Promise<JsonObject>;
  deleteEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  deleteVersion(request: Request, env: MarketEnv): Promise<JsonObject>;
  myEntries(request: Request, env: MarketEnv): Promise<JsonObject>;
  myEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewApprove(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewReject(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewRequestChanges(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewEntries(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject>;
  moderateEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  curationSet(request: Request, env: MarketEnv): Promise<JsonObject>;
}

interface VersionInput { version: string; formatVer: string; minAppVer: string; maxAppVer?: string; changelog?: string; runtimePackageId?: string }
interface EntryUpdateInput { title?: string; description?: string; detail?: string; categoryId?: string; allowPublicUpdates?: boolean }
interface RepoVersionBody { refType: string; refName: string; installConfig?: string }
interface ArtifactAssetBody { kind: string; url: string; ghOwner: string; ghRepo: string; ghReleaseTag: string; assetName: string; sha256: string; projectId?: string; runtimePackageId?: string }
interface ArtifactVersionBody { projectId?: string; runtimePackageId?: string }
type PublishWaitUntil = (promise: Promise<unknown>) => void;

type PublishTimingPhase = {
  name: string;
  startedAt: string;
  durationMs: number;
  ok: boolean;
  error?: { name: string; message: string };
};

type PublishTimingLog = {
  version: 1;
  requestId: string;
  route: '/market/v2/publish';
  method: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  statusCode?: number;
  outcome?: 'ok' | 'error';
  type?: string;
  title?: string;
  publisherId?: string;
  phases: PublishTimingPhase[];
  error?: { name: string; message: string };
};

function createPublishTimingLog(request: Request): PublishTimingLog {
  return {
    version: 1,
    requestId: crypto.randomUUID(),
    route: '/market/v2/publish',
    method: request.method,
    startedAt: new Date().toISOString(),
    phases: [],
  };
}

async function measurePublishPhase<T>(log: PublishTimingLog, name: string, run: () => Promise<T>): Promise<T> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const result = await run();
    log.phases.push({ name, startedAt, durationMs: Date.now() - started, ok: true });
    return result;
  } catch (error) {
    const serialized = serializePublishError(error);
    log.phases.push({ name, startedAt, durationMs: Date.now() - started, ok: false, error: serialized });
    throw error;
  }
}

function serializePublishError(error: unknown): { name: string; message: string } {
  return error instanceof Error ? { name: error.name, message: error.message } : { name: 'NonError', message: String(error) };
}

function finishPublishTimingLog(log: PublishTimingLog, error?: unknown): void {
  log.finishedAt = new Date().toISOString();
  log.durationMs = Date.parse(log.finishedAt) - Date.parse(log.startedAt);
  log.outcome = error ? 'error' : 'ok';
  if (error) log.error = serializePublishError(error);
}

function schedulePublishTimingLog(env: MarketEnv, log: PublishTimingLog, waitUntil?: PublishWaitUntil): void {
  const write = writePublishTimingLog(env, log).catch((error: unknown) => {
    console.error('[market.publish] failed to persist timing log', serializePublishError(error));
  });
  if (waitUntil) {
    waitUntil(write);
    return;
  }
  void write;
}

async function writePublishTimingLog(env: MarketEnv, log: PublishTimingLog): Promise<void> {
  const bucket = env.MARKET_STATS_BUCKET;
  if (!bucket) throw new Error('MARKET_STATS_BUCKET binding is not configured');
  const body = JSON.stringify(log, null, 2);
  const timestamp = log.startedAt.replace(/[^0-9A-Za-z._-]+/g, '-');
  await bucket.put('market/v2/debug/publish/latest.json', body, { httpMetadata: { contentType: 'application/json' } });
  await bucket.put(`market/v2/debug/publish/${timestamp}-${log.requestId}.json`, body, { httpMetadata: { contentType: 'application/json' } });
}

const AUTHOR_BLOCK_REASON_CODES = new Set([
  'author-spam',
  'author-abuse',
  'author-malicious-publish',
  'author-policy-violation',
]);

export function createEntryRoutes(): EntryRoutes {
  return { publish: handlePublish, publishProof: handlePublishProof, updateEntry: handleUpdateEntry, newVersion: handleNewVersion, resubmitEntry: handleResubmitEntry, resubmitVersion: handleResubmitVersion, deleteEntry: handleDeleteEntry, deleteVersion: handleDeleteVersion, myEntries: handleMyEntries, myEntryDetail: handleMyEntryDetail, reviewApprove: handleReviewApprove, reviewReject: handleReviewReject, reviewRequestChanges: handleReviewRequestChanges, reviewEntries: handleReviewEntries, reviewEntryDetail: handleReviewEntryDetail, moderateEntry: handleModerateEntry, curationSet: handleCurationSet };
}

function requireStore(env: MarketEnv): MarketStore {
  if (!env.store) throw new MarketError('server_error', 'Market Store is not configured', 500);
  return env.store;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json();
  return isRecord(value) ? value : {};
}

async function handlePublish(request: Request, env: MarketEnv, waitUntil?: PublishWaitUntil): Promise<JsonObject> {
  const timing = createPublishTimingLog(request);
  try {
    const session = await measurePublishPhase(timing, 'session.require', () => requireSession(request, env));
    const store = requireStore(env);
    const publisher = await measurePublishPhase(timing, 'publisher.upsert', () => upsertAuthorFromSession(requireDb(env), session));
    assertAuthorActive(publisher);
    timing.publisherId = publisher.id;
    const body = await measurePublishPhase(timing, 'request.body', () => readBody(request));
    const type = requireMarketType(body.type);
    timing.type = type;
    const title = requireString(body.title, 'title');
    timing.title = title;
    const description = requireString(body.description, 'description');
    const detail = optionalString(body.detail);
    const categoryId = optionalString(body.categoryId);
    const allowPublicUpdates = optionalBoolean(body.allowPublicUpdates) ?? true;
    const versionInput = requireVersionInput(asRecord(body.version));
    if (isRepoType(type)) {
      const result = await measurePublishPhase(timing, 'publish.repo', () => publishRepoEntry(env, store, publisher, type, title, description, detail, categoryId, allowPublicUpdates, versionInput, body));
      timing.statusCode = 200;
      return result;
    }
    if (isArtifactType(type)) {
      const result = await publishArtifactEntry(env, store, session, publisher, type, title, description, detail, categoryId, allowPublicUpdates, versionInput, body, timing);
      timing.statusCode = 200;
      return result;
    }
    throw new MarketError('validation_failed', `Unsupported type: ${type}`);
  } catch (error) {
    timing.statusCode = error instanceof MarketError ? error.status : 500;
    finishPublishTimingLog(timing, error);
    throw error;
  } finally {
    if (!timing.finishedAt) finishPublishTimingLog(timing);
    schedulePublishTimingLog(env, timing, waitUntil);
  }
}

async function handlePublishProof(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const body = await readBody(request);
  const secret = env.MARKET_SESSION_SECRET;
  if (!secret) throw new MarketError('server_error', 'Secret not configured', 500);
  const payload = {
    github_id: session.github_id,
    owner: requireString(body.owner, 'owner'),
    repo: requireString(body.repo, 'repo'),
    releaseTag: requireString(body.releaseTag, 'releaseTag'),
    assetName: requireString(body.assetName, 'assetName'),
    sha256: requireSha256(body.sha256),
    exp: nowSeconds() + DEFAULT_PROOF_TTL_SECONDS,
    nonce: `proof-${Math.random().toString(36).slice(2, 10)}`,
  };
  return { ok: true, proof: signToken(PROOF_PREFIX, payload, secret) };
}

async function publishRepoEntry(env: MarketEnv, store: MarketStore, publisher: MarketAuthor, type: string, title: string, description: string, detail: string | undefined, categoryId: string | undefined, allowPublicUpdates: boolean, versionInput: VersionInput, body: Record<string, unknown>): Promise<JsonObject> {
  const sourceBody = asRecord(body.source);
  const repoBody = asRecord(body.repoVersion);
  const source = normalizeGithubRepoUrl(sourceBody.url);
  const refType = normalizeRefType(repoBody.refType);
  const refName = requireString(repoBody.refName, 'repoVersion.refName');
  const repo = await getRepo(env, source.owner, source.repo);
  if (!repo.isPublic) throw new MarketError('validation_failed', 'GitHub repo must be public');
  const repoOwner = await upsertAuthorFromGithubOwner(requireDb(env), { githubId: repo.ownerId, login: repo.ownerLogin, avatar: repo.ownerAvatar });
  const commitSha = await resolveRef(env, source.owner, source.repo, refType, refName);
  const installConfig = optionalString(repoBody.installConfig);
  const mutation = publishRepoMutation({ type, title, description, ...(detail !== undefined ? { detail } : {}), ...(categoryId !== undefined ? { categoryId } : {}), allowPublicUpdates, publisherId: publisher.id, authorId: repoOwner.id, sourceUrl: source.url, refType, refName, ...(installConfig !== undefined ? { installConfig } : {}), commitSha, ...versionInput });
  const applied = await store.apply(mutation);
  const entryId = String(mutation.objects[0]?.id || '');
  await materializePrivatePublisherShards(store, [publisher.id], entryId);
  return { ok: true, entryId, versionId: String(mutation.objects[1]?.id || ''), materialization: applied.materialization as unknown as JsonObject, stats: applied.stats as unknown as JsonObject };
}

async function publishArtifactEntry(env: MarketEnv, store: MarketStore, session: MarketSession, publisher: MarketAuthor, type: string, title: string, description: string, detail: string | undefined, categoryId: string | undefined, allowPublicUpdates: boolean, versionInput: VersionInput, body: Record<string, unknown>, timing: PublishTimingLog): Promise<JsonObject> {
  const artifact = await measurePublishPhase(timing, 'artifact.validate-github-release', () => validateArtifactVersion(env, session, body));
  const projectVersions = await measurePublishPhase(timing, 'artifact.list-project-versions', () => store.d1.listVersionsForArtifactProjectKey(artifact.projectId));
  await measurePublishPhase(timing, 'artifact.assert-version', () => assertVersionGreaterThanExisting(versionInput.version, projectVersions));
  const existingVersion = projectVersions[0];
  if (existingVersion) {
    const entryId = text(existingVersion.entry_id);
    const entry = await store.d1.getEntry(entryId);
    if (!entry) throw new MarketError('state_invalid', 'Artifact project entry not found');
    const originalPublisherId = text(entry.publisher_id);
    assertCanSubmitVersionForEntry(entry, publisher.id);
    await assertRevisionSubmissionCooldown(store, publisher.id, entryId);
    if (originalPublisherId !== publisher.id) throw new MarketError('unauthorized', 'Only the original publisher can update entry metadata', 403);
    const now = new Date().toISOString();
    const versionId = `${entryId}-v-${slug(versionInput.version)}`;
    const assetId = `asset-${versionId}-${slug(artifact.asset.assetName)}`;
    const objects: MarketMutation['objects'] = [
      {
        kind: 'Version',
        operation: 'create',
        id: versionId,
        value: {
          id: versionId,
          entryId,
          ...versionInput,
          runtimePackageId: artifact.runtimePackageId,
          publisherId: publisher.id,
          entryPatch: serializeEntryPatch({ title, description, ...(detail !== undefined ? { detail } : {}), ...(categoryId !== undefined ? { categoryId } : {}), allowPublicUpdates }),
          stateCode: 'pending',
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        kind: 'Asset',
        operation: 'create',
        id: assetId,
        value: {
          id: assetId,
          versionId,
          kind: artifact.asset.kind,
          url: artifact.asset.url,
          ghOwner: artifact.asset.ghOwner,
          ghRepo: artifact.asset.ghRepo,
          ghReleaseTag: artifact.asset.ghReleaseTag,
          sha256: artifact.asset.sha256,
          assetName: artifact.asset.assetName,
          createdAt: now,
        },
      },
    ];
    const effects = withPrivatePublisherShardEffects(
      [{ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } }, { projection: 'entry.shard', scope: { entryId } }, { projection: 'entry.versions', scope: { entryId } }, { projection: 'asset.detail', scope: { assetId } }],
      [originalPublisherId, publisher.id],
      entryId,
    );
    const applied = await measurePublishPhase(timing, 'store.apply-new-version', () => store.apply({ type: 'mutation', id: `mut-new-version-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason: 'version.created', objects, effects }));
    await measurePublishPhase(timing, 'materialize.publisher-shard', () => materializePrivatePublisherShards(store, [originalPublisherId, publisher.id], entryId));
    return { ok: true, entryId, versionId, stats: applied.stats as unknown as JsonObject };
  }
  const mutation = publishArtifactMutation({ type, title, description, ...(detail !== undefined ? { detail } : {}), ...(categoryId !== undefined ? { categoryId } : {}), allowPublicUpdates, publisherId: publisher.id, authorId: publisher.id, ...versionInput, runtimePackageId: artifact.runtimePackageId, projectKey: artifact.projectId, assets: [artifact.asset] });
  const applied = await measurePublishPhase(timing, 'store.apply-new-entry', () => store.apply(mutation));
  const entryId = String(mutation.objects[0]?.id || '');
  await measurePublishPhase(timing, 'materialize.publisher-shard', () => materializePrivatePublisherShards(store, [publisher.id], entryId));
  return { ok: true, entryId: String(mutation.objects[0]?.id || ''), versionId: String(mutation.objects[1]?.id || ''), materialization: applied.materialization as unknown as JsonObject, stats: applied.stats as unknown as JsonObject };
}

async function handleUpdateEntry(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  assertAuthorActive(publisher);
  const entryId = extractIdFromPath(request.url, '/entries/', '');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  if (text(entry.publisher_id) !== publisher.id) throw new MarketError('unauthorized', 'Only the original publisher can update entry metadata', 403);
  const update = parseEntryUpdateInput(await readBody(request));
  const patch = {
    ...update,
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
      { projection: 'private.publisherShard', scope: { authorId: publisher.id, entryId } },
    ],
  });
  await materializePrivatePublisherShards(store, [publisher.id], entryId);
  const updated = await store.d1.getEntry(entryId);
  return { ok: true, item: updated ? entryDetail(updated) : { id: entryId }, stats: applied.stats as unknown as JsonObject };
}
async function handleResubmitEntry(_request: Request, _env: MarketEnv): Promise<JsonObject> {
  throw new MarketError('validation_failed', 'Direct resubmission is disabled; submit a modified new version instead', 409);
}
async function handleDeleteEntry(request: Request, env: MarketEnv): Promise<JsonObject> { return applyEntryState(env, request, extractIdFromPath(request.url, '/entries/', ''), 'withdrawn', 'entry.withdrawn'); }
async function handleResubmitVersion(_request: Request, _env: MarketEnv): Promise<JsonObject> {
  throw new MarketError('validation_failed', 'Direct resubmission is disabled; submit a modified new version instead', 409);
}
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
  assertCanSubmitVersionForEntry(entry, publisher.id);
  await assertRevisionSubmissionCooldown(store, publisher.id, entryId);
  const body = await readBody(request);
  const entryPatchInput = parseEntryUpdateInput(asRecord(body.entry));
  const hasEntryPatch = Object.keys(entryPatchInput).length > 0;
  if (hasEntryPatch && originalPublisherId !== publisher.id) throw new MarketError('unauthorized', 'Only the original publisher can update entry metadata', 403);
  let versionInput = requireVersionInput(asRecord(body.version));
  await assertVersionGreaterThanExisting(versionInput.version, await store.d1.listVersionsForEntry(entryId));
  const versionId = `${entryId}-v-${versionInput.version.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const objects: MarketMutation['objects'] = [];
  if (isArtifactType(text(entry.type))) {
    const artifact = await validateArtifactVersion(env, session, body);
    versionInput = { ...versionInput, runtimePackageId: artifact.runtimePackageId };
    objects.push({ kind: 'Asset' as const, operation: 'create' as const, id: `asset-${versionId}-${artifact.asset.assetName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, value: { id: `asset-${versionId}-${artifact.asset.assetName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, versionId, kind: artifact.asset.kind, url: artifact.asset.url, ghOwner: artifact.asset.ghOwner, ghRepo: artifact.asset.ghRepo, ghReleaseTag: artifact.asset.ghReleaseTag, sha256: artifact.asset.sha256, assetName: artifact.asset.assetName, createdAt: new Date().toISOString() } });
  }
  const now = new Date().toISOString();
  objects.unshift({ kind: 'Version', operation: 'create', id: versionId, value: { id: versionId, entryId, ...versionInput, publisherId: publisher.id, ...(hasEntryPatch ? { entryPatch: serializeEntryPatch(entryPatchInput) } : {}), stateCode: 'pending', createdAt: now, updatedAt: now } });
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
    entryId,
  );
  const applied = await store.apply({ type: 'mutation', id: `mut-new-version-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason: 'version.created', objects, effects });
  await materializePrivatePublisherShards(store, [originalPublisherId, publisher.id], entryId);
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
  const filteredEntries = type ? entries.filter((entry) => asRecord(entry).type === type) : entries;
  const entriesWithListingState = await Promise.all(filteredEntries.map(async (entry) => {
    const summary = asRecord(entry);
    const entryId = optionalString(summary.id);
    if (summary.stateCode !== 'approved' || !entryId) return entry;
    const publicShard = asRecord(await store.readProjection({ projection: 'entry.shard', scope: { entryId } }));
    const entriesById = asRecord(publicShard.entriesById);
    return Object.prototype.hasOwnProperty.call(entriesById, entryId)
      ? entry
      : { ...summary, listingState: 'pending_listing' };
  }));
  return {
    ok: true,
    entries: {
      ok: true,
      marketVersion: Number(shardObject.marketVersion || 2),
      ...(optionalString(shardObject.generatedAt) ? { generatedAt: optionalString(shardObject.generatedAt) } : {}),
      shard: optionalString(shardObject.shard) || '',
      entries: entriesWithListingState,
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
  const rows = await store.d1.listReviewVersions(stateCode, limit, offset);
  return { ok: true, limit, offset, items: rows.map(reviewVersionSummary) };
}

async function handleReviewEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject> {
  await requireAdminToken(request, env);
  const store = requireStore(env);
  const entryId = extractIdFromPath(request.url, '/admin/review/entries/', '');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const versions = await store.d1.listVersionsForEntry(entryId);
  const reviewDetails = await store.d1.listVersionReviewDetails(versions.map((version) => text(version.id)));
  const reviewDetailByVersionId = new Map(reviewDetails.map((detail) => [text(detail.version_id), detail]));
  const repoSource = await store.d1.getRepoSpecByEntry(entryId);
  const artifactProject = await store.d1.getArtifactProject(entryId);
  const assets = await store.d1.listAssets(entryId);
  return {
    ok: true,
    item: entryDetail(entry),
    versions: versions.map((version) => versionDetail(version, reviewDetailByVersionId.get(text(version.id)))),
    ...(repoSource ? { repoSource: rowObject(repoSource) } : {}),
    ...(artifactProject ? { artifactProject: rowObject(artifactProject) } : {}),
    assets: assets.map(rowObject),
  };
}

async function handleReviewApprove(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireReviewEntryId(request, body, '/review/approve');
  const versionId = requireString(body.versionId, 'versionId');
  const reviewDetail = parseReviewDetail(body.reviewDetail);
  const actorId = admin.username;
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const targetVersion = await resolveReviewVersion(store, entryId, versionId);
  assertCanApproveVersionForEntry(entry, targetVersion);
  const targetVersionId = text(targetVersion.id);
  const entryPatch = parseStoredEntryPatch(targetVersion);
  const reviewVersionOnly = text(entry.state_code) === 'withdrawn'
    ? false
    : shouldReviewVersionOnly(body, entry, await hasApprovedVersion(store, entryId));
  const applied = await store.apply(reviewVersionOnly
    ? reviewApproveVersion({ entryId, actorId, versionId: targetVersionId, ...(entryPatch ? { entryPatch } : {}), ...(reviewDetail ? { reviewDetail } : {}) })
    : reviewApproveEntry({ entryId, actorId, versionId: targetVersionId, ...(entryPatch ? { entryPatch } : {}), ...(reviewDetail ? { reviewDetail } : {}) }));
  await store.materializeEntryAssets(entryId);
  await materializePrivatePublisherShards(store, await privatePublisherAuthorIdsForEntry(store, entry), entryId);
  await notifyReview(store.d1, entry, 'review_approved', actorId);
  return { ok: true, entryId, stats: applied.stats as unknown as JsonObject };
}

async function handleMyEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  const entryId = extractIdFromPath(request.url, '/my/entries/', '/detail');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const ownVersions = await store.d1.listAuthorEntryVersions(publisher.id, entryId);
  if (text(entry.publisher_id) !== publisher.id && ownVersions.length === 0) {
    throw new MarketError('unauthorized', 'You do not have a submission for this entry', 403);
  }

  const item = await buildEntryItem(store.d1, entry);
  const versions = await Promise.all(
    ownVersions
      .sort((a, b) => (text(b.updated_at) || text(b.created_at)).localeCompare(text(a.updated_at) || text(a.created_at)))
      .map(async (version) => {
        const versionPublisherId = text(version.publisher_id);
        const versionPublisher = versionPublisherId ? await store.d1.getAuthor(versionPublisherId) : null;
        const repoVersion = isRepoType(text(entry.type)) ? await store.d1.getRepoVersion(text(version.id)) : null;
        return {
          id: text(version.id),
          version: text(version.version),
          formatVer: text(version.format_ver),
          publisherId: versionPublisherId,
          ...(versionPublisher ? { publisher: { id: versionPublisherId, login: text(versionPublisher.github_login), avatar: text(versionPublisher.owner_avatar) } } : {}),
          minAppVer: text(version.min_app_ver),
          maxAppVer: text(version.max_app_ver),
          changelog: text(version.changelog),
          stateCode: text(version.state_code),
          runtimePackageId: text(version.runtime_pkg),
          ...(repoVersion ? { installConfig: text(repoVersion.install_config), refType: text(repoVersion.ref_type), refName: text(repoVersion.ref_name) } : {}),
          createdAt: text(version.created_at),
          updatedAt: text(version.updated_at),
          publishedAt: text(version.published_at),
        };
      }),
  );
  item.versions = versions;
  item.latestVersion = versions[0];
  if (isArtifactType(text(entry.type))) {
    const ownVersionIds = new Set(ownVersions.map((version) => text(version.id)));
    item.assets = (await store.d1.listAssets(entryId)).filter((asset) => ownVersionIds.has(text(asset.version_id))).map((asset) => ({
      id: text(asset.id),
      versionId: text(asset.version_id),
      kind: text(asset.kind),
      url: text(asset.url),
      ...(optionalString(asset.gh_owner) ? { ghOwner: text(asset.gh_owner) } : {}),
      ...(optionalString(asset.gh_repo) ? { ghRepo: text(asset.gh_repo) } : {}),
      ...(optionalString(asset.gh_release_tag) ? { ghReleaseTag: text(asset.gh_release_tag) } : {}),
      sha256: text(asset.sha256),
      ...(optionalString(asset.asset_name) ? { assetName: text(asset.asset_name) } : {}),
    }));
  }
  const latestVersion = versions[0];
  const latestRefName = latestVersion?.refName;
  if (isRepoType(text(entry.type)) && latestVersion?.refType && latestRefName) {
    item.repoVersion = { refType: latestVersion.refType, refName: latestRefName, ...(latestVersion.installConfig ? { installConfig: latestVersion.installConfig } : {}) };
  }
  return { ok: true, item: item as unknown as JsonObject };
}

async function handleModerateEntry(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = extractIdFromPath(request.url, '/admin/entries/', '/moderation');
  const bodyEntryId = requireString(body.entryId, 'entryId');
  if (!entryId) throw new MarketError('validation_failed', 'entryId is required in path', 400);
  if (entryId !== bodyEntryId) throw new MarketError('validation_failed', 'entryId must match path', 400);
  const action = optionalString(body.action) || 'withdraw_and_block';
  if (action !== 'withdraw_and_block') throw new MarketError('validation_failed', 'Unsupported moderation action', 400);
  const reasonCode = optionalString(body.reasonCode) || 'author-policy-violation';
  if (!AUTHOR_BLOCK_REASON_CODES.has(reasonCode)) throw new MarketError('validation_failed', 'Invalid author block reason code', 400);
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const authorId = text(entry.publisher_id) || text(entry.author_id);
  if (!authorId) throw new MarketError('state_invalid', 'Entry has no publisher', 409);
  const requestedAuthorId = optionalString(body.authorId);
  if (requestedAuthorId && requestedAuthorId !== authorId) throw new MarketError('validation_failed', 'authorId does not match entry publisher', 400);
  const author = await store.d1.getAuthor(authorId);
  if (!author) throw new MarketError('not_found', 'Author not found', 404);
  const time = new Date().toISOString();
  const applied = await store.apply(withdrawAndBlockAuthor({ entryId, authorId, actorId: admin.username, reasonCode, blockedAt: time }));
  await materializePrivatePublisherShards(store, await privatePublisherAuthorIdsForEntry(store, entry), entryId);
  return {
    ok: true,
    action,
    entryId,
    authorId,
    stateCode: 'withdrawn',
    authorStatus: 'blocked',
    reasonCode,
    stats: applied.stats as unknown as JsonObject,
  };
}

async function handleReviewReject(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireReviewEntryId(request, body, '/review/reject');
  const versionId = requireString(body.versionId, 'versionId');
  const reasonCode = requireString(body.reasonCode, 'reasonCode');
  const reviewDetail = parseReviewDetail(body.reviewDetail);
  const actorId = admin.username;
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const targetVersionId = await resolveReviewVersionId(store, entryId, versionId);
  const reviewVersionOnly = shouldReviewVersionOnly(body, entry, await hasApprovedVersion(store, entryId));
  const applied = await store.apply(reviewVersionOnly
    ? reviewRejectVersion({ entryId, versionId: targetVersionId, actorId, reasonCode, ...(reviewDetail ? { reviewDetail } : {}) })
    : reviewRejectEntry({ entryId, actorId, versionId: targetVersionId, reasonCode, ...(reviewDetail ? { reviewDetail } : {}) }));
  await materializePrivatePublisherShards(store, await privatePublisherAuthorIdsForEntry(store, entry), entryId);
  await notifyReview(store.d1, entry, 'review_rejected', actorId);
  return { ok: true, entryId, stats: applied.stats as unknown as JsonObject };
}

async function handleReviewRequestChanges(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireReviewEntryId(request, body, '/review/changes');
  const versionId = requireString(body.versionId, 'versionId');
  const reasonCode = requireString(body.reasonCode, 'reasonCode');
  const reviewDetail = parseReviewDetail(body.reviewDetail);
  const actorId = admin.username;
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const targetVersionId = await resolveReviewVersionId(store, entryId, versionId);
  const reviewVersionOnly = shouldReviewVersionOnly(body, entry, await hasApprovedVersion(store, entryId));
  const applied = await store.apply(reviewVersionOnly
    ? reviewRequestChangesVersion({ entryId, versionId: targetVersionId, actorId, reasonCode, ...(reviewDetail ? { reviewDetail } : {}) })
    : reviewRequestChangesEntry({ entryId, actorId, versionId: targetVersionId, reasonCode, ...(reviewDetail ? { reviewDetail } : {}) }));
  await materializePrivatePublisherShards(store, await privatePublisherAuthorIdsForEntry(store, entry), entryId);
  await notifyReview(store.d1, entry, 'review_changes', actorId);
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
  assertAuthorActive(publisher);
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  if (text(entry.publisher_id) !== publisher.id) throw new MarketError('unauthorized', 'Not your entry', 403);
  const versions = await store.d1.listVersionsForEntry(entryId);
  const versionPublisherIds = versions.map((version) => text(version.publisher_id));
  const time = new Date().toISOString();
  const objects: MarketMutation['objects'] = [{ kind: 'Entry', operation: 'update', id: entryId, patch: { stateCode, updatedAt: time } }];
  if (reason === 'entry.resubmitted') {
    const ownVersions = versions
      .filter((version) => text(version.publisher_id) === publisher.id)
      .sort((a, b) => (text(b.updated_at) || text(b.created_at) || text(b.id)).localeCompare(text(a.updated_at) || text(a.created_at) || text(a.id)));
    const latestOwnVersion = ownVersions[0];
    if (!latestOwnVersion) throw new MarketError('state_invalid', 'Entry has no version for current publisher', 409);
    objects.push({ kind: 'Version', operation: 'update', id: text(latestOwnVersion.id), patch: { stateCode, updatedAt: time } });
  }
  const effects = withPrivatePublisherShardEffects(
    [{ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } }, { projection: 'entry.shard', scope: { entryId } }],
    [publisher.id, ...versionPublisherIds],
    entryId,
  );
  const applied = await store.apply({ type: 'mutation', id: `mut-${reason}-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason, objects, effects });
  await materializePrivatePublisherShards(store, [publisher.id, ...versionPublisherIds], entryId);
  return { ok: true, entryId, stateCode, stats: applied.stats as unknown as JsonObject };
}

function withPrivatePublisherShardEffects(effects: MarketMutation['effects'], authorIds: string[], entryId: string): MarketMutation['effects'] {
  const seen = new Set<string>();
  for (const authorId of authorIds) {
    if (!authorId || seen.has(authorId)) continue;
    seen.add(authorId);
    effects.push({ projection: 'private.publisherShard', scope: { authorId, entryId } });
  }
  return effects;
}

async function privatePublisherAuthorIdsForEntry(store: MarketStore, entry: Row): Promise<string[]> {
  const entryId = text(entry.id);
  const versions = entryId ? await store.d1.listVersionsForEntry(entryId) : [];
  return [text(entry.publisher_id), ...versions.map((version) => text(version.publisher_id))];
}

async function resolveReviewVersionId(store: MarketStore, entryId: string, versionId: string): Promise<string> {
  const version = await resolveReviewVersion(store, entryId, versionId);
  return text(version.id);
}

async function resolveReviewVersion(store: MarketStore, entryId: string, versionId: string): Promise<Row> {
  const versions = await store.d1.listVersionsForEntry(entryId);
  if (versions.length === 0) throw new MarketError('state_invalid', 'Entry has no versions', 409);
  const version = versions.find((candidate) => text(candidate.id) === versionId);
  if (!version) throw new MarketError('not_found', 'Version not found for entry', 404);
  return version;
}

function assertCanSubmitVersionForEntry(entry: Row, publisherId: string): void {
  const originalPublisherId = text(entry.publisher_id);
  if (text(entry.state_code) === 'withdrawn' && originalPublisherId !== publisherId) {
    throw new MarketError('unauthorized', 'Withdrawn entries can only be restored by the original publisher', 403);
  }
  if (originalPublisherId !== publisherId && !bool(entry.allow_public_updates, true)) {
    throw new MarketError('unauthorized', 'This entry does not allow public version updates', 403);
  }
}

async function assertRevisionSubmissionCooldown(store: MarketStore, publisherId: string, entryId: string): Promise<void> {
  const latestVersion = (await store.d1.listAuthorEntryVersions(publisherId, entryId))[0];
  if (!latestVersion || text(latestVersion.state_code) !== 'changes_requested') return;
  const reviewedAt = Date.parse(text(latestVersion.updated_at) || text(latestVersion.created_at));
  if (!Number.isFinite(reviewedAt)) return;
  const availableAt = reviewedAt + REVISION_SUBMISSION_COOLDOWN_MS;
  const remainingMs = availableAt - Date.now();
  if (remainingMs <= 0) return;
  const retryAt = new Date(availableAt).toISOString();
  throw new MarketError(
    'revision_cooldown',
    `This entry was returned for changes. Submit a new version after ${retryAt}.`,
    429,
    { retryAt, retryAfterSeconds: Math.ceil(remainingMs / 1000) },
  );
}

function assertCanApproveVersionForEntry(entry: Row, version: Row): void {
  if (text(entry.state_code) !== 'withdrawn') return;
  if (text(entry.publisher_id) === text(version.publisher_id)) return;
  throw new MarketError('unauthorized', 'Withdrawn entries can only be restored by approving an original publisher version', 403);
}

function requireReviewEntryId(request: Request, body: Record<string, unknown>, actionPath: string): string {
  const pathEntryId = extractIdFromPath(request.url, '/entries/', actionPath);
  const bodyEntryId = requireString(body.entryId, 'entryId');
  if (!pathEntryId) throw new MarketError('validation_failed', 'entryId is required in path', 400);
  if (pathEntryId !== bodyEntryId) throw new MarketError('validation_failed', 'entryId must match path', 400);
  return bodyEntryId;
}

async function hasApprovedVersion(store: MarketStore, entryId: string): Promise<boolean> {
  const versions = await store.d1.listVersionsForEntry(entryId);
  return versions.some((version) => text(version.state_code) === 'approved');
}

function shouldReviewVersionOnly(body: Record<string, unknown>, entry: Row, hasApproved: boolean): boolean {
  const scope = String(body.scope ?? body.reviewScope ?? '').trim().toLowerCase();
  if (scope === 'entry') return false;
  return text(entry.state_code) === 'approved' && hasApproved;
}

async function materializePrivatePublisherShards(store: MarketStore, authorIds: string[], entryId: string): Promise<void> {
  const seen = new Set<string>();
  for (const authorId of authorIds) {
    if (!authorId || seen.has(authorId)) continue;
    seen.add(authorId);
    await store.materialize({ projection: 'private.publisherShard', scope: { authorId, entryId } });
  }
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
function reviewVersionSummary(row: Row): JsonObject {
  const entryPatch = parseStoredEntryPatch(row);
  return {
    id: text(row.id),
    type: text(row.type),
    title: text(row.title),
    description: text(row.description),
    authorId: text(row.author_id),
    publisherId: text(row.publisher_id),
    allowPublicUpdates: bool(row.allow_public_updates, true),
    author: { id: text(row.author_id), login: text(row.author_login), avatar: text(row.author_avatar) },
    publisher: { id: text(row.publisher_id), login: text(row.publisher_login), avatar: text(row.publisher_avatar) },
    categoryId: text(row.category_id),
    stateCode: text(row.state_code),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    publishedAt: text(row.published_at),
    version: {
      id: text(row.version_id),
      entryId: text(row.id),
      version: text(row.version),
      formatVer: text(row.format_ver),
      publisherId: text(row.version_publisher_id),
      publisher: { id: text(row.version_publisher_id), login: text(row.version_publisher_login), avatar: text(row.version_publisher_avatar) },
      minAppVer: text(row.min_app_ver),
      maxAppVer: text(row.max_app_ver),
      runtimePackageId: text(row.runtime_pkg),
      stateCode: text(row.version_state_code),
      changelog: text(row.changelog),
      createdAt: text(row.version_created_at),
      updatedAt: text(row.version_updated_at),
      publishedAt: text(row.version_published_at),
      ...(entryPatch ? { entryPatch: { ...entryPatch } } : {}),
    },
  };
}
function entryDetail(entry: Row): JsonObject {
  return { ...entrySummary(entry), detail: text(entry.detail) };
}
function versionDetail(version: Row, reviewDetail?: Row): JsonObject {
  const entryPatch = parseStoredEntryPatch(version);
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
    ...(reviewDetail && text(reviewDetail.detail) ? { reviewDetail: text(reviewDetail.detail), reviewDetailUpdatedAt: text(reviewDetail.updated_at) } : {}),
    ...(entryPatch ? { entryPatch: { ...entryPatch } } : {}),
  };
}

function parseReviewDetail(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new MarketError('validation_failed', 'reviewDetail must be a string', 400);
  const detail = value.trim();
  if (!detail) return undefined;
  if (detail.length > 4000) throw new MarketError('validation_failed', 'reviewDetail exceeds 4000 character limit', 400);
  return detail;
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
function serializeEntryPatch(patch: EntryUpdateInput): string { return JSON.stringify(patch); }
function parseStoredEntryPatch(version: Row): EntryUpdateInput | undefined {
  const raw = text(version.entry_patch);
  if (!raw) return undefined;
  try {
    const patch = parseEntryUpdateInput(asRecord(JSON.parse(raw)));
    return Object.keys(patch).length > 0 ? patch : undefined;
  } catch {
    return undefined;
  }
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
async function validateArtifactVersion(env: MarketEnv, session: MarketSession, body: Record<string, unknown>): Promise<{ projectId: string; runtimePackageId: string; asset: { kind: string; url: string; ghOwner: string; ghRepo: string; ghReleaseTag: string; sha256: string; assetName: string } }> {
  const v = asRecord(body.version) as ArtifactVersionBody;
  const a = asRecord(body.asset) as unknown as ArtifactAssetBody;
  const asset = { kind: requireString(a.kind, 'asset.kind'), ghOwner: requireString(a.ghOwner, 'asset.ghOwner'), ghRepo: requireString(a.ghRepo, 'asset.ghRepo'), ghReleaseTag: requireString(a.ghReleaseTag, 'asset.ghReleaseTag'), assetName: requireString(a.assetName, 'asset.assetName'), sha256: requireSha256(a.sha256) };
  const release = await getGitHubRelease(env, asset.ghOwner, asset.ghRepo, asset.ghReleaseTag);
  if (release.authorId !== session.github_id) {
    throw new MarketError('unauthorized', 'GitHub release must be created by the current market publisher', 403);
  }
  const githubAsset = release.assets.find((candidate) => candidate.name === asset.assetName);
  if (!githubAsset) {
    throw new MarketError('validation_failed', 'GitHub release asset not found');
  }
  if (githubAsset.sha256 && githubAsset.sha256.toLowerCase() !== asset.sha256.toLowerCase()) {
    throw new MarketError('validation_failed', 'Asset sha256 does not match GitHub release metadata');
  }
  return {
    projectId: requireString(v.projectId || a.projectId, 'version.projectId'),
    runtimePackageId: requireString(v.runtimePackageId || a.runtimePackageId, 'version.runtimePackageId'),
    asset: {
      kind: asset.kind,
      url: githubAsset.browserDownloadUrl,
      ghOwner: asset.ghOwner,
      ghRepo: asset.ghRepo,
      ghReleaseTag: asset.ghReleaseTag,
      sha256: asset.sha256,
      assetName: asset.assetName,
    },
  };
}
async function getRepo(env: MarketEnv, owner: string, repo: string): Promise<GitHubRepoInfo> { return (env.mockGitHubGetRepo || realGitHubGetRepo)(owner, repo, env); }
async function getGitHubRelease(env: MarketEnv, owner: string, repo: string, tag: string): Promise<GitHubReleaseInfo> { return (env.mockGitHubGetRelease || realGitHubGetRelease)(owner, repo, tag, env); }
async function resolveRef(env: MarketEnv, owner: string, repo: string, refType: string, refName: string): Promise<string> { return (env.mockGitHubResolveRef || realGitHubResolveRef)(owner, repo, refType, refName, env); }
async function realGitHubGetRepo(owner: string, repo: string, env: MarketEnv): Promise<GitHubRepoInfo> { const response = await githubApiFetch(`/repos/${owner}/${repo}`, env); if (!response.ok) throw new MarketError('validation_failed', 'GitHub repo is not accessible'); const data = await response.json() as { owner?: { id?: number; login?: string; avatar_url?: string }; private?: boolean }; return { ownerId: Number(data.owner?.id || 0), ownerLogin: String(data.owner?.login || ''), ...(data.owner?.avatar_url !== undefined ? { ownerAvatar: data.owner.avatar_url } : {}), isPublic: !data.private }; }
async function realGitHubResolveRef(owner: string, repo: string, refType: string, refName: string, env: MarketEnv): Promise<string> { if (refType === 'commit') return refName; const response = await githubApiFetch(`/repos/${owner}/${repo}/git/${refType === 'tag' ? 'ref/tags' : 'refs/heads'}/${refName}`, env); if (!response.ok) throw new MarketError('validation_failed', 'GitHub ref cannot be resolved'); const data = await response.json() as { object?: { sha?: string } }; return requireString(data.object?.sha, 'commitSha'); }
async function realGitHubGetRelease(owner: string, repo: string, tag: string, env: MarketEnv): Promise<GitHubReleaseInfo> {
  const response = await githubApiFetch(`/repos/${owner}/${repo}/releases/tags/${tag}`, env);
  if (!response.ok) throw new MarketError('validation_failed', 'GitHub release not found');
  const data = await response.json() as {
    author?: { id?: number };
    assets?: { name?: string; browser_download_url?: string; sha256?: string; digest?: string }[];
  };
  return {
    authorId: Number(data.author?.id || 0),
    assets: (data.assets || []).flatMap((asset) => {
      const name = String(asset.name || '').trim();
      const browserDownloadUrl = String(asset.browser_download_url || '').trim();
      if (!name || !browserDownloadUrl) return [];
      const digest = asset.digest?.startsWith('sha256:') ? asset.digest.slice('sha256:'.length) : undefined;
      const sha256 = asset.sha256 || digest;
      return [{ name, browserDownloadUrl, ...(sha256 ? { sha256 } : {}) }];
    }),
  };
}
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
