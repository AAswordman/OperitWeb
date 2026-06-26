import { MarketError } from '../../shared.js';
import type { JsonValue, R2Backend, R2BucketLike, R2OperationStats, R2WriteStat } from '../../types.js';

export function createR2Backend(bucket: R2BucketLike): R2Backend {
  if (!bucket) throw new MarketError('server_error', 'R2 bucket is not configured', 500);
  const stats: R2OperationStats = {
    reads: 0,
    writes: 0,
    lists: 0,
    deletes: 0,
    jsonCharsWritten: 0,
    stringifyMs: 0,
    putMs: 0,
    recentWrites: [],
  };
  return {
    stats,

    async writeJson(key: string, value: unknown): Promise<string> {
      stats.writes++;
      const stringifyStart = Date.now();
      const text = JSON.stringify(value);
      const stringifyMs = Date.now() - stringifyStart;
      const putStart = Date.now();
      await bucket.put(key, text, { httpMetadata: { contentType: 'application/json' } });
      const putMs = Date.now() - putStart;
      recordWrite(stats, { key, chars: text.length, stringifyMs, putMs, totalMs: stringifyMs + putMs });
      return key;
    },

    async readJson(key: string): Promise<JsonValue | null> {
      stats.reads++;
      const obj = await bucket.get(key);
      if (!obj) return null;
      const text = typeof obj.text === 'function' ? await obj.text() : String(obj.body ?? '');
      return JSON.parse(text) as JsonValue;
    },

    async delete(key: string): Promise<string> {
      stats.deletes++;
      if (bucket.delete) await bucket.delete(key);
      return key;
    },

    async list(prefix: string): Promise<{ objects: { key: string }[] }> {
      stats.lists++;
      if (!bucket.list) return { objects: [] };
      return bucket.list({ prefix });
    },
  };
}

function recordWrite(stats: R2OperationStats, item: R2WriteStat): void {
  stats.jsonCharsWritten += item.chars;
  stats.stringifyMs += item.stringifyMs;
  stats.putMs += item.putMs;
  stats.recentWrites.push(item);
  if (stats.recentWrites.length > 512) stats.recentWrites.shift();
}
