import {  assertAuthorActive, requireAdminToken, requireSession, upsertAuthorFromSession, type MarketAuthor, type MarketSession } from './auth.js';
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
  myEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewApprove(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewReject(request: Request, env: MarketEnv): Promise<JsonObject>;
  reviewRequestChanges(request: Request, env: MarketEnv): Promise<JsonObject>;
  curationSet(request: Request, env: MarketEnv): Promise<JsonObject>;
}

interface VersionInput { version: string; formatVer: string; minAppVer: string; maxAppVer?: string; changelog?: string }
interface RepoVersionBody { refType: string; refName: string; manifestPath?: string; installConfig?: string; subdir?: string }
interface ArtifactAssetBody { kind: string; url: string; ghOwner: string; ghRepo: string; ghReleaseTag: string; assetName: string; sha256: string; projectId?: string; nodeId?: string; rootNodeId?: string; runtimePackageId?: string }
interface ArtifactVersionBody { projectId?: string; nodeId?: string; rootNodeId?: string; runtimePackageId?: string }

export function createEntryRoutes(): EntryRoutes {
  return { publish: handlePublish, publishProof: handlePublishProof, updateEntry: handleUpdateEntry, newVersion: handleNewVersion, resubmitEntry: handleResubmitEntry, resubmitVersion: handleResubmitVersion, deleteEntry: handleDeleteEntry, deleteVersion: handleDeleteVersion, myEntries: handleMyEntries, myEntryDetail: handleMyEntryDetail, reviewApprove: handleReviewApprove, reviewReject: handleReviewReject, reviewRequestChanges: handleReviewRequestChanges, curationSet: handleCurationSet };
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
  const versionInput = requireVersionInput(asRecord(body.version));
  if (isRepoType(type)) return publishRepoEntry(env, store, publisher, type, title, description, categoryId, versionInput, body);
  if (isArtifactType(type)) return publishArtifactEntry(env, store, session, publisher, type, title, description, categoryId, versionInput, body);
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

async function publishRepoEntry(env: MarketEnv, store: MarketStore, publisher: MarketAuthor, type: string, title: string, description: string, categoryId: string | undefined, versionInput: VersionInput, body: Record<string, unknown>): Promise<JsonObject> {
  const sourceBody = asRecord(body.source);
  const repoBody = asRecord(body.repoVersion);
  const source = normalizeGithubRepoUrl(sourceBody.url);
  const refType = normalizeRefType(repoBody.refType);
  const refName = requireString(repoBody.refName, 'repoVersion.refName');
  const repo = await getRepo(env, source.owner, source.repo);
  if (!repo.isPublic) throw new MarketError('validation_failed', 'GitHub repo must be public');
  const commitSha = await resolveRef(env, source.owner, source.repo, refType, refName);
  const subdir = optionalString(repoBody.subdir);
  const manifestPath = optionalString(repoBody.manifestPath);
  const installConfig = optionalString(repoBody.installConfig);
  const mutation = publishRepoMutation({ type, title, description, ...(categoryId !== undefined ? { categoryId } : {}), publisherId: publisher.id, authorId: `gh_${repo.ownerId}`, repoOwner: source.owner, repoName: source.repo, sourceUrl: `https://github.com/${source.owner}/${source.repo}`, refType, refName, ...(subdir !== undefined ? { subdir } : {}), ...(manifestPath !== undefined ? { manifestPath } : {}), ...(installConfig !== undefined ? { installConfig } : {}), commitSha, ...versionInput });
  const applied = await store.apply(mutation);
  return { ok: true, entryId: String(mutation.objects[0]?.id || ''), versionId: String(mutation.objects[1]?.id || ''), materialization: applied.materialization as unknown as JsonObject, stats: applied.stats as unknown as JsonObject };
}

async function publishArtifactEntry(env: MarketEnv, store: MarketStore, session: MarketSession, publisher: MarketAuthor, type: string, title: string, description: string, categoryId: string | undefined, versionInput: VersionInput, body: Record<string, unknown>): Promise<JsonObject> {
  const artifact = await validateArtifactVersion(env, session, body);
  const mutation = publishArtifactMutation({ type, title, description, ...(categoryId !== undefined ? { categoryId } : {}), publisherId: publisher.id, authorId: publisher.id, ...versionInput, projectKey: artifact.projectId, rootNodeId: artifact.rootNodeId, nodes: [{ nodeKey: artifact.nodeId, ...(artifact.runtimePackageId !== undefined ? { runtimePackageId: artifact.runtimePackageId } : {}) }], assets: [artifact.asset] });
  const applied = await store.apply(mutation);
  return { ok: true, entryId: String(mutation.objects[0]?.id || ''), versionId: String(mutation.objects[1]?.id || ''), materialization: applied.materialization as unknown as JsonObject, stats: applied.stats as unknown as JsonObject };
}

async function handleUpdateEntry(request: Request, env: MarketEnv): Promise<JsonObject> { return applyEntryState(env, request, extractIdFromPath(request.url, '/entries/', ''), 'pending', 'entry.updated'); }
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
  if (text(entry.publisher_id) !== publisher.id) throw new MarketError('unauthorized', 'Only the publisher can add versions', 403);
  const body = await readBody(request);
  const versionInput = requireVersionInput(asRecord(body.version));
  const versionId = `${entryId}-v-${versionInput.version.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const objects: MarketMutation['objects'] = [{ kind: 'Version', operation: 'create', id: versionId, value: { id: versionId, entryId, ...versionInput, stateCode: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }];
  if (isRepoType(text(entry.type))) {
    const spec = await store.d1.getRepoSpecByEntry(entryId);
    if (!spec) throw new MarketError('state_invalid', 'Repo source not found');
    const source = normalizeGithubRepoUrl(spec.source_url);
    const repoBody = asRecord(body.repoVersion);
    const refType = normalizeRefType(repoBody.refType);
    const refName = requireString(repoBody.refName, 'repoVersion.refName');
    const commitSha = await resolveRef(env, source.owner, source.repo, refType, refName);
    objects.push({ kind: 'RepoVersion' as const, operation: 'create' as const, id: `repo-version-${versionId}`, value: { id: `repo-version-${versionId}`, versionId, refType, refName, commitSha, subdir: optionalString(repoBody.subdir), manifestPath: optionalString(repoBody.manifestPath), installConfig: optionalString(repoBody.installConfig), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  }
  const applied = await store.apply({ type: 'mutation', id: `mut-new-version-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason: 'version.created', objects, effects: [{ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } }, { projection: 'entry.shard', scope: { entryId } }, { projection: 'entry.versions', scope: { entryId } }] });
  return { ok: true, entryId, versionId, stats: applied.stats as unknown as JsonObject };
}

