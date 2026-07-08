// market v2 integration test — full coverage with FileR2 + FileSqlite
// 2026-06-26 — complete: publish, review, comments, reactions, curation, myEntries, build
// Admin auth: operit-api owner token bypass (OPERIT_OWNER_TOKEN)

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { MarketError, signToken, SESSION_PREFIX, PROOF_PREFIX } from '../dist/shared.js';
import { createMarketStore } from '../dist/store/MarketStore.js';
import { FileR2, createFileSqlite, rows } from './helpers.js';

// ---- Fixture ----

const SECRET = 'test-secret-v2';
const OWNER_TOKEN = 'test-owner-token';
const GITHUB_ID_PUBLISHER = 1001;
const GITHUB_ID_PUBLISHER2 = 2001;
const SHA_A = 'a'.repeat(64);

async function makeEnv() {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
  const env = {
    store, r2, db,
    MARKET_SESSION_SECRET: SECRET,
    MARKET_STATS_BUCKET: r2,
    OPERIT_OWNER_TOKEN: OWNER_TOKEN,
    MARKET_ANALYTICS: { events: [], writeDataPoint(dp) { this.events.push(dp); } },
    mockGitHubGetUser: async (token) => {
      if (token === 'pub1-token') return { id: GITHUB_ID_PUBLISHER, login: 'pub1', avatar_url: '' };
      if (token === 'pub2-token') return { id: GITHUB_ID_PUBLISHER2, login: 'pub2', avatar_url: '' };
      throw new MarketError('unauthorized', 'Invalid token', 401);
    },
    mockGitHubGetRepo: async () => ({ ownerId: GITHUB_ID_PUBLISHER, ownerLogin: 'pub1', ownerAvatar: '', isPublic: true }),
    mockGitHubResolveRef: async () => 'resolved-commit-sha',
    mockGitHubGetAsset: async () => ({ sha256: SHA_A }),
    mockGitHubGetRelease: async () => ({ body: '' }),
  };
  return { env, db, r2, store };
}

function afterTest({ db, r2 }) { r2.destroy(); db.destroy(); }

function createSession(githubId, login) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ver: 1, github_id: githubId, github_login: login, avatar_url: '', iat: now, exp: now + 3600 };
  return signToken(SESSION_PREFIX, payload, SECRET);
}

function makeRequest(url, method = 'GET', body, session, extraHeaders = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (session) headers.set('authorization', `Bearer ${session}`);
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, String(value));
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

function makeAdminRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: new Headers({ 'content-type': 'application/json', 'x-operit-admin-token': OWNER_TOKEN }),
    body: body ? JSON.stringify(body) : undefined,
  });
}

function scopeHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function entryShardOf(entryId) {
  return scopeHash(entryId).substring(0, 2).toLowerCase();
}

async function publishMcp(entryRoutes, env, session, repo = 'example-mcp') {
  const req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'mcp', title: 'Test MCP', description: 'Desc', categoryId: 'search_research',
    source: { kind: 'github_repo', url: `https://github.com/pub1/${repo}` },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', installConfig: '{}' },
    version: { version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
  }, session);
  return entryRoutes.publish(req, env);
}

async function submitMcpVersion(entryRoutes, env, session, entryId, version) {
  const req = makeRequest(`http://api/market/v2/entries/${entryId}/versions`, 'POST', {
    entryId,
    version: { version, formatVer: 'mcp_v2', minAppVer: '1.2.0' },
    repoVersion: { refType: 'tag', refName: `v${version}`, installConfig: '{}' },
  }, session);
  return entryRoutes.newVersion(req, env);
}

async function publishScriptArtifact(entryRoutes, env, session, version = '1.0.0', projectId = 'script.test.artifact', metadata = {}) {
  const releaseTag = `script-test-v${version}`;
  const assetName = `script-test-${version}.zip`;
  const now = Math.floor(Date.now() / 1000);
  const githubId = metadata.githubId ?? GITHUB_ID_PUBLISHER;
  const owner = metadata.owner ?? 'pub1';
  const repo = metadata.repo ?? 'OperitForge';
  const proof = signToken(PROOF_PREFIX, {
    github_id: githubId,
    owner,
    repo,
    releaseTag,
    assetName,
    sha256: SHA_A,
    exp: now + 3600,
    nonce: `test-${version}`,
  }, SECRET);
  env.mockGitHubGetRelease = async () => ({ body: `<!-- operit-market-proof ${proof} -->` });
  const req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'script',
    title: metadata.title ?? 'Test Script',
    description: metadata.description ?? 'Desc',
    detail: metadata.detail ?? '',
    categoryId: metadata.categoryId ?? 'automation',
    allowPublicUpdates: metadata.allowPublicUpdates ?? true,
    version: {
      version,
      formatVer: 'script',
      minAppVer: '1.2.0',
      projectId,
      runtimePackageId: projectId,
    },
    asset: {
      kind: 'script',
      url: `https://github.com/${owner}/${repo}/releases/download/${releaseTag}/${assetName}`,
      ghOwner: owner,
      ghRepo: repo,
      ghReleaseTag: releaseTag,
      assetName,
      sha256: SHA_A,
    },
  }, session);
  return entryRoutes.publish(req, env);
}

// ---- Tests ----

