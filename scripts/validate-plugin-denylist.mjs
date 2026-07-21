import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const publicDir = path.join(process.cwd(), 'public');
const pointerPath = path.join(publicDir, 'plugin-denylist', 'latest.json');
const sha256Pattern = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(`plugin denylist validation failed: ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${filePath}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const pointer = readJson(pointerPath);
assert(pointer.schemaVersion === 1, 'latest.json schemaVersion must be 1');
assert(Number.isInteger(pointer.latestVersion) && pointer.latestVersion > 0, 'latestVersion must be a positive integer');
assert(typeof pointer.latestFile === 'string' && pointer.latestFile.startsWith('/plugin-denylist/history/'), 'latestFile must reference plugin-denylist/history');

const payloadPath = path.resolve(publicDir, `.${pointer.latestFile}`);
const historyDir = path.resolve(publicDir, 'plugin-denylist', 'history');
assert(payloadPath.startsWith(`${historyDir}${path.sep}`), 'latestFile must remain inside plugin-denylist/history');
assert(fs.existsSync(payloadPath), `latestFile does not exist: ${pointer.latestFile}`);

const payload = readJson(payloadPath);
assert(payload.schemaVersion === 1, 'payload schemaVersion must be 1');
assert(payload.version === pointer.latestVersion, 'payload version must equal latestVersion');
assert(payload.hashAlgorithm === 'sha256', 'hashAlgorithm must be sha256');
assert(payload.match === 'raw_file_bytes', 'match must be raw_file_bytes');
assert(payload.action === 'reject_import', 'action must be reject_import');
assert(Array.isArray(payload.entries), 'entries must be an array');

const hashes = new Set();
for (const [index, entry] of payload.entries.entries()) {
  assert(entry && typeof entry === 'object', `entries[${index}] must be an object`);
  assert(typeof entry.sha256 === 'string' && sha256Pattern.test(entry.sha256), `entries[${index}].sha256 must be 64 lowercase hexadecimal characters`);
  assert(!hashes.has(entry.sha256), `entries[${index}].sha256 is duplicated`);
  hashes.add(entry.sha256);
  if (entry.note !== undefined) {
    assert(typeof entry.note === 'string', `entries[${index}].note must be a string`);
  }
}

console.log(`Validated plugin denylist v${payload.version} with ${payload.entries.length} entries.`);
