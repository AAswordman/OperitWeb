import { createD1Backend } from './backend/D1Backend.js';
import { createR2Backend } from './backend/R2Backend.js';
import { createObjectRegistry } from './registry/ObjectRegistry.js';
import { createProjectionRegistry } from './registry/ProjectionRegistry.js';
import { validateMutation } from './model/MarketMutation.js';
import type { D1Backend, MarketEnv, MarketMutation, MarketStore, ProjectionPlan, R2Backend, UsageStats } from '../types.js';

export function createMarketStore(env: MarketEnv): MarketStore {
  const d1: D1Backend = env.d1Backend ?? createD1Backend(requireDb(env));
  const r2: R2Backend = env.r2Backend ?? createR2Backend(requireBucket(env));
  const objectRegistry = env.objectRegistry ?? createObjectRegistry();
  const projectionRegistry = env.projectionRegistry ?? createProjectionRegistry();

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
      const before = usageOf(d1, r2, env);
      const scope = projectionRegistry.normalizeScope(projectionPlan.projection, projectionPlan.scope);
      const result: { written: string[] } = await projectionRegistry.render({ d1, r2 }, { ...projectionPlan, scope });
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
    },

    async readProjection(projectionPlan: ProjectionPlan) {
      const scope = projectionRegistry.normalizeScope(projectionPlan.projection, projectionPlan.scope);
      projectionRegistry.assertAllowed(projectionPlan.projection, scope);
      return r2.readJson(projectionRegistry.keyOf(projectionPlan.projection, scope));
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