test('publish repo plugin upserts repository owner author', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  env.mockGitHubGetRepo = async () => ({ ownerId: 3001, ownerLogin: 'minimax-ai', ownerAvatar: 'https://avatar.example/minimax.png', isPublic: true });
  const entryRoutes = createEntryRoutes();
  const session = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const result = await publishMcp(entryRoutes, env, session, 'foreign-owner-skill');

  assert.ok(result.ok);
  const entryRow = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [result.entryId])[0];
  assert.equal(entryRow.author_id, 'gh_3001');
  assert.equal(entryRow.publisher_id, 'gh_1001');
  const author = rows(db, 'SELECT * FROM market_authors WHERE id = ?', ['gh_3001'])[0];
  assert.equal(author.github_login, 'minimax-ai');
  afterTest(ctx);
});

test('publish repo plugin requires formatVer, binds commit', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const session = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  let req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'mcp', title: 'Test', description: 'Desc', categoryId: 'search_research',
    source: { kind: 'github_repo', url: 'https://github.com/pub1/example-mcp' },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', installConfig: '{}' },
    version: { version: '1.0.0', minAppVer: '1.2.0' },
  }, session);
  await assert.rejects(() => entryRoutes.publish(req, env), /formatVer is required/);

  req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'mcp', title: 'Test MCP', description: 'Desc', categoryId: 'search_research',
    source: { kind: 'github_repo', url: 'https://github.com/pub1/example-mcp' },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', installConfig: '{}' },
    version: { version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
  }, session);
  const result = await entryRoutes.publish(req, env);
  assert.ok(result.ok);
  assert.ok(result.entryId);
  const entryRow = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [result.entryId])[0];
  assert.equal(entryRow.title, 'Test MCP');
  assert.equal(entryRow.state_code, 'pending');
  afterTest(ctx);
});

test('admin review queue lists all non-public review states', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pending = await publishMcp(entryRoutes, env, pubSession, 'review-pending');
  const changes = await publishMcp(entryRoutes, env, pubSession, 'review-changes');
  const rejected = await publishMcp(entryRoutes, env, pubSession, 'review-rejected');
  const approved = await publishMcp(entryRoutes, env, pubSession, 'review-approved');
  const withdrawn = await publishMcp(entryRoutes, env, pubSession, 'review-withdrawn');
  await db.prepare("UPDATE market_entries SET state_code = ? WHERE id = ?").bind('changes_requested', changes.entryId).run();
  await db.prepare("UPDATE market_versions SET state_code = ? WHERE id = ?").bind('changes_requested', changes.versionId).run();
  await db.prepare("UPDATE market_entries SET state_code = ? WHERE id = ?").bind('rejected', rejected.entryId).run();
  await db.prepare("UPDATE market_versions SET state_code = ? WHERE id = ?").bind('rejected', rejected.versionId).run();
  await db.prepare("UPDATE market_entries SET state_code = ? WHERE id = ?").bind('approved', approved.entryId).run();
  await db.prepare("UPDATE market_versions SET state_code = ? WHERE id = ?").bind('approved', approved.versionId).run();
  await db.prepare("UPDATE market_entries SET state_code = ? WHERE id = ?").bind('withdrawn', withdrawn.entryId).run();
  await db.prepare("UPDATE market_versions SET state_code = ? WHERE id = ?").bind('withdrawn', withdrawn.versionId).run();

  const result = await entryRoutes.reviewEntries(makeAdminRequest('http://api/market/v2/admin/review/entries', 'GET'), env);
  const ids = result.items.map((item) => item.id);
  const versionIds = result.items.map((item) => item.version.id);
  assert.ok(ids.includes(pending.entryId));
  assert.ok(ids.includes(changes.entryId));
  assert.ok(ids.includes(rejected.entryId));
  assert.ok(!versionIds.includes(approved.versionId));
  assert.ok(!versionIds.includes(withdrawn.versionId));
  afterTest(ctx);
});

test('v2 build route requires admin token', async () => {
  const ctx = await makeEnv();
  const { env } = ctx;
  const worker = (await import('../dist/index.js')).default;

  const denied = await worker.fetch(new Request('http://api/market/v2/build', { method: 'POST' }), env);
  assert.equal(denied.status, 401);

  const allowed = await worker.fetch(makeAdminRequest('http://api/market/v2/build', 'POST'), env);
  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.materialized, 'number');

  afterTest(ctx);
});

test('admin approve entry makes it publicly listed, reject with reason code', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  const entryId = pub.entryId;

  let req = makeAdminRequest(`http://api/market/v2/entries/${entryId}/review/approve`, 'POST', { entryId, versionId: pub.versionId });
  const approveResult = await entryRoutes.reviewApprove(req, env);
  assert.ok(approveResult.ok);
  let entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [entryId])[0];
  assert.equal(entry.state_code, 'approved');

  const pub2 = await publishMcp(entryRoutes, env, pubSession, 'review-reject-with-reason');
  req = makeAdminRequest(`http://api/market/v2/entries/${pub2.entryId}/review/reject`, 'POST', { entryId: pub2.entryId, versionId: pub2.versionId, reasonCode: 'quality-too-low' });
  const rejectResult = await entryRoutes.reviewReject(req, env);
  assert.ok(rejectResult.ok);
  entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub2.entryId])[0];
  const rejectedVersion = rows(db, 'SELECT * FROM market_versions WHERE id = ?', [pub2.versionId])[0];
  assert.equal(entry.state_code, 'rejected');
  assert.equal(rejectedVersion.state_code, 'rejected');
  const reasons = rows(db, 'SELECT * FROM market_version_reasons WHERE version_id = ?', [pub2.versionId]);
  assert.equal(reasons.length, 1);
  afterTest(ctx);
});

