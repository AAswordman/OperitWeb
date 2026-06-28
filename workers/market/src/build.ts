import { MarketError, isoNow } from './shared.js';
import { buildEntryFromSnapshot, createBuildSnapshotIndex } from './store/renderers/entryBundle.js';
import type { BuildSnapshot, MarketEnv, MarketStore, ProjectionPlan, R2WriteStat, Row } from './types.js';
import { rowBool, rowText, rowOptionalText } from './store/renderers/row.js';

const SORTS = ['updated', 'likes'] as const;
type SortKey = typeof SORTS[number];
const PUBLISHER_SHARDS = 256;
const ENTRY_SHARDS = 256;

export function createBuildRoutes(): {
  buildR2: (env: MarketEnv) => Promise<{ ok: true; materialized: number }>;
  rebuildEntry: (env: MarketEnv, entryId: string) => Promise<{ ok: true; materialized: number }>;
} {
  return { buildR2, rebuildEntry };
}

function requireStore(env: MarketEnv): MarketStore {
  if (!env.store) throw new MarketError('server_error', 'Market Store is not configured', 500);
  return env.store;
}

async function buildR2(env: MarketEnv): Promise<{ ok: true; materialized: number }> {
  const store = requireStore(env);
  return fullBuild(store);
}

// Cron-only: checks market_meta.last_full_build, runs fullBuild if needed (30-day interval)
export async function fullBuildIfNeeded(env: MarketEnv): Promise<{ ok: true; materialized: number } | { ok: true; skipped: true }> {
  const store = requireStore(env);
  const meta = await store.getMeta('last_full_build');
  const now = Math.floor(Date.now() / 1000);
  const interval = 2592000; // 30 days
  if (meta) {
    const last = parseInt(meta.value, 10);
    if (now - last < interval) return { ok: true, skipped: true };
  }
  const result = await fullBuild(store);
  await store.setMeta('last_full_build', String(now));
  return result;
}

export async function incrementalBuild(env: MarketEnv): Promise<{ ok: true; materialized: number }> {
  const store = requireStore(env);
  const dirtyRows = await store.listDirty(200);
  if (dirtyRows.length === 0) return { ok: true, materialized: 0 };

  const entryIds = new Set<string>();
  const entryShardPlans = new Map<string, ProjectionPlan>();
  const directPlans: Array<{ plan: ProjectionPlan; scopeKey: string }> = [];
  const listDirty: Array<{ projection: string; scopeKey: string }> = [];
  for (const row of dirtyRows) {
    const projection = text(row.projection);
    const scopeKey = text(row.scope_key);
    const scope = parseScopeKey(scopeKey);
    if (projection === 'entry.versions' && scope.entryId) {
      entryIds.add(scope.entryId);
    } else if (projection === 'entry.shard') {
      const planScope = scope.entryId ? { entryId: scope.entryId } : { shard: scope.shard || '' };
      const key = scope.entryId || scope.shard || scopeKey;
      entryShardPlans.set(key, { projection: 'entry.shard', scope: planScope });
    } else if (projection === 'list.page') {
      listDirty.push({ projection, scopeKey });
    } else if (projection === 'comments.page' && scope.entryId) {
      directPlans.push({ plan: { projection: 'comments.page', scope: { entryId: scope.entryId, page: Number(scope.page || 1) } }, scopeKey });
    } else if (projection === 'manifest') {
      directPlans.push({ plan: { projection: 'manifest', scope: {} }, scopeKey });
    } else if (projection === 'private.publisherShard') {
      directPlans.push({ plan: { projection: 'private.publisherShard', scope: { authorId: scope.authorId || '', shard: scope.shard || publisherShardOf(scope.authorId || '') } }, scopeKey });
    } else {
      await store.deleteDirty(projection as ProjectionPlan['projection'], scopeKey);
    }
  }

  const r2 = store.r2;
  const registry = store.projectionRegistry;
  let count = 0;

  for (const entryId of entryIds) {
    entryShardPlans.set(entryId, { projection: 'entry.shard', scope: { entryId } });
    count += (await store.materializeEntryAssetsByEntryVersionDirty(entryId)).materialized;
    await store.deleteDirty('entry.versions', registry.scopeKeyOf({ entryId }));
  }

  for (const plan of entryShardPlans.values()) {
    await store.materialize(plan);
    count++;
  }

  for (const { plan, scopeKey } of directPlans) {
    await store.materialize(plan);
    await store.deleteDirty(plan.projection, scopeKey);
    count++;
  }

  if (listDirty.length > 0) {
    const snap = await store.loadBuildSnapshot();
    const index = createBuildSnapshotIndex(snap);
    const featuredDirty = listDirty.filter(({ scopeKey }) => scopeKey.includes('featured'));
    const regularDirty = listDirty.filter(({ scopeKey }) => !scopeKey.includes('featured'));
    if (featuredDirty.length > 0) {
      await buildFeaturedPage(snap, index, r2, registry);
      for (const { projection, scopeKey } of featuredDirty) {
        await store.deleteDirty(projection as ProjectionPlan['projection'], scopeKey);
      }
      count++;
    }
    if (regularDirty.length > 0) {
      count += await buildAllListPages(snap, index, r2, registry);
      for (const { projection, scopeKey } of regularDirty) {
        await store.deleteDirty(projection as ProjectionPlan['projection'], scopeKey);
      }
    }
  }

  return { ok: true, materialized: count };
}

