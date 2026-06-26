// v1 legacy market endpoints — ported from market-stats/src/index.js
// Handles: /health, /download, /agent/search, /agent/items/*,
//          /stats.json, /stats/*, /rank/*, /artifact-rank/*, /artifact-projects/*, /manifest.json
// Cron: regenerateStaticJson from GitHub Issues → R2 market-stats/ prefix

import type { MarketEnv } from './types.js';

// ---- Constants (from v1) ----

const SUPPORTED_RANK_METRICS = ['downloads', 'likes', 'updated', 'featured'];
const FEATURED_LABEL = 'market:featured';
const DEFAULT_ALLOWED_DOWNLOAD_HOSTS = [
  'github.com', 'objects.githubusercontent.com',
  'release-assets.githubusercontent.com', 'raw.githubusercontent.com',
];
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const GITHUB_API_BASE = 'https://api.github.com';
const ISSUE_PAGE_SIZE = 100;
const AGENT_SEARCH_DEFAULT_LIMIT = 10;
const AGENT_SEARCH_MAX_LIMIT = 50;
const ANALYTICS_DOWNLOAD_EVENT = 'download';
const ANALYTICS_SUPPORTED_EVENTS: string[] = [ANALYTICS_DOWNLOAD_EVENT];
const ARTIFACT_TYPES = ['script', 'package'];
const DESCRIPTION_LABEL_WORDS = new Set([
  'description', 'desc', 'summary', 'introduction', '简介', '描述', '介绍', '说明',
]);

interface MarketSourceConfigItem { owner: string; repo: string; label: string; parser: string }
const MARKET_SOURCE_CONFIG: Record<string, MarketSourceConfigItem> = {
  script: { owner: 'AAswordman', repo: 'OperitScriptMarket', label: 'script-artifact', parser: 'artifact' },
  package: { owner: 'AAswordman', repo: 'OperitPackageMarket', label: 'package-artifact', parser: 'artifact' },
  skill: { owner: 'AAswordman', repo: 'OperitSkillMarket', label: 'skill-plugin', parser: 'skill' },
  mcp: { owner: 'AAswordman', repo: 'OperitMCPMarket', label: 'mcp-plugin', parser: 'mcp' },
};

let githubTokenCache = { token: '', expiresAt: 0 };

// ---- Route prefix stripping (from getRequestPath) ----

