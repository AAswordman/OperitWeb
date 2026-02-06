const DEFAULT_ALLOWED_ORIGINS = [
  'https://operit.aaswordsman.org',
  'https://www.aaswordsman.org',
  'http://localhost:5173',
];

const MAX_CONTENT_LENGTH = 200000;
const MAX_TITLE_LENGTH = 120;
const MAX_NAME_LENGTH = 60;
const MAX_EMAIL_LENGTH = 120;
const MAX_LOOKUP_IDS = 50;

const ALLOWED_LANGUAGES = new Set(['zh', 'en']);
const ALLOWED_PATH_RE = /^content\/(zh|en)\/[a-z0-9/_-]+\.md$/i;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function parseAllowedOrigins(env) {
  const raw = (env.OPERIT_ALLOWED_ORIGINS || '').trim();
  if (!raw) return new Set(DEFAULT_ALLOWED_ORIGINS);
  return new Set(raw.split(',').map(v => v.trim()).filter(Boolean));
}

function buildCorsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Operit-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }

  return headers;
}

function normalizePath(value) {
  return String(value || '').trim().replace(/^\/+/, '');
}

function clampInt(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

async function readJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch (err) {
    return { ok: false, error: 'invalid_json' };
  }
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashIp(ip, salt) {
  if (!ip) return '';
  const base = salt ? `${salt}:${ip}` : ip;
  return sha256Hex(base);
}

function validateSubmission(body) {
  const errors = [];

  const type = String(body.type || '').trim().toLowerCase();
  if (!['edit', 'add'].includes(type)) {
    errors.push('type must be edit or add');
  }

  const language = String(body.language || '').trim().toLowerCase();
  if (!ALLOWED_LANGUAGES.has(language)) {
    errors.push('language must be zh or en');
  }

  const targetPath = normalizePath(body.target_path || body.targetPath);
  if (!targetPath) {
    errors.push('target_path is required');
  } else if (!ALLOWED_PATH_RE.test(targetPath)) {
    errors.push('target_path must be under content/zh or content/en and end with .md');
  } else if (language && !targetPath.startsWith(`content/${language}/`)) {
    errors.push('target_path must match language');
  }

  const title = String(body.title || '').trim();
  if (title.length < 2 || title.length > MAX_TITLE_LENGTH) {
    errors.push('title length must be 2-120');
  }

  const content = String(body.content || '').trim();
  if (content.length < 20) {
    errors.push('content is too short');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    errors.push('content is too long');
  }

  const authorName = String(body.author_name || body.authorName || '').trim();
  if (authorName && authorName.length > MAX_NAME_LENGTH) {
    errors.push('author_name is too long');
  }

  const authorEmail = String(body.author_email || body.authorEmail || '').trim();
  if (authorEmail) {
    if (authorEmail.length > MAX_EMAIL_LENGTH) {
      errors.push('author_email is too long');
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(authorEmail)) {
      errors.push('author_email is invalid');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      type,
      language,
      targetPath,
      title,
      content,
      authorName,
      authorEmail,
    },
  };
}

function normalizeIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function validateLookup(body) {
  const errors = [];
  const authorName = String(body.author_name || body.authorName || '').trim();
  const authorEmail = String(body.author_email || body.authorEmail || '').trim();
  const submissionIds = normalizeIdList(body.submission_ids || body.submissionIds);

  if (!authorName && !authorEmail && submissionIds.length === 0) {
    errors.push('author_name, author_email, or submission_ids is required');
  }

  if (authorName && authorName.length > MAX_NAME_LENGTH) {
    errors.push('author_name is too long');
  }

  if (authorEmail) {
    if (authorEmail.length > MAX_EMAIL_LENGTH) {
      errors.push('author_email is too long');
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(authorEmail)) {
      errors.push('author_email is invalid');
    }
  }

  if (submissionIds.length > MAX_LOOKUP_IDS) {
    errors.push('submission_ids is too long');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      authorName,
      authorEmail,
      submissionIds,
    },
  };
}

