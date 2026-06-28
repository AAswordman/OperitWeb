/**
 * verifyR2Build.js - build and validate local R2 JSON from migrated SQLite data.
 *
 * This does not touch Cloudflare. It reads migration-output/local_market.db,
 * runs the current MarketStore + buildR2 implementation, writes real JSON files
 * to a local temp R2 directory, and validates the current v2 static contract.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { createBuildRoutes } from '../dist/build.js';
import { createMarketStore } from '../dist/store/MarketStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../migration-output');
const DB_PATH = path.join(OUTPUT_DIR, 'local_market.db');
const REPORT_PATH = path.join(OUTPUT_DIR, 'r2-build-report.json');

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
  assertCheck(checks, 'artifact entries have assets', allItems.every((item) => !['script', 'package'].includes(item.type) || (item.artifact && item.assets?.length)), badItems(allItems, (item) => ['script', 'package'].includes(item.type) && !(item.artifact && item.assets?.length)));

  const sample = pickSample(allItems);
  const shard = entryShardOf(sample.id);
  const shardJson = requireJson(r2, `market/v2/entries/${shard}.json`);
  const shardItem = shardJson.entriesById?.[sample.id];
  assertCheck(checks, 'sample exists in entry shard', Boolean(shardItem), { sample: sample.id, shard });
  assertCheck(checks, 'sample shard detail matches list', shardItem?.detail === sample.detail, sample.id);
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

main().catch((error) => { console.error(error); process.exitCode = 1; });
