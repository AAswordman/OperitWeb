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
  let preferences = { language: 'zh', theme: 'dark', dpi: 100 };
  let preferenceScript;
  async function applyPreferences(language, theme, dpi = 100) {
    preferences = { language, theme, dpi };
    if (preferenceScript) await page.removeScriptToEvaluateOnNewDocument(preferenceScript.identifier);
    preferenceScript = await page.evaluateOnNewDocument(value => {
      localStorage.setItem('language', value.language);
      localStorage.setItem('operit-theme-v2', value.theme);
      localStorage.setItem('dpi', String(value.dpi));
    }, preferences);
  }
  await applyPreferences('zh', 'dark');
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
    assert.match(text, /Android.*Windows.*Linux/);
    assert.doesNotMatch(text, /公开下载暂未开放/);
    const betaLinks = await page.$$eval('.version-platform-downloads a[data-platform]', links => links.map(link => ({
      platform: link.dataset.platform, href: link.href, target: link.target, rel: link.rel, text: link.textContent,
    })));
    assert.equal(betaLinks.length, 5);
    assert.deepEqual(betaLinks.map(link => link.platform), ['android', 'ios', 'windows', 'macos', 'linux']);
    for (const link of betaLinks) {
      if (['ios', 'macos'].includes(link.platform)) {
        assert.equal(link.href, testFlightUrl);
        assert.equal(link.target, '_blank');
        assert.match(link.rel, /noopener/);
      } else {
        const destination = new URL(link.href);
        assert.equal(destination.protocol, 'mqqapi:');
        assert.equal(destination.searchParams.get('uin'), '1121622579');
        assert.equal(destination.searchParams.get('card_type'), 'group');
      }
      assert.match(link.text, /加入 .* 公测/);
    }
    assert.doesNotMatch(text, /1121622579|QQ|其他平台/);
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
    await page.click('.docs-footer a[href="#/guide"]');
    await page.waitForSelector('.version-card-grid');
    await page.click('.version-card a[href="#/v2/guide"]');
    await page.waitForSelector('.markdown-renderer-root[data-markdown-path="v2content/zh/index.md"] .markdown-body');
    assert.equal(await page.$eval('.markdown-body h1', element => element.textContent), 'Operit 2 使用教程');
    await page.click('.docs-sidebar a[href="#/v2/guide/release-information"]');
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
  await check('English download page lists every platform with its own beta entry', async () => {
    // Close the open preferences popover before using the product navigation.
    await page.keyboard.press('Escape');
    // Change the current language via client-side navigation, not a full reload.
    await page.click('.site-header-start[href="#/v2/download"]');
    await page.waitForSelector('.version-platform-downloads');
    const panelText = await page.$eval('.version-download-panel', element => element.textContent);
    assert.match(panelText, /cross-platform/);
    assert.match(panelText, /Android.*Windows.*Linux/s);
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
  // Exercise real layout bounds; an overflow-x mask is not evidence that
  // individual controls are visible or that sticky navigation actually works.
  const docRoutes = [
    '/v2/guide',
    '/v1/guide/beginner-tutorial/04-model-configuration',
    '/v1/guide/reference/basic-config/model-config',
    '/developers/plugins',
    '/developers/plugins/toolpkg-basics',
  ];
  for (const width of [320, 390, 768, 980, 1024, 1440]) {
    await page.setViewport({ width, height: 900 });
    for (const route of docRoutes) {
      await check(`${route} has a readable, non-overlapping layout at ${width}px`, async () => {
        await open(route, '.docs-article .markdown-body :is(h1,h2,h3)');
        const layout = await page.evaluate(() => {
          const header = document.querySelector('.site-header').getBoundingClientRect();
          const heading = document.querySelector('.docs-article .markdown-body :is(h1,h2,h3)').getBoundingClientRect();
          const article = document.querySelector('.docs-article').getBoundingClientRect();
          const product = document.querySelector('.product-navigation');
          const trigger = document.querySelector('.docs-directory-trigger');
          const innerScrollers = [...document.querySelectorAll('.docs-article, .docs-article *')].filter(element => {
            const style = getComputedStyle(element);
            return ['auto', 'scroll'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
          });
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            headingTop: heading.top, headingLeft: heading.left, headingRight: heading.right,
            headerBottom: header.bottom, articleLeft: article.left, articleRight: article.right,
            productVisible: product && getComputedStyle(product).display !== 'none',
            triggerVisible: trigger && getComputedStyle(trigger).display !== 'none',
            triggerInHeader: Boolean(trigger?.closest('.site-header')),
            extraBar: Boolean(document.querySelector('.docs-mobile-toolbar')),
            headers: document.querySelectorAll('.site-header').length,
            directoryTop: document.querySelector('.docs-sidebar')?.getBoundingClientRect().top,
            sidebarVisible: Boolean(document.querySelector('.docs-sidebar')),
            innerScrollers: innerScrollers.map(element => element.className),
            headerLinksFit: [...document.querySelectorAll('.site-header-inner a, .site-header-inner button')]
              .filter(element => element.getClientRects().length)
              .every(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }),
          };
        });
        assert.equal(layout.overflow, false, JSON.stringify(layout));
        assert.equal(layout.headerLinksFit, true, JSON.stringify(layout));
        assert(layout.headingTop > layout.headerBottom, JSON.stringify(layout));
        assert(layout.headingLeft >= 0 && layout.headingRight <= width, JSON.stringify(layout));
        assert.deepEqual(layout.innerScrollers, [], 'Reading must use document scrolling, not an inner viewport');
        assert.equal(layout.productVisible, null, 'A second product navigation must never be rendered');
        assert.equal(layout.extraBar, false);
        assert.equal(layout.headers, 1);
        if (width <= 980) {
          assert.equal(layout.triggerVisible, true);
          assert.equal(layout.triggerInHeader, true);
          assert.equal(layout.sidebarVisible, false);
          assert(layout.headingTop < 300, `Heading pushed below the first screen: ${layout.headingTop}`);
        } else {
          assert.equal(layout.sidebarVisible, true);
          assert(layout.directoryTop >= layout.headerBottom - 1, JSON.stringify(layout));
          assert.equal(layout.triggerVisible, false);
          assert(layout.articleLeft > 240, JSON.stringify(layout));
        }
        const editAfterContent = await page.evaluate(() => {
          const edit = document.querySelector('.markdown-edit-bar');
          const body = document.querySelector('.markdown-body');
          return !edit || Boolean(body.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
        assert(editAfterContent, 'Editing tools must not displace the article heading');
      });
    }
  }

  for (const width of [320, 768, 1024]) {
    await page.setViewport({ width, height: 900 });
    for (const [route, selector] of [
      ['/', '.release-hero'], ['/v1', '.classic-hero-primary'], ['/v2', '.release-hero'],
      ['/download', '.version-card-grid'], ['/guide', '.version-card-grid'],
      ['/v1/download', '.version-download-panel'], ['/v2/download', '.version-download-panel'],
      ['/market', '.market-item-title'],
    ]) {
      await check(`${route} keeps navigation and content within ${width}px`, async () => {
        await open(route, selector);
        const bounds = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth, viewport: innerWidth,
          headerFits: [...document.querySelectorAll('.site-header-inner a, .site-header-inner button')]
            .filter(element => element.getClientRects().length)
            .every(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }),
          cardsFit: [...document.querySelectorAll('.version-card, .version-download-panel, .version-platform-download')]
            .every(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }),
        }));
        assert(bounds.document <= bounds.viewport, JSON.stringify(bounds));
        assert(bounds.headerFits && bounds.cardsFit, JSON.stringify(bounds));
      });
    }
  }

  await check('desktop directory stays below the single header while scrolling', async () => {
    await page.setViewport({ width: 1440, height: 900 });
    await open('/v1/guide/beginner-tutorial/04-model-configuration', '.docs-article .markdown-body');
    await page.evaluate(() => window.scrollTo(0, 450));
    const positions = await page.evaluate(() => ({
      header: document.querySelector('.site-header').getBoundingClientRect().bottom,

      directory: document.querySelector('.docs-sidebar').getBoundingClientRect().top,
      scroll: scrollY,
    }));
    assert(positions.scroll > 300);
    assert(positions.directory >= positions.header, JSON.stringify(positions));
    assert.equal(await page.$('.product-navigation'), null);
  });
  await check('mobile directory closes on Escape and restores trigger focus', async () => {
    await page.setViewport({ width: 390, height: 844 });
    await open('/v2/guide', '.docs-directory-trigger');
    await page.click('.docs-directory-trigger');
    await page.waitForSelector('.ant-drawer-open .docs-drawer[role="dialog"]', { visible: true });
    assert.equal(await page.$eval('.docs-directory-trigger', element => element.getAttribute('aria-expanded')), 'true');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.docs-drawer[role="dialog"]', { hidden: true });
    assert.equal(await page.$eval('.docs-directory-trigger', element => element.getAttribute('aria-expanded')), 'false');
    await page.waitForFunction(() => document.activeElement?.classList.contains('docs-directory-trigger'));
  });
  await check('mobile directory follows a deep link and closes without blocking the document', async () => {
    await page.click('.docs-directory-trigger');
    await page.waitForSelector('.ant-drawer-open .docs-drawer a[href="#/v2/guide/release-information"]', { visible: true });
    await page.waitForFunction(() => document.querySelector('.docs-drawer').getBoundingClientRect().left >= 0);
    await page.click('.docs-drawer a[href="#/v2/guide/release-information"]');
    await page.waitForFunction(() => location.hash === '#/v2/guide/release-information');
    await page.waitForSelector('.docs-drawer[role="dialog"]', { hidden: true });
    await page.waitForSelector('.markdown-body h1');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
    await open('/v1/guide/beginner-tutorial/04-model-configuration', '.docs-article .markdown-body');
    await page.evaluate(() => window.scrollTo(0, 350));
    assert(await page.evaluate(() => scrollY > 300));
    assert.equal(await page.$('.docs-mobile-toolbar'), null);
    assert(await page.$eval('.docs-directory-trigger', element => element.getBoundingClientRect().top >= 0));
  });
  await check('resizing an open mobile directory to desktop removes the overlay', async () => {
    await open('/v1/guide', '.docs-directory-trigger');
    await page.click('.docs-directory-trigger');
    await page.waitForSelector('.ant-drawer-open .docs-drawer[role="dialog"]', { visible: true });
    await page.setViewport({ width: 1440, height: 900 });
    await page.waitForSelector('.docs-sidebar');
    await page.waitForSelector('.docs-drawer', { hidden: true });
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
  });
  await check('single-row product switch preserves downloads and documentation context', async () => {
    await page.setViewport({ width: 1440, height: 900 });
    await open('/v1/download', '.version-download-panel');
    await page.click('.site-version-trigger');
    assert((await hrefs('#site-products')).includes('#/v2/download'));
    await page.click('#site-products a[href="#/v2/download"]');
    await page.waitForFunction(() => location.hash === '#/v2/download');
    await page.waitForSelector('.version-platform-downloads');
    assert.equal(await page.$('.product-navigation'), null);
    await open('/v1/guide/reference/basic-config/model-config', '.markdown-body');
    await page.click('.site-version-trigger');
    assert((await hrefs('#site-products')).includes('#/v2/guide'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('#site-products', { hidden: true });
    await page.waitForFunction(() => document.activeElement?.classList.contains('site-version-trigger'));
  });
  await check('resources have a discoverable developer destination and close with Escape', async () => {
    await page.click('.site-navigation button[aria-controls="site-resources"]');
    await page.waitForSelector('#site-resources');
    assert((await hrefs('#site-resources')).includes('#/developers/plugins'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('#site-resources', { hidden: true });
  });
  await check('desktop page outline creates shareable anchors without breaking HashRouter', async () => {
    await page.setViewport({ width: 1440, height: 600 });
    await open('/v2/guide', '.docs-toc nav a');
    const href = await page.$eval('.docs-toc nav a', element => element.getAttribute('href'));
    assert(href.startsWith('#/v2/guide#section-'));
    await page.click('.docs-toc nav a');
    await page.waitForFunction(() => location.hash.startsWith('#/v2/guide#section-'));
    const anchor = await page.evaluate(() => {
      const routeHash = location.hash.slice(1);
      const id = decodeURIComponent(routeHash.slice(routeHash.indexOf('#') + 1));
      const target = document.getElementById(id);
      return { top: target?.getBoundingClientRect().top, header: document.querySelector('.site-header').getBoundingClientRect().bottom };
    });
    assert(anchor.top >= anchor.header, JSON.stringify(anchor));
    assert(anchor.top < anchor.header + 80, JSON.stringify(anchor));
    assert.match(await page.title(), /Operit 2/);
  });
  for (const dpi of [75, 100, 110, 125, 150]) {
    await applyPreferences('zh', 'dark', dpi);
    for (const height of [600, 900]) {
      await check(`all 15 tutorial chapters stay reachable at ${dpi}% scale and ${height}px height`, async () => {
        await page.setViewport({ width: 1440, height });
        await open('/v1/guide/beginner-tutorial/09-tool-sandbox-package', '.docs-sidebar .ant-menu-item-selected');
        await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--site-viewport-height'));
        const chapterLinks = await page.$$eval('.docs-sidebar a[href*="/beginner-tutorial/"]', elements => elements.map(element => element.getAttribute('href')));
        assert.equal(chapterLinks.length, 15);
        for (const href of chapterLinks.slice(9)) {
          const visible = await page.evaluate(href => {
            const sidebar = document.querySelector('.docs-sidebar');
            const link = [...sidebar.querySelectorAll('a')].find(element => element.getAttribute('href') === href);
            const scale = sidebar.getBoundingClientRect().height / sidebar.offsetHeight;
            const rect = link.getBoundingClientRect();
            const bounds = sidebar.getBoundingClientRect();
            sidebar.scrollTop += (rect.top - bounds.top - 16 * scale) / scale;
            const item = link.getBoundingClientRect();
            const directory = sidebar.getBoundingClientRect();
            const header = document.querySelector('.site-header').getBoundingClientRect();
            const hit = document.elementFromPoint(item.left + item.width / 2, item.top + item.height / 2);
            return { top: item.top, bottom: item.bottom, header: header.bottom, viewport: innerHeight,
              sidebarBottom: directory.bottom, clickable: hit === link || link.contains(hit) };
          }, href);
          assert(visible.sidebarBottom <= height + 1, JSON.stringify(visible));
          assert(visible.top >= visible.header && visible.bottom <= height, JSON.stringify(visible));
          assert(visible.clickable, JSON.stringify(visible));
          await page.click(`.docs-sidebar a[href="${href}"]`);
          await page.waitForFunction(expected => location.hash === expected, {}, href);
          await page.waitForSelector('.docs-article .markdown-body');
        }
        // Resizing must update the logical viewport, not preserve the old cap.
        await page.setViewport({ width: 1440, height: height - 120 });
        await page.waitForFunction(() => document.querySelector('.docs-sidebar').getBoundingClientRect().bottom <= innerHeight + 1);
        const selectedFits = await page.$eval('.docs-sidebar .ant-menu-item-selected', element => {
          const rect = element.getBoundingClientRect();
          return rect.bottom <= innerHeight && rect.top >= document.querySelector('.site-header').getBoundingClientRect().bottom;
        });
        assert(selectedFits);
      });
    }
  }
  for (const dpi of [100, 125, 150]) {
    await applyPreferences('zh', 'dark', dpi);
    await check(`mobile directory opens chapters 10–15 at ${dpi}% scale`, async () => {
      await page.setViewport({ width: 390, height: 600 });
      await open('/v1/guide/beginner-tutorial/09-tool-sandbox-package', '.docs-directory-trigger');
      for (let chapter = 9; chapter < 15; chapter += 1) {
        await page.click('.docs-directory-trigger');
        await page.waitForSelector('.ant-drawer-open .docs-drawer[role="dialog"]', { visible: true });
        await page.waitForFunction(() => document.querySelector('.docs-drawer').getBoundingClientRect().left >= 0);
        const result = await page.evaluate(chapter => {
          const drawer = document.querySelector('.docs-drawer');
          const links = [...drawer.querySelectorAll('a[href*="/beginner-tutorial/"]')];
          const link = links[chapter];
          link.scrollIntoView({ block: 'center' });
          const rect = link.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return { count: links.length, href: link.getAttribute('href'), top: rect.top, bottom: rect.bottom,
            viewport: innerHeight, clickable: hit === link || link.contains(hit) };
        }, chapter);
        assert.equal(result.count, 15);
        assert(result.top >= 0 && result.bottom <= result.viewport && result.clickable, JSON.stringify(result));
        await page.click(`.docs-drawer a[href="${result.href}"]`);
        await page.waitForFunction(expected => location.hash === expected, {}, result.href);
        await page.waitForSelector('.docs-drawer[role="dialog"]', { hidden: true });
        await page.waitForSelector('.docs-article .markdown-body');
      }
    });
  }
  await applyPreferences('zh', 'dark');
  for (const width of [320, 390, 1440]) {
    await check(`Operit 2 retains its starfield and oversized gradient number at ${width}px`, async () => {
      await page.setViewport({ width, height: 900 });
      await open('/v2', '.release-two');
      await page.waitForSelector('.site-starfield canvas');
      const brand = await page.$eval('.release-two', element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const wordSize = parseFloat(getComputedStyle(document.querySelector('.release-wordmark > span:first-child')).fontSize);
        return { size: parseFloat(style.fontSize), wordSize, gradient: style.backgroundImage,
          transform: style.transform, shadow: style.filter, left: rect.left, right: rect.right };
      });
      assert(brand.size > brand.wordSize * 1.5, JSON.stringify(brand));
      assert.match(brand.gradient, /linear-gradient/);
      assert.notEqual(brand.transform, 'none');
      assert.match(brand.shadow, /drop-shadow/);
      assert(brand.left >= 0 && brand.right <= width, JSON.stringify(brand));
      assert.equal(await page.$$eval('.release-orbit', elements => elements.length), 2);
      assert.equal(await page.$('.product-navigation'), null);
      await open('/v2/guide', '.markdown-body');
      assert.equal(await page.$('.site-starfield'), null);
    });
  }
  await check('generation-two screenshot mode also hides all navigation', async () => {
    await open('/v2/guide?mode=screenshot', '.markdown-body-screenshot');
    for (const selector of ['.site-header', '.product-navigation', '.docs-sidebar', '.docs-mobile-toolbar', '.markdown-edit-bar']) assert.equal(await page.$(selector), null);
  });
  await applyPreferences('en', 'light');
  for (const width of [320, 768, 1024]) {
    await check(`English light-theme docs remain readable at ${width}px`, async () => {
      await page.setViewport({ width, height: 900 });
      await open('/v2/guide', '.docs-article .markdown-body h1');
      const layout = await page.evaluate(() => {
        const heading = document.querySelector('.markdown-body h1').getBoundingClientRect();
        return { language: document.documentElement.lang, dark: document.documentElement.hasAttribute('data-theme'),
          overflow: document.documentElement.scrollWidth > innerWidth,
          headingTop: heading.top, headingRight: heading.right, viewport: innerWidth };
      });
      assert.equal(layout.language, 'en');
      assert.equal(layout.dark, false);
      assert.equal(layout.overflow, false);
      assert(layout.headingRight <= width, JSON.stringify(layout));
      if (width <= 980) {
        assert(layout.headingTop < 300, JSON.stringify(layout));
        await page.click('.docs-directory-trigger');
        await page.waitForSelector('.ant-drawer-open .docs-drawer[role="dialog"]', { visible: true });
        const links = await hrefs('.docs-drawer');
        assert(links.includes('#/v2/guide/release-information'));
        await page.keyboard.press('Escape');
        await page.waitForSelector('.docs-drawer', { hidden: true });
        await page.click('.site-mobile-trigger');
        await page.waitForSelector('.site-mobile-navigation');
        assert((await hrefs('.site-mobile-navigation')).includes('#/v2/download'));
      }
    });
  }
  for (const language of ['zh', 'en']) {
    await applyPreferences(language, 'dark');
    for (const width of [390, 1440]) {
      await check(`v2 overview uses concise product-context labels in ${language} at ${width}px`, async () => {
        await page.setViewport({ width, height: 900 });
        await open('/v2', '.release-actions');
        const actions = await page.$$eval('.release-actions a', elements => elements.map(element => ({ text: element.textContent, href: element.getAttribute('href') })));
        assert.deepEqual(actions, [
          { text: language === 'zh' ? '下载' : 'Download', href: '#/v2/download' },
          { text: language === 'zh' ? '使用教程' : 'Guides', href: '#/v2/guide' },
        ]);
        const resources = await page.$eval('.release-resource-grid', element => element.textContent);
        assert.doesNotMatch(resources, /二代|产品代际|both generations|generation of Operit/);
        assert.equal(await page.$eval('.release-wordmark', element => element.textContent), 'Operit2');
      });
    }
  }
  for (const language of ['zh', 'en']) {
    await applyPreferences(language, 'dark');
    for (const width of [320, 390, 768, 1440]) {
      await check(`v2 downloads list every platform in ${language} at ${width}px without exposing group details`, async () => {
        await page.setViewport({ width, height: 900 });
        await open('/v2/download', '.version-platform-downloads a[data-platform="linux"]');
        const names = await page.$$eval('.version-platform-download h3', elements => elements.map(element => element.textContent));
        assert.deepEqual(names, ['Android', 'iOS', 'Windows', 'macOS', 'Linux']);
        assert.doesNotMatch(await page.$eval('.version-download-panel', element => element.textContent), /1121622579|QQ|其他平台|Other platforms/);
        const entries = await page.$$eval('.version-platform-downloads a[data-platform]', elements => elements.map(element => {
          const rect = element.getBoundingClientRect();
          return { platform: element.dataset.platform, href: element.getAttribute('href'), text: element.textContent,
            left: rect.left, right: rect.right };
        }));
        for (const entry of entries) {
          const name = names[entries.indexOf(entry)];
          assert.equal(entry.text, language === 'zh' ? `加入 ${name} 公测` : `Join ${name} beta`);
          if (['ios', 'macos'].includes(entry.platform)) {
            assert.equal(entry.href, testFlightUrl);
          } else {
            const url = new URL(entry.href);
            assert.equal(url.protocol, 'mqqapi:');
            assert.equal(url.hostname, 'card');
            assert.equal(url.pathname, '/show_pslcard');
            assert.equal(url.searchParams.get('uin'), '1121622579');
            assert.equal(url.searchParams.get('card_type'), 'group');
          }
          assert(entry.left >= 0 && entry.right <= width, JSON.stringify(entry));
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      });
    }
  }
  await check('all pages render without JavaScript runtime errors', async () => assert.deepEqual(errors, []));
  console.log(`\n${checks} browser smoke checks passed.`);
} finally {
  await browser?.close();
  server?.kill();
}