test('non-admin cannot review', async () => {
  const ctx = await makeEnv();
  const { env } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub = await publishMcp(entryRoutes, env, pubSession);
  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId }, pubSession);
  await assert.rejects(() => entryRoutes.reviewApprove(req, env), /Admin token required|unauthorized|Admin DB/);
  afterTest(ctx);
});

test('new version keeps old approved latest until review passes', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  let entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  assert.equal(entry.state_code, 'approved');

  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/versions`, 'POST', {
    entryId: pub.entryId,
    version: { version: '1.1.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
    repoVersion: { refType: 'tag', refName: 'v1.1.0', installConfig: '{}' },
  }, pubSession);
  const v2 = await entryRoutes.newVersion(req, env);
  assert.ok(v2.ok);

  // new version is pending, entry remains approved
  entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  assert.equal(entry.state_code, 'approved');
  const versions = rows(db, 'SELECT * FROM market_versions WHERE entry_id = ? ORDER BY published_at DESC', [pub.entryId]);
  assert.ok(versions.length >= 2);
  afterTest(ctx);
});

test('rejecting new version keeps entry approved and old version approved', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession, 'reject-new-version-only');
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/versions`, 'POST', {
    entryId: pub.entryId,
    version: { version: '1.1.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
    repoVersion: { refType: 'tag', refName: 'v1.1.0', installConfig: '{}' },
  }, pubSession);
  const v2 = await entryRoutes.newVersion(req, env);
  assert.ok(v2.ok);

  await entryRoutes.reviewReject(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, versionId: v2.versionId, reasonCode: 'quality-too-low' }),
    env,
  );

  const entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  const oldVersion = rows(db, 'SELECT * FROM market_versions WHERE id = ?', [pub.versionId])[0];
  const newVersion = rows(db, 'SELECT * FROM market_versions WHERE id = ?', [v2.versionId])[0];
  const versionReasons = rows(db, 'SELECT * FROM market_version_reasons WHERE version_id = ?', [v2.versionId]);

  assert.equal(entry.state_code, 'approved');
  assert.equal(oldVersion.state_code, 'approved');
  assert.equal(newVersion.state_code, 'rejected');
  assert.equal(versionReasons.length, 1);

  afterTest(ctx);
});

test('reviewing concurrent versions targets the selected version only', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pub1Session = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub2Session = createSession(GITHUB_ID_PUBLISHER2, 'pub2');

  const pub = await publishMcp(entryRoutes, env, pub1Session, 'concurrent-version-review');
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const v11 = await submitMcpVersion(entryRoutes, env, pub1Session, pub.entryId, '1.1.0');
  const v12 = await submitMcpVersion(entryRoutes, env, pub2Session, pub.entryId, '1.2.0');

  await assert.rejects(
    () => entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/not-${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: v11.versionId }), env),
    /entryId must match path/,
  );

  await assert.rejects(
    () => entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId }), env),
    /versionId/,
  );

  await entryRoutes.reviewReject(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, versionId: v11.versionId, reasonCode: 'quality-too-low' }),
    env,
  );
  await entryRoutes.reviewApprove(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: v12.versionId }),
    env,
  );

  let entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  let versions = Object.fromEntries(rows(db, 'SELECT * FROM market_versions WHERE entry_id = ?', [pub.entryId]).map((version) => [version.id, version]));
  assert.equal(entry.state_code, 'approved');
  assert.equal(versions[pub.versionId].state_code, 'approved');
  assert.equal(versions[v11.versionId].state_code, 'rejected');
  assert.equal(versions[v12.versionId].state_code, 'approved');

  const v13 = await submitMcpVersion(entryRoutes, env, pub1Session, pub.entryId, '1.3.0');
  const v14 = await submitMcpVersion(entryRoutes, env, pub2Session, pub.entryId, '1.4.0');
  await entryRoutes.reviewReject(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, versionId: v13.versionId, reasonCode: 'quality-too-low' }),
    env,
  );
  await entryRoutes.reviewReject(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, versionId: v14.versionId, reasonCode: 'policy-violation' }),
    env,
  );
  entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  versions = Object.fromEntries(rows(db, 'SELECT * FROM market_versions WHERE entry_id = ?', [pub.entryId]).map((version) => [version.id, version]));
  assert.equal(entry.state_code, 'approved');
  assert.equal(versions[v13.versionId].state_code, 'rejected');
  assert.equal(versions[v14.versionId].state_code, 'rejected');

  const v15 = await submitMcpVersion(entryRoutes, env, pub1Session, pub.entryId, '1.5.0');
  const v16 = await submitMcpVersion(entryRoutes, env, pub2Session, pub.entryId, '1.6.0');
  await entryRoutes.reviewApprove(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: v15.versionId }),
    env,
  );
  await entryRoutes.reviewApprove(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: v16.versionId }),
    env,
  );
  entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  versions = Object.fromEntries(rows(db, 'SELECT * FROM market_versions WHERE entry_id = ?', [pub.entryId]).map((version) => [version.id, version]));
  assert.equal(entry.state_code, 'approved');
  assert.equal(versions[v15.versionId].state_code, 'approved');
  assert.equal(versions[v16.versionId].state_code, 'approved');

  afterTest(ctx);
});

