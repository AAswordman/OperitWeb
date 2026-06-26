import { assertAuthorActive, requireSession, upsertAuthorFromSession } from './auth.js';
import { MarketError, extractIdFromPath, isoNow, requireString } from './shared.js';
import { commentCreateMutation, commentHideMutation, commentUpdateMutation } from './translators/comment.js';
import { notifyCommentCreated } from './translators/notify.js';
import type { JsonObject, MarketEnv, MarketStore } from './types.js';

export function createInteractRoutes(): {
  addComment(request: Request, env: MarketEnv): Promise<JsonObject>;
  editComment(request: Request, env: MarketEnv): Promise<JsonObject>;
  deleteComment(request: Request, env: MarketEnv): Promise<JsonObject>;
  reactToEntry(request: Request, env: MarketEnv): Promise<JsonObject>;
  downloadAsset(request: Request, env: MarketEnv): Promise<Response>;
  aggregateReactions(env: MarketEnv): Promise<JsonObject>;
  listNotifications(request: Request, env: MarketEnv): Promise<JsonObject>;
} {
  return { addComment, editComment, deleteComment, reactToEntry, downloadAsset, aggregateReactions, listNotifications: handleListNotifications };
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
  const body = await jsonBody(request);
  const applied = await store.apply(commentUpdateMutation({ commentId, entryId: String(comment.entry_id), actorId: author.id, patch: { body: requireString(body.body, 'body') } }));
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
  const applied = await store.apply(commentHideMutation({ commentId, entryId: String(comment.entry_id), actorId: author.id }));
  return { ok: true, stats: applied.stats as unknown as JsonObject };
}

async function reactToEntry(request: Request, env: MarketEnv): Promise<JsonObject> {
  const session = await requireSession(request, env);
  const entryId = extractIdFromPath(request.url, '/entries/', '/reactions');
  env.MARKET_ANALYTICS?.writeDataPoint?.({ blobs: ['reaction', entryId, '+1'], doubles: [Date.now()], indexes: [String(session.github_id)] });
  return { ok: true, accepted: true };
}

async function downloadAsset(request: Request, env: MarketEnv): Promise<Response> {
  const assetId = extractIdFromPath(request.url, '/assets/', '/download');
  const detail = await env.store?.readProjection({ projection: 'asset.detail', scope: { assetId } });
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new MarketError('not_found', 'Asset not found', 404);
  const item = (detail as { item?: { url?: string } }).item;
  if (!item?.url) throw new MarketError('not_found', 'Asset not found', 404);
  env.MARKET_ANALYTICS?.writeDataPoint?.({ blobs: ['download', assetId], doubles: [Date.now()], indexes: [] });
  return Response.redirect(item.url, 302);
}

async function aggregateReactions(env: MarketEnv): Promise<JsonObject> {
  const store = requireStore(env);
  const events: { blobs?: string[] }[] = env.MARKET_ANALYTICS?.events as { blobs?: string[] }[] ?? [];
  const counts = new Map<string, { entryId: string; count: number }>();
  for (const event of events) {
    const blobs = event.blobs || [];
    if (blobs[0] !== 'reaction' || !blobs[1] || !blobs[2]) continue;
    const key = `${blobs[1]}:${blobs[2]}`;
    const existing = counts.get(key);
    if (existing) { existing.count++; continue; }
    counts.set(key, { entryId: blobs[1], count: 1 });
  }
  const time = isoNow();
  const objects: { kind: 'ReactionStat'; operation: 'aggregate'; id: string; value: Record<string, unknown> }[] = [];
  for (const [key, info] of counts) {
    const reaction = key.split(':')[1] || '+1';
    objects.push({ kind: 'ReactionStat', operation: 'aggregate', id: `reaction-${info.entryId}-${reaction}`, value: { id: `reaction-${info.entryId}-${reaction}`, entryId: info.entryId, reaction, ghCount: 0, cfCount: info.count, totalCount: info.count, updatedAt: time } });
  }
  if (objects.length === 0) return { ok: true, aggregated: 0 };
  const applied = await store.apply({ type: 'mutation', id: `mut-reaction-aggregate-${Date.now()}`, actor: { authorId: 'system', role: 'system' }, reason: 'reaction.aggregated', createdAt: time, objects, effects: [] });
  return { ok: true, aggregated: objects.length, stats: applied.stats as unknown as JsonObject };
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
