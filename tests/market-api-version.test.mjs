import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/operitMarketV2.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { marketV2ApiVersion, marketV2VersionAsset } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('script and package API labels preserve legacy contracts and per-release declarations', () => {
  for (const type of ['script', 'package']) {
    const entry = { type, latestVersion: { id: 'v2', apiVersion: '2.0.0' } };
    assert.equal(marketV2ApiVersion(entry), '2.0.0');
    assert.equal(marketV2ApiVersion(entry, { id: 'v1' }), '1.0.0');
    assert.equal(marketV2ApiVersion({ type }), '1.0.0');
  }
  assert.equal(marketV2ApiVersion({ type: 'mcp' }), undefined);
});

test('download selection follows the release instead of asset array order', () => {
  const oldAsset = { id: 'old', versionId: 'v1' };
  const newAsset = { id: 'new', versionId: 'v2' };
  const entry = { type: 'script', latestVersion: { id: 'v2' }, assets: [oldAsset, newAsset] };
  assert.equal(marketV2VersionAsset(entry), newAsset);
  assert.equal(marketV2VersionAsset(entry, 'v1'), oldAsset);
  assert.equal(marketV2VersionAsset(entry, 'missing'), undefined);
  assert.equal(marketV2VersionAsset({ ...entry, latestVersion: undefined }), undefined);
});
