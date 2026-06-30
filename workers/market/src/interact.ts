import { assertAuthorActive, requireSession, upsertAuthorFromSession } from './auth.js';
import { MarketError, extractIdFromPath, requireString, sha256Sync, validateAllowedUrlHost } from './shared.js';
import { commentCreateMutation, commentHideMutation, commentUpdateMutation } from './translators/comment.js';
import { notifyCommentCreated } from './translators/notify.js';
import type { JsonObject, MarketEnv, MarketStore } from './types.js';

const COMMENT_PAGE_SIZE = 50;
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const V2_ANALYTICS_CURSOR_META = 'v2_analytics_aggregate_cursor';
const V2_ANALYTICS_DELAY_MS = 5 * 60 * 1000;
const V2_ANALYTICS_DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const ASSET_DOWNLOAD_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function createInteractRoutes(): {
  addComment(request: Request, env: MarketEnv): Promise<JsonObject>;
  editComment(request: Request, env: MarketEnv): Promise<JsonObject>;
  deleteComment(request: Request, env: MarketEnv): Promise<JsonObject>;
  reactToEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  downloadAsset(request: Request, env: MarketEnv): Promise<Response>;
  aggregateV2Analytics(env: MarketEnv): Promise<JsonObject>;
  listNotifications(request: Request, env: MarketEnv): Promise<JsonObject>;
} {
  return { addComment, editComment, deleteComment, reactToEntry, downloadAsset, aggregateV2Analytics, listNotifications: handleListNotifications };
}

