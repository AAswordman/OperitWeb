import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseUrl = process.env.SITE_TEST_URL || 'http://127.0.0.1:4176/';
const configuredV2Url = process.env.SITE_TEST_V2_DOWNLOAD_URL || '';
const testFlightUrl = 'https://testflight.apple.com/join/hzq2xRrH';
const executablePath = process.env.BROWSER_EXECUTABLE || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
let server;
let browser;
let checks = 0;
const errors = [];
const requests = [];

async function check(name, fn) {
  await fn();
  checks += 1;
  console.log(`✓ ${name}`);
}

try {
  if (!process.env.SITE_TEST_URL) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], {
      cwd: root, windowsHide: true,
      env: { ...process.env, VITE_OPERIT_V2_DOWNLOAD_URL: configuredV2Url },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let serverOutput = '';
    server.stdout.on('data', chunk => { serverOutput += chunk; });
    server.stderr.on('data', chunk => { serverOutput += chunk; });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Test server failed: ${serverOutput}`);
      try { if ((await fetch(baseUrl)).ok) break; } catch { /* wait for startup */ }
      if (attempt === 99) throw new Error('Test server did not start');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url === 'https://api.github.com/repos/AAswordman/Operit/releases/latest') {
      void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ assets: [{ name: 'operit-v1-test.apk', browser_download_url: 'https://example.com/operit-v1-test.apk' }] }) });
    } else if (url.startsWith('https://static.operit.app/market/v2/')) {
      const value = url.endsWith('manifest.json') ? { marketVersion: 2, types: [], categories: [] } : {
        marketVersion: 2, total: 1, items: [{ id: 'smoke-shared-skill', type: 'skill', title: 'Shared fixture skill', description: 'One shared catalog for both generations', latestVersion: { version: '1.0', minAppVer: '1.0' } }],
      };
      void request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(value) });
    } else if (request.resourceType() === 'image' && !url.startsWith(baseUrl)) {
      void request.respond({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
    } else {
      void request.continue();
    }
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('language', 'zh');
    localStorage.setItem('operit-theme-v2', 'dark');
  });
  let navigation = 0;
  async function open(path, selector) {
    // A unique physical query forces a fresh document rather than Puppeteer
    // matching stale content during a same-document hash navigation.
    const url = new URL(baseUrl);
    url.searchParams.set('smoke', String(++navigation));
    url.hash = path;
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(selector, { timeout: 20000 });
  }
  const hrefs = selector => page.$$eval(`${selector} a[href]`, links => links.map(link => link.getAttribute('href')));
  const hash = () => page.evaluate(() => location.hash);

  await check('global download selector contains two independent destinations', async () => {
    await open('/download', '.version-card-grid');
    const links = await hrefs('.version-card-grid');
    assert(links.includes('#/v1/download') && links.includes('#/v2/download'));
  });
  await check('global guides select generations, not old/new document styles', async () => {
    await open('/guide', '.version-card-grid');
    const links = await hrefs('.version-card-grid');
    assert(links.includes('#/v1/guide') && links.includes('#/v2/guide'));
  });
  await check('generation-one overview links to its own downloads and tutorials', async () => {
    await open('/v1', '.classic-hero-primary');
    const links = await hrefs('.classic-hero-primary');
    assert(links.includes('#/v1/download') && links.includes('#/v1/guide'));
  });
  await check('generation-two overview links to its own downloads and tutorials', async () => {
    await open('/v2', '.release-hero');
    const links = await hrefs('.release-actions');
    assert(links.includes('#/v2/download') && links.includes('#/v2/guide'));
  });
  for (const path of ['/', '/v2']) {
    await check(`${path} platform links open the public TestFlight invite rather than an unavailable dialog`, async () => {
      await open(path, '.release-platform-ribbon');
      for (const selector of ['.release-platform-ribbon', '.release-platform-list']) {
        const links = await hrefs(selector);
        assert.equal(links.filter(href => href === testFlightUrl).length, 2);
      }
      assert.match(await page.$eval('.release-hero-content', element => element.textContent), /全平台/);
      assert.match(await page.$eval('.release-world-copy', element => element.textContent), /其他平台正在内测.*逐步开放/s);
      assert.equal(await page.$('.ant-modal'), null);
    });
  }
  await check('v1 download button retains its existing source-selection dialog', async () => {
    await open('/v1/download', '.version-download-panel');
    await page.waitForSelector('.version-download-actions button:not([disabled])');
    await page.click('.version-download-actions button');
    await page.waitForSelector('.ant-modal-body');
    assert.match(await page.$eval('.ant-modal-body', element => element.textContent), /下载/);
  });
  await check('v2 downloads never request the generation-one release API', async () => {
    const before = requests.filter(url => url.includes('api.github.com/repos/AAswordman/Operit/releases')).length;
    await open('/v2/download', '.version-download-panel');
    await page.waitForFunction(() => document.title.includes('Operit 2'));
    const text = await page.$eval('.version-download-panel', element => element.textContent);
    assert.match(text, /全平台/);
    assert.match(text, /其他平台.*内测.*逐步开放/);
    assert.doesNotMatch(text, /公开下载暂未开放/);
    const betaLinks = await page.$$eval('.version-platform-downloads a[data-platform]', links => links.map(link => ({
      platform: link.dataset.platform, href: link.href, target: link.target, rel: link.rel, text: link.textContent,
    })));
    assert.equal(betaLinks.length, 2);
    assert.deepEqual(betaLinks.map(link => link.platform), ['ios', 'macos']);
    for (const link of betaLinks) {
      assert.equal(link.href, testFlightUrl);
      assert.equal(link.target, '_blank');
      assert.match(link.rel, /noopener/);
      assert.match(link.text, /加入 .* 公测/);
    }
    if (configuredV2Url) {
      assert.equal(await page.$eval('.version-additional-download', element => element.href), configuredV2Url);
    } else assert.equal(await page.$('.version-additional-download'), null);
    assert.equal(requests.filter(url => url.includes('api.github.com/repos/AAswordman/Operit/releases')).length, before);
    assert(!(await hrefs('.version-download-panel')).some(url => url.includes('AAswordman/Operit/releases')));
    assert.match(await page.$eval('link[rel="canonical"]', element => element.href), /#\/v2\/download$/);
  });
  for (const [path, heading] of [
    ['/v1/guide', 'Operit 1 使用教程'],
    ['/v1/guide/beginner-tutorial/04-model-configuration', '模型'],
    ['/v1/guide/reference/basic-config/model-config', '模型'],
    ['/v2/guide', 'Operit 2 使用教程'],
    ['/v2/guide/release-information', '发布前说明'],
    ['/developers/plugins', '插件'],
  ]) {
    await check(`loads documentation at ${path}`, async () => {
      await open(path, '.markdown-body');
      assert.match(await page.$eval('.markdown-body', element => element.textContent), new RegExp(heading));
    });
  }
  await check('client-side documentation navigation never displays stale generation-one content', async () => {
    await open('/v1/guide', '.markdown-body');
    await page.click('.site-footer-column a[href="#/guide"]');
    await page.waitForSelector('.version-card-grid');
    await page.click('.version-card a[href="#/v2/guide"]');
    await page.waitForSelector('.markdown-renderer-root[data-markdown-path="v2content/zh/index.md"] .markdown-body');
    assert.equal(await page.$eval('.markdown-body h1', element => element.textContent), 'Operit 2 使用教程');
    await page.click('.version-docs-sidebar a[href="#/v2/guide/release-information"]');
    await page.waitForSelector('.markdown-renderer-root[data-markdown-path="v2content/zh/release-information.md"] .markdown-body');
    assert.equal(await page.$eval('.markdown-body h1', element => element.textContent), 'Operit 2 发布前说明');
  });
  await check('one-generation tutorial screenshot deep links still hide site navigation', async () => {
    await open('/guide/new/beginner-tutorial/04-model-configuration?mode=screenshot', '.markdown-body-screenshot');
    assert.equal(await hash(), '#/v1/guide/beginner-tutorial/04-model-configuration?mode=screenshot');
    assert.equal(await page.$('.site-header'), null);
    assert.equal(await page.$('.product-navigation'), null);
  });
  await check('v2 docs load only v2 Markdown, with no cross-generation fallback', async () => {
    const before = requests.length;
    await open('/v2/guide', '.markdown-body');
    const markdownRequests = requests.slice(before).filter(url => url.endsWith('.md'));
    assert(markdownRequests.some(url => url.includes('/v2content/')));
    assert(markdownRequests.every(url => url.includes('/v2content/')));
  });
  for (const [from, to] of [
    ['/classic', '/v1'],
    ['/guide/new/beginner-tutorial/04-model-configuration?source=bookmark', '/v1/guide/beginner-tutorial/04-model-configuration?source=bookmark'],
    ['/guide/old/basic-config/model-config?mode=screenshot', '/v1/guide/reference/basic-config/model-config?mode=screenshot'],
    ['/guide/quick-start', '/v1/guide/reference/quick-start'],
    ['/guide/plugin/typescript-basics', '/developers/plugins/typescript-basics'],
  ]) {
    await check(`preserves legacy deep link ${from}`, async () => {
      await open(from, from === '/classic' ? '.classic-hero' : '.markdown-body');
      assert.equal(await hash(), `#${to}`);
      if (from.includes('mode=screenshot')) assert.equal(await page.$('.site-header'), null);
    });
  }
  await check('legacy Markdown links are rendered as canonical developer links', async () => {
    await open('/developers/plugins', '.markdown-body');
    const links = await hrefs('.markdown-body');
    assert(links.some(url => new URL(url, baseUrl).hash.startsWith('#/developers/plugins/')));
    assert(!links.some(url => url.includes('/guide/plugin')));
  });
  for (const generation of ['v1', 'v2']) {
    await check(`${generation} market entry loads the same shared catalog and preserves filters`, async () => {
      await open(`/${generation}/market?market=skill&page=1&sort=updated`, '.market-item-title');
      assert.equal(await hash(), '#/market?market=skill&page=1&sort=updated');
      assert.equal(await page.$eval('.market-item-title', element => element.textContent), 'Shared fixture skill');
      assert.equal(await page.$('.product-navigation'), null);
    });
  }
  await check('unknown product routes show the existing 404 page', async () => {
    await open('/v2/not-a-page', '.ant-result-title');
    assert.equal(await page.$eval('.ant-result-title', element => element.textContent), '404');
  });
  await check('shared login route and next parameter remain unchanged', async () => {
    await open('/operit-login?next=%2Foperit-submission-center', 'input[type="password"]');
    assert.equal(await hash(), '#/operit-login?next=%2Foperit-submission-center');
  });
  await check('skip link focuses content without corrupting the HashRouter route', async () => {
    await open('/v2/download', '.version-download-panel');
    await page.focus('.site-skip');
    await page.keyboard.press('Enter');
    assert.equal(await hash(), '#/v2/download');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'site-content');
  });
  await check('English and light theme work on generation-two docs', async () => {
    await open('/v2/guide', '.markdown-body');
    await page.click('.site-settings-trigger');
    await page.$eval('#site-settings button', () => {
      const buttons = [...document.querySelectorAll('#site-settings button')];
      buttons.find(button => button.textContent.includes('EN')).click();
    });
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.waitForFunction(() => document.querySelector('.markdown-body h1')?.textContent === 'Operit 2 Guides');
    await page.$eval('#site-settings', () => [...document.querySelectorAll('#site-settings button')].find(button => button.textContent.includes('Light')).click());
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-theme'));
    assert.match(await page.title(), /Operit 2 Guides/);
  });
  await check('English download page retains both public-beta links and the other-platform testing notice', async () => {
    // Close the open preferences popover before using the product navigation.
    await page.keyboard.press('Escape');
    // Change the current language via client-side navigation, not a full reload.
    await page.click('.product-navigation-links a[href="#/v2/download"]');
    await page.waitForSelector('.version-platform-downloads');
    const panelText = await page.$eval('.version-download-panel', element => element.textContent);
    assert.match(panelText, /cross-platform/);
    assert.match(panelText, /Other platforms.*private testing/s);
    assert.match(panelText, /Join iOS beta/);
    assert.match(panelText, /Join macOS beta/);
    assert.equal((await hrefs('.version-platform-downloads')).filter(href => href === testFlightUrl).length, 2);
  });
  await check('mobile public-beta download cards fit the viewport and keep both platform links', async () => {
    await page.setViewport({ width: 390, height: 844 });
    await open('/v2/download', '.version-platform-downloads');
    const widths = await page.$$eval('.version-platform-download', cards => cards.map(card => card.getBoundingClientRect().width));
    assert(widths.every(width => width <= 390));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal((await hrefs('.version-platform-downloads')).filter(href => href === testFlightUrl).length, 2);
  });
  await check('mobile product menu stays within v2 and does not overflow', async () => {
    await page.setViewport({ width: 390, height: 844 });
    await open('/v2/download', '.version-download-panel');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.click('.site-mobile-trigger');
    await page.waitForSelector('.site-mobile-navigation');
    const links = await hrefs('.site-mobile-navigation');
    assert(links.includes('#/v2/download') && links.includes('#/v2/guide') && links.includes('#/market'));
  });
  await check('all pages render without JavaScript runtime errors', async () => assert.deepEqual(errors, []));
  console.log(`\n${checks} browser smoke checks passed.`);
} finally {
  await browser?.close();
  server?.kill();
}