async function handleMyEntries(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const authorId = `gh_${session.github_id}`;
  return { ok: true, entries: (await store.readProjection({ projection: 'private.publisherShard', scope: { authorId } })) as JsonObject };
}

async function handleMyEntryDetail(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const entryId = extractIdFromPath(request.url, '/entries/', '/');
  return { ok: true, item: (await store.readProjection({ projection: 'private.publisherEntry', scope: { authorId: `gh_${session.github_id}`, entryId } })) as JsonObject };
}

async function handleReviewApprove(request: Request, env: MarketEnv): Promise<JsonObject> {
  const admin = await requireAdminToken(request, env);
  const store = requireStore(env);
  const body = await readBody(request);
  const entryId = requireString(body.entryId, 'entryId');
  const versionId = optionalString(body.versionId);
  const actorId = admin.username;
  const applied = await store.apply(reviewApproveEntry({ entryId, actorId, ...(versionId !== undefined ? { versionId } : {}) }));
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
  const actorId = admin.username;
  const applied = await store.apply(curationUpdate({ entryId, actorId, listKey, position }));
  return { ok: true, entryId, listKey, stats: applied.stats as unknown as JsonObject };
}

async function applyEntryState(env: MarketEnv, request: Request, entryId: string, stateCode: string, reason: string): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const publisher = await upsertAuthorFromSession(requireDb(env), session);
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  if (text(entry.publisher_id) !== publisher.id) throw new MarketError('unauthorized', 'Not your entry', 403);
  const applied = await store.apply({ type: 'mutation', id: `mut-${reason}-${entryId}-${Date.now()}`, actor: { authorId: publisher.id, role: 'publisher' }, reason, objects: [{ kind: 'Entry', operation: 'update', id: entryId, patch: { stateCode, updatedAt: new Date().toISOString() } }], effects: [{ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } }, { projection: 'entry.shard', scope: { entryId } }] });
  return { ok: true, entryId, stateCode, stats: applied.stats as unknown as JsonObject };
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
function requireVersionInput(input: Record<string, unknown>): VersionInput {
  return { version: requireString(input.version, 'version.version'), formatVer: requireString(input.formatVer, 'version.formatVer'), minAppVer: requireString(input.minAppVer, 'version.minAppVer'), ...(input.maxAppVer !== undefined ? { maxAppVer: requireString(input.maxAppVer, 'version.maxAppVer') } : {}), ...(input.changelog !== undefined ? { changelog: requireString(input.changelog, 'version.changelog') } : {}) };
}
async function validateArtifactVersion(env: MarketEnv, session: MarketSession, body: Record<string, unknown>): Promise<{ projectId: string; nodeId: string; rootNodeId: string; runtimePackageId?: string; asset: { kind: string; url: string; sha256: string; assetName: string } }> {
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
  return { projectId: requireString(v.projectId || a.projectId, 'version.projectId'), nodeId: requireString(v.nodeId || a.nodeId, 'version.nodeId'), rootNodeId: requireString(v.rootNodeId || a.rootNodeId, 'version.rootNodeId'), ...(v.runtimePackageId !== undefined ? { runtimePackageId: String(v.runtimePackageId) } : {}), asset };
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
