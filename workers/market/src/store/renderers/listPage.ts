import { isoNow } from '../../shared.js';
import type { RendererContext, Row } from '../../types.js';
import { buildEntryItem } from './entryBundle.js';
import { rowText } from './row.js';

export async function renderListPage({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const scope = projectionPlan.scope;
  const page = Number(scope.page || 1);
  const pageSize = Number(scope.pageSize || 100);
  const sort = scope.sort || 'updated';
  const list = scope.list || {};
  const key = projectionRegistry.keyOf('list.page', scope);
  const approvedEntries: Row[] = [];
  for (const entry of await d1.listAllEntries()) {
    if (rowText(entry, 'state_code') !== 'approved') continue;
    const versions = await d1.listVersionsForEntry(rowText(entry, 'id'));
    if (versions.some((version: Row) => rowText(version, 'state_code') === 'approved')) approvedEntries.push(entry);
  }
  let entries = approvedEntries;
  if (list.type) entries = entries.filter((e) => rowText(e, 'type') === list.type);
  if (list.categoryId) entries = entries.filter((e) => rowText(e, 'category_id') === list.categoryId);
  if (sort === 'likes' || sort === 'downloads') {
    const statsByEntryId = new Map<string, { likes: number; downloads: number }>();
    for (const entry of entries) {
      const stats = await d1.getEntryStats(rowText(entry, 'id'));
      statsByEntryId.set(rowText(entry, 'id'), {
        likes: Number(stats?.likes_total || 0),
        downloads: Number(stats?.downloads_total || 0),
      });
    }
    entries.sort((a, b) => {
      const aStats = statsByEntryId.get(rowText(a, 'id'));
      const bStats = statsByEntryId.get(rowText(b, 'id'));
      const aValue = sort === 'likes' ? (aStats?.likes ?? 0) : (aStats?.downloads ?? 0);
      const bValue = sort === 'likes' ? (bStats?.likes ?? 0) : (bStats?.downloads ?? 0);
      return bValue - aValue || rowText(b, 'updated_at').localeCompare(rowText(a, 'updated_at'));
    });
  } else {
    entries.sort((a, b) => rowText(b, 'updated_at').localeCompare(rowText(a, 'updated_at')));
  }
  const total = entries.length;
  const items = [];
  for (const entry of entries.slice((page - 1) * pageSize, page * pageSize)) items.push(await buildEntryItem(d1, entry));
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: isoNow(), list, sort, page, pageSize, total, items });
  return { written: [key] };
}
