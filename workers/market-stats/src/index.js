const SUPPORTED_RANK_METRICS = ['downloads', 'likes', 'updated', 'featured'];
const FEATURED_LABEL = 'market:featured';
const DEFAULT_ALLOWED_DOWNLOAD_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com',
];
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const GITHUB_API_BASE = 'https://api.github.com';
const ISSUE_PAGE_SIZE = 100;
const AGENT_SEARCH_DEFAULT_LIMIT = 10;
const AGENT_SEARCH_MAX_LIMIT = 50;
const ANALYTICS_DOWNLOAD_EVENT = 'download';
const ANALYTICS_SUPPORTED_EVENTS = [ANALYTICS_DOWNLOAD_EVENT];
const ARTIFACT_TYPES = ['script', 'package'];
const DESCRIPTION_LABEL_WORDS = new Set([
  'description',
  'desc',
  'summary',
  'introduction',
  '简介',
  '描述',
  '介绍',
  '说明',
]);
const MARKET_SOURCE_CONFIG = {
  script: {
    owner: 'AAswordman',
    repo: 'OperitScriptMarket',
    label: 'script-artifact',
    parser: 'artifact',
  },
  package: {
    owner: 'AAswordman',
    repo: 'OperitPackageMarket',
    label: 'package-artifact',
    parser: 'artifact',
  },
  skill: {
    owner: 'AAswordman',
    repo: 'OperitSkillMarket',
    label: 'skill-plugin',
    parser: 'skill',
  },
  mcp: {
    owner: 'AAswordman',
    repo: 'OperitMCPMarket',
    label: 'mcp-plugin',
    parser: 'mcp',
  },
};

let githubTokenCache = {
  token: '',
  expiresAt: 0,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = getRequestPath(url.pathname, env);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (pathname === null) {
        return json(
          {
            error: 'not_found',
            route_prefix: normalizeRoutePrefix(env.MARKET_ROUTE_PREFIX),
          },
          404,
          corsHeaders
        );
      }

      if (pathname === '/health') {
        return json({ ok: true }, 200, corsHeaders);
      }

      if (pathname === '/download') {
        return await handleDownload(request, env, corsHeaders);
      }

      if (pathname === '/agent/search') {
        return await handleAgentSearch(request, env, corsHeaders);
      }

      if (pathname.startsWith('/agent/items/')) {
        return await handleAgentItemRequest(request, pathname, env, corsHeaders);
      }

      if (isStaticJsonPath(pathname)) {
        return await handleStaticJson(pathname, env, corsHeaders);
      }

      return json(
        {
          error: 'not_found',
          supported_routes: [
            '/health',
            '/download',
            '/stats.json',
            '/stats/<type>.json',
            '/rank/<type>-<metric>-page-<n>.json',
            '/artifact-rank/<type>-<metric>-page-<n>.json',
            '/artifact-projects/<projectId>.json',
            '/agent/search',
            '/agent/items/<type>/<id>',
            '/agent/items/<type>/<id>/install-plan',
            '/manifest.json',
          ],
        },
        404,
        corsHeaders
      );
    } catch (error) {
      return json(
        {
          error: 'internal_error',
          message: error instanceof Error ? error.message : String(error),
        },
        500,
        corsHeaders
      );
    }
  },

  async scheduled(_controller, env, _ctx) {
    await regenerateStaticJson(env);
  },
};

