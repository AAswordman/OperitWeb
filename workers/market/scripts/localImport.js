/**
 * localImport.js - local SQLite import verification + D1 import SQL generation.
 *
 * This script follows MARKET_CLOUDFLARE_MIGRATION_PLAN.md for the one-shot
 * legacy Issue migration:
 * - recompute legacy issue state from labels, with closed as fallback only
 * - migrate reason:* labels to entry/version reason tables
 * - migrate market:featured labels to market_curations
 * - keep legacy format versions as *_legacy_issue_v1
 * - build artifact project/node/edge tables in FK-safe order
 * - split repo plugin author (repo owner) from publisher (issue user)
 * - import v1 download/like statistics once as v2 D1 baseline
 * - never import legacy comments
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const OUTPUT_DIR = path.resolve(__dirname, '../migration-output');
const DB_PATH = path.join(OUTPUT_DIR, 'local_market.db');
const SQL_PATH = path.join(OUTPUT_DIR, 'import_batch.sql');
const REPORT_PATH = path.join(OUTPUT_DIR, 'migration-report.json');
const OWNER_CACHE_PATH = path.join(OUTPUT_DIR, 'owner_cache.json');
const LEGACY_STATS_DIR = path.join(OUTPUT_DIR, 'legacy-stats');
const STATIC_BASE = 'https://static.operit.app';

const PUBLIC_LABEL = {
  script: 'script-artifact',
  package: 'package-artifact',
  skill: 'skill-plugin',
  mcp: 'mcp-plugin',
};

const VALID_CATEGORY_IDS = new Set([
  'search_research',
  'dev_code',
  'automation_workflow',
  'docs_knowledge',
  'media_content',
  'chat_communication',
  'integration_api',
  'system_data',
  'business_productivity',
  'life_entertainment',
  'other',
]);

const CATEGORY_ALIASES = {
  '系统集成': 'integration_api',
  '设计工具 / 前端开发 / Artifact': 'dev_code',
};

const CATEGORY_RULES = [
  { id: 'search_research', keywords: ['搜索', '爬取', '爬虫', '网页', '新闻', '天气', '地图', '资料收集', '搜索引擎', 'research', '检索', '查询', '资讯', '信息收集', 'knowledge retrieval', '信息获取'] },
  { id: 'dev_code', keywords: ['编程', '构建', '反编译', '代码审查', 'devops', '开发', '代码', '编译', 'debug', 'editor', 'ide', 'git', 'github', 'ci/cd', 'deploy', 'lsposed', 'xposed', 'android', 'sdk', 'cli'] },
  { id: 'automation_workflow', keywords: ['定时', '触发', '批处理', '工作流编排', '自动化', 'automation', 'workflow', 'cron', 'schedule', 'pipeline', 'reminder', '自动'] },
  { id: 'docs_knowledge', keywords: ['文档解析', '知识库', '学习', '课程', '文档', '知识', '笔记', '教程', 'markdown', 'pdf', '翻译', '字典', '词典', '百科'] },
  { id: 'media_content', keywords: ['图片', '视频', '音频', '图像', '内容生成', '生成', '字幕', '音乐', '绘图', '设计', 'icon', 'emoji', 'photo', 'meme', 'ocr', 'media'] },
  { id: 'chat_communication', keywords: ['聊天体验', '角色设定', '记忆整理', '消息收发', '聊天', '记忆', '角色', 'prompt', '对话', '社交', 'communication', 'message'] },
  { id: 'integration_api', keywords: ['外部平台接入', 'api服务', '模型供应商', '推理接口', '集成', '对接', 'api', 'webhook', 'sync', '同步', '转发', 'mcp'] },
  { id: 'system_data', keywords: ['终端', '设备', '本地服务', '文件操作', '备份同步', '权限', '安全审计', '系统', '数据', '文件', '安全', '加密', '密码', 'vault', '存储', 'terminal'] },
  { id: 'business_productivity', keywords: ['办公写作', '营销', '简历', '产品', '表格', '业务流程', '办公', '写作', '邮件', 'email', 'calendar', '会议', '管理', '效率', 'business'] },
  { id: 'life_entertainment', keywords: ['游戏', '娱乐', '占卜', '健康提醒', '生活', '星座', '运势', 'fun', 'game'] },
];

const VERSION_REASON_CODES = new Set([
  'install-config-invalid',
  'repository-unreachable',
  'repository-content-invalid',
  'security-risk',
]);

const SQL_EXPORT_ORDER = [
  ['market_authors', 'id, github_id, github_login, owner_avatar, status, blocked_reason_code, blocked_at, blocked_by, created_at, updated_at'],
  ['market_entries', 'id, type, title, description, detail, author_id, publisher_id, category_id, state_code, created_at, updated_at, published_at'],
  ['market_entry_reasons', 'entry_id, reason_code, created_at'],
  ['market_versions', 'id, entry_id, version, format_ver, min_app_ver, max_app_ver, state_code, changelog, created_at, updated_at, published_at'],
  ['market_version_reasons', 'version_id, reason_code, created_at'],
  ['artifact_projects', 'id, entry_id, project_key, runtime_pkg, root_node_id, created_at, updated_at'],
  ['artifact_nodes', 'id, project_id, version_id, node_key, runtime_pkg, display_name, description, sort_order, created_at, updated_at'],
  ['repo_plugin_specs', 'id, entry_id, source_kind, source_url, created_at, updated_at'],
  ['repo_plugin_versions', 'id, version_id, ref_type, ref_name, commit_sha, subdir, manifest_path, install_config, created_at, updated_at'],
  ['market_assets', 'id, version_id, kind, url, gh_owner, gh_repo, gh_release_tag, asset_name, sha256, size_bytes, content_type, created_at'],
  ['market_curations', 'id, list_key, entry_id, position, note, starts_at, ends_at, created_at, updated_at'],
  ['market_entry_stats', 'entry_id, type, legacy_downloads, legacy_likes, cf_downloads, cf_likes, downloads_total, likes_total, last_download_at, last_like_at, updated_at'],
  ['market_reaction_counts', 'id, entry_id, reaction, gh_count, cf_count, total_count, updated_at'],
];

function slug(v) {
  return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function normalizeLegacyStatKey(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'artifact';
}

function isoNow() {
  return new Date().toISOString();
}

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function interpolateSql(template, params) {
  let i = 0;
  return template.replace(/\?/g, () => sqlEscape(params[i++]));
}

function parseRepoUrl(url) {
  if (!url) return null;
  const m = String(url).match(/github\.com\/([^/]+)\/([^/\s#?]+)(?:\/(?:tree|blob)\/([^/]+)\/(.*))?/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, ''), ref: m[3] || '', subdir: (m[4] || '').replace(/^\/+|\/+$/g, '') };
}

function canonicalizeMarketSource(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const uri = new URL(value);
    const host = String(uri.hostname || '').replace(/^www\./i, '').trim();
    const pathPart = String(uri.pathname || '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '').trim();
    return [host, pathPart].filter(Boolean).join('/');
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '').trim();
  }
}

function normalizeRepoSourceUrl(url) {
  const p = parseRepoUrl(url);
  if (!p) return String(url || '').trim();
  const base = `https://github.com/${p.owner}/${p.repo}`;
  return p.subdir ? `${base}/tree/${p.ref || 'main'}/${p.subdir}` : base;
}

function makeEntryId(type, projectKey) {
  return `${type}-${slug(projectKey)}`;
}

function makeVersionId(entryId, version, issueNumber) {
  const base = `${entryId}-v-${slug(version || '0-0-0')}`;
  return issueNumber ? `${base}-i-${issueNumber}` : base;
}

function authorId(githubId) {
  return `gh_${Number(githubId)}`;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_~|]/g, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value, max) {
  const text = stripMarkdown(value);
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const boundary = Math.max(sliced.lastIndexOf('。'), sliced.lastIndexOf('！'), sliced.lastIndexOf('？'), sliced.lastIndexOf('.'), sliced.lastIndexOf('!'), sliced.lastIndexOf('?'));
  return (boundary >= 20 ? sliced.slice(0, boundary + 1) : sliced).trim();
}

function cleanText(value, max = 500) {
  return limitText(value, max);
}

function cleanDetail(value) {
  return String(value || '').replace(/["']/g, '').replace(/\r\n/g, '\n').trim();
}

function normalizeDetailText(value) {
  return cleanDetail(value)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*---+\s*$/gm, '')
    .trim();
}

function headingText(line) {
  return String(line || '').replace(/^#{1,6}\s+/, '').trim().toLowerCase();
}

function isHeadingLine(line) {
  return /^#{1,6}\s+/.test(String(line || '').trim());
}

function splitMarkdownSections(markdown) {
  const sections = [];
  let current = { heading: '', rawHeading: '', lines: [] };
  for (const line of String(markdown || '').split(/\n/)) {
    if (isHeadingLine(line)) {
      sections.push(current);
      current = { heading: headingText(line), rawHeading: line.replace(/^#{1,6}\s+/, '').trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections.map((section) => ({ heading: section.heading, rawHeading: section.rawHeading, text: normalizeDetailText(section.lines.join('\n')) }));
}

function sectionAfterHeading(markdown, matcher) {
  const sections = splitMarkdownSections(markdown);
  const found = sections.find((section) => matcher(section.heading) && section.text);
  return found?.text || '';
}

function removeRepoTemplateSections(markdown) {
  const stop = /^(🔗\s*)?(仓库信息|repository info|repository)$|^(⚡\s*)?(快速安装|quick install)$|^(📦\s*)?(安装方式|installation)$|^方式[一二三]|^method\s+\d|^(🛠️\s*)?(技术信息|technical info)$|^(✅\s*)?已验证$|^(⚠️\s*)?注意事项$|^installation$/i;
  const kept = splitMarkdownSections(markdown)
    .filter((section) => {
      if (!section.heading) return Boolean(section.text);
      return !stop.test(section.heading);
    })
    .map((section) => section.rawHeading ? `## ${section.rawHeading}\n\n${section.text}` : section.text)
    .filter(Boolean);
  return normalizeDetailText(kept.join('\n\n'));
}

function cleanArtifactDetail(entry, headingName) {
  const source = normalizeDetailText(entry.detail || '');
  const primary = sectionAfterHeading(source, (heading) => heading === headingName);
  if (primary) return primary;
  const projectDescription = normalizeDetailText(entry.data?.projectDescription || '');
  if (projectDescription) return projectDescription;
  const marker = source.search(/^##\s+(Project Cluster|Artifact|Metadata)\s*$/im);
  const beforeMeta = marker >= 0 ? source.slice(0, marker) : source;
  return normalizeDetailText(beforeMeta.replace(new RegExp(`^##\\s+${headingName}\\s*\\n+`, 'i'), '')) || cleanDetail(entry.description || entry.title || '');
}

function cleanSkillDetail(entry) {
  const source = normalizeDetailText(entry.detail || '');
  const extracted = removeRepoTemplateSections(source);
  return stripLeadingInfoHeading(extracted, /^(📋\s*)?(skill 信息|skill info)$/i) || cleanDetail(entry.description || entry.title || '');
}

function cleanMcpDetail(entry) {
  const source = normalizeDetailText(entry.detail || '');
  const extracted = removeRepoTemplateSections(source);
  return stripLeadingInfoHeading(extracted, /^(📋\s*)?(插件信息|plugin info)$/i) || cleanDetail(entry.description || entry.title || '');
}

function stripLeadingInfoHeading(text, headingPattern) {
  let value = normalizeDetailText(text);
  const sections = splitMarkdownSections(value);
  if (sections.length >= 2 && !sections[0].text && headingPattern.test(sections[1].heading)) {
    sections.splice(0, 2, { heading: '', rawHeading: '', text: sections[1].text });
    value = normalizeDetailText(sections.map((section) => section.rawHeading ? `## ${section.rawHeading}\n\n${section.text}` : section.text).filter(Boolean).join('\n\n'));
  }
  return value.replace(/^\*\*(描述|description):\*\*\s*/im, '').trim();
}