async function verifyTurnstile(token, ip, env) {
  const secret = env.OPERIT_TURNSTILE_SECRET;
  if (!secret) {
    return { success: false, error: 'turnstile_not_configured' };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token || '');
  if (ip) formData.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    return { success: false, error: 'turnstile_request_failed' };
  }

  const data = await res.json();
  return data;
}

function requireAdmin(request, env) {
  const expected = (env.OPERIT_ADMIN_TOKEN || '').trim();
  if (!expected) {
    return { ok: false, status: 501, error: 'admin_token_not_configured' };
  }

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const alt = request.headers.get('x-operit-admin-token') || '';
  const token = bearer || alt;

  if (token !== expected) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  return { ok: true };
}

async function handleSubmit(request, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const validation = validateSubmission(bodyResult.value || {});
  if (!validation.ok) {
    return json({ error: 'validation_failed', details: validation.errors }, 400, corsHeaders);
  }

  const turnstileToken = bodyResult.value.turnstile_token || bodyResult.value.turnstileToken;
  const ip = getClientIp(request);
  const turnstile = await verifyTurnstile(turnstileToken, ip, env);
  if (!turnstile.success) {
    return json({ error: 'turnstile_failed', details: turnstile['error-codes'] || [] }, 403, corsHeaders);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ipHash = await hashIp(ip, env.OPERIT_IP_SALT);
  const userAgent = request.headers.get('user-agent') || '';

  const stmt = env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO submissions (id, type, language, target_path, title, content, status, author_name, author_email, client_ip_hash, user_agent, turnstile_ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    validation.value.type,
    validation.value.language,
    validation.value.targetPath,
    validation.value.title,
    validation.value.content,
    'pending',
    validation.value.authorName || null,
    validation.value.authorEmail || null,
    ipHash || null,
    userAgent || null,
    1,
    now,
  );

  await stmt.run();

  return json({ ok: true, id, status: 'pending', created_at: now }, 201, corsHeaders);
}

async function handleAdminSubmit(request, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const validation = validateSubmission(bodyResult.value || {});
  if (!validation.ok) {
    return json({ error: 'validation_failed', details: validation.errors }, 400, corsHeaders);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.OPERIT_IP_SALT);
  const userAgent = request.headers.get('user-agent') || '';

  const stmt = env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO submissions (id, type, language, target_path, title, content, status, author_name, author_email, client_ip_hash, user_agent, turnstile_ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    validation.value.type,
    validation.value.language,
    validation.value.targetPath,
    validation.value.title,
    validation.value.content,
    'pending',
    validation.value.authorName || null,
    validation.value.authorEmail || null,
    ipHash || null,
    userAgent || null,
    0,
    now,
  );

  await stmt.run();

  return json({ ok: true, id, status: 'pending', created_at: now }, 201, corsHeaders);
}

async function handleAdminList(url, env, corsHeaders) {
  const status = (url.searchParams.get('status') || '').trim();
  const limit = clampInt(url.searchParams.get('limit'), 1, 200, 50);
  const offset = clampInt(url.searchParams.get('offset'), 0, 10000, 0);

  let query = 'SELECT id, type, language, target_path, title, status, author_name, author_email, created_at, reviewed_at, reviewer, review_notes FROM submissions';
  const bindings = [];

  if (status) {
    query += ' WHERE status = ?';
    bindings.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(...bindings).all();
  return json({ ok: true, items: results || [], limit, offset }, 200, corsHeaders);
}

async function handleAdminGet(id, env, corsHeaders) {
  const row = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT id, type, language, target_path, title, content, status, author_name, author_email, created_at, reviewed_at, reviewer, review_notes FROM submissions WHERE id = ? LIMIT 1',
  ).bind(id).first();

  if (!row) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  return json({ ok: true, item: row }, 200, corsHeaders);
}

async function handleAdminUpdateStatus(id, request, env, corsHeaders, status) {
  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const reviewer = String(bodyResult.value.reviewer || '').trim() || null;
  const reviewNotes = String(bodyResult.value.review_notes || bodyResult.value.reviewNotes || '').trim() || null;
  const now = new Date().toISOString();

  const stmt = env.OPERIT_SUBMISSION_DB.prepare(
    'UPDATE submissions SET status = ?, reviewed_at = ?, reviewer = ?, review_notes = ? WHERE id = ?',
  ).bind(status, now, reviewer, reviewNotes, id);

  const result = await stmt.run();
  if (result.meta && result.meta.changes === 0) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  return json({ ok: true, id, status, reviewed_at: now }, 200, corsHeaders);
}

async function handlePublicLookup(request, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const validation = validateLookup(bodyResult.value || {});
  if (!validation.ok) {
    return json({ error: 'validation_failed', details: validation.errors }, 400, corsHeaders);
  }

  const turnstileToken = bodyResult.value.turnstile_token || bodyResult.value.turnstileToken;
  const ip = getClientIp(request);
  const turnstile = await verifyTurnstile(turnstileToken, ip, env);
  if (!turnstile.success) {
    return json({ error: 'turnstile_failed', details: turnstile['error-codes'] || [] }, 403, corsHeaders);
  }

  let query = 'SELECT id, title, target_path, language, status, created_at, reviewed_at FROM submissions WHERE ';
  const bindings = [];
  const { authorName, authorEmail, submissionIds } = validation.value;

  if (submissionIds.length > 0) {
    query += `id IN (${submissionIds.map(() => '?').join(',')})`;
    bindings.push(...submissionIds);
  } else if (authorName && authorEmail) {
    query += 'author_name = ? AND author_email = ?';
    bindings.push(authorName, authorEmail);
  } else if (authorName) {
    query += 'author_name = ?';
    bindings.push(authorName);
  } else if (authorEmail) {
    query += 'author_email = ?';
    bindings.push(authorEmail);
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(...bindings).all();
  const items = results || [];

  const counts = { total: items.length, pending: 0, approved: 0, rejected: 0 };
  let lastReviewedAt = null;
  for (const item of items) {
    if (item.status === 'pending') counts.pending += 1;
    if (item.status === 'approved') counts.approved += 1;
    if (item.status === 'rejected') counts.rejected += 1;
    if (item.reviewed_at) {
      if (!lastReviewedAt || item.reviewed_at > lastReviewedAt) {
        lastReviewedAt = item.reviewed_at;
      }
    }
  }

  return json({
    ok: true,
    items,
    counts,
    last_reviewed_at: lastReviewedAt,
  }, 200, corsHeaders);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = parseAllowedOrigins(env);
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'operit-api' }, 200, corsHeaders);
    }

    if (url.pathname === '/api/config' && request.method === 'GET') {
      return json({
        ok: true,
        turnstile_site_key: env.OPERIT_TURNSTILE_SITE_KEY || null,
      }, 200, corsHeaders);
    }

    if (url.pathname === '/api/submissions' && request.method === 'POST') {
      return handleSubmit(request, env, corsHeaders);
    }

    if (url.pathname === '/api/submissions/lookup' && request.method === 'POST') {
      return handlePublicLookup(request, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/admin/')) {
      const auth = requireAdmin(request, env);
      if (!auth.ok) {
        return json({ error: auth.error }, auth.status, corsHeaders);
      }

      if (!env.OPERIT_SUBMISSION_DB) {
        return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
      }

      const parts = url.pathname.split('/').filter(Boolean); // ['api','admin','submissions', ...]

      if (parts.length >= 3 && parts[2] === 'submissions') {
        if (parts.length === 3 && request.method === 'GET') {
          return handleAdminList(url, env, corsHeaders);
        }

        if (parts.length === 3 && request.method === 'POST') {
          return handleAdminSubmit(request, env, corsHeaders);
        }

        if (parts.length === 4 && request.method === 'GET') {
          return handleAdminGet(parts[3], env, corsHeaders);
        }

        if (parts.length === 5 && request.method === 'POST') {
          const id = parts[3];
          const action = parts[4];
          if (action === 'approve') {
            return handleAdminUpdateStatus(id, request, env, corsHeaders, 'approved');
          }
          if (action === 'reject') {
            return handleAdminUpdateStatus(id, request, env, corsHeaders, 'rejected');
          }
        }
      }
    }

    return json({ error: 'not_found' }, 404, corsHeaders);
  },
};
