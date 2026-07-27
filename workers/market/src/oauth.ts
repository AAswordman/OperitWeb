import { MarketError } from './shared.js';
import type { D1DatabaseLike, JsonValue, MarketEnv, Row } from './types.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_CALLBACK_URL = 'https://api.operit.app/oauth/github/callback';
const COMPLETION_PATH = '/oauth/github/complete';
const GITHUB_SCOPE = 'notifications public_repo user:email read:user';
const TRANSACTION_TTL_MS = 5 * 60 * 1000;
const TRANSACTION_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const TRANSACTION_RATE_LIMIT_MAX = 10;
const LOOPBACK_MIN_PORT = 1024;
const LOOPBACK_MAX_PORT = 65535;

type GitHubOAuthTransactionRow = Row & {
  id: string;
  state: string;
  delivery_secret_hash: string;
  code_verifier: string;
  status: string;
  encrypted_payload: string | null;
  payload_iv: string | null;
  completion_redirect_uri: string | null;
  expires_at: number;
  created_at: number;
};

type GitHubTokenPayload = {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresIn: number | null;
  refreshToken: string | null;
  user: GitHubOAuthUser;
};

type GitHubOAuthUser = {
  id: number;
  login: string;
  avatar_url: string;
};

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
};

export type GitHubOAuthStartResponse = {
  ok: true;
  transactionId: string;
  deliveryCredential: string;
  authorizationUrl: string;
  completionRedirectUri: string;
  expiresAt: number;
};

export type GitHubOAuthClaimResponse = {
  ok: true;
  status: 'complete';
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresIn: number | null;
  refreshToken: string | null;
  user: GitHubOAuthUser;
};

export async function handleGitHubOAuthStart(
  request: Request,
  env: MarketEnv,
): Promise<GitHubOAuthStartResponse> {
  const db = requireOAuthDatabase(env);
  const now = Date.now();
  const completionRedirectUri = await readCompletionRedirectUri(request);
  const ipHash = await hashClientIp(request, env);
  await cleanExpiredTransactions(db, now);
  await enforceTransactionRateLimit(db, ipHash, now);

  const transactionId = randomUrlSafeValue();
  const state = randomUrlSafeValue();
  const deliveryCredential = randomUrlSafeValue();
  const codeVerifier = randomUrlSafeValue(48);
  const expiresAt = now + TRANSACTION_TTL_MS;

  await db.prepare(
    'INSERT INTO github_oauth_transactions (' +
      'id, state, delivery_secret_hash, code_verifier, status, completion_redirect_uri, expires_at, created_at, client_ip_hash' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    transactionId,
    state,
    await sha256Base64Url(deliveryCredential),
    codeVerifier,
    'awaiting_callback',
    completionRedirectUri,
    expiresAt,
    now,
    ipHash,
  ).run();

  const authorizationUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizationUrl.searchParams.set('client_id', requireOAuthClientId(env));
  authorizationUrl.searchParams.set('redirect_uri', GITHUB_CALLBACK_URL);
  authorizationUrl.searchParams.set('scope', GITHUB_SCOPE);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', await sha256Base64Url(codeVerifier));
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    ok: true,
    transactionId,
    deliveryCredential,
    authorizationUrl: authorizationUrl.toString(),
    completionRedirectUri,
    expiresAt,
  };
}