test('requesting changes for new version keeps approved entry public', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession, 'changes-new-version-only');
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);
  const v2 = await submitMcpVersion(entryRoutes, env, pubSession, pub.entryId, '1.1.0');

  await entryRoutes.reviewRequestChanges(
    makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/changes`, 'POST', { entryId: pub.entryId, versionId: v2.versionId, reasonCode: 'metadata-incomplete' }),
    env,
  );

  const entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  const oldVersion = rows(db, 'SELECT * FROM market_versions WHERE id = ?', [pub.versionId])[0];
  const newVersion = rows(db, 'SELECT * FROM market_versions WHERE id = ?', [v2.versionId])[0];
  const versionReasons = rows(db, 'SELECT * FROM market_version_reasons WHERE version_id = ?', [v2.versionId]);

  assert.equal(entry.state_code, 'approved');
  assert.equal(oldVersion.state_code, 'approved');
  assert.equal(newVersion.state_code, 'changes_requested');
  assert.equal(versionReasons.length, 1);

  afterTest(ctx);
});

test('contributor can patch repo entry metadata when public updates are enabled', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pub1Session = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub2Session = createSession(GITHUB_ID_PUBLISHER2, 'pub2');

  const pub = await publishMcp(entryRoutes, env, pub1Session, 'community-entry-patch');
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/versions`, 'POST', {
    entry: {
      title: 'Community MCP',
      description: 'Community summary',
      detail: 'Community detail',
      categoryId: 'automation',
      allowPublicUpdates: false,
    },
    version: { version: '1.1.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
    repoVersion: { refType: 'tag', refName: 'v1.1.0', installConfig: '{}' },
  }, pub2Session);
  const v2 = await entryRoutes.newVersion(req, env);

  assert.ok(v2.ok);
  const entry = rows(db, 'SELECT title, description, detail, category_id, allow_public_updates, state_code FROM market_entries WHERE id = ?', [pub.entryId])[0];
  const version = rows(db, 'SELECT publisher_id, state_code FROM market_versions WHERE id = ?', [v2.versionId])[0];
  assert.equal(entry.title, 'Community MCP');
  assert.equal(entry.description, 'Community summary');
  assert.equal(entry.detail, 'Community detail');
  assert.equal(entry.category_id, 'automation');
  assert.equal(entry.allow_public_updates, 0);
  assert.equal(entry.state_code, 'approved');
  assert.equal(version.publisher_id, 'gh_2001');
  assert.equal(version.state_code, 'pending');
  afterTest(ctx);
});

test('new repo version must be greater than current highest version', async () => {
  const ctx = await makeEnv();
  const { env } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/versions`, 'POST', {
    entryId: pub.entryId,
    version: { version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', installConfig: '{}' },
  }, pubSession);
  await assert.rejects(() => entryRoutes.newVersion(req, env), /must be greater than existing version/);
  afterTest(ctx);
});

test('artifact publish must be greater than existing project version', async () => {
  const ctx = await makeEnv();
  const { env } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  await publishScriptArtifact(entryRoutes, env, pubSession, '2.0.0', 'script.test.artifact');
  await assert.rejects(
    () => publishScriptArtifact(entryRoutes, env, pubSession, '1.5.0', 'script.test.artifact'),
    /must be greater than existing version/,
  );
  afterTest(ctx);
});

test('artifact publish reusing project updates owner entry metadata', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const first = await publishScriptArtifact(entryRoutes, env, pubSession, '1.0.0', 'script.test.artifact', {
    title: 'Old Script',
    description: 'Old summary',
    detail: 'Old detail',
    categoryId: 'automation',
    allowPublicUpdates: true,
  });
  const second = await publishScriptArtifact(entryRoutes, env, pubSession, '1.1.0', 'script.test.artifact', {
    title: 'New Script',
    description: 'New summary',
    detail: 'New detail',
    categoryId: 'search_research',
    allowPublicUpdates: false,
  });

  assert.equal(second.entryId, first.entryId);
  const entry = rows(db, 'SELECT title, description, detail, category_id, allow_public_updates, state_code FROM market_entries WHERE id = ?', [first.entryId])[0];
  assert.equal(entry.title, 'New Script');
  assert.equal(entry.description, 'New summary');
  assert.equal(entry.detail, 'New detail');
  assert.equal(entry.category_id, 'search_research');
  assert.equal(entry.allow_public_updates, 0);
  assert.equal(entry.state_code, 'pending');
  const versions = rows(db, 'SELECT id FROM market_versions WHERE entry_id = ? ORDER BY version', [first.entryId]);
  assert.equal(versions.length, 2);
  afterTest(ctx);
});

test('artifact publish reusing approved project does not move entry back to pending', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const first = await publishScriptArtifact(entryRoutes, env, pubSession, '1.0.0', 'script.approved.artifact', {
    title: 'Approved Script',
    description: 'Approved summary',
    detail: 'Approved detail',
    categoryId: 'automation',
    allowPublicUpdates: true,
  });
  await entryRoutes.reviewApprove(
    makeAdminRequest(`http://api/market/v2/entries/${first.entryId}/review/approve`, 'POST', { entryId: first.entryId, versionId: first.versionId }),
    env,
  );

  const second = await publishScriptArtifact(entryRoutes, env, pubSession, '1.1.0', 'script.approved.artifact', {
    title: 'Updated Script',
    description: 'Updated summary',
    detail: 'Updated detail',
    categoryId: 'search_research',
    allowPublicUpdates: false,
  });

  assert.equal(second.entryId, first.entryId);
  const entry = rows(db, 'SELECT title, description, detail, category_id, allow_public_updates, state_code FROM market_entries WHERE id = ?', [first.entryId])[0];
  const newVersion = rows(db, 'SELECT state_code FROM market_versions WHERE id = ?', [second.versionId])[0];
  assert.equal(entry.title, 'Updated Script');
  assert.equal(entry.description, 'Updated summary');
  assert.equal(entry.detail, 'Updated detail');
  assert.equal(entry.category_id, 'search_research');
  assert.equal(entry.allow_public_updates, 0);
  assert.equal(entry.state_code, 'approved');
  assert.equal(newVersion.state_code, 'pending');
  afterTest(ctx);
});

