import { MarketError } from './shared.js';
import type { MarketEnv } from './types.js';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_USER_AGENT = 'operit-market-v2';

let githubTokenCache: { token: string; expiresAt: number } = { token: '', expiresAt: 0 };

export async function githubApiFetch(path: string, env: MarketEnv): Promise<Response> {
  const token = await fetchGitHubToken(env);
  return fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
    },
  });
}

async function fetchGitHubToken(env: MarketEnv): Promise<string> {
  if (githubTokenCache.token && githubTokenCache.expiresAt > Date.now()) {
    return githubTokenCache.token;
  }

  const directToken = String(env.GITHUB_TOKEN || env.OPERIT_GITHUB_TOKEN || '').trim();
  if (directToken) {
    githubTokenCache = { token: directToken, expiresAt: Date.now() + 50 * 60 * 1000 };
    return directToken;
  }

  const appId = String(env.GITHUB_APP_ID || env.OPERIT_GITHUB_APP_ID || '').trim();
  const appPem = normalizePem(String(env.GITHUB_APP_PEM || env.GITHUB_PRIVATE_KEY || env.OPERIT_GITHUB_PRIVATE_KEY || ''));
  const installId = String(env.GITHUB_INSTALLATION_ID || env.OPERIT_GITHUB_INSTALLATION_ID || '').trim();
  if (!appId || !appPem || !installId) {
    throw new MarketError('server_error', 'GitHub App credentials are not configured', 500);
  }

  const jwt = await createGitHubAppJwt(appId, appPem);
  const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
    },
  });
  const data = await response.json().catch(() => null) as { token?: string; expires_at?: string; message?: string } | null;
  if (!response.ok || !data?.token) {
    throw new MarketError('server_error', data?.message || response.statusText || 'GitHub App token request failed', 500);
  }

  githubTokenCache = {
    token: data.token,
    expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 50 * 60 * 1000,
  };
  return data.token;
}

function normalizePem(value: string): string {
  return String(value || '').trim().replace(/\\n/g, '\n');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlFromString(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createGitHubAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 540, iss: appId };
  const signingInput = `${base64UrlFromString(JSON.stringify(header))}.${base64UrlFromString(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}
