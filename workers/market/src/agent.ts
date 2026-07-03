import { MarketError, corsHeaders, jsonResponse, withHeaders } from './shared.js';
import { entryShardOf } from './store/renderers/entryShard.js';
import type { JsonObject, JsonValue, MarketEnv } from './types.js';

const AGENT_PREFIX = '/market-stats/agent';

export function createAgentRoutes() {
  return { handleAgentRequest };

  async function handleAgentRequest(pathname: string, request: Request, env: MarketEnv): Promise<Response> {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    if (pathname === `${AGENT_PREFIX}/search` && request.method === 'GET') {
      const result = await agentSearch(url, env);
      return withHeaders(jsonResponse(result as unknown as JsonObject), cors);
    }

    const itemsMatch = pathname.match(/^\/market-stats\/agent\/items\/([^/]+)\/([^/]+)(\/(install-plan))?$/);
    if (itemsMatch) {
      const type: string = itemsMatch[1]!;
      const id: string = itemsMatch[2]!;
      const sub: string | undefined = itemsMatch[4];
      const result = sub === 'install-plan'
        ? await agentInstallPlan(type, id, env)
        : await agentItemDetail(type, id, env);
      return withHeaders(jsonResponse(result as unknown as JsonObject), cors);
    }

    const errorBody: Record<string, unknown> = { ok: false, error: { code: 'not_found', message: 'Agent endpoint not found' } };
    return withHeaders(jsonResponse(errorBody as unknown as JsonObject, 404), cors);
  }
}

// ---- Search ----

async function agentSearch(url: URL, env: MarketEnv): Promise<Record<string, unknown>> {
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const typeFilter = (url.searchParams.get('type') || '').trim().toLowerCase();
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || '10')), 50);

  const bucket = requireBucket(env);
  const r2 = createInlineR2(bucket);

  const manifest = await r2.readJson('market/v2/manifest.json');
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, error: { code: 'unavailable', message: 'market manifest not available' } };
  }

  const candidates: Record<string, unknown>[] = [];
  const shardKeys: string[] = [];
  for (let i = 0; i < 256; i++) {
    shardKeys.push(`market/v2/entries/${i.toString(16).padStart(2, '0')}.json`);
  }

  for (const shardKey of shardKeys) {
    const shardData = await r2.readJson(shardKey);
    if (!shardData || typeof shardData !== 'object') continue;
    const entriesById = (shardData as Record<string, unknown>).entriesById as Record<string, Record<string, unknown>> | undefined;
    if (!entriesById) continue;

    for (const [entryId, entry] of Object.entries(entriesById)) {
      if (!entry || typeof entry !== 'object') continue;

      const entryType = String(entry.type || '');
      if (typeFilter && entryType !== typeFilter) continue;

      if (q) {
        const title = String(entry.title || '').toLowerCase();
        const desc = String(entry.description || '').toLowerCase();
        if (!title.includes(q) && !desc.includes(q) && !entryId.toLowerCase().includes(q)) continue;
      }

      candidates.push({
        id: entry.id,
        type: entryType,
        title: entry.title,
        description: entry.description,
        authorId: entry.authorId,
        author: entry.author,
        categoryId: entry.categoryId,
        downloads: entry.downloads ?? entry.downloadCount ?? 0,
        stats: entry.stats,
        featured: !!entry.featured,
        latestVersion: entry.latestVersion,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        publishedAt: entry.publishedAt,
      });

      if (candidates.length >= limit) break;
    }
    if (candidates.length >= limit) break;
  }

  return {
    ok: true,
    query: q || undefined,
    type: typeFilter || undefined,
    total: candidates.length,
    items: candidates.slice(0, limit),
    types: (manifest as Record<string, unknown>).types,
    categories: (manifest as Record<string, unknown>).categories,
  };
}

// ---- Detail ----

async function agentItemDetail(itemType: string, itemId: string, env: MarketEnv): Promise<Record<string, unknown>> {
  const bucket = requireBucket(env);
  const r2 = createInlineR2(bucket);

  const shard = entryShardOf(itemId);
  const shardData = await r2.readJson(`market/v2/entries/${shard}.json`);
  if (!shardData || typeof shardData !== 'object') {
    return { ok: false, error: { code: 'not_found', message: `Item ${itemId} not found` } };
  }
  const entriesById = (shardData as Record<string, unknown>).entriesById as Record<string, Record<string, unknown>> | undefined;
  const entry = entriesById?.[itemId];
  if (!entry) {
    return { ok: false, error: { code: 'not_found', message: `Item ${itemId} not found` } };
  }

  let versions: unknown = undefined;
  try {
    versions = await r2.readJson(`market/v2/entries/${itemId}/versions.json`);
  } catch { /* ignore */ }

  const item: Record<string, unknown> = { ...entry };
  if (versions) item.versionsData = versions;

  return { ok: true, item };
}