function hashId(prefix, value) {
  return `${prefix}-${crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16)}`;
}

function deriveState(issue) {
  const labels = new Set(issue.gh_labels || []);
  const publicLabel = PUBLIC_LABEL[issue.type];
  if (publicLabel && labels.has(publicLabel)) return 'approved';
  if (labels.has('review:rejected')) return 'rejected';
  if (labels.has('review:changes-requested')) return 'changes_requested';
  if (issue.gh_state === 'closed') return 'withdrawn';
  return 'pending';
}

function formatVersionFor(type) {
  if (type === 'package') return 'package_legacy_issue_v1';
  return `${type}_legacy_issue_v1`;
}

function getDescription(entry) {
  return cleanText(entry.description || entry.data?.projectDescription || entry.data?.description || entry.title || '', 100);
}

function getDetail(entry) {
  if (entry.type === 'script') return cleanArtifactDetail(entry, 'script');
  if (entry.type === 'package') return cleanArtifactDetail(entry, 'package');
  if (entry.type === 'skill') return cleanSkillDetail(entry);
  if (entry.type === 'mcp') return cleanMcpDetail(entry);
  return cleanDetail(entry.description || entry.title || '');
}

function guessCategory(entry) {
  const raw = CATEGORY_ALIASES[entry.category] || entry.category;
  if (VALID_CATEGORY_IDS.has(raw) && raw !== 'other') return raw;
  const text = `${entry.title || ''} ${entry.description || ''} ${entry.data?.repoUrl || ''}`.toLowerCase();
  let best = 'other';
  let bestScore = 0;
  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      best = rule.id;
      bestScore = score;
    }
  }
  return best;
}

