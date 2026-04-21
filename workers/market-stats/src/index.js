const SUPPORTED_RANK_METRICS = ['downloads', 'installs', 'updated'];
const DEFAULT_ALLOWED_DOWNLOAD_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com',
];
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const GITHUB_API_BASE = 'https://api.github.com';
const ISSUE_PAGE_SIZE = 100;
const ANALYTICS_DOWNLOAD_EVENT = 'download';
const ANALYTICS_INSTALL_EVENT = 'install';
const ANALYTICS_SUPPORTED_EVENTS = [ANALYTICS_DOWNLOAD_EVENT, ANALYTICS_INSTALL_EVENT];
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

      if (pathname === '/install') {
        return await handleInstall(request, env, corsHeaders);
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
            '/install',
            '/stats.json',
            '/stats/<type>.json',
            '/rank/<type>-<metric>-page-<n>.json',
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

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(regenerateStaticJson(env));
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

async function handleInstall(request, env, corsHeaders) {
  requireAnalyticsBinding(env);

  let payload = {};
  if (request.method === 'POST') {
    payload = await request.json().catch(() => ({}));
  } else {
    const url = new URL(request.url);
    payload = {
      type: url.searchParams.get('type'),
      id: url.searchParams.get('id'),
    };
  }

  const type = normalizeType(payload.type);
  const id = normalizeArtifactId(payload.id);

  validateType(type, env);
  validateArtifactId(id);

  recordMarketCounter(env, type, id, 'installs');
  return json({ ok: true, type, id }, 200, corsHeaders);
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
    pathname.startsWith('/rank/');
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
  const maxPages = getPositiveInt(env.MARKET_RANK_MAX_PAGES, 5);
  const updatedAt = new Date().toISOString();

  const statsByType = await loadStatsByType(env, supportedTypes);
  const rankEntriesByType = await loadRankEntriesByType(env, supportedTypes, statsByType);

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

  for (const type of supportedTypes) {
    const entries = rankEntriesByType[type] || [];

    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = sortRankEntries(entries, metric);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = Math.min(totalPages, maxPages);

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
    } else if (event === ANALYTICS_INSTALL_EVENT) {
      stats.installs += total;
      stats.lastInstallAt = latestTimestamp(stats.lastInstallAt, lastAt);
    }

    stats.updatedAt = latestTimestamp(stats.lastDownloadAt, stats.lastInstallAt);
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

async function fetchAllOpenIssuesForSource(source, token) {
  const issues = [];
  let page = 1;

  while (true) {
    const query = new URLSearchParams({
      state: 'open',
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

function buildRankEntry(type, issue, statsMap) {
  const summary = summarizeMarketIssue(type, issue);
  if (!summary) {
    return null;
  }

  const stats = statsMap[summary.id] || createEmptyStats();
  return {
    id: summary.id,
    downloads: stats.downloads,
    installs: stats.installs,
    lastDownloadAt: stats.lastDownloadAt,
    lastInstallAt: stats.lastInstallAt,
    updatedAt: issue?.updated_at || stats.updatedAt || null,
    statsUpdatedAt: stats.updatedAt || null,
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

    return {
      id: normalizeArtifactId(metadata.normalizedId || metadata.displayName || metadata.assetName),
      displayTitle: String(metadata.displayName || issue?.title || '').trim(),
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

  if (metric === 'downloads') {
    return list.sort(
      (left, right) =>
        compareNumbers(right.downloads, left.downloads) ||
        compareStrings(right.updatedAt, left.updatedAt) ||
        left.id.localeCompare(right.id)
    );
  }

  if (metric === 'installs') {
    return list.sort(
      (left, right) =>
        compareNumbers(right.installs, left.installs) ||
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
    installs: 0,
    lastDownloadAt: null,
    lastInstallAt: null,
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
    'access-control-allow-methods': 'GET,POST,OPTIONS',
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
  if (counterField === 'installs') {
    return ANALYTICS_INSTALL_EVENT;
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