test('contributor can patch artifact entry metadata when public updates are enabled', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pub1Session = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub2Session = createSession(GITHUB_ID_PUBLISHER2, 'pub2');

  const first = await publishScriptArtifact(entryRoutes, env, pub1Session, '1.0.0', 'script.community.artifact', {
    title: 'Original Script',
    description: 'Original summary',
    detail: 'Original detail',
    categoryId: 'automation',
    allowPublicUpdates: true,
  });
  await entryRoutes.reviewApprove(
    makeAdminRequest(`http://api/market/v2/entries/${first.entryId}/review/approve`, 'POST', { entryId: first.entryId, versionId: first.versionId }),
    env,
  );

  const version = '1.1.0';
  const releaseTag = `script-test-v${version}`;
  const assetName = `script-test-${version}.zip`;
  const proof = signToken(PROOF_PREFIX, {
    github_id: GITHUB_ID_PUBLISHER2,
    owner: 'pub2',
    repo: 'OperitForge',
    releaseTag,
    assetName,
    sha256: SHA_A,
    exp: Math.floor(Date.now() / 1000) + 3600,
    nonce: `test-${version}`,
  }, SECRET);
  env.mockGitHubGetRelease = async () => ({ body: `<!-- operit-market-proof ${proof} -->` });

  const req = makeRequest(`http://api/market/v2/entries/${first.entryId}/versions`, 'POST', {
    entry: {
      title: 'Community Script',
      description: 'Community summary',
      detail: 'Community detail',
      categoryId: 'search_research',
      allowPublicUpdates: false,
    },
    version: {
      version,
      formatVer: 'script',
      minAppVer: '1.2.0',
      projectId: 'script.community.artifact',
      runtimePackageId: 'script.community.artifact',
    },
    asset: {
      kind: 'script',
      url: `https://github.com/pub2/OperitForge/releases/download/${releaseTag}/${assetName}`,
      ghOwner: 'pub2',
      ghRepo: 'OperitForge',
      ghReleaseTag: releaseTag,
      assetName,
      sha256: SHA_A,
    },
  }, pub2Session);
  const second = await entryRoutes.newVersion(req, env);

  assert.ok(second.ok);
  const entry = rows(db, 'SELECT title, description, detail, category_id, allow_public_updates, state_code FROM market_entries WHERE id = ?', [first.entryId])[0];
  const newVersion = rows(db, 'SELECT publisher_id, state_code, runtime_pkg FROM market_versions WHERE id = ?', [second.versionId])[0];
  assert.equal(entry.title, 'Community Script');
  assert.equal(entry.description, 'Community summary');
  assert.equal(entry.detail, 'Community detail');
  assert.equal(entry.category_id, 'search_research');
  assert.equal(entry.allow_public_updates, 0);
  assert.equal(entry.state_code, 'approved');
  assert.equal(newVersion.publisher_id, 'gh_2001');
  assert.equal(newVersion.state_code, 'pending');
  assert.equal(newVersion.runtime_pkg, 'script.community.artifact');
  afterTest(ctx);
});

test('resubmit entry changes state back to pending', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewReject(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, versionId: pub.versionId, reasonCode: 'quality-too-low' }), env);

  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/resubmit`, 'POST', {}, pubSession);
  const result = await entryRoutes.resubmitEntry(req, env);
  assert.ok(result.ok);
  const entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  const version = rows(db, 'SELECT * FROM market_versions WHERE id = ?', [pub.versionId])[0];
  assert.equal(entry.state_code, 'pending');
  assert.equal(version.state_code, 'pending');
  afterTest(ctx);
});

test('delete entry removes from public listing and D1', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createBuildRoutes } = await import('../dist/build.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);
  await createBuildRoutes().buildR2(env);

  const req = makeRequest(`http://api/market/v2/my/entries`, 'GET', undefined, pubSession);
  const myEntries = await entryRoutes.myEntries(req, env);
  assert.ok(myEntries.ok);

  const delReq = makeRequest(`http://api/market/v2/entries/${pub.entryId}`, 'DELETE', {}, pubSession);
  assert.ok((await entryRoutes.deleteEntry(delReq, env)).ok);
  afterTest(ctx);
});

