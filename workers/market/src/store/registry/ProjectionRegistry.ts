import { MarketError } from "../.././shared.js";
import { renderCommentsPage } from "../renderers/commentsPage.js";
import { renderManifest } from "../renderers/manifest.js";
import { renderListPage } from "../renderers/listPage.js";
import { renderEntryVersions } from "../renderers/entryVersions.js";
import { renderEntryShard } from "../renderers/entryShard.js";
import { renderAssetDetail } from "../renderers/assetDetail.js";
import { renderPrivateAuthorEntries } from "../renderers/privateAuthor.js";
import { scopeHash } from "./hash.js";
import type { ProjectionName, ProjectionRegistry, ProjectionScope, ProjectionPlan, RendererContext, D1Backend, R2Backend } from "../../types.js";

type RenderFn = (ctx: RendererContext) => Promise<{ written: string[] }>;

interface ProjectionConfig {
  requiredScope: readonly string[];
  key?: (scope: Record<string, string>) => string;
  render?: RenderFn;
}

const PROJECTIONS: Record<string, ProjectionConfig> = {
  manifest: { requiredScope: [], key: () => "market/v2/manifest.json", render: renderManifest },
  "list.page": { requiredScope: ["list", "sort", "page"], key: (scope: Record<string, string>) => {
    const listKey = readableListKey(scope.list);
    return `market/v2/lists/${listKey}/${scope.sort ?? "updated"}/page-${scope.page ?? "1"}.json`;
  }, render: renderListPage },
  "entry.shard": { requiredScope: [], key: (scope: Record<string, string>) => {
    const shard = (scope.shard || (scope.entryId ? scopeHash(scope.entryId).substring(0, 2) : '')).toLowerCase();
    if (!/^[0-9a-f]{2}$/.test(shard)) throw new MarketError("validation_failed", "entry.shard requires scope.shard or scope.entryId");
    return `market/v2/entries/${shard}.json`;
  }, render: renderEntryShard },
  "entry.versions": { requiredScope: ["entryId"], key: (scope: Record<string, string>) => `market/v2/entries/${scope.entryId}/versions.json`, render: renderEntryVersions },
  "comments.page": {
    requiredScope: ["entryId", "page"],
    key: (scope: Record<string, string>) => `market/v2/comments/${scope.entryId}/page-${scope.page}.json`,
    render: renderCommentsPage,
  },
  "asset.detail": { requiredScope: ["assetId"], key: (scope: Record<string, string>) => `market/v2/assets/${scope.assetId}.json`, render: renderAssetDetail },
  "private.publisherShard": { requiredScope: ["authorId"], key: (scope: Record<string, string>) => { const authId = scope.authorId || ""; const shard = authId ? scopeHash(authId).substring(0, 2) : (scope.shard || "00"); return `market/v2/private/publishers/${shard}.json`; }, render: renderPrivateAuthorEntries },
};

export function createProjectionRegistry(): ProjectionRegistry {
  function configOf(name: ProjectionName): ProjectionConfig {
    const item = PROJECTIONS[name];
    if (!item) throw new MarketError("validation_failed", `Invalid projection: ${name}`);
    return item;
  }

  function assertAllowed(projection: ProjectionName, scope: ProjectionScope): void {
    const item = configOf(projection);
    for (const key of item.requiredScope) {
      const value = (scope as Record<string, unknown>)[key];
      if (value === undefined || value === null || String(value).trim() === "") {
        throw new MarketError("validation_failed", `projection scope.${key} is required`);
      }
    }
  }

  function normalizeScope(projection: ProjectionName, scope: ProjectionScope): ProjectionScope {
    if (projection === "entry.shard") {
      const shard = String(scope.shard || (scope.entryId ? scopeHash(scope.entryId).substring(0, 2) : "")).toLowerCase();
      if (!/^[0-9a-f]{2}$/.test(shard)) throw new MarketError("validation_failed", "entry.shard requires scope.shard or scope.entryId");
      return scope.entryId ? { shard, entryId: scope.entryId } : { shard };
    }
    return scope;
  }

  function keyOf(projection: ProjectionName, scope: ProjectionScope): string {
    const item = configOf(projection);
    if (!item.key) throw new MarketError("not_implemented", `Projection key is not implemented: ${projection}`, 501);
    const normalized = normalizeScope(projection, scope);
    const flatScope: Record<string, string> = {};
    for (const k of Object.keys(normalized)) {
      const v = (normalized as Record<string, unknown>)[k];
      flatScope[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
    }
    return item.key(flatScope);
  }

  function dirtyKey(projection: ProjectionName, scope: ProjectionScope): string {
    const normalized = normalizeScope(projection, scope);
    assertAllowed(projection, normalized);
    return `market/v2/dirty/${projection}/${scopeHash(scopeKeyOf(normalized))}.json`;
  }

  const registry: ProjectionRegistry = {
    assertAllowed,
    keyOf,
    dirtyKey,
    scopeKeyOf,
    normalizeScope,
    render: async (ctx: { d1: D1Backend; r2: R2Backend }, projectionPlan: ProjectionPlan): Promise<{ written: string[] }> => {
      const scope = normalizeScope(projectionPlan.projection, projectionPlan.scope);
      assertAllowed(projectionPlan.projection, scope);
      const item = configOf(projectionPlan.projection);
      if (!item.render) throw new MarketError("not_implemented", `Projection renderer is not implemented: ${projectionPlan.projection}`, 501);
      return item.render({ ...ctx, projectionPlan: { ...projectionPlan, scope }, projectionRegistry: registry });
    },
  };

  return registry;
}

export function scopeKeyOf(scope: ProjectionScope): string {
  return Object.keys(scope).sort().map((key) => {
    const val = (scope as Record<string, unknown>)[key];
    return `${key}=${stableValue(val)}`;
  }).join("&");
}

function stableValue(value: unknown): string {
  if (value !== undefined && value !== null && typeof value === "object") {
    return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  }
  return String(value);
}

function readableListKey(rawList: string | undefined): string {
  if (!rawList || rawList === "{}") return "all";
  try {
    const list = JSON.parse(rawList) as { type?: string; categoryId?: string; featured?: string };
    const parts: string[] = [];
    if (list.featured) parts.push("featured", safePathPart(list.featured));
    if (list.type) parts.push("type", safePathPart(list.type));
    if (list.categoryId) parts.push("category", safePathPart(list.categoryId));
    return parts.length > 0 ? parts.join("/") : "all";
  } catch {
    return `scope-${scopeHash(rawList)}`;
  }
}

function safePathPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export { scopeHash } from "./hash.js";
