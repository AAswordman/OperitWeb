import {
  json,
  readJson,
  clampInt,
  sha256Hex,
  ADMIN_USERNAME_RE,
  ADMIN_ROLES,
  ADMIN_PASSWORD_MIN_LENGTH,
  DEFAULT_ADMIN_SESSION_HOURS,
} from './workerShared.js';
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

function normalizeContactValue(value, maxLength = 120) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, maxLength);
}

function readContactChannels(body) {
  return {
    contact_email: normalizeContactValue(body.contact_email || body.contactEmail || '', 160),
    contact_qq: normalizeContactValue(body.contact_qq || body.contactQq || '', 60),
    contact_telegram: normalizeContactValue(body.contact_telegram || body.contactTelegram || '', 120),
  };
}

function hasAnyContactChannel(channels) {
  return Boolean(channels.contact_email || channels.contact_qq || channels.contact_telegram);
}

function buildLegacyContactSummary(channels) {
  const parts = [];
  if (channels.contact_email) parts.push(`email:${channels.contact_email}`);
  if (channels.contact_qq) parts.push(`qq:${channels.contact_qq}`);
  if (channels.contact_telegram) parts.push(`telegram:${channels.contact_telegram}`);
  return parts.join(' | ');
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
      'contact_email TEXT,' +
      'contact_qq TEXT,' +
      'contact_telegram TEXT,' +
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
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE TABLE IF NOT EXISTS reviewer_applications (' +
      'id TEXT PRIMARY KEY,' +
      'username TEXT NOT NULL UNIQUE,' +
      'display_name TEXT,' +
      'reason TEXT NOT NULL,' +
      'skills TEXT NOT NULL,' +
      'contact TEXT NOT NULL,' +
      'contact_email TEXT,' +
      'contact_qq TEXT,' +
      'contact_telegram TEXT,' +
      'password_hash TEXT NOT NULL,' +
      'turnstile_ok INTEGER NOT NULL DEFAULT 0,' +
      'status TEXT NOT NULL,' +
      'created_at TEXT NOT NULL,' +
      'reviewed_at TEXT,' +
      'reviewed_by TEXT,' +
      'review_notes TEXT,' +
      'granted_at TEXT' +
      ')',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_reviewer_applications_status_created ON reviewer_applications(status, created_at DESC)',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_reviewer_applications_username ON reviewer_applications(username)',
  ).run();
  const addColumnStatements = [
    'ALTER TABLE admin_users ADD COLUMN contact_email TEXT',
    'ALTER TABLE admin_users ADD COLUMN contact_qq TEXT',
    'ALTER TABLE admin_users ADD COLUMN contact_telegram TEXT',
    'ALTER TABLE reviewer_applications ADD COLUMN contact_email TEXT',
    'ALTER TABLE reviewer_applications ADD COLUMN contact_qq TEXT',
    'ALTER TABLE reviewer_applications ADD COLUMN contact_telegram TEXT',
  ];
  for (const statement of addColumnStatements) {
    try {
      await env.OPERIT_SUBMISSION_DB.prepare(statement).run();
    } catch {
      // ignore duplicate-column errors for existing deployments
    }
  }
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
        contact_email: '',
        contact_qq: '',
        contact_telegram: '',
        role: 'admin',
        owner: true,
      },
      token,
      owner: true,
    };
  }

  const tokenHash = await hashAdminCredential(token, env);
  const row = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT s.token_hash, s.username, s.role, s.created_at, s.expires_at, u.display_name, u.contact_email, u.contact_qq, u.contact_telegram, u.role AS user_role, u.disabled_at ' +
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
      contact_email: normalizeContactValue(row.contact_email || '', 160),
      contact_qq: normalizeContactValue(row.contact_qq || '', 60),
      contact_telegram: normalizeContactValue(row.contact_telegram || '', 120),
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
      contact_email: '',
      contact_qq: '',
      contact_telegram: '',
      role: 'admin',
      owner: true,
    },
  };
}

async function requireAdmin(request, env) {
  return resolveAdminSession(request, env);
}