function parseCategoryCsv(raw) {
  const map = new Map();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return map;
  const header = lines[0].split(',').map((s) => s.trim());
  const issueIdx = header.indexOf('issue_number');
  const finalIdx = header.indexOf('final_category_id');
  const suggestedIdx = header.indexOf('suggested_category');
  const autoIdx = header.indexOf('auto_category');
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const issueNumber = Number(cols[issueIdx >= 0 ? issueIdx : 0]);
    if (!Number.isFinite(issueNumber)) continue;
    const category = (
      cols[finalIdx]?.trim() ||
      cols[suggestedIdx]?.trim() ||
      cols[autoIdx]?.trim() ||
      ''
    );
    const mapped = CATEGORY_ALIASES[category] || category;
    if (VALID_CATEGORY_IDS.has(mapped) && mapped !== 'other') map.set(issueNumber, mapped);
  }
  return map;
}

function loadEnvLocal() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function base64Url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function githubAppToken() {
  loadEnvLocal();
  const appId = process.env.OPERIT_GITHUB_APP_ID;
  const installationId = process.env.OPERIT_GITHUB_INSTALLATION_ID;
  let key = process.env.OPERIT_GITHUB_PRIVATE_KEY;
  if (!key && process.env.OPERIT_GITHUB_PRIVATE_KEY_PATH && fs.existsSync(process.env.OPERIT_GITHUB_PRIVATE_KEY_PATH)) {
    key = fs.readFileSync(process.env.OPERIT_GITHUB_PRIVATE_KEY_PATH, 'utf8');
  }
  if (!appId || !installationId || !key) return null;
  key = key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 540, iss: appId };
  const encodedHeader = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), key);
  const jwt = `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'operit-market-migration',
    },
  });
  if (!res.ok) {
    console.warn(`GitHub App token failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const body = await res.json();
  return body.token || null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      out[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return out;
}

