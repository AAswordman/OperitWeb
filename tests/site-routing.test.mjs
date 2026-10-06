import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { validateSubmission, ALLOWED_PATH_RE } from '../workers/operit-api/src/workerShared.js';

async function loadTsModule(relativePath, imports = {}) {
  let source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  for (const [specifier, moduleUrl] of Object.entries(imports)) source = source.replaceAll(specifier, moduleUrl);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return { url, module: await import(url) };
}

const products = await loadTsModule('../src/config/products.ts');
const { PRODUCTS, SHARED_PATHS, OPERIT_V2_TESTFLIGHT_URL, OPERIT_V2_PUBLIC_BETAS, getProductFromPath, getExternalDownloadUrl } = products.module;
const { resolveLegacyPath, canonicalizeSiteHref } = (await loadTsModule('../src/routing/paths.ts', { '../config/products.ts': products.url })).module;
const { getRouteMetadata } = (await loadTsModule('../src/config/routeMetadata.ts', { './products.ts': products.url })).module;
const { buildMarkdownCandidates, isEditableMarkdownPath } = (await loadTsModule('../src/utils/markdownPaths.ts')).module;

const { getNavigationContext, getProductSwitchPath } = (await loadTsModule('../src/config/navigation.ts', { './products.ts': products.url })).module;

const redirects = [
  ['/classic', '/v1'], ['/classic/', '/v1/'],
  ['/guide/new', '/v1/guide'],
  ['/guide/new/beginner-tutorial/01-quick-start', '/v1/guide/beginner-tutorial/01-quick-start'],
  ['/guide/old', '/v1/guide/reference'],
  ['/guide/old/basic-config/model-config', '/v1/guide/reference/basic-config/model-config'],
  ['/guide/old/tools-and-features/ai-tools/mcp', '/v1/guide/reference/tools-and-features/ai-tools/mcp'],
  ['/guide/quick-start', '/v1/guide/reference/quick-start'],
  ['/guide/basic-config/model-config', '/v1/guide/reference/basic-config/model-config'],
  ['/guide/plugin', '/developers/plugins'],
  ['/guide/plugin/typescript-basics', '/developers/plugins/typescript-basics'],
  ['/v1/market', '/market'], ['/v2/market', '/market'],
];
for (const [from, to] of redirects) test(`legacy ${from} → ${to}`, () => assert.equal(resolveLegacyPath(from), to));

test('canonical routes never redirect or create loops', () => {
  for (const path of ['/', '/guide', '/download', '/v1', '/v2', '/v1/guide', '/v2/download', '/market', '/developers/plugins', '/classicish', '/v10']) assert.equal(resolveLegacyPath(path), undefined);
  for (const [, to] of redirects) assert.equal(resolveLegacyPath(to), undefined);
});

test('product detection uses path boundaries', () => {
  assert.equal(getProductFromPath('/v1/download')?.id, 'v1');
  assert.equal(getProductFromPath('/v2/guide/release-information')?.id, 'v2');
  for (const path of ['/', '/v10', '/v2-extra', '/market', '/operit-market-review']) assert.equal(getProductFromPath(path), undefined);
});

test('downloads are separate; the v2 configuration cannot inherit v1 APKs', () => {
  assert.equal(PRODUCTS.v1.download.kind, 'github-release');
  assert.equal(PRODUCTS.v2.download.kind, 'external');
  assert.notEqual(PRODUCTS.v1.downloadPath, PRODUCTS.v2.downloadPath);
  assert.notEqual(PRODUCTS.v1.markdownRoot, PRODUCTS.v2.markdownRoot);
  assert.equal(SHARED_PATHS.market, '/market');
});

