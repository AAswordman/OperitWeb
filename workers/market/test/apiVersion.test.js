import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArtifactApiVersion } from '../dist/apiVersion.js';

test('old artifact publishers can omit the API declaration', () => {
  for (const type of ['script', 'package']) {
    assert.doesNotThrow(() => validateArtifactApiVersion(type, undefined, '1.2.0'));
    assert.doesNotThrow(() => validateArtifactApiVersion(type, '1.0.0', '1.2.0'));
  }
});

test('explicit artifact declarations require triples and coherent app bounds', () => {
  for (const type of ['script', 'package']) {
    for (const version of ['1.0', '2', 'v2.0.0', '2.0.0-beta', '99999999999999999999.0.0']) {
      assert.throws(() => validateArtifactApiVersion(type, version, '2.0.0'), /version.apiVersion/);
    }
    assert.throws(() => validateArtifactApiVersion(type, '2.0.0', '1.99.99'), /minAppVer >= 2.0.0/);
    assert.throws(() => validateArtifactApiVersion(type, '2.0.0', '2.1.0', '2.0.0'), /must not exceed/);
    assert.throws(() => validateArtifactApiVersion(type, '1.0.1', '1.12.1+4', '1.12.1+3'), /must not exceed/);
    assert.doesNotThrow(() => validateArtifactApiVersion(type, '2.0.0', '2.0.0', '2.99.99'));
    assert.doesNotThrow(() => validateArtifactApiVersion(type, '1.0.1', '1.12.1+4', '2.99.99'));
  }
});
