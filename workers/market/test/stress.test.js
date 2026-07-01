// ====== Monthly budget simulation: realistic sustained load ======

test('stress: monthly budget — 10K DAU sustained for 30 days', async () => {
  const TOTAL_ENTRIES = 300;
  const COMMENTS_PER_ENTRY = 10;

  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });

  await seedData(db, store, TOTAL_ENTRIES, COMMENTS_PER_ENTRY);
  const buildOps = await fullBuild(store, db);

  // Single-day snapshot — multiply by 30
  store.usage();
  const start = store.usage();

  // Daily write: 50 new publishes + 50 approves
  for (let i = 0; i < 50; i++) {
    await store.apply(publishRepoMutation({
      type: 'mcp', title: `Day${i}`, description: 'x',
      publisherId: 'gh_1', authorId: 'gh_1',
      repoOwner: 't', repoName: `day${i}`, sourceUrl: `https://github.com/t/day${i}`,
      refType: 'commit', refName: 'a', commitSha: `d${i}`,
      version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.0.0',
    }));
  }
  const pending = rows(db, "SELECT id FROM market_entries WHERE state_code = 'pending'", []);
  for (const e of pending) {
    await store.apply(reviewApproveEntry({ entryId: e.id, actorId: 'gh_admin', versionId: `${e.id}-v-1-0-0` }));
  }

  // 200 new comments / day
  const approved = rows(db, "SELECT id FROM market_entries WHERE state_code = 'approved'", []);
  for (let i = 0; i < 200; i++) {
    await store.apply(commentCreateMutation({
      comment: { id: `dayc${i}`, entryId: approved[i % approved.length].id, parentId: undefined, authorId: 'gh_1', body: `C${i}`, source: 'cf', status: 'active', createdAt: NOW, updatedAt: NOW },
      actorId: 'gh_1',
    }));
  }

  // 30 reactions
  for (let i = 0; i < 30; i++) {
    // reactions go to Analytics, no D1 write — just count the worker call
  }
  const afterWrite = { ...store.usage() };

  // Daily incremental build
  const buildAfterWrite = await fullBuild(store, db);
  const afterBuild = store.usage();

  // Worker requests/day: 50 publish + 50 approve + 200 comment + 30 react + 1 build
  const workerReqDay = 50 + 50 + 200 + 30 + 1;

  // R2 Class B: 10K users × 7.55 gets/user
  const r2ClassBPerDay = 10000 * 7.55;

  const month = {
    workerRequests: { perDay: workerReqDay, perMonth: workerReqDay * 30, free: 100000 * 30, pct: ((workerReqDay * 30 / (100000 * 30)) * 100).toFixed(1) + '%' },
    d1Reads: { perDay: afterBuild.d1Reads, perMonth: afterBuild.d1Reads * 30, free: 5000000 * 30, pct: ((afterBuild.d1Reads * 30 / (5000000 * 30)) * 100).toFixed(2) + '%' },
    d1Writes: { perDay: afterBuild.d1Writes, perMonth: afterBuild.d1Writes * 30, free: 100000 * 30, pct: ((afterBuild.d1Writes * 30 / (100000 * 30)) * 100).toFixed(2) + '%' },
    r2ClassA: { perDay: afterBuild.r2Writes, perMonth: afterBuild.r2Writes * 30, free: 1000000, pct: ((afterBuild.r2Writes * 30 / 1000000) * 100).toFixed(2) + '%' },
    r2ClassB: { perDay: r2ClassBPerDay, perMonth: r2ClassBPerDay * 30, free: 10000000, pct: ((r2ClassBPerDay * 30 / 10000000) * 100).toFixed(1) + '%' },
  };

  console.log('\n' + JSON.stringify({ scenario: 'Monthly budget — 10K DAU 30 days', buildSeed: buildOps, month }, null, 2));

  assert.ok(month.d1Writes.perMonth < 100000 * 30);
  assert.ok(month.r2ClassA.perMonth < 1000000);
  assert.ok(month.r2ClassB.perMonth < 10000000);

  r2.destroy();
  db.destroy();
});

// ====== Hot entry: 500 comments, 5000 viewers ======

