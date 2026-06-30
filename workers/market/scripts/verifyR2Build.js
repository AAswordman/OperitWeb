/**
 * verifyR2Build.js - build and validate local R2 JSON from migrated SQLite data.
 *
 * By default this does not touch Cloudflare. It reads migration-output/local_market.db,
 * runs the current MarketStore + buildR2 implementation, writes real JSON files
 * to a local temp R2 directory, and validates the current v2 static contract.
 *
 * Pass --upload to upload the validated output directory to R2 with bounded
 * concurrency via Cloudflare's R2 S3-compatible API.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash, createHmac } from 'crypto';
import initSqlJs from 'sql.js';
import { createBuildRoutes } from '../dist/build.js';
import { createMarketStore } from '../dist/store/MarketStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../migration-output');
const DB_PATH = path.join(OUTPUT_DIR, 'local_market.db');
const REPORT_PATH = path.join(OUTPUT_DIR, 'r2-build-report.json');
const DEFAULT_BUCKET = 'operit-market-stats-static';
const DEFAULT_ACCOUNT_ID = 'c667bf70582c5ceceda8d3d183ad8e3b';
const args = parseArgs(process.argv.slice(2));

class SqlJsD1 {
  constructor(sqlite) { this.sqlite = sqlite; }
  prepare(sql) { return new SqlJsD1Statement(this.sqlite, sql); }
}

class SqlJsD1Statement {
  constructor(sqlite, sql, params = []) { this.sqlite = sqlite; this.sql = sql; this.params = params; }
  bind(...params) { return new SqlJsD1Statement(this.sqlite, this.sql, params); }
  run() { this.sqlite.run(this.sql, this.params); return { success: true }; }
  first() { return this.all().results[0] || null; }
  all() {
    const stmt = this.sqlite.prepare(this.sql);
    stmt.bind(this.params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return { results };
  }
}

class FileR2 {
  constructor() {
    this.dir = path.join(os.tmpdir(), `operit-market-r2-verify-${Date.now()}`);
    this.keys = [];
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }
  async put(key, value) {
    const file = path.join(this.dir, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
    this.keys.push(key);
  }
  async get(key) {
    try {
      const text = fs.readFileSync(path.join(this.dir, key), 'utf8');
      return { body: text, httpEtag: '', async text() { return text; } };
    } catch { return null; }
  }
  async delete(key) { try { fs.rmSync(path.join(this.dir, key)); } catch { /* ok */ } }
  async list({ prefix }) { return { objects: this.keys.filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; }
  json(key) { return JSON.parse(fs.readFileSync(path.join(this.dir, key), 'utf8')); }
}

async function main() {
  if (!fs.existsSync(DB_PATH)) throw new Error(`Missing local database: ${DB_PATH}. Run scripts/localImport.js first.`);

  const SQL = await initSqlJs();
  const sqlite = new SQL.Database(fs.readFileSync(DB_PATH));
  const db = new SqlJsD1(sqlite);
  const r2 = new FileR2();
  const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });

  const result = await createBuildRoutes().buildR2({ store });
  const report = validate(sqlite, r2, result);
  report.r2Dir = r2.dir;
  report.upload = null;

  if (args.upload) {
    report.upload = await uploadDirectoryToR2(r2.dir, {
      accountId: args.accountId,
      bucket: args.bucket,
      concurrency: args.concurrency,
      prefix: args.prefix,
      uploaderUrl: args.uploaderUrl,
    });
  }

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