function normalizeRoutePrefix(value: string | undefined): string {
  if (!value) return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function getRequestPath(pathname: string, env: MarketEnv & Record<string, unknown>): string | null {
  const prefix = normalizeRoutePrefix(env.MARKET_ROUTE_PREFIX as string | undefined);
  if (!prefix) return pathname;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || '/';
  if (prefix === '/' || prefix === '') return pathname;
  return null;
}

// ---- Helpers ----

function splitCsv(value: string | undefined): string[] {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function normalizeType(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeArtifactId(value: string | undefined | null): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function normalizeTargetUrl(value: string | undefined | null): string {
  return String(value || '').trim();
}

function getSupportedTypes(env: MarketEnv & Record<string, unknown>): string[] {
  const configured = splitCsv(env.MARKET_SUPPORTED_TYPES as string | undefined);
  const unique = [...new Set(configured.map(normalizeType).filter(Boolean))];
  return unique.length > 0 ? unique : ['script', 'package', 'skill', 'mcp'];
}

function getStaticObjectPrefix(env: MarketEnv & Record<string, unknown>): string {
  return String(env.MARKET_STATIC_OBJECT_PREFIX || 'market-stats').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function buildStaticObjectKey(logicalKey: string, env: MarketEnv & Record<string, unknown>): string {
  const cleanKey = logicalKey.replace(/^\/+/, '');
  const prefix = getStaticObjectPrefix(env);
  return prefix ? `${prefix}/${cleanKey}` : cleanKey;
}

function getStaticJsonCacheControl(env: MarketEnv & Record<string, unknown>): string {
  const maxAge = parseInt(String(env.MARKET_JSON_CACHE_MAX_AGE || '300'), 10) || 300;
  return `public, max-age=${maxAge}, stale-while-revalidate=300`;
}

function canRegenerateStaticJson(env: MarketEnv & Record<string, unknown>): boolean {
  return String(env.MARKET_ROUTE_PREFIX || '').trim() !== '';
}

function getPositiveInt(value: unknown, fallback: number): number {
  const n = parseInt(String(value || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildCorsHeaders(request: Request, env: MarketEnv & Record<string, unknown>): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowedOrigins = splitCsv(env.MARKET_ALLOWED_ORIGINS as string | undefined);
  const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes('*');
  return {
    'access-control-allow-origin': allowAll ? '*' : (allowedOrigins.includes(origin || '') ? origin! : allowedOrigins[0] || '*'),
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}

function json(value: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function redirect(target: string, corsHeaders: Record<string, string>): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, location: target, 'cache-control': 'no-store' },
  });
}

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function clampNumber(raw: string | null, min: number, max: number, fallback: number): number {
  const n = parseInt(String(raw || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ---- Validation ----

function validateType(type: string, env: MarketEnv & Record<string, unknown>): void {
  if (!getSupportedTypes(env).includes(type)) throw new Error(`Unsupported type: ${type}`);
}
function validateArtifactId(id: string): void {
  if (!id) throw new Error('Missing artifact id');
}
function validateTargetUrl(target: string, env: MarketEnv & Record<string, unknown>): void {
  if (!target) throw new Error('Missing target URL');
  const parsed = new URL(target);
  if (parsed.protocol !== 'https:') throw new Error('Target URL must use https');
  const allowedHosts = splitCsv(env.MARKET_ALLOWED_DOWNLOAD_HOSTS as string | undefined);
  const candidates = allowedHosts.length > 0 ? allowedHosts : DEFAULT_ALLOWED_DOWNLOAD_HOSTS;
  const hostname = parsed.hostname.toLowerCase();
  if (!candidates.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
    throw new Error(`Target host is not allowed: ${parsed.hostname}`);
  }
}

function requireAnalyticsBinding(env: MarketEnv & Record<string, unknown>): void {
  const ae = env.MARKET_ANALYTICS as Record<string, unknown> | undefined;
  if (!ae || typeof ae.writeDataPoint !== 'function') throw new Error('MARKET_ANALYTICS binding is not configured');
}
function requireStatsBucket(env: MarketEnv & Record<string, unknown>): void {
  if (!env.MARKET_STATS_BUCKET) throw new Error('MARKET_STATS_BUCKET binding is not configured');
}

// ---- Download handler ----

function recordMarketCounter(env: MarketEnv & Record<string, unknown>, type: string, id: string, counterField: string): void {
  const event = counterField === 'downloads' ? ANALYTICS_DOWNLOAD_EVENT : counterField;
  const ae = env.MARKET_ANALYTICS as Record<string, unknown> | undefined;
  if (ae && typeof ae.writeDataPoint === 'function') {
    (ae.writeDataPoint as Function)({ blobs: [type, id, event], doubles: [1], indexes: [`${type}:${id}:${event}`] });
  }
}

async function handleDownload(request: Request, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  requireAnalyticsBinding(env);
  const url = new URL(request.url);
  const type = normalizeType(url.searchParams.get('type'));
  const id = normalizeArtifactId(url.searchParams.get('id'));
  const target = normalizeTargetUrl(url.searchParams.get('target'));
  validateType(type, env);
  validateArtifactId(id);
  validateTargetUrl(target, env);
  recordMarketCounter(env, type, id, 'downloads');
  return redirect(target, corsHeaders);
}

// ---- Static JSON handlers ----

function isStaticJsonPath(pathname: string): boolean {
  return pathname === '/stats.json' || pathname === '/manifest.json' ||
    pathname.startsWith('/stats/') || pathname.startsWith('/rank/') ||
    pathname.startsWith('/artifact-rank/') || pathname.startsWith('/artifact-projects/');
}

async function handleStaticJson(pathname: string, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  requireStatsBucket(env);
  const key = pathname.replace(/^\//, '');
  const bucket = env.MARKET_STATS_BUCKET as { get: (k: string) => Promise<{ httpEtag?: string; body?: string; text?: () => Promise<string> } | null> };
  let object = await bucket.get(buildStaticObjectKey(key, env));
  if (!object && canRegenerateStaticJson(env)) {
    await regenerateStaticJson(env);
    object = await bucket.get(buildStaticObjectKey(key, env));
  }
  if (!object) return json({ error: 'not_found', key }, 404, corsHeaders);
  const headers: Record<string, string> = {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': getStaticJsonCacheControl(env),
  };
  if (object.httpEtag) headers.etag = object.httpEtag;
  return new Response(object.body, { status: 200, headers });
}

// ---- Agent search ----

function normalizeSearchText(value: string): string {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeAgentType(value: string): string {
  const type = normalizeType(value);
  if (type === 'mcp' || type === 'skill' || type === 'script' || type === 'package' || type === 'artifact') return type;
  return '';
}

function resolveAgentTypes(raw: string | null, env: MarketEnv & Record<string, unknown>): string[] {
  const supportedTypes = new Set(getSupportedTypes(env));
  const requested = splitCsv(raw || '').flatMap(type => {
    const n = normalizeAgentType(type);
    return n === 'artifact' ? ['script', 'package'] : [n];
  }).filter(type => type && supportedTypes.has(type));
  const defaults = ['mcp', 'skill', 'package', 'script'].filter(t => supportedTypes.has(t));
  return [...new Set(requested.length > 0 ? requested : defaults)];
}

function matchesAgentQuery(item: Record<string, unknown>, query: string): boolean {
  if (!query) return true;
  const nq = normalizeSearchText(query);
  const haystack = normalizeSearchText([
    item.id, item.type, item.name, item.description, item.author,
    item.version, item.category, item.repository_url, item.runtime_package_id,
    item.source_file_name, ...(Array.isArray(item.tags) ? item.tags as string[] : []),
  ].join('\n'));
  return nq.split(/\s+/).filter(Boolean).every(p => haystack.includes(p));
}

function scoreAgentItem(item: Record<string, unknown>, query: string): number {
  if (!query) return 0;
  const nq = normalizeSearchText(query);
  const name = normalizeSearchText(String(item.name || ''));
  const id = normalizeSearchText(String(item.id || ''));
  const tags = normalizeSearchText((Array.isArray(item.tags) ? item.tags as string[] : []).join(' '));
  const desc = normalizeSearchText(String(item.description || ''));
  let score = 0;
  if (name === nq || id === nq) score += 100;
  if (name.includes(nq)) score += 40;
  if (id.includes(nq)) score += 30;
  if (tags.includes(nq)) score += 20;
  if (desc.includes(nq)) score += 10;
  return score;
}

function omitAgentInstallPlan(item: Record<string, unknown>): Record<string, unknown> {
  const { install_plan: _, ...rest } = item;
  return rest;
}

// ---- Agent items from v1 R2 data ----

async function loadV1Index(env: MarketEnv & Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const bucket = env.MARKET_STATS_BUCKET as { get: (k: string) => Promise<{ text?: () => Promise<string>; body?: string } | null> };
  const manifestKey = buildStaticObjectKey('manifest.json', env);
  const obj = await bucket.get(manifestKey);
  if (!obj) return [];
  const text = typeof obj.text === 'function' ? await obj.text() : String(obj.body || '');
  const manifest = JSON.parse(text) as { keys?: string[] };
  // Load all rank/page JSONs
  const items: Record<string, unknown>[] = [];
  for (const key of (manifest.keys || [])) {
    if (!key.startsWith('rank/') && !key.startsWith('artifact-rank/')) continue;
    const pageObj = await bucket.get(buildStaticObjectKey(key, env));
    if (!pageObj) continue;
    const pageText = typeof pageObj.text === 'function' ? await pageObj.text() : String(pageObj.body || '');
    try {
      const page = JSON.parse(pageText) as { items?: Record<string, unknown>[] };
      if (page.items && Array.isArray(page.items)) items.push(...page.items);
    } catch { /* skip malformed */ }
  }
  // deduplicate by id
  const seen = new Set<string>();
  return items.filter(item => {
    const id = String(item.id || '');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function handleAgentSearch(request: Request, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  const types = resolveAgentTypes(url.searchParams.get('type'), env);
  const limit = clampNumber(url.searchParams.get('limit'), 1, AGENT_SEARCH_MAX_LIMIT, AGENT_SEARCH_DEFAULT_LIMIT);
  const includeInstallPlan = url.searchParams.get('include_install_plan') === '1';

  const all = await loadV1Index(env);
  const matching = all
    .filter(item => types.includes(String(item.type || '')))
    .filter(item => matchesAgentQuery(item, query))
    .sort((a, b) => scoreAgentItem(b, query) - scoreAgentItem(a, query))
    .slice(0, limit)
    .map(item => includeInstallPlan ? item : omitAgentInstallPlan(item));

  return json({ ok: true, query, types, count: matching.length, items: matching }, 200, corsHeaders);
}

async function handleAgentItemRequest(request: Request, pathname: string, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const parts = pathname.split('/').filter(Boolean);
  // /agent/items/{type}/{id}[/install-plan]
  const type = normalizeType(parts[2]);
  const id = parts[3] || '';
  const isInstallPlan = parts[4] === 'install-plan';

  const all = await loadV1Index(env);
  const item = all.find(i => normalizeType(String(i.type || '')) === type && String(i.id || '') === id);
  if (!item) return json({ error: 'not_found', type, id }, 404, corsHeaders);

  return json({ ok: true, item: isInstallPlan ? item : omitAgentInstallPlan(item) }, 200, corsHeaders);
}

// ---- R2 regeneration (cron from v1) ----
// Simplified: reads from GitHub Issues → writes rank/stats JSON to market-stats/ prefix

async function fetchGitHubToken(env: MarketEnv & Record<string, unknown>): Promise<string> {
  if (githubTokenCache.token && githubTokenCache.expiresAt > Date.now()) {
    return githubTokenCache.token;
  }
  // Use GITHUB_TOKEN from env or app installation token
  const token = String(env.GITHUB_TOKEN || '');
  if (!token) throw new Error('GITHUB_TOKEN not configured');

  // Try app installation token refresh if needed
  const appId = env.GITHUB_APP_ID as string | undefined;
  const appPem = env.GITHUB_APP_PEM as string | undefined;
  const installId = env.GITHUB_INSTALLATION_ID as string | undefined;

  if (appId && appPem && installId) {
    // Generate JWT for GitHub App
    const now = Math.floor(Date.now() / 1000);
    const payload = { iat: now - 60, exp: now + 600, iss: appId };
    // Simple RS256 JWT — production uses WebCrypto
    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = base64UrlFromString(JSON.stringify(header));
    const encodedPayload = base64UrlFromString(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // In production, this uses crypto.subtle.importKey with the PEM
    // For now, use a fallback: try direct token first
    const appResp = await fetch(`https://api.github.com/app/installations/${installId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await signJwtWithPem(appPem, signingInput)}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'operit-market-stats',
      },
    });
    if (appResp.ok) {
      const data = await appResp.json() as { token?: string; expires_at?: string };
      if (data.token) {
        githubTokenCache = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
        return data.token;
      }
    }
  }
  // Fallback: use env token directly
  return token;
}

function base64UrlFromString(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwtWithPem(_pem: string, _signingInput: string): Promise<string> {
  // Stub: production uses crypto.subtle.sign
  return '';
}

async function fetchIssues(token: string, owner: string, repo: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=all&per_page=${ISSUE_PAGE_SIZE}&page=${page}`;
    const resp = await fetch(url, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'operit-market-stats' },
    });
    if (!resp.ok) break;
    const issues = await resp.json() as Record<string, unknown>[];
    if (!issues.length) break;
    all.push(...issues.filter(i => !i.pull_request));
    if (issues.length < ISSUE_PAGE_SIZE) break;
    page++;
  }
  return all;
}

function parseHiddenJson(body: string, label: string): Record<string, unknown> | null {
  const jsonLabel = `operit-${label}-json`;
  const re = new RegExp(`<!--\\s*${jsonLabel}\\s*([\\s\\S]*?)\\s*-->`, 'im');
  const m = re.exec(body);
  if (!m || !m[1]) return null;
  try {
    return JSON.parse(m[1].trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractDescription(body: string): string {
  const cleaned = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.slice(0, 500);
}

function latestTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

// ---- Regeneration ----

async function regenerateStaticJson(env: MarketEnv & Record<string, unknown>): Promise<void> {
  const token = await fetchGitHubToken(env);
  const supportedTypes = getSupportedTypes(env);
  const pageSize = getPositiveInt(env.MARKET_RANK_PAGE_SIZE, 20);
  const maxPages = getPositiveInt(env.MARKET_RANK_MAX_PAGES, 0);

  // Fetch all issues from each source repo
  const allEntries: Record<string, unknown>[] = [];
  for (const type of supportedTypes) {
    const cfg = MARKET_SOURCE_CONFIG[type];
    if (!cfg) continue;
    const issues = await fetchIssues(token, cfg.owner, cfg.repo);
    for (const issue of issues) {
      const body = String(issue.body || '');
      const parsed = parseHiddenJson(body, cfg.parser);
      const labels = (issue.labels as { name?: string }[] || []).map(l => String(l.name || ''));
      if (!parsed) continue;

      allEntries.push({
        type,
        id: normalizeArtifactId(String(parsed.id || issue.number || '')),
        name: String(parsed.name || issue.title || ''),
        description: extractDescription(String(parsed.description || body)),
        author: String(parsed.author || ((issue.user) as Record<string, unknown>)?.['login'] || ''),
        version: String(parsed.version || ''),
        category: labels.find(l => l.startsWith('category:'))?.replace('category:', '') || 'other',
        tags: (parsed.tags && Array.isArray(parsed.tags)) ? parsed.tags as string[] : [],
        repository_url: String(parsed.repository_url || parsed.repositoryUrl || ''),
        download_url: String(parsed.download_url || parsed.downloadUrl || ''),
        sha256: String(parsed.sha256 || ''),
        metadata: parsed,
        updatedAt: String(issue.updated_at || ''),
        isFeatured: labels.includes(FEATURED_LABEL),
      });
    }
  }

  // Write R2 static JSON
  const updatedAt = new Date().toISOString();
  const writes: Promise<unknown>[] = [];
  const manifestKeys: string[] = [];

  // Stats by type
  const statsByType: Record<string, Record<string, { downloads: number; lastDownloadAt: string | null; updatedAt: string | null }>> = {};
  for (const t of supportedTypes) statsByType[t] = {};

  writes.push(putStaticJson(env, 'stats.json', { updatedAt, items: statsByType }));
  manifestKeys.push('stats.json');

  for (const type of supportedTypes) {
    const sk = `stats/${type}.json`;
    writes.push(putStaticJson(env, sk, { updatedAt, items: statsByType[type] }));
    manifestKeys.push(sk);

    const entries = allEntries.filter(e => String(e.type || '') === type);
    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = [...entries].sort((a, b) => {
        if (metric === 'featured') return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        if (metric === 'updated') return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        return 0;
      });
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;
      for (let page = 1; page <= pageCount; page++) {
        const start = (page - 1) * pageSize;
        const slice = sorted.slice(start, start + pageSize);
        const key = `rank/${type}-${metric}-page-${page}.json`;
        writes.push(putStaticJson(env, key, { updatedAt, type, metric, page, pageSize, totalPages, totalItems: sorted.length, items: slice }));
        manifestKeys.push(key);
      }
    }
  }

  // Manifest
  writes.push(putStaticJson(env, 'manifest.json', { updatedAt, keys: manifestKeys }));
  await Promise.all(writes);
}

async function putStaticJson(env: MarketEnv & Record<string, unknown>, logicalKey: string, value: unknown): Promise<void> {
  const bucket = env.MARKET_STATS_BUCKET as { put: (k: string, v: string, opts?: Record<string, unknown>) => Promise<unknown> };
  await bucket.put(buildStaticObjectKey(logicalKey, env), JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: getStaticJsonCacheControl(env) },
  });
}

// ---- Export ----

export interface V1Routes {
  handleFetch(request: Request, env: MarketEnv): Promise<Response>;
  handleScheduled(env: MarketEnv): Promise<void>;
}

export function createV1Routes(): V1Routes {
  return {
    async handleFetch(request: Request, env: MarketEnv): Promise<Response> {
      const url = new URL(request.url);
      const pathname = getRequestPath(url.pathname, env as MarketEnv & Record<string, unknown>);
      const corsHeaders = buildCorsHeaders(request, env as MarketEnv & Record<string, unknown>);

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (pathname === null) {
        return json({ error: 'not_found' }, 404, corsHeaders);
      }

      if (pathname === '/health') {
        return json({ ok: true }, 200, corsHeaders);
      }

      if (pathname === '/download') {
        return handleDownload(request, env as MarketEnv & Record<string, unknown>, corsHeaders);
      }

      if (pathname === '/agent/search') {
        return handleAgentSearch(request, env as MarketEnv & Record<string, unknown>, corsHeaders);
      }

      if (pathname.startsWith('/agent/items/')) {
        return handleAgentItemRequest(request, pathname, env as MarketEnv & Record<string, unknown>, corsHeaders);
      }

      if (isStaticJsonPath(pathname)) {
        return handleStaticJson(pathname, env as MarketEnv & Record<string, unknown>, corsHeaders);
      }

      return json({ error: 'not_found', supported_routes: [
        '/health', '/download', '/stats.json', '/stats/<type>.json',
        '/rank/<type>-<metric>-page-<n>.json', '/artifact-rank/<type>-<metric>-page-<n>.json',
        '/artifact-projects/<projectId>.json', '/agent/search',
        '/agent/items/<type>/<id>', '/agent/items/<type>/<id>/install-plan', '/manifest.json',
      ] }, 404, corsHeaders);
    },

    async handleScheduled(env: MarketEnv): Promise<void> {
      await regenerateStaticJson(env as MarketEnv & Record<string, unknown>);
    },
  };
}