test('stress: hot entry — 500 comments, 5000 people reading all comment pages', async () => {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });

  // 1 entry with 500 comments
  seedAuthor(db, 1, 'pub');
  seedAuthor(db, 9999, 'admin');
  await store.apply(publishRepoMutation({
    type: 'mcp', title: 'Hot Plugin', description: 'Viral',
    publisherId: 'gh_1', authorId: 'gh_1',
    repoOwner: 't', repoName: 'hot', sourceUrl: 'https://github.com/t/hot',
    refType: 'commit', refName: 'a', commitSha: 'h0t',
    version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.0.0',
  }));
  const entry = rows(db, 'SELECT id FROM market_entries', [])[0];
  await store.apply(reviewApproveEntry({ entryId: entry.id, actorId: 'gh_admin', versionId: `${entry.id}-v-1-0-0` }));

  // 500 comments
  store.usage();
  const beforeComments = store.usage();
  for (let i = 0; i < 500; i++) {
    await store.apply(commentCreateMutation({
      comment: { id: `hotc${i}`, entryId: entry.id, parentId: undefined, authorId: 'gh_1', body: `Hot comment ${i}`, source: 'cf', status: 'active', createdAt: NOW, updatedAt: NOW },
      actorId: 'gh_1',
    }));
  }
  const commentCost = diff(store.usage(), beforeComments);

  // Build comment pages (500 comments at 100/page = 5 pages)
  const beforeBuild = { ...store.usage() };
  for (let p = 1; p <= 5; p++) {
    await store.materialize({ projection: 'comments.page', scope: { entryId: entry.id, page: p } });
  }
  await store.materialize({ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } });
  const buildCost = diff(store.usage(), beforeBuild);

  // R2 Class B: 5000 viewers × (1 entry bundle + all 5 comment pages)
  const viewers = 5000;
  const r2Gets = viewers * (1 + 5);

  // R2 Class B per viewer refreshes: assume each viewer refreshes avg 3 times
  const refreshMultiplier = 3;
  const totalClassB = r2Gets * refreshMultiplier;

  // 500 comments in a burst — is this a single user? No, it's natural over time.
  // D1 write burst: 500 comment writes in one batch
  const report = {
    scenario: 'Hot entry: 500 comments, 5000 viewers',
    entry: 'Hot Plugin',
    comments: 500,
    commentPages: 5,
    viewers: 5000,
    refreshMultiplier,
    costs: {
      writing500Comments: commentCost,
      buildingCommentPages: buildCost,
      r2ClassB: { perViewer: 6, totalViewers: viewers, refreshes: refreshMultiplier, total: totalClassB, ofMonthlyFree: ((totalClassB / 10000000) * 100).toFixed(2) + '%' },
    },
    burstD1Writes: commentCost.d1Writes,  // key: 500 comments in burst
    freeD1WritesPerDay: 100000,
    d1WriteBurstPct: ((commentCost.d1Writes / 100000) * 100).toFixed(1) + '%',
  };

  console.log('\n' + JSON.stringify(report, null, 2));

  assert.ok(commentCost.d1Writes < 100000, 'Comment burst must fit in daily D1 write limit');

  r2.destroy();
  db.destroy();
});// market v2 stress test — realistic 10K DAU with full read model
// Includes: manifest, list bundles, entry detail, comments pages, author pages, assets

import test from 'node:test';
import assert from 'node:assert/strict';
import { FileR2, createFileSqlite, rows } from './helpers.js';
import { createMarketStore } from '../dist/store/MarketStore.js';
import { incrementalBuild } from '../dist/build.js';
import { commentCreateMutation } from '../dist/translators/comment.js';
import { publishRepoMutation } from '../dist/translators/publish.js';
import { reviewApproveEntry } from '../dist/translators/review.js';

const NOW = '2026-06-25T00:00:00.000Z';