export async function handleGitHubOAuthCallback(
  request: Request,
  env: MarketEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (!state) return callbackPage('GitHub login could not be completed', 'The authorization response did not include a state value.', 400);

  const db = requireOAuthDatabase(env);
  const transaction = await findTransactionByState(db, state);
  if (!transaction || transaction.expires_at <= Date.now()) {
    return callbackPage('GitHub login expired', 'Return to Operit and start the login again.', 410);
  }

  const authorizationError = url.searchParams.get('error');
  if (authorizationError) {
    await deleteTransaction(db, transaction.id);
    return completionRedirect(transaction, { status: 'denied', error: sanitizeCompletionCode(authorizationError) });
  }

  const code = url.searchParams.get('code');
  if (!code) return callbackPage('GitHub login could not be completed', 'The authorization response did not include a code.', 400);

  if (transaction.status !== 'awaiting_callback') {
    return callbackPage('GitHub login is already complete', 'Return to Operit to continue.', 200);
  }

  try {
    const tokenPayload = await exchangeAuthorizationCode(code, transaction.code_verifier, env);
    const encrypted = await encryptPayload(JSON.stringify(tokenPayload), env);
    const completed = await db.prepare(
      'UPDATE github_oauth_transactions SET status = ?, encrypted_payload = ?, payload_iv = ?, completed_at = ? ' +
        'WHERE id = ? AND status = ? AND expires_at > ? RETURNING id',
    ).bind('authorized', encrypted.ciphertext, encrypted.iv, Date.now(), transaction.id, 'awaiting_callback', Date.now()).first<Row>();
    if (!completed) throw new MarketError('oauth_transaction_expired', 'OAuth transaction expired', 410);
    return completionRedirect(transaction, { status: 'complete' });
  } catch (error) {
    console.error('GitHub OAuth callback failed', error);
    if (error instanceof MarketError && error.code === 'oauth_transaction_expired') {
      return callbackPage('GitHub login expired', 'Return to Operit and start the login again.', 410);
    }
    await deleteTransaction(db, transaction.id);
    return completionRedirect(transaction, { status: 'error', error: 'github_oauth_exchange_failed' });
  }
}

export async function handleGitHubOAuthClaim(
  request: Request,
  env: MarketEnv,
): Promise<GitHubOAuthClaimResponse> {
  const payload: Record<string, JsonValue> = await request.json();
  const transactionId = requireJsonString(payload.transactionId, 'transactionId');
  const deliveryCredential = requireJsonString(payload.deliveryCredential, 'deliveryCredential');
  const db = requireOAuthDatabase(env);
  const now = Date.now();
  const credentialHash = await sha256Base64Url(deliveryCredential);

  const transaction = await db.prepare(
    'SELECT id, state, delivery_secret_hash, code_verifier, status, encrypted_payload, payload_iv, completion_redirect_uri, expires_at, created_at ' +
      'FROM github_oauth_transactions WHERE id = ? AND delivery_secret_hash = ? LIMIT 1',
  ).bind(transactionId, credentialHash).first<GitHubOAuthTransactionRow>();

  if (!transaction) throw new MarketError('unauthorized', 'OAuth transaction is not available', 401);
  if (transaction.expires_at <= now) {
    await db.prepare('DELETE FROM github_oauth_transactions WHERE id = ?').bind(transaction.id).run();
    throw new MarketError('oauth_transaction_expired', 'OAuth transaction expired', 410);
  }
  if (transaction.status !== 'authorized' || !transaction.encrypted_payload || !transaction.payload_iv) {
    throw new MarketError('oauth_transaction_invalid', 'OAuth transaction is invalid', 409);
  }

  const claimed = await db.prepare(
    'DELETE FROM github_oauth_transactions ' +
      'WHERE id = ? AND delivery_secret_hash = ? AND status = ? AND expires_at > ? ' +
      'RETURNING encrypted_payload, payload_iv',
  ).bind(transaction.id, credentialHash, 'authorized', now).first<GitHubOAuthTransactionRow>();
  if (!claimed?.encrypted_payload || !claimed.payload_iv) {
    throw new MarketError('oauth_transaction_claimed', 'OAuth transaction has already been claimed', 409);
  }

  const tokenPayload = await decryptPayload(claimed.encrypted_payload, claimed.payload_iv, env);
  return {
    ok: true,
    status: 'complete',
    accessToken: tokenPayload.accessToken,
    tokenType: tokenPayload.tokenType,
    scope: tokenPayload.scope,
    expiresIn: tokenPayload.expiresIn,
    refreshToken: tokenPayload.refreshToken,
    user: tokenPayload.user,
  };
}

export function handleGitHubOAuthComplete(request: Request): Response {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  if (status === 'complete') {
    return callbackPage('GitHub login complete', 'Return to Operit to finish signing in.', 200);
  }
  if (status === 'denied') {
    return callbackPage('GitHub login was cancelled', 'Return to Operit to continue.', 200);
  }
  return callbackPage('GitHub login could not be completed', 'Return to Operit and try again.', 502);
}

function requireOAuthDatabase(env: MarketEnv): D1DatabaseLike {
  if (!env.db) throw new MarketError('server_error', 'Market database is not configured', 500);
  return env.db;
}

function requireOAuthClientId(env: MarketEnv): string {
  const clientId = env.OPERIT_GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) throw new MarketError('server_error', 'GitHub OAuth client ID is not configured', 500);
  return clientId;
}

