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

let githubTokenCache = {
  token: '',
  expiresAt: 0,
};

function getGitHubConfig(env) {
  const owner = String(env.OPERIT_GITHUB_OWNER || '').trim();
  const repo = String(env.OPERIT_GITHUB_REPO || '').trim();
  const defaultBranch = String(env.OPERIT_GITHUB_DEFAULT_BRANCH || 'main').trim();
  const contentPrefixRaw = (env.OPERIT_REPO_CONTENT_PREFIX || DEFAULT_REPO_CONTENT_PREFIX).trim();
  const contentPrefix = normalizePrefix(contentPrefixRaw);
  const assetPrefixRaw = (env.OPERIT_GITHUB_ASSET_PREFIX || DEFAULT_GITHUB_ASSET_PREFIX).trim();
  const assetPrefix = normalizePrefix(assetPrefixRaw);
  const labels = parseCsv(env.OPERIT_GITHUB_PR_LABELS);
  const reviewers = parseCsv(env.OPERIT_GITHUB_PR_REVIEWERS);
  const assignees = parseCsv(env.OPERIT_GITHUB_PR_ASSIGNEES);
  const enabled = parseBoolean(env.OPERIT_GITHUB_AUTO_PR, Boolean(owner && repo));

  return {
    enabled,
    owner,
    repo,
    defaultBranch,
    contentPrefix,
    assetPrefix,
    labels,
    reviewers,
    assignees,
  };
}

function resolveRepoPath(targetPath, env) {
  const normalizedTarget = normalizePath(targetPath);
  const prefix = getGitHubConfig(env).contentPrefix;
  if (!prefix) return normalizedTarget;
  if (normalizedTarget === prefix || normalizedTarget.startsWith(`${prefix}/`)) {
    return normalizedTarget;
  }
  return `${prefix}/${normalizedTarget}`;
}

function getSubmissionAssetConfig(env) {
  const bucket = String(env.OPERIT_SUBMISSION_ASSET_BUCKET || '').trim();
  const publicBase = String(env.OPERIT_SUBMISSION_ASSET_PUBLIC_BASE || '').trim().replace(/\/+$/, '');
  const tmpPrefix = normalizePrefix(env.OPERIT_SUBMISSION_ASSET_TMP_PREFIX || DEFAULT_SUBMISSION_ASSET_TMP_PREFIX);
  const ttlHours = clampInt(
    env.OPERIT_SUBMISSION_ASSET_TTL_HOURS,
    1,
    24 * 14,
    DEFAULT_SUBMISSION_ASSET_TTL_HOURS,
  );
  return {
    bucket,
    publicBase,
    tmpPrefix,
    ttlMs: ttlHours * 60 * 60 * 1000,
  };
}

function sanitizeAssetFileName(name, fallback = 'image') {
  const normalized = String(name || '')
    .trim()
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return (normalized || fallback).slice(0, 120);
}

function normalizeContentType(value) {
  const source = String(value || '').trim().toLowerCase();
  if (!source) return 'application/octet-stream';
  if (source.includes(';')) return source.split(';')[0].trim() || 'application/octet-stream';
  return source;
}

function extensionFromContentType(contentType) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[normalizeContentType(contentType)] || '';
}

function inferAssetExtension(name, contentType) {
  const sanitized = sanitizeAssetFileName(name || '');
  const idx = sanitized.lastIndexOf('.');
  if (idx > 0 && idx < sanitized.length - 1) {
    const ext = sanitized.slice(idx + 1).toLowerCase();
    if (/^[a-z0-9]{2,8}$/.test(ext)) return ext;
  }
  return extensionFromContentType(contentType) || 'bin';
}

async function sha256HexFromArrayBuffer(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildAssetTmpKey(submissionId, assetId, fileName, contentType, env) {
  const cfg = getSubmissionAssetConfig(env);
  const ext = inferAssetExtension(fileName, contentType);
  const safeName = sanitizeAssetFileName(fileName || `image.${ext || 'bin'}`);
  return joinPath(cfg.tmpPrefix, submissionId, `${assetId}-${safeName}`);
}

function extractSubmissionAssetIds(content) {
  const source = String(content || '');
  const regex = /operit-temp:\/\/([a-z0-9][a-z0-9_-]{7,63})/gi;
  const ids = new Set();
  let match = regex.exec(source);
  while (match) {
    const id = String(match[1] || '').trim();
    if (SUBMISSION_ASSET_ID_RE.test(id)) {
      ids.add(id);
    }
    match = regex.exec(source);
  }
  return Array.from(ids);
}

function ensureSubmissionAssetBucket(env) {
  const bucket = env.OPERIT_SUBMISSION_ASSET_BUCKET;
  if (!bucket) {
    throw new Error('asset_bucket_missing');
  }
  return bucket;
}

async function fetchSubmissionAssetsByIds(env, submissionId, assetIds) {
  if (!env.OPERIT_SUBMISSION_DB || !assetIds.length) return [];
  const placeholders = assetIds.map(() => '?').join(',');
  const query =
    `SELECT id, submission_id, file_name, content_type, size, sha256, tmp_key, temp_url, repo_path, public_path, status, created_at, uploaded_at, migrated_at, deleted_at ` +
    `FROM submission_assets WHERE submission_id = ? AND id IN (${placeholders})`;
  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(submissionId, ...assetIds).all();
  return results || [];
}

async function markSubmissionAssetsDeleted(env, submissionId, assetIds, deletedAt) {
  if (!env.OPERIT_SUBMISSION_DB || !assetIds.length) return;
  const placeholders = assetIds.map(() => '?').join(',');
  const query = `UPDATE submission_assets SET status = 'deleted', deleted_at = ? WHERE submission_id = ? AND id IN (${placeholders})`;
  await env.OPERIT_SUBMISSION_DB.prepare(query).bind(deletedAt, submissionId, ...assetIds).run();
}

function buildSubmissionAssetPublicUrl(key, env) {
  const cfg = getSubmissionAssetConfig(env);
  if (!cfg.publicBase) return '';
  return `${cfg.publicBase}/${normalizePath(key)}`;
}

async function importPrivateKey(pem) {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
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
    new TextEncoder().encode(data),
  );
  return `${data}.${base64UrlFromBytes(new Uint8Array(signature))}`;
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
      'User-Agent': 'operit-bot',
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || response.statusText || 'github_app_token_failed';
    throw new Error(message);
  }

  const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : now + 30 * 60_000;
  githubTokenCache = {
    token: data.token || '',
    expiresAt,
  };

  return { token: githubTokenCache.token, source: 'app' };
}

