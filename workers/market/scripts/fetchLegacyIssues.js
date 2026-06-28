import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.resolve(__dirname, '../migration-output');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'all_parsed.json');

const SOURCES = {
  script: { owner: 'AAswordman', repo: 'OperitScriptMarket', parser: 'market' },
  package: { owner: 'AAswordman', repo: 'OperitPackageMarket', parser: 'market' },
  skill: { owner: 'AAswordman', repo: 'OperitSkillMarket', parser: 'skill' },
  mcp: { owner: 'AAswordman', repo: 'OperitMCPMarket', parser: 'mcp' },
};

const REASON_LABEL_PREFIX = 'reason:';
const PAGE_SIZE = 100;
const CONCURRENCY = 8;

function loadEnvLocal() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).replace(/\\n/g, '\n');
    if (!process.env[key]) process.env[key] = value;
  }
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function githubAppToken() {
  loadEnvLocal();
  const appId = process.env.OPERIT_GITHUB_APP_ID;
  const installationId = process.env.OPERIT_GITHUB_INSTALLATION_ID;
  const privateKey = process.env.OPERIT_GITHUB_PRIVATE_KEY || (process.env.OPERIT_GITHUB_PRIVATE_KEY_PATH ? fs.readFileSync(process.env.OPERIT_GITHUB_PRIVATE_KEY_PATH, 'utf8') : '');
  if (!appId || !installationId || !privateKey) throw new Error('Missing GitHub App env');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 300, iss: appId }));
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${header}.${payload}.${signature}`;

  const resp = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent': 'operit-market-v2-migration' },
  });
  if (!resp.ok) throw new Error(`GitHub app token failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.token;
}

async function ghJson(token, url) {
  const resp = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'operit-market-v2-migration' },
  });
  if (!resp.ok) throw new Error(`GitHub fetch failed ${resp.status}: ${url}\n${await resp.text()}`);
  return resp.json();
}

function parseHiddenJson(body, parser) {
  const labels = parser === 'market' ? ['operit-market-json'] : [`operit-${parser}-json`];
  for (const label of labels) {
    const re = new RegExp(`<!--\\s*${label}\\s*:?\\s*([\\s\\S]*?)\\s*-->`, 'im');
    const m = re.exec(body || '');
    if (!m || !m[1]) continue;
    try { return JSON.parse(m[1].trim()); } catch { return null; }
  }
  return null;
}

function labelsOf(issue) {
  return Array.isArray(issue.labels) ? issue.labels.map((l) => String(l.name || '')).filter(Boolean) : [];
}

function parseRepoUrl(url) {
  const text = String(url || '').trim();
  const m = text.match(/github\.com\/([^/]+)\/([^/\s#?]+)(?:\/(?:tree|blob)\/([^/]+)\/(.*))?/i);
  if (!m) return { owner: '', repo: '', subdir: '', manifestPath: '' };
  const subpath = (m[4] || '').replace(/^\/+|\/+$/g, '');
  return { owner: m[1], repo: m[2].replace(/\.git$/i, ''), subdir: subpath, manifestPath: '' };
}

function normalizeArtifactData(parsed) {
  return {
    kind: 'artifact',
    projectId: parsed.projectId || parsed.id || '',
    projectDisplayName: parsed.projectDisplayName || parsed.displayName || parsed.name || '',
    projectDescription: parsed.projectDescription || parsed.description || '',
    version: parsed.version || '',
    minSupportedAppVersion: parsed.minSupportedAppVersion || parsed.minAppVersion || '0.0.0',
    minRuntimeVersion: parsed.minRuntimeVersion || '',
    maxSupportedAppVersion: parsed.maxSupportedAppVersion || parsed.maxAppVersion || '',
    nodeId: parsed.nodeId || parsed.rootNodeId || '',
    rootNodeId: parsed.rootNodeId || parsed.nodeId || '',
    parentNodeIds: Array.isArray(parsed.parentNodeIds) ? parsed.parentNodeIds : [],
    runtimePackageId: parsed.runtimePackageId || parsed.runtimePkg || '',
    downloadUrl: parsed.downloadUrl || parsed.download_url || '',
    assetName: parsed.assetName || '',
    ghOwner: parsed.ghOwner || '',
    ghRepo: parsed.ghRepo || '',
    releaseTag: parsed.releaseTag || '',
    sha256: parsed.sha256 || '',
  };
}

function normalizeRepoData(parsed) {
  const repoUrl = parsed.repositoryUrl || parsed.repository_url || parsed.repoUrl || '';
  const repo = parseRepoUrl(repoUrl);
  return {
    kind: 'repo',
    repoUrl,
    version: parsed.version || 'v1',
    commitSha: parsed.commitSha || '',
    subdir: parsed.subdir || repo.subdir || '',
    manifestPath: parsed.manifestPath || repo.manifestPath || '',
    installConfig: parsed.installConfig || parsed.install_config || '',
  };
}

function toParsedEntry(type, issue, parsed) {
  const labels = labelsOf(issue);
  const body = String(issue.body || '');
  const description = String(parsed.description || parsed.projectDescription || parsed.name || issue.title || '').trim();
  const data = type === 'script' || type === 'package' ? normalizeArtifactData(parsed) : normalizeRepoData(parsed);
  const detail = type === 'skill' || type === 'mcp'
    ? description
    : body.replace(/<!--[\s\S]*?-->/g, '').trim();
  return {
    number: issue.number,
    type,
    title: String(parsed.projectDisplayName || parsed.name || issue.title || '').trim(),
    description,
    detail,
    category: labels.find((l) => l.startsWith('category:'))?.replace('category:', '') || parsed.category || '',
    user_id: issue.user?.id || 0,
    user_login: issue.user?.login || '',
    user_avatar: issue.user?.avatar_url || '',
    created_at: issue.created_at || '',
    updated_at: issue.updated_at || '',
    gh_state: issue.state || '',
    gh_labels: labels,
    reasons: labels.filter((l) => l.startsWith(REASON_LABEL_PREFIX)).map((l) => l.slice(REASON_LABEL_PREFIX.length)),
    data,
  };
}

async function fetchRepoIssues(token, type, source) {
  const first = await ghJson(token, `https://api.github.com/repos/${source.owner}/${source.repo}/issues?state=all&per_page=${PAGE_SIZE}&page=1`);
  const pages = [];
  for (let p = 1; p <= 30; p++) pages.push(p);

  const results = [];
  let next = 0;
  async function worker() {
    while (next < pages.length) {
      const page = pages[next++];
      const issues = page === 1 ? first : await ghJson(token, `https://api.github.com/repos/${source.owner}/${source.repo}/issues?state=all&per_page=${PAGE_SIZE}&page=${page}`);
      if (!issues.length) continue;
      for (const issue of issues) {
        if (issue.pull_request) continue;
        const parsed = parseHiddenJson(String(issue.body || ''), source.parser);
        if (!parsed) continue;
        results.push(toParsedEntry(type, issue, parsed));
      }
      if (issues.length < PAGE_SIZE) break;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  results.sort((a, b) => b.number - a.number);
  console.log(`${type}: ${results.length}`);
  return results;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const token = await githubAppToken();
  const chunks = await Promise.all(Object.entries(SOURCES).map(([type, source]) => fetchRepoIssues(token, type, source)));
  const all = chunks.flat().sort((a, b) => {
    const ta = a.type.localeCompare(b.type);
    return ta || b.number - a.number;
  });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Total: ${all.length}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
