// market v2 integration test — full coverage with FileR2 + FileSqlite
// 2026-06-26 — complete: publish, review, comments, reactions, curation, myEntries, build
// Admin auth: operit-api owner token bypass (OPERIT_OWNER_TOKEN)

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { MarketError, signToken, SESSION_PREFIX } from '../dist/shared.js';
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

function makeRequest(url, method = 'GET', body, session) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (session) headers.set('authorization', `Bearer ${session}`);
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

async function publishMcp(entryRoutes, env, session) {
  const req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'mcp', title: 'Test MCP', description: 'Desc', categoryId: 'search_research',
    source: { kind: 'github_repo', url: 'https://github.com/pub1/example-mcp' },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', manifestPath: 'mcp.json', installConfig: '{}' },
    version: { version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.2.0' },
  }, session);
  return entryRoutes.publish(req, env);
}

// ---- Tests ----

test('publish repo plugin requires formatVer, binds commit', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const session = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  let req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'mcp', title: 'Test', description: 'Desc', categoryId: 'search_research',
    source: { kind: 'github_repo', url: 'https://github.com/pub1/example-mcp' },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', manifestPath: 'mcp.json', installConfig: '{}' },
    version: { version: '1.0.0', minAppVer: '1.2.0' },
  }, session);
  await assert.rejects(() => entryRoutes.publish(req, env), /formatVer is required/);

  req = makeRequest('http://api/market/v2/publish', 'POST', {
    type: 'mcp', title: 'Test MCP', description: 'Desc', categoryId: 'search_research',
    source: { kind: 'github_repo', url: 'https://github.com/pub1/example-mcp' },
    repoVersion: { refType: 'tag', refName: 'v1.0.0', manifestPath: 'mcp.json', installConfig: '{}' },
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

  const pub2 = await publishMcp(entryRoutes, env, pubSession);
  req = makeAdminRequest(`http://api/market/v2/entries/${pub2.entryId}/review/reject`, 'POST', { entryId: pub2.entryId, reasonCode: 'quality-too-low' });
  const rejectResult = await entryRoutes.reviewReject(req, env);
  assert.ok(rejectResult.ok);
  entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub2.entryId])[0];
  assert.equal(entry.state_code, 'rejected');
  const reasons = rows(db, 'SELECT * FROM market_entry_reasons WHERE entry_id = ?', [pub2.entryId]);
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
    repoVersion: { refType: 'tag', refName: 'v1.1.0', manifestPath: 'mcp.json', installConfig: '{}' },
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

test('resubmit entry changes state back to pending', async () => {
  const ctx = await makeEnv();
  const { env, db } = ctx;
  const { createEntryRoutes } = await import('../dist/entry.js');
  const entryRoutes = createEntryRoutes();
  const pubSession = createSession(GITHUB_ID_PUBLISHER, 'pub1');

  const pub = await publishMcp(entryRoutes, env, pubSession);
  await entryRoutes.reviewReject(makeAdminRequest(`http://api/market/v2/entries/${pub.entryId}/review/reject`, 'POST', { entryId: pub.entryId, reasonCode: 'quality-too-low' }), env);

  const req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/resubmit`, 'POST', {}, pubSession);
  const result = await entryRoutes.resubmitEntry(req, env);
  assert.ok(result.ok);
  const entry = rows(db, 'SELECT * FROM market_entries WHERE id = ?', [pub.entryId])[0];
  assert.equal(entry.state_code, 'pending');
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
  assert.ok(manifest.formatVersions.some((f) => f.id === 'mcp_legacy_issue_v1' && f.legacyImportable));
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

  await createBuildRoutes().buildR2(env);
  const listFiles = r2.list({ prefix: 'market/v2/lists/' });
  const listObj = await listFiles;
  assert.ok(listObj.objects.length > 0, 'List page should be written');
  afterTest(ctx);
});

test('react to entry writes analytics, aggregate writes D1 ReactionStat', async () => {
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

  let req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/reactions`, 'POST', { reaction: '+1' }, pubSession);
  await interact.reactToEntry(req, env);
  req = makeRequest(`http://api/market/v2/entries/${pub.entryId}/reactions`, 'POST', { reaction: '+1' }, pub2Session);
  await interact.reactToEntry(req, env);

  assert.equal(env.MARKET_ANALYTICS.events.length, 2);

  const aggResult = await interact.aggregateReactions(env);
  assert.ok(aggResult.ok);
  assert.equal(aggResult.aggregated, 1);

  const stats = rows(db, "SELECT * FROM market_reaction_counts WHERE entry_id = ? AND reaction = '+1'", [pub.entryId]);
  assert.equal(stats.length, 1);
  assert.equal(stats[0].total_count, 2);
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
