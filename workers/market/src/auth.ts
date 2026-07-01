import {
  DEFAULT_SESSION_TTL_SECONDS,
  MarketError,
  SESSION_PREFIX,
  authorIdFromGithubId,
  isoNow,
  requireString,
  signToken,
  stripBearer,
  verifyToken,
} from './shared.js';
import type { D1DatabaseLike, GitHubUser, MarketEnv, Row, SqlParam } from './types.js';

export interface MarketSession {
  ver: number;
  github_id: number;
  github_login: string;
  avatar_url?: string;
  iat: number;
  exp: number;
}

export interface MarketAuthor {
  id: string;
  github_id: number;
  github_login: string;
  owner_avatar: string;
  status: string;
}

export async function handleAuthGithub(request: Request, env: MarketEnv): Promise<{ ok: true; session: string; githubId: number; login: string; avatarUrl: string }> {
  const githubToken = stripBearer(request.headers.get('authorization') || '');
  if (!githubToken) throw new MarketError('unauthorized', 'GitHub token is required', 401);
  const userFn = env.mockGitHubGetUser || realGitHubGetUser;
  const user = await userFn(githubToken, env);
  const now = Math.floor(Date.now() / 1000);
  const payload: MarketSession = {
    ver: 1,
    github_id: user.id,
    github_login: user.login,
    avatar_url: user.avatar_url || '',
    iat: now,
    exp: now + DEFAULT_SESSION_TTL_SECONDS,
  };
  const secret = getSessionSecret(env);
  const session = signToken(SESSION_PREFIX, payload, secret);
  return { ok: true, session, githubId: user.id, login: user.login, avatarUrl: user.avatar_url || '' };
}

export async function requireSession(request: Request, env: MarketEnv): Promise<MarketSession> {
  const raw = request.headers.get('authorization') || '';
  const token = stripBearer(raw);
  if (!token) throw new MarketError('unauthorized', 'Market session is required', 401);
  const payload = verifyToken(SESSION_PREFIX, token, getSessionSecret(env)) as MarketSession;
  if (payload.exp <= Math.floor(Date.now() / 1000)) throw new MarketError('session_expired', 'Market session has expired', 401);
  return payload;
}

export async function upsertAuthorFromSession(db: D1DatabaseLike, session: MarketSession): Promise<MarketAuthor> {
  return upsertAuthorFromGithubOwner(db, {
    githubId: Number(session.github_id),
    login: requireString(session.github_login, 'github_login'),
    avatar: String(session.avatar_url || ''),
  });
}

export async function upsertAuthorFromGithubOwner(db: D1DatabaseLike, owner: { githubId: number; login: string; avatar?: string }): Promise<MarketAuthor> {
  if (!Number.isFinite(owner.githubId) || owner.githubId <= 0) throw new MarketError('validation_failed', 'GitHub owner id is required');
  const id = authorIdFromGithubId(owner.githubId);
  const now = isoNow();
  const githubId = Number(owner.githubId);
  const login = requireString(owner.login, 'github_login');
  const avatar = String(owner.avatar || '');
  const existing = await first(db, 'SELECT id FROM market_authors WHERE id = ?', [id]);
  if (existing) {
    await run(db, 'UPDATE market_authors SET github_login = ?, owner_avatar = ?, updated_at = ? WHERE id = ?', [login, avatar, now, id]);
  } else {
    await run(db, 'INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, githubId, login, avatar, 'active', now, now]);
  }
  return { id, github_id: githubId, github_login: login, owner_avatar: avatar, status: 'active' };
}

export function assertAuthorActive(author: MarketAuthor): void {
  if (author.status === 'blocked') throw new MarketError('state_invalid', 'Author is blocked', 403);
}

// requireAdminToken validates an operit-api admin session token.
// Mirrors operit-api/src/workerAdminAuth.js resolveAdminSession logic.
// No fallback — all admin operations go through operit-api's admin_sessions table.
export interface AdminUser { username: string; role: string }

export async function requireAdminToken(request: Request, env: MarketEnv): Promise<AdminUser> {
  const authHeader = request.headers.get('authorization') || '';
  const adminHeader = request.headers.get('x-operit-admin-token') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : adminHeader;
  if (!token) throw new MarketError('unauthorized', 'Admin token required', 401);

  // Owner token bypass (same as operit-api)
  const ownerToken = String(env.OPERIT_OWNER_TOKEN || env.OPERIT_ADMIN_TOKEN || '').trim();
  if (ownerToken && token === ownerToken) {
    return { username: 'owner', role: 'admin' };
  }

  const db = env.OPERIT_SUBMISSION_DB;
  if (!db) throw new MarketError('server_error', 'Admin DB not configured', 500);

  const salt = String(env.OPERIT_ADMIN_AUTH_SALT || env.OPERIT_IP_SALT || 'operit-admin-default-salt');
  const tokenHash = await sha256Hex(`operit-admin:${salt}:${token}`);

  const row = await first(db,
    'SELECT s.username, s.role, s.expires_at, u.disabled_at ' +
    'FROM admin_sessions s LEFT JOIN admin_users u ON u.username = s.username ' +
    'WHERE s.token_hash = ? LIMIT 1',
    [tokenHash],
  );
  if (!row) throw new MarketError('unauthorized', 'Invalid admin token', 401);

  const now = new Date().toISOString();
  if (typeof row.expires_at === 'string' && row.expires_at <= now) {
    await run(db, 'DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]).catch(() => {});
    throw new MarketError('session_expired', 'Admin session expired', 401);
  }
  if (row.disabled_at) throw new MarketError('unauthorized', 'Admin account disabled', 403);

  const role = String(row.role || '');
  if (!role || !['admin', 'reviewer'].includes(role)) throw new MarketError('unauthorized', 'Invalid admin role', 403);

  // Heartbeat
  await run(db, 'UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?', [now, tokenHash]).catch(() => {});

  return { username: String(row.username || ''), role };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function realGitHubGetUser(token: string, _env: MarketEnv): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.v3+json', 'user-agent': 'operit-market-v2' },
  });
  if (!response.ok) throw new MarketError('unauthorized', 'GitHub token validation failed', 401);
  return response.json() as Promise<GitHubUser>;
}

function getSessionSecret(env: MarketEnv): string {
  const secret = env.MARKET_SESSION_SECRET;
  if (!secret) throw new MarketError('server_error', 'Market session secret is not configured', 500);
  return secret;
}

async function first(db: D1DatabaseLike, sql: string, params: SqlParam[]): Promise<Row | null> {
  return db.prepare(sql).bind(...params).first<Row>() as Promise<Row | null>;
}

async function run(db: D1DatabaseLike, sql: string, params: SqlParam[]): Promise<unknown> {
  return db.prepare(sql).bind(...params).run();
}