async function githubRequest(path, options, token, allowStatuses = []) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'operit-bot',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok && !allowStatuses.includes(response.status)) {
    const message = data?.message || response.statusText || 'github_request_failed';
    throw new Error(message);
  }
  return { response, data };
}

function encodeRepoPath(path) {
  return path
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}

async function ensureBranch({ owner, repo, baseBranch, branch, token }) {
  const baseRef = await githubRequest(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    { method: 'GET' },
    token,
  );
  const baseSha = baseRef?.data?.object?.sha;
  if (!baseSha) {
    throw new Error('github_base_ref_missing');
  }

  const createRef = await githubRequest(
    `/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    },
    token,
    [422],
  );

  if (!createRef.response.ok && createRef.response.status !== 422) {
    throw new Error('github_branch_create_failed');
  }

  return baseSha;
}

async function getFileSha({ owner, repo, path, ref, token }) {
  const encodedPath = encodeRepoPath(path);
  const result = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    { method: 'GET' },
    token,
    [404],
  );
  if (result.response.status === 404) {
    return null;
  }
  return result?.data?.sha || null;
}

async function putFile({ owner, repo, path, branch, message, content, sha, token }) {
  const encodedPath = encodeRepoPath(path);
  const body = {
    message,
    content: base64EncodeUtf8(content),
    branch,
  };
  if (sha) body.sha = sha;
  await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token,
  );
}

async function putBinaryFile({ owner, repo, path, branch, message, bytes, sha, token, contentType }) {
  const encodedPath = encodeRepoPath(path);
  const payloadBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const body = {
    message,
    content: base64FromBytes(payloadBytes),
    branch,
  };
  if (sha) body.sha = sha;
  if (contentType) body['content_type'] = normalizeContentType(contentType);
  await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token,
  );
}

function toPublicAssetPath(repoPath) {
  const normalized = normalizePath(repoPath);
  if (!normalized) return '/';
  if (normalized.startsWith('public/')) {
    return `/${normalized.slice('public/'.length)}`;
  }
  return `/${normalized}`;
}

async function migrateSubmissionAssetsForPr(submission, env, githubContext) {
  const assetIds = extractSubmissionAssetIds(submission.content || '');
  if (!assetIds.length) {
    return {
      content: submission.content || '',
      assetIds: [],
      cleanupKeys: [],
      usedPublicPaths: [],
    };
  }

  const bucket = ensureSubmissionAssetBucket(env);
  const rows = await fetchSubmissionAssetsByIds(env, submission.id, assetIds);
  const byId = new Map(rows.map(row => [row.id, row]));

  const missing = assetIds.filter(id => !byId.has(id));
  if (missing.length) {
    throw new Error(`submission_asset_missing:${missing.join(',')}`);
  }

  const now = new Date().toISOString();
  let nextContent = String(submission.content || '');
  const cleanupKeys = [];
  const usedPublicPaths = [];

  for (const assetId of assetIds) {
    const row = byId.get(assetId);
    if (!row) continue;
    if (row.submission_id && row.submission_id !== submission.id) {
      throw new Error(`submission_asset_mismatch:${assetId}`);
    }

    let repoPath = normalizePath(row.repo_path || '');
    let publicPath = String(row.public_path || '').trim();

    if (row.status !== 'migrated' || !repoPath || !publicPath) {
      if (!row.tmp_key) {
        throw new Error(`submission_asset_tmp_missing:${assetId}`);
      }
      const object = await bucket.get(row.tmp_key);
      if (!object) {
        throw new Error(`submission_asset_object_missing:${assetId}`);
      }

      const bytes = new Uint8Array(await object.arrayBuffer());
      const fileName = sanitizeAssetFileName(row.file_name || 'image');
      const ext = inferAssetExtension(fileName, row.content_type);
      const hasExt = fileName.toLowerCase().endsWith(`.${ext}`);
      const outputName = hasExt ? `${assetId}-${fileName}` : `${assetId}-${fileName}.${ext}`;
      const assetPrefix = getGitHubConfig(env).assetPrefix;
      if (!assetPrefix) {
        throw new Error('github_asset_prefix_missing');
      }

      repoPath = joinPath(assetPrefix, submission.id, outputName);
      publicPath = toPublicAssetPath(repoPath);

      await putBinaryFile({
        owner: githubContext.owner,
        repo: githubContext.repo,
        path: repoPath,
        branch: githubContext.branch,
        message: `docs: add submission asset ${assetId}`,
        bytes,
        sha: undefined,
        token: githubContext.token,
        contentType: row.content_type,
      });

      await env.OPERIT_SUBMISSION_DB.prepare(
        'UPDATE submission_assets SET status = ?, repo_path = ?, public_path = ?, migrated_at = ? WHERE id = ? AND submission_id = ?',
      ).bind('migrated', repoPath, publicPath, now, assetId, submission.id).run();
      cleanupKeys.push(row.tmp_key);
    }

    nextContent = nextContent
      .split(`operit-temp://${assetId}`)
      .join(publicPath)
      .split(String(row.temp_url || ''))
      .join(publicPath);
    usedPublicPaths.push(publicPath);
  }

  return {
    content: nextContent,
    assetIds,
    cleanupKeys,
    usedPublicPaths,
  };
}

async function cleanupSubmissionTempAssets(env, submissionId, assetIds, keys) {
  if (!assetIds.length && !keys.length) return;
  let bucket = null;
  try {
    bucket = ensureSubmissionAssetBucket(env);
  } catch {
    return;
  }
  const deletedAt = new Date().toISOString();
  for (const key of keys) {
    if (!key) continue;
    try {
      await bucket.delete(key);
    } catch {
      // ignore single delete errors
    }
  }
  if (assetIds.length) {
    try {
      await env.OPERIT_SUBMISSION_DB.prepare(
        `UPDATE submission_assets SET deleted_at = ? WHERE submission_id = ? AND id IN (${assetIds
          .map(() => '?')
          .join(',')})`,
      ).bind(deletedAt, submissionId, ...assetIds).run();
    } catch {
      // ignore cleanup metadata errors
    }
  }
}