async function loadOwnerCache(entries) {
  const cache = fs.existsSync(OWNER_CACHE_PATH)
    ? JSON.parse(fs.readFileSync(OWNER_CACHE_PATH, 'utf8'))
    : {};
  const owners = new Set();
  for (const entry of entries) {
    if (entry.data?.kind !== 'repo') continue;
    const parsed = parseRepoUrl(entry.data.repoUrl);
    if (parsed) owners.add(parsed.owner.toLowerCase());
  }
  const missing = [...owners].filter((owner) => !cache[owner] || cache[owner].source !== 'github');
  if (!missing.length) {
    console.log(`Repo owner cache: ${Object.keys(cache).length} cached, 0 missing`);
    return cache;
  }
  const token = await githubAppToken();
  if (!token) {
    console.warn(`Repo owner cache: ${missing.length} missing, no GitHub token available; using synthetic negative ids for missing owners.`);
    for (const owner of missing) {
      cache[owner] = syntheticOwner(owner);
    }
    fs.writeFileSync(OWNER_CACHE_PATH, JSON.stringify(cache, null, 2));
    return cache;
  }
  console.log(`Repo owner cache: ${Object.keys(cache).length} cached, fetching ${missing.length} owners with concurrency 12`);
  await mapLimit(missing, 12, async (owner) => {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(owner)}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'operit-market-migration',
      },
    });
    if (!res.ok) {
      cache[owner] = syntheticOwner(owner, `github_${res.status}`);
      return;
    }
    const body = await res.json();
    cache[owner] = {
      id: Number(body.id),
      login: body.login || owner,
      avatar: body.avatar_url || `https://avatars.githubusercontent.com/${owner}`,
      profileUrl: body.html_url || `https://github.com/${owner}`,
      source: 'github',
    };
  });
  fs.writeFileSync(OWNER_CACHE_PATH, JSON.stringify(cache, null, 2));
  return cache;
}

function syntheticOwner(owner, source = 'synthetic') {
  const digest = crypto.createHash('sha1').update(owner).digest('hex').slice(0, 12);
  return {
    id: -Number.parseInt(digest, 16),
    login: owner,
    avatar: `https://avatars.githubusercontent.com/${owner}`,
    profileUrl: `https://github.com/${owner}`,
    source,
  };
}

function addAuthor(authorMap, githubId, login, avatar) {
  const numeric = Number(githubId);
  const id = authorId(numeric);
  if (!authorMap.has(id)) {
    authorMap.set(id, {
      id,
      github_id: numeric,
      github_login: login || 'unknown',
      owner_avatar: avatar || (numeric > 0 ? `https://avatars.githubusercontent.com/u/${numeric}?v=4` : null),
    });
  }
  return id;
}

function pickEntryState(versions) {
  const states = new Set(versions.map((v) => v.finalState));
  if (states.has('approved')) return 'approved';
  if (states.has('rejected')) return 'rejected';
  if (states.has('changes_requested')) return 'changes_requested';
  if (states.size === 1 && states.has('withdrawn')) return 'withdrawn';
  if (states.has('withdrawn') && states.size === 1) return 'withdrawn';
  return 'pending';
}

function pickDisplayEntry(entries) {
  const ranked = [...entries].sort((a, b) => {
    const stateRank = (b.finalState === 'approved' ? 1 : 0) - (a.finalState === 'approved' ? 1 : 0);
    if (stateRank !== 0) return stateRank;
    return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')) || Number(b.number) - Number(a.number);
  });
  return ranked[0] || entries[0];
}

function routeReasons(reasonCodes) {
  const entryReasons = [];
  const versionReasons = [];
  for (const code of reasonCodes || []) {
    if (VERSION_REASON_CODES.has(code)) versionReasons.push(code);
    else entryReasons.push(code);
  }
  return { entryReasons, versionReasons };
}