function seedAuthor(db, ghId, login) {
  db.sqlite.run("INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [`gh_${ghId}`, ghId, login, '', 'active', NOW, NOW]);
}
function diff(a, b) {
  return { d1Reads: a.d1Reads - b.d1Reads, d1Writes: a.d1Writes - b.d1Writes, r2Reads: a.r2Reads - b.r2Reads, r2Writes: a.r2Writes - b.r2Writes, r2Lists: a.r2Lists - b.r2Lists, r2Deletes: a.r2Deletes - b.r2Deletes };
}

async function seedData(db, store, entries, commentsPerEntry) {
  seedAuthor(db, 1, 'pub');
  seedAuthor(db, 9999, 'admin');
  for (let i = 0; i < entries; i++) {
    await store.apply(publishRepoMutation({
      type: 'mcp', title: `P${i}`, description: `D${i}`,
      publisherId: 'gh_1', authorId: 'gh_1',
      repoOwner: 't', repoName: `r${i}`, sourceUrl: `https://github.com/t/r${i}`,
      refType: 'commit', refName: 'a', commitSha: `c${i}`,
      version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.0.0',
    }));
  }
  const all = rows(db, 'SELECT id FROM market_entries', []);
  for (const e of all) {
    await store.apply(reviewApproveEntry({ entryId: e.id, actorId: 'gh_admin', versionId: `${e.id}-v-1-0-0` }));
  }
  for (let i = 0; i < entries * commentsPerEntry; i++) {
    const ei = i % entries;
    await store.apply(commentCreateMutation({
      comment: { id: `c${i}`, entryId: all[ei].id, parentId: undefined, authorId: 'gh_1', body: `C${i}`, source: 'cf', status: 'active', createdAt: NOW, updatedAt: NOW },
      actorId: 'gh_1',
    }));
  }
  return all;
}

// Helper to build all projections from D1 -> R2, measuring ops
async function fullBuild(store, db) {
  const start = { ...store.usage() };
  const entries = rows(db, "SELECT id, publisher_id FROM market_entries WHERE state_code = 'approved'", []);
  const publisherIds = new Set(entries.map(e => e.publisher_id).filter(Boolean));

  const plans = [
    { projection: 'manifest', scope: {} },
    { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
  ];
  for (const e of entries) {
    plans.push({ projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } });
    plans.push({ projection: 'entry.versions', scope: { entryId: e.id } });
    plans.push({ projection: 'comments.page', scope: { entryId: e.id, page: 1 } });
  }
  for (const pid of publisherIds) {
    plans.push({ projection: 'private.publisherShard', scope: { authorId: pid } });
  }
  for (const pp of plans) await store.materialize(pp);
  return diff(store.usage(), start);
}

// ====== Realistic 10K DAU read model ======

test('stress: 10K DAU realistic — write load + full R2 read model', async () => {
  const TOTAL_ENTRIES = 200;
  const COMMENTS_PER_ENTRY = 10; // 2000 total comments

  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });

  // Seed the market
  await seedData(db, store, TOTAL_ENTRIES, COMMENTS_PER_ENTRY);
  const buildOps = await fullBuild(store, db);
  console.log('\n--- Seed costs ---');
  console.log(JSON.stringify(buildOps, null, 2));

  // Reset usage to measure daily ops only
  store.usage();
  const start = store.usage();

  // --- Daily write load ---
  // 100 new publishes
  for (let i = 0; i < 100; i++) {
    await store.apply(publishRepoMutation({
      type: 'mcp', title: `New${i}`, description: 'x',
      publisherId: 'gh_1', authorId: 'gh_1',
      repoOwner: 't', repoName: `new${i}`, sourceUrl: `https://github.com/t/new${i}`,
      refType: 'commit', refName: 'a', commitSha: `nc${i}`,
      version: '1.0.0', formatVer: 'mcp_v2', minAppVer: '1.0.0',
    }));
  }
  const pending = rows(db, "SELECT id FROM market_entries WHERE state_code = 'pending'", []);
  for (const e of pending) {
    await store.apply(reviewApproveEntry({ entryId: e.id, actorId: 'gh_admin', versionId: `${e.id}-v-1-0-0` }));
  }

  // 500 new comments spread across entries
  const approved = rows(db, "SELECT id FROM market_entries WHERE state_code = 'approved'", []);
  for (let i = 0; i < 500; i++) {
    await store.apply(commentCreateMutation({
      comment: { id: `nc${i}`, entryId: approved[i % approved.length].id, parentId: undefined, authorId: 'gh_1', body: `New comment ${i}`, source: 'cf', status: 'active', createdAt: NOW, updatedAt: NOW },
      actorId: 'gh_1',
    }));
  }

  // 50 reactions (write to Analytics Engine, not D1)
  const afterWrite = { ...store.usage() };

  // Daily incremental build (only dirty projections)
  const buildAfterWrite = await fullBuild(store, db);
  const afterBuild = store.usage();

  // ==========================================
  // R2 Class B read model (clients, no Worker)
  // ==========================================
  // 10K DAU, realistic browsing patterns:
  //
  // 1. Cold start: manifest.json — 1 GET/user
  // 2. Browse home: list.page (all, sorted) — 1 GET/user
  // 3. Browse category: 20% of users switch category, avg 2 categories — 0.4 GET/user
  // 4. Open detail: avg 3 entries opened per session — 3 GET/user (entry.bundle)
  // 5. Open comments: 40% of opened entries have comments opened, avg 1.5 pages — 3*0.4*1.5 = 1.8 GET/user
  // 6. Check versions: 10% of opened entries — 0.3 GET/user
  // 7. Search (future): skip for now
  // 8. My entries/author page: 5% are publishers checking their entries — 0.05 GET/user

  const PER_USER_R2_GETS = {
    manifest: 1,
    listPage: 1,
    categoryPages: 0.4,
    entryBundle: 3,
    commentsPages: 1.8,
    versionsPage: 0.3,
    authorPage: 0.05,
  };
  const r2GetsPerUser = Object.values(PER_USER_R2_GETS).reduce((a, b) => a + b, 0);
  const totalR2ClassBPerDay = 10000 * r2GetsPerUser;
  const totalR2ClassBPerMonth = totalR2ClassBPerDay * 30;

  // ==========================================
  // Worker request count
  // ==========================================
  const workerRequestsPerDay = 100 + 100 + 500 + 50 + 1; // publish + approve + comment + react + build

  // ==========================================
  // Report
  // ==========================================
  const report = {
    scenario: '10K DAU — realistic read model',
    marketSize: { entries: TOTAL_ENTRIES + 100, totalComments: TOTAL_ENTRIES * COMMENTS_PER_ENTRY + 500 },
    dailyR2Gets: PER_USER_R2_GETS,
    r2GetsPerUser,
    workerOps: {
      write: diff(afterWrite, start),
      build: buildAfterWrite,
      total: afterBuild,
    },
    r2Cost: {
      classBPerDay: totalR2ClassBPerDay,
      classBPerMonth: totalR2ClassBPerMonth,
      classBFree: '10,000,000/month',
      classBUsePct: ((totalR2ClassBPerMonth / 10000000) * 100).toFixed(1) + '%',
    },
    limits: {
      workerRequests: { free: '100K/day', used: workerRequestsPerDay, pct: ((workerRequestsPerDay / 100000) * 100).toFixed(1) + '%', verdict: workerRequestsPerDay < 100000 ? 'OK' : 'OVER' },
      d1Reads: { free: '5M/day', used: afterBuild.d1Reads, pct: ((afterBuild.d1Reads / 5000000) * 100).toFixed(2) + '%', verdict: afterBuild.d1Reads < 5000000 ? 'OK' : 'OVER' },
      d1Writes: { free: '100K/day', used: afterBuild.d1Writes, pct: ((afterBuild.d1Writes / 100000) * 100).toFixed(2) + '%', verdict: afterBuild.d1Writes < 100000 ? 'OK' : 'OVER' },
      r2ClassA: { free: '1M/month', dailyEquivalent: afterBuild.r2Writes, monthlyEst: afterBuild.r2Writes * 30, pct: ((afterBuild.r2Writes * 30 / 1000000) * 100).toFixed(2) + '%', verdict: (afterBuild.r2Writes * 30) < 1000000 ? 'OK' : 'OVER' },
    },
    allFree: workerRequestsPerDay < 100000 && afterBuild.d1Reads < 5000000 && afterBuild.d1Writes < 100000 && (afterBuild.r2Writes * 30) < 1000000 && totalR2ClassBPerMonth < 10000000,
  };

  console.log('\n' + JSON.stringify(report, null, 2));

  assert.ok(report.allFree, 'All limits must be within free tier');

  r2.destroy();
  db.destroy();
});

