import { readFile, writeFile, mkdir, readdir, copyFile, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

export const WIKI_ROUTE = '/v1/guide/wiki';
export const SNAPSHOT_REPOSITORY = 'jasonluoxray/Operit-wiki';
const root = fileURLToPath(new URL('../', import.meta.url));
const validId = /^(?:batch-\d{2}\/)?[a-z0-9_-]+$/;
const checksum = value => createHash('sha256').update(value).digest('hex');
const stripFrontmatter = text => text.replace(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n/, '');

export function resolveWikiId(value, entries) {
  if (!validId.test(value)) return undefined;
  const exact = entries.find(entry => entry.id === value);
  if (exact) return exact.id;
  const matches = entries.filter(entry => entry.id.split('/').at(-1) === value.split('/').at(-1));
  if (matches.length === 1) return matches[0].id;
  return undefined;
}

export function rewriteWikiLinks(markdown, entries, currentId, sourceCommit) {
  const edges = new Set();
  const rewrite = href => {
    const match = href.match(/^(?:(?:\.\.\/|\.\/)*)(entry|wiki)\.html\?([^#]*)(#.*)?$/);
    if (match) {
      const params = new URLSearchParams(match[2]);
      const id = resolveWikiId(params.get('id') || '', entries);
      if (!id) throw new Error(`Unknown wiki link in ${currentId}: ${href}`);
      edges.add(id);
      params.delete('id');
      return `/#${WIKI_ROUTE}/${id}${params.size ? `?${params}` : ''}${match[3] || ''}`;
    }
    if (/^(?:https?:|mailto:|#|\/)/i.test(href)) return href;
    if (/^[a-z0-9_./-]+\.md(?:#.*)?$/i.test(href)) {
      const [file, fragment] = href.split('#');
      const id = resolveWikiId(file.replace(/^(?:\.\.\/|\.\/)+/, '').replace(/^review\//, '').replace(/\.md$/, ''), entries);
      if (!id) throw new Error(`Unknown Markdown link in ${currentId}: ${href}`);
      edges.add(id);
      return `/#${WIKI_ROUTE}/${id}${fragment ? `#${fragment}` : ''}`;
    }
    if (href.includes('://')) return href;
    throw new Error(`Unsupported relative link in ${currentId}: ${href}`);
  };
  // Parse link destinations without touching fenced examples or inline code.
  const lines = stripFrontmatter(markdown).split('\n');
  let fence;
  const text = lines.map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      return line;
    }
    if (fence) return line;
    return line.split(/(`+[^`]*`+)/g).map((part, index) => {
      if (index % 2) {
        // Turn bare source file:line references into pinned, navigable citations.
        const ref = part.match(/^`([^`\s]+\.(?:kt|kts|java|cpp|c|h|ts|tsx|js|json|xml|py|sh|rs|md|toml|ps1|yaml|yml|mod|txt|html|css)):(\d+)(?:[-–](\d+))?`$/);
        if (ref && sourceCommit) return `[${part}](https://github.com/AAswordman/Operit/blob/${sourceCommit}/${ref[1]}#L${ref[2]}${ref[3] ? `-L${ref[3]}` : ''})`;
        return part;
      }
      return part.replace(/\]\(([^\s)]+)(\s+"[^"]*")?\)/g, (_, href, title = '') => `](${rewrite(href)}${title})`);
    }).join('');
  }).join('\n');
  return { markdown: text, links: [...edges].filter(id => id !== currentId).sort() };
}

async function optionalJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

async function installSnapshot(staging, directories) {
  const allowed = new Set(['public/operit-wiki', 'public/content/zh/source-wiki'].map(value => path.resolve(root, value)));
  const stage = path.resolve(staging);
  const insideStaging = value => path.resolve(value).startsWith(stage + path.sep);
  const moved = [];
  try {
    for (const [index, directory] of directories.entries()) {
      // Exact destination allowlist: never recursively delete/move a computed
      // path unless it resolves to one of the two generated output directories.
      const target = path.resolve(directory.target);
      const source = path.resolve(directory.source);
      if (!allowed.has(target) || !insideStaging(source)) throw new Error('Unsafe snapshot installation path');
      const backup = path.join(stage, `previous-${index}`);
      await mkdir(path.dirname(target), { recursive: true });
      let hadPrevious = false;
      try { await rename(target, backup); hadPrevious = true; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const record = { target, backup, hadPrevious, installed: false };
      moved.push(record);
      await rename(source, target);
      record.installed = true;
    }
  } catch (error) {
    for (const record of moved.reverse()) {
      if (!allowed.has(record.target) || !insideStaging(record.backup)) throw new Error('Unsafe snapshot rollback path');
      if (record.installed) await rm(record.target, { recursive: true, force: true });
      if (record.hadPrevious) await rename(record.backup, record.target);
    }
    throw error;
  }
}

export async function syncWiki(sourceDirectory) {
  const source = path.resolve(sourceDirectory);
  if (source === root || source.startsWith(path.join(root, 'public') + path.sep)) throw new Error('Use an independent upstream checkout as --source');
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', windowsHide: true }).trim();
  if (git('status', '--porcelain')) throw new Error('Upstream checkout must be clean so the snapshot and imported content match');
  const revision = git('rev-parse', 'HEAD');
  const queue = JSON.parse(await readFile(path.join(source, 'review-queue.json'), 'utf8'));
  // Upstream repeats a notes key; IDs and chapter coverage are validated separately.
  const outline = parse(await readFile(path.join(source, 'outline/outline-v3.yaml'), 'utf8'), { uniqueKeys: false });
  const entries = queue.entries;
  if (!Array.isArray(entries) || !entries.length || entries.some(entry => !validId.test(entry.id) || !entry.md || entry.md !== `review/${entry.id}.md` || entry.batch !== entry.id.split('/')[0])) throw new Error('Invalid upstream entry index');
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate upstream entry IDs');
  const chapters = outline.chapters.map(chapter => ({ title: chapter.chapter, entries: chapter.pages.map(page => {
    const id = resolveWikiId(page.id, entries);
    if (!id) throw new Error(`Missing outline entry: ${page.id}`);
    return id;
  }) }));
  const assigned = new Set(chapters.flatMap(chapter => chapter.entries));
  const appendix = chapters.find(chapter => chapter.title === '附录');
  for (const entry of entries.filter(entry => !assigned.has(entry.id) && entry.module !== 'meta')) {
    if (!appendix) throw new Error('No appendix chapter');
    appendix.entries.push(entry.id);
    assigned.add(entry.id);
  }
  const meta = entries.filter(entry => !assigned.has(entry.id));
  if (meta.length) chapters.push({ title: '编写大纲与维护资料', entries: meta.map(entry => entry.id) });
  if (new Set(chapters.flatMap(chapter => chapter.entries)).size !== entries.length) throw new Error('Incomplete chapter coverage');
  const temporaryRoot = path.resolve(root, 'temp');
  await mkdir(temporaryRoot, { recursive: true });
  const staging = await mkdtemp(path.join(temporaryRoot, 'operit-wiki-sync-'));
  try {
    const output = path.join(staging, 'assets');
    const content = path.join(staging, 'content');
    await mkdir(output, { recursive: true });
    const pages = [];
    const findings = [];
    let factCount = 0;
    for (const entry of entries) {
      const prefix = path.join(source, 'review', entry.id);
      const raw = await readFile(`${prefix}.md`, 'utf8');
      const status = await optionalJson(`${prefix}.status.json`, {});
      const facts = await optionalJson(`${prefix}.facts.json`, []);
      const quality = await optionalJson(`${prefix}.quality.json`, []);
      const sourceCommit = status.source_commit || '';
      if (sourceCommit && !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error(`Invalid source commit for ${entry.id}`);
      const transformed = rewriteWikiLinks(raw, entries, entry.id, sourceCommit);
      const artifacts = [];
      for (const name of (await readdir(path.dirname(prefix))).filter(name => name.startsWith(path.basename(prefix) + '.') && name !== path.basename(prefix) + '.md').sort()) {
        const asset = `artifacts/${entry.batch}/${name}`;
        await mkdir(path.dirname(path.join(output, asset)), { recursive: true });
        await copyFile(path.join(path.dirname(prefix), name), path.join(output, asset));
        artifacts.push({ name, path: asset });
      }
      await mkdir(path.dirname(path.join(content, `${entry.id}.md`)), { recursive: true });
      await writeFile(path.join(content, `${entry.id}.md`), transformed.markdown, 'utf8');
      const original = `original/${entry.id}.md`;
      await mkdir(path.dirname(path.join(output, original)), { recursive: true });
      await writeFile(path.join(output, original), raw, 'utf8');
      const count = Array.isArray(facts) ? facts.length : 0;
      factCount += count;
      const chapter = chapters.find(chapter => chapter.entries.includes(entry.id)).title;
      pages.push({ id: entry.id, title: entry.title, chapter, module: entry.module || '', status: status.status || entry.status,
        updated: status.updated || entry.updated || '', summary: entry.summary || '', sourceCommit, sourceRepository: 'AAswordman/Operit',
        facts: count, issue: entry.issue || null, links: transformed.links, artifacts, original,
        originalSha256: checksum(raw), contentSha256: checksum(transformed.markdown) });
      if (!Array.isArray(quality)) throw new Error(`Invalid quality data for ${entry.id}`);
      for (const [index, finding] of quality.entries()) {
        const severity = finding.severity === 'warn' ? 'warning' : finding.severity;
        const detail = String(finding.detail || finding.description || '');
        findings.push({ id: `${entry.id}#${index}`, page: entry.id, pageTitle: entry.title, sourceCommit,
          title: String(finding.title || finding.category || detail.slice(0, 90)), detail,
          evidence: Array.isArray(finding.evidence) ? finding.evidence.join('\n') : String(finding.evidence || ''),
          file: String(finding.file || ''), line: Number(finding.line) || 0,
          category: String(finding.category || ''), confidence: String(finding.confidence ?? ''),
          severity: ['high', 'warning', 'suggestion'].includes(severity) ? severity : 'unspecified', originalSeverity: finding.severity ?? null,
          raw: finding });
      }
    }
    const manifest = { schemaVersion: 1, repository: SNAPSHOT_REPOSITORY, revision, upstreamUpdated: queue.updated,
      license: 'MIT', copyright: 'Copyright (c) 2026 luojiaping', sourceLanguage: 'zh',
      counts: { entries: pages.length, articles: pages.filter(page => page.module !== 'meta').length, facts: factCount, findings: findings.length, links: pages.reduce((n, page) => n + page.links.length, 0) },
      chapters, pages };
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(path.join(output, 'quality.json'), JSON.stringify({ findings }, null, 2) + '\n');
    await writeFile(path.join(output, 'search.json'), JSON.stringify({ pages: await Promise.all(pages.map(async page => ({ id: page.id, title: page.title, chapter: page.chapter, text: await readFile(path.join(content, `${page.id}.md`), 'utf8') }))) }) + '\n');
    await copyFile(path.join(source, 'LICENSE'), path.join(output, 'LICENSE.txt'));
    await writeFile(path.join(output, 'NOTICE.txt'), `Operit-wiki snapshot\n${manifest.copyright}\nLicense: MIT (see LICENSE.txt)\nRepository: https://github.com/${SNAPSHOT_REPOSITORY}\nSnapshot commit: ${revision}\nOriginal issue repository: luojiaping/Operit-wiki (not migrated; issue numbers must not be reused in the backup repository).\nAdaptations: website routes, pinned source links, frontmatter removal, chapter/search/quality indexes.\nOriginal complete repository and original article text are retained alongside the adapted content.\n`);
    git('archive', '--format=zip', `--output=${path.join(output, 'upstream.zip')}`, 'HEAD');
    await installSnapshot(staging, [
      { source: output, target: path.join(root, 'public/operit-wiki') },
      { source: content, target: path.join(root, 'public/content/zh/source-wiki') },
    ]);
    console.log(`Imported ${pages.length} entries (${manifest.counts.articles} articles), ${factCount} facts, ${findings.length} review findings. Snapshot: ${revision}`);
    return manifest;
  } finally {
    const resolved = path.resolve(staging);
    if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('operit-wiki-sync-')) throw new Error('Unsafe temporary cleanup path');
    await rm(resolved, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--source');
  if (index < 0 || !process.argv[index + 1]) throw new Error('Usage: node scripts/sync-operit-wiki.mjs --source <clean upstream checkout>');
  await syncWiki(process.argv[index + 1]);
}

