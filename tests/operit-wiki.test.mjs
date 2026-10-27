import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import JSZip from 'jszip';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { resolveWikiId, rewriteWikiLinks, WIKI_ROUTE } from '../scripts/sync-operit-wiki.mjs';
import { validateSubmission } from '../workers/operit-api/src/workerShared.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const manifest = JSON.parse(await read('public/operit-wiki/manifest.json'));
const search = JSON.parse(await read('public/operit-wiki/search.json'));
const quality = JSON.parse(await read('public/operit-wiki/quality.json'));
const zip = await JSZip.loadAsync(await readFile(new URL('public/operit-wiki/upstream.zip', root)));
const queue = JSON.parse(await zip.file('review-queue.json').async('string'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const parser = unified().use(remarkParse);
const pagesById = new Map(manifest.pages.map(page => [page.id, page]));

async function loadTs(path, replacements = {}) {
  let text = await read(path);
  for (const [from, to] of Object.entries(replacements)) text = text.replaceAll(from, to);
  const { outputText } = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return { url, module: await import(url) };
}
const wiki = (await loadTs('src/utils/wiki.ts', { 'import.meta.env.BASE_URL': "'/'" })).module;
const products = await loadTs('src/config/products.ts');
const metadata = (await loadTs('src/config/routeMetadata.ts', { './products.ts': products.url })).module;
const markdownPaths = (await loadTs('src/utils/markdownPaths.ts')).module;
const navigation = (await loadTs('src/config/navigation.ts', { './products.ts': products.url })).module;

test('the pinned snapshot includes all entries, not just approved article headlines', () => {
  assert.equal(manifest.revision, '5e2f848db47d352754ba614c2138fa03b9c5ce93');
  assert.equal(manifest.repository, 'jasonluoxray/Operit-wiki');
  assert.equal(manifest.counts.entries, 126);
  assert.equal(manifest.counts.articles, 124);
  assert.equal(manifest.counts.facts, 14586);
  assert.equal(manifest.counts.findings, 1033);
  assert.deepEqual(new Set(manifest.pages.map(page => page.id)), new Set(queue.entries.map(page => page.id)));
  const ordered = manifest.chapters.flatMap(chapter => chapter.entries);
  assert.equal(ordered.length, 126);
  assert.equal(new Set(ordered).size, 126);
  assert.equal(manifest.chapters.length, 12);
  assert.equal(manifest.pages.filter(page => page.module === 'meta').length, 2);
  assert(zip.file('site/index.html'));
  assert(zip.file('scripts/build_wiki_data.py'));
  assert(zip.file('wiki/AI_USAGE.md'));
  assert(zip.file('SCHEMA.md'));
  assert(zip.file('tracking/read-status.json'));
});

test('every article has original text, checked hashes, all artifacts and a permitted editing path', async () => {
  let facts = 0;
  for (const page of manifest.pages) {
    assert.match(page.id, /^batch-\d{2}\/[a-z0-9_-]+$/);
    const original = await read(`public/operit-wiki/${page.original}`);
    const contentPath = `content/zh/source-wiki/${page.id}.md`;
    const adapted = await read(`public/${contentPath}`);
    const archived = await zip.file(`review/${page.id}.md`).async('string');
    assert.equal(original.replaceAll('\r\n', '\n'), archived.replaceAll('\r\n', '\n'), page.id);
    assert.equal(sha256(original), page.originalSha256, page.id);
    assert.equal(sha256(adapted), page.contentSha256, page.id);
    assert(!adapted.startsWith('---\n'), page.id);
    assert(markdownPaths.isEditableMarkdownPath(contentPath));
    const submission = validateSubmission({ type: 'edit', language: 'zh', target_path: contentPath, title: page.title, content: adapted });
    assert(submission.ok, `${page.id}: ${submission.errors.join(', ')}`);
    const expectedArtifacts = Object.keys(zip.files).filter(file => file.startsWith(`review/${page.id}.`) && file !== `review/${page.id}.md`);
    assert.equal(page.artifacts.length, expectedArtifacts.length, page.id);
    for (const artifact of page.artifacts) {
      const content = await read(`public/operit-wiki/${artifact.path}`);
      const archivedContent = await zip.file(`review/${page.id.slice(0, page.id.indexOf('/'))}/${artifact.name}`).async('string');
      assert.equal(content.replaceAll('\r\n', '\n'), archivedContent.replaceAll('\r\n', '\n'), artifact.path);
      if (artifact.name.endsWith('.facts.json')) {
        const values = JSON.parse(content);
        assert.equal(values.length, page.facts);
        facts += values.length;
      }
    }
  }
  assert.equal(facts, manifest.counts.facts);
});

test('all real article links resolve and the graph uses exactly those explicit relationships', async () => {
  let count = 0;
  for (const page of manifest.pages) {
    const adapted = await read(`public/content/zh/source-wiki/${page.id}.md`);
    const links = new Set();
    visit(parser.parse(adapted), 'link', node => {
      assert(!/^(entry|wiki)\.html/.test(node.url), `${page.id}: stale ${node.url}`);
      assert(!/^javascript:/i.test(node.url));
      if (node.url.startsWith(`/#${WIKI_ROUTE}/`)) {
        const id = node.url.slice(`/#${WIKI_ROUTE}/`.length).split(/[?#]/)[0];
        assert(pagesById.has(id), `${page.id}: missing ${id}`);
        if (id !== page.id) links.add(id);
      }
      if (node.url.startsWith('https://github.com/AAswordman/Operit/blob/')) {
        assert(node.url.startsWith(`https://github.com/AAswordman/Operit/blob/${page.sourceCommit}/`), node.url);
      }
    });
    assert.deepEqual([...links].sort(), page.links, page.id);
    count += page.links.length;
  }
  assert.equal(count, manifest.counts.links);
  assert(count > 100);
});

test('source search covers every document and searches body text, multiword queries and case-insensitive IDs', () => {
  assert.deepEqual(new Set(search.pages.map(page => page.id)), new Set(manifest.pages.map(page => page.id)));
  const body = wiki.searchWiki(manifest.pages, search.pages, 'JniBridge');
  assert(body.some(result => result.page.id === 'batch-02/arch-overview'));
  assert(wiki.searchWiki(manifest.pages, search.pages, '工作流').length > 10);
  assert(wiki.searchWiki(manifest.pages, search.pages, 'API-CHAT').some(result => result.page.id === 'batch-02/api-chat'));
  assert(wiki.searchWiki(manifest.pages, search.pages, 'Room DAO').length > 0);
  assert.equal(wiki.searchWiki(manifest.pages, search.pages, 'definitely-not-in-wiki-92e4').length, 0);
  assert.equal(wiki.searchWiki(manifest.pages, search.pages, '   ').length, 0);
});

test('all code-review findings and evidence survive import with explicit severity normalization', async () => {
  let count = 0;
  const archivedFindings = [];
  for (const page of manifest.pages) {
    const file = zip.file(`review/${page.id}.quality.json`);
    if (!file) continue;
    for (const [index, finding] of JSON.parse(await file.async('string')).entries()) {
      archivedFindings.push({ id: `${page.id}#${index}`, raw: finding });
    }
  }
  for (const finding of quality.findings) {
    assert(pagesById.has(finding.page));
    const original = archivedFindings.find(item => item.id === finding.id)?.raw;
    assert(original, finding.id);
    assert.deepEqual(finding.raw, original);
    assert.equal(finding.detail, original.detail || original.description || '');
    assert.equal(finding.evidence, Array.isArray(original.evidence) ? original.evidence.join('\n') : original.evidence || '');
    assert.equal(finding.originalSeverity, original.severity ?? null);
    assert(finding.title.length > 0);
    assert(['high', 'warning', 'suggestion', 'unspecified'].includes(finding.severity));
    if (!original.severity) assert.equal(finding.severity, 'unspecified');
    if (original.severity === 'warn') assert.equal(finding.severity, 'warning');
    count++;
  }
  assert.equal(count, archivedFindings.length);
  assert.equal(count, 1033);
});

test('link rewriting preserves fragments, queries and code examples; missing targets fail loudly', () => {
  const entries = [{ id: 'batch-02/foo' }, { id: 'batch-03/bar' }];
  const commit = 'a'.repeat(40);
  const value = '[bar](entry.html?id=batch-03/bar&mode=screenshot#heading)\n[foo](wiki.html?id=foo)\n`app/Test.kt:12`\n```md\n[example](entry.html?id=not-a-real-page)\n```';
  const result = rewriteWikiLinks(value, entries, 'batch-02/foo', commit);
  assert(result.markdown.includes('/#/v1/guide/wiki/batch-03/bar?mode=screenshot#heading'));
  assert(result.markdown.includes('/#/v1/guide/wiki/batch-02/foo'));
  assert(result.markdown.includes(`/blob/${commit}/app/Test.kt#L12`));
  assert(result.markdown.includes('[example](entry.html?id=not-a-real-page)'));
  assert.deepEqual(result.links, ['batch-03/bar']);
  assert.equal(resolveWikiId('bar', entries), 'batch-03/bar');
  assert.equal(resolveWikiId('../bar', entries), undefined);
  assert.equal(resolveWikiId('bar', [...entries, { id: 'batch-04/bar' }]), undefined);
  assert.throws(() => rewriteWikiLinks('[bad](wiki.html?id=missing)', entries, 'batch-02/foo', commit), /Unknown wiki link/);
  assert.throws(() => rewriteWikiLinks('[bad](missing.md)', entries, 'batch-02/foo', commit), /Unknown Markdown link/);
});

test('source references cannot point at moving branches or malformed paths', () => {
  const commit = manifest.pages.find(page => page.sourceCommit).sourceCommit;
  assert.equal(wiki.sourceReferenceUrl(commit, 'app/src/Test.kt:12-15'), `https://github.com/AAswordman/Operit/blob/${commit}/app/src/Test.kt#L12-L15`);
  for (const value of ['../secret.kt:1', 'app//Test.kt:1', 'javascript:alert(1)', 'foo.kt', 'foo.kt:not-a-line', 'foo.kt:0', 'foo.kt:10-2']) assert.equal(wiki.sourceReferenceUrl(commit, value), undefined);
  assert.equal(wiki.sourceReferenceUrl('main', 'foo.kt:1'), undefined);
  assert.equal(wiki.wikiAssetUrl('manifest.json', '/OperitWeb/'), '/OperitWeb/operit-wiki/manifest.json');
});

test('the knowledge base remains generation-one-only and retains its own metadata', () => {
  for (const language of ['zh', 'en']) {
    assert.match(metadata.getRouteMetadata(WIKI_ROUTE, language).title, /Operit 1/);
    assert.match(metadata.getRouteMetadata(`${WIKI_ROUTE}/quality`, language).title, language === 'zh' ? /代码走查/ : /Code-review/);
  }
  assert.equal(navigation.getNavigationContext(`${WIKI_ROUTE}/batch-02/api-chat`).product.id, 'v1');
  assert.equal(navigation.getProductSwitchPath(`${WIKI_ROUTE}/batch-02/api-chat`, products.module.PRODUCTS.v2), '/v2/guide');
  assert.equal(products.module.PRODUCTS.v2.markdownRoot, 'v2content');
  assert.deepEqual(markdownPaths.buildMarkdownCandidates('source-wiki/batch-02/api-chat', 'zh'), ['content/zh/source-wiki/batch-02/api-chat.md']);
});

test('MIT license, original copyright and honest provenance accompany the snapshot', async () => {
  const license = await read('public/operit-wiki/LICENSE.txt');
  assert.match(license, /Copyright \(c\) 2026 luojiaping/);
  assert.equal(license.replaceAll('\r\n', '\n'), (await zip.file('LICENSE').async('string')).replaceAll('\r\n', '\n'));
  const notice = await read('public/operit-wiki/NOTICE.txt');
  assert(notice.includes(manifest.revision));
  assert(notice.includes(manifest.repository));
  const files = await readdir(new URL('public/operit-wiki/', root));
  assert(!files.includes('index.html'), 'Do not serve the old unsanitized app as a second site');
});