async function handleAdminLogin(request, env, corsHeaders, bodyInput = null) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }
  await ensureAdminAuthSchema(env);

  let body = bodyInput;
  if (!body || typeof body !== 'object') {
    const bodyResult = await readJson(request);
    if (!bodyResult.ok) {
      return json({ error: 'invalid_json' }, 400, corsHeaders);
    }
    body = bodyResult.value || {};
  }
  const username = normalizeAdminUsername(body.username);
  const password = String(body.password || '');
  if (!ADMIN_USERNAME_RE.test(username)) {
    return json({ error: 'username_invalid' }, 400, corsHeaders);
  }
  if (!password) {
    return json({ error: 'password_required' }, 400, corsHeaders);
  }

  const row = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username, display_name, contact_email, contact_qq, contact_telegram, role, password_hash, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
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
        contact_email: normalizeContactValue(row.contact_email || '', 160),
        contact_qq: normalizeContactValue(row.contact_qq || '', 60),
        contact_telegram: normalizeContactValue(row.contact_telegram || '', 120),
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
    'SELECT username, display_name, contact_email, contact_qq, contact_telegram, role, created_at, created_by, updated_at, disabled_at FROM admin_users ORDER BY created_at DESC',
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
  const channels = readContactChannels(body);
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
  if (!hasAnyContactChannel(channels)) {
    return json({ error: 'contact_required' }, 400, corsHeaders);
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
    'INSERT INTO admin_users (username, display_name, contact_email, contact_qq, contact_telegram, role, password_hash, created_at, created_by, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
  ).bind(
    username,
    displayName || null,
    channels.contact_email || null,
    channels.contact_qq || null,
    channels.contact_telegram || null,
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
        contact_email: channels.contact_email || null,
        contact_qq: channels.contact_qq || null,
        contact_telegram: channels.contact_telegram || null,
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
    'SELECT username, display_name, contact_email, contact_qq, contact_telegram, role, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
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

  if (
    Object.prototype.hasOwnProperty.call(body, 'contact_email') ||
    Object.prototype.hasOwnProperty.call(body, 'contactEmail') ||
    Object.prototype.hasOwnProperty.call(body, 'contact_qq') ||
    Object.prototype.hasOwnProperty.call(body, 'contactQq') ||
    Object.prototype.hasOwnProperty.call(body, 'contact_telegram') ||
    Object.prototype.hasOwnProperty.call(body, 'contactTelegram')
  ) {
    const channels = readContactChannels(body);
    if (!hasAnyContactChannel(channels)) {
      return json({ error: 'contact_required' }, 400, corsHeaders);
    }
    updates.push('contact_email = ?');
    bindings.push(channels.contact_email || null);
    updates.push('contact_qq = ?');
    bindings.push(channels.contact_qq || null);
    updates.push('contact_telegram = ?');
    bindings.push(channels.contact_telegram || null);
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
    'SELECT username, display_name, contact_email, contact_qq, contact_telegram, role, created_at, created_by, updated_at, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(username).first();

  return json({ ok: true, item: updated || null }, 200, corsHeaders);
}

function normalizeApplicationUsername(value) {
  return normalizeAdminUsername(value);
}

function normalizeApplicationText(value, maxLength, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

async function handleReviewerApplicationSubmit(request, env, corsHeaders) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return json({ error: 'd1_binding_missing' }, 500, corsHeaders);
  }
  await ensureAdminAuthSchema(env);

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }

  const body = bodyResult.value || {};
  const username = normalizeApplicationUsername(body.username);
  const displayName = normalizeApplicationText(body.display_name || body.displayName || '', 60, '');
  const channels = readContactChannels(body);
  const password = String(body.password || '');
  const commitment = Boolean(body.commitment);

  if (!ADMIN_USERNAME_RE.test(username)) {
    return json({ error: 'username_invalid' }, 400, corsHeaders);
  }
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return json({ error: 'password_too_short' }, 400, corsHeaders);
  }
  if (!hasAnyContactChannel(channels)) {
    return json({ error: 'contact_required' }, 400, corsHeaders);
  }
  if (!commitment) {
    return json({ error: 'commitment_required' }, 400, corsHeaders);
  }

  const existingUser = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (existingUser) {
    return json({ error: 'user_exists' }, 409, corsHeaders);
  }

  const existingApplication = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT id, status FROM reviewer_applications WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (existingApplication) {
    return json({ error: 'application_exists' }, 409, corsHeaders);
  }

  const passwordHash = await hashAdminCredential(password, env);
  const now = new Date().toISOString();
  const applicationId = crypto.randomUUID();
  const reason = 'commitment_confirmed';
  const skills = 'responsible_contributor';
  const contact = buildLegacyContactSummary(channels);
  await env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO reviewer_applications (id, username, display_name, reason, skills, contact, contact_email, contact_qq, contact_telegram, password_hash, turnstile_ok, status, created_at, reviewed_at, reviewed_by, review_notes, granted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)',
  ).bind(
    applicationId,
    username,
    displayName || null,
    reason,
    skills,
    contact,
    channels.contact_email || null,
    channels.contact_qq || null,
    channels.contact_telegram || null,
    passwordHash,
    1,
    'pending',
    now,
  ).run();

  return json({ ok: true, id: applicationId, status: 'pending', created_at: now }, 201, corsHeaders);
}