// -------- Full build --------

async function fullBuild(store: MarketStore): Promise<{ ok: true; materialized: number }> {
  const t0 = Date.now();
  const snap = await store.loadBuildSnapshot();
  console.log('[build] loadBuildSnapshot:', Date.now() - t0, 'ms', snapshotSummary(snap));
  const tIndex = Date.now();
  const index = createBuildSnapshotIndex(snap);
  console.log('[build] indexSnapshot:', Date.now() - tIndex, 'ms');
  const registry = store.projectionRegistry;
  const r2 = store.r2;
  let count = 0;

  // manifest
  const t1 = Date.now();
  await r2.writeJson(registry.keyOf('manifest', {}), {
    ok: true, marketVersion: 2, generatedAt: isoNow(),
    types: snap.types.map((t) => ({ id: rowText(t, 'slug'), name: rowText(t, 'name'), ...(rowOptionalText(t, 'description') !== undefined ? { description: rowText(t, 'description') } : {}) })),
    formatVersions: snap.formatVersions.map((f) => ({
      id: rowText(f, 'id'), type: rowText(f, 'type'), name: rowText(f, 'name'),
      publishable: rowBool(f, 'publishable'),
    })),
    categories: snap.categories.map((c) => ({ id: rowText(c, 'id'), name: rowText(c, 'name'), ...(rowOptionalText(c, 'description') !== undefined ? { description: rowText(c, 'description') } : {}) })),
    states: snap.stateCodes.map((s) => ({ code: rowText(s, 'code'), publicListed: rowBool(s, 'public_listed') })),
  });
  console.log('[build] manifest:', Date.now() - t1, 'ms', writeSummary(r2.stats.recentWrites.slice(-1)));
  count++;

  // entry shards (256, skip empty)
  const t2 = Date.now();
  const entryWriteStart = r2.stats.recentWrites.length;
  const entryShards = new Map<string, Row[]>();
  for (let i = 0; i < ENTRY_SHARDS; i++) entryShards.set(i.toString(16).padStart(2, '0'), []);
  for (const entry of snap.entries) {
    if (rowText(entry, 'state_code') !== 'approved') continue;
    const shard = entryShardOf(rowText(entry, 'id'));
    entryShards.get(shard)!.push(entry);
  }
  let entryW = 0, entryS = 0;
  for (const [shard, entries] of entryShards) {
    if (entries.length === 0) { entryS++; continue; }
    const entriesById: Record<string, unknown> = {};
    for (const entry of entries) entriesById[rowText(entry, 'id')] = buildEntryFromSnapshot(entry, snap, index);
    await r2.writeJson(registry.keyOf('entry.shard', { shard }), {
      ok: true, marketVersion: 2, generatedAt: isoNow(), shard, entriesById,
    });
    entryW++; count++;
  }
  console.log('[build] entryShards:', Date.now() - t2, 'ms', 'w=' + entryW, 'sk=' + entryS, writeSummary(r2.stats.recentWrites.slice(entryWriteStart)));

  // publisher shards (256, skip empty)
  const t3 = Date.now();
  const publisherWriteStart = r2.stats.recentWrites.length;
  const publisherShards = new Map<string, Record<string, { entries: Array<{ id: string; title: string; type: string; stateCode: string; categoryId: string; updatedAt: string }> }>>();
  for (let i = 0; i < PUBLISHER_SHARDS; i++) publisherShards.set(i.toString(16).padStart(2, '0'), {});
  for (const entry of snap.entries) {
    const authorId = rowText(entry, 'publisher_id');
    if (!authorId) continue;
    const shard = publisherShardOf(authorId);
    const authors = publisherShards.get(shard)!;
    const bucket = authors[authorId] ?? { entries: [] };
    bucket.entries.push({
      id: rowText(entry, 'id'),
      title: rowText(entry, 'title'),
      type: rowText(entry, 'type'),
      stateCode: rowText(entry, 'state_code'),
      categoryId: rowText(entry, 'category_id'),
      updatedAt: rowText(entry, 'updated_at'),
    });
    authors[authorId] = bucket;
  }
  let pubW = 0, pubS = 0;
  for (const [shard, authors] of publisherShards) {
    if (Object.keys(authors).length === 0) { pubS++; continue; }
    await r2.writeJson(registry.keyOf('private.publisherShard', { shard, authorId: '' }), {
      ok: true, marketVersion: 2, generatedAt: isoNow(), shard, authors,
    });
    pubW++; count++;
  }
  console.log('[build] publisherShards:', Date.now() - t3, 'ms', 'w=' + pubW, 'sk=' + pubS, writeSummary(r2.stats.recentWrites.slice(publisherWriteStart)));

  // asset details
  const tAssets = Date.now();
  const assetWriteStart = r2.stats.recentWrites.length;
  let assetW = 0;
  const versionsById = new Map<string, Row>();
  const entriesById = new Map<string, Row>();
  for (const version of snap.versions) versionsById.set(rowText(version, 'id'), version);
  for (const entry of snap.entries) entriesById.set(rowText(entry, 'id'), entry);
  for (const asset of snap.assets) {
    const version = versionsById.get(rowText(asset, 'version_id'));
    const entry = version ? entriesById.get(rowText(version, 'entry_id')) : undefined;
    if (!version || !entry) continue;
    if (rowText(entry, 'state_code') !== 'approved' || rowText(version, 'state_code') !== 'approved') continue;
    await r2.writeJson(registry.keyOf('asset.detail', { assetId: rowText(asset, 'id') }), {
      ok: true,
      marketVersion: 2,
      generatedAt: isoNow(),
      item: {
        id: rowText(asset, 'id'),
        entryId: rowText(entry, 'id'),
        type: rowText(entry, 'type'),
        versionId: rowText(asset, 'version_id'),
        kind: rowText(asset, 'kind'),
        url: rowText(asset, 'url'),
        sha256: rowText(asset, 'sha256'),
        ...(rowOptionalText(asset, 'asset_name') ? { assetName: rowText(asset, 'asset_name') } : {}),
      },
    });
    assetW++;
    count++;
  }
  console.log('[build] assetDetails:', Date.now() - tAssets, 'ms', 'w=' + assetW, writeSummary(r2.stats.recentWrites.slice(assetWriteStart)));

  // list pages
  const t4 = Date.now();
  const listWriteStart = r2.stats.recentWrites.length;
  count += await buildAllListPages(snap, index, r2, registry);
  console.log('[build] listPages:', Date.now() - t4, 'ms', writeSummary(r2.stats.recentWrites.slice(listWriteStart)));
  console.log('[build] TOTAL:', Date.now() - t0, 'ms', 'objects=' + count, 'r2Writes=' + r2.stats.writes, 'jsonChars=' + r2.stats.jsonCharsWritten, 'stringifyMs=' + r2.stats.stringifyMs, 'putMs=' + r2.stats.putMs);
  return { ok: true, materialized: count };
}