function requireStore(env: MarketEnv): MarketStore {
  if (!env.store) throw new MarketError('server_error', 'Market Store is not configured', 500);
  return env.store;
}
function requireDb(env: MarketEnv) { if (!env.db) throw new MarketError('server_error', 'D1 database is not configured', 500); return env.db; }
async function jsonBody(request: Request): Promise<Record<string, unknown>> { const value = await request.json(); return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function optionalString(value: unknown): string | undefined { const text = String(value ?? '').trim(); return text ? text : undefined; }

async function addComment(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const author = await upsertAuthorFromSession(requireDb(env), session);
  assertAuthorActive(author);
  const entryId = extractIdFromPath(request.url, '/entries/', '/comments');
  const entry = await store.d1.getEntry(entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  if (String(entry.state_code) !== 'approved') throw new MarketError('state_invalid', 'Entry does not accept comments');
  const body = await jsonBody(request);
  const createdAt = new Date().toISOString();
  const parentId = optionalString(body.parentId);
  const comment = { id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, entryId, authorId: author.id, body: requireString(body.body, 'body'), source: 'cf', status: 'active', createdAt, updatedAt: createdAt, ...(parentId !== undefined ? { parentId } : {}) };
  const applied = await store.apply(commentCreateMutation({ comment, actorId: author.id }));
  const total = await store.d1.countActiveComments(entryId);
  await materializeCommentPageRange(store, entryId, 1, Math.max(1, Math.ceil(total / COMMENT_PAGE_SIZE)));
  // Send notification (fire-and-forget, don't block response)
  notifyCommentCreated(store.d1, entry, { id: comment.id, authorId: author.id, parentId: comment.parentId as string | null | undefined, body: comment.body }).catch(() => {});
  return { ok: true, commentId: comment.id, stats: applied.stats as unknown as JsonObject };
}

async function editComment(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const author = await upsertAuthorFromSession(requireDb(env), session);
  assertAuthorActive(author);
  const commentId = extractIdFromPath(request.url, '/comments/', '');
  const comment = await store.d1.getComment(commentId);
  if (!comment) throw new MarketError('not_found', 'Comment not found', 404);
  if (String(comment.author_id) !== author.id) throw new MarketError('unauthorized', 'Not your comment', 403);
  const page = await commentPageOf(store, comment);
  const body = await jsonBody(request);
  const applied = await store.apply(commentUpdateMutation({ commentId, entryId: String(comment.entry_id), actorId: author.id, patch: { body: requireString(body.body, 'body') } }));
  await materializeCommentPages(store, String(comment.entry_id), [page]);
  return { ok: true, commentId, stats: applied.stats as unknown as JsonObject };
}

async function deleteComment(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const author = await upsertAuthorFromSession(requireDb(env), session);
  assertAuthorActive(author);
  const commentId = extractIdFromPath(request.url, '/comments/', '');
  const comment = await store.d1.getComment(commentId);
  if (!comment) throw new MarketError('not_found', 'Comment not found', 404);
  if (String(comment.author_id) !== author.id) throw new MarketError('unauthorized', 'Not your comment', 403);
  const entryId = String(comment.entry_id);
  const page = await commentPageOf(store, comment);
  const totalBefore = await store.d1.countActiveComments(entryId);
  const lastPageBefore = Math.max(1, Math.ceil(totalBefore / COMMENT_PAGE_SIZE));
  const applied = await store.apply(commentHideMutation({ commentId, entryId: String(comment.entry_id), actorId: author.id }));
  await materializeCommentPageRange(store, entryId, 1, Math.max(page, lastPageBefore));
  return { ok: true, stats: applied.stats as unknown as JsonObject };
}

async function commentPageOf(store: MarketStore, comment: Record<string, unknown>): Promise<number> {
  if (String(comment.status ?? '') !== 'active') return 1;
  const before = await store.d1.countActiveCommentsBefore(String(comment.entry_id), String(comment.created_at), String(comment.id));
  return Math.floor(before / COMMENT_PAGE_SIZE) + 1;
}

async function materializeCommentPages(store: MarketStore, entryId: string, pages: number[]): Promise<void> {
  const uniquePages = [...new Set(pages.filter((page) => Number.isFinite(page) && page > 0))];
  for (const page of uniquePages) {
    await store.materialize({ projection: 'comments.page', scope: { entryId, page }, pageSize: COMMENT_PAGE_SIZE });
  }
}

async function materializeCommentPageRange(store: MarketStore, entryId: string, startPage: number, endPage: number): Promise<void> {
  const pages: number[] = [];
  for (let page = startPage; page <= endPage; page++) pages.push(page);
  await materializeCommentPages(store, entryId, pages);
}

async function reactToEntry(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const entryId = extractIdFromPath(request.url, '/entries/', '/reactions');
  const shard = await store.readProjection({ projection: 'entry.shard', scope: { entryId } });
  const entry = readShardEntry(shard, entryId);
  if (!entry) throw new MarketError('not_found', 'Entry not found', 404);
  const type = String(entry.type || '').trim();
  if (!type) throw new MarketError('not_found', 'Entry not found', 404);
  const dayBucket = utcDayBucket();
  const actorHash = await hashForAnalytics(`like:${entryId}:gh:${session.github_id}`);
  env.MARKET_ANALYTICS?.writeDataPoint?.({ blobs: ['v2', 'like', type, entryId, '+1', actorHash, dayBucket], doubles: [1, Date.now()], indexes: [entryId] });
  return { ok: true, accepted: true };
}

async function downloadAsset(request: Request, env: MarketEnv): Promise<Response> {
  const store = requireStore(env);
  const assetId = extractIdFromPath(request.url, '/assets/', '/download');
  const detail = await store.readProjection({ projection: 'asset.detail', scope: { assetId } });
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new MarketError('not_found', 'Asset not found', 404);
  const item = (detail as { item?: { url?: string; entryId?: string; type?: string; sha256?: string; assetName?: string } }).item;
  const assetUrl = item?.url;
  if (!assetUrl) throw new MarketError('not_found', 'Asset not found', 404);
  if (!item.entryId || !item.type) throw new MarketError('not_found', 'Asset not found', 404);
  validateAllowedUrlHost(assetUrl);
  const dayBucket = utcDayBucket();
  const actorHash = await hashForAnalytics(`download:${assetId}:${clientFingerprint(request, env)}`);
  env.MARKET_ANALYTICS?.writeDataPoint?.({ blobs: ['v2', 'download', item.type, item.entryId, assetId, actorHash, dayBucket], doubles: [1, Date.now()], indexes: [item.entryId] });
  return proxyAssetDownload(request, assetId, { url: assetUrl, sha256: item.sha256, assetName: item.assetName });
}

async function proxyAssetDownload(request: Request, assetId: string, item: { url: string; sha256?: string; assetName?: string }): Promise<Response> {
  const upstreamUrl = new URL(item.url);
  const requestHeaders = new Headers();
  const range = request.headers.get('range');
  if (range) requestHeaders.set('range', range);
  requestHeaders.set('accept', request.headers.get('accept') || '*/*');
  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method: 'GET',
    headers: requestHeaders,
    cf: {
      cacheEverything: true,
      cacheTtl: ASSET_DOWNLOAD_CACHE_TTL_SECONDS,
    },
  } as RequestInit);
  const upstream = await fetch(upstreamRequest);
  if (!upstream.ok && upstream.status !== 206) {
    throw new MarketError('download_failed', `Asset upstream returned ${upstream.status}`, 502);
  }

  const headers = new Headers(upstream.headers);
  headers.set('cache-control', `public, max-age=${ASSET_DOWNLOAD_CACHE_TTL_SECONDS}, immutable`);
  headers.set('access-control-allow-origin', '*');
  headers.set('cross-origin-resource-policy', 'cross-origin');
  headers.set('x-operit-market-asset-id', assetId);
  if (item.sha256) headers.set('x-operit-market-sha256', item.sha256);
  const filename = safeDownloadFilename(item.assetName || filenameFromUrl(upstreamUrl) || `${assetId}.zip`);
  headers.set('content-disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeRFC5987Value(filename)}`);
  headers.delete('set-cookie');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function filenameFromUrl(url: URL): string {
  const segment = url.pathname.split('/').filter(Boolean).pop() || '';
  return decodeURIComponent(segment);
}

function safeDownloadFilename(value: string): string {
  return value.replace(/[\\/"\r\n]/g, '_').trim() || 'download.bin';
}

function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function aggregateV2Analytics(env: MarketEnv): Promise<JsonObject> {
  const store = requireStore(env);
  const { windowStart, windowEnd, rows, source } = await loadV2AnalyticsRows(env, store);
  return store.aggregateV2Analytics({ windowStart, windowEnd, rows, source });
}

type V2AggregateRow = { event: string; type: string; entryId: string; total: number; sampleInterval: number; lastAt: string };

async function loadV2AnalyticsRows(env: MarketEnv, store: MarketStore): Promise<{ windowStart: string; windowEnd: string; rows: V2AggregateRow[]; source: string }> {
  const cursor = await store.getMeta(V2_ANALYTICS_CURSOR_META);
  const windowEnd = new Date(Date.now() - V2_ANALYTICS_DELAY_MS).toISOString();
  const windowStart = cursor?.value || new Date(Date.now() - V2_ANALYTICS_DEFAULT_LOOKBACK_MS).toISOString();
  if (Date.parse(windowStart) >= Date.parse(windowEnd)) return { windowStart, windowEnd, rows: [], source: 'cursor' };

  const memoryEvents = env.MARKET_ANALYTICS?.events as { blobs?: string[]; doubles?: number[] }[] | undefined;
  if (memoryEvents?.length) {
    const memoryWindowEnd = new Date().toISOString();
    return { windowStart, windowEnd: memoryWindowEnd, rows: aggregateMemoryEvents(memoryEvents, windowStart, memoryWindowEnd), source: 'memory' };
  }

  const dataset = getAnalyticsDatasetName(env);
  const rows = await queryAnalyticsRows(env, `
    WITH unique_events AS (
      SELECT
        blob2 AS event,
        blob3 AS type,
        blob4 AS entryId,
        COALESCE(NULLIF(blob6, ''), concat('legacy:', blob2, ':', blob4, ':', toString(timestamp))) AS actorHash,
        COALESCE(NULLIF(blob7, ''), toString(toDate(timestamp))) AS dayBucket,
        MAX(timestamp) AS lastAt,
        MAX(_sample_interval) AS sampleInterval
      FROM ${dataset}
      WHERE blob1 = 'v2'
        AND blob2 IN ('download', 'like')
        AND timestamp > ${quoteSqlString(windowStart)}
        AND timestamp <= ${quoteSqlString(windowEnd)}
      GROUP BY blob2, blob3, blob4, actorHash, dayBucket
    )
    SELECT
      event,
      type,
      entryId,
      SUM(sampleInterval) AS total,
      1 AS sampleInterval,
      MAX(lastAt) AS lastAt
    FROM unique_events
    GROUP BY event, type, entryId
  `);
  return {
    windowStart,
    windowEnd,
    source: 'analytics_engine',
    rows: rows.map((row) => ({
      event: String(row.event || ''),
      type: String(row.type || ''),
      entryId: String(row.entryId || ''),
      total: Number(row.total || 0),
      sampleInterval: Number(row.sampleInterval || 1),
      lastAt: String(row.lastAt || ''),
    })),
  };
}

function aggregateMemoryEvents(events: { blobs?: string[]; doubles?: number[] }[], windowStart: string, windowEnd: string): V2AggregateRow[] {
  const start = Date.parse(windowStart);
  const end = Date.parse(windowEnd);
  const unique = new Map<string, V2AggregateRow>();
  for (const event of events) {
    const blobs = event.blobs || [];
    if (blobs[0] !== 'v2' || (blobs[1] !== 'download' && blobs[1] !== 'like')) continue;
    const timestamp = event.doubles?.[1] || Date.now();
    if (Number.isFinite(timestamp) && (timestamp <= start || timestamp > end)) continue;
    const actorHash = blobs[5] || `legacy:${blobs[1]}:${blobs[3]}:${timestamp}`;
    const dayBucket = blobs[6] || new Date(timestamp).toISOString().slice(0, 10);
    const key = `${blobs[1]}\u0000${blobs[2]}\u0000${blobs[3]}\u0000${actorHash}\u0000${dayBucket}`;
    const current = unique.get(key) || { event: blobs[1] || '', type: blobs[2] || '', entryId: blobs[3] || '', total: 0, sampleInterval: 1, lastAt: new Date(timestamp).toISOString() };
    current.total = 1;
    current.lastAt = latestIso(current.lastAt, new Date(timestamp).toISOString());
    unique.set(key, current);
  }
  const grouped = new Map<string, V2AggregateRow>();
  for (const row of unique.values()) {
    const key = `${row.event}\u0000${row.type}\u0000${row.entryId}`;
    const current = grouped.get(key) || { ...row, total: 0 };
    current.total += 1;
    current.lastAt = latestIso(current.lastAt, row.lastAt);
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function utcDayBucket(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function clientFingerprint(request: Request, env: MarketEnv): string {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const salt = String(env.OPERIT_IP_SALT || env.MARKET_SESSION_SECRET || 'operit-market-ip').trim();
  return `${salt}:${ip}:${userAgent}`;
}

async function hashForAnalytics(value: string): Promise<string> {
  const input = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
    return hex(new Uint8Array(digest)).slice(0, 32);
  }
  return hex(sha256Sync(input)).slice(0, 32);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes).slice(0, 16).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getAnalyticsDatasetName(env: MarketEnv): string {
  const dataset = String(env.MARKET_ANALYTICS_DATASET || 'operit_market_stats').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dataset)) throw new Error('MARKET_ANALYTICS_DATASET must be a valid SQL table name');
  return dataset;
}

function requireAnalyticsQueryConfig(env: MarketEnv): { accountId: string; apiToken: string } {
  const accountId = String(env.MARKET_ANALYTICS_ACCOUNT_ID || '').trim();
  const apiToken = String(env.MARKET_ANALYTICS_API_TOKEN || env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId) throw new Error('MARKET_ANALYTICS_ACCOUNT_ID is not configured');
  if (!apiToken) throw new Error('MARKET_ANALYTICS_API_TOKEN is not configured');
  return { accountId, apiToken };
}

async function queryAnalyticsRows(env: MarketEnv, query: string): Promise<Record<string, unknown>[]> {
  const { accountId, apiToken } = requireAnalyticsQueryConfig(env);
  const response = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${accountId}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}` },
    body: String(query || '').trim(),
  });
  const text = await response.text();
  type AnalyticsPayload = { success?: boolean; data?: Record<string, unknown>[]; errors?: { message?: string }[]; error?: string };
  let payload: AnalyticsPayload | null = null;
  try { payload = text ? JSON.parse(text) as AnalyticsPayload : null; } catch { payload = null; }
  if (!response.ok || payload?.success === false) {
    const message = payload?.errors?.[0]?.message || payload?.error || text || response.statusText || 'analytics_query_failed';
    throw new Error(`Analytics query failed: ${message}`);
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

function quoteSqlString(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function latestIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function readShardEntry(value: unknown, entryId: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entriesById = (value as Record<string, unknown>).entriesById;
  if (!entriesById || typeof entriesById !== 'object' || Array.isArray(entriesById)) return null;
  const entry = (entriesById as Record<string, unknown>)[entryId];
  return entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : null;
}

// ---- Notifications ----

async function handleListNotifications(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const store = requireStore(env);
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100);
  const offset = Number(url.searchParams.get('offset') || '0');
  const since = url.searchParams.get('since') || undefined;
  const recipient = `gh_${session.github_id}`;
  const rows = await store.d1.listNotifications(recipient, limit, offset, since);
  const items = rows.map((r) => ({
    id: String(r.id ?? ''),
    kind: String(r.kind ?? ''),
    entryId: r.entry_id !== null && r.entry_id !== undefined ? String(r.entry_id) : null,
    commentId: r.comment_id !== null && r.comment_id !== undefined ? String(r.comment_id) : null,
    actorId: String(r.actor_id ?? ''),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    createdAt: String(r.created_at ?? ''),
  }));
  return { ok: true, items };
}
