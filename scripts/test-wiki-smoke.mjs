import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('../', import.meta.url));
const prefix = process.env.WIKI_TEST_BASE || '/';
const port = process.env.WIKI_TEST_PORT || '4181';
const baseUrl = process.env.SITE_TEST_URL || `http://127.0.0.1:${port}${prefix}`;
const wikiPath = '/v1/guide/wiki';
const manifest = JSON.parse(await readFile(new URL('../public/operit-wiki/manifest.json', import.meta.url), 'utf8'));
const executablePath = process.env.BROWSER_EXECUTABLE || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
let server;
let browser;
let checks = 0;
let navigation = 0;
let preferenceScript;
let injection = false;
let manifestFailures = 0;
const errors = [];
const failedWikiResponses = [];
const requests = [];

async function check(name, fn) {
  if (process.env.WIKI_SMOKE_ONLY && !new RegExp(process.env.WIKI_SMOKE_ONLY).test(name)) return;
  try { await fn(); } catch (error) {
    const page = (await browser.pages()).at(-1);
    console.error('Failed check:', name, 'URL:', page.url(), 'Errors:', errors);
    console.error(await page.evaluate(() => ({ inputs: [...document.querySelectorAll('input')].map(element => element.value), body: document.querySelector('.wiki-search-results')?.textContent || document.querySelector('.docs-article')?.textContent?.slice(0, 1200) })));
    throw error;
  }
  console.log(`✓ ${name}`); checks++;
}

try {
  if (!process.env.SITE_TEST_URL) {
    const args = ['node_modules/vite/bin/vite.js'];
    if (process.env.WIKI_TEST_PREVIEW === '1') args.push('preview');
    args.push('--host', '127.0.0.1', '--port', port, '--strictPort', '--base', prefix);
    server = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    server.stdout.on('data', chunk => { output += chunk; });
    server.stderr.on('data', chunk => { output += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`Wiki test server failed: ${output}`);
      try { if ((await fetch(baseUrl)).ok) break; } catch { /* starting */ }
      if (attempt === 99) throw new Error(`Wiki test server timeout: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('response', response => {
    if (response.status() >= 400 && /\/(?:operit-wiki|content\/zh\/source-wiki)\//.test(response.url()) && response.status() !== 503) failedWikiResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.endsWith('/operit-wiki/manifest.json') && manifestFailures > 0) {
      manifestFailures--;
      void request.respond({ status: 503, contentType: 'application/json', body: '{}' });
    } else if (injection && url.endsWith('/content/zh/source-wiki/batch-02/api-chat.md')) {
      void request.respond({ status: 200, contentType: 'text/markdown', body: '# Sanitizer test\n<script>window.__wikiXss = true</script>\n<img src="x" onerror="window.__wikiXss = true">\n<a href="javascript:window.__wikiXss=true">bad</a>\n<p onclick="window.__wikiXss=true">safe text</p>\n\n## Heading\nText remains visible.' });
    } else if (url === 'https://api.github.com/repos/AAswordman/Operit/releases/latest') {
      void request.respond({ status: 200, contentType: 'application/json', body: '{"assets":[]}' });
    } else if (request.resourceType() === 'image' && !url.startsWith(baseUrl)) {
      void request.abort();
    } else void request.continue();
  });
  async function preferences(language = 'zh', theme = 'dark', dpi = 100) {
    if (preferenceScript) await page.removeScriptToEvaluateOnNewDocument(preferenceScript.identifier);
    preferenceScript = await page.evaluateOnNewDocument(value => {
      localStorage.setItem('language', value.language);
      localStorage.setItem('operit-theme-v2', value.theme);
      localStorage.setItem('dpi', String(value.dpi));
    }, { language, theme, dpi });
  }
  async function open(path, selector) {
    const url = new URL(baseUrl);
    url.searchParams.set('wiki-smoke', String(++navigation));
    url.hash = path;
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    try { await page.waitForSelector(selector); } catch (error) { console.error('Failed URL', page.url(), 'Page errors', errors, 'Body', (await page.$eval('body', element => element.textContent)).slice(-1600)); throw error; }
  }
  async function overflow() {
    return page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  }
  await preferences();
  await check('the guide selector and both existing v1 guide layouts expose the new knowledge base', async () => {
    for (const [path, selector] of [['/guide', '.version-card-grid'], ['/v1/guide', '.markdown-body'], ['/v1/guide/reference', '.docs-article']]) {
      await open(path, selector);
      assert(await page.$(`a[href="#${wikiPath}"]`), path);
    }
  });
  await check('home exposes every entry, source counts and provenance without eagerly downloading facts or full-text data', async () => {
    const before = requests.length;
    await open(wikiPath, '.wiki-home');
    assert.equal(await page.$$eval('.wiki-chapter li', elements => elements.length), 126);
    assert.equal(await page.$$eval('.wiki-chapter', elements => elements.length), 12);
    assert.match(await page.$eval('.wiki-stats', element => element.textContent), /124.*14,586.*1,033/);
    assert.match(await page.title(), /Operit 1.*源码知识库/);
    const newRequests = requests.slice(before);
    assert(!newRequests.some(url => url.endsWith('/search.json') || url.endsWith('.facts.json')));
  });
  await check('all 126 imported entries render at their own routes with no missing content', async () => {
    for (const entry of manifest.pages) {
      await page.evaluate(path => { location.hash = path; }, `${wikiPath}/${entry.id}`);
      const selector = `.markdown-renderer-root[data-markdown-path="content/zh/source-wiki/${entry.id}.md"] .markdown-body`;
      try { await page.waitForSelector(selector); } catch (error) { console.error('Failed URL', page.url(), 'Page errors', errors, 'Body', (await page.$eval('body', element => element.textContent)).slice(-1600)); throw error; }
      assert((await page.$eval(selector, element => element.textContent.length)) > 100, entry.id);
      assert.equal(await page.$('.ant-alert-error'), null, entry.id);
    }
  });
  await check('article source citations, cross-links and lazy facts use pinned valid paths', async () => {
    await open(`${wikiPath}/batch-02/api-chat`, '.markdown-body');
    const href = await page.$eval('.markdown-body a[href*="/blob/"]', element => element.getAttribute('href'));
    assert.match(href, /\/blob\/[a-f0-9]{40}\/.+#L\d+/);
    const internal = await page.$eval('.markdown-body a[href*="/guide/wiki/"]', element => element.getAttribute('href'));
    const resolvedInternal = new URL(internal, page.url());
    assert.equal(resolvedInternal.pathname, new URL(baseUrl).pathname);
    assert(resolvedInternal.hash.startsWith(`#${wikiPath}/`), internal);
    const before = requests.length;
    await page.click('.wiki-audit-panel > summary');
    await page.waitForSelector('.wiki-facts li a');
    assert.equal(await page.$$eval('.wiki-facts li', elements => elements.length), 30);
    assert(requests.slice(before).some(url => url.endsWith('api-chat.facts.json')));
    const factHref = await page.$eval('.wiki-facts li a', element => element.href);
    assert.match(factHref, /\/blob\/[a-f0-9]{40}\//);
    await page.click('.wiki-audit button');
    await page.waitForFunction(() => document.querySelectorAll('.wiki-facts li').length > 30);
    await page.evaluate(href => { location.href = href; }, internal);
    await page.waitForFunction(() => !location.hash.includes('batch-02/api-chat'));
    await page.waitForSelector('.markdown-body');
  });
  await check('full-text search finds body-only source terms and handles an empty result set', async () => {
    await open(wikiPath, '.wiki-home');
    await page.type('.wiki-sidebar-search input', 'JniBridge');
    await page.waitForSelector(`.wiki-search-results a[href*="batch-02/arch-overview"]`);
    await page.waitForFunction(() => !document.querySelector('.wiki-search-results').textContent.includes('全文搜索中'));
    assert(await page.$('.wiki-search-results small'));
    await page.click('.wiki-sidebar-search input', { clickCount: 3 });
    await page.type('.wiki-sidebar-search input', 'not-in-wiki-92e4');
    await page.waitForFunction(() => document.querySelector('.wiki-search-results')?.textContent.includes('未找到相关内容'));
    assert.equal(await page.$eval('.wiki-sidebar-search input', element => element.value), 'not-in-wiki-92e4');
    assert(page.url().includes('q=not-in-wiki-92e4'));
  });
  await check('the knowledge graph can select every entry and navigate actual link relationships', async () => {
    await open(`${wikiPath}/graph?entry=batch-02/api-chat`, '.wiki-graph');
    assert.equal(await page.$$eval('.wiki-graph select option', elements => elements.length), 126);
    assert((await page.$$eval('.wiki-graph-links li', elements => elements.length)) > 0);
    await page.select('.wiki-graph select', 'batch-09/ui-workflow');
    await page.waitForFunction(() => document.querySelector('.wiki-graph h2')?.textContent.includes('工作流界面'));
    assert.match(await page.$eval('.wiki-graph h2', element => element.textContent), /工作流界面/);
    assert.match(page.url(), /entry=batch-09%2Fui-workflow/);
  });
  await check('all review records remain visible with pagination, severity and entry filters', async () => {
    await open(`${wikiPath}/quality`, '.wiki-finding');
    assert.equal(await page.$$eval('.wiki-finding', elements => elements.length), 25);
    assert.match(await page.$eval('.wiki-quality [role="status"]', element => element.textContent), /1033/);
    await page.select('.wiki-filters select', 'warning');
    await page.waitForFunction(() => [...document.querySelectorAll('.wiki-severity')].every(element => element.textContent === '警告'));
    await page.select('.wiki-filters label:last-child select', 'batch-04/api-chat-claude');
    await page.waitForFunction(() => document.querySelector('.wiki-finding')?.textContent.includes('Claude') && [...document.querySelectorAll('.wiki-finding h2')].every(element => element.textContent.length > 0));
    assert.match(await page.$eval('.wiki-finding', element => element.textContent), /activeCall|Claude/);
    await page.select('.wiki-filters select', 'unspecified');
    await page.waitForFunction(() => location.hash.includes('severity=unspecified'));
    await page.select('.wiki-filters label:last-child select', 'batch-03/core-tools-websession-userscript');
    await page.waitForFunction(() => document.querySelectorAll('.wiki-finding').length === 4);
    assert.match(await page.$eval('.wiki-finding h2', element => element.textContent), /权限边界/);
    await open(`${wikiPath}/quality?page=2`, '.wiki-finding');
    assert.match(await page.$eval('.wiki-pager', element => element.textContent), /2 \/ 42/);
  });
  await check('the complete archive, license and honest external-data limitation are available', async () => {
    await open(`${wikiPath}/about`, '.wiki-about');
    assert.match(await page.$eval('.wiki-about', element => element.textContent), /404/);
    const archive = await page.$eval('.wiki-about a[download]', element => element.href);
    const response = await fetch(archive);
    assert.equal(response.status, 200);
    assert((await response.arrayBuffer()).byteLength > 1000000);
    const license = await page.$eval('.wiki-about a[href$="LICENSE.txt"]', element => element.href);
    assert.match(await (await fetch(license)).text(), /Copyright \(c\) 2026 luojiaping/);
  });
  await check('unknown entries do not request arbitrary files; manifest loading failures can be retried', async () => {
    await open(`${wikiPath}/batch-99/does-not-exist`, '.wiki-not-found');
    manifestFailures = 1;
    await open(wikiPath, '.ant-alert-error');
    await page.click('.ant-alert-error button');
    await page.waitForSelector('.wiki-home');
  });
  await check('imported raw HTML is sanitized while safe text remains readable', async () => {
    injection = true;
    await open(`${wikiPath}/batch-02/api-chat`, '.markdown-body');
    assert.equal(await page.$eval('.markdown-body h1', element => element.textContent), 'Sanitizer test');
    assert.equal(await page.$('.markdown-body script, .markdown-body [onerror], .markdown-body [onclick], .markdown-body a[href^="javascript:"]'), null);
    assert.equal(await page.evaluate(() => window.__wikiXss), undefined);
    assert.match(await page.$eval('.markdown-body', element => element.textContent), /safe text/);
    injection = false;
  });
  await check('English mode explicitly falls back to Chinese source text without changing product generation', async () => {
    await preferences('en', 'light');
    await open(`${wikiPath}/batch-02/api-chat`, '.markdown-body');
    assert.match(await page.$eval('.wiki-article-meta', element => element.textContent), /available in Chinese/);
    assert.match(await page.$eval('.markdown-body h1', element => element.textContent), /云端 Chat API/);
    assert.match(await page.title(), /Operit 1.*Source Knowledge Base/);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), null);
  });
  await check('mobile reading, focus-managed chapter navigation and small screens have no horizontal overflow', async () => {
    await preferences();
    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 844 });
      await open(wikiPath, '.wiki-home');
      let dimensions = await overflow();
      assert(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
      await page.click('.docs-directory-trigger');
      await page.waitForSelector('.ant-drawer-open .docs-drawer[role="dialog"]', { visible: true });
      await page.waitForFunction(() => document.querySelector('.docs-drawer').getBoundingClientRect().left >= 0);
      await page.waitForSelector('.docs-drawer .wiki-nav-chapter summary', { visible: true });
      await page.click('.docs-drawer .wiki-nav-chapter summary');
      await page.click(`.docs-drawer a[href="#${wikiPath}/batch-02/arch-overview"]`);
      await page.waitForSelector('.markdown-renderer-root[data-markdown-path="content/zh/source-wiki/batch-02/arch-overview.md"] .markdown-body');
      await page.waitForFunction(() => !document.querySelector('.ant-drawer-open'));
      dimensions = await overflow();
      assert(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
      await open(`${wikiPath}/quality`, '.wiki-finding');
      dimensions = await overflow();
      assert(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
    }
  });
  await check('existing v1 tutorials, references and separate v2 documentation remain intact', async () => {
    await page.setViewport({ width: 1440, height: 1000 });
    for (const [path, heading] of [['/v1/guide', 'Operit 1'], ['/v1/guide/reference/basic-config/model-config', '模型'], ['/v2/guide', 'Operit 2']]) {
      await open(path, '.markdown-body');
      assert.match(await page.$eval('.markdown-body', element => element.textContent), new RegExp(heading));
    }
    await open(wikiPath, '.wiki-home');
    await mkdir(new URL('../temp/', import.meta.url), { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('../temp/operit-wiki-desktop.png', import.meta.url)) });
    await page.setViewport({ width: 390, height: 844 });
    await open(`${wikiPath}/batch-02/api-chat`, '.markdown-body');
    await page.screenshot({ path: fileURLToPath(new URL('../temp/operit-wiki-mobile.png', import.meta.url)) });
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(failedWikiResponses, []);
  console.log(`Wiki smoke: ${checks} checks passed (base ${baseUrl}).`);
} finally {
  await browser?.close();
  if (server && server.exitCode === null) server.kill();
}