async function buildAllListPages(snap: BuildSnapshot, index: ReturnType<typeof createBuildSnapshotIndex>, r2: MarketStore['r2'], registry: MarketStore['projectionRegistry']): Promise<number> {
  const pageSize = 100;
  let count = 0;
  const reactionTotals = reactionTotalsByEntry(snap, index);
  const listScopes = buildListScopes(snap);

  const sortFns: Record<SortKey, (a: Row, b: Row) => number> = {
    updated: (a, b) => rowText(b, 'updated_at').localeCompare(rowText(a, 'updated_at')),
    likes: (a, b) => {
      const aLikes = reactionTotals.get(rowText(a, 'id')) ?? 0;
      const bLikes = reactionTotals.get(rowText(b, 'id')) ?? 0;
      return bLikes - aLikes || rowText(b, 'updated_at').localeCompare(rowText(a, 'updated_at'));
    },
  };

  for (const list of listScopes) {
    for (const sort of SORTS) {
    const approved = snap.entries
      .filter((e) => rowText(e, 'state_code') === 'approved')
      .filter((entry) => !list.type || rowText(entry, 'type') === list.type)
      .filter((entry) => !list.categoryId || rowText(entry, 'category_id') === list.categoryId)
      .sort(sortFns[sort]);

    const totalPages = Math.ceil(approved.length / pageSize);
    for (let page = 1; page <= totalPages; page++) {
      const slice = approved.slice((page - 1) * pageSize, page * pageSize);
      const items = slice.map((entry) => buildEntryFromSnapshot(entry, snap, index));
      const key = registry.keyOf('list.page', { list, sort, page });
      await r2.writeJson(key, {
        ok: true, marketVersion: 2, generatedAt: isoNow(),
        list, sort, page, pageSize, total: approved.length, items,
      });
      count++;
    }
    }
  }

  // featured: only produce one page containing every curated entry, sorted by position
  if (await buildFeaturedPage(snap, index, r2, registry)) count++;

  return count;
}