function run(db, sql, params = []) {
  db.run(sql, params);
}

function scalar(db, sql) {
  const r = db.exec(sql);
  return r[0]?.values?.[0]?.[0] ?? 0;
}

function rows(db, sql) {
  return db.exec(sql)[0]?.values || [];
}

function getSchema() {
  return fs.readFileSync(path.resolve(__dirname, '../migrations/001_init.sql'), 'utf8');
}

function executeSchema(db) {
  for (const stmt of getSchema().split(';').map((s) => s.trim()).filter(Boolean)) {
    db.run(`${stmt};`);
  }
}

function makeGroupKey(entry) {
  if (entry.data.kind === 'artifact') return `${entry.type}::${slug(entry.data.projectId)}`;
  const repo = parseRepoUrl(entry.data.repoUrl);
  if (!repo) return `${entry.type}::standalone-${entry.number}`;
  const subdir = repo.subdir ? `/${repo.subdir.toLowerCase()}` : '';
  return `${entry.type}::${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}${subdir}`;
}

function makeProjectEntryKey(entry) {
  if (entry.data.kind === 'artifact') return normalizeLegacyStatKey(entry.data.projectId);
  const repo = parseRepoUrl(entry.data.repoUrl);
  if (!repo) return `issue-${entry.number}`;
  return repo.subdir ? `github-com-${slug(repo.owner)}-${slug(repo.repo)}-${slug(repo.subdir)}` : `github-com-${slug(repo.owner)}-${slug(repo.repo)}`;
}

function legacyStatCandidatesForEntry(entry, entryId) {
  const candidates = new Set();
  const add = (value) => {
    const normalized = normalizeLegacyStatKey(value);
    if (normalized && normalized !== 'artifact') candidates.add(normalized);
  };
  add(entryId);
  add(makeProjectEntryKey(entry));
  if (entry.data?.kind === 'artifact') {
    add(entry.data.projectId);
    add(entry.data.normalizedId);
    add(entry.data.runtimePackageId);
    add(entry.data.assetName);
    add(entry.title);
  } else if (entry.data?.kind === 'repo') {
    add(canonicalizeMarketSource(entry.data.repoUrl));
    const repo = parseRepoUrl(entry.data.repoUrl);
    if (repo) {
      add(`${repo.owner}/${repo.repo}${repo.subdir ? `/${repo.subdir}` : ''}`);
      add(`github-com-${repo.owner}-${repo.repo}${repo.subdir ? `-${repo.subdir}` : ''}`);
    }
    add(entry.title);
  }
  return candidates;
}

function pickLegacyStats(statsMap, candidates) {
  let best = { downloads: 0, likes: 0, lastDownloadAt: null, updatedAt: null };
  for (const key of candidates) {
    const found = statsMap.get(key);
    if (!found) continue;
    if (Number(found.downloads || 0) > Number(best.downloads || 0) || Number(found.likes || 0) > Number(best.likes || 0)) best = found;
  }
  return best;
}

async function loadLegacyStatsByType(types) {
  const result = new Map();
  for (const type of types) result.set(type, await loadLegacyStats(type));
  return result;
}

async function loadLegacyStats(type) {
  const localPath = path.join(LEGACY_STATS_DIR, `${type}.json`);
  let json = null;
  if (fs.existsSync(localPath)) {
    json = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  } else {
    const url = `${STATIC_BASE}/market-stats/stats/${encodeURIComponent(type)}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch v1 stats baseline: ${url} -> ${response.status}`);
    json = await response.json();
    fs.mkdirSync(LEGACY_STATS_DIR, { recursive: true });
    fs.writeFileSync(localPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  }
  const items = json && typeof json === 'object' && !Array.isArray(json) && json.items && typeof json.items === 'object' ? json.items : {};
  const map = new Map();
  for (const [rawId, value] of Object.entries(items)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    map.set(normalizeLegacyStatKey(rawId), {
      downloads: toFiniteInt(value.downloads),
      likes: toFiniteInt(value.likes),
      lastDownloadAt: typeof value.lastDownloadAt === 'string' ? value.lastDownloadAt : null,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    });
  }
  console.log(`Legacy stats baseline ${type}: ${map.size}`);
  return map;
}

