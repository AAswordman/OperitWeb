import { createD1Backend } from './backend/D1Backend.js';
import { createR2Backend } from './backend/R2Backend.js';
import { createObjectRegistry } from './registry/ObjectRegistry.js';
import { createProjectionRegistry } from './registry/ProjectionRegistry.js';
import { validateMutation } from './model/MarketMutation.js';
import { isoNow } from '../shared.js';
import type { D1Backend, JsonObject, MarketEnv, MarketMutation, MarketStore, ProjectionPlan, R2Backend, UsageStats, V2AnalyticsAggregateInput } from '../types.js';

export function createMarketStore(env: MarketEnv): MarketStore {
  const d1: D1Backend = env.d1Backend ?? createD1Backend(requireDb(env));
  const r2: R2Backend = env.r2Backend ?? createR2Backend(requireBucket(env));
  const objectRegistry = env.objectRegistry ?? createObjectRegistry();
  const projectionRegistry = env.projectionRegistry ?? createProjectionRegistry();

  async function materializeProjection(projectionPlan: ProjectionPlan) {
    const before = usageOf(d1, r2, env);
    const scope = projectionRegistry.normalizeScope(projectionPlan.projection, projectionPlan.scope);
    const result: { written: string[] } = await projectionRegistry.render({ d1, r2 }, { ...projectionPlan, scope, ...(projectionPlan.pageSize !== undefined ? { pageSize: projectionPlan.pageSize } : {}) });
    const scopeKey = projectionRegistry.scopeKeyOf(scope);
    await d1.deleteDirty(projectionPlan.projection, scopeKey);
    return {
      ok: true as const,
      projection: projectionPlan.projection,
      scope,
      written: result.written,
      clearedDirty: [scopeKey],
      stats: diffUsage(before, usageOf(d1, r2, env)),
    };
  }

  async function materializeEntryAssets(entryId: string) {
    let materialized = 0;
    for (const asset of await d1.listAssets(entryId)) {
      await materializeProjection({ projection: 'asset.detail', scope: { assetId: String(asset.id || '') } });
      materialized++;
    }
    return { ok: true as const, materialized };
  }

  return {
    d1,
    r2,
    objectRegistry,
    projectionRegistry,

    async apply(input: MarketMutation) {
      const mutation = validateMutation(input, objectRegistry, projectionRegistry);
      const before = usageOf(d1, r2, env);
      for (const object of mutation.objects) {
        await objectRegistry.apply(object, d1);
      }
      // Mutation event → D1 (not R2)
      await d1.writeMutationLog({
        mutationId: mutation.id, actorId: mutation.actor.authorId, actorRole: mutation.actor.role,
        reason: mutation.reason, objectCount: mutation.objects.length, createdAt: mutation.createdAt,
      });
      // Dirty markers → D1 (not R2)
      const dirty = [];
      for (const effect of mutation.effects) {
        const scope = projectionRegistry.normalizeScope(effect.projection, effect.scope);
        const scopeKey = projectionRegistry.scopeKeyOf(scope);
        await d1.upsertDirty(effect.projection, scopeKey, mutation.reason, mutation.id, mutation.createdAt);
        dirty.push({ projection: effect.projection, scope, key: scopeKey });
      }
      return {
        ok: true,
        mutationId: mutation.id,
        reason: mutation.reason,
        objects: mutation.objects.length,
        events: [mutation.id],
        dirty,
        stats: diffUsage(before, usageOf(d1, r2, env)),
        materialization: { mode: 'async', estimatedDelaySeconds: 60 },
      };
    },

    async materialize(projectionPlan: ProjectionPlan) {
      return materializeProjection(projectionPlan);
    },

    async materializeEntryAssets(entryId: string) {
      return materializeEntryAssets(entryId);
    },

    async materializeEntryAssetsByEntryVersionDirty(entryId: string) {
      return materializeEntryAssets(entryId);
    },

    async readProjection(projectionPlan: ProjectionPlan) {
      const scope = projectionRegistry.normalizeScope(projectionPlan.projection, projectionPlan.scope);
      projectionRegistry.assertAllowed(projectionPlan.projection, scope);
      return r2.readJson(projectionRegistry.keyOf(projectionPlan.projection, scope));
    },

    async getMeta(key: string) {
      return d1.getMeta(key);
    },

    async setMeta(key: string, value: string) {
      return d1.setMeta(key, value);
    },

    async listDirty(limit = 100) {
      return d1.listDirty(limit);
    },

    async deleteDirty(projection, scopeKey) {
      await d1.deleteDirty(projection, scopeKey);
    },

    async loadBuildSnapshot() {
      return d1.loadBuildSnapshot();
    },

    async aggregateV2Analytics(input: V2AnalyticsAggregateInput): Promise<JsonObject> {
      if (input.rows.length === 0) {
        await d1.setMeta('v2_analytics_aggregate_cursor', input.windowEnd);
        return { ok: true, aggregated: 0, source: input.source, windowStart: input.windowStart, windowEnd: input.windowEnd };
      }

      const now = isoNow();
      let downloads = 0;
      let likes = 0;
      const touchedEntryIds = new Set<string>();
      const touchedTypes = new Set<string>();

      for (const row of input.rows) {
        const event = String(row.event || '').trim();
        const type = String(row.type || '').trim();
        const entryId = String(row.entryId || '').trim();
        if (!entryId || !type) continue;
        const total = toWeightedCount(row.total, row.sampleInterval);
        if (total <= 0) continue;
        const lastAt = normalizeOptionalTimestamp(row.lastAt) || input.windowEnd;
        const downloadDelta = event === 'download' ? total : 0;
        const likeDelta = event === 'like' ? total : 0;

        await d1.incrementEntryStats({
          entryId, type, downloadDelta, likeDelta,
          lastDownloadAt: downloadDelta > 0 ? lastAt : null,
          lastLikeAt: likeDelta > 0 ? lastAt : null,
          updatedAt: now,
        });

        if (likeDelta > 0) {
          const current = await d1.getEntryStats(entryId);
          await d1.aggregateReaction({
            id: `reaction-${entryId}-+1`,
            entryId,
            reaction: '+1',
            ghCount: Number(current?.legacy_likes || 0),
            cfCount: Number(current?.cf_likes || 0),
            totalCount: Number(current?.likes_total || 0),
            updatedAt: now,
          });
        }

        downloads += downloadDelta;
        likes += likeDelta;
        touchedEntryIds.add(entryId);
        touchedTypes.add(type);
      }

      await d1.recordAnalyticsAggregateWindow({ id: `v2-${input.windowStart}-${input.windowEnd}`, windowStart: input.windowStart, windowEnd: input.windowEnd, downloads, likes, createdAt: now });
      await d1.setMeta('v2_analytics_aggregate_cursor', input.windowEnd);

      for (const entryId of touchedEntryIds) {
        await d1.upsertDirty('entry.shard', projectionRegistry.scopeKeyOf(projectionRegistry.normalizeScope('entry.shard', { entryId })), 'analytics.aggregated', `analytics-${input.windowEnd}`, now);
      }
      await d1.upsertDirty('list.page', projectionRegistry.scopeKeyOf({ list: {}, sort: 'likes', page: 1 }), 'analytics.aggregated', `analytics-${input.windowEnd}`, now);
      for (const type of touchedTypes) {
        await d1.upsertDirty('list.page', projectionRegistry.scopeKeyOf({ list: { type }, sort: 'likes', page: 1 }), 'analytics.aggregated', `analytics-${input.windowEnd}`, now);
      }

      return { ok: true, aggregated: input.rows.length, downloads, likes, entries: touchedEntryIds.size, source: input.source, windowStart: input.windowStart, windowEnd: input.windowEnd };
    },

    async scanDirty(limit = 100) {
      const rows = await d1.listDirty(limit);
      return rows.map((r) => ({ key: `${r.projection}:${r.scope_key}` }));
    },

    async repair() {
      return { ok: true, repaired: 0, stats: usageOf(d1, r2, env) };
    },

    usage() {
      return usageOf(d1, r2, env);
    },
  };
}

