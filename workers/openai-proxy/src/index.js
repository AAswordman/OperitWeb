const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_CHATGPT_BACKEND_BASE_URL = 'https://chatgpt.com';
const DEFAULT_ALLOWED_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_ALLOWED_HEADERS = [
  'Authorization',
  'ChatGPT-Account-ID',
  'Content-Type',
  'Cookie',
  'OpenAI-Beta',
  'OpenAI-Organization',
  'OpenAI-Project',
  'OAI-Device-Id',
  'OpenAI-Sentinel-Chat-Requirements-Token',
  'OpenAI-Sentinel-Proof-Token',
  'OpenAI-Sentinel-Turnstile-Token',
  'X-CSRF-Token',
  'X-Proxy-Secret',
].join(', ');
const DEFAULT_EXPOSE_HEADERS = [
  'content-type',
  'x-request-id',
  'openai-processing-ms',
  'x-openai-proxy',
].join(', ');

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  return normalized || DEFAULT_OPENAI_BASE_URL;
}

function parseAllowedOrigins(value) {
  const normalized = String(value || '*').trim();
  if (!normalized) return new Set(['*']);
  return new Set(
    normalized
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  );
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = parseAllowedOrigins(env.OPENAI_PROXY_ALLOWED_ORIGINS);
  const requestHeaders = request.headers.get('access-control-request-headers') || '';

  const headers = {
    'Access-Control-Allow-Methods': String(env.OPENAI_PROXY_ALLOWED_METHODS || DEFAULT_ALLOWED_METHODS),
    'Access-Control-Allow-Headers': requestHeaders || String(env.OPENAI_PROXY_ALLOWED_HEADERS || DEFAULT_ALLOWED_HEADERS),
    'Access-Control-Expose-Headers': String(env.OPENAI_PROXY_EXPOSE_HEADERS || DEFAULT_EXPOSE_HEADERS),
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Access-Control-Request-Headers',
  };

  if (allowedOrigins.has('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return true;

  const allowedOrigins = parseAllowedOrigins(env.OPENAI_PROXY_ALLOWED_ORIGINS);
  return allowedOrigins.has('*') || allowedOrigins.has(origin);
}

function resolveProxyTarget(pathname) {
  if (pathname === '/v1' || pathname.startsWith('/v1/')) {
    return {
      kind: 'openai',
      upstreamPath: pathname,
    };
  }

  if (pathname === '/openai/v1' || pathname.startsWith('/openai/v1/')) {
    return {
      kind: 'openai',
      upstreamPath: pathname.slice('/openai'.length),
    };
  }

  if (pathname === '/backend-api' || pathname.startsWith('/backend-api/')) {
    return {
      kind: 'chatgpt-backend',
      upstreamPath: pathname,
    };
  }

  if (pathname === '/chatgpt/backend-api' || pathname.startsWith('/chatgpt/backend-api/')) {
    return {
      kind: 'chatgpt-backend',
      upstreamPath: pathname.slice('/chatgpt'.length),
    };
  }

  return null;
}

function readProxySecret(request) {
  return String(request.headers.get('x-proxy-secret') || '').trim();
}

function requireProxySecret(request, env) {
  const expected = String(env.OPENAI_PROXY_SECRET || '').trim();
  if (!expected) {
    return { ok: true };
  }

  const actual = readProxySecret(request);
  if (actual && actual === expected) {
    return { ok: true };
  }

  return { ok: false, status: 401, error: 'invalid_proxy_secret' };
}

function buildForwardedFor(request, clientIp) {
  const existing = String(request.headers.get('x-forwarded-for') || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (clientIp && !existing.includes(clientIp)) {
    existing.push(clientIp);
  }

  return existing.join(', ');
}

function buildUpstreamHeaders(request, env, target) {
  const headers = new Headers(request.headers);
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('true-client-ip') ||
    request.headers.get('x-real-ip') ||
    '';
  const forwardedFor = buildForwardedFor(request, clientIp);

  const headersToDelete = [
    'access-control-request-headers',
    'access-control-request-method',
    'chatgpt-account-id',
    'cf-connecting-ip',
    'cf-ipcountry',
    'cf-ray',
    'cf-visitor',
    'cdn-loop',
    'content-length',
    'host',
    'true-client-ip',
    'x-forwarded-for',
    'x-openai-proxy',
    'x-proxy-secret',
    'x-real-ip',
  ];

  if (target.kind === 'openai') {
    headersToDelete.push('cookie', 'origin', 'referer');
  }

  for (const headerName of headersToDelete) {
    headers.delete(headerName);
  }

  if (target.kind === 'openai') {
    const incomingAuthorization = String(request.headers.get('authorization') || '').trim();
    const apiKey = String(env.OPENAI_API_KEY || '').trim();
    if (incomingAuthorization) {
      headers.set('authorization', incomingAuthorization);
    } else if (apiKey) {
      headers.set('authorization', `Bearer ${apiKey}`);
    } else {
      return { ok: false, status: 500, error: 'missing_upstream_authorization' };
    }

    const org = String(env.OPENAI_ORGANIZATION || '').trim();
    if (org && !headers.has('openai-organization')) {
      headers.set('openai-organization', org);
    }

    const project = String(env.OPENAI_PROJECT || '').trim();
    if (project && !headers.has('openai-project')) {
      headers.set('openai-project', project);
    }
  }

  if (target.kind === 'chatgpt-backend') {
    const backendBaseUrl = normalizeBaseUrl(env.CHATGPT_BACKEND_BASE_URL || DEFAULT_CHATGPT_BACKEND_BASE_URL);
    const incomingAuthorization = String(request.headers.get('authorization') || '').trim();
    const incomingCookie = String(request.headers.get('cookie') || '').trim();
    const fallbackAuthorization = String(env.CHATGPT_BACKEND_AUTHORIZATION || '').trim();
    const fallbackCookie = String(env.CHATGPT_BACKEND_COOKIE || '').trim();

    if (!incomingAuthorization && fallbackAuthorization) {
      headers.set('authorization', fallbackAuthorization);
    }
    if (!incomingCookie && fallbackCookie) {
      headers.set('cookie', fallbackCookie);
    }

    headers.set('origin', backendBaseUrl);
    headers.set('referer', `${backendBaseUrl}/`);
  }

  if (clientIp) {
    headers.set('cf-connecting-ip', clientIp);
    headers.set('true-client-ip', clientIp);
    headers.set('x-real-ip', clientIp);
  }

  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor);
  }

  headers.set('x-openai-proxy', 'cloudflare-worker');
  return { ok: true, headers };
}

function mergeResponseHeaders(response, corsHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  headers.set('x-openai-proxy', 'cloudflare-worker');
  return headers;
}

async function handleProxy(request, env, corsHeaders) {
  const url = new URL(request.url);
  const target = resolveProxyTarget(url.pathname);
  if (!target) {
    return json(
      {
        error: 'not_found',
        hint: 'Use /v1/*, /openai/v1/*, /backend-api/*, or /chatgpt/backend-api/* for passthrough.',
      },
      404,
      corsHeaders,
    );
  }

  const secretResult = requireProxySecret(request, env);
  if (!secretResult.ok) {
    return json({ error: secretResult.error }, secretResult.status, corsHeaders);
  }

  const headerResult = buildUpstreamHeaders(request, env, target);
  if (!headerResult.ok) {
    return json({ error: headerResult.error }, headerResult.status, corsHeaders);
  }

  const upstreamBaseUrl =
    target.kind === 'chatgpt-backend'
      ? normalizeBaseUrl(env.CHATGPT_BACKEND_BASE_URL || DEFAULT_CHATGPT_BACKEND_BASE_URL)
      : normalizeBaseUrl(env.OPENAI_BASE_URL);
  const upstreamUrl = `${upstreamBaseUrl}${target.upstreamPath}${url.search || ''}`;
  const init = {
    method: request.method,
    headers: headerResult.headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = request.body;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: mergeResponseHeaders(upstreamResponse, corsHeaders),
    });
  } catch (error) {
    return json(
      {
        error: 'upstream_fetch_failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      502,
      corsHeaders,
    );
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!isOriginAllowed(request, env)) {
      return json({ error: 'origin_not_allowed' }, 403, corsHeaders);
    }

    if (url.pathname === '/health' || url.pathname === '/openai/health') {
      return json(
        {
          ok: true,
          service: 'openai-proxy',
          openai_upstream_base_url: normalizeBaseUrl(env.OPENAI_BASE_URL),
          chatgpt_backend_base_url: normalizeBaseUrl(env.CHATGPT_BACKEND_BASE_URL || DEFAULT_CHATGPT_BACKEND_BASE_URL),
          auth_mode: 'passthrough_first',
          fallback_worker_api_key: Boolean(env.OPENAI_API_KEY),
          fallback_chatgpt_authorization: Boolean(env.CHATGPT_BACKEND_AUTHORIZATION),
          fallback_chatgpt_cookie: Boolean(env.CHATGPT_BACKEND_COOKIE),
          ip_header_passthrough: true,
          supported_routes: [
            '/v1/*',
            '/openai/v1/*',
            '/backend-api/*',
            '/chatgpt/backend-api/*',
          ],
        },
        200,
        corsHeaders,
      );
    }

    return handleProxy(request, env, corsHeaders);
  },
};