async function handleReviewerApplicationList(url, env, corsHeaders) {
  await ensureAdminAuthSchema(env);
  const status = String(url.searchParams.get('status') || '').trim();
  const limit = clampInt(url.searchParams.get('limit'), 1, 200, 50);
  const offset = clampInt(url.searchParams.get('offset'), 0, 10000, 0);

  let query = 'SELECT id, username, display_name, reason, skills, contact, contact_email, contact_qq, contact_telegram, turnstile_ok, status, created_at, reviewed_at, reviewed_by, review_notes, granted_at FROM reviewer_applications';
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

async function handleReviewerApplicationApprove(id, request, env, corsHeaders, authUser) {
  await ensureAdminAuthSchema(env);
  const existing = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT id, username, display_name, reason, skills, contact, contact_email, contact_qq, contact_telegram, password_hash, status FROM reviewer_applications WHERE id = ? LIMIT 1',
  ).bind(id).first();
  if (!existing) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }
  if (existing.status !== 'pending') {
    return json({ error: 'status_not_pending' }, 409, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const reviewNotes = normalizeApplicationText(bodyResult.value?.review_notes || bodyResult.value?.reviewNotes || '', 500, '') || null;
  const displayName = normalizeAdminDisplayName(existing.display_name || '') || existing.username;
  const now = new Date().toISOString();

  const userExists = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(existing.username).first();
  if (userExists) {
    return json({ error: 'user_exists' }, 409, corsHeaders);
  }

  await env.OPERIT_SUBMISSION_DB.prepare(
    'INSERT INTO admin_users (username, display_name, contact_email, contact_qq, contact_telegram, role, password_hash, created_at, created_by, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
  ).bind(
    existing.username,
    displayName || null,
    normalizeContactValue(existing.contact_email || '', 160) || null,
    normalizeContactValue(existing.contact_qq || '', 60) || null,
    normalizeContactValue(existing.contact_telegram || '', 120) || null,
    'reviewer',
    existing.password_hash,
    now,
    authUser?.username || 'owner',
    now,
  ).run();

  await env.OPERIT_SUBMISSION_DB.prepare(
    'UPDATE reviewer_applications SET status = ?, reviewed_at = ?, reviewed_by = ?, review_notes = ?, granted_at = ? WHERE id = ?',
  ).bind(
    'approved',
    now,
    authUser?.username || 'owner',
    reviewNotes,
    now,
    id,
  ).run();

  return json(
    {
      ok: true,
      id,
      status: 'approved',
      granted_username: existing.username,
      granted_at: now,
    },
    200,
    corsHeaders,
  );
}

async function handleReviewerApplicationReject(id, request, env, corsHeaders, authUser) {
  await ensureAdminAuthSchema(env);
  const existing = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT id, status FROM reviewer_applications WHERE id = ? LIMIT 1',
  ).bind(id).first();
  if (!existing) {
    return json({ error: 'not_found' }, 404, corsHeaders);
  }
  if (existing.status !== 'pending') {
    return json({ error: 'status_not_pending' }, 409, corsHeaders);
  }

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const reviewNotes = normalizeApplicationText(bodyResult.value?.review_notes || bodyResult.value?.reviewNotes || '', 500, '') || null;
  const now = new Date().toISOString();

  await env.OPERIT_SUBMISSION_DB.prepare(
    'UPDATE reviewer_applications SET status = ?, reviewed_at = ?, reviewed_by = ?, review_notes = ? WHERE id = ?',
  ).bind(
    'rejected',
    now,
    authUser?.username || 'owner',
    reviewNotes,
    id,
  ).run();

  return json({ ok: true, id, status: 'rejected', reviewed_at: now }, 200, corsHeaders);
}

async function handleAdminProfileUpdate(request, env, auth, corsHeaders) {
  if (!auth?.ok) {
    return json({ error: 'unauthorized' }, 401, corsHeaders);
  }
  if (auth.owner) {
    return json({ error: 'owner_profile_not_editable' }, 400, corsHeaders);
  }
  await ensureAdminAuthSchema(env);

  const bodyResult = await readJson(request);
  if (!bodyResult.ok) {
    return json({ error: 'invalid_json' }, 400, corsHeaders);
  }
  const body = bodyResult.value || {};
  const displayName = normalizeAdminDisplayName(body.display_name || body.displayName || '');
  const channels = readContactChannels(body);
  if (!hasAnyContactChannel(channels)) {
    return json({ error: 'contact_required' }, 400, corsHeaders);
  }

  const now = new Date().toISOString();
  await env.OPERIT_SUBMISSION_DB.prepare(
    'UPDATE admin_users SET display_name = ?, contact_email = ?, contact_qq = ?, contact_telegram = ?, updated_at = ? WHERE username = ?',
  ).bind(
    displayName || null,
    channels.contact_email || null,
    channels.contact_qq || null,
    channels.contact_telegram || null,
    now,
    auth.user.username,
  ).run();

  const updated = await env.OPERIT_SUBMISSION_DB.prepare(
    'SELECT username, display_name, contact_email, contact_qq, contact_telegram, role, created_at, created_by, updated_at, disabled_at FROM admin_users WHERE username = ? LIMIT 1',
  ).bind(auth.user.username).first();

  return json({ ok: true, user: updated || null }, 200, corsHeaders);
}
export {
  getOwnerToken,
  hashAdminCredential,
  ensureAdminAuthSchema,
  requireOwner,
  requireAdmin,
  handleAdminLogin,
  handleAdminMe,
  handleAdminLogout,
  cleanupExpiredAdminSessions,
  handleOwnerListUsers,
  handleOwnerCreateUser,
  handleOwnerUpdateUser,
  handleAdminProfileUpdate,
  handleReviewerApplicationSubmit,
  handleReviewerApplicationList,
  handleReviewerApplicationApprove,
  handleReviewerApplicationReject,
};