function toWeightedCount(value: unknown, sampleInterval: unknown): number {
  const numericValue = Number(String(value || '0'));
  const numericSampleInterval = Number(String(sampleInterval || '1'));
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericSampleInterval)) return 0;
  return Math.max(0, Math.round(numericValue * numericSampleInterval));
}

function normalizeOptionalTimestamp(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function requireDb(env: MarketEnv) {
  if (!env.db) throw new Error('D1 database is not configured');
  return env.db;
}

function requireBucket(env: MarketEnv) {
  const bucket = env.MARKET_STATS_BUCKET ?? env.r2;
  if (!bucket) throw new Error('R2 bucket is not configured');
  return bucket;
}

function usageOf(d1: D1Backend, r2: R2Backend, env: MarketEnv): UsageStats {
  return {
    d1Reads: d1.stats.reads,
    d1Writes: d1.stats.writes,
    r2Reads: r2.stats.reads,
    r2Writes: r2.stats.writes,
    r2Lists: r2.stats.lists,
    r2Deletes: r2.stats.deletes,
    analyticsWrites: env.MARKET_ANALYTICS?.events?.length ?? 0,
  };
}

function diffUsage(before: UsageStats, after: UsageStats): UsageStats {
  return {
    d1Reads: after.d1Reads - before.d1Reads,
    d1Writes: after.d1Writes - before.d1Writes,
    r2Reads: after.r2Reads - before.r2Reads,
    r2Writes: after.r2Writes - before.r2Writes,
    r2Lists: after.r2Lists - before.r2Lists,
    r2Deletes: after.r2Deletes - before.r2Deletes,
    analyticsWrites: after.analyticsWrites - before.analyticsWrites,
  };
}