// ---- Install plan ----

async function agentInstallPlan(itemType: string, itemId: string, env: MarketEnv): Promise<Record<string, unknown>> {
  const bucket = requireBucket(env);
  const r2 = createInlineR2(bucket);

  const shard = entryShardOf(itemId);
  const shardData = await r2.readJson(`market/v2/entries/${shard}.json`);
  if (!shardData || typeof shardData !== 'object') {
    return { ok: false, error: { code: 'not_found', message: `Item ${itemId} not found` } };
  }
  const entriesById = (shardData as Record<string, unknown>).entriesById as Record<string, Record<string, unknown>> | undefined;
  const entry = entriesById?.[itemId];
  if (!entry) {
    return { ok: false, error: { code: 'not_found', message: `Item ${itemId} not found` } };
  }

  const entryType = String(entry.type || '');
  const latest = entry.latestVersion as Record<string, unknown> | undefined;
  if (!latest) {
    return { ok: false, error: { code: 'no_version', message: 'No approved version available' } };
  }

  const plan: Record<string, unknown> = {
    type: entryType,
    id: itemId,
    version: latest.version,
    formatVer: latest.formatVer,
    title: entry.title,
    description: entry.description,
  };

  let versionsData: Record<string, unknown> | null = null;
  try {
    versionsData = await r2.readJson(`market/v2/entries/${itemId}/versions.json`) as Record<string, unknown> | null;
  } catch { /* ignore */ }

  const isPackageOrScript = entryType === 'package' || entryType === 'script';
  const isSkill = entryType === 'skill';
  const isMcp = entryType === 'mcp';

  if (isPackageOrScript) {
    let downloadUrl: string | undefined;
    let sha256: string | undefined;
    let runtimePackageId: string | undefined;

    if (versionsData?.ok && Array.isArray(versionsData.items)) {
      for (const version of versionsData.items as Record<string, unknown>[]) {
        if (String(version.state_code) !== 'approved') continue;
        if (Array.isArray(version.assets)) {
          for (const asset of version.assets as Record<string, unknown>[]) {
            downloadUrl = String(asset.url || '');
            sha256 = String(asset.sha256 || '');
            break;
          }
        }
        if (downloadUrl) {
          runtimePackageId = String(version.runtimePackageId || '');
          break;
        }
      }
    }

    if (!downloadUrl && latest.runtimePackageId) {
      runtimePackageId = String(latest.runtimePackageId);
    }

    if (downloadUrl) plan.download_url = downloadUrl;
    if (downloadUrl) plan.tracked_download_url = `${downloadUrl}?track=1`;
    if (sha256) plan.sha256 = sha256;
    if (runtimePackageId) plan.runtime_package_id = runtimePackageId;

  } else if (isSkill) {
    const source = entry.source as Record<string, unknown> | undefined;
    if (source?.url) plan.repository_url = source.url;

  } else if (isMcp) {
    const source = entry.source as Record<string, unknown> | undefined;
    if (latest.installConfig) plan.config = latest.installConfig;
    if (source?.url) plan.repository_url = source.url;
  }

  return { ok: true, installPlan: plan };
}

// ---- Helpers ----

function requireBucket(env: MarketEnv): R2Bucket {
  const bucket = (env as Record<string, unknown>).MARKET_STATS_BUCKET as R2Bucket | undefined;
  if (!bucket) throw new MarketError('server_error', 'MARKET_STATS_BUCKET is not configured', 500);
  return bucket;
}

interface R2Bucket {
  get(key: string): Promise<{ httpEtag?: string; body?: string; text?: () => Promise<string> } | null>;
}

function createInlineR2(bucket: R2Bucket) {
  return {
    async readJson(key: string): Promise<unknown> {
      const obj = await bucket.get(key);
      if (!obj) return null;
      const text = typeof obj.body === 'string' ? obj.body : await obj.text!();
      try { return JSON.parse(text) as unknown; } catch { return null; }
    },
  };
}
