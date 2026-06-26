import { isoNow } from '../../shared.js';
import type { JsonObject, JsonValue, RendererContext, Row } from '../../types.js';
import { scopeHash } from '../registry/ProjectionRegistry.js';
import { buildEntryItem } from './entryBundle.js';
import { rowText } from './row.js';

export function entryShardOf(entryId: string): string {
  return scopeHash(entryId).substring(0, 2).toLowerCase();
}

export async function renderEntryShard({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const shard = String(projectionPlan.scope.shard || (projectionPlan.scope.entryId ? entryShardOf(projectionPlan.scope.entryId) : '')).toLowerCase();
  if (!/^[0-9a-f]{2}$/.test(shard)) throw new Error('entry.shard scope.shard must be a 2-char hex shard');
  const key = projectionRegistry.keyOf('entry.shard', { shard });
  const entryId = projectionPlan.scope.entryId;
  if (entryId) {
    const current = await r2.readJson(key);
    const entriesById = readEntriesById(current);
    const entry = await d1.getEntry(entryId);
    if (entry && rowText(entry, 'state_code') === 'approved' && entryShardOf(rowText(entry, 'id')) === shard) {
      entriesById[entryId] = await buildEntryItem(d1, entry);
    } else {
      delete entriesById[entryId];
    }
    await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), shard, entriesById });
    return { written: [key] };
  }

  const rows = (await d1.listAllEntries())
    .filter((entry: Row) => rowText(entry, 'state_code') === 'approved')
    .filter((entry: Row) => entryShardOf(rowText(entry, 'id')) === shard);
  const entriesById: Record<string, unknown> = {};
  for (const entry of rows) {
    entriesById[rowText(entry, 'id')] = await buildEntryItem(d1, entry);
  }
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), shard, entriesById });
  return { written: [key] };
}

function readEntriesById(value: JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = (value as JsonObject).entriesById;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return {};
  return { ...entries } as Record<string, unknown>;
}
