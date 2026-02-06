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

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_REPO_CONTENT_PREFIX = 'public/';

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
  const contentPrefix = normalizePath(contentPrefixRaw).replace(/\/+$/, '');
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

  const commitMessage = `docs: ${submission.title} (${submission.id})`;
  await putFile({
    owner: config.owner,
    repo: config.repo,
    path: repoPath,
    branch,
    message: commitMessage,
    content: submission.content || '',
    sha: submission.type === 'edit' ? fileSha : fileSha || undefined,
    token,
  });

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

  return {
    status: 'created',
    number: pr?.number || null,
    url: pr?.html_url || null,
    branch,
    created_at: pr?.created_at || new Date().toISOString(),
  };
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

async function handleAdminUpdateStatus(id, request, env, corsHeaders, status) {
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
