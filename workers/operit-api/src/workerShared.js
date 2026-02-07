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
const MAX_LEADERBOARD_LIMIT = 50;
const MAX_SUBMISSION_ASSET_COUNT = 40;
const MAX_SUBMISSION_ASSET_SIZE = 10 * 1024 * 1024;

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_REPO_CONTENT_PREFIX = 'public/';
const DEFAULT_GITHUB_ASSET_PREFIX = 'public/manuals/assets/submissions';
const DEFAULT_SUBMISSION_ASSET_TMP_PREFIX = 'tmp/submissions';
const DEFAULT_SUBMISSION_ASSET_TTL_HOURS = 72;
const SUBMISSION_ASSET_ID_RE = /^[a-z0-9][a-z0-9_-]{7,63}$/i;
const ADMIN_USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const ADMIN_ROLES = new Set(['admin', 'reviewer']);
const ADMIN_PASSWORD_MIN_LENGTH = 8;
const DEFAULT_ADMIN_SESSION_HOURS = 24 * 7;

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Operit-Admin-Token, X-Operit-Owner-Token',
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

function normalizePrefix(value) {
  return normalizePath(value).replace(/\/+$/, '');
}

function joinPath(...parts) {
  return parts
    .map(part => normalizePath(part))
    .filter(Boolean)
    .join('/');
}

function stripMarkdownSuffix(value) {
  const normalized = normalizePath(value);
  if (normalized.toLowerCase().endsWith('.md')) {
    return normalized.slice(0, -3);
  }
  return normalized;
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
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

function base64EncodeUtf8(value) {
  const bytes = new TextEncoder().encode(value);
  return base64FromBytes(bytes);
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

async function hashIp(ip, salt) {
  if (!ip) return '';
  const base = salt ? `${salt}:${ip}` : ip;
  return sha256Hex(base);
}

async function getIpBan(ipHash, env) {
  if (!ipHash || !env.OPERIT_SUBMISSION_DB) return null;
  const now = new Date().toISOString();
  const row = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT ip_hash, reason, notes, created_at, expires_at, banned_by FROM ip_bans WHERE ip_hash = ? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1',
  ).bind(ipHash, now).first();
  return row || null;
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
export {
  DEFAULT_ALLOWED_ORIGINS,
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_LOOKUP_IDS,
  MAX_LEADERBOARD_LIMIT,
  MAX_SUBMISSION_ASSET_COUNT,
  MAX_SUBMISSION_ASSET_SIZE,
  GITHUB_API_BASE,
  DEFAULT_REPO_CONTENT_PREFIX,
  DEFAULT_GITHUB_ASSET_PREFIX,
  DEFAULT_SUBMISSION_ASSET_TMP_PREFIX,
  DEFAULT_SUBMISSION_ASSET_TTL_HOURS,
  SUBMISSION_ASSET_ID_RE,
  ADMIN_USERNAME_RE,
  ADMIN_ROLES,
  ADMIN_PASSWORD_MIN_LENGTH,
  DEFAULT_ADMIN_SESSION_HOURS,
  ALLOWED_LANGUAGES,
  ALLOWED_PATH_RE,
  json,
  parseAllowedOrigins,
  buildCorsHeaders,
  normalizePath,
  normalizePrefix,
  joinPath,
  stripMarkdownSuffix,
  parseCsv,
  parseBoolean,
  clampInt,
  readJson,
  getClientIp,
  sha256Hex,
  base64FromBytes,
  base64UrlFromBytes,
  base64UrlFromString,
  base64EncodeUtf8,
  normalizePem,
  pemToArrayBuffer,
  hashIp,
  getIpBan,
  validateSubmission,
  normalizeIdList,
  validateLookup,
};