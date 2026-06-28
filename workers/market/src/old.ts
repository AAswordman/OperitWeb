// v1 legacy market endpoints — ported from market-stats/src/index.js
// Handles: /health, /download, /like, /agent/search, /agent/items/*,
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
const ANALYTICS_LIKE_EVENT = 'like';
const ANALYTICS_SUPPORTED_EVENTS: string[] = [ANALYTICS_DOWNLOAD_EVENT, ANALYTICS_LIKE_EVENT];
const ARTIFACT_TYPES = ['script', 'package'];
const DESCRIPTION_LABEL_WORDS = new Set([
  'description', 'desc', 'summary', 'introduction', '简介', '描述', '介绍', '说明',
]);

interface MarketSourceConfigItem { owner: string; repo: string; label: string; parser: string }
interface LegacyIssueUser { id?: number | string | null; login?: string; avatar_url?: string }
interface LegacyIssueLabel { id?: number | string | null; name?: string; color?: string; description?: string | null }
interface LegacyIssueReactions {
  total_count?: number | string | null;
  '+1'?: number | string | null;
  '-1'?: number | string | null;
  laugh?: number | string | null;
  hooray?: number | string | null;
  confused?: number | string | null;
  heart?: number | string | null;
  rocket?: number | string | null;
  eyes?: number | string | null;
}
interface LegacyIssue {
  id?: number | string | null;
  number?: number | string | null;
  title?: string | null;
  body?: string | null;
  html_url?: string | null;
  state?: string | null;
  labels?: LegacyIssueLabel[];
  user?: LegacyIssueUser | null;
  created_at?: string | null;
  updated_at?: string | null;
  reactions?: LegacyIssueReactions | null;
  pull_request?: unknown;
}
interface LegacyEntry extends Record<string, unknown> {
  id: string;
  downloads: number;
  likes: number;
  lastDownloadAt: string | null;
  updatedAt: string | null;
  statsUpdatedAt: string | null;
  displayTitle: string;
  summaryDescription: string;
  authorLogin: string;
  authorAvatarUrl: string;
  metadata: Record<string, unknown> | null;
  issue: LegacyIssue;
  featured: boolean;
}
interface LegacyStats { downloads: number; likes: number; lastDownloadAt: string | null; updatedAt: string | null }
interface ArtifactNode extends Record<string, unknown> {
  projectId: string;
  type: string;
  projectDisplayName: string;
  projectDescription: string;
  runtimePackageId: string;
  nodeId: string;
  rootNodeId: string;
  parentNodeIds: string[];
  publisherLogin: string;
  releaseTag: string;
  assetName: string;
  downloadUrl: string;
  sha256: string;
  version: string;
  displayName: string;
  description: string;
  sourceFileName: string;
  minSupportedAppVersion: string | null;
  maxSupportedAppVersion: string | null;
  publishedAt: string | null;
  state: string;
  featured: boolean;
  issue: LegacyIssue;
}
interface ArtifactSummary {
  projectId: string;
  type: string;
  projectDisplayName: string;
  projectDescription: string;
  rootNodeId: string;
  rootPublisherLogin: string;
  rootPublisherAvatarUrl: string;
  contributorCount: number;
  downloads: number;
  likes: number;
  featured: boolean;
  latestNodeId: string;
  latestOpenNodeId: string;
  defaultNodeId: string;
  latestPublishedAt: string | null;
  defaultNode: Record<string, unknown> | null;
  runtimePackageNodeSha256s: string[];
  nodes: ArtifactNode[];
  edges: { parentNodeId: string; childNodeId: string }[];
}
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
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'artifact';
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