function buildPrBody(submission, reviewNotes, repoPath) {
  const author = submission.author_name
    ? `${submission.author_name}${submission.author_email ? ` <${submission.author_email}>` : ''}`
    : '-';
  const lines = [
    'Automated submission from Operit review.',
    '',
    `- Submission ID: ${submission.id}`,
    `- Type: ${submission.type}`,
    `- Language: ${submission.language}`,
    `- Path: ${repoPath}`,
    `- Title: ${submission.title}`,
    `- Author: ${author}`,
    submission.reviewer ? `- Reviewer: ${submission.reviewer}` : null,
    submission.reviewed_at ? `- Reviewed at: ${submission.reviewed_at}` : null,
    submission.created_at ? `- Submitted at: ${submission.created_at}` : null,
    reviewNotes ? `- Review notes: ${reviewNotes}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

async function createPullRequest({ owner, repo, baseBranch, branch, title, body, token }) {
  const create = await githubRequest(
    `/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        head: branch,
        base: baseBranch,
        body,
      }),
    },
    token,
    [422],
  );

  if (create.response.status === 422) {
    const existing = await githubRequest(
      `/repos/${owner}/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}`,
      { method: 'GET' },
      token,
    );
    const pr = Array.isArray(existing.data) ? existing.data[0] : null;
    if (pr) return pr;
  }

  return create.data;
}

async function addLabels({ owner, repo, prNumber, labels, token }) {
  if (!labels.length) return;
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${prNumber}/labels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels }),
    },
    token,
  );
}

async function requestReviewers({ owner, repo, prNumber, reviewers, token }) {
  if (!reviewers.length) return;
  await githubRequest(
    `/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewers }),
    },
    token,
  );
}

async function addAssignees({ owner, repo, prNumber, assignees, token }) {
  if (!assignees.length) return;
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${prNumber}/assignees`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignees }),
    },
    token,
  );
}

async function createSubmissionPullRequest(submission, reviewNotes, env) {
  const config = getGitHubConfig(env);
  if (!config.enabled) {
    return { status: 'skipped', reason: 'disabled' };
  }
  if (!config.owner || !config.repo) {
    return { status: 'skipped', reason: 'repo_not_configured' };
  }

  if (submission.pr_number || submission.pr_url) {
    return {
      status: 'created',
      number: submission.pr_number || null,
      url: submission.pr_url || null,
      branch: submission.pr_branch || null,
      created_at: submission.pr_created_at || null,
    };
  }

  const auth = await getGitHubToken(env);
  if (!auth?.token) {
    return { status: 'skipped', reason: 'auth_not_configured' };
  }

  const repoPath = resolveRepoPath(submission.target_path, env);
  const branch = `operit/submission/${submission.id}`;
  const baseBranch = config.defaultBranch || 'main';
  const token = auth.token;

  await ensureBranch({
    owner: config.owner,
    repo: config.repo,
    baseBranch,
    branch,
    token,
  });

  const fileSha = await getFileSha({
    owner: config.owner,
    repo: config.repo,
    path: repoPath,
    ref: baseBranch,
    token,
  });

  if (submission.type === 'add' && fileSha) {
    throw new Error('target_exists_for_add');
  }

  const migration = await migrateSubmissionAssetsForPr(
    submission,
    env,
    {
      owner: config.owner,
      repo: config.repo,
      branch,
      token,
    },
  );

  const commitMessage = `docs: ${submission.title} (${submission.id})`;
  await putFile({
    owner: config.owner,
    repo: config.repo,
    path: repoPath,
    branch,
    message: commitMessage,
    content: migration.content || '',
    sha: submission.type === 'edit' ? fileSha : fileSha || undefined,
    token,
  });

  if (migration.content !== (submission.content || '')) {
    try {
      await env.OPERIT_SUBMISSION_DB.prepare(
        'UPDATE submissions SET content = ? WHERE id = ?',
      ).bind(migration.content, submission.id).run();
    } catch {
      // ignore content sync failures
    }
  }

  const prTitle = `docs: ${submission.title}`;
  const prBody = buildPrBody(submission, reviewNotes, repoPath);
  const pr = await createPullRequest({
    owner: config.owner,
    repo: config.repo,
    baseBranch,
    branch,
    title: prTitle,
    body: prBody,
    token,
  });

  const prNumber = pr?.number;
  if (prNumber) {
    try {
      await addLabels({ owner: config.owner, repo: config.repo, prNumber, labels: config.labels, token });
    } catch {
      // ignore label errors
    }
    try {
      await requestReviewers({ owner: config.owner, repo: config.repo, prNumber, reviewers: config.reviewers, token });
    } catch {
      // ignore reviewer errors
    }
    try {
      await addAssignees({ owner: config.owner, repo: config.repo, prNumber, assignees: config.assignees, token });
    } catch {
      // ignore assignee errors
    }
  }

  const result = {
    status: 'created',
    number: pr?.number || null,
    url: pr?.html_url || null,
    branch,
    created_at: pr?.created_at || new Date().toISOString(),
    migrated_assets: migration.assetIds.length,
  };

  await cleanupSubmissionTempAssets(env, submission.id, migration.assetIds, migration.cleanupKeys);

  return result;
}

async function persistPrInfo(env, id, info) {
  if (!env.OPERIT_SUBMISSION_DB || !info) return;
  const stmt = env.OPERIT_SUBMISSION_DB.prepare(
    'UPDATE submissions SET pr_state = ?, pr_number = ?, pr_url = ?, pr_branch = ?, pr_created_at = ?, pr_error = ? WHERE id = ?',
  ).bind(
    info.status || null,
    info.number || null,
    info.url || null,
    info.branch || null,
    info.created_at || null,
    info.error || null,
    id,
  );
  await stmt.run();
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

function extractLocalSubmissionAssetIds(content) {
  const source = String(content || '');
  const regex = /operit-local:\/\/([a-z0-9][a-z0-9_-]{7,63})/gi;
  const ids = new Set();
  let match = regex.exec(source);
  while (match) {
    const id = String(match[1] || '').trim();
    if (SUBMISSION_ASSET_ID_RE.test(id)) {
      ids.add(id);
    }
    match = regex.exec(source);
  }
  return Array.from(ids);
}

function parseSubmissionAssetManifest(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return [];
  }
  let parsed = null;
  if (typeof rawValue === 'string') {
    parsed = JSON.parse(rawValue);
  } else {
    parsed = rawValue;
  }
  if (!Array.isArray(parsed)) {
    throw new Error('submission_assets_manifest_invalid');
  }
  const items = [];
  for (const item of parsed) {
    const id = String(item?.id || '').trim();
    if (!SUBMISSION_ASSET_ID_RE.test(id)) {
      throw new Error('submission_asset_id_invalid');
    }
    const name = sanitizeAssetFileName(item?.name || 'image');
    const type = normalizeContentType(item?.type || 'application/octet-stream');
    const size = Number.parseInt(String(item?.size || 0), 10);
    const sha256 = String(item?.sha256 || '').trim().toLowerCase();
    items.push({
      id,
      name,
      type,
      size: Number.isFinite(size) && size > 0 ? size : 0,
      sha256,
    });
  }
  return items;
}

