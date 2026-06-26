// Shared test helpers: FileR2 + FileSqlite + operation counters
// Both backends persist to temp directories on disk, not just memory.

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import initSqlJs from 'sql.js';

// ---- FileR2 ----
// Every put/get/delete/list writes to real files under a tmp directory.

export class FileR2 {
  /** @type {string} */
  dir;
  /** @type {Map<string,number>} */
  _putCounts = new Map();
  /** @type {Map<string,number>} */
  _getCounts = new Map();
  /** @type {Map<string,number>} */
  _deleteCounts = new Map();
  /** @type {number} */
  _listCount = 0;

  constructor() {
    this.dir = join(tmpdir(), `operit-market-test-r2-${randomBytes(6).toString('hex')}`);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
  }

  destroy() { rmSync(this.dir, { recursive: true, force: true }); }

  async put(key, value, options) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const filePath = join(this.dir, key);
    const dir_ = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
    if (dir_ && dir_ !== this.dir) mkdirSync(dir_, { recursive: true });
    writeFileSync(filePath, text, 'utf8');
    this._putCounts.set(key, (this._putCounts.get(key) || 0) + 1);
    return key;
  }

  async get(key) {
    this._getCounts.set(key, (this._getCounts.get(key) || 0) + 1);
    try {
      const text = readFileSync(join(this.dir, key), 'utf8');
      return { body: text, httpEtag: '', async text() { return text; } };
    } catch { return null; }
  }

  async delete(key) {
    this._deleteCounts.set(key, (this._deleteCounts.get(key) || 0) + 1);
    try { unlinkSync(join(this.dir, key)); } catch { /* missing is ok */ }
  }

  async list({ prefix }) {
    this._listCount++;
    const result = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        const key = full.replace(this.dir, '').replaceAll('\\', '/').replace(/^\//, '');
        if (key.startsWith(prefix)) result.push({ key });
      }
    };
    walk(this.dir);
    return { objects: result };
  }

  readJson(key) { return JSON.parse(readFileSync(join(this.dir, key), 'utf8')); }

  get stats() {
    return {
      puts: Array.from(this._putCounts.values()).reduce((a, b) => a + b, 0),
      gets: Array.from(this._getCounts.values()).reduce((a, b) => a + b, 0),
      deletes: Array.from(this._deleteCounts.values()).reduce((a, b) => a + b, 0),
      lists: this._listCount,
    };
  }
}

// ---- FileSqlite ----
// Wraps sql.js but also persists the DB to a tmp file on disk after each run().
// The in-memory sql.js is the live engine; we save to disk for inspection.

export async function createFileSqlite(schemaPath) {
  const SQL = await initSqlJs();
  const schema = readFileSync(schemaPath, 'utf8');
  const dbPath = join(tmpdir(), `operit-market-test-d1-${randomBytes(6).toString('hex')}.sqlite`);

  let sqlite;
  try {
    const buffer = readFileSync(dbPath);
    sqlite = new SQL.Database(new Uint8Array(buffer));
  } catch {
    sqlite = new SQL.Database();
    sqlite.run(schema);
    saveToDisk(sqlite, dbPath);
  }

  const db = {
    path: dbPath,
    prepare: (sql) => new SqlJsStmt(sqlite, sql, dbPath),
    sqlite,
    destroy() { try { rmSync(dbPath); } catch { /* ok */ } },
  };
  return db;
}

class SqlJsStmt {
  constructor(sqlite, sql, dbPath, params = []) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.params = params;
    this._dbPath = dbPath;
  }
  bind(...params) { return new SqlJsStmt(this.sqlite, this.sql, this._dbPath, params); }
  run() {
    this.sqlite.run(this.sql, this.params);
    saveToDisk(this.sqlite, this._dbPath);
    return { success: true };
  }
  first() { return readRows(this.sqlite, this.sql, this.params)[0] || null; }
  all() { return readRows(this.sqlite, this.sql, this.params); }
}

function readRows(sqlite, sql, params = []) {
  const stmt = sqlite.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function saveToDisk(sqlite, dbPath) {
  const data = sqlite.export();
  writeFileSync(dbPath, Buffer.from(data.buffer || data));
}

// ---- Utils ----

export function rows(db, sql, params = []) {
  return readRows(db.sqlite, sql, params);
}