function getNonNegativeInt(value: unknown, fallback: number): number {
  const n = parseInt(String(value || ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toInt(value: unknown): number {
  const n = parseInt(String(value || '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function compareStrings(left: unknown, right: unknown): number {
  return String(left || '').localeCompare(String(right || ''));
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeOptionalTimestamp(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function isArtifactType(type: string): boolean {
  return ARTIFACT_TYPES.includes(normalizeType(type));
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

async function handleLike(request: Request, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  requireAnalyticsBinding(env);
  const url = new URL(request.url);
  const type = normalizeType(url.searchParams.get('type'));
  const id = normalizeArtifactId(url.searchParams.get('id'));
  validateType(type, env);
  validateArtifactId(id);
  recordMarketCounter(env, type, id, ANALYTICS_LIKE_EVENT);
  return json({ ok: true, accepted: true }, 200, corsHeaders);
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

function normalizeTagList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20);
  return String(value || '').replace(/[;|]/g, ',').split(/[,\n，]/).map(item => item.trim()).filter(Boolean).slice(0, 20);
}

function stripJsonCodeFence(value: unknown): string {
  const trimmed = String(value || '').trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenceMatch ? (fenceMatch[1] || '').trim() : trimmed;
}

function parseJsonObjectOrNull(value: string): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizeRoutePrefixForUrl(pathname: string): string {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const agentIndex = parts.indexOf('agent');
  if (agentIndex <= 0) return '';
  return `/${parts.slice(0, agentIndex).join('/')}`;
}

function buildTrackedDownloadUrl(type: string, projectId: unknown, target: unknown, request: Request): string {
  const targetUrl = String(target || '').trim();
  const id = String(projectId || '').trim();
  if (!targetUrl || !id) return '';
  const url = new URL(request.url);
  url.pathname = `${normalizeRoutePrefixForUrl(url.pathname)}/download`.replace(/\/{2,}/g, '/');
  url.search = '';
  url.searchParams.set('type', type);
  url.searchParams.set('id', normalizeArtifactId(id));
  url.searchParams.set('target', targetUrl);
  return url.toString();
}

function buildIssueInstallPlan(type: string, entry: Record<string, unknown>, _request: Request): Record<string, unknown> {
  const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata as Record<string, unknown> : {};
  const repositoryUrl = String(metadata.repositoryUrl || '').trim();
  if (type === 'skill') {
    return { method: 'skill_repo', repository_url: repositoryUrl, tool_hint: 'install_skill_from_repo_url', args: { repository_url: repositoryUrl } };
  }
  const installConfigText = stripJsonCodeFence(String(metadata.installConfig || '').trim());
  const parsedConfig = parseJsonObjectOrNull(installConfigText);
  if (parsedConfig) {
    return { method: 'mcp_config', config: parsedConfig, config_text: installConfigText, tool_hint: 'install_mcp_from_config', args: { config: parsedConfig } };
  }
  return { method: 'mcp_repo', repository_url: repositoryUrl, config_text: installConfigText, tool_hint: 'install_mcp_from_repo_url', args: { repository_url: repositoryUrl } };
}

function buildArtifactInstallPlan(type: string, projectId: unknown, node: Record<string, unknown>, request: Request): Record<string, unknown> {
  const downloadUrl = String(node.downloadUrl || '').trim();
  const sha256 = String(node.sha256 || '').trim();
  const runtimePackageId = String(node.runtimePackageId || projectId || '').trim();
  const trackedDownloadUrl = buildTrackedDownloadUrl(type, projectId, downloadUrl, request);
  return {
    method: 'artifact_download',
    artifact_type: type,
    runtime_package_id: runtimePackageId,
    download_url: downloadUrl,
    tracked_download_url: trackedDownloadUrl,
    sha256,
    tool_hint: type === 'package' ? 'install_package_from_url' : 'install_script_from_url',
    args: { url: trackedDownloadUrl || downloadUrl, sha256, runtime_package_id: runtimePackageId },
  };
}

function buildAgentIssueItem(type: string, entry: Record<string, unknown>, request: Request, includeRaw = false): Record<string, unknown> | null {
  const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata as Record<string, unknown> : {};
  const item: Record<string, unknown> = {
    id: String(entry.id || ''),
    type,
    name: String(entry.displayTitle || (entry.issue as LegacyIssue | undefined)?.title || '').trim(),
    description: String(entry.summaryDescription || metadata.description || '').trim(),
    author: String(entry.authorLogin || '').trim(),
    author_avatar_url: String(entry.authorAvatarUrl || '').trim(),
    version: String(metadata.version || '').trim(),
    category: String(metadata.category || '').trim(),
    tags: normalizeTagList(metadata.tags),
    downloads: toInt(entry.downloads),
    likes: getThumbsUpCount(entry),
    updated_at: entry.updatedAt || null,
    issue_url: String((entry.issue as LegacyIssue | undefined)?.html_url || '').trim(),
    repository_url: String(metadata.repositoryUrl || '').trim(),
    install_plan: buildIssueInstallPlan(type, entry, request),
  };
  if (includeRaw) {
    item.metadata = metadata;
    item.issue = entry.issue || null;
  }
  return item.id ? item : null;
}

function buildAgentArtifactRankItem(type: string, entry: Record<string, unknown>, request: Request): Record<string, unknown> | null {
  const node = entry.defaultNode && typeof entry.defaultNode === 'object' ? entry.defaultNode as Record<string, unknown> : {};
  const item = {
    id: String(entry.projectId || ''),
    type,
    name: String(entry.projectDisplayName || '').trim(),
    description: String(entry.projectDescription || '').trim(),
    author: String(entry.rootPublisherLogin || '').trim(),
    author_avatar_url: String(entry.rootPublisherAvatarUrl || '').trim(),
    version: String(node.version || '').trim(),
    category: '',
    tags: [],
    downloads: toInt(entry.downloads),
    likes: toInt(entry.likes),
    updated_at: entry.latestPublishedAt || null,
    runtime_package_id: String(node.runtimePackageId || '').trim(),
    sha256: String(node.sha256 || '').trim(),
    download_url: String(node.downloadUrl || '').trim(),
    install_plan: buildArtifactInstallPlan(type, entry.projectId, node, request),
  };
  return item.id ? item : null;
}

function buildAgentArtifactItem(type: string, detail: Record<string, unknown>, request: Request, includeRaw = false): Record<string, unknown> | null {
  const nodes = Array.isArray(detail.nodes) ? detail.nodes as Record<string, unknown>[] : [];
  const defaultNode = nodes.find(node => node.nodeId === detail.defaultNodeId) || nodes[0] || {};
  const item: Record<string, unknown> = {
    id: String(detail.projectId || '').trim(),
    type: normalizeAgentType(String(detail.type || '')) || type,
    name: String(detail.projectDisplayName || defaultNode.displayName || '').trim(),
    description: String(detail.projectDescription || defaultNode.description || '').trim(),
    author: String(detail.rootPublisherLogin || defaultNode.publisherLogin || '').trim(),
    author_avatar_url: String(detail.rootPublisherAvatarUrl || '').trim(),
    version: String(defaultNode.version || '').trim(),
    category: '',
    tags: [],
    downloads: toInt(detail.downloads),
    likes: toInt(detail.likes),
    updated_at: detail.latestPublishedAt || defaultNode.publishedAt || null,
    runtime_package_id: String(defaultNode.runtimePackageId || '').trim(),
    sha256: String(defaultNode.sha256 || '').trim(),
    download_url: String(defaultNode.downloadUrl || '').trim(),
    source_file_name: String(defaultNode.sourceFileName || '').trim(),
    min_supported_app_version: defaultNode.minSupportedAppVersion || null,
    max_supported_app_version: defaultNode.maxSupportedAppVersion || null,
    install_plan: buildArtifactInstallPlan(type, detail.projectId, defaultNode, request),
  };
  if (includeRaw) {
    item.nodes = nodes;
    item.edges = Array.isArray(detail.edges) ? detail.edges : [];
  }
  return item.id ? item : null;
}

function buildAgentSearchItem(type: string, entry: Record<string, unknown>, request: Request): Record<string, unknown> | null {
  return isArtifactType(type) ? buildAgentArtifactRankItem(type, entry, request) : buildAgentIssueItem(type, entry, request, false);
}

// ---- Agent items from v1 R2 data ----

async function loadAgentEntriesForType(type: string, env: MarketEnv & Record<string, unknown>): Promise<Record<string, unknown>[]> {
  validateType(type, env);
  const rankPrefix = isArtifactType(type) ? 'artifact-rank' : 'rank';
  const items: Record<string, unknown>[] = [];
  const firstPage = await readV1StaticJson(env, `${rankPrefix}/${type}-updated-page-1.json`);
  if (!firstPage || !Array.isArray(firstPage.items)) return items;
  items.push(...firstPage.items as Record<string, unknown>[]);
  const totalPages = Math.max(1, toInt(firstPage.totalPages));
  const maxPages = Math.min(totalPages, getPositiveInt(env.MARKET_AGENT_MAX_SCAN_PAGES, 20));
  for (let page = 2; page <= maxPages; page += 1) {
    const rankPage = await readV1StaticJson(env, `${rankPrefix}/${type}-updated-page-${page}.json`);
    if (!rankPage || !Array.isArray(rankPage.items) || rankPage.items.length === 0) break;
    items.push(...rankPage.items as Record<string, unknown>[]);
  }
  return items;
}

async function readV1StaticJson(env: MarketEnv & Record<string, unknown>, logicalKey: string): Promise<Record<string, unknown> | null> {
  const bucket = env.MARKET_STATS_BUCKET as { get: (k: string) => Promise<{ text?: () => Promise<string>; body?: string } | null> };
  const obj = await bucket.get(buildStaticObjectKey(logicalKey, env));
  if (!obj) return null;
  const text = typeof obj.text === 'function' ? await obj.text() : String(obj.body || '');
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function handleAgentSearch(request: Request, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  const types = resolveAgentTypes(url.searchParams.get('type'), env);
  const limit = clampNumber(url.searchParams.get('limit'), 1, AGENT_SEARCH_MAX_LIMIT, AGENT_SEARCH_DEFAULT_LIMIT);
  const includeInstallPlan = url.searchParams.get('include_install_plan') === '1';

  const all: Record<string, unknown>[] = [];
  for (const type of types) {
    const entries = await loadAgentEntriesForType(type, env);
    for (const entry of entries) {
      const item = buildAgentSearchItem(type, entry, request);
      if (item) all.push(item);
    }
  }
  const matching = all
    .filter(item => matchesAgentQuery(item, query))
    .sort((a, b) => scoreAgentItem(b, query) - scoreAgentItem(a, query))
    .slice(0, limit)
    .map(item => includeInstallPlan ? item : omitAgentInstallPlan(item));

  return json({ ok: true, query, types, count: matching.length, items: matching }, 200, corsHeaders);
}

async function handleAgentItemRequest(request: Request, pathname: string, env: MarketEnv & Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 4 && parts.length !== 5) return json({ error: 'not_found' }, 404, corsHeaders);
  const type = normalizeAgentType(parts[2] || '');
  const id = decodeURIComponent(parts[3] || '').trim();
  const isInstallPlan = parts.length === 5 && parts[4] === 'install-plan';
  if (!type || !id || (parts.length === 5 && !isInstallPlan)) return json({ error: 'not_found' }, 404, corsHeaders);

  if (isArtifactType(type)) {
    const detail = await readV1StaticJson(env, `artifact-projects/${id}.json`);
    if (!detail) return json({ error: 'not_found', type, id }, 404, corsHeaders);
    const detailType = normalizeAgentType(String(detail.type || ''));
    if (detailType && detailType !== type) return json({ error: 'not_found', type, id }, 404, corsHeaders);
    const item = buildAgentArtifactItem(type, detail, request, true);
    if (!item) return json({ error: 'not_found', type, id }, 404, corsHeaders);
    return json(isInstallPlan ? { ok: true, id: item.id, type: item.type, install_plan: item.install_plan } : { ok: true, item }, 200, corsHeaders);
  }

  const entries = await loadAgentEntriesForType(type, env);
  const entry = entries.find(candidate => String(candidate.id || '') === id);
  if (!entry) return json({ error: 'not_found', type, id }, 404, corsHeaders);
  const item = buildAgentIssueItem(type, entry, request, true);
  if (!item) return json({ error: 'not_found', type, id }, 404, corsHeaders);
  return json(isInstallPlan ? { ok: true, id: item.id, type: item.type, install_plan: item.install_plan } : { ok: true, item }, 200, corsHeaders);
}

// ---- R2 regeneration (cron from v1) ----
// Simplified: reads from GitHub Issues → writes rank/stats JSON to market-stats/ prefix

async function fetchGitHubToken(env: MarketEnv & Record<string, unknown>): Promise<string> {
  if (githubTokenCache.token && githubTokenCache.expiresAt > Date.now()) {
    return githubTokenCache.token;
  }
  const directToken = String(env.GITHUB_TOKEN || env.OPERIT_GITHUB_TOKEN || '').trim();
  if (directToken) {
    githubTokenCache = { token: directToken, expiresAt: Date.now() + 50 * 60 * 1000 };
    return directToken;
  }

  const appId = String(env.GITHUB_APP_ID || env.OPERIT_GITHUB_APP_ID || '').trim();
  const appPem = normalizePem(String(env.GITHUB_APP_PEM || env.GITHUB_PRIVATE_KEY || env.OPERIT_GITHUB_PRIVATE_KEY || ''));
  const installId = String(env.GITHUB_INSTALLATION_ID || env.OPERIT_GITHUB_INSTALLATION_ID || '').trim();
  if (!appId || !appPem || !installId) throw new Error('GitHub token or app credentials are not configured');

  const jwt = await createGitHubAppJwt(appId, appPem);
  const appResp = await fetch(`${GITHUB_API_BASE}/app/installations/${installId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'operit-market-stats',
    },
  });
  const data = await appResp.json().catch(() => null) as { token?: string; expires_at?: string; message?: string } | null;
  if (!appResp.ok || !data?.token) {
    throw new Error(data?.message || appResp.statusText || 'GitHub App token request failed');
  }

  githubTokenCache = {
    token: data.token,
    expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 50 * 60 * 1000,
  };
  return data.token;
}

function base64UrlFromString(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizePem(value: string): string {
  return String(value || '').trim().replace(/\\n/g, '\n');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createGitHubAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 540, iss: appId };
  const signingInput = `${base64UrlFromString(JSON.stringify(header))}.${base64UrlFromString(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function fetchIssues(token: string, owner: string, repo: string, label: string, state: 'open' | 'all' = 'open'): Promise<LegacyIssue[]> {
  const all: LegacyIssue[] = [];
  let page = 1;
  while (true) {
    const query = new URLSearchParams({ state, per_page: String(ISSUE_PAGE_SIZE), page: String(page) });
    if (label) query.set('labels', label);
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?${query.toString()}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'operit-market-stats' },
    });
    if (!resp.ok) break;
    const issues = await resp.json() as LegacyIssue[];
    if (!issues.length) break;
    all.push(...issues.filter(i => !i.pull_request));
    if (issues.length < ISSUE_PAGE_SIZE) break;
    page++;
  }
  return all;
}

function parseHiddenJson(body: string, label: string): Record<string, unknown> | null {
  const jsonLabel = label === 'artifact' ? 'operit-market-json' : `operit-${label}-json`;
  const re = new RegExp(`<!--\\s*${jsonLabel}\\s*:?\\s*([\\s\\S]*?)\\s*-->`, 'im');
  const m = re.exec(body);
  if (!m || !m[1]) return null;
  try {
    return JSON.parse(m[1].trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseArtifactMetadata(body: string): Record<string, unknown> | null {
  return parseHiddenJson(body, 'artifact');
}

function parseSkillMetadata(body: string): Record<string, unknown> | null {
  const metadata = parseHiddenJson(body, 'skill');
  if (!metadata || typeof metadata !== 'object') return null;
  return {
    description: String(metadata.description || ''),
    repositoryUrl: String(metadata.repositoryUrl || metadata.repoUrl || ''),
    category: String(metadata.category || ''),
    tags: String(metadata.tags || ''),
    version: String(metadata.version || ''),
  };
}

function parseMcpMetadata(body: string): Record<string, unknown> | null {
  const metadata = parseHiddenJson(body, 'mcp');
  if (!metadata || typeof metadata !== 'object') return null;
  return {
    description: String(metadata.description || ''),
    repositoryUrl: String(metadata.repositoryUrl || ''),
    installConfig: String(metadata.installConfig || metadata.installCommand || ''),
    category: String(metadata.category || ''),
    tags: String(metadata.tags || ''),
    version: String(metadata.version || ''),
  };
}

function extractRepositoryOwner(repositoryUrl: unknown): string {
  const match = /github\.com\/([^/]+)\/([^/]+)/i.exec(String(repositoryUrl || ''));
  return match ? String(match[1] || '').trim() : '';
}

function canonicalizeMarketSource(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const uri = new URL(value);
    const host = String(uri.hostname || '').replace(/^www\./i, '').trim();
    const path = String(uri.pathname || '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '').trim();
    return [host, path].filter(Boolean).join('/');
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '').trim();
  }
}

function resolveMarketEntryId(preferredSource: unknown, fallback: unknown): string {
  const source = canonicalizeMarketSource(preferredSource) || String(fallback || '').trim();
  return normalizeArtifactId(source);
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

function isLabelOnlyLine(value: string): boolean {
  const normalized = value.replace(/[*_`：:]/g, '').trim().toLowerCase();
  return DESCRIPTION_LABEL_WORDS.has(normalized);
}

function extractHumanDescriptionFromBody(body: string): string {
  const source = String(body || '');
  if (!source.trim()) return '';
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '\n');
  const withoutCodeBlocks = withoutComments.replace(/```[\s\S]*?```/g, '\n');
  const paragraphs: string[] = [];
  let currentParagraph = '';
  const flush = (): void => {
    const paragraph = currentParagraph.trim();
    if (paragraph) paragraphs.push(paragraph);
    currentParagraph = '';
  };
  for (const rawLine of withoutCodeBlocks.split(/\r?\n/)) {
    const trimmedRaw = rawLine.trim();
    if (!trimmedRaw) { flush(); continue; }
    if (isLabelOnlyLine(trimmedRaw)) continue;
    if (trimmedRaw.startsWith('#')) continue;
    if (trimmedRaw.startsWith('|')) continue;
    if (trimmedRaw === '---') continue;
    const trimmed = trimmedRaw
      .replace(/^\*\*[^*]+\*\*\s*[:：]\s*/, '')
      .replace(/^(描述|简介|介绍|说明|description|desc|summary|introduction)\s*[:：]\s*/i, '')
      .trim();
    if (!trimmed) continue;
    currentParagraph += currentParagraph ? ` ${trimmed}` : trimmed;
    if (currentParagraph.length >= 400) { flush(); break; }
  }
  flush();
  const selected = paragraphs.find(paragraph => paragraph.length >= 10) || paragraphs[0] || '';
  return selected.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function sanitizeMcpDescription(raw: string): string {
  const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.slice(0, 500);
}

function simplifyIssue(issue: LegacyIssue): LegacyIssue {
  return {
    id: toInt(issue.id),
    number: toInt(issue.number),
    title: String(issue.title || ''),
    body: issue.body ?? null,
    html_url: String(issue.html_url || ''),
    state: String(issue.state || 'open'),
    labels: Array.isArray(issue.labels) ? issue.labels.map(simplifyLabel) : [],
    user: simplifyUser(issue.user),
    created_at: String(issue.created_at || ''),
    updated_at: String(issue.updated_at || ''),
    reactions: simplifyReactions(issue.reactions),
  };
}

function simplifyLabel(label: LegacyIssueLabel): LegacyIssueLabel {
  return {
    id: toInt(label.id),
    name: String(label.name || ''),
    color: String(label.color || ''),
    description: String(label.description || ''),
  };
}

function simplifyUser(user: LegacyIssueUser | null | undefined): LegacyIssueUser {
  return {
    id: toInt(user?.id),
    login: String(user?.login || ''),
    avatar_url: String(user?.avatar_url || ''),
  };
}

function simplifyReactions(reactions: LegacyIssueReactions | null | undefined): LegacyIssueReactions | null {
  if (!reactions || typeof reactions !== 'object') return null;
  return {
    total_count: toInt(reactions.total_count),
    '+1': toInt(reactions['+1']),
    '-1': toInt(reactions['-1']),
    laugh: toInt(reactions.laugh),
    hooray: toInt(reactions.hooray),
    confused: toInt(reactions.confused),
    heart: toInt(reactions.heart),
    rocket: toInt(reactions.rocket),
    eyes: toInt(reactions.eyes),
  };
}

function getThumbsUpCount(entry: { issue?: LegacyIssue }): number {
  return toInt(entry.issue?.reactions?.['+1']);
}

function sortRankEntries(entries: LegacyEntry[], metric: string): LegacyEntry[] {
  const list = [...entries];
  if (metric === 'featured') {
    return list
      .filter(entry => entry.featured)
      .sort((left, right) =>
        compareStrings(right.updatedAt, left.updatedAt) ||
        left.id.localeCompare(right.id));
  }
  if (metric === 'downloads') {
    return list.sort((left, right) =>
      compareNumbers(right.downloads, left.downloads) ||
      compareNumbers(toInt(right.likes), toInt(left.likes)) ||
      compareStrings(right.updatedAt, left.updatedAt) ||
      left.id.localeCompare(right.id));
  }
  if (metric === 'likes') {
    return list.sort((left, right) =>
      compareNumbers(toInt(right.likes), toInt(left.likes)) ||
      compareStrings(right.updatedAt, left.updatedAt) ||
      left.id.localeCompare(right.id));
  }
  return list.sort((left, right) =>
    compareStrings(right.updatedAt, left.updatedAt) ||
    left.id.localeCompare(right.id));
}

function issueHasLabelName(issue: LegacyIssue, expectedLabelName: string): boolean {
  const normalizedExpected = String(expectedLabelName || '').trim().toLowerCase();
  if (!normalizedExpected) return false;
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  return labels.some(label => {
    const labelName = typeof label === 'string' ? label : label?.name;
    return String(labelName || '').trim().toLowerCase() === normalizedExpected;
  });
}

function resolveArtifactProjectId(metadata: Record<string, unknown>, issue: LegacyIssue, displayName = ''): string {
  const rawProjectId = String(metadata.projectId || '').trim();
  const normalizedProjectId = normalizeArtifactId(rawProjectId);
  if (rawProjectId && normalizedProjectId === 'artifact') {
    const nodeKey = normalizeArtifactNodeKey(metadata.rootNodeId || metadata.nodeId);
    if (nodeKey) return nodeKey;
  }
  return normalizeArtifactId(
    String(metadata.projectId || metadata.normalizedId || metadata.runtimePackageId || displayName || metadata.assetName || issue.title || '')
  );
}

function normalizeArtifactNodeKey(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(normalized) ? normalized : '';
}

function buildLegacyEntry(type: string, issue: LegacyIssue, statsMap: Record<string, LegacyStats>): LegacyEntry | null {
  const summary = summarizeMarketIssue(type, issue);
  if (!summary) return null;
  const stats = statsMap[summary.id] || createEmptyStats();
  return {
    id: summary.id,
    downloads: stats.downloads,
    likes: getThumbsUpCount({ issue }) + stats.likes,
    lastDownloadAt: stats.lastDownloadAt,
    updatedAt: String(issue.updated_at || stats.updatedAt || '') || null,
    statsUpdatedAt: stats.updatedAt || null,
    displayTitle: summary.displayTitle,
    summaryDescription: summary.summaryDescription,
    authorLogin: summary.authorLogin,
    authorAvatarUrl: summary.authorAvatarUrl,
    metadata: summary.metadata,
    issue: simplifyIssue(issue),
    featured: issueHasLabelName(issue, FEATURED_LABEL),
  };
}

function summarizeMarketIssue(type: string, issue: LegacyIssue): {
  id: string;
  displayTitle: string;
  summaryDescription: string;
  authorLogin: string;
  authorAvatarUrl: string;
  metadata: Record<string, unknown> | null;
} | null {
  const body = String(issue.body || '');
  const publisherLogin = String(issue.user?.login || '').trim();
  const publisherAvatarUrl = String(issue.user?.avatar_url || '').trim();

  if (type === 'script' || type === 'package') {
    const metadata = parseArtifactMetadata(body);
    if (!metadata) return null;
    const displayName = String(metadata.displayName || issue.title || '').trim();
    return {
      id: resolveArtifactProjectId(metadata, issue, displayName),
      displayTitle: displayName,
      summaryDescription: String(metadata.description || extractHumanDescriptionFromBody(body)).trim(),
      authorLogin: String(metadata.publisherLogin || publisherLogin).trim(),
      authorAvatarUrl: publisherAvatarUrl,
      metadata,
    };
  }

  if (type === 'skill') {
    const metadata = parseSkillMetadata(body);
    const repositoryUrl = metadata?.repositoryUrl || '';
    const repositoryOwner = extractRepositoryOwner(repositoryUrl);
    return {
      id: resolveMarketEntryId(repositoryUrl, issue.title || ''),
      displayTitle: String(issue.title || '').trim(),
      summaryDescription: String(metadata?.description || extractHumanDescriptionFromBody(body)).trim(),
      authorLogin: repositoryOwner || publisherLogin,
      authorAvatarUrl: publisherAvatarUrl,
      metadata: metadata || null,
    };
  }

  if (type === 'mcp') {
    const metadata = parseMcpMetadata(body);
    const repositoryUrl = metadata?.repositoryUrl || '';
    const repositoryOwner = extractRepositoryOwner(repositoryUrl);
    return {
      id: resolveMarketEntryId(repositoryUrl, issue.title || ''),
      displayTitle: String(issue.title || '').trim(),
      summaryDescription: sanitizeMcpDescription(String(metadata?.description || extractHumanDescriptionFromBody(body))),
      authorLogin: repositoryOwner || publisherLogin,
      authorAvatarUrl: publisherAvatarUrl,
      metadata: metadata || null,
    };
  }

  return {
    id: normalizeArtifactId(issue.title || ''),
    displayTitle: String(issue.title || '').trim(),
    summaryDescription: extractHumanDescriptionFromBody(body),
    authorLogin: publisherLogin,
    authorAvatarUrl: publisherAvatarUrl,
    metadata: null,
  };
}

function createEmptyStats(): LegacyStats {
  return { downloads: 0, likes: 0, lastDownloadAt: null, updatedAt: null };
}

function buildArtifactNode(type: string, issue: LegacyIssue): ArtifactNode | null {
  const body = String(issue.body || '');
  const metadata = parseArtifactMetadata(body);
  if (!metadata || typeof metadata !== 'object') return null;
  const displayName = String(metadata.displayName || issue.title || '').trim();
  const description = String(metadata.description || extractHumanDescriptionFromBody(body)).trim();
  const projectId = resolveArtifactProjectId(metadata, issue, displayName);
  const runtimePackageId = String(metadata.runtimePackageId || metadata.normalizedId || projectId).trim();
  const nodeId = String(metadata.nodeId || `legacy-${toInt(issue.id)}`).trim() || `legacy-${toInt(issue.id)}`;
  const rootNodeId = String(metadata.rootNodeId || nodeId).trim() || nodeId;
  const parentNodeIds = Array.isArray(metadata.parentNodeIds)
    ? metadata.parentNodeIds.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  return {
    projectId,
    type: String(metadata.type || type || '').trim() || type,
    projectDisplayName: String(metadata.projectDisplayName || displayName || issue.title || '').trim(),
    projectDescription: String(metadata.projectDescription || description || '').trim(),
    runtimePackageId,
    nodeId,
    rootNodeId,
    parentNodeIds,
    publisherLogin: String(metadata.publisherLogin || issue.user?.login || '').trim(),
    releaseTag: String(metadata.releaseTag || '').trim(),
    assetName: String(metadata.assetName || '').trim(),
    downloadUrl: String(metadata.downloadUrl || metadata.download_url || '').trim(),
    sha256: String(metadata.sha256 || '').trim(),
    version: String(metadata.version || '').trim(),
    displayName,
    description,
    sourceFileName: String(metadata.sourceFileName || '').trim(),
    minSupportedAppVersion: normalizeOptionalString(metadata.minSupportedAppVersion),
    maxSupportedAppVersion: normalizeOptionalString(metadata.maxSupportedAppVersion),
    publishedAt: normalizeOptionalTimestamp(issue.created_at),
    state: String(issue.state || 'open').trim() || 'open',
    featured: issueHasLabelName(issue, FEATURED_LABEL),
    issue: simplifyIssue(issue),
  };
}

function pickLatestArtifactNode(nodes: ArtifactNode[]): ArtifactNode | null {
  if (nodes.length === 0) return null;
  return [...nodes].sort((left, right) =>
    compareStrings(right.publishedAt, left.publishedAt) ||
    compareStrings(right.issue.created_at, left.issue.created_at) ||
    left.nodeId.localeCompare(right.nodeId))[0] || null;
}

function buildArtifactProjectRankDefaultNode(node: ArtifactNode | null): Record<string, unknown> | null {
  if (!node) return null;
  return {
    nodeId: node.nodeId,
    runtimePackageId: node.runtimePackageId,
    sha256: node.sha256,
    version: node.version,
    downloadUrl: node.downloadUrl,
    state: node.state,
    publishedAt: node.publishedAt,
  };
}

function summarizeArtifactProject(type: string, nodes: ArtifactNode[], stats: LegacyStats): ArtifactSummary {
  const normalizedNodes = [...nodes].sort((left, right) =>
    compareStrings(left.publishedAt, right.publishedAt) || left.nodeId.localeCompare(right.nodeId));
  const nodeIds = new Set(normalizedNodes.map(node => node.nodeId));
  const rootNode = normalizedNodes.find(node => node.nodeId === node.rootNodeId) || normalizedNodes[0] || null;
  const latestNode = pickLatestArtifactNode(normalizedNodes);
  const latestOpenNode = pickLatestArtifactNode(normalizedNodes.filter(node => node.state === 'open'));
  const defaultNode = latestOpenNode || latestNode;
  const contributorCount = new Set(normalizedNodes.map(node => node.publisherLogin || node.issue.user?.login || '').filter(Boolean)).size || 1;
  const likes = normalizedNodes.reduce((sum, node) => sum + toInt(node.issue.reactions?.['+1']), 0) + stats.likes;
  const featured = normalizedNodes.some(node => node.state === 'open' && node.featured);
  const defaultRuntimePackageId = String(defaultNode?.runtimePackageId || '').trim();
  const runtimePackageNodeSha256s = defaultRuntimePackageId
    ? normalizedNodes
      .filter(node => normalizeArtifactId(node.runtimePackageId) === normalizeArtifactId(defaultRuntimePackageId))
      .map(node => String(node.sha256 || '').trim())
      .filter(Boolean)
      .filter((sha256, index, list) => list.indexOf(sha256) === index)
    : [];
  const edges: { parentNodeId: string; childNodeId: string }[] = [];
  for (const node of normalizedNodes) {
    for (const parentNodeId of node.parentNodeIds) {
      if (nodeIds.has(parentNodeId)) edges.push({ parentNodeId, childNodeId: node.nodeId });
    }
  }
  return {
    projectId: nodes[0]?.projectId || '',
    type,
    projectDisplayName: rootNode?.projectDisplayName || latestNode?.projectDisplayName || '',
    projectDescription: rootNode?.projectDescription || latestNode?.projectDescription || '',
    rootNodeId: rootNode?.rootNodeId || rootNode?.nodeId || '',
    rootPublisherLogin: rootNode?.publisherLogin || rootNode?.issue.user?.login || '',
    rootPublisherAvatarUrl: rootNode?.issue.user?.avatar_url || '',
    contributorCount,
    downloads: stats.downloads,
    likes,
    featured,
    latestNodeId: latestNode?.nodeId || '',
    latestOpenNodeId: latestOpenNode?.nodeId || '',
    defaultNodeId: defaultNode?.nodeId || '',
    latestPublishedAt: latestOpenNode?.publishedAt || latestNode?.publishedAt || null,
    defaultNode: buildArtifactProjectRankDefaultNode(defaultNode),
    runtimePackageNodeSha256s,
    nodes: normalizedNodes,
    edges,
  };
}

function buildArtifactProjectRankEntry(summary: ArtifactSummary): Record<string, unknown> {
  return {
    projectId: summary.projectId,
    type: summary.type,
    projectDisplayName: summary.projectDisplayName,
    projectDescription: summary.projectDescription,
    rootPublisherLogin: summary.rootPublisherLogin,
    rootPublisherAvatarUrl: summary.rootPublisherAvatarUrl,
    contributorCount: summary.contributorCount,
    downloads: summary.downloads,
    likes: summary.likes,
    featured: summary.featured,
    latestNodeId: summary.latestNodeId,
    latestOpenNodeId: summary.latestOpenNodeId,
    defaultNodeId: summary.defaultNodeId,
    latestPublishedAt: summary.latestPublishedAt,
    defaultNode: summary.defaultNode,
    runtimePackageNodeSha256s: summary.runtimePackageNodeSha256s,
  };
}

function buildArtifactProjectDetail(summary: ArtifactSummary): Record<string, unknown> {
  return {
    projectId: summary.projectId,
    type: summary.type,
    projectDisplayName: summary.projectDisplayName,
    projectDescription: summary.projectDescription,
    rootNodeId: summary.rootNodeId,
    rootPublisherLogin: summary.rootPublisherLogin,
    rootPublisherAvatarUrl: summary.rootPublisherAvatarUrl,
    contributorCount: summary.contributorCount,
    downloads: summary.downloads,
    likes: summary.likes,
    featured: summary.featured,
    latestNodeId: summary.latestNodeId,
    latestOpenNodeId: summary.latestOpenNodeId,
    defaultNodeId: summary.defaultNodeId,
    latestPublishedAt: summary.latestPublishedAt,
    nodes: summary.nodes,
    edges: summary.edges,
  };
}

function sortArtifactProjectRankEntries(entries: Record<string, unknown>[], metric: string): Record<string, unknown>[] {
  const list = [...entries];
  if (metric === 'featured') {
    return list
      .filter(entry => Boolean(entry.featured))
      .sort((left, right) =>
        compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
        String(left.projectId || '').localeCompare(String(right.projectId || '')));
  }
  if (metric === 'downloads') {
    return list.sort((left, right) =>
      compareNumbers(toInt(right.downloads), toInt(left.downloads)) ||
      compareNumbers(toInt(right.likes), toInt(left.likes)) ||
      compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
      String(left.projectId || '').localeCompare(String(right.projectId || '')));
  }
  if (metric === 'likes') {
    return list.sort((left, right) =>
      compareNumbers(toInt(right.likes), toInt(left.likes)) ||
      compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
      String(left.projectId || '').localeCompare(String(right.projectId || '')));
  }
  return list.sort((left, right) =>
    compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
    String(left.projectId || '').localeCompare(String(right.projectId || '')));
}

function latestTimestamp(a: string | null, b: string | null): string | null {
  const leftTime = toTimestampMillis(a);
  const rightTime = toTimestampMillis(b);
  if (leftTime === null) return b || null;
  if (rightTime === null) return a || null;
  return leftTime >= rightTime ? a : b;
}

function toTimestampMillis(value: unknown): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toWeightedCount(value: unknown, sampleInterval: unknown): number {
  const numericValue = Number(String(value || '0'));
  const numericSampleInterval = Number(String(sampleInterval || '1'));
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericSampleInterval)) return 0;
  return Math.max(0, Math.round(numericValue * numericSampleInterval));
}

function normalizeAnalyticsEvent(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  return ANALYTICS_SUPPORTED_EVENTS.includes(normalized) ? normalized : '';
}

function getAnalyticsDatasetName(env: MarketEnv & Record<string, unknown>): string {
  const dataset = String(env.MARKET_ANALYTICS_DATASET || 'operit_market_stats').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dataset)) throw new Error('MARKET_ANALYTICS_DATASET must be a valid SQL table name');
  return dataset;
}

function requireAnalyticsQueryConfig(env: MarketEnv & Record<string, unknown>): { accountId: string; apiToken: string; dataset: string } {
  const accountId = String(env.MARKET_ANALYTICS_ACCOUNT_ID || '').trim();
  const apiToken = String(env.MARKET_ANALYTICS_API_TOKEN || env.CLOUDFLARE_API_TOKEN || '').trim();
  const dataset = getAnalyticsDatasetName(env);
  if (!accountId) throw new Error('MARKET_ANALYTICS_ACCOUNT_ID is not configured');
  if (!apiToken) throw new Error('MARKET_ANALYTICS_API_TOKEN is not configured');
  return { accountId, apiToken, dataset };
}

async function queryAnalyticsRows(env: MarketEnv & Record<string, unknown>, query: string): Promise<Record<string, unknown>[]> {
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

async function loadStatsByType(env: MarketEnv & Record<string, unknown>, supportedTypes: string[]): Promise<Record<string, Record<string, LegacyStats>>> {
  const byType: Record<string, Record<string, LegacyStats>> = Object.fromEntries(supportedTypes.map(type => [type, {}]));
  const dataset = getAnalyticsDatasetName(env);
  const rows = await queryAnalyticsRows(env, `
    SELECT
      blob1,
      blob2,
      blob3,
      double1,
      _sample_interval,
      timestamp
    FROM ${dataset}
    WHERE blob1 IN (${supportedTypes.map(quoteSqlString).join(', ')})
      AND blob3 IN (${ANALYTICS_SUPPORTED_EVENTS.map(quoteSqlString).join(', ')})
    ORDER BY timestamp ASC
  `);
  for (const row of rows) {
    const type = normalizeType(String(row.blob1 || ''));
    const rawId = String(row.blob2 || '').trim();
    const event = normalizeAnalyticsEvent(row.blob3);
    if (!supportedTypes.includes(type) || !rawId || !event || rawId === 'bootstrap-analytics') continue;
    const id = normalizeArtifactId(rawId);
    const stats = byType[type]?.[id] || createEmptyStats();
    const total = toWeightedCount(row.double1, row._sample_interval);
    const lastAt = normalizeOptionalTimestamp(row.timestamp);
    if (event === ANALYTICS_DOWNLOAD_EVENT) {
      stats.downloads += total;
      stats.lastDownloadAt = latestTimestamp(stats.lastDownloadAt, lastAt);
    }
    if (event === ANALYTICS_LIKE_EVENT) stats.likes += total;
    stats.updatedAt = stats.lastDownloadAt;
    if (!byType[type]) byType[type] = {};
    byType[type][id] = stats;
  }
  return byType;
}

// ---- Regeneration ----

async function regenerateStaticJson(env: MarketEnv & Record<string, unknown>): Promise<void> {
  const token = await fetchGitHubToken(env);
  const supportedTypes = getSupportedTypes(env);
  const pageSize = getPositiveInt(env.MARKET_RANK_PAGE_SIZE, 20);
  const maxPages = getNonNegativeInt(env.MARKET_RANK_MAX_PAGES, 0);
  const updatedAt = new Date().toISOString();
  const artifactTypes = supportedTypes.filter(isArtifactType);
  const issueRankTypes = supportedTypes.filter(type => !isArtifactType(type));

  const statsByType = await loadStatsByType(env, supportedTypes);
  const issuesByType: Record<string, LegacyIssue[]> = {};
  const rankEntriesByType: Record<string, LegacyEntry[]> = {};
  const artifactProjectsByType: Record<string, { rankEntries: Record<string, unknown>[]; detailEntries: Record<string, Record<string, unknown>> }> = {};
  for (const type of supportedTypes) {
    issuesByType[type] = [];
    rankEntriesByType[type] = [];
  }

  for (const type of supportedTypes) {
    const cfg = MARKET_SOURCE_CONFIG[type];
    if (!cfg) continue;
    const issues = await fetchIssues(token, cfg.owner, cfg.repo, cfg.label, 'open');
    issuesByType[type] = issues;
    for (const issue of issues) {
      const entry = buildLegacyEntry(type, issue, statsByType[type] || {});
      if (entry) rankEntriesByType[type]?.push(entry);
    }
  }

  for (const type of artifactTypes) {
    const cfg = MARKET_SOURCE_CONFIG[type];
    if (!cfg) continue;
    const artifactIssues = await fetchIssues(token, cfg.owner, cfg.repo, cfg.label, 'all');
    const grouped = new Map<string, ArtifactNode[]>();
    for (const issue of artifactIssues) {
      const node = buildArtifactNode(type, issue);
      if (!node) continue;
      const group = grouped.get(node.projectId) || [];
      group.push(node);
      grouped.set(node.projectId, group);
    }
    const rankEntries: Record<string, unknown>[] = [];
    const detailEntries: Record<string, Record<string, unknown>> = {};
    for (const [projectId, nodes] of grouped) {
      const stats = statsByType[type]?.[normalizeArtifactId(projectId)] || createEmptyStats();
      const summary = summarizeArtifactProject(type, nodes, stats);
      detailEntries[projectId] = buildArtifactProjectDetail(summary);
      if (summary.latestOpenNodeId) rankEntries.push(buildArtifactProjectRankEntry(summary));
    }
    artifactProjectsByType[type] = { rankEntries, detailEntries };
  }

  const writes: Promise<unknown>[] = [];
  const manifest = {
    updatedAt,
    pageSize,
    maxPages,
    supportedTypes,
    supportedRankMetrics: SUPPORTED_RANK_METRICS,
    keys: ['stats.json', 'manifest.json'],
  };

  writes.push(putStaticJson(env, 'stats.json', { updatedAt, items: statsByType }));

  for (const type of supportedTypes) {
    const sk = `stats/${type}.json`;
    writes.push(putStaticJson(env, sk, { updatedAt, items: statsByType[type] }));
    manifest.keys.push(sk);
  }

  for (const type of issueRankTypes) {
    const entries = rankEntriesByType[type] || [];
    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = sortRankEntries(entries, metric);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;
      for (let page = 1; page <= pageCount; page++) {
        const start = (page - 1) * pageSize;
        const slice = sorted.slice(start, start + pageSize);
        const key = `rank/${type}-${metric}-page-${page}.json`;
        writes.push(putStaticJson(env, key, { updatedAt, type, metric, page, pageSize, totalPages, totalItems: sorted.length, items: slice }));
        manifest.keys.push(key);
      }
    }
  }

  for (const type of artifactTypes) {
    const artifactProjects = artifactProjectsByType[type] || { rankEntries: [], detailEntries: {} };
    const legacyEntries = rankEntriesByType[type] || [];

    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = sortArtifactProjectRankEntries(artifactProjects.rankEntries, metric);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;
      for (let page = 1; page <= pageCount; page++) {
        const start = (page - 1) * pageSize;
        const slice = sorted.slice(start, start + pageSize);
        const key = `artifact-rank/${type}-${metric}-page-${page}.json`;
        writes.push(putStaticJson(env, key, { updatedAt, type, metric, page, pageSize, totalPages, totalItems: sorted.length, items: slice }));
        manifest.keys.push(key);
      }

      const legacySorted = sortRankEntries(legacyEntries, metric);
      const legacyTotalPages = Math.max(1, Math.ceil(legacySorted.length / pageSize));
      const legacyPageCount = maxPages > 0 ? Math.min(legacyTotalPages, maxPages) : legacyTotalPages;
      for (let page = 1; page <= legacyPageCount; page++) {
        const start = (page - 1) * pageSize;
        const slice = legacySorted.slice(start, start + pageSize);
        const legacyKey = `rank/${type}-${metric}-page-${page}.json`;
        writes.push(putStaticJson(env, legacyKey, { updatedAt, type, metric, page, pageSize, totalPages: legacyTotalPages, totalItems: legacySorted.length, items: slice }));
        manifest.keys.push(legacyKey);
      }
    }

    for (const [projectId, detail] of Object.entries(artifactProjects.detailEntries)) {
      const key = `artifact-projects/${projectId}.json`;
      writes.push(putStaticJson(env, key, detail));
      manifest.keys.push(key);
    }
  }

  writes.push(putStaticJson(env, 'manifest.json', manifest));
  await Promise.all(writes);
  await deleteStaleStaticObjects(env, manifest.keys);
}

async function deleteStaleStaticObjects(env: MarketEnv & Record<string, unknown>, activeLogicalKeys: string[]): Promise<void> {
  const prefix = getStaticObjectPrefix(env);
  if (!prefix) return;
  const bucket = env.MARKET_STATS_BUCKET;
  if (!bucket?.list || !bucket.delete) return;
  const activeObjectKeys = new Set(activeLogicalKeys.map(logicalKey => buildStaticObjectKey(logicalKey, env)));
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix: `${prefix}/`, cursor } as unknown as { prefix: string });
    const listResult = listed as unknown as { objects?: { key: string }[]; truncated?: boolean; cursor?: string };
    const staleKeys = (listResult.objects || []).map(entry => entry.key).filter(objectKey => !activeObjectKeys.has(objectKey));
    if (staleKeys.length > 0) await Promise.all(staleKeys.map(objectKey => bucket.delete?.(objectKey)));
    cursor = listResult.truncated ? listResult.cursor : undefined;
  } while (cursor);
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

      if (pathname === '/like') {
        return handleLike(request, env as MarketEnv & Record<string, unknown>, corsHeaders);
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
        '/health', '/download', '/like', '/stats.json', '/stats/<type>.json',
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