function requireOAuthClientSecret(env: MarketEnv): string {
  const clientSecret = env.OPERIT_GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientSecret) throw new MarketError('server_error', 'GitHub OAuth client secret is not configured', 500);
  return clientSecret;
}

function requireTransactionKey(env: MarketEnv): string {
  const transactionKey = env.OPERIT_GITHUB_OAUTH_TRANSACTION_KEY;
  if (!transactionKey) throw new MarketError('server_error', 'GitHub OAuth transaction key is not configured', 500);
  return transactionKey;
}

async function exchangeAuthorizationCode(code: string, codeVerifier: string, env: MarketEnv): Promise<GitHubTokenPayload> {
  const body = new URLSearchParams({
    client_id: requireOAuthClientId(env),
    client_secret: requireOAuthClientSecret(env),
    code,
    redirect_uri: GITHUB_CALLBACK_URL,
    code_verifier: codeVerifier,
  });
  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'operit-github-oauth-broker',
    },
    body,
  });
  if (!response.ok) throw new MarketError('github_oauth_exchange_failed', 'GitHub rejected the authorization code', 502);

  const responsePayload: Record<string, JsonValue> = await response.json();
  const accessToken = requireJsonString(responsePayload.access_token, 'access_token');
  const tokenType = requireJsonString(responsePayload.token_type, 'token_type');
  const scope = requireJsonString(responsePayload.scope, 'scope');
  const expiresIn = optionalJsonNumber(responsePayload.expires_in, 'expires_in');
  const refreshToken = optionalJsonString(responsePayload.refresh_token, 'refresh_token');
  const user = await getGitHubUser(accessToken);
  return { accessToken, tokenType, scope, expiresIn, refreshToken, user };
}

async function getGitHubUser(accessToken: string): Promise<GitHubOAuthUser> {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'operit-github-oauth-broker',
    },
  });
  if (!response.ok) throw new MarketError('github_user_lookup_failed', 'GitHub user lookup failed', 502);
  const payload: Record<string, JsonValue> = await response.json();
  const id = payload.id;
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new MarketError('github_user_lookup_failed', 'GitHub user response is invalid', 502);
  }
  return {
    id,
    login: requireJsonString(payload.login, 'login'),
    avatar_url: requireJsonString(payload.avatar_url, 'avatar_url'),
  };
}

async function cleanExpiredTransactions(db: D1DatabaseLike, now: number): Promise<void> {
  await db.prepare('DELETE FROM github_oauth_transactions WHERE expires_at <= ?').bind(now).run();
}

async function enforceTransactionRateLimit(db: D1DatabaseLike, ipHash: string | null, now: number): Promise<void> {
  if (!ipHash) return;
  const row = await db.prepare(
    'SELECT COUNT(*) AS transaction_count FROM github_oauth_transactions ' +
      'WHERE client_ip_hash = ? AND created_at > ?',
  ).bind(ipHash, now - TRANSACTION_RATE_LIMIT_WINDOW_MS).first<Row>();
  const count = row?.transaction_count;
  if (typeof count !== 'number') throw new MarketError('server_error', 'OAuth transaction rate could not be read', 500);
  if (count >= TRANSACTION_RATE_LIMIT_MAX) {
    throw new MarketError('oauth_rate_limited', 'Too many GitHub login attempts', 429);
  }
}

async function findTransactionByState(db: D1DatabaseLike, state: string): Promise<GitHubOAuthTransactionRow | null> {
  return db.prepare(
    'SELECT id, state, delivery_secret_hash, code_verifier, status, encrypted_payload, payload_iv, completion_redirect_uri, expires_at, created_at ' +
      'FROM github_oauth_transactions WHERE state = ? LIMIT 1',
  ).bind(state).first<GitHubOAuthTransactionRow>();
}

async function deleteTransaction(db: D1DatabaseLike, id: string): Promise<void> {
  await db.prepare('DELETE FROM github_oauth_transactions WHERE id = ?').bind(id).run();
}

async function hashClientIp(request: Request, env: MarketEnv): Promise<string | null> {
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (!clientIp) return null;
  return sha256Base64Url(`${requireTransactionKey(env)}:${clientIp}`);
}

