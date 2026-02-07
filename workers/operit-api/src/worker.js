import {
  json,
  readJson,
  parseAllowedOrigins,
  buildCorsHeaders,
  clampInt,
  validateSubmission,
  validateLookup,
  getClientIp,
  hashIp,
  getIpBan,
  MAX_LEADERBOARD_LIMIT,
  ADMIN_USERNAME_RE,
  ADMIN_PASSWORD_MIN_LENGTH,
} from './workerShared.js';
import {
  verifyTurnstile,
  readSubmissionRequestBody,
  processSubmissionAssets,
  createSubmissionPullRequest,
  computeSubmissionChangedWordsFromRaw,
  persistPrInfo,
  getSubmissionAssetConfig,
  ensureSubmissionAssetBucket,
} from './workerGithubAssets.js';
import {
  hashAdminCredential,
  ensureAdminAuthSchema,
  cleanupExpiredAdminSessions,
  requireOwner,
  handleOwnerListUsers,
  handleOwnerCreateUser,
  handleOwnerUpdateUser,
  requireAdmin,
  handleAdminLogin,
  handleAdminMe,
  handleAdminLogout,
} from './workerAdminAuth.js';

function normalizeLeaderboardAuthorValue(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function buildLeaderboardAuthorKey(authorName, authorEmail) {
  const normalizedEmail = normalizeLeaderboardAuthorValue(authorEmail);
  if (normalizedEmail) {
    return `email:${normalizedEmail.toLowerCase()}`;
  }
  const normalizedName = normalizeLeaderboardAuthorValue(authorName);
  if (normalizedName) {
    return `name:${normalizedName.toLowerCase()}`;
  }
  return '';
}

async function updateApprovedLeaderboardCache(env, submission, reviewedAt) {
  if (!env.OPERIT_SUBMISSION_DB || !submission?.id) return;

  const authorName = normalizeLeaderboardAuthorValue(submission.author_name);
  const authorEmailRaw = normalizeLeaderboardAuthorValue(submission.author_email);
  const authorEmail = authorEmailRaw ? authorEmailRaw.toLowerCase() : null;
  const authorKey = buildLeaderboardAuthorKey(authorName, authorEmail);
  if (!authorKey) return;

  const changedWords = Number.parseInt(String(submission.changed_words ?? ''), 10);
  if (!Number.isFinite(changedWords) || changedWords <= 0) return;

  try {
    await env.OPERIT_SUBMISSION_DB.prepare(
      'UPDATE submissions SET changed_words = ? WHERE id = ?',
    ).bind(changedWords, submission.id).run();
  } catch (err) {
    throw err;
  }

  const now = new Date().toISOString();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO submission_leaderboard_cache (author_key, author_name, author_email, total_changed_words, approved_submissions, last_approved_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      "ON CONFLICT(author_key) DO UPDATE SET " +
      "author_name = CASE WHEN excluded.author_name IS NOT NULL AND excluded.author_name <> '' THEN excluded.author_name ELSE submission_leaderboard_cache.author_name END, " +
      "author_email = CASE WHEN excluded.author_email IS NOT NULL AND excluded.author_email <> '' THEN excluded.author_email ELSE submission_leaderboard_cache.author_email END, " +
      'total_changed_words = submission_leaderboard_cache.total_changed_words + excluded.total_changed_words, ' +
      'approved_submissions = submission_leaderboard_cache.approved_submissions + excluded.approved_submissions, ' +
      'last_approved_at = CASE WHEN submission_leaderboard_cache.last_approved_at IS NULL OR excluded.last_approved_at > submission_leaderboard_cache.last_approved_at THEN excluded.last_approved_at ELSE submission_leaderboard_cache.last_approved_at END, ' +
      'updated_at = excluded.updated_at',
  ).bind(
    authorKey,
    authorName,
    authorEmail,
    changedWords,
    1,
    reviewedAt || now,
    now,
  ).run();
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
    'INSERT INTO submissions (id, type, language, target_path, title, content, changed_words, status, author_name, author_email, client_ip_hash, user_agent, turnstile_ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    validation.value.type,
    validation.value.language,
    validation.value.targetPath,
    validation.value.title,
    normalizedContent,
    0,
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
    'INSERT INTO submissions (id, type, language, target_path, title, content, changed_words, status, author_name, author_email, client_ip_hash, user_agent, turnstile_ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id,
    validation.value.type,
    validation.value.language,
    validation.value.targetPath,
    validation.value.title,
    validation.value.content,
    0,
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
    'SELECT id, type, language, target_path, title, content, changed_words, status, author_name, author_email, created_at, reviewed_at, reviewer, review_notes, pr_number, pr_url, pr_branch, pr_state, pr_created_at, pr_error FROM submissions WHERE id = ? LIMIT 1',
  ).bind(id).first();

  if (!existing) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  if (existing.status !== 'pending') {
    return json({ error: 'status_not_pending', current_status: existing.status }, 409, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const reviewerInput = String(bodyResult.value.reviewer || '').trim();
  const reviewer = reviewerInput || authUser?.display_name || authUser?.username || null;
  const reviewNotes = String(bodyResult.value.review_notes || bodyResult.value.reviewNotes || '').trim() || null;
  const now = new Date().toISOString();

  let approvedChangedWords = 0;
  if (status === 'approved') {
    try {
      const computed = await computeSubmissionChangedWordsFromRaw(existing, env);
      approvedChangedWords = Number.parseInt(String(computed ?? ''), 10);
    } catch (err) {
      return json(
        {
          error: 'changed_words_compute_failed',
          detail: (err instanceof Error ? err.message : String(err)) || 'changed_words_compute_failed',
        },
        500,
        corsHeaders,
      );
    }

    if (!Number.isFinite(approvedChangedWords) || approvedChangedWords < 0) {
      return json({ error: 'changed_words_compute_failed' }, 500, corsHeaders);
    }
  }

  const stmt = status === 'approved'
    ? env.OPERIT_SUBMISSION_DB.prepare(
      'UPDATE submissions SET status = ?, changed_words = ?, reviewed_at = ?, reviewer = ?, review_notes = ? WHERE id = ?',
    ).bind(status, approvedChangedWords, now, reviewer, reviewNotes, id)
    : env.OPERIT_SUBMISSION_DB.prepare(
      'UPDATE submissions SET status = ?, reviewed_at = ?, reviewer = ?, review_notes = ? WHERE id = ?',
    ).bind(status, now, reviewer, reviewNotes, id);

  const result = await stmt.run();
  if (result.meta && result.meta.changes === 0) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }

  let prInfo = null;
  if (status === 'approved') {
    existing.changed_words = approvedChangedWords;

    try {
      await updateApprovedLeaderboardCache(
        env,
        {
          ...existing,
          reviewer,
          review_notes: reviewNotes,
          reviewed_at: now,
        },
        now,
      );
    } catch (err) {
      console.error('update leaderboard cache failed', err);
    }

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
    'SELECT author_name, author_email, total_changed_words AS changed_words, approved_submissions AS approved_count, last_approved_at AS last_submitted ' +
    'FROM submission_leaderboard_cache ' +
    'WHERE total_changed_words > 0 ' +
    'ORDER BY total_changed_words DESC, last_approved_at DESC ' +
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
        const bodyResult = await readJson(request);
        if (!bodyResult.ok) {
          return json({ error: 'invalid_json' }, 400, corsHeaders);
        }
        const turnstileToken = bodyResult.value.turnstile_token || bodyResult.value.turnstileToken;
        const ip = getClientIp(request);
        const turnstile = await verifyTurnstile(turnstileToken, ip, env);
        if (!turnstile.success) {
          return json({ error: 'turnstile_failed', details: turnstile['error-codes'] || [] }, 403, corsHeaders);
        }
        return handleAdminLogin(request, env, corsHeaders, bodyResult.value);
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