function toFiniteInt(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

async function main() {
  console.log('=== Operit Market v2 - Local SQLite Import ===\n');

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  executeSchema(db);
  console.log(`Schema tables: ${scalar(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'")}`);

  const rawEntries = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'all_parsed.json'), 'utf8'));
  const categoryCsv = fs.existsSync(path.join(OUTPUT_DIR, 'category_review.csv'))
    ? fs.readFileSync(path.join(OUTPUT_DIR, 'category_review.csv'), 'utf8')
    : '';
  const categoryMap = parseCategoryCsv(categoryCsv);
  console.log(`Category review mappings: ${categoryMap.size}`);

  const filtered = [];
  const skipped = [];
  for (const item of rawEntries) {
    const title = String(item.title || '').trim();
    if (item.type === 'mcp' && ['1', '111', '11111', '999999', '43646464', '测'].includes(title)) {
      skipped.push({ number: item.number, title, reason: 'garbage_mcp_title' });
      continue;
    }
    const finalState = deriveState(item);
    const repoMissingCommit = item.data?.kind === 'repo' && !item.data.commitSha;
    const adjustedState = repoMissingCommit && finalState === 'approved' ? 'changes_requested' : finalState;
    const reasons = [...(item.reasons || [])];
    if (repoMissingCommit && !reasons.includes('repository-unreachable')) reasons.push('repository-unreachable');
    filtered.push({ ...item, finalState: adjustedState, finalReasons: reasons, finalCategory: categoryMap.get(item.number) || guessCategory(item) });
  }
  console.log(`Valid parsed rows: ${filtered.length} (skipped ${skipped.length})`);

  const ownerCache = await loadOwnerCache(filtered);
  const legacyStatsByType = await loadLegacyStatsByType([...new Set(filtered.map((entry) => entry.type))].sort());
  const authorMap = new Map();
  for (const entry of filtered) {
    addAuthor(authorMap, entry.user_id, entry.user_login, entry.user_avatar);
    if (entry.data.kind === 'repo') {
      const repo = parseRepoUrl(entry.data.repoUrl);
      if (repo) {
        const owner = ownerCache[repo.owner.toLowerCase()] || syntheticOwner(repo.owner.toLowerCase());
        addAuthor(authorMap, owner.id, owner.login, owner.avatar);
      }
    }
  }

  const groups = new Map();
  for (const entry of filtered) {
    const key = makeGroupKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  console.log(`Entry groups: ${groups.size}`);

  const now = isoNow();
  db.run('BEGIN TRANSACTION');

  for (const author of authorMap.values()) {
    run(db,
      `INSERT OR IGNORE INTO market_authors (id, github_id, github_login, owner_avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [author.id, author.github_id, author.github_login, author.owner_avatar, now, now]
    );
  }

  const projectRootUpdates = [];
  const featuredEntries = new Map();
  const migrationNotes = [];
  let versionRowsAttempted = 0;

  for (const [groupKey, entries] of groups) {
    entries.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || Number(a.number) - Number(b.number));
    const first = entries[0];
    const display = pickDisplayEntry(entries);
    const entryId = makeEntryId(first.type, makeProjectEntryKey(first));
    const entryState = pickEntryState(entries);
    const publisherId = addAuthor(authorMap, display.user_id, display.user_login, display.user_avatar);
    let authorDbId = publisherId;

    if (display.data.kind === 'repo') {
      const repo = parseRepoUrl(display.data.repoUrl);
      if (repo) {
        const owner = ownerCache[repo.owner.toLowerCase()] || syntheticOwner(repo.owner.toLowerCase());
        authorDbId = addAuthor(authorMap, owner.id, owner.login, owner.avatar);
      }
    }

    const categoryId = VALID_CATEGORY_IDS.has(display.finalCategory) ? display.finalCategory : 'other';
    const publishedAt = entries.find((v) => v.finalState === 'approved')?.created_at || null;
    run(db,
      `INSERT OR IGNORE INTO market_entries (id, type, title, description, detail, author_id, publisher_id, category_id, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entryId, first.type, cleanText(display.title, 200), getDescription(display), getDetail(display), authorDbId, publisherId, categoryId, entryState, first.created_at || now, display.updated_at || first.updated_at || now, entryState === 'approved' ? publishedAt : null]
    );

    const legacyStats = pickLegacyStats(legacyStatsByType.get(first.type) || new Map(), legacyStatCandidatesForEntry(display, entryId));
    if (legacyStats.downloads > 0 || legacyStats.likes > 0) {
      const statsUpdatedAt = legacyStats.updatedAt || legacyStats.lastDownloadAt || now;
      run(db,
        `INSERT OR REPLACE INTO market_entry_stats (entry_id, type, legacy_downloads, legacy_likes, cf_downloads, cf_likes, downloads_total, likes_total, last_download_at, last_like_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, NULL, ?)`,
        [entryId, first.type, legacyStats.downloads, legacyStats.likes, legacyStats.downloads, legacyStats.likes, legacyStats.lastDownloadAt || null, statsUpdatedAt]
      );
      if (legacyStats.likes > 0) {
        run(db,
          `INSERT OR REPLACE INTO market_reaction_counts (id, entry_id, reaction, gh_count, cf_count, total_count, updated_at) VALUES (?, ?, '+1', ?, 0, ?, ?)`,
          [`reaction-${entryId}-+1`, entryId, legacyStats.likes, legacyStats.likes, statsUpdatedAt]
        );
      }
    }

    const allEntryReasons = new Set();
    for (const entry of entries) {
      const labels = entry.gh_labels || [];
      if (labels.includes('market:featured') && entryState === 'approved') featuredEntries.set(entryId, featuredEntries.size + 1);
      const { entryReasons } = routeReasons(entry.finalReasons);
      for (const reason of entryReasons) allEntryReasons.add(reason);
    }
    for (const reason of allEntryReasons) {
      run(db, `INSERT OR IGNORE INTO market_entry_reasons (entry_id, reason_code, created_at) VALUES (?, ?, ?)`, [entryId, reason, now]);
    }

    let projectId = null;
    const knownNodeIds = new Set();
    if (display.data.kind === 'artifact') {
      projectId = `${entryId}-project`;
      run(db,
        `INSERT OR IGNORE INTO artifact_projects (id, entry_id, project_key, runtime_pkg, root_node_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [projectId, entryId, `${first.type}:${display.data.projectId}`, display.data.runtimePackageId || null, now, now]
      );
    } else if (display.data.kind === 'repo') {
      run(db,
        `INSERT OR IGNORE INTO repo_plugin_specs (id, entry_id, source_kind, source_url, created_at, updated_at) VALUES (?, ?, 'github_repo', ?, ?, ?)`,
        [`${entryId}-spec`, entryId, normalizeRepoSourceUrl(display.data.repoUrl), now, now]
      );
    }

    const versionKeyCount = new Map();
    for (const entry of entries) {
      const rawVersion = String(entry.version || entry.data.version || (entry.data.kind === 'artifact' ? '1.0.0' : '0.0.0'));
      const versionKey = `${entryId}::${rawVersion}`;
      const count = (versionKeyCount.get(versionKey) || 0) + 1;
      versionKeyCount.set(versionKey, count);
      const version = count === 1 ? rawVersion : `${rawVersion}+legacy.${entry.number}`;
      const versionId = makeVersionId(entryId, version, null);
      const minApp = entry.data.minSupportedAppVersion || entry.data.minRuntimeVersion || '0.0.0';
      const maxApp = entry.data.maxSupportedAppVersion || null;
      versionRowsAttempted++;
      run(db,
        `INSERT OR IGNORE INTO market_versions (id, entry_id, version, format_ver, min_app_ver, max_app_ver, state_code, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [versionId, entryId, version, formatVersionFor(entry.type), minApp, maxApp, entry.finalState, entry.created_at || now, entry.updated_at || now, entry.finalState === 'approved' ? entry.created_at : null]
      );

      const { versionReasons } = routeReasons(entry.finalReasons);
      for (const reason of versionReasons) {
        run(db, `INSERT OR IGNORE INTO market_version_reasons (version_id, reason_code, created_at) VALUES (?, ?, ?)`, [versionId, reason, now]);
      }

      if (entry.data.kind === 'artifact') {
        const nodeKey = entry.data.nodeId || entry.data.rootNodeId || entry.data.projectId;
        const nodeId = `${projectId}-node-${slug(nodeKey)}`;
        knownNodeIds.add(nodeId);
        try {
          run(db,
            `INSERT OR IGNORE INTO artifact_nodes (id, project_id, version_id, node_key, runtime_pkg, display_name, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [nodeId, projectId, versionId, nodeKey, entry.data.runtimePackageId || null, cleanText(entry.data.projectDisplayName || entry.title, 200), getDescription(entry), now, now]
          );
        } catch (error) {
          throw new Error(`artifact_node insert failed entryId=${entryId} issue=${entry.number} projectId=${projectId} nodeId=${nodeId} versionId=${versionId}: ${error.message}`);
        }
        if ((entry.data.rootNodeId || nodeKey) === nodeKey) projectRootUpdates.push([nodeId, projectId]);
        if (entry.data.downloadUrl) {
          const assetId = `${versionId}-asset-${slug(entry.data.assetName || 'asset')}`;
          run(db,
            `INSERT OR IGNORE INTO market_assets (id, version_id, kind, url, gh_owner, gh_repo, gh_release_tag, asset_name, sha256, size_bytes, content_type, created_at) VALUES (?, ?, 'github_release_asset', ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
            [assetId, versionId, entry.data.downloadUrl, entry.data.ghOwner || null, entry.data.ghRepo || null, entry.data.releaseTag || null, entry.data.assetName || null, entry.data.sha256 || null, now]
          );
        }
      } else if (entry.data.kind === 'repo') {
        const repoVersionId = `${versionId}-repo`;
        run(db,
          `INSERT OR IGNORE INTO repo_plugin_versions (id, version_id, ref_type, ref_name, commit_sha, subdir, manifest_path, install_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [repoVersionId, versionId, entry.data.commitSha ? 'commit' : 'branch', entry.data.commitSha || 'unknown', entry.data.commitSha || '', entry.data.subdir || '', entry.data.manifestPath || '', entry.data.installConfig || '', now, now]
        );
      }
    }


    if (versionKeyCount.size !== entries.length) {
      migrationNotes.push({ entryId, groupKey, note: 'duplicate legacy version strings were kept with issue-number suffix ids' });
    }
  }

  for (const [rootNodeId, projectId] of projectRootUpdates) {
    run(db, `UPDATE artifact_projects SET root_node_id = ? WHERE id = ? AND root_node_id IS NULL`, [rootNodeId, projectId]);
  }

  for (const [entryId, position] of featuredEntries) {
    run(db,
      `INSERT OR IGNORE INTO market_curations (id, list_key, entry_id, position, note, created_at, updated_at) VALUES (?, 'featured', ?, ?, 'Migrated from legacy market:featured label', ?, ?)`,
      [`feat-${entryId}`, entryId, position, now, now]
    );
  }

  db.run('COMMIT');

  const fkRows = rows(db, 'PRAGMA foreign_key_check');
  const report = buildReport(db, {
    now,
    rawRows: rawEntries.length,
    validRows: filtered.length,
    skipped,
    categoryReviewMappings: categoryMap.size,
    ownerCacheSize: Object.keys(ownerCache).length,
    versionRowsAttempted,
    migrationNotes,
  });
  report.foreignKeyViolations = fkRows.map((r) => ({ table: r[0], rowid: r[1], parent: r[2], fkid: r[3] }));

  exportSql(db);
  const dbData = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(dbData));
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  printReport(report);
  if (fkRows.length) {
    console.error('Foreign key check failed. Not safe to import to D1.');
    process.exitCode = 1;
  }
  db.close();
}

function buildReport(db, extra) {
  const tableCounts = Object.fromEntries(SQL_EXPORT_ORDER.map(([table]) => [table, scalar(db, `SELECT COUNT(*) FROM ${table}`)]));
  tableCounts.market_comments = scalar(db, 'SELECT COUNT(*) FROM market_comments');
  return {
    migratedAt: extra.now,
    rawRows: extra.rawRows,
    validRows: extra.validRows,
    skippedRows: extra.skipped,
    categoryReviewMappings: extra.categoryReviewMappings,
    ownerCacheSize: extra.ownerCacheSize,
    tableCounts,
    stateDistribution: Object.fromEntries(rows(db, 'SELECT state_code, COUNT(*) FROM market_entries GROUP BY state_code').map(([k, v]) => [k, v])),
    versionStateDistribution: Object.fromEntries(rows(db, 'SELECT state_code, COUNT(*) FROM market_versions GROUP BY state_code').map(([k, v]) => [k, v])),
    typeDistribution: Object.fromEntries(rows(db, 'SELECT type, COUNT(*) FROM market_entries GROUP BY type').map(([k, v]) => [k, v])),
    categoryDistribution: Object.fromEntries(rows(db, 'SELECT COALESCE(category_id, "null"), COUNT(*) FROM market_entries GROUP BY category_id').map(([k, v]) => [k, v])),
    formatDistribution: Object.fromEntries(rows(db, 'SELECT format_ver, COUNT(*) FROM market_versions GROUP BY format_ver').map(([k, v]) => [k, v])),
    repoVersionsWithoutCommit: scalar(db, "SELECT COUNT(*) FROM repo_plugin_versions WHERE commit_sha = ''"),
    entriesWithRealDescription: scalar(db, "SELECT COUNT(*) FROM market_entries WHERE length(description) >= 10 AND description != title"),
    duplicateVersionNotes: extra.migrationNotes,
    sqlPath: SQL_PATH,
    dbPath: DB_PATH,
  };
}

function exportSql(db) {
  const lines = [
    '-- Operit Market v2 clean import SQL',
    '-- Generated by workers/market/v2/scripts/localImport.js',
    'PRAGMA defer_foreign_keys = 1;',
    '',
  ];
  for (const [table, columns] of SQL_EXPORT_ORDER) {
    const colList = columns.split(',').map((s) => s.trim());
    const resultRows = rows(db, `SELECT ${columns} FROM ${table} ORDER BY ${colList[0]}`);
    if (!resultRows.length) continue;
    lines.push(`-- ${table}`);
    const placeholders = colList.map(() => '?').join(', ');
    for (const row of resultRows) {
      lines.push(interpolateSql(`INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`, row) + ';');
    }
    lines.push('');
  }
  fs.writeFileSync(SQL_PATH, lines.join('\n'));
}

function printReport(report) {
  console.log('\n=== Verification ===');
  for (const [table, count] of Object.entries(report.tableCounts)) console.log(`${table}: ${count}`);
  console.log(`foreign_key_violations: ${report.foreignKeyViolations.length}`);
  console.log(`repo_versions_without_commit: ${report.repoVersionsWithoutCommit}`);
  console.log(`entries_with_real_description: ${report.entriesWithRealDescription}`);
  console.log(`SQL: ${report.sqlPath}`);
  console.log(`DB: ${report.dbPath}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