async function encryptPayload(payload: string, env: MarketEnv): Promise<EncryptedPayload> {
  const key = await transactionEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(payload),
  );
  return { ciphertext: bytesToBase64Url(new Uint8Array(encrypted)), iv: bytesToBase64Url(iv) };
}

async function decryptPayload(ciphertext: string, iv: string, env: MarketEnv): Promise<GitHubTokenPayload> {
  const key = await transactionEncryptionKey(env);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(iv) },
    key,
    base64UrlToBytes(ciphertext),
  );
  const payload: Record<string, JsonValue> = JSON.parse(new TextDecoder().decode(decrypted));
  const userPayload = payload.user;
  if (!isJsonRecord(userPayload)) throw new MarketError('oauth_transaction_invalid', 'OAuth transaction user is invalid', 409);
  const userId = userPayload.id;
  if (typeof userId !== 'number' || !Number.isFinite(userId) || userId <= 0) {
    throw new MarketError('oauth_transaction_invalid', 'OAuth transaction user is invalid', 409);
  }
  return {
    accessToken: requireJsonString(payload.accessToken, 'accessToken'),
    tokenType: requireJsonString(payload.tokenType, 'tokenType'),
    scope: requireJsonString(payload.scope, 'scope'),
    expiresIn: optionalJsonNumber(payload.expiresIn, 'expiresIn'),
    refreshToken: optionalJsonString(payload.refreshToken, 'refreshToken'),
    user: {
      id: userId,
      login: requireJsonString(userPayload.login, 'login'),
      avatar_url: requireJsonString(userPayload.avatar_url, 'avatar_url'),
    },
  };
}

async function transactionEncryptionKey(env: MarketEnv): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(requireTransactionKey(env)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

function requireJsonString(value: JsonValue | undefined, name: string): string {
  if (typeof value !== 'string' || !value) throw new MarketError('validation_failed', `${name} is required`, 400);
  return value;
}

function optionalJsonString(value: JsonValue | undefined, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new MarketError('validation_failed', `${name} is invalid`, 400);
  return value;
}

function optionalJsonNumber(value: JsonValue | undefined, name: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MarketError('validation_failed', `${name} is invalid`, 400);
  }
  return value;
}

function isJsonRecord(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function sha256Base64Url(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(hash));
}

function randomUrlSafeValue(size = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function readCompletionRedirectUri(request: Request): Promise<string> {
  const body = await request.text();
  let payload: Record<string, JsonValue>;
  try {
    const decoded = JSON.parse(body);
    if (!isJsonRecord(decoded)) throw new Error('start body must be a JSON object');
    payload = decoded;
  } catch {
    throw new MarketError('validation_failed', 'OAuth start body must be a JSON object', 400);
  }
  const raw = requireJsonString(payload.completionRedirectUri, 'completionRedirectUri');
  return normalizeCompletionRedirectUri(raw);
}

function normalizeCompletionRedirectUri(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MarketError('validation_failed', 'completionRedirectUri is invalid', 400);
  }
  if (url.protocol === 'https:' && url.host === 'api.operit.app' && url.pathname === COMPLETION_PATH && url.search === '' && url.hash === '') {
    return url.toString();
  }
  const loopbackHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  const port = Number(url.port);
  if (
    url.protocol === 'http:' &&
    loopbackHost &&
    Number.isInteger(port) &&
    port >= LOOPBACK_MIN_PORT &&
    port <= LOOPBACK_MAX_PORT &&
    url.pathname === COMPLETION_PATH &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === ''
  ) {
    return url.toString();
  }
  throw new MarketError('validation_failed', 'completionRedirectUri is not allowed', 400);
}

function completionRedirect(transaction: GitHubOAuthTransactionRow, params: Record<string, string>): Response {
  const completionRedirectUri = transaction.completion_redirect_uri;
  if (!completionRedirectUri) throw new MarketError('oauth_transaction_invalid', 'OAuth completion redirect is missing', 409);
  const url = new URL(completionRedirectUri);
  url.searchParams.set('transactionId', transaction.id);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    },
  });
}

function sanitizeCompletionCode(value: string): string {
  return value.replace(/[^0-9A-Za-z._-]+/g, '_').slice(0, 64);
}

function callbackPage(title: string, message: string, status: number): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:12vh auto;padding:0 1.5rem;color:#18212b}h1{font-size:1.5rem}p{line-height:1.5}</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`;
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      'referrer-policy': 'no-referrer',
    },
  });
}
