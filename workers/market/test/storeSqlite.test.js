// market v2 MarketStore file-based test
// D1 → sql.js on disk, R2 → FileR2 (tmpdir). Verifies both persist to real files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { FileR2, createFileSqlite, rows } from './helpers.js';
import { createMarketStore } from '../dist/store/MarketStore.js';
import { commentCreateMutation } from '../dist/translators/comment.js';
import { publishRepoMutation } from '../dist/translators/publish.js';
import { reviewApproveEntry } from '../dist/translators/review.js';

test('MarketStore.apply writes D1 on disk + R2 on disk, materialize writes R2 JSON file', async () => {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
  const now = '2026-06-25T00:00:00.000Z';

  // Seed author + entry + version so comment has a target
  db.sqlite.run("INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ['gh_2', 2, 'bob', '', 'active', now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_entries (id, type, title, description, author_id, publisher_id, category_id, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['mcp-example', 'mcp', 'Example', 'Desc', 'gh_1', 'gh_2', 'dev_code', 'approved', now, now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_versions (id, entry_id, version, format_ver, min_app_ver, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ['mcp-example-v-1-0-0', 'mcp-example', '1.0.0', 'mcp_v2', '1.2.0', 'approved', now, now, now]);

  const comment = {
    id: 'comment-1', entryId: 'mcp-example', parentId: undefined, authorId: 'gh_2',
    body: 'Great plugin', source: 'cf', status: 'active', createdAt: now, updatedAt: now,
  };

  const applied = await store.apply(commentCreateMutation({ comment, actorId: 'gh_2' }));
  assert.equal(applied.ok, true);
  assert.equal(applied.stats.d1Writes, 3);  // 1 comment + 1 mutation_log + 1 dirty
  assert.equal(applied.stats.r2Writes, 0);

  // D1 persisted to disk
  assert.ok(existsSync(db.path), 'D1 sqlite file should exist on disk');
  assert.equal(rows(db, "SELECT COUNT(*) AS cnt FROM market_comments WHERE id = 'comment-1'")[0].cnt, 1);
  const d1Size = (await import('fs')).statSync(db.path).size;
  assert.ok(d1Size > 1000, `D1 file should have reasonable size, got ${d1Size}`);

  // Mutation + dirty now in D1, not R2 — event/dirty files no longer on disk
  assert.equal(applied.events.length, 1);
  assert.equal(applied.dirty.length, 1);
  // Dirty is in D1 now, verify via D1 query
  const dirtyRows = rows(db, "SELECT COUNT(*) AS cnt FROM market_dirty_projections");
  assert.equal(dirtyRows[0].cnt, 1);

  // Materialize
  const materialized = await store.materialize({ projection: 'comments.page', scope: { entryId: 'mcp-example', page: 1 } });
  assert.equal(materialized.ok, true);
  assert.deepEqual(materialized.written, ['market/v2/comments/mcp-example/page-1.json']);
  // row-scan accounting: count (1) + list active comments JOIN (result * 2)
  assert.ok(materialized.stats.d1Reads >= 2, `D1 reads should be at least 2, got ${materialized.stats.d1Reads}`);
  assert.equal(materialized.stats.r2Writes, 1);

  // R2 JSON file exists on disk
  const r2Path = join(r2.dir, 'market/v2/comments/mcp-example/page-1.json');
  assert.ok(existsSync(r2Path), `R2 JSON should exist at ${r2Path}`);
  const commentsPage = JSON.parse(readFileSync(r2Path, 'utf8'));
  assert.equal(commentsPage.items.length, 1);
  assert.equal(commentsPage.items[0].body, 'Great plugin');

  // Op counters
  assert.ok(r2.stats.puts >= 1, `R2 should have PUTs, got ${r2.stats.puts}`);
  assert.ok(r2.stats.gets >= 0);

  r2.destroy();
  db.destroy();
});

test('usage stats reflect real operation counts', async () => {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
  const now = '2026-06-25T00:00:00.000Z';

  db.sqlite.run("INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ['gh_2', 2, 'bob', '', 'active', now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_entries (id, type, title, description, author_id, publisher_id, category_id, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['e2', 'mcp', 'E2', 'D', 'gh_1', 'gh_2', 'dev_code', 'approved', now, now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_versions (id, entry_id, version, format_ver, min_app_ver, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ['e2-v1', 'e2', '1.0.0', 'mcp_v2', '1.2.0', 'approved', now, now, now]);

  // Apply 3 comments
  for (let i = 0; i < 3; i++) {
    await store.apply(commentCreateMutation({
      comment: { id: `c-${i}`, entryId: 'e2', parentId: undefined, authorId: 'gh_2', body: `Comment ${i}`, source: 'cf', status: 'active', createdAt: now, updatedAt: now },
      actorId: 'gh_2',
    }));
  }

  const usage = store.usage();
  assert.equal(usage.d1Writes, 9);  // 3 comments + 3 mutation_log + 3 dirty
  assert.equal(usage.r2Writes, 0);

  r2.destroy();
  db.destroy();
});

test('incremental build materializes comment dirty without full snapshot', async () => {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
  const now = '2026-06-25T00:00:00.000Z';

  db.sqlite.run("INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ['gh_2', 2, 'bob', '', 'active', now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_entries (id, type, title, description, author_id, publisher_id, category_id, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ['e-comment', 'mcp', 'Commented', 'D', 'gh_2', 'gh_2', 'dev_code', 'approved', now, now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_versions (id, entry_id, version, format_ver, min_app_ver, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", ['e-comment-v1', 'e-comment', '1.0.0', 'mcp_v2', '1.2.0', 'approved', now, now, now]);

  await store.apply(commentCreateMutation({
    comment: { id: 'dirty-comment-1', entryId: 'e-comment', parentId: undefined, authorId: 'gh_2', body: 'Dirty comment', source: 'cf', status: 'active', createdAt: now, updatedAt: now },
    actorId: 'gh_2',
  }));

  const { incrementalBuild } = await import('../dist/build.js');
  const before = { ...store.usage() };
  const result = await incrementalBuild({ store });
  const after = store.usage();

  assert.equal(result.ok, true);
  assert.equal(result.materialized, 1);
  assert.ok(existsSync(join(r2.dir, 'market/v2/comments/e-comment/page-1.json')));
  assert.equal(rows(db, 'SELECT COUNT(*) AS cnt FROM market_dirty_projections')[0].cnt, 0);
  assert.ok(after.d1Reads - before.d1Reads < 20, `comment incremental should stay local, got ${after.d1Reads - before.d1Reads} D1 reads`);

  r2.destroy();
  db.destroy();
});

test('incremental build updates entry shard without loading full snapshot', async () => {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
  const now = '2026-06-25T00:00:00.000Z';

  db.sqlite.run("INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ['gh_1', 1, 'alice', '', 'active', now, now]);
  db.sqlite.run("INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ['gh_admin', 999, 'admin', '', 'active', now, now]);

  await store.apply(publishRepoMutation({
    type: 'mcp',
    title: 'Incremental MCP',
    description: 'D',
    publisherId: 'gh_1',
    authorId: 'gh_1',
    repoOwner: 'alice',
    repoName: 'incremental',
    sourceUrl: 'https://github.com/alice/incremental',
    refType: 'commit',
    refName: 'abc',
    commitSha: 'abc',
    version: '1.0.0',
    formatVer: 'mcp_v2',
    minAppVer: '1.0.0',
  }));
  const entryId = rows(db, "SELECT id FROM market_entries WHERE title = 'Incremental MCP'")[0].id;
  await store.apply(reviewApproveEntry({ entryId, actorId: 'gh_admin', versionId: `${entryId}-v-1-0-0` }));

  const { incrementalBuild } = await import('../dist/build.js');
  const before = { ...store.usage() };
  const result = await incrementalBuild({ store });
  const after = store.usage();

  assert.equal(result.ok, true);
  assert.ok(result.materialized >= 2);
  assert.equal(rows(db, 'SELECT COUNT(*) AS cnt FROM market_dirty_projections')[0].cnt, 0);
  assert.ok(after.d1Reads - before.d1Reads < 80, `entry incremental should avoid full snapshot, got ${after.d1Reads - before.d1Reads} D1 reads`);
  const shardFiles = await r2.list({ prefix: 'market/v2/entries/' });
  assert.equal(shardFiles.objects.length, 1);

  r2.destroy();
  db.destroy();
});