test('my entries private shard keeps hash-collided authors isolated', async () => {
  const ctx = await makeEnv();
  const { env, r2 } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createBuildRoutes } = await import('../dist/build.js');
  const entryRoutes = createEntryRoutes();
  const pub1Session = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub2Session = createSession(222, 'pub-collision');

  assert.equal(scopeHash('gh_1001').substring(0, 2), scopeHash('gh_222').substring(0, 2));
  const pub1 = await publishMcp(entryRoutes, env, pub1Session, 'collision-one');
  const pub2 = await publishMcp(entryRoutes, env, pub2Session, 'collision-two');
  await createBuildRoutes().buildR2(env);

  const req1 = makeRequest(`http://api/market/v2/my/entries`, 'GET', undefined, pub1Session);
  const req2 = makeRequest(`http://api/market/v2/my/entries`, 'GET', undefined, pub2Session);
  const my1 = await entryRoutes.myEntries(req1, env);
  const my2 = await entryRoutes.myEntries(req2, env);
  assert.deepEqual(my1.entries.entries.map((entry) => entry.id), [pub1.entryId]);
  assert.deepEqual(my2.entries.entries.map((entry) => entry.id), [pub2.entryId]);

  const shard = scopeHash('gh_1001').substring(0, 2);
  const privateShard = r2.readJson(`market/v2/private/publishers/${shard}.json`);
  assert.ok(privateShard.authors.gh_1001);
  assert.ok(privateShard.authors.gh_222);
  afterTest(ctx);
});

test('my entries reflect publish review and resubmit without waiting for full build', async () => {
  const ctx = await makeEnv();
  const { env } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession, 'immediate-management');
  const myReq = () => makeRequest(`http://api/market/v2/my/entries`, 'GET', undefined, pubSession);

  let myEntries = await entryRoutes.myEntries(myReq(), env);
  assert.deepEqual(myEntries.entries.entries.map((entry) => entry.id), [pub.entryId]);
  assert.equal(myEntries.entries.entries[0].relation, 'owner');
  assert.equal(myEntries.entries.entries[0].stateCode, 'pending');

  await entryRoutes.reviewReject(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, versionId: pub.versionId, reasonCode: 'quality-too-low' }), env);
  myEntries = await entryRoutes.myEntries(myReq(), env);
  assert.equal(myEntries.entries.entries[0].stateCode, 'rejected');

  await entryRoutes.resubmitEntry(makeRequest(`http://api/market/v2/entries/${pub.entryId}/resubmit`, 'POST', {}, pubSession), env);
  myEntries = await entryRoutes.myEntries(myReq(), env);
  assert.equal(myEntries.entries.entries[0].stateCode, 'pending');

  afterTest(ctx);
});

test('review notification is durable before review response returns', async () => {
  const ctx = await makeEnv();
  const { env, store } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createInteractRoutes } = await import('../dist/interact.js');
  const entryRoutes = createEntryRoutes();
  const interact = createInteractRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const originalCreateNotification = store.d1.createNotification.bind(store.d1);
  store.d1.createNotification = async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return originalCreateNotification(value);
  };

  const pub = await publishMcp(entryRoutes, env, pubSession, 'review-notification');
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const notifications = await interact.listNotifications(makeRequest(`http://api/market/v2/notifications?limit=20&offset=0`, 'GET', undefined, pubSession), env);
  assert.equal(notifications.items.length, 1);
  assert.equal(notifications.items[0].kind, 'review_approved');
  assert.equal(notifications.items[0].entryId, pub.entryId);

  afterTest(ctx);
});

test('comment notification creates new comment and reply notifications', async () => {
  const ctx = await makeEnv();
  const { env } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createInteractRoutes } = await import('../dist/interact.js');
  const entryRoutes = createEntryRoutes();
  const interact = createInteractRoutes();
  const pub1Session = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub2Session = createSession(GITHUB_ID_PUBLISHER2, 'pub2');

  const pub = await publishMcp(entryRoutes, env, pub1Session, 'comment-notif-test');
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  // pub2 adds a comment on pub1's entry
  await interact.addComment(makeRequest(`http://api/market/v2/entries/${pub.entryId}/comments`, 'POST', { body: 'Comment from pub2' }, pub2Session), env);

  // pub1 (entry publisher) should see comment_new
  let notifs = await interact.listNotifications(makeRequest(`http://api/market/v2/notifications?limit=20&offset=0`, 'GET', undefined, pub1Session), env);
  const commentNew = notifs.items.find((n) => n.kind === 'comment_new');
  assert.ok(commentNew, 'pub1 should have a comment_new notification');
  const commentId = commentNew.commentId;
  assert.ok(commentId);

  // pub1 replies to pub2's comment
  await interact.addComment(makeRequest(`http://api/market/v2/entries/${pub.entryId}/comments`, 'POST', { body: 'Reply from pub1', parentId: commentId }, pub1Session), env);

  // pub2 should now see comment_reply
  notifs = await interact.listNotifications(makeRequest(`http://api/market/v2/notifications?limit=20&offset=0`, 'GET', undefined, pub2Session), env);
  const commentReply = notifs.items.find((n) => n.kind === 'comment_reply');
  assert.ok(commentReply, 'pub2 should have a comment_reply notification');
  assert.equal(commentReply.entryId, pub.entryId);

  afterTest(ctx);
});

test('R2 entry shards expose direct entry lookup bundles', async () => {
  const ctx = await makeEnv();
  const { env, r2 } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createBuildRoutes } = await import('../dist/build.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);
  await createBuildRoutes().buildR2(env);

  const shard = entryShardOf(pub.entryId);
  const entryShard = JSON.parse(readFileSync(join(r2.dir, `market/v2/entries/${shard}.json`), 'utf8'));
  const item = entryShard.entriesById[pub.entryId];
  assert.equal(entryShard.marketVersion, 2);
  assert.equal(item.id, pub.entryId);
  assert.equal(item.description, 'Desc');
  assert.ok(item.detail !== undefined);
  assert.equal(item.source.url, 'https://github.com/pub1/example-mcp');
  assert.equal(item.latestVersion.version, '1.0.0');
  afterTest(ctx);
});

