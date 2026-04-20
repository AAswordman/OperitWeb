const SUPPORTED_RANK_METRICS = ['downloads', 'installs', 'updated'];
const DEFAULT_ALLOWED_DOWNLOAD_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'raw.githubusercontent.com',
];

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
        return handleDownload(request, env, corsHeaders);
      }

      if (pathname === '/install') {
        return handleInstall(request, env, corsHeaders);
      }

      if (isStaticJsonPath(pathname)) {
        return handleStaticJson(pathname, env, corsHeaders);
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
  requireStatsDatabase(env);

  const url = new URL(request.url);
  const type = normalizeType(url.searchParams.get('type'));
  const id = normalizeArtifactId(url.searchParams.get('id'));
  const target = normalizeTargetUrl(url.searchParams.get('target'));

  validateType(type, env);
  validateArtifactId(id);
  validateTargetUrl(target, env);

  await bumpMarketCounter(env, type, id, 'downloads');
  return redirect(target, corsHeaders);
}

async function handleInstall(request, env, corsHeaders) {
  requireStatsDatabase(env);

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

  await bumpMarketCounter(env, type, id, 'installs');
  return json({ ok: true, type, id }, 200, corsHeaders);
}

async function handleStaticJson(pathname, env, corsHeaders) {
  requireStatsCache(env);

  const key = pathname.replace(/^\//, '');
  let payload = await env.MARKET_STATS_CACHE.get(key);

  if (!payload && env.MARKET_STATS_DB) {
    await regenerateStaticJson(env);
    payload = await env.MARKET_STATS_CACHE.get(key);
  }

  if (!payload) {
    return json({ error: 'not_found', key }, 404, corsHeaders);
  }

  return new Response(payload, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${getPositiveInt(env.MARKET_JSON_CACHE_MAX_AGE, 300)}, stale-while-revalidate=300`,
    },
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
  requireStatsDatabase(env);
  requireStatsCache(env);

  const supportedTypes = getSupportedTypes(env);
  const pageSize = getPositiveInt(env.MARKET_RANK_PAGE_SIZE, 20);
  const maxPages = getPositiveInt(env.MARKET_RANK_MAX_PAGES, 5);
  const updatedAt = new Date().toISOString();

  const { results } = await env.MARKET_STATS_DB.prepare(
    `
      SELECT type, id, downloads, installs, last_download_at, last_install_at, updated_at
      FROM market_entry_stats
      ORDER BY type ASC, id ASC
    `
  ).all();

  const byType = Object.fromEntries(supportedTypes.map((type) => [type, {}]));

  for (const row of results || []) {
    const type = normalizeType(row.type);
    if (!supportedTypes.includes(type)) {
      continue;
    }

    byType[type][row.id] = {
      downloads: toInt(row.downloads),
      installs: toInt(row.installs),
      lastDownloadAt: row.last_download_at || null,
      lastInstallAt: row.last_install_at || null,
      updatedAt: row.updated_at,
    };
  }

  const kvWrites = [];
  const manifest = {
    updatedAt,
    pageSize,
    maxPages,
    supportedTypes,
    supportedRankMetrics: SUPPORTED_RANK_METRICS,
    keys: ['stats.json', 'manifest.json'],
  };

  kvWrites.push(putJson(env, 'stats.json', { updatedAt, items: byType }));

  for (const type of supportedTypes) {
    const statsKey = `stats/${type}.json`;
    kvWrites.push(putJson(env, statsKey, { updatedAt, items: byType[type] }));
    manifest.keys.push(statsKey);
  }

  for (const type of supportedTypes) {
    const entries = Object.entries(byType[type]).map(([id, stats]) => ({
      id,
      ...stats,
    }));

    for (const metric of SUPPORTED_RANK_METRICS) {
      const sorted = sortRankEntries(entries, metric);
      const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
      const pageCount = Math.min(totalPages, maxPages);

      for (let page = 1; page <= pageCount; page += 1) {
        const start = (page - 1) * pageSize;
        const slice = sorted.slice(start, start + pageSize);
        const key = `rank/${type}-${metric}-page-${page}.json`;

        kvWrites.push(
          putJson(env, key, {
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

  kvWrites.push(putJson(env, 'manifest.json', manifest));
  await Promise.all(kvWrites);
}

function sortRankEntries(entries, metric) {
  const list = [...entries];

  if (metric === 'downloads') {
    return list.sort((left, right) => compareNumbers(right.downloads, left.downloads) || left.id.localeCompare(right.id));
  }

  if (metric === 'installs') {
    return list.sort((left, right) => compareNumbers(right.installs, left.installs) || left.id.localeCompare(right.id));
  }

  return list.sort((left, right) => compareStrings(right.updatedAt, left.updatedAt) || left.id.localeCompare(right.id));
}

async function bumpMarketCounter(env, type, id, counterField) {
  const now = new Date().toISOString();

  if (counterField === 'downloads') {
    await env.MARKET_STATS_DB.prepare(
      `
        INSERT INTO market_entry_stats (
          type, id, downloads, installs, last_download_at, last_install_at, updated_at
        ) VALUES (?, ?, 1, 0, ?, NULL, ?)
        ON CONFLICT(type, id) DO UPDATE SET
          downloads = downloads + 1,
          last_download_at = excluded.last_download_at,
          updated_at = excluded.updated_at
      `
    ).bind(type, id, now, now).run();
    return;
  }

  await env.MARKET_STATS_DB.prepare(
    `
      INSERT INTO market_entry_stats (
        type, id, downloads, installs, last_download_at, last_install_at, updated_at
      ) VALUES (?, ?, 0, 1, NULL, ?, ?)
      ON CONFLICT(type, id) DO UPDATE SET
        installs = installs + 1,
        last_install_at = excluded.last_install_at,
        updated_at = excluded.updated_at
    `
  ).bind(type, id, now, now).run();
}

async function putJson(env, key, value) {
  await env.MARKET_STATS_CACHE.put(key, JSON.stringify(value));
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

function requireStatsDatabase(env) {
  if (!env.MARKET_STATS_DB) {
    throw new Error('MARKET_STATS_DB binding is not configured');
  }
}

function requireStatsCache(env) {
  if (!env.MARKET_STATS_CACHE) {
    throw new Error('MARKET_STATS_CACHE binding is not configured');
  }
}

function getSupportedTypes(env) {
  const configured = splitCsv(env.MARKET_SUPPORTED_TYPES);
  const unique = [...new Set(configured.map((item) => normalizeType(item)).filter(Boolean))];
  return unique.length > 0 ? unique : ['script', 'package', 'skill', 'mcp'];
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeArtifactId(value) {
  return String(value || '').trim();
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

function compareNumbers(left, right) {
  return left - right;
}

function compareStrings(left, right) {
  return String(left || '').localeCompare(String(right || ''));
}