function validate(sqlite, r2, buildResult) {
  const checks = [];
  const approvedCount = scalar(sqlite, "SELECT COUNT(*) FROM market_entries WHERE state_code = 'approved'");
  const expectedEntryShardCount = new Set(rows(sqlite, "SELECT id FROM market_entries WHERE state_code = 'approved'").map((row) => entryShardOf(String(row.id)))).size;
  const manifest = requireJson(r2, 'market/v2/manifest.json');
  assertCheck(checks, 'manifest marketVersion', manifest.marketVersion === 2, manifest.marketVersion);
  assertCheck(checks, 'manifest types', manifest.types?.length === 4, manifest.types?.length);
  assertCheck(checks, 'manifest categories', manifest.categories?.length >= 10, manifest.categories?.length);

  const entryShardKeys = r2.keys.filter((key) => /^market\/v2\/entries\/[0-9a-f]{2}\.json$/.test(key)).sort();
  assertCheck(checks, 'entry shard count', entryShardKeys.length === expectedEntryShardCount, `${entryShardKeys.length}/${expectedEntryShardCount}`);

  const listKeys = r2.keys.filter((key) => key.startsWith('market/v2/lists/')).sort();
  assertCheck(checks, 'list pages written', listKeys.length > 0, listKeys.length);
  assertCheck(checks, 'all list uses readable key', listKeys.some((key) => key === 'market/v2/lists/all/updated/page-1.json'), listKeys.slice(0, 5));
  assertCheck(checks, 'no hashed all list key', !listKeys.some((key) => key.includes('/5465b825/')), listKeys.filter((key) => key.includes('/5465b825/')).slice(0, 5));
  const updatedPage1Key = listKeys.find((key) => key === 'market/v2/lists/all/updated/page-1.json');
  assertCheck(checks, 'updated list page exists', Boolean(updatedPage1Key), updatedPage1Key);
  assertCheck(checks, 'likes list page exists', listKeys.some((key) => key === 'market/v2/lists/all/likes/page-1.json'), listKeys.filter((key) => key.includes('/likes/')).slice(0, 5));
  assertCheck(checks, 'downloads list page exists', listKeys.some((key) => key === 'market/v2/lists/all/downloads/page-1.json'), listKeys.filter((key) => key.includes('/downloads/')).slice(0, 5));
  assertCheck(checks, 'no featured list pages', !listKeys.some((key) => key.includes('/featured/')), listKeys.filter((key) => key.includes('/featured/')).slice(0, 5));
  const updatedPage1 = requireJson(r2, updatedPage1Key);
  assertCheck(checks, 'list pageSize 100', updatedPage1.pageSize === 100, updatedPage1.pageSize);
  assertCheck(checks, 'updated page item count', updatedPage1.items?.length === Math.min(100, approvedCount), updatedPage1.items?.length);
  assertCheck(checks, 'updated list total', updatedPage1.total === approvedCount, `${updatedPage1.total}/${approvedCount}`);
  for (const type of ['skill', 'mcp']) {
    const typeCount = scalar(sqlite, `SELECT COUNT(*) FROM market_entries WHERE state_code = 'approved' AND type = '${type}'`);
    const key = `market/v2/lists/type/${type}/updated/page-1.json`;
    const page = requireJson(r2, key);
    assertCheck(checks, `${type} list exists`, Boolean(page), key);
    assertCheck(checks, `${type} list total`, page.total === typeCount, `${page.total}/${typeCount}`);
    assertCheck(checks, `${type} list pageSize 100`, page.pageSize === 100, page.pageSize);
    assertCheck(checks, `${type} list not empty`, page.items?.length === Math.min(100, typeCount), page.items?.length);
  }

  const allItems = listKeys.flatMap((key) => requireJson(r2, key).items || []);
  assertCheck(checks, 'description <=100', allItems.every((item) => String(item.description || '').length <= 100), badItems(allItems, (item) => String(item.description || '').length > 100));
  assertCheck(checks, 'detail present', allItems.every((item) => typeof item.detail === 'string' && item.detail.length > 0), badItems(allItems, (item) => !item.detail));
  assertCheck(checks, 'latestVersion present', allItems.every((item) => item.latestVersion), badItems(allItems, (item) => !item.latestVersion));
  assertCheck(checks, 'repo entries have source', allItems.every((item) => !['skill', 'mcp'].includes(item.type) || item.source?.url), badItems(allItems, (item) => ['skill', 'mcp'].includes(item.type) && !item.source?.url));
  assertCheck(checks, 'featured field present', allItems.every((item) => typeof item.featured === 'boolean'), badItems(allItems, (item) => typeof item.featured !== 'boolean'));
  assertCheck(checks, 'artifact entries have assets', allItems.every((item) => !['script', 'package'].includes(item.type) || (item.artifact && item.assets?.length)), badItems(allItems, (item) => ['script', 'package'].includes(item.type) && !(item.artifact && item.assets?.length)));
  assertCheck(checks, 'artifact versions have runtimePackageId', allItems.every((item) => !['script', 'package'].includes(item.type) || (item.versions || []).every((version) => version.runtimePackageId)), badItems(allItems, (item) => ['script', 'package'].includes(item.type) && (item.versions || []).some((version) => !version.runtimePackageId)));
  assertCheck(checks, 'artifact latestVersion has runtimePackageId', allItems.every((item) => !['script', 'package'].includes(item.type) || item.latestVersion?.runtimePackageId), badItems(allItems, (item) => ['script', 'package'].includes(item.type) && !item.latestVersion?.runtimePackageId));
  assertCheck(checks, 'public json has no artifact nodes', allItems.every((item) => !item.artifact?.nodes && !item.artifact?.rootNodeId), badItems(allItems, (item) => item.artifact?.nodes || item.artifact?.rootNodeId));

  const sample = pickSample(allItems);
  const shard = entryShardOf(sample.id);
  const shardJson = requireJson(r2, `market/v2/entries/${shard}.json`);
  const shardItem = shardJson.entriesById?.[sample.id];
  assertCheck(checks, 'sample exists in entry shard', Boolean(shardItem), { sample: sample.id, shard });
  assertCheck(checks, 'sample shard detail matches list', shardItem?.detail === sample.detail, sample.id);
  assertCheck(checks, 'sample shard embeds versions', Array.isArray(shardItem?.versions), { sample: sample.id, versions: shardItem?.versions?.length });
  assertCheck(checks, 'no one-file-per-entry detail files', !r2.keys.some((key) => /^market\/v2\/entries\/.+\/[^/]+\.json$/.test(key)), r2.keys.filter((key) => key.startsWith('market/v2/entries/') && key.split('/').length > 4).slice(0, 5));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    r2ObjectCount: r2.keys.length,
    materialized: buildResult.materialized,
    publicCount: approvedCount,
    keySummary: {
      manifest: r2.keys.filter((key) => key === 'market/v2/manifest.json').length,
      entryShards: entryShardKeys.length,
      lists: listKeys.length,
      privatePublisherShards: r2.keys.filter((key) => key.startsWith('market/v2/private/publishers/')).length,
    },
    sample: {
      id: sample.id,
      shard,
      title: sample.title,
      descriptionLength: sample.description.length,
      detailLength: sample.detail.length,
      type: sample.type,
    },
    checks,
  };
}