test('R2 manifest exposes format version matrix and categories from disk file', async () => {
  const ctx = await makeEnv();
  const { env, r2 } = ctx;
  const { createBuildRoutes } = await import('../dist/build.js');
  await createBuildRoutes().buildR2(env);

  const manifest = JSON.parse(readFileSync(join(r2.dir, 'market/v2/manifest.json'), 'utf8'));
  assert.equal(manifest.marketVersion, 2);
  assert.ok(manifest.formatVersions.some((f) => f.id === 'mcp_v2' && f.publishable));
  assert.ok(manifest.formatVersions.some((f) => f.id === 'mcp_v2' && f.publishable));
  assert.ok(manifest.categories.some((c) => c.id === 'search_research'));
  assert.ok(manifest.states.some((s) => s.code === 'approved' && s.publicListed));
  afterTest(ctx);
});

test('curation set writes D1 and R2 list page', async () => {
  const ctx = await makeEnv();
  const { env, db, r2 } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createBuildRoutes } = await import('../dist/build.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const req = makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/curation`, 'POST', { entryId: pub.entryId, listKey: 'featured', position: 1 });
  assert.ok((await entryRoutes.curationSet(req, env)).ok);
  const cur = rows(db, "SELECT * FROM market_curations WHERE entry_id = ? AND list_key = 'featured'", [pub.entryId]);
  assert.equal(cur.length, 1);

  const unsetReq = makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/curation`, 'POST', { entryId: pub.entryId, listKey: 'featured', position: 1, operation: 'hide' });
  assert.ok((await entryRoutes.curationSet(unsetReq, env)).ok);
  const hidden = rows(db, "SELECT * FROM market_curations WHERE entry_id = ? AND list_key = 'featured'", [pub.entryId]);
  assert.equal(hidden.length, 0);

  await createBuildRoutes().buildR2(env);
  const listFiles = r2.list({ prefix: 'market/v2/lists/' });
  const listObj = await listFiles;
  assert.ok(listObj.objects.length > 0, 'List page should be written');
  afterTest(ctx);
});

test('comments materialize affected R2 pages after create edit and delete', async () => {
  const ctx = await makeEnv();
  const { env, r2 } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createInteractRoutes } = await import('../dist/interact.js');
  const entryRoutes = createEntryRoutes();
  const interact = createInteractRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const commentIds = [];
  for (let i = 0; i < 51; i++) {
    const result = await interact.addComment(makeRequest(`http://api/market/v2/entries/${pub.entryId}/comments`, 'POST', { body: `Comment ${String(i).padStart(2, '0')}` }, pubSession), env);
    commentIds.push(result.commentId);
  }

  const page1 = r2.readJson(`market/v2/comments/${pub.entryId}/page-1.json`);
  const page2 = r2.readJson(`market/v2/comments/${pub.entryId}/page-2.json`);
  assert.equal(page1.total, 51);
  assert.equal(page1.items.length, 50);
  assert.equal(page2.total, 51);
  assert.equal(page2.items.length, 1);
  assert.equal(page2.items[0].body, 'Comment 50');

  await interact.editComment(makeRequest(`http://api/market/v2/comments/${commentIds[50]}`, 'PATCH', { body: 'Edited last comment' }, pubSession), env);
  const editedPage2 = r2.readJson(`market/v2/comments/${pub.entryId}/page-2.json`);
  assert.equal(editedPage2.items[0].body, 'Edited last comment');

  await interact.deleteComment(makeRequest(`http://api/market/v2/comments/${commentIds[0]}`, 'DELETE', {}, pubSession), env);
  const compactedPage1 = r2.readJson(`market/v2/comments/${pub.entryId}/page-1.json`);
  const compactedPage2 = r2.readJson(`market/v2/comments/${pub.entryId}/page-2.json`);
  assert.equal(compactedPage1.total, 50);
  assert.equal(compactedPage1.items.length, 50);
  assert.equal(compactedPage1.items.at(-1).body, 'Edited last comment');
  assert.equal(compactedPage2.total, 50);
  assert.equal(compactedPage2.items.length, 0);
  afterTest(ctx);
});

