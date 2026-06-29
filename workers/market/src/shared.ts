import type { JsonObject } from './types.js';

export const SESSION_PREFIX = 'om1';
export const PROOF_PREFIX = 'op-proof-v1';
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_PROOF_TTL_SECONDS = 10 * 60;
export const ALLOWED_DOWNLOAD_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'raw.githubusercontent.com']);
export const ARTIFACT_TYPES = new Set(['script', 'package']);
export const REPO_TYPES = new Set(['skill', 'mcp']);

export class MarketError extends Error {
  code: string;
  status: number;
  constructor(code: string, message?: string, status = 400) {
    super(message || code);
    this.name = 'MarketError';
    this.code = code;
    this.status = status;
  }
}

export function ok(data: JsonObject, status = 200): Response { return jsonResponse({ ok: true, ...data }, status); }
export function fail(code: string, message: string, status = 400): Response { return jsonResponse({ ok: false, error: { code, message } }, status); }
export function jsonResponse(body: JsonObject, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } }); }
export function errorResponse(code: string, message: string, status = 400): Response { return jsonResponse({ ok: false, error: { code, message } }, status); }
export function corsHeaders(_request?: Request): Record<string, string> { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,authorization', vary: 'origin' }; }
export function withHeaders(response: Response, headers: Record<string, string>): Response {
  const nextHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) nextHeaders.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

export function requireString(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new MarketError('validation_failed', `${field} is required`);
  return text;
}

export function requireSha256(value: unknown): string {
  const text = requireString(value, 'sha256').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new MarketError('validation_failed', 'sha256 must be a 64-char hex string');
  return text;
}

export function stripBearer(value: string): string {
  const token = String(value || '').trim();
  return token.toLowerCase().startsWith('bearer ') ? token.slice(7).trim() : token;
}

export function authorIdFromGithubId(githubId: number): string { return `gh_${Number(githubId)}`; }
export function isArtifactType(type: string): boolean { return ARTIFACT_TYPES.has(type); }
export function isRepoType(type: string): boolean { return REPO_TYPES.has(type); }
export function isoNow(): string { return new Date().toISOString(); }
export function nowSeconds(): number { return Math.floor(Date.now() / 1000); }

export function slug(value: string): string { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'; }
export function makeEntryId(type: string, data: { owner?: string; repo?: string; subdir?: string; version?: string; kind?: string }): string { return `${type}-${slug([data.owner, data.repo, data.subdir, data.kind, data.version].filter(Boolean).join('-'))}`; }
export function makeVersionId(entryId: string, version: string): string { return `${entryId}-v-${slug(version)}`; }
export function makeProjectId(entryId: string, version: string): string { return `project-${slug(entryId)}-${slug(version)}`; }

export function normalizeGithubRepoUrl(rawUrl: unknown): { owner: string; repo: string } {
  const text = requireString(rawUrl, 'source.url').replace(/\.git$/i, '');
  let url: URL;
  try { url = new URL(text); } catch { throw new MarketError('validation_failed', 'Invalid GitHub repo URL'); }
  if (url.hostname.toLowerCase() !== 'github.com') throw new MarketError('validation_failed', 'Only github.com repo URLs are supported');
  const [owner, repo] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) throw new MarketError('validation_failed', 'GitHub repo URL must include owner and repo');
  return { owner, repo };
}

export function normalizeRefType(value: unknown): 'tag' | 'branch' | 'commit' {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'tag' || text === 'branch' || text === 'commit') return text;
  throw new MarketError('validation_failed', 'repoVersion.refType must be tag, branch, or commit');
}

export function validateAllowedUrlHost(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (!ALLOWED_DOWNLOAD_HOSTS.has(url.hostname.toLowerCase())) throw new MarketError('validation_failed', 'Download URL host is not allowed');
}

export function extractIdFromPath(url: string, start: string, end: string): string {
  const pathname = new URL(url).pathname;
  const startIndex = pathname.indexOf(start);
  if (startIndex < 0) return '';
  const from = startIndex + start.length;
  const rest = pathname.slice(from);
  if (!end) return decodeURIComponent(rest.replace(/^\/+|\/+$/g, ''));
  const endIndex = rest.indexOf(end);
  return decodeURIComponent((endIndex >= 0 ? rest.slice(0, endIndex) : rest).replace(/^\/+|\/+$/g, ''));
}

export function signToken(prefix: string, payload: object, secret: string): string {
  const body = base64UrlFromString(JSON.stringify(payload));
  const sig = computeHmacSync(secret, `${prefix}.${body}`);
  return `${prefix}.${body}.${sig}`;
}

export function verifyToken(prefix: string, token: string, secret: string): object {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== prefix) throw new MarketError('unauthorized', 'Invalid token', 401);
  const expected = computeHmacSync(secret, `${parts[0]}.${parts[1]}`);
  if (!timingSafeEqual(expected, parts[2] || '')) throw new MarketError('unauthorized', 'Invalid token signature', 401);
  return JSON.parse(stringFromBase64Url(parts[1] || '')) as object;
}

function computeHmacSync(secret: string, message: string): string { return base64UrlFromBytes(sha256Sync(new TextEncoder().encode(`${secret}:${message}`))); }
export function sha256Sync(input: Uint8Array): Uint8Array {
  // Non-cryptographic placeholder for local deterministic signing; Worker production can replace with WebCrypto.
  let h = 2166136261;
  for (const b of input) { h ^= b; h = Math.imul(h, 16777619); }
  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) out[i] = (h >>> ((i % 4) * 8)) & 0xff;
  return out;
}
function base64UrlFromBytes(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function base64UrlFromString(value: string): string { return base64UrlFromBytes(new TextEncoder().encode(value)); }
function stringFromBase64Url(value: string): string { const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='); return atob(base64); }
function timingSafeEqual(left: string, right: string): boolean { if (left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i); return diff === 0; }