async function handleDownload(request, env, corsHeaders) {
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

async function handleStaticJson(pathname, env, corsHeaders) {
  requireStatsBucket(env);

  const key = pathname.replace(/^\//, '');
  let object = await env.MARKET_STATS_BUCKET.get(buildStaticObjectKey(key, env));

  if (!object && canRegenerateStaticJson(env)) {
    await regenerateStaticJson(env);
    object = await env.MARKET_STATS_BUCKET.get(buildStaticObjectKey(key, env));
  }

  if (!object) {
    return json({ error: 'not_found', key }, 404, corsHeaders);
  }

  const headers = {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': getStaticJsonCacheControl(env),
  };

  if (object.httpEtag) {
    headers.etag = object.httpEtag;
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

function isStaticJsonPath(pathname) {
  return pathname === '/stats.json' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/stats/') ||
    pathname.startsWith('/rank/') ||
    pathname.startsWith('/artifact-rank/') ||
    pathname.startsWith('/artifact-projects/');
}

async function handleAgentSearch(request, env, corsHeaders) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  const types = resolveAgentTypes(url.searchParams.get('type') || url.searchParams.get('types'), env);
  const limit = clampNumber(
    url.searchParams.get('limit'),
    1,
    AGENT_SEARCH_MAX_LIMIT,
    AGENT_SEARCH_DEFAULT_LIMIT
  );
  const includeInstallPlan = parseBooleanParam(url.searchParams.get('include_install_plan'));
  const items = [];

  for (const type of types) {
    const entries = await loadAgentEntriesForType(type, env);
    for (const entry of entries) {
      const item = buildAgentSearchItem(type, entry, request);
      if (!item || !matchesAgentQuery(item, query)) {
        continue;
      }
      items.push({
        score: scoreAgentItem(item, query),
        item: includeInstallPlan ? item : omitAgentInstallPlan(item),
      });
    }
  }

  items.sort((left, right) =>
    compareNumbers(right.score, left.score) ||
    compareNumbers(right.item.downloads, left.item.downloads) ||
    compareStrings(right.item.updated_at, left.item.updated_at) ||
    left.item.id.localeCompare(right.item.id)
  );

  return json(
    {
      ok: true,
      query,
      types,
      limit,
      items: items.slice(0, limit).map((entry) => entry.item),
    },
    200,
    corsHeaders
  );
}

async function handleAgentItemRequest(request, pathname, env, corsHeaders) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 4 && parts.length !== 5) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  const type = normalizeAgentType(parts[2]);
  const id = decodeURIComponent(parts[3] || '').trim();
  const wantsInstallPlan = parts.length === 5 && parts[4] === 'install-plan';
  if (!type || !id || (parts.length === 5 && !wantsInstallPlan)) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  const item = await loadAgentItem(type, id, env, request);
  if (!item) {
    return json({ error: 'not_found', type, id }, 404, corsHeaders);
  }

  return json(
    wantsInstallPlan
      ? { ok: true, id: item.id, type: item.type, install_plan: item.install_plan }
      : { ok: true, item },
    200,
    corsHeaders
  );
}

async function loadAgentItem(type, id, env, request) {
  if (isArtifactType(type)) {
    const detail = await readStaticJson(env, `artifact-projects/${id}.json`);
    if (!detail) {
      return null;
    }
    const detailType = normalizeAgentType(detail?.type);
    if (detailType && detailType !== type) {
      return null;
    }
    return buildAgentArtifactItem(type, detail, request, true);
  }

  const entries = await loadAgentEntriesForType(type, env);
  const entry = entries.find((candidate) => String(candidate?.id || '') === id);
  return entry ? buildAgentIssueItem(type, entry, request, true) : null;
}

async function loadAgentEntriesForType(type, env) {
  validateType(type, env);

  const rankPrefix = isArtifactType(type) ? 'artifact-rank' : 'rank';
  const entries = [];
  const firstPage = await readStaticJson(env, `${rankPrefix}/${type}-updated-page-1.json`);
  if (!firstPage || !Array.isArray(firstPage.items)) {
    return entries;
  }

  entries.push(...firstPage.items);

  const totalPages = Math.max(1, toInt(firstPage.totalPages));
  const maxPages = Math.min(totalPages, getPositiveInt(env.MARKET_AGENT_MAX_SCAN_PAGES, 20));
  for (let page = 2; page <= maxPages; page += 1) {
    const rankPage = await readStaticJson(env, `${rankPrefix}/${type}-updated-page-${page}.json`);
    if (!rankPage || !Array.isArray(rankPage.items) || rankPage.items.length === 0) {
      break;
    }
    entries.push(...rankPage.items);
  }

  return entries;
}

async function readStaticJson(env, logicalKey) {
  requireStatsBucket(env);

  const object = await env.MARKET_STATS_BUCKET.get(buildStaticObjectKey(logicalKey, env));
  if (!object) {
    return null;
  }

  try {
    const text = await object.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function buildAgentSearchItem(type, entry, request) {
  if (isArtifactType(type)) {
    return buildAgentArtifactRankItem(type, entry, request);
  }
  return buildAgentIssueItem(type, entry, request, false);
}

function buildAgentIssueItem(type, entry, request, includeRaw = false) {
  const metadata = entry?.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
  const tags = normalizeTagList(metadata.tags);
  const item = {
    id: String(entry?.id || ''),
    type,
    name: String(entry?.displayTitle || entry?.issue?.title || '').trim(),
    description: String(entry?.summaryDescription || metadata.description || '').trim(),
    author: String(entry?.authorLogin || '').trim(),
    author_avatar_url: String(entry?.authorAvatarUrl || '').trim(),
    version: String(metadata.version || '').trim(),
    category: String(metadata.category || '').trim(),
    tags,
    downloads: toInt(entry?.downloads),
    likes: getThumbsUpCount(entry),
    updated_at: entry?.updatedAt || null,
    issue_url: String(entry?.issue?.html_url || '').trim(),
    repository_url: String(metadata.repositoryUrl || '').trim(),
    install_plan: buildIssueInstallPlan(type, entry, request),
  };

  if (includeRaw) {
    item.metadata = metadata;
    item.issue = entry?.issue || null;
  }

  return item.id ? item : null;
}

function buildAgentArtifactRankItem(type, entry, request) {
  const node = entry?.defaultNode || {};
  const item = {
    id: String(entry?.projectId || ''),
    type,
    name: String(entry?.projectDisplayName || '').trim(),
    description: String(entry?.projectDescription || '').trim(),
    author: String(entry?.rootPublisherLogin || '').trim(),
    author_avatar_url: String(entry?.rootPublisherAvatarUrl || '').trim(),
    version: String(node.version || '').trim(),
    category: '',
    tags: [],
    downloads: toInt(entry?.downloads),
    likes: toInt(entry?.likes),
    updated_at: entry?.latestPublishedAt || null,
    runtime_package_id: String(node.runtimePackageId || '').trim(),
    sha256: String(node.sha256 || '').trim(),
    download_url: String(node.downloadUrl || '').trim(),
    install_plan: buildArtifactInstallPlan(type, entry.projectId, node, request),
  };

  return item.id ? item : null;
}

function buildAgentArtifactItem(type, detail, request, includeRaw = false) {
  const defaultNode =
    (Array.isArray(detail?.nodes)
      ? detail.nodes.find((node) => node.nodeId === detail.defaultNodeId) || detail.nodes[0]
      : null) || {};
  const item = {
    id: String(detail?.projectId || '').trim(),
    type: normalizeAgentType(detail?.type) || type,
    name: String(detail?.projectDisplayName || defaultNode.displayName || '').trim(),
    description: String(detail?.projectDescription || defaultNode.description || '').trim(),
    author: String(detail?.rootPublisherLogin || defaultNode.publisherLogin || '').trim(),
    author_avatar_url: String(detail?.rootPublisherAvatarUrl || '').trim(),
    version: String(defaultNode.version || '').trim(),
    category: '',
    tags: [],
    downloads: toInt(detail?.downloads),
    likes: toInt(detail?.likes),
    updated_at: detail?.latestPublishedAt || defaultNode.publishedAt || null,
    runtime_package_id: String(defaultNode.runtimePackageId || '').trim(),
    sha256: String(defaultNode.sha256 || '').trim(),
    download_url: String(defaultNode.downloadUrl || '').trim(),
    source_file_name: String(defaultNode.sourceFileName || '').trim(),
    min_supported_app_version: defaultNode.minSupportedAppVersion || null,
    max_supported_app_version: defaultNode.maxSupportedAppVersion || null,
    install_plan: buildArtifactInstallPlan(type, detail?.projectId, defaultNode, request),
  };

  if (includeRaw) {
    item.nodes = Array.isArray(detail?.nodes) ? detail.nodes : [];
    item.edges = Array.isArray(detail?.edges) ? detail.edges : [];
  }

  return item.id ? item : null;
}

function buildIssueInstallPlan(type, entry, request) {
  const metadata = entry?.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
  const repositoryUrl = String(metadata.repositoryUrl || '').trim();

  if (type === 'skill') {
    return {
      method: 'skill_repo',
      repository_url: repositoryUrl,
      tool_hint: 'install_skill_from_repo_url',
      args: {
        repository_url: repositoryUrl,
      },
    };
  }

  const installConfigText = stripJsonCodeFence(String(metadata.installConfig || '').trim());
  const parsedConfig = parseJsonObjectOrNull(installConfigText);
  if (parsedConfig) {
    return {
      method: 'mcp_config',
      config: parsedConfig,
      config_text: installConfigText,
      tool_hint: 'install_mcp_from_config',
      args: {
        config: parsedConfig,
      },
    };
  }

  return {
    method: 'mcp_repo',
    repository_url: repositoryUrl,
    config_text: installConfigText,
    tool_hint: 'install_mcp_from_repo_url',
    args: {
      repository_url: repositoryUrl,
    },
  };
}

function buildArtifactInstallPlan(type, projectId, node, request) {
  const downloadUrl = String(node?.downloadUrl || '').trim();
  const sha256 = String(node?.sha256 || '').trim();
  const runtimePackageId = String(node?.runtimePackageId || projectId || '').trim();
  const trackedDownloadUrl = buildTrackedDownloadUrl(type, projectId, downloadUrl, request);

  return {
    method: 'artifact_download',
    artifact_type: type,
    runtime_package_id: runtimePackageId,
    download_url: downloadUrl,
    tracked_download_url: trackedDownloadUrl,
    sha256,
    tool_hint: type === 'package' ? 'install_package_from_url' : 'install_script_from_url',
    args: {
      url: trackedDownloadUrl || downloadUrl,
      sha256,
      runtime_package_id: runtimePackageId,
    },
  };
}

function buildTrackedDownloadUrl(type, projectId, target, request) {
  if (!target || !projectId) {
    return '';
  }

  const url = new URL(request.url);
  url.pathname = `${normalizeRoutePrefixForUrl(url.pathname)}/download`.replace(/\/{2,}/g, '/');
  url.search = '';
  url.searchParams.set('type', type);
  url.searchParams.set('id', normalizeArtifactId(projectId));
  url.searchParams.set('target', target);
  return url.toString();
}

function normalizeRoutePrefixForUrl(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const agentIndex = parts.indexOf('agent');
  if (agentIndex <= 0) {
    return '';
  }
  return `/${parts.slice(0, agentIndex).join('/')}`;
}

function omitAgentInstallPlan(item) {
  const { install_plan: _installPlan, ...rest } = item;
  return rest;
}

function matchesAgentQuery(item, query) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeSearchText(query);
  const haystack = normalizeSearchText([
    item.id,
    item.type,
    item.name,
    item.description,
    item.author,
    item.version,
    item.category,
    item.repository_url,
    item.runtime_package_id,
    item.source_file_name,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ].join('\n'));

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

function scoreAgentItem(item, query) {
  if (!query) {
    return 0;
  }

  const normalizedQuery = normalizeSearchText(query);
  const name = normalizeSearchText(item.name);
  const id = normalizeSearchText(item.id);
  const tags = normalizeSearchText((item.tags || []).join(' '));
  const description = normalizeSearchText(item.description);

  let score = 0;
  if (name === normalizedQuery || id === normalizedQuery) score += 100;
  if (name.includes(normalizedQuery)) score += 40;
  if (id.includes(normalizedQuery)) score += 30;
  if (tags.includes(normalizedQuery)) score += 20;
  if (description.includes(normalizedQuery)) score += 10;
  return score;
}

function resolveAgentTypes(raw, env) {
  const supportedTypes = new Set(getSupportedTypes(env));
  const requested = splitCsv(raw)
    .flatMap((type) => {
      const normalized = normalizeAgentType(type);
      return normalized === 'artifact' ? ['script', 'package'] : [normalized];
    })
    .filter((type) => type && supportedTypes.has(type));

  const defaults = ['mcp', 'skill', 'package', 'script'].filter((type) => supportedTypes.has(type));
  return [...new Set(requested.length > 0 ? requested : defaults)];
}

function normalizeAgentType(value) {
  const type = normalizeType(value);
  if (type === 'mcp' || type === 'skill' || type === 'script' || type === 'package' || type === 'artifact') {
    return type;
  }
  return '';
}

function normalizeTagList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20);
  }
  return String(value || '')
    .replace(/[;|]/g, ',')
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function stripJsonCodeFence(value) {
  const trimmed = String(value || '').trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseJsonObjectOrNull(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseBooleanParam(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function getRequestPath(pathname, env) {
  const prefix = normalizeRoutePrefix(env.MARKET_ROUTE_PREFIX);
  if (!prefix) {
    return pathname;
  }

  if (pathname === prefix) {
    return '/';
  }

  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length) || '/';
  }

  return null;
}

function normalizeRoutePrefix(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') {
    return '';
  }

  return `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

async function regenerateStaticJson(env) {
  requireStatsBucket(env);
  requireAnalyticsQueryConfig(env);

  const supportedTypes = getSupportedTypes(env);
  const pageSize = getPositiveInt(env.MARKET_RANK_PAGE_SIZE, 20);
  const maxPages = getNonNegativeInt(env.MARKET_RANK_MAX_PAGES, 0);
  const updatedAt = new Date().toISOString();
  const artifactTypes = supportedTypes.filter(isArtifactType);
  const issueRankTypes = supportedTypes.filter((type) => !isArtifactType(type));

  const statsByType = await loadStatsByType(env, supportedTypes);
  const rankEntriesByType = await loadRankEntriesByType(env, supportedTypes, statsByType);
  const artifactProjectsByType = await loadArtifactProjectsByType(env, artifactTypes, statsByType);

  const writes = [];
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
    const statsKey = `stats/${type}.json`;
    writes.push(putStaticJson(env, statsKey, { updatedAt, items: statsByType[type] }));
    manifest.keys.push(statsKey);
  }

  for (const type of issueRankTypes) {
    const entries = rankEntriesByType[type] || [];

    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = sortRankEntries(entries, metric);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;

      for (let page = 1; page <= pageCount; page += 1) {
        const start = (page - 1) * pageSize;
        const slice = sorted.slice(start, start + pageSize);
        const key = `rank/${type}-${metric}-page-${page}.json`;

        writes.push(
          putStaticJson(env, key, {
            updatedAt,
            type,
            metric,
            page,
            pageSize,
            totalPages,
            totalItems: sorted.length,
            items: slice,
          })
        );
        manifest.keys.push(key);
      }
    }
  }

  for (const type of artifactTypes) {
    const artifactProjects = artifactProjectsByType[type] || {
      rankEntries: [],
      detailEntries: {},
    };
    const legacyEntries = rankEntriesByType[type] || [];

    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = sortArtifactProjectRankEntries(artifactProjects.rankEntries, metric);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;

      for (let page = 1; page <= pageCount; page += 1) {
        const start = (page - 1) * pageSize;
        const slice = sorted.slice(start, start + pageSize);
        const key = `artifact-rank/${type}-${metric}-page-${page}.json`;

        writes.push(
          putStaticJson(env, key, {
            updatedAt,
            type,
            metric,
            page,
            pageSize,
            totalPages,
            totalItems: sorted.length,
            items: slice,
          })
        );
        manifest.keys.push(key);
      }

      const legacySorted = sortRankEntries(legacyEntries, metric);
      const legacyTotalPages = Math.max(1, Math.ceil(legacySorted.length / pageSize));
      const legacyPageCount =
        maxPages > 0 ? Math.min(legacyTotalPages, maxPages) : legacyTotalPages;

      for (let page = 1; page <= legacyPageCount; page += 1) {
        const start = (page - 1) * pageSize;
        const slice = legacySorted.slice(start, start + pageSize);
        const legacyKey = `rank/${type}-${metric}-page-${page}.json`;

        writes.push(
          putStaticJson(env, legacyKey, {
            updatedAt,
            type,
            metric,
            page,
            pageSize,
            totalPages: legacyTotalPages,
            totalItems: legacySorted.length,
            items: slice,
          })
        );
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

async function loadStatsByType(env, supportedTypes) {
  const byType = Object.fromEntries(supportedTypes.map((type) => [type, {}]));
  const dataset = getAnalyticsDatasetName(env);
  const rows = await queryAnalyticsRows(
    env,
    `
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
    `
  );

  for (const row of rows) {
    const type = normalizeType(row?.blob1);
    const rawId = String(row?.blob2 || '').trim();
    const event = normalizeAnalyticsEvent(row?.blob3);
    if (!supportedTypes.includes(type) || !rawId || !event || rawId === 'bootstrap-analytics') {
      continue;
    }

    const id = normalizeArtifactId(rawId);
    const stats = byType[type][id] || createEmptyStats();
    const total = toWeightedCount(row?.double1, row?._sample_interval);
    const lastAt = normalizeOptionalTimestamp(row?.timestamp);

    if (event === ANALYTICS_DOWNLOAD_EVENT) {
      stats.downloads += total;
      stats.lastDownloadAt = latestTimestamp(stats.lastDownloadAt, lastAt);
    }

    stats.updatedAt = stats.lastDownloadAt;
    byType[type][id] = stats;
  }

  return byType;
}

async function loadRankEntriesByType(env, supportedTypes, statsByType) {
  const byType = Object.fromEntries(supportedTypes.map((type) => [type, []]));
  const auth = await getGitHubToken(env);
  const token = auth?.token || '';

  for (const type of supportedTypes) {
    const source = MARKET_SOURCE_CONFIG[type];
    if (!source) {
      continue;
    }

    const issues = await fetchAllOpenIssuesForSource(source, token);
    const entries = [];

    for (const issue of issues) {
      const entry = buildRankEntry(type, issue, statsByType[type] || {});
      if (entry) {
        entries.push(entry);
      }
    }

    byType[type] = entries;
  }

  return byType;
}

async function loadArtifactProjectsByType(env, artifactTypes, statsByType) {
  const byType = Object.fromEntries(
    artifactTypes.map((type) => [
      type,
      {
        rankEntries: [],
        detailEntries: {},
      },
    ])
  );
  const auth = await getGitHubToken(env);
  const token = auth?.token || '';

  for (const type of artifactTypes) {
    const source = MARKET_SOURCE_CONFIG[type];
    if (!source) {
      continue;
    }

    const issues = await fetchAllIssuesForSource(source, token, 'all');
    byType[type] = buildArtifactProjects(type, issues, statsByType[type] || {});
  }

  return byType;
}

async function fetchAllOpenIssuesForSource(source, token) {
  return fetchAllIssuesForSource(source, token, 'open');
}

async function fetchAllIssuesForSource(source, token, state = 'open') {
  const issues = [];
  let page = 1;

  while (true) {
    const query = new URLSearchParams({
      state,
      page: String(page),
      per_page: String(ISSUE_PAGE_SIZE),
    });
    if (source.label) {
      query.set('labels', source.label);
    }

    const { data } = await githubRequest(
      `/repos/${source.owner}/${source.repo}/issues?${query.toString()}`,
      token
    );
    const currentIssues = Array.isArray(data)
      ? data.filter((item) => item && !item.pull_request)
      : [];

    issues.push(...currentIssues);
    if (currentIssues.length < ISSUE_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return issues;
}

function buildArtifactProjects(type, issues, statsMap) {
  const grouped = new Map();

  for (const issue of issues) {
    const node = buildArtifactNode(type, issue);
    if (!node) {
      continue;
    }

    if (!grouped.has(node.projectId)) {
      grouped.set(node.projectId, []);
    }
    grouped.get(node.projectId).push(node);
  }

  const rankEntries = [];
  const detailEntries = {};

  for (const [projectId, nodes] of grouped.entries()) {
    const summary = summarizeArtifactProject(type, nodes, statsMap);
    detailEntries[projectId] = buildArtifactProjectDetail(summary);
    if (summary.latestOpenNodeId) {
      rankEntries.push(buildArtifactProjectRankEntry(summary));
    }
  }

  return {
    rankEntries,
    detailEntries,
  };
}

function buildArtifactNode(type, issue) {
  const body = String(issue?.body || '');
  const metadata = parseArtifactMetadata(body);
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const displayName = String(metadata.displayName || issue?.title || '').trim();
  const description = String(metadata.description || extractHumanDescriptionFromBody(body)).trim();
  const projectId = resolveArtifactProjectId(metadata, issue, displayName);
  const runtimePackageId = String(metadata.runtimePackageId || metadata.normalizedId || projectId).trim();
  const nodeId = String(metadata.nodeId || `legacy-${toInt(issue?.id)}`).trim() || `legacy-${toInt(issue?.id)}`;
  const rootNodeId = String(metadata.rootNodeId || nodeId).trim() || nodeId;
  const parentNodeIds = Array.isArray(metadata.parentNodeIds)
    ? metadata.parentNodeIds.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    projectId,
    type: String(metadata.type || type || '').trim() || type,
    projectDisplayName: String(metadata.projectDisplayName || displayName || issue?.title || '').trim(),
    projectDescription: String(metadata.projectDescription || description || '').trim(),
    runtimePackageId,
    nodeId,
    rootNodeId,
    parentNodeIds,
    publisherLogin: String(metadata.publisherLogin || issue?.user?.login || '').trim(),
    releaseTag: String(metadata.releaseTag || '').trim(),
    assetName: String(metadata.assetName || '').trim(),
    downloadUrl: String(metadata.downloadUrl || '').trim(),
    sha256: String(metadata.sha256 || '').trim(),
    version: String(metadata.version || '').trim(),
    displayName,
    description,
    sourceFileName: String(metadata.sourceFileName || '').trim(),
    minSupportedAppVersion: normalizeOptionalString(metadata.minSupportedAppVersion),
    maxSupportedAppVersion: normalizeOptionalString(metadata.maxSupportedAppVersion),
    publishedAt: normalizeOptionalTimestamp(issue?.created_at),
    state: String(issue?.state || 'open').trim() || 'open',
    featured: issueHasLabelName(issue, FEATURED_LABEL),
    issue: simplifyIssue(issue),
  };
}

function summarizeArtifactProject(type, nodes, statsMap) {
  const normalizedNodes = [...nodes].sort(
    (left, right) => compareStrings(left.publishedAt, right.publishedAt) || left.nodeId.localeCompare(right.nodeId)
  );
  const nodeIds = new Set(normalizedNodes.map((node) => node.nodeId));
  const rootNode =
    normalizedNodes.find((node) => node.nodeId === node.rootNodeId) ||
    normalizedNodes[0] ||
    null;
  const latestNode = pickLatestArtifactNode(normalizedNodes);
  const latestOpenNode = pickLatestArtifactNode(normalizedNodes.filter((node) => node.state === 'open'));
  const defaultNode = latestOpenNode || latestNode;
  const stats = statsMap[normalizeArtifactId(nodes[0]?.projectId)] || createEmptyStats();
  const contributorCount =
    new Set(
      normalizedNodes
        .map((node) => node.publisherLogin || node.issue?.user?.login || '')
        .filter(Boolean)
    ).size || 1;
  const likes = normalizedNodes.reduce(
    (sum, node) => sum + toInt(node?.issue?.reactions?.['+1']),
    0
  );
  const featured = normalizedNodes.some((node) => node.state === 'open' && node.featured);
  const defaultRuntimePackageId = String(defaultNode?.runtimePackageId || '').trim();
  const runtimePackageNodeSha256s = defaultRuntimePackageId
    ? normalizedNodes
      .filter((node) => normalizeArtifactId(node.runtimePackageId) === normalizeArtifactId(defaultRuntimePackageId))
      .map((node) => String(node.sha256 || '').trim())
      .filter(Boolean)
      .filter((sha256, index, list) => list.indexOf(sha256) === index)
    : [];
  const edges = [];

  for (const node of normalizedNodes) {
    for (const parentNodeId of node.parentNodeIds) {
      if (nodeIds.has(parentNodeId)) {
        edges.push({
          parentNodeId,
          childNodeId: node.nodeId,
        });
      }
    }
  }

  return {
    projectId: nodes[0]?.projectId || '',
    type,
    projectDisplayName: defaultNode?.projectDisplayName || latestNode?.projectDisplayName || rootNode?.projectDisplayName || '',
    projectDescription: defaultNode?.projectDescription || latestNode?.projectDescription || rootNode?.projectDescription || '',
    rootNodeId: rootNode?.rootNodeId || rootNode?.nodeId || '',
    rootPublisherLogin: rootNode?.publisherLogin || rootNode?.issue?.user?.login || '',
    rootPublisherAvatarUrl: rootNode?.issue?.user?.avatar_url || '',
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

function buildArtifactProjectRankEntry(summary) {
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

function buildArtifactProjectDetail(summary) {
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

function buildArtifactProjectRankDefaultNode(node) {
  if (!node) {
    return null;
  }

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

function pickLatestArtifactNode(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  return [...nodes].sort(
    (left, right) =>
      compareStrings(right.publishedAt, left.publishedAt) ||
      compareStrings(right.issue?.created_at, left.issue?.created_at) ||
      left.nodeId.localeCompare(right.nodeId)
  )[0];
}

function buildRankEntry(type, issue, statsMap) {
  const summary = summarizeMarketIssue(type, issue);
  if (!summary) {
    return null;
  }

  const stats = statsMap[summary.id] || createEmptyStats();
  return {
    id: summary.id,
    downloads: stats.downloads,
    lastDownloadAt: stats.lastDownloadAt,
    updatedAt: issue?.updated_at || stats.updatedAt || null,
    statsUpdatedAt: stats.updatedAt || null,
    featured: issueHasLabelName(issue, FEATURED_LABEL),
    displayTitle: summary.displayTitle,
    summaryDescription: summary.summaryDescription,
    authorLogin: summary.authorLogin,
    authorAvatarUrl: summary.authorAvatarUrl,
    metadata: summary.metadata,
    issue: simplifyIssue(issue),
  };
}

function summarizeMarketIssue(type, issue) {
  const body = String(issue?.body || '');
  const publisherLogin = String(issue?.user?.login || '').trim();
  const publisherAvatarUrl = String(issue?.user?.avatar_url || '').trim();

  if (type === 'script' || type === 'package') {
    const metadata = parseArtifactMetadata(body);
    if (!metadata) {
      return null;
    }
    const displayName = String(metadata.displayName || issue?.title || '').trim();

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
      id: resolveMarketEntryId(repositoryUrl, issue?.title || ''),
      displayTitle: String(issue?.title || '').trim(),
      summaryDescription: String(
        metadata?.description || extractHumanDescriptionFromBody(body)
      ).trim(),
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
      id: resolveMarketEntryId(repositoryUrl, issue?.title || ''),
      displayTitle: String(issue?.title || '').trim(),
      summaryDescription: sanitizeMcpDescription(
        String(metadata?.description || extractHumanDescriptionFromBody(body))
      ),
      authorLogin: repositoryOwner || publisherLogin,
      authorAvatarUrl: publisherAvatarUrl,
      metadata: metadata || null,
    };
  }

  return {
    id: normalizeArtifactId(issue?.title || ''),
    displayTitle: String(issue?.title || '').trim(),
    summaryDescription: extractHumanDescriptionFromBody(body),
    authorLogin: publisherLogin,
    authorAvatarUrl: publisherAvatarUrl,
    metadata: null,
  };
}

function simplifyIssue(issue) {
  return {
    id: toInt(issue?.id),
    number: toInt(issue?.number),
    title: String(issue?.title || ''),
    body: issue?.body ?? null,
    html_url: String(issue?.html_url || ''),
    state: String(issue?.state || 'open'),
    labels: Array.isArray(issue?.labels) ? issue.labels.map(simplifyLabel) : [],
    user: simplifyUser(issue?.user),
    created_at: String(issue?.created_at || ''),
    updated_at: String(issue?.updated_at || ''),
    reactions: simplifyReactions(issue?.reactions),
  };
}

function simplifyLabel(label) {
  return {
    id: toInt(label?.id),
    name: String(label?.name || ''),
    color: String(label?.color || ''),
    description: label?.description ?? null,
  };
}

function simplifyUser(user) {
  return {
    id: toInt(user?.id),
    login: String(user?.login || ''),
    avatar_url: String(user?.avatar_url || ''),
  };
}

function simplifyReactions(reactions) {
  if (!reactions || typeof reactions !== 'object') {
    return null;
  }

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

function sortRankEntries(entries, metric) {
  const list = [...entries];

  if (metric === 'featured') {
    return list
      .filter((entry) => entry.featured)
      .sort(
        (left, right) =>
          compareStrings(right.updatedAt, left.updatedAt) ||
          left.id.localeCompare(right.id)
      );
  }

  if (metric === 'downloads') {
    return list.sort(
      (left, right) =>
        compareNumbers(right.downloads, left.downloads) ||
        compareNumbers(getThumbsUpCount(right), getThumbsUpCount(left)) ||
        compareStrings(right.updatedAt, left.updatedAt) ||
        left.id.localeCompare(right.id)
    );
  }

  if (metric === 'likes') {
    return list.sort(
      (left, right) =>
        compareNumbers(getThumbsUpCount(right), getThumbsUpCount(left)) ||
        compareStrings(right.updatedAt, left.updatedAt) ||
        left.id.localeCompare(right.id)
    );
  }

  return list.sort(
    (left, right) =>
      compareStrings(right.updatedAt, left.updatedAt) ||
      left.id.localeCompare(right.id)
  );
}

function sortArtifactProjectRankEntries(entries, metric) {
  const list = [...entries];

  if (metric === 'featured') {
    return list
      .filter((entry) => entry.featured)
      .sort(
        (left, right) =>
          compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
          left.projectId.localeCompare(right.projectId)
      );
  }

  if (metric === 'downloads') {
    return list.sort(
      (left, right) =>
        compareNumbers(right.downloads, left.downloads) ||
        compareNumbers(right.likes, left.likes) ||
        compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
        left.projectId.localeCompare(right.projectId)
    );
  }

  if (metric === 'likes') {
    return list.sort(
      (left, right) =>
        compareNumbers(right.likes, left.likes) ||
        compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
        left.projectId.localeCompare(right.projectId)
    );
  }

  return list.sort(
    (left, right) =>
      compareStrings(right.latestPublishedAt, left.latestPublishedAt) ||
      left.projectId.localeCompare(right.projectId)
  );
}

function getThumbsUpCount(entry) {
  return toInt(entry?.issue?.reactions?.['+1']);
}

function issueHasLabelName(issue, expectedLabelName) {
  const normalizedExpected = String(expectedLabelName || '').trim().toLowerCase();
  if (!normalizedExpected) {
    return false;
  }

  const labels = Array.isArray(issue?.labels) ? issue.labels : [];
  return labels.some((label) => {
    const labelName =
      typeof label === 'string'
        ? label
        : label?.name;
    return String(labelName || '').trim().toLowerCase() === normalizedExpected;
  });
}

async function githubRequest(path, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'operit-market-sync',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: 'GET',
    headers,
  });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || response.statusText || 'github_request_failed';
    throw new Error(message);
  }

  return { response, data };
}

async function getGitHubToken(env) {
  const pat = String(env.OPERIT_GITHUB_TOKEN || '').trim();
  if (pat) {
    return { token: pat, source: 'pat' };
  }

  const appId = String(env.OPERIT_GITHUB_APP_ID || '').trim();
  const installationId = String(env.OPERIT_GITHUB_INSTALLATION_ID || '').trim();
  const privateKey = normalizePem(env.OPERIT_GITHUB_PRIVATE_KEY || '');

  if (!appId || !installationId || !privateKey) {
    return null;
  }

  const now = Date.now();
  if (githubTokenCache.token && githubTokenCache.expiresAt - now > 60_000) {
    return { token: githubTokenCache.token, source: 'app' };
  }

  const jwt = await createGitHubAppJwt(appId, privateKey);
  const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'operit-market-sync',
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || response.statusText || 'github_app_token_failed';
    throw new Error(message);
  }

  const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : now + 30 * 60_000;
  githubTokenCache = {
    token: data?.token || '',
    expiresAt,
  };

  return { token: githubTokenCache.token, source: 'app' };
}

async function createGitHubAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlFromString(JSON.stringify(header));
  const encodedPayload = base64UrlFromString(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data)
  );
  return `${data}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function importPrivateKey(pem) {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function parseArtifactMetadata(body) {
  return parseCommentJson(body, '<!-- operit-market-json: ');
}

function parseSkillMetadata(body) {
  const metadata = parseCommentJson(body, '<!-- operit-skill-json: ');
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  return {
    description: String(metadata.description || ''),
    repositoryUrl: String(metadata.repositoryUrl || metadata.repoUrl || ''),
    category: String(metadata.category || ''),
    tags: String(metadata.tags || ''),
    version: String(metadata.version || ''),
  };
}

function parseMcpMetadata(body) {
  const metadata = parseCommentJson(body, '<!-- operit-mcp-json: ');
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  return {
    description: String(metadata.description || ''),
    repositoryUrl: String(metadata.repositoryUrl || ''),
    installConfig: String(metadata.installConfig || metadata.installCommand || ''),
    category: String(metadata.category || ''),
    tags: String(metadata.tags || ''),
    version: String(metadata.version || ''),
  };
}

function parseCommentJson(body, prefix) {
  const source = String(body || '');
  const start = source.indexOf(prefix);
  if (start < 0) {
    return null;
  }

  const jsonStart = start + prefix.length;
  const end = source.indexOf(' -->', jsonStart);
  if (end <= jsonStart) {
    return null;
  }

  try {
    return JSON.parse(source.slice(jsonStart, end));
  } catch {
    return null;
  }
}

function extractHumanDescriptionFromBody(body) {
  const source = String(body || '');
  if (!source.trim()) {
    return '';
  }

  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '\n');
  const withoutCodeBlocks = withoutComments.replace(/```[\s\S]*?```/g, '\n');
  const paragraphs = [];
  let currentParagraph = '';

  const flush = () => {
    const paragraph = currentParagraph.trim();
    if (paragraph) {
      paragraphs.push(paragraph);
    }
    currentParagraph = '';
  };

  for (const rawLine of withoutCodeBlocks.split(/\r?\n/)) {
    const trimmedRaw = rawLine.trim();
    if (!trimmedRaw) {
      flush();
      continue;
    }

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
    if (currentParagraph.length >= 400) {
      flush();
      break;
    }
  }
  flush();

  const candidate = paragraphs.find((paragraph) =>
    paragraph.length >= 6 &&
    !paragraph.startsWith('{') &&
    !paragraph.toLowerCase().includes('operit-')
  );

  return (candidate || '').slice(0, 300).trim();
}

function isLabelOnlyLine(raw) {
  const normalized = String(raw || '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .trim()
    .replace(/[:：]+$/, '');
  if (!normalized) {
    return false;
  }

  const parts = normalized
    .split(/[\/|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return false;
  }

  return parts.every((part) => DESCRIPTION_LABEL_WORDS.has(part.toLowerCase()));
}

function sanitizeMcpDescription(raw) {
  return String(raw || '')
    .trim()
    .replace(/^(?:\*\*\s*)?描述\s*[:：]\s*(?:\*\*)?\s*/u, '')
    .replace(/^(?:\*\*\s*)?(description|desc|summary|introduction)\s*[:：]\s*(?:\*\*)?\s*/iu, '')
    .trim();
}

function extractRepositoryOwner(repositoryUrl) {
  const match = /github\.com\/([^/]+)\/([^/]+)/i.exec(String(repositoryUrl || ''));
  return match ? String(match[1] || '').trim() : '';
}

function resolveMarketEntryId(preferredSource, fallback) {
  const source = canonicalizeMarketSource(preferredSource) || String(fallback || '').trim();
  return normalizeArtifactId(source);
}

function canonicalizeMarketSource(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }

  try {
    const uri = new URL(value);
    const host = String(uri.hostname || '').replace(/^www\./i, '').trim();
    const path = String(uri.pathname || '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '')
      .trim();
    return [host, path].filter(Boolean).join('/');
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '')
      .trim();
  }
}

function createEmptyStats() {
  return {
    downloads: 0,
    lastDownloadAt: null,
    updatedAt: null,
  };
}

function recordMarketCounter(env, type, id, counterField) {
  const event = resolveAnalyticsEvent(counterField);
  env.MARKET_ANALYTICS.writeDataPoint({
    blobs: [type, id, event],
    doubles: [1],
    indexes: [`${type}:${id}:${event}`],
  });
}

async function putStaticJson(env, logicalKey, value) {
  await env.MARKET_STATS_BUCKET.put(buildStaticObjectKey(logicalKey, env), JSON.stringify(value), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: getStaticJsonCacheControl(env),
    },
  });
}

async function deleteStaleStaticObjects(env, activeLogicalKeys) {
  const prefix = getStaticObjectPrefix(env);
  if (!prefix) {
    return;
  }

  const activeObjectKeys = new Set(
    activeLogicalKeys.map((logicalKey) => buildStaticObjectKey(logicalKey, env))
  );

  let cursor = undefined;
  do {
    const listed = await env.MARKET_STATS_BUCKET.list({
      prefix: `${prefix}/`,
      cursor,
    });

    const staleKeys = (listed.objects || [])
      .map((entry) => entry.key)
      .filter((objectKey) => !activeObjectKeys.has(objectKey));

    if (staleKeys.length > 0) {
      await Promise.all(staleKeys.map((objectKey) => env.MARKET_STATS_BUCKET.delete(objectKey)));
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

function getStaticJsonCacheControl(env) {
  return `public, max-age=${getPositiveInt(env.MARKET_JSON_CACHE_MAX_AGE, 300)}, stale-while-revalidate=300`;
}

function getStaticObjectPrefix(env) {
  return String(env.MARKET_STATIC_OBJECT_PREFIX || 'market-stats')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function buildStaticObjectKey(logicalKey, env) {
  const cleanKey = String(logicalKey || '').replace(/^\/+/, '');
  const prefix = getStaticObjectPrefix(env);
  return prefix ? `${prefix}/${cleanKey}` : cleanKey;
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = splitCsv(env.MARKET_ALLOWED_ORIGINS);
  const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes('*');

  return {
    'access-control-allow-origin': allowAll ? '*' : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*'),
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}

function redirect(target, corsHeaders) {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      location: target,
      'cache-control': 'no-store',
    },
  });
}

function json(value, status, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function validateType(type, env) {
  if (!getSupportedTypes(env).includes(type)) {
    throw new Error(`Unsupported type: ${type}`);
  }
}

function validateArtifactId(id) {
  if (!id) {
    throw new Error('Missing artifact id');
  }
}

function validateTargetUrl(target, env) {
  if (!target) {
    throw new Error('Missing target URL');
  }

  const parsed = new URL(target);
  if (parsed.protocol !== 'https:') {
    throw new Error('Target URL must use https');
  }

  const allowedHosts = splitCsv(env.MARKET_ALLOWED_DOWNLOAD_HOSTS);
  const candidates = allowedHosts.length > 0 ? allowedHosts : DEFAULT_ALLOWED_DOWNLOAD_HOSTS;
  const hostname = parsed.hostname.toLowerCase();
  const isAllowed = candidates.some((host) => hostname === host || hostname.endsWith(`.${host}`));

  if (!isAllowed) {
    throw new Error(`Target host is not allowed: ${parsed.hostname}`);
  }
}

function requireAnalyticsBinding(env) {
  if (!env.MARKET_ANALYTICS || typeof env.MARKET_ANALYTICS.writeDataPoint !== 'function') {
    throw new Error('MARKET_ANALYTICS binding is not configured');
  }
}

function requireStatsBucket(env) {
  if (!env.MARKET_STATS_BUCKET) {
    throw new Error('MARKET_STATS_BUCKET binding is not configured');
  }
}

function getSupportedTypes(env) {
  const configured = splitCsv(env.MARKET_SUPPORTED_TYPES);
  const unique = [...new Set(configured.map((item) => normalizeType(item)).filter(Boolean))];
  return unique.length > 0 ? unique : ['script', 'package', 'skill', 'mcp'];
}

function canRegenerateStaticJson(env) {
  return Boolean(env.MARKET_STATS_BUCKET) && hasAnalyticsQueryConfig(env);
}

function requireAnalyticsQueryConfig(env) {
  const accountId = String(env.MARKET_ANALYTICS_ACCOUNT_ID || '').trim();
  const apiToken = String(env.MARKET_ANALYTICS_API_TOKEN || '').trim();
  const dataset = getAnalyticsDatasetName(env);

  if (!accountId) {
    throw new Error('MARKET_ANALYTICS_ACCOUNT_ID is not configured');
  }
  if (!apiToken) {
    throw new Error('MARKET_ANALYTICS_API_TOKEN is not configured');
  }

  return { accountId, apiToken, dataset };
}

function hasAnalyticsQueryConfig(env) {
  const accountId = String(env.MARKET_ANALYTICS_ACCOUNT_ID || '').trim();
  const apiToken = String(env.MARKET_ANALYTICS_API_TOKEN || '').trim();
  const dataset = String(env.MARKET_ANALYTICS_DATASET || '').trim();
  return Boolean(accountId && apiToken && /^[A-Za-z_][A-Za-z0-9_]*$/.test(dataset));
}

function getAnalyticsDatasetName(env) {
  const dataset = String(env.MARKET_ANALYTICS_DATASET || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dataset)) {
    throw new Error('MARKET_ANALYTICS_DATASET must be a valid SQL table name');
  }
  return dataset;
}

async function queryAnalyticsRows(env, query) {
  const { accountId, apiToken } = requireAnalyticsQueryConfig(env);
  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: String(query || '').trim(),
    }
  );
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.errors?.[0]?.message ||
      payload?.error ||
      text ||
      response.statusText ||
      'analytics_query_failed';
    throw new Error(`Analytics query failed: ${message}`);
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

function resolveAnalyticsEvent(counterField) {
  if (counterField === 'downloads') {
    return ANALYTICS_DOWNLOAD_EVENT;
  }
  throw new Error(`Unsupported market counter field: ${counterField}`);
}

function normalizeAnalyticsEvent(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ANALYTICS_SUPPORTED_EVENTS.includes(normalized) ? normalized : '';
}

function normalizeOptionalTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return raw;
}

function latestTimestamp(left, right) {
  const leftTime = toTimestampMillis(left);
  const rightTime = toTimestampMillis(right);

  if (leftTime === null) {
    return right || null;
  }
  if (rightTime === null) {
    return left || null;
  }

  return leftTime >= rightTime ? left : right;
}

function toTimestampMillis(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function quoteSqlString(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function resolveArtifactProjectId(metadata, issue, displayName = '') {
  const rawProjectId = String(metadata?.projectId || '').trim();
  const normalizedProjectId = normalizeArtifactId(rawProjectId);

  if (rawProjectId && isPlaceholderArtifactProjectId(normalizedProjectId)) {
    const nodeKey = normalizeArtifactNodeKey(metadata?.rootNodeId || metadata?.nodeId);
    if (nodeKey) {
      return nodeKey;
    }

    const fallbackCandidates = [
      metadata?.normalizedId,
      metadata?.runtimePackageId,
      displayName,
      metadata?.assetName,
      issue?.title,
    ];

    for (const candidate of fallbackCandidates) {
      const normalized = normalizeArtifactId(candidate);
      if (normalized && !isPlaceholderArtifactProjectId(normalized)) {
        return normalized;
      }
    }
  }

  return normalizeArtifactId(
    metadata?.projectId ||
      metadata?.normalizedId ||
      metadata?.runtimePackageId ||
      displayName ||
      metadata?.assetName ||
      issue?.title
  );
}

function normalizeArtifactNodeKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(normalized) ? normalized : '';
}

function isPlaceholderArtifactProjectId(value) {
  return normalizeArtifactId(value) === 'artifact';
}

function isArtifactType(type) {
  return ARTIFACT_TYPES.includes(normalizeType(type));
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeArtifactId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'artifact';
}

function normalizeTargetUrl(value) {
  return String(value || '').trim();
}

function normalizeOptionalString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toInt(value) {
  const parsed = Number.parseInt(String(value || '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCount(value) {
  const parsed = Number(String(value || '0'));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function toWeightedCount(value, sampleInterval) {
  const numericValue = Number(String(value || '0'));
  const numericSampleInterval = Number(String(sampleInterval || '1'));
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericSampleInterval)) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue * numericSampleInterval));
}

function compareNumbers(left, right) {
  return left - right;
}

function compareStrings(left, right) {
  return String(left || '').localeCompare(String(right || ''));
}

function normalizePem(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '\n').trim();
}

function pemToArrayBuffer(pem) {
  const normalized = normalizePem(pem);
  const base64 = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64FromBytes(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64UrlFromBytes(bytes) {
  return base64FromBytes(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromString(value) {
  const bytes = new TextEncoder().encode(value);
  return base64UrlFromBytes(bytes);
}