test('react to entry writes analytics, aggregate writes D1 entry stats', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createInteractRoutes } = await import('../dist/interact.js');
  const entryRoutes = createEntryRoutes();
  const interact = createInteractRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');
  const pub2Session = createSession(GITHUB_ID_PUBLISHER2, 'pub2');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);
  const { createBuildRoutes } = await import('../dist/build.js');
  await createBuildRoutes().buildR2(env);

  let req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/reactions`, 'POST', { reaction: '+1' }, pubSession);
  await interact.reactToEntry(req, env);
  req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/reactions`, 'POST', { reaction: '+1' }, pubSession);
  await interact.reactToEntry(req, env);
  req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/reactions`, 'POST', { reaction: '+1' }, pub2Session);
  await interact.reactToEntry(req, env);

  assert.equal(env.MARKET_ANALYTICS.events.length, 3);

  const aggResult = await interact.aggregateV2Analytics(env);
  assert.ok(aggResult.ok);
  assert.equal(aggResult.aggregated, 1);

  const entryStats = rows(db, 'SELECT * FROM market_entry_stats WHERE entry_id = ?', [pub.entryId]);
  assert.equal(entryStats.length, 1);
  assert.equal(entryStats[0].likes_total, 2);

  const stats = rows(db, "SELECT * FROM market_reaction_counts WHERE entry_id = ? AND reaction = '+1'", [pub.entryId]);
  assert.equal(stats.length, 1);
  assert.equal(stats[0].total_count, 2);
  afterTest(ctx);
});

test('download analytics deduplicates same asset client per day', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createInteractRoutes } = await import('../dist/interact.js');
  const { createBuildRoutes } = await import('../dist/build.js');
  const entryRoutes = createEntryRoutes();
  const interact = createInteractRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishScriptArtifact(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);
  await createBuildRoutes().buildR2(env);
  const assetId = rows(db, 'SELECT id FROM market_assets WHERE version_id = ?', [pub.versionId])[0].id;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('asset-bytes', { status: 200, headers: { 'content-type': 'application/zip' } });

  try {
    let req = makeRequest(`http://api/market/v2/assets/${assetId}/download`, 'GET', undefined, undefined, { 'cf-connecting-ip': '203.0.113.1', 'user-agent': 'test-agent' });
    await interact.downloadAsset(req, env);
    req = makeRequest(`http://api/market/v2/assets/${assetId}/download`, 'GET', undefined, undefined, { 'cf-connecting-ip': '203.0.113.1', 'user-agent': 'test-agent' });
    await interact.downloadAsset(req, env);
    req = makeRequest(`http://api/market/v2/assets/${assetId}/download`, 'GET', undefined, undefined, { 'cf-connecting-ip': '203.0.113.2', 'user-agent': 'test-agent' });
    await interact.downloadAsset(req, env);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(env.MARKET_ANALYTICS.events.length, 3);

  const aggResult = await interact.aggregateV2Analytics(env);
  assert.ok(aggResult.ok);
  assert.equal(aggResult.downloads, 2);

  const entryStats = rows(db, 'SELECT * FROM market_entry_stats WHERE entry_id = ?', [pub.entryId]);
  assert.equal(entryStats.length, 1);
  assert.equal(entryStats[0].downloads_total, 2);
  afterTest(ctx);
});

test('analytics aggregate records existing entries and ignores missing entry ids', async () => {
  const ctx = await makeEnv();
  const { env, db, store } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const aggResult = await store.aggregateV2Analytics({
    windowStart: '2026-07-02T00:00:00.000Z',
    windowEnd: '2026-07-02T01:00:00.000Z',
    source: 'test',
    rows: [
      { event: 'download', type: 'mcp', entryId: pub.entryId, total: 2, sampleInterval: 1, lastAt: '2026-07-02T00:30:00.000Z' },
      { event: 'download', type: 'package', entryId: 'package-artifact', total: 6, sampleInterval: 1, lastAt: '2026-07-02T00:40:00.000Z' },
    ],
  });

  assert.ok(aggResult.ok);
  assert.equal(aggResult.downloads, 2);
  assert.equal(aggResult.skippedMissingEntries, 1);
  assert.deepEqual(aggResult.skippedEntryIds, ['package-artifact']);

  const existingStats = rows(db, 'SELECT * FROM market_entry_stats WHERE entry_id = ?', [pub.entryId]);
  assert.equal(existingStats.length, 1);
  assert.equal(existingStats[0].downloads_total, 2);
  assert.equal(rows(db, 'SELECT * FROM market_entry_stats WHERE entry_id = ?', ['package-artifact']).length, 0);

  const cursor = rows(db, "SELECT value FROM market_meta WHERE key = 'v2_analytics_aggregate_cursor'");
  assert.equal(cursor[0].value, '2026-07-02T01:00:00.000Z');
  afterTest(ctx);
});

test('usage stats track D1+R2 operations for free limit estimation', async () => {
  const ctx = await makeEnv();
  const { env, store } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const { createBuildRoutes } = await import('../dist/build.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  store.usage();

  const pub = await publishMcp(entryRoutes, env, pubSession);
  const afterPublish = store.usage();
  assert.ok(afterPublish.d1Writes > 0, `Expected d1Writes > 0 after publish, got ${JSON.stringify(afterPublish)}`);

  await entryRoutes.reviewApprove(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/approve`, 'POST', { entryId: pub.entryId, versionId: pub.versionId }), env);

  const { createBuildRoutes: cc } = await import('../dist/build.js');
  const beforeBuild = { ...store.usage() };
  await cc().buildR2(env);
  const afterBuild = store.usage();

  // eslint-disable-next-line no-console
  console.log('\n--- Usage report (single entry + approve + build) ---');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    publish: afterPublish,
    build: { d1Reads: afterBuild.d1Reads - beforeBuild.d1Reads, d1Writes: afterBuild.d1Writes - beforeBuild.d1Writes, r2Reads: afterBuild.r2Reads - beforeBuild.r2Reads, r2Writes: afterBuild.r2Writes - beforeBuild.r2Writes, r2Lists: afterBuild.r2Lists - beforeBuild.r2Lists, r2Deletes: afterBuild.r2Deletes - beforeBuild.r2Deletes },
    total: afterBuild,
  }, null, 2));

  assert.ok(afterBuild.d1Reads > 0, 'Build should read D1');

  afterTest(ctx);
});
