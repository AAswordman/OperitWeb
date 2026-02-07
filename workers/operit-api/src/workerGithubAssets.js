import {
  GITHUB_API_BASE,
  DEFAULT_REPO_CONTENT_PREFIX,
  DEFAULT_GITHUB_ASSET_PREFIX,
  DEFAULT_SUBMISSION_ASSET_TMP_PREFIX,
  DEFAULT_SUBMISSION_ASSET_TTL_HOURS,
  SUBMISSION_ASSET_ID_RE,
  MAX_SUBMISSION_ASSET_COUNT,
  MAX_SUBMISSION_ASSET_SIZE,
  normalizePath,
  normalizePrefix,
  joinPath,
  parseCsv,
  parseBoolean,
  clampInt,
  readJson,
  normalizePem,
  pemToArrayBuffer,
  base64FromBytes,
  base64UrlFromBytes,
  base64UrlFromString,
  base64EncodeUtf8,
} from './workerShared.js';
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

function tokenizeWordUnits(value) {
  const source = String(value || '').replace(/\r\n?/g, '\n').toLowerCase();
  const matches = source.match(/[\u3400-\u9fff]|[a-z0-9]+(?:['-][a-z0-9]+)*/g);
  return matches || [];
}

function countChangedWordUnits(beforeValue, afterValue) {
  const beforeTokens = tokenizeWordUnits(beforeValue);
  const afterTokens = tokenizeWordUnits(afterValue);
  if (!beforeTokens.length) return afterTokens.length;
  if (!afterTokens.length) return beforeTokens.length;

  const diff = new Map();
  for (const token of beforeTokens) {
    diff.set(token, (diff.get(token) || 0) + 1);
  }
  for (const token of afterTokens) {
    diff.set(token, (diff.get(token) || 0) - 1);
  }

  let changed = 0;
  diff.forEach(value => {
    changed += Math.abs(value);
  });
  return changed;
}

async function fetchRawGitHubFileText({ owner, repo, ref, path, token }) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return null;
  const encodedPath = normalizedPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  const encodedRef = encodeURIComponent(String(ref || '').trim() || 'main');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodedRef}/${encodedPath}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'operit-bot',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`github_raw_fetch_failed:${response.status}`);
  }
  return await response.text();
}

async function computeSubmissionChangedWordsFromRaw(submission, env) {
  const config = getGitHubConfig(env);
  if (!config.owner || !config.repo) {
    return null;
  }

  const auth = await getGitHubToken(env);
  if (!auth?.token) {
    return null;
  }

  const repoPath = resolveRepoPath(submission?.target_path, env);
  const oldContent = await fetchRawGitHubFileText({
    owner: config.owner,
    repo: config.repo,
    ref: config.defaultBranch || 'main',
    path: repoPath,
    token: auth.token,
  });

  const newContent = String(submission?.content || '');
  const changedWords = countChangedWordUnits(oldContent || '', newContent);

  return Math.max(0, changedWords);
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
export {
  getGitHubConfig,
  resolveRepoPath,
  getSubmissionAssetConfig,
  sanitizeAssetFileName,
  normalizeContentType,
  ensureSubmissionAssetBucket,
  verifyTurnstile,
  readSubmissionRequestBody,
  processSubmissionAssets,
  createSubmissionPullRequest,
  computeSubmissionChangedWordsFromRaw,
  persistPrInfo,
};