function rows(sqlite, sql) {
  const result = sqlite.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

function scalar(sqlite, sql) {
  const row = rows(sqlite, sql)[0] || {};
  const firstKey = Object.keys(row)[0];
  return Number(firstKey ? row[firstKey] : 0);
}
function requireJson(r2, key) { if (!key) throw new Error('Missing R2 key'); return r2.json(key); }
function pickSample(items) { return items.find((item) => item.id === 'package-com-operit-jealous-patrol') || items[0]; }
function badItems(items, predicate) { return items.filter(predicate).slice(0, 5).map((item) => ({ id: item.id, type: item.type })); }
function assertCheck(checks, name, pass, detail) { checks.push({ name, pass, detail }); if (!pass) throw new Error(`R2 verification failed: ${name} (${JSON.stringify(detail)})`); }

function scopeHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}
function entryShardOf(entryId) { return scopeHash(entryId).substring(0, 2).toLowerCase(); }

function parseArgs(argv) {
  const parsed = {
    upload: false,
    accountId: DEFAULT_ACCOUNT_ID,
    bucket: DEFAULT_BUCKET,
    concurrency: 64,
    prefix: '',
    uploaderUrl: '',
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--upload') parsed.upload = true;
    else if (arg === '--account-id') parsed.accountId = requireValue(argv, ++index, arg);
    else if (arg === '--bucket') parsed.bucket = requireValue(argv, ++index, arg);
    else if (arg === '--concurrency') parsed.concurrency = Math.max(1, Number(requireValue(argv, ++index, arg)));
    else if (arg === '--prefix') parsed.prefix = trimSlashes(requireValue(argv, ++index, arg));
    else if (arg === '--uploader-url') parsed.uploaderUrl = requireValue(argv, ++index, arg).replace(/\/+$/g, '');
    else if (arg === '--help' || arg === '-h') {
      console.log([
        'Usage: node workers/market/scripts/verifyR2Build.js [--upload]',
        '',
        'Options:',
        '  --upload                 Upload validated local R2 output to Cloudflare R2',
        `  --bucket <name>          R2 bucket name (default: ${DEFAULT_BUCKET})`,
        `  --account-id <id>        Cloudflare account id (default: ${DEFAULT_ACCOUNT_ID})`,
        '  --concurrency <n>        Parallel uploads (default: 64)',
        '  --prefix <path>          Optional object key prefix',
        '  --uploader-url <url>      Upload through a temporary Worker instead of R2 S3 API',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(parsed.concurrency)) throw new Error('--concurrency must be a number');
  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return value;
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

async function uploadDirectoryToR2(rootDir, options) {
  const files = listFiles(rootDir).map((file) => {
    const relative = path.relative(rootDir, file).split(path.sep).join('/');
    return {
      file,
      key: options.prefix ? `${options.prefix}/${relative}` : relative,
      size: fs.statSync(file).size,
    };
  });
  const startedAt = Date.now();
  let uploaded = 0;
  let bytes = 0;
  const failures = [];
  const uploadToken = options.uploaderUrl ? readUploaderToken() : '';
  const credentials = options.uploaderUrl ? null : readR2Credentials();
  const mode = options.uploaderUrl ? 'worker' : 's3';
  console.log(`Uploading ${files.length} objects to R2 bucket ${options.bucket} with ${mode} concurrency=${options.concurrency}...`);

  await runPool(files, options.concurrency, async (item) => {
    try {
      await withRetries(async () => {
        if (options.uploaderUrl) {
          await putR2ObjectWithUploader({
            uploaderUrl: options.uploaderUrl,
            uploadToken,
            key: item.key,
            file: item.file,
          });
        } else {
          await putR2Object({
            accountId: options.accountId,
            bucket: options.bucket,
            key: item.key,
            file: item.file,
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          });
        }
      });
      uploaded++;
      bytes += item.size;
      if (uploaded % 50 === 0 || uploaded === files.length) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`Uploaded ${uploaded}/${files.length} (${(bytes / 1024 / 1024).toFixed(2)} MB) in ${elapsed}s`);
      }
    } catch (error) {
      failures.push({ key: item.key, error: error.message });
    }
  });

  if (failures.length > 0) {
    throw new Error(`R2 upload failed for ${failures.length} objects: ${JSON.stringify(failures.slice(0, 5))}`);
  }

  return {
    ok: true,
    bucket: options.bucket,
    prefix: options.prefix,
    mode,
    concurrency: options.concurrency,
    objects: uploaded,
    bytes,
    elapsedMs: Date.now() - startedAt,
  };
}

async function withRetries(operation, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(250 * attempt);
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readR2Credentials() {
  const env = readEnvLocal();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID || env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY || env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 S3 credentials. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in environment or .env.local. Refusing to fork wrangler per object.');
  }
  return { accessKeyId, secretAccessKey };
}

function readUploaderToken() {
  const tokenPath = path.resolve(__dirname, 'temp/r2-uploader-worker/.upload-token');
  if (!fs.existsSync(tokenPath)) throw new Error(`Missing uploader token: ${tokenPath}`);
  return fs.readFileSync(tokenPath, 'utf8').trim();
}

function readEnvLocal() {
  const envPath = path.resolve(__dirname, '../../../.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ''),
      ];
    }));
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function putR2Object({ accountId, bucket, key, file, accessKeyId, secretAccessKey }) {
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const pathName = `/${bucket}/${encodedKey}`;
  const url = `https://${host}${pathName}`;
  const body = fs.readFileSync(file);
  const payloadHash = sha256Hex(body);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const contentType = contentTypeOf(file);
  const headers = {
    'content-type': contentType,
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name]}\n`).join('');
  const canonicalRequest = [
    'PUT',
    pathName,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, authorization },
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
}

async function putR2ObjectWithUploader({ uploaderUrl, uploadToken, key, file }) {
  const body = fs.readFileSync(file);
  const response = await fetch(`${uploaderUrl}/${key.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: {
      'content-type': contentTypeOf(file),
      'x-upload-token': uploadToken,
    },
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
}

function contentTypeOf(file) {
  return file.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/octet-stream';
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return createHmac('sha256', key).update(value).digest();
}

function getSignatureKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