async function readSubmissionRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      const payloadRaw = form.get('payload');
      if (typeof payloadRaw !== 'string' || !payloadRaw.trim()) {
        return { ok: false, error: 'payload_required' };
      }
      const payload = JSON.parse(payloadRaw);
      let assetsManifest = [];
      const manifestRaw = form.get('assets_manifest');
      if (manifestRaw !== null) {
        if (typeof manifestRaw !== 'string') {
          return { ok: false, error: 'submission_assets_manifest_invalid' };
        }
        assetsManifest = parseSubmissionAssetManifest(manifestRaw);
      }
      return {
        ok: true,
        value: payload,
        formData: form,
        assetsManifest,
      };
    } catch {
      return { ok: false, error: 'invalid_multipart_payload' };
    }
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return { ok: false, error: bodyResult.error || 'invalid_json' };
  }
  return {
    ok: true,
    value: bodyResult.value,
    formData: null,
    assetsManifest: [],
  };
}

async function processSubmissionAssets({
  env,
  submissionId,
  content,
  formData,
  assetsManifest,
}) {
  const assetIds = extractLocalSubmissionAssetIds(content);
  if (!assetIds.length) {
    return {
      content,
      uploaded: [],
    };
  }

  if (!formData) {
    throw new Error('submission_assets_missing_form_data');
  }
  if (assetIds.length > MAX_SUBMISSION_ASSET_COUNT) {
    throw new Error('submission_assets_too_many');
  }

  const bucket = ensureSubmissionAssetBucket(env);
  const manifestById = new Map(assetsManifest.map(item => [item.id, item]));
  const uploaded = [];
  let nextContent = content;

  try {
    for (const assetId of assetIds) {
      const manifest = manifestById.get(assetId);
      const fileEntry = formData.get(`asset_${assetId}`);
      if (!(fileEntry instanceof File)) {
        throw new Error(`submission_asset_file_missing:${assetId}`);
      }
      if (fileEntry.size <= 0 || fileEntry.size > MAX_SUBMISSION_ASSET_SIZE) {
        throw new Error(`submission_asset_size_invalid:${assetId}`);
      }
      if (manifest?.size && manifest.size !== fileEntry.size) {
        throw new Error(`submission_asset_size_mismatch:${assetId}`);
      }

      const contentType = normalizeContentType(fileEntry.type || manifest?.type || 'application/octet-stream');
      if (!contentType.startsWith('image/')) {
        throw new Error(`submission_asset_content_type_invalid:${assetId}`);
      }

      const fileName = sanitizeAssetFileName(manifest?.name || fileEntry.name || `image-${assetId}`);
      const bytes = new Uint8Array(await fileEntry.arrayBuffer());
      const sha256 = await sha256HexFromArrayBuffer(bytes);
      if (manifest?.sha256 && manifest.sha256 !== sha256) {
        throw new Error(`submission_asset_sha256_mismatch:${assetId}`);
      }

      const tmpKey = buildAssetTmpKey(submissionId, assetId, fileName, contentType, env);
      await bucket.put(tmpKey, bytes, {
        httpMetadata: {
          contentType,
        },
        customMetadata: {
          submission_id: submissionId,
          asset_id: assetId,
          sha256,
        },
      });

      const now = new Date().toISOString();
      const tempUrl = buildSubmissionAssetPublicUrl(tmpKey, env) || `operit-temp://${assetId}`;

      await env.OPERIT_SUBMISSION_DB.prepare(
        'INSERT INTO submission_assets (submission_id, id, file_name, content_type, size, sha256, tmp_key, temp_url, status, created_at, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(submission_id, id) DO UPDATE SET file_name = excluded.file_name, content_type = excluded.content_type, size = excluded.size, sha256 = excluded.sha256, tmp_key = excluded.tmp_key, temp_url = excluded.temp_url, status = excluded.status, uploaded_at = excluded.uploaded_at, repo_path = NULL, public_path = NULL, migrated_at = NULL, deleted_at = NULL',
      ).bind(
        submissionId,
        assetId,
        fileName,
        contentType,
        bytes.byteLength,
        sha256,
        tmpKey,
        tempUrl,
        'uploaded',
        now,
        now,
      ).run();

      nextContent = nextContent.split(`operit-local://${assetId}`).join(tempUrl);
      uploaded.push({ id: assetId, tmpKey, tempUrl });
    }
  } catch (err) {
    const deletedAt = new Date().toISOString();
    for (const item of uploaded) {
      try {
        await bucket.delete(item.tmpKey);
      } catch {
        // ignore partial cleanup failure
      }
    }
    if (uploaded.length) {
      await markSubmissionAssetsDeleted(env, submissionId, uploaded.map(item => item.id), deletedAt);
    }
    throw err;
  }

  return {
    content: nextContent,
    uploaded,
  };
}

function getOwnerToken(env) {
  const owner = String(env.OPERIT_OWNER_TOKEN || '').trim();
  if (owner) return owner;
  return String(env.OPERIT_ADMIN_TOKEN || '').trim();
}

function readBearerToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function getHeaderToken(request, headerName) {
  return String(request.headers.get(headerName) || '').trim();
}

function getCredentialSalt(env) {
  const fromEnv = String(env.OPERIT_ADMIN_AUTH_SALT || '').trim();
  if (fromEnv) return fromEnv;
  const ipSalt = String(env.OPERIT_IP_SALT || '').trim();
  if (ipSalt) return ipSalt;
  return 'operit-admin-default-salt';
}

async function hashAdminCredential(raw, env) {
  const value = String(raw || '');
  const salt = getCredentialSalt(env);
  return sha256Hex(`operit-admin:${salt}:${value}`);
}

function normalizeAdminUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAdminDisplayName(value) {
  const name = String(value || '').trim();
  if (!name) return '';
  return name.slice(0, 60);
}

function normalizeAdminRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (ADMIN_ROLES.has(role)) return role;
  return '';
}