async function buildFeaturedPage(snap: BuildSnapshot, index: ReturnType<typeof createBuildSnapshotIndex>, r2: MarketStore['r2'], registry: MarketStore['projectionRegistry']): Promise<boolean> {
  const curated = new Map<string, number>();
  for (const row of snap.curations) {
    const listKey = rowText(row, 'list_key');
    const entryId = rowText(row, 'entry_id');
    if (listKey !== 'featured' || !entryId) continue;
    curated.set(entryId, Number(row.position ?? 9999));
  }
  if (curated.size === 0) return false;

  const items = snap.entries
    .filter((entry) => rowText(entry, 'state_code') === 'approved' && curated.has(rowText(entry, 'id')))
    .sort((a, b) => (curated.get(rowText(a, 'id')) ?? 9999) - (curated.get(rowText(b, 'id')) ?? 9999))
    .map((entry) => buildEntryFromSnapshot(entry, snap, index));

  const key = registry.keyOf('list.page', { list: {}, sort: 'featured', page: 1 });
  await r2.writeJson(key, {
    ok: true, marketVersion: 2, generatedAt: isoNow(),
    list: { featured: 'featured' }, sort: 'featured', page: 1, pageSize: items.length, total: items.length, items,
  });
  return true;
}

async function rebuildEntry(env: MarketEnv, entryId: string): Promise<{ ok: true; materialized: number }> {
  const store = requireStore(env);
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const authorId = text(entry.publisher_id);
  const shard = entryShardOf(entryId);
  const pubShard = publisherShardOf(authorId);
  const plans: ProjectionPlan[] = [
    { projection: 'entry.shard', scope: { entryId } },
    { projection: 'private.publisherShard', scope: { shard: pubShard, authorId } },
    { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
  ];
  for (const plan of plans) await store.materialize(plan);
  return { ok: true, materialized: plans.length };
}

function parseScopeKey(scopeKey: string): Record<string, string> {
  const scope: Record<string, string> = {};
  for (const part of scopeKey.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0) scope[part.substring(0, eq)] = part.substring(eq + 1);
  }
  return scope;
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function buildListScopes(snap: BuildSnapshot): Array<{ type?: string; categoryId?: string }> {
  const scopes: Array<{ type?: string; categoryId?: string }> = [{}];
  const approved = snap.entries.filter((entry) => rowText(entry, 'state_code') === 'approved');
  const types = new Set<string>();
  const categories = new Set<string>();
  const typeCategories = new Set<string>();
  for (const entry of approved) {
    const type = rowText(entry, 'type');
    const categoryId = rowOptionalText(entry, 'category_id');
    if (type) types.add(type);
    if (categoryId) categories.add(categoryId);
    if (type && categoryId) typeCategories.add(`${type}\u0000${categoryId}`);
  }
  for (const type of [...types].sort()) scopes.push({ type });
  for (const categoryId of [...categories].sort()) scopes.push({ categoryId });
  for (const pair of [...typeCategories].sort()) {
    const [type, categoryId] = pair.split('\u0000');
    if (type && categoryId) scopes.push({ type, categoryId });
  }
  return scopes;
}

function reactionTotalsByEntry(snap: BuildSnapshot, index: ReturnType<typeof createBuildSnapshotIndex>): Map<string, number> {
  const result = new Map<string, number>();
  for (const [entryId, stats] of index.entryStatsByEntryId) {
    result.set(entryId, Number(stats.likes || 0));
  }
  return result;
}

function snapshotSummary(snap: BuildSnapshot): string {
  return `entries=${snap.entries.length} versions=${snap.versions.length} repos=${snap.repos.length} assets=${snap.assets.length} reactions=${snap.reactions.length} entryStats=${snap.entryStats.length} categories=${snap.categories.length} curations=${snap.curations.length}`;
}

function writeSummary(writes: R2WriteStat[]): string {
  if (writes.length === 0) return 'writes=0';
  const chars = writes.reduce((sum, item) => sum + item.chars, 0);
  const stringifyMs = writes.reduce((sum, item) => sum + item.stringifyMs, 0);
  const putMs = writes.reduce((sum, item) => sum + item.putMs, 0);
  const slowest = writes.reduce((best, item) => item.totalMs > best.totalMs ? item : best, writes[0]!);
  const largest = writes.reduce((best, item) => item.chars > best.chars ? item : best, writes[0]!);
  return `writes=${writes.length} chars=${chars} stringifyMs=${stringifyMs} putMs=${putMs} slowest=${slowest.totalMs}ms:${slowest.key} largest=${largest.chars}:${largest.key}`;
}

function entryShardOf(entryId: string): string {
  return scopeHash(entryId).substring(0, 2).toLowerCase();
}

function publisherShardOf(authorId: string): string {
  return scopeHash(authorId).substring(0, 2).toLowerCase();
}

export function scopeHash(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