test('second generation accepts only configured HTTPS downloads', () => {
  assert.equal(getExternalDownloadUrl('  https://example.com/operit2  '), 'https://example.com/operit2');
  for (const value of [undefined, '', 'not a URL', '/v1', 'javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) assert.equal(getExternalDownloadUrl(value), undefined);
});

test('Markdown route links keep query strings, anchors and encoded paths', () => {
  assert.equal(canonicalizeSiteHref('/#/guide/old/faq?mode=screenshot#answer'), '/#/v1/guide/reference/faq?mode=screenshot#answer');
  assert.equal(canonicalizeSiteHref('#/guide/new/beginner-tutorial/01-quick-start'), '#/v1/guide/beginner-tutorial/01-quick-start');
  assert.equal(canonicalizeSiteHref('/#/guide/plugin/typescript-basics'), '/#/developers/plugins/typescript-basics');
  assert.equal(canonicalizeSiteHref('/#/guide/old/%E6%96%87%E6%A1%A3'), '/#/v1/guide/reference/%E6%96%87%E6%A1%A3');
  for (const value of ['#heading', '/manuals/assets/image.png', 'https://example.com/#/guide/old/faq', '/#/v2/guide', '/#/market?filter=skill']) assert.equal(canonicalizeSiteHref(value), value);
});

test('documentation sources and language fallbacks stay within their generation', () => {
  assert.deepEqual(buildMarkdownCandidates('v2content/index', 'en'), ['v2content/en/index.md', 'v2content/zh/index.md']);
  assert.deepEqual(buildMarkdownCandidates('newcontent/index', 'en'), ['newcontent/en/index.md', 'newcontent/zh/index.md']);
  assert.deepEqual(buildMarkdownCandidates('basic-config/model-config', 'zh'), ['content/zh/basic-config/model-config.md']);
  assert.deepEqual(buildMarkdownCandidates('plugin-tutorial/index', 'en'), ['plugin-tutorial/en/index.md', 'plugin-tutorial/zh/index.md']);
  for (const path of ['v2content/en/index.md', 'newcontent/zh/index.md', 'content/zh/faq.md', 'plugin-tutorial/zh/index.md']) assert.equal(isEditableMarkdownPath(path), true);
  assert.equal(isEditableMarkdownPath('announcements/latest.json'), false);
});

test('page metadata identifies each generation and shared destinations in both languages', () => {
  for (const language of ['zh', 'en']) {
    for (const id of ['v1', 'v2']) {
      for (const path of [PRODUCTS[id].homePath, PRODUCTS[id].downloadPath, PRODUCTS[id].guidePath]) assert.match(getRouteMetadata(path, language).title, new RegExp(PRODUCTS[id].name));
    }
    assert.match(getRouteMetadata('/market', language).description, /Operit 1.*Operit 2/);
    assert.equal(getRouteMetadata('/v2/guide', language).locale, language === 'zh' ? 'zh_CN' : 'en_US');
  }
});


test('Markdown submissions work for both generations and shared developer docs', () => {
  for (const root of ['content', 'newcontent', 'v2content', 'plugin-tutorial']) {
    for (const language of ['zh', 'en']) {
      const target_path = `${root}/${language}/section/index.md`;
      const result = validateSubmission({ type: 'edit', language, target_path, title: 'Test guide', content: 'This is a valid documentation edit for testing.' });
      assert.equal(result.ok, true, result.errors.join(', '));
      assert.equal(isEditableMarkdownPath(target_path), true);
    }
    assert.equal(validateSubmission({ type: 'edit', language: 'en', target_path: `${root}/zh/index.md`, title: 'Test guide', content: 'This is a valid documentation edit for testing.' }).ok, false);
  }
});

test('both frontend and Worker reject paths outside the approved documentation roots', () => {
  for (const path of ['v2content/zh/../../.env.md', 'v2content/zh//index.md', 'v2content/zh/index.ts', 'v2content/fr/index.md', 'workers/zh/index.md', 'content/zh/index.md/extra']) {
    assert.equal(isEditableMarkdownPath(path), false, path);
    assert.equal(ALLOWED_PATH_RE.test(path), false, path);
  }
});


test('iOS and macOS public-beta entries use the provided TestFlight invite without environment configuration', () => {
  assert.equal(OPERIT_V2_TESTFLIGHT_URL, 'https://testflight.apple.com/join/hzq2xRrH');
  assert.deepEqual(OPERIT_V2_PUBLIC_BETAS.map(platform => platform.id), ['ios', 'macos']);
  assert.equal(PRODUCTS.v2.download.publicBetas, OPERIT_V2_PUBLIC_BETAS);
  for (const platform of OPERIT_V2_PUBLIC_BETAS) {
    assert.equal(platform.url, OPERIT_V2_TESTFLIGHT_URL);
    assert.equal(getExternalDownloadUrl(platform.url), OPERIT_V2_TESTFLIGHT_URL);
  }
});

test('product and download metadata identify Operit 2 as cross-platform, with platform-specific testing availability', () => {
  assert.equal(PRODUCTS.v2.status.zh, '公测中');
  assert.equal(PRODUCTS.v2.status.en, 'Public beta');
  assert.match(PRODUCTS.v2.description.zh, /全平台.*iOS.*macOS.*其他平台内测将逐步开放/);
  assert.match(PRODUCTS.v2.description.en, /cross-platform.*iOS.*macOS.*other platforms/);
  assert.match(getRouteMetadata('/v2/download', 'zh').description, /全平台.*iOS.*macOS.*其他平台内测逐步开放/);
  assert.match(getRouteMetadata('/v2/download', 'en').description, /Cross-platform.*iOS.*macOS.*other platforms/);
});

test('both-language generation-two guides include the public-beta invite and do not claim that all downloads are unavailable', () => {
  for (const language of ['zh', 'en']) {
    for (const file of ['index', 'release-information']) {
      const markdown = readFileSync(new URL(`../public/v2content/${language}/${file}.md`, import.meta.url), 'utf8');
      assert(markdown.includes(OPERIT_V2_TESTFLIGHT_URL));
      assert.match(markdown, language === 'zh' ? /全平台/ : /cross-platform/);
      assert.match(markdown, /iOS/);
      assert.match(markdown, /macOS/);
      assert.doesNotMatch(markdown, /公开下载尚未开放|public downloads are available,|is in private beta/);
    }
  }
});


test('navigation switches generation without changing the current section', () => {
  for (const [path, expected] of [
    ['/v1', '/v2'], ['/v1/download', '/v2/download'],
    ['/v1/guide/reference/basic-config/model-config', '/v2/guide'],
    ['/guide', '/v2/guide'], ['/download', '/v2/download'],
    ['/developers/plugins', '/v2'], ['/market', '/v2'],
  ]) assert.equal(getProductSwitchPath(path, PRODUCTS.v2), expected);
  assert.equal(getProductSwitchPath('/v2/guide/release-information', PRODUCTS.v1), '/v1/guide');
  assert.equal(getProductSwitchPath('/v2/guide/release-information', PRODUCTS.v2), '/v2/guide/release-information');
});

test('navigation keeps shared routes and documentation boundaries explicit', () => {
  assert.equal(getNavigationContext('/v2/guide/release-information').documentation, true);
  assert.equal(getNavigationContext('/developers/plugins/typescript-basics').documentation, true);
  assert.equal(getNavigationContext('/developers/plugins-other').documentation, false);
  assert.equal(getNavigationContext('/v2/download').documentation, false);
  assert.equal(getNavigationContext('/v2/guide-other').documentation, false);
  assert.equal(getNavigationContext('/market').product, undefined);
  assert.equal(getNavigationContext('/market').market, true);
  assert.equal(getNavigationContext('/marketish').market, false);
  assert.equal(getNavigationContext('/v2/guide').downloadPath, '/v2/download');
});
