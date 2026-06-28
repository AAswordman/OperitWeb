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
  let entries: Row[] = (await d1.listAllEntries()).filter((e) => rowText(e, 'state_code') === 'approved');
  if (list.type) entries = entries.filter((e) => rowText(e, 'type') === list.type);
  if (list.categoryId) entries = entries.filter((e) => rowText(e, 'category_id') === list.categoryId);
  if (sort === 'likes') {
    const likesByEntryId = new Map<string, number>();
    for (const entry of entries) {
      const stats = await d1.getEntryStats(rowText(entry, 'id'));
      likesByEntryId.set(rowText(entry, 'id'), Number(stats?.likes_total || 0));
    }
    entries.sort((a, b) => {
      const aLikes = likesByEntryId.get(rowText(a, 'id')) ?? 0;
      const bLikes = likesByEntryId.get(rowText(b, 'id')) ?? 0;
      return bLikes - aLikes || rowText(b, 'updated_at').localeCompare(rowText(a, 'updated_at'));
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
