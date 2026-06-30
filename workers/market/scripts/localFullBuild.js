import { FileR2 } from "../test/helpers.js";
import { createMarketStore } from "../dist/store/MarketStore.js";
import { fullBuildIfNeeded } from "../dist/build.js";
import { readFileSync, copyFileSync, mkdirSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const srcDb = join(__dirname, "..", "migration-output", "local_market.db");
console.log("Source DB:", srcDb);
const tmpDir = join(tmpdir(), `local-build-${randomBytes(6).toString("hex")}`);
mkdirSync(tmpDir, { recursive: true });
const dbPath = join(tmpDir, "test.db");
copyFileSync(srcDb, dbPath);

const SQL = await import("sql.js");
const sql = await SQL.default();
const buffer = readFileSync(dbPath);
const sqlite = new sql.Database(new Uint8Array(buffer));

function saveDb() {
  try { writeFileSync(dbPath, Buffer.from(sqlite.export())); } catch {}
}

function parseRows(rows) {
  if (!rows || rows.length === 0) return [];
  const cols = rows[0].columns;
  return rows[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

const db = {
  prepare: (sql_) => ({
    _sqlite: sqlite, _sql: sql_, _params: [],
    bind(...p) { this._params = p; return this; },
    run() { this._sqlite.run(this._sql, this._params); saveDb(); return { success: true }; },
    first() { const r = this._sqlite.exec(this._sql, this._params); const rows = parseRows(r); return rows.length > 0 ? rows[0] : null; },
    all() { const r = this._sqlite.exec(this._sql, this._params); return parseRows(r); },
    raw() { return { results: this._sqlite.exec(this._sql, this._params) }; },
  }),
};

const r2 = new FileR2();
const store = createMarketStore({ db, MARKET_STATS_BUCKET: r2 });
const env = { db, MARKET_STATS_BUCKET: r2, store };

console.log("Starting fullBuild...");
const start = Date.now();
const result = await fullBuildIfNeeded(env);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

if ("skipped" in result) {
  console.log(`SKIPPED (last_full_build within 30 days)`);
} else {
  console.log(`DONE in ${elapsed}s — materialized ${result.materialized} R2 objects`);
}

function countFiles(dir) {
  let total = 0, totalSize = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { const c = countFiles(p); total += c.count; totalSize += c.size; }
    else { total++; totalSize += statSync(p).size; }
  }
  return { count: total, size: totalSize };
}
const files = countFiles(r2.dir);
console.log(`R2 files: ${files.count}, total size: ${(files.size / 1024).toFixed(1)} KB`);

const manifest = r2.readJson("market/v2/manifest.json");
console.log(`Manifest: ${manifest.generatedAt}, types=${manifest.types.length}, categories=${manifest.categories.length}`);

for (const sort of ["updated", "likes", "downloads"]) {
  const listKey = `market/v2/lists/all/${sort}/page-1.json`;
  try {
    const list = r2.readJson(listKey);
    console.log(`List ${sort}/page-1: ${list.total} entries, ${list.items.length} items in page`);
  } catch {
    console.log(`List ${sort}/page-1: MISSING`);
  }
}

console.log(`R2 dir: ${r2.dir}`);