async function ensureAdminAuthSchema(env) {
  if (!env.OPERIT_SUBMISSION_DB) return;
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE TABLE IF NOT EXISTS admin_users (' +
      'username TEXT PRIMARY KEY,' +
      'display_name TEXT,' +
      'role TEXT NOT NULL,' +
      'password_hash TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'created_by TEXT,' +
      'updated_at TEXT NOT NULL,' +
      'disabled_at TEXT' +
      ')',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE TABLE IF NOT EXISTS admin_sessions (' +
      'token_hash TEXT PRIMARY KEY,' +
      'username TEXT NOT NULL,' +
      'role TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'expires_at TEXT NOT NULL,' +
      'last_seen_at TEXT' +
      ')',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_username ON admin_sessions(username)',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_admin_users_disabled ON admin_users(disabled_at)',
  ).run();
}

function getAdminSessionTtlMs(env) {
  const hours = clampInt(
    env.OPERIT_ADMIN_SESSION_HOURS,
    1,
    24 * 30,
    DEFAULT_ADMIN_SESSION_HOURS,
  );
  return hours * 60 * 60 * 1000;
}

async function createAdminSession(env, user) {
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = new Date(createdAtDate.getTime() + getAdminSessionTtlMs(env)).toISOString();
  const plainToken = `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
  const tokenHash = await hashAdminCredential(plainToken, env);
  await env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO admin_sessions (token_hash, username, role, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(
    tokenHash,
    user.username,
    user.role,
    createdAt,
    expiresAt,
    createdAt,
  ).run();
  return {
    token: plainToken,
    expires_at: expiresAt,
  };
}

async function resolveAdminSession(request, env) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return { ok: false, status: 500, error: 'd1_binding_missing' };
  }
  await ensureAdminAuthSchema(env);

  const bearer = readBearerToken(request);
  const adminHeader = getHeaderToken(request, 'x-operit-admin-token');
  const token = bearer || adminHeader;
  if (!token) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  const ownerToken = getOwnerToken(env);
  if (ownerToken && token === ownerToken) {
    return {
      ok: true,
      user: {
        username: 'owner',
        display_name: 'Owner',
        role: 'admin',
        owner: true,
      },
      token,
      owner: true,
    };
  }

  const tokenHash = await hashAdminCredential(token, env);
  const row = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT s.token_hash, s.username, s.role, s.created_at, s.expires_at, u.display_name, u.role AS user_role, u.disabled_at ' +
      'FROM admin_sessions s LEFT JOIN admin_users u ON u.username = s.username ' +
      'WHERE s.token_hash = ? LIMIT 1',
  ).bind(tokenHash).first();

  if (!row) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  const now = new Date().toISOString();
  if (!row.expires_at || row.expires_at <= now) {
    try {
      await env.OPERIT_SUBMISSION_DB.prepare(
        'DELETE FROM admin_sessions WHERE token_hash = ?',
      ).bind(tokenHash).run();
    } catch {
      // ignore cleanup failure
    }
    return { ok: false, status: 401, error: 'session_expired' };
  }

  if (row.disabled_at) {
    return { ok: false, status: 403, error: 'account_disabled' };
  }

  const role = normalizeAdminRole(row.user_role || row.role || '');
  if (!role) {
    return { ok: false, status: 403, error: 'role_invalid' };
  }

  try {
    await env.OPERIT_SUBMISSION_DB.prepare(
      'UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?',
    ).bind(now, tokenHash).run();
  } catch {
    // ignore session heartbeat failure
  }

  return {
    ok: true,
    token,
    owner: false,
    user: {
      username: String(row.username || '').trim(),
      display_name: normalizeAdminDisplayName(row.display_name || ''),
      role,
      owner: false,
    },
  };
}

async function requireOwner(request, env) {
  const expected = getOwnerToken(env);
  if (!expected) {
    return { ok: false, status: 501, error: 'owner_token_not_configured' };
  }
  const bearer = readBearerToken(request);
  const ownerHeader = getHeaderToken(request, 'x-operit-owner-token');
  const token = ownerHeader || bearer;
  if (!token || token !== expected) {
    return { ok: false, status: 401, error: 'owner_unauthorized' };
  }
  return {
    ok: true,
    user: {
      username: 'owner',
      display_name: 'Owner',
      role: 'admin',
      owner: true,
    },
  };
}

async function requireAdmin(request, env) {
  return resolveAdminSession(request, env);
}

async function handleAdminLogin(request, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }
  await ensureAdminAuthSchema(env);

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const body = bodyResult.value || {};
  const username = normalizeAdminUsername(body.username);
  const password = String(body.password || '');
  if (!ADMIN_USERNAME_RE.test(username)) {
    return json({ error: 'username_invalid' }, 400, corsHeaders);
  }
  if (!password) {
    return json({ error: 'password_required' }, 400, corsHeaders);
  }

  const row = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username, display_name, role, password_hash, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (!row || row.disabled_at) {
    return json({ error: 'invalid_credentials' }, 401, corsHeaders);
  }

  const expectedHash = String(row.password_hash || '');
  const currentHash = await hashAdminCredential(password, env);
  if (!expectedHash || expectedHash !== currentHash) {
    return json({ error: 'invalid_credentials' }, 401, corsHeaders);
  }

  const role = normalizeAdminRole(row.role || '');
  if (!role) {
    return json({ error: 'role_invalid' }, 403, corsHeaders);
  }

  const session = await createAdminSession(env, { username, role });
  return json(
    {
      ok: true,
      token: session.token,
      expires_at: session.expires_at,
      user: {
        username,
        display_name: normalizeAdminDisplayName(row.display_name || ''),
        role,
      },
    },
    200,
    corsHeaders,
  );
}

async function handleAdminMe(auth, corsHeaders) {
  return json(
    {
      ok: true,
      user: auth.user,
    },
    200,
    corsHeaders,
  );
}

async function handleAdminLogout(request, env, auth, corsHeaders) {
  if (!auth?.ok) {
    return json({ error: 'unauthorized' }, 401, corsHeaders);
  }
  if (auth.owner) {
    return json({ ok: true, owner: true }, 200, corsHeaders);
  }

  const bearer = readBearerToken(request);
  const adminHeader = getHeaderToken(request, 'x-operit-admin-token');
  const token = bearer || adminHeader;
  if (!token) {
    return json({ ok: true }, 200, corsHeaders);
  }
  const tokenHash = await hashAdminCredential(token, env);
  await env.OPERIT_SUBMISSION_DB.prepare(
    'DELETE FROM admin_sessions WHERE token_hash = ?',
  ).bind(tokenHash).run();
  return json({ ok: true }, 200, corsHeaders);
}

async function cleanupExpiredAdminSessions(env) {
  if (!env.OPERIT_SUBMISSION_DB) return;
  try {
    await env.OPERIT_SUBMISSION_DB.prepare(
      'DELETE FROM admin_sessions WHERE expires_at <= ?',
    ).bind(new Date().toISOString()).run();
  } catch {
    // ignore cleanup failures
  }
}

async function handleOwnerListUsers(env, corsHeaders) {
  await ensureAdminAuthSchema(env);
  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username, display_name, role, created_at, created_by, updated_at, disabled_at FROM admin_users ORDER BY created_at DESC',
  ).all();
  return json({ ok: true, items: results || [] }, 200, corsHeaders);
}

async function handleOwnerCreateUser(request, env, corsHeaders) {
  await ensureAdminAuthSchema(env);
  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const body = bodyResult.value || {};
  const username = normalizeAdminUsername(body.username);
  const displayName = normalizeAdminDisplayName(body.display_name || body.displayName || '');
  const role = normalizeAdminRole(body.role || 'reviewer');
  const password = String(body.password || '');

  if (!ADMIN_USERNAME_RE.test(username)) {
    return json({ error: 'username_invalid' }, 400, corsHeaders);
  }
  if (!role) {
    return json({ error: 'role_invalid' }, 400, corsHeaders);
  }
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return json({ error: 'password_too_short' }, 400, corsHeaders);
  }

  const exists = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (exists) {
    return json({ error: 'user_exists' }, 409, corsHeaders);
  }

  const passwordHash = await hashAdminCredential(password, env);
  const now = new Date().toISOString();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO admin_users (username, display_name, role, password_hash, created_at, created_by, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
  ).bind(
    username,
    displayName || null,
    role,
    passwordHash,
    now,
    'owner',
    now,
  ).run();

  return json(
    {
      ok: true,
      item: {
        username,
        display_name: displayName || null,
        role,
        created_at: now,
        created_by: 'owner',
        updated_at: now,
        disabled_at: null,
      },
    },
    201,
    corsHeaders,
  );
}

async function handleOwnerUpdateUser(usernameRaw, request, env, corsHeaders) {
  await ensureAdminAuthSchema(env);
  const username = normalizeAdminUsername(usernameRaw);
  if (!ADMIN_USERNAME_RE.test(username)) {
    return json({ error: 'username_invalid' }, 400, corsHeaders);
  }

  const existing = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username, display_name, role, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (!existing) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const body = bodyResult.value || {};

  const updates = [];
  const bindings = [];

  if (Object.prototype.hasOwnProperty.call(body, 'display_name') || Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    const displayName = normalizeAdminDisplayName(body.display_name || body.displayName || '');
    updates.push('display_name = ?');
    bindings.push(displayName || null);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'role')) {
    const role = normalizeAdminRole(body.role || '');
    if (!role) {
      return json({ error: 'role_invalid' }, 400, corsHeaders);
    }
    updates.push('role = ?');
    bindings.push(role);
  }

  let passwordChanged = false;
  if (Object.prototype.hasOwnProperty.call(body, 'password')) {
    const password = String(body.password || '');
    if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
      return json({ error: 'password_too_short' }, 400, corsHeaders);
    }
    const passwordHash = await hashAdminCredential(password, env);
    updates.push('password_hash = ?');
    bindings.push(passwordHash);
    passwordChanged = true;
  }

  let disabledChanged = false;
  if (Object.prototype.hasOwnProperty.call(body, 'disabled')) {
    const disabled = Boolean(body.disabled);
    updates.push('disabled_at = ?');
    bindings.push(disabled ? new Date().toISOString() : null);
    disabledChanged = true;
  }

  if (!updates.length) {
    return json({ error: 'no_changes' }, 400, corsHeaders);
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(username);

  await env.OPERIT_SUBMISSION_DB.prepare(
    `UPDATE admin_users SET ${updates.join(', ')} WHERE username = ?`,
  ).bind(...bindings).run();

  if (passwordChanged || disabledChanged) {
    await env.OPERIT_SUBMISSION_DB.prepare(
      'DELETE FROM admin_sessions WHERE username = ?',
    ).bind(username).run();
  }

  const updated = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username, display_name, role, created_at, created_by, updated_at, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(username).first();

  return json({ ok: true, item: updated || null }, 200, corsHeaders);
}

async function handleSubmit(request, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }

  const requestBody = await readSubmissionRequestBody(request);
  if (!requestBody.ok) {
    return json({ error: requestBody.error || 'invalid_request' }, 400, corsHeaders);
  }

  const validation = validateSubmission(requestBody.value || {});
  if (!validation.ok) {
    return json({ error: 'validation_failed', details: validation.errors }, 400, corsHeaders);
  }

  const turnstileToken = requestBody.value.turnstile_token || requestBody.value.turnstileToken;
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.OPERIT_IP_SALT);
  const ipBan = await getIpBan(ipHash, env);
  if (ipBan) {
    return json({
      error: 'ip_banned',
      reason: ipBan.reason || null,
      expires_at: ipBan.expires_at || null,
      created_at: ipBan.created_at || null,
      banned_by: ipBan.banned_by || null,
    }, 403, corsHeaders);
  }
  const turnstile = await verifyTurnstile(turnstileToken, ip, env);
  if (!turnstile.success) {
    return json({ error: 'turnstile_failed', details: turnstile['error-codes'] || [] }, 403, corsHeaders);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userAgent = request.headers.get('user-agent') || '';

  let normalizedContent = validation.value.content;
  try {
    const assetResult = await processSubmissionAssets({
      env,
      submissionId: id,
      content: normalizedContent,
      formData: requestBody.formData,
      assetsManifest: requestBody.assetsManifest,
    });
    normalizedContent = assetResult.content;
  } catch (err) {
    return json(
      {
        error: 'submission_assets_failed',
        detail: (err instanceof Error ? err.message : String(err)) || 'submission_assets_failed',
      },
      400,
      corsHeaders,
    );
  }

  const stmt = env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO submissions (id, type, language, target_path, title, content, status, author_name, author_email, client_ip_hash, user_agent, turnstile_ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    validation.value.type,
    validation.value.language,
    validation.value.targetPath,
    validation.value.title,
    normalizedContent,
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

  let query = 'SELECT id, type, language, target_path, title, status, author_name, author_email, created_at, reviewed_at, reviewer, review_notes, pr_number, pr_url, pr_branch, pr_state, pr_created_at, pr_error FROM submissions';
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
    'SELECT id, type, language, target_path, title, content, status, author_name, author_email, created_at, reviewed_at, reviewer, review_notes, pr_number, pr_url, pr_branch, pr_state, pr_created_at, pr_error FROM submissions WHERE id = ? LIMIT 1',
  ).bind(id).first();

  if (!row) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  return json({ ok: true, item: row }, 200, corsHeaders);
}

async function handleAdminUpdateStatus(id, request, env, corsHeaders, status, authUser) {
  const existing = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT id, type, language, target_path, title, content, status, author_name, author_email, created_at, reviewed_at, reviewer, review_notes, pr_number, pr_url, pr_branch, pr_state, pr_created_at, pr_error FROM submissions WHERE id = ? LIMIT 1',
  ).bind(id).first();

  if (!existing) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const reviewerInput = String(bodyResult.value.reviewer || '').trim();
  const reviewer = reviewerInput || authUser?.display_name || authUser?.username || null;
  const reviewNotes = String(bodyResult.value.review_notes || bodyResult.value.reviewNotes || '').trim() || null;
  const now = new Date().toISOString();

  const stmt = env.OPERIT_SUBMISSION_DB.prepare(
    'UPDATE submissions SET status = ?, reviewed_at = ?, reviewer = ?, review_notes = ? WHERE id = ?',
  ).bind(status, now, reviewer, reviewNotes, id);

  const result = await stmt.run();
  if (result.meta && result.meta.changes === 0) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  let prInfo = null;
  if (status === 'approved') {
    try {
      prInfo = await createSubmissionPullRequest(
        {
          ...existing,
          reviewer,
          review_notes: reviewNotes,
          reviewed_at: now,
        },
        reviewNotes,
        env,
      );
    } catch (err) {
      prInfo = {
        status: 'failed',
        error: (err instanceof Error ? err.message : String(err)) || 'pr_create_failed',
      };
    }
    try {
      await persistPrInfo(env, id, prInfo);
    } catch (err) {
      console.error('persist pr info failed', err);
    }
  }

  return json({ ok: true, id, status, reviewed_at: now, pr: prInfo }, 200, corsHeaders);
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

  const ipHash = await hashIp(ip, env.OPERIT_IP_SALT);
  const ipBan = await getIpBan(ipHash, env);

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
    ip_ban: ipBan
      ? {
          reason: ipBan.reason || null,
          expires_at: ipBan.expires_at || null,
          created_at: ipBan.created_at || null,
          banned_by: ipBan.banned_by || null,
          notes: ipBan.notes || null,
        }
      : null,
  }, 200, corsHeaders);
}

async function handleAdminIpBansList(url, env, corsHeaders) {
  const limit = clampInt(url.searchParams.get('limit'), 1, 200, 50);
  const offset = clampInt(url.searchParams.get('offset'), 0, 10000, 0);
  const activeOnly = url.searchParams.get('active') === '1';
  const bindings = [];
  let query = 'SELECT ip_hash, reason, notes, created_at, expires_at, banned_by FROM ip_bans';
  if (activeOnly) {
    query += ' WHERE expires_at IS NULL OR expires_at > ?';
    bindings.push(new Date().toISOString());
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);
  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(...bindings).all();
  return json({ ok: true, items: results || [], limit, offset }, 200, corsHeaders);
}

async function handleAdminIpBanCreate(request, env, corsHeaders) {
  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const body = bodyResult.value || {};
  const submissionId = String(body.submission_id || body.submissionId || '').trim();
  const rawIp = String(body.ip || '').trim();
  const ipHashInput = String(body.ip_hash || body.ipHash || '').trim();
  const reason = String(body.reason || '').trim() || null;
  const notes = String(body.notes || '').trim() || null;
  const bannedBy = String(body.banned_by || body.bannedBy || '').trim() || null;
  const expiresAtRaw = String(body.expires_at || body.expiresAt || '').trim();
  let expiresAt = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return json({ error: 'invalid_expires_at' }, 400, corsHeaders);
    }
    expiresAt = parsed.toISOString();
  }

  let ipHash = ipHashInput;
  if (!ipHash && rawIp) {
    ipHash = await hashIp(rawIp, env.OPERIT_IP_SALT);
  }
  if (!ipHash && submissionId) {
    const row = await env.OPERIT_SUBMISSION_DB.prepare(
      'SELECT client_ip_hash FROM submissions WHERE id = ? LIMIT 1',
    ).bind(submissionId).first();
    ipHash = row?.client_ip_hash || '';
  }

  if (!ipHash) {
    return json({ error: 'ip_hash_required' }, 400, corsHeaders);
  }

  const now = new Date().toISOString();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO ip_bans (ip_hash, reason, notes, created_at, expires_at, banned_by) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(ip_hash) DO UPDATE SET reason = excluded.reason, notes = excluded.notes, created_at = excluded.created_at, expires_at = excluded.expires_at, banned_by = excluded.banned_by',
  ).bind(ipHash, reason, notes, now, expiresAt, bannedBy).run();

  return json({ ok: true, ip_hash: ipHash, created_at: now, expires_at: expiresAt }, 200, corsHeaders);
}

async function handleAdminIpBanDelete(ipHash, env, corsHeaders) {
  if (!ipHash) {
    return json({ error: 'ip_hash_required' }, 400, corsHeaders);
  }
  const result = await env.OPERIT_SUBMISSION_DB.prepare(
    'DELETE FROM ip_bans WHERE ip_hash = ?',
  ).bind(ipHash).run();
  if (result.meta && result.meta.changes === 0) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }
  return json({ ok: true, ip_hash: ipHash }, 200, corsHeaders);
}

async function handleAdminAssetsCleanup(url, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }

  const bucket = ensureSubmissionAssetBucket(env);
  const cfg = getSubmissionAssetConfig(env);
  const now = new Date();

  const rawHours = url.searchParams.get('older_than_hours') || url.searchParams.get('ttl_hours');
  const keepHours = clampInt(rawHours, 1, 24 * 30, Math.max(1, Math.floor(cfg.ttlMs / (60 * 60 * 1000))));
  const cutoff = new Date(now.getTime() - keepHours * 60 * 60 * 1000).toISOString();
  const limit = clampInt(url.searchParams.get('limit'), 1, 500, 200);

  const query =
    'SELECT sa.submission_id, sa.id, sa.tmp_key, sa.status, sa.created_at, s.status AS submission_status ' +
    'FROM submission_assets sa ' +
    'LEFT JOIN submissions s ON s.id = sa.submission_id ' +
    'WHERE sa.deleted_at IS NULL AND sa.tmp_key IS NOT NULL AND sa.tmp_key <> \'\' ' +
    'AND (sa.status = \'migrated\' OR s.status = \'rejected\' OR sa.created_at < ?) ' +
    'ORDER BY sa.created_at ASC LIMIT ?';

  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(cutoff, limit).all();
  const items = results || [];

  let deleted = 0;
  const deletedAt = now.toISOString();
  for (const item of items) {
    const key = String(item.tmp_key || '').trim();
    if (!key) continue;
    try {
      await bucket.delete(key);
      deleted += 1;
    } catch {
      // ignore single asset delete failure
    }
  }

  if (items.length) {
    try {
      const pairs = items
        .map(() => '(?, ?)')
        .join(',');
      const bindings = [deletedAt];
      for (const item of items) {
        bindings.push(item.submission_id, item.id);
      }
      await env.OPERIT_SUBMISSION_DB.prepare(
        `UPDATE submission_assets SET deleted_at = ?, status = CASE WHEN status = 'migrated' THEN status ELSE 'deleted' END WHERE (submission_id, id) IN (${pairs})`,
      ).bind(...bindings).run();
    } catch {
      // ignore metadata cleanup update failures
    }
  }

  return json(
    {
      ok: true,
      scanned: items.length,
      deleted,
      cutoff,
      keep_hours: keepHours,
    },
    200,
    corsHeaders,
  );
}

async function handleLeaderboard(url, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }
  const limit = clampInt(url.searchParams.get('limit'), 1, MAX_LEADERBOARD_LIMIT, 20);
  const query =
    'SELECT author_name, author_email, COUNT(*) AS edits, MAX(created_at) AS last_submitted ' +
    'FROM submissions ' +
    'WHERE (author_name IS NOT NULL AND author_name <> \'\') OR (author_email IS NOT NULL AND author_email <> \'\') ' +
    'GROUP BY author_name, author_email ' +
    'ORDER BY edits DESC, last_submitted DESC ' +
    'LIMIT ?';
  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(limit).all();
  return json(
    {
      ok: true,
      items: results || [],
      limit,
      generated_at: new Date().toISOString(),
    },
    200,
    corsHeaders,
  );
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

    if (url.pathname === '/api/submissions/leaderboard' && request.method === 'GET') {
      return handleLeaderboard(url, env, corsHeaders);
    }

    if (url.pathname.startsWith('/api/admin/')) {
      if (!env.OPERIT_SUBMISSION_DB) {
        return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
      }
      await ensureAdminAuthSchema(env);
      await cleanupExpiredAdminSessions(env);

      if (url.pathname === '/api/admin/auth/login' && request.method === 'POST') {
        return handleAdminLogin(request, env, corsHeaders);
      }

      if (url.pathname === '/api/admin/bootstrap' && request.method === 'POST') {
        const owner = await requireOwner(request, env);
        if (!owner.ok) {
          return json({ error: owner.error }, owner.status, corsHeaders);
        }
        await ensureAdminAuthSchema(env);

        const countRow = await env.OPERIT_SUBMISSION_DB.prepare(
          'SELECT COUNT(*) AS count FROM admin_users',
        ).first();
        const count = Number(countRow?.count || 0);
        if (count > 0) {
          return json({ ok: true, bootstrapped: true }, 200, corsHeaders);
        }

        const defaultUser = String(env.OPERIT_OWNER_ADMIN_USER || 'owner').trim().toLowerCase();
        const defaultPass = String(env.OPERIT_OWNER_ADMIN_PASSWORD || '').trim();
        if (!ADMIN_USERNAME_RE.test(defaultUser)) {
          return json({ error: 'bootstrap_username_invalid' }, 400, corsHeaders);
        }
        if (defaultPass.length < ADMIN_PASSWORD_MIN_LENGTH) {
          return json({ error: 'bootstrap_password_too_short' }, 400, corsHeaders);
        }

        const passwordHash = await hashAdminCredential(defaultPass, env);
        const now = new Date().toISOString();
        await env.OPERIT_SUBMISSION_DB.prepare(
          'INSERT INTO admin_users (username, display_name, role, password_hash, created_at, created_by, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
        ).bind(
          defaultUser,
          'Owner Admin',
          'admin',
          passwordHash,
          now,
          'owner',
          now,
        ).run();
        return json({ ok: true, bootstrapped: true, username: defaultUser }, 201, corsHeaders);
      }

      if (url.pathname.startsWith('/api/admin/owner/')) {
        const owner = await requireOwner(request, env);
        if (!owner.ok) {
          return json({ error: owner.error }, owner.status, corsHeaders);
        }
        if (!env.OPERIT_SUBMISSION_DB) {
          return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
        }

        if (url.pathname === '/api/admin/owner/users' && request.method === 'GET') {
          return handleOwnerListUsers(env, corsHeaders);
        }

        if (url.pathname === '/api/admin/owner/users' && request.method === 'POST') {
          return handleOwnerCreateUser(request, env, corsHeaders);
        }

        const ownerParts = url.pathname.split('/').filter(Boolean);
        if (ownerParts.length === 5 && ownerParts[2] === 'owner' && ownerParts[3] === 'users' && request.method === 'POST') {
          return handleOwnerUpdateUser(ownerParts[4], request, env, corsHeaders);
        }
      }

      const auth = await requireAdmin(request, env);
      if (!auth.ok) {
        return json({ error: auth.error }, auth.status, corsHeaders);
      }

      if (!env.OPERIT_SUBMISSION_DB) {
        return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
      }

      if (url.pathname === '/api/admin/auth/me' && request.method === 'GET') {
        return handleAdminMe(auth, corsHeaders);
      }

      if (url.pathname === '/api/admin/auth/logout' && request.method === 'POST') {
        return handleAdminLogout(request, env, auth, corsHeaders);
      }

      if (url.pathname === '/api/admin/assets/cleanup' && request.method === 'POST') {
        return handleAdminAssetsCleanup(url, env, corsHeaders);
      }

      const parts = url.pathname.split('/').filter(Boolean); // ['api','admin','submissions', ...]

      if (parts.length >= 3 && parts[2] === 'ip-bans') {
        if (parts.length === 3 && request.method === 'GET') {
          return handleAdminIpBansList(url, env, corsHeaders);
        }
        if (parts.length === 3 && request.method === 'POST') {
          return handleAdminIpBanCreate(request, env, corsHeaders);
        }
        if (parts.length === 4 && (request.method === 'POST' || request.method === 'DELETE')) {
          return handleAdminIpBanDelete(parts[3], env, corsHeaders);
        }
      }

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
            return handleAdminUpdateStatus(id, request, env, corsHeaders, 'approved', auth.user);
          }
          if (action === 'reject') {
            return handleAdminUpdateStatus(id, request, env, corsHeaders, 'rejected', auth.user);
          }
        }
      }
    }

    return json({ error: 'not_found' }, 404, corsHeaders);
  },
};