// ====== Worst-case: viral entry with 10K comment views ======

test('stress: viral entry — 10K users reading comments on 1 entry', async () => {
  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });

  await seedData(db, store, 1, 500); // 500 comments on 1 entry
  await fullBuild(store, db);

  // 500 comments = 5 pages (at 100/page)
  // If 10K users each read 3 pages of comments = 30K Class B
  const commentGetsPerUser = 3;
  const totalCommentGets = 10000 * commentGetsPerUser;

  // Plus they open the entry bundle = 1 GET
  const totalGets = 10000 * (1 + commentGetsPerUser);

  const report = {
    scenario: 'Viral entry: 10K users reading comments',
    totalComments: 500,
    commentPages: 5,
    r2Gets: {
      entryBundle: 10000,
      commentsPages: totalCommentGets,
      total: totalGets,
    },
    ofMonthlyFree: {
      total: totalGets,
      pct: ((totalGets / 10000000) * 100).toFixed(1) + '%',
    },
  };

  console.log('\n' + JSON.stringify(report, null, 2));

  assert.ok(totalGets < 10000000);
  r2.destroy();
  db.destroy();
});

test('stress: timed dirty settlement — list.page dirty rebuild cost', async () => {
  const TOTAL_ENTRIES = Number(process.env.MARKET_TIMING_ENTRIES || 300);
  const CATEGORIES = ['search_research', 'dev_code', 'automation_workflow', 'docs_knowledge', 'media_content', 'chat_communication', 'integration_api', 'system_data', 'business_productivity', 'life_entertainment'];
  const TYPES = ['mcp', 'skill'];

  const db = await createFileSqlite('migrations/001_init.sql');
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });

  seedAuthor(db, 1, 'pub');
  seedAuthor(db, 9999, 'admin');

  for (let i = 0; i < TOTAL_ENTRIES; i++) {
    const type = TYPES[i % TYPES.length];
    const categoryId = CATEGORIES[i % CATEGORIES.length];
    await store.apply(publishRepoMutation({
      type,
      title: `Timing ${i}`,
      description: `Timing entry ${i}`,
      categoryId,
      publisherId: 'gh_1',
      authorId: 'gh_1',
      repoOwner: 'timing',
      repoName: `repo-${i}`,
      sourceUrl: `https://github.com/timing/repo-${i}`,
      refType: 'commit',
      refName: 'main',
      commitSha: `timing-${i}`,
      version: '1.0.0',
      formatVer: `${type}_v2`,
      minAppVer: '1.0.0',
    }));
  }

  const entries = rows(db, 'SELECT id FROM market_entries', []);
  for (const entry of entries) {
    await store.apply(reviewApproveEntry({ entryId: entry.id, actorId: 'gh_admin', versionId: `${entry.id}-v-1-0-0` }));
  }

  await store.d1.upsertDirty(
    'list.page',
    store.projectionRegistry.scopeKeyOf({ list: {}, sort: 'updated', page: 1 }),
    'timing.list_dirty',
    `timing-${Date.now()}`,
    NOW,
  );

  const before = { ...store.usage() };
  const putBefore = r2.stats.puts;
  const started = performance.now();
  const result = await incrementalBuild({ store });
  const elapsedMs = Math.round(performance.now() - started);
  const after = store.usage();

  const report = {
    scenario: 'dirty settlement list.page timing',
    entries: TOTAL_ENTRIES,
    categories: CATEGORIES.length,
    types: TYPES.length,
    result,
    elapsedMs,
    ops: diff(after, before),
    r2Puts: r2.stats.puts - putBefore,
  };

  console.log('\n' + JSON.stringify(report, null, 2));

  assert.ok(result.materialized > 0);

  r2.destroy();
  db.destroy();
});
