import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../migration-output');
const dbPath = path.join(outputDir, 'local_market.db');
const dryRun = process.argv.includes('--dry-run');
const noFetch = process.argv.includes('--no-fetch');
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const fetchConcurrency = Math.max(1, Number(process.env.FIX_AUTHOR_FETCH_CONCURRENCY || 8));

const SQL = await initSqlJs();
const sqlite = new SQL.Database(fs.readFileSync(dbPath));
const fetchFailures = [];
const rejectedUnreachableRepoEntries = [];
const knownOwnerRedirects = new Map([
  ['2122384287-sketch/operitforge', 'a-yuanwei'],
]);
const artifactRootPublisherFixes = [];

function rows(sql, params = []) {
  const stmt = sqlite.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function scalar(sql, params = []) {
  const row = rows(sql, params)[0];
  return row ? Object.values(row)[0] : undefined;
}

function exec(sql, params = []) {
  const stmt = sqlite.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

function hasColumn(table, column) {
  return rows(`PRAGMA table_info(${table})`).some((row) => row.name === column);
}

function githubOwner(url) {
  const match = String(url || '').match(/github\.com\/([^/]+)/i);
  return match ? match[1] : '';
}

function githubRepo(url) {
  const match = String(url || '').match(/github\.com\/([^/]+)\/([^/]+)/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}

function authorByLoginMap() {
  const map = new Map();
  const authorRows = rows('SELECT id, github_id, github_login FROM market_authors')
    .sort((left, right) => Number(right.github_id || 0) - Number(left.github_id || 0));
  for (const author of authorRows) {
    const key = String(author.github_login || '').toLowerCase();
    if (!map.has(key)) map.set(key, String(author.id || ''));
  }
  return map;
}

function isRealAuthorId(authorId) {
  return /^gh_\d+$/.test(String(authorId || ''));
}

function canonicalAuthorId(authorId) {
  const row = rows('SELECT github_login FROM market_authors WHERE id = ?', [authorId])[0];
  if (!row) return String(authorId || '');
  return authors.get(String(row.github_login || '').toLowerCase()) || String(authorId || '');
}

async function ensureAuthor(owner) {
  const login = String(owner || '').trim();
  if (!login) return '';
  const current = authors.get(login.toLowerCase());
  if (current && isRealAuthorId(current)) return current;
  if (noFetch) return '';
  const headers = { 'user-agent': 'operit-market-migration-fix' };
  if (githubToken) headers.authorization = `Bearer ${githubToken}`;
  const url = `https://api.github.com/users/${encodeURIComponent(login)}`;
  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(url, { headers });
      break;
    } catch (error) {
      if (attempt === 3) {
        fetchFailures.push({ login, error: error instanceof Error ? error.message : String(error) });
        return '';
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  if (!response.ok) return '';
  const user = await response.json();
  const githubId = Number(user.id || 0);
  if (!githubId) return '';
  const authorId = `gh_${githubId}`;
  const now = new Date().toISOString();
  exec(`
    INSERT OR IGNORE INTO market_authors (
      id, github_id, github_login, owner_avatar, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?)
  `, [authorId, githubId, String(user.login || login), String(user.avatar_url || ''), now, now]);
  authors.set(login.toLowerCase(), authorId);
  authors.set(String(user.login || login).toLowerCase(), authorId);
  return authorId;
}

async function resolveRedirectedRepoOwner(owner, repo) {
  if (!owner || !repo || noFetch) return '';
  const known = knownOwnerRedirects.get(`${owner}/${repo}`.toLowerCase());
  if (known) return known;
  const headers = { 'user-agent': 'operit-market-migration-fix' };
  if (githubToken) headers.authorization = `Bearer ${githubToken}`;
  const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(url, { method: 'HEAD', redirect: 'manual', headers });
      break;
    } catch (error) {
      if (attempt === 3) {
        fetchFailures.push({ login: owner, error: error instanceof Error ? error.message : String(error) });
        return '';
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  const location = response.headers.get('location') || '';
  const redirected = githubRepo(location);
  if (!redirected || redirected.repo.toLowerCase() !== repo.toLowerCase()) return '';
  return redirected.owner;
}

async function mapLimit(items, limit, worker) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

if (!hasColumn('market_entries', 'allow_public_updates')) {
  exec('ALTER TABLE market_entries ADD COLUMN allow_public_updates INTEGER NOT NULL DEFAULT 1');
}
if (!hasColumn('market_versions', 'publisher_id')) {
  exec('ALTER TABLE market_versions ADD COLUMN publisher_id TEXT REFERENCES market_authors(id)');
}

const authors = authorByLoginMap();
const versionOwners = new Map();
const missingOwners = new Set();
const unresolvedVersions = [];

// Fix artifact entry ownership from old v1 artifact-projects API
async function fixArtifactEntryOwnership() {
  if (noFetch) return;
  const entries = rows(`
    SELECT e.id, e.type, ap.project_key, e.author_id, e.publisher_id
    FROM market_entries e
    JOIN artifact_projects ap ON ap.entry_id = e.id
    WHERE e.type IN ('script','package') AND e.state_code = 'approved'
  `);
  const existingAuthMap = authorByLoginMap();
  const toCheck = [];
  for (const entry of entries) {
    let rawKey = String(entry.project_key || '').trim();
    if (!rawKey || rawKey === 'package:' || rawKey === 'script:') continue;
    // strip type prefix like "package:" or "script:"
    rawKey = rawKey.replace(/^(package|script):/, '');
    if (!rawKey) continue;
    toCheck.push({ entryId: String(entry.id), rawKey, currentPublisherId: String(entry.publisher_id || ''), currentAuthorId: String(entry.author_id || '') });
  }
  await mapLimit(toCheck, fetchConcurrency, async ({ entryId, rawKey, currentPublisherId, currentAuthorId }) => {
    const headers = { 'user-agent': 'operit-market-migration-fix' };
    if (githubToken) headers.authorization = `Bearer ${githubToken}`;
    let response;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await fetch(`https://api.operit.app/artifact-projects/${encodeURIComponent(rawKey)}.json`, { headers, signal: AbortSignal.timeout(10000) });
        break;
      } catch { if (attempt === 2) return; }
    }
    if (!response.ok) return;
    let body;
    try { body = await response.json(); } catch { return; }
    const rootLogin = String(body.rootPublisherLogin || '').trim();
    if (!rootLogin) return;
    const authorId = existingAuthMap.get(rootLogin.toLowerCase()) || authors.get(rootLogin.toLowerCase()) || '';
    if (!authorId || !(/^gh_\d+$/.test(authorId))) return;
    if (currentPublisherId === authorId && currentAuthorId === authorId) return; // already correct
    exec('UPDATE market_entries SET publisher_id = ?, author_id = ?, updated_at = ? WHERE id = ?', [authorId, authorId, new Date().toISOString(), entryId]);
    artifactRootPublisherFixes.push({ entryId, rawKey, previousPublisher: currentPublisherId, previousAuthor: currentAuthorId, correctedTo: authorId });
  });
}
await fixArtifactEntryOwnership();

function rejectUnreachableRepoEntries() {
  const now = new Date().toISOString();
  for (const entry of rows(`
    SELECT e.id AS entry_id, e.author_id AS author_id, s.source_url AS source_url
    FROM market_entries e
    JOIN repo_plugin_specs s ON s.entry_id = e.id
    WHERE e.type IN ('skill', 'mcp')
      AND e.author_id GLOB 'gh_-[0-9]*'
  `)) {
    exec(`UPDATE market_entries SET state_code = 'rejected', updated_at = ? WHERE id = ?`, [now, entry.entry_id]);
    exec(`UPDATE market_versions SET state_code = 'rejected', updated_at = ? WHERE entry_id = ?`, [now, entry.entry_id]);
    exec(`
      INSERT OR IGNORE INTO market_entry_reasons (entry_id, reason_code, created_at)
      VALUES (?, 'repository-unreachable', ?)
    `, [entry.entry_id, now]);
    for (const version of rows('SELECT id FROM market_versions WHERE entry_id = ?', [entry.entry_id])) {
      exec(`
        INSERT OR IGNORE INTO market_version_reasons (version_id, reason_code, created_at)
        VALUES (?, 'repository-unreachable', ?)
      `, [version.id, now]);
    }
    rejectedUnreachableRepoEntries.push({ entryId: String(entry.entry_id), authorId: String(entry.author_id), sourceUrl: String(entry.source_url || '') });
  }
}

rejectUnreachableRepoEntries();

let canonicalizedReferences = 0;
const referencedNegativeAuthors = rows(`
  SELECT id, github_login
  FROM market_authors a
  WHERE github_id < 0
    AND (
      EXISTS (SELECT 1 FROM market_entries e WHERE (e.author_id = a.id OR e.publisher_id = a.id) AND e.state_code <> 'rejected')
      OR EXISTS (SELECT 1 FROM market_versions v WHERE v.publisher_id = a.id)
    )
`);
await mapLimit(referencedNegativeAuthors, fetchConcurrency, async (author) => {
  await ensureAuthor(author.github_login);
});
for (const author of rows('SELECT id FROM market_authors')) {
  const fromId = String(author.id || '');
  const toId = canonicalAuthorId(fromId);
  if (!fromId || fromId === toId) continue;
  exec('UPDATE market_entries SET author_id = ? WHERE author_id = ?', [toId, fromId]);
  exec('UPDATE market_entries SET publisher_id = ? WHERE publisher_id = ?', [toId, fromId]);
  if (hasColumn('market_versions', 'publisher_id')) {
    exec('UPDATE market_versions SET publisher_id = ? WHERE publisher_id = ?', [toId, fromId]);
  }
  canonicalizedReferences++;
}

for (const asset of rows(`
  SELECT v.id AS version_id, a.url AS url
  FROM market_versions v
  JOIN market_assets a ON a.version_id = v.id
`)) {
  const repo = githubRepo(asset.url);
  const owner = repo?.owner || githubOwner(asset.url);
  if (!owner) continue;
  let authorId = await ensureAuthor(owner);
  let resolvedOwner = '';
  if (!authorId && repo) {
    resolvedOwner = await resolveRedirectedRepoOwner(repo.owner, repo.repo);
    if (resolvedOwner && resolvedOwner.toLowerCase() !== owner.toLowerCase()) {
      authorId = await ensureAuthor(resolvedOwner);
    }
  }
  if (!authorId) {
    missingOwners.add(owner);
    unresolvedVersions.push({ versionId: String(asset.version_id), owner, ...(resolvedOwner ? { resolvedOwner } : {}), url: String(asset.url || '') });
    continue;
  }
  versionOwners.set(String(asset.version_id), authorId);
}

let versionUpdates = 0;
for (const [versionId, authorId] of versionOwners) {
  exec('UPDATE market_versions SET publisher_id = ? WHERE id = ?', [authorId, versionId]);
  versionUpdates++;
}

const unresolvedVersionPublishersBefore = scalar(`
  SELECT COUNT(*)
  FROM market_versions v
  JOIN market_entries e ON e.id = v.entry_id
  WHERE v.publisher_id IS NULL OR v.publisher_id = ''
`) || 0;

let entryUpdates = 0;
const firstVersionByEntry = new Map();
for (const version of rows(`
  SELECT e.id AS entry_id, e.type AS type, e.publisher_id AS current_publisher_id,
         e.author_id AS current_author_id, v.id AS version_id, v.publisher_id AS publisher_id,
         COALESCE(v.published_at, v.created_at, v.updated_at) AS version_time
  FROM market_entries e
  JOIN market_versions v ON v.entry_id = e.id
  WHERE v.publisher_id IS NOT NULL AND v.publisher_id <> ''
  ORDER BY e.id ASC, COALESCE(v.published_at, v.created_at, v.updated_at) ASC, v.id ASC
`)) {
  if (!firstVersionByEntry.has(version.entry_id)) firstVersionByEntry.set(version.entry_id, version);
}

for (const entry of firstVersionByEntry.values()) {
  const shouldSyncAuthor = entry.type === 'script' || entry.type === 'package';
  const needsPublisher = entry.current_publisher_id !== entry.publisher_id;
  const needsAuthor = shouldSyncAuthor && entry.current_author_id !== entry.publisher_id;
  if (!needsPublisher && !needsAuthor) continue;
  if (shouldSyncAuthor) {
    exec('UPDATE market_entries SET publisher_id = ?, author_id = ? WHERE id = ?', [
      entry.publisher_id,
      entry.publisher_id,
      entry.entry_id,
    ]);
  } else {
    exec('UPDATE market_entries SET publisher_id = ? WHERE id = ?', [
      entry.publisher_id,
      entry.entry_id,
    ]);
  }
  entryUpdates++;
}

exec('UPDATE market_entries SET allow_public_updates = 1 WHERE allow_public_updates IS NULL');

const multiContributorEntries = scalar(`
  SELECT COUNT(*)
  FROM (
    SELECT entry_id
    FROM market_versions
    WHERE publisher_id IS NOT NULL AND publisher_id <> ''
    GROUP BY entry_id
    HAVING COUNT(DISTINCT publisher_id) > 1
  )
`) || 0;

const missingVersionPublishers = scalar(`
  SELECT COUNT(*)
  FROM market_versions
  WHERE publisher_id IS NULL OR publisher_id = ''
`) || 0;

console.log(JSON.stringify({
  ok: true,
  dryRun,
  versionAssetOwnerUpdates: versionUpdates,
  unresolvedVersionPublishersBefore: Number(unresolvedVersionPublishersBefore),
  entryPublisherUpdates: entryUpdates,
  multiContributorEntries: Number(multiContributorEntries),
  missingVersionPublishers: Number(missingVersionPublishers),
  canonicalizedReferences,
  artifactRootPublisherFixes,
  rejectedUnreachableRepoEntries,
  missingOwners: Array.from(missingOwners).sort(),
  unresolvedVersions,
  fetchFailures,
}, null, 2));

if (!dryRun) {
  fs.writeFileSync(dbPath, Buffer.from(sqlite.export()));
}
