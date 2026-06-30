import { isoNow } from '../../shared.js';
import type { RendererContext, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';

export async function renderEntryVersions({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const entryId = projectionPlan.scope.entryId || '';
  const key = projectionRegistry.keyOf('entry.versions', { entryId });
  const versions = await d1.listVersionsForEntry(entryId);
  const items = await Promise.all(versions.map(async (v: Row) => {
    const publisherId = rowOptionalText(v, 'publisher_id') ? rowText(v, 'publisher_id') : '';
    const publisher = publisherId ? await d1.getAuthor(publisherId) : null;
    return {
      id: rowText(v, 'id'), version: rowText(v, 'version'), formatVer: rowText(v, 'format_ver'), minAppVer: rowText(v, 'min_app_ver'),
      ...(publisherId ? { publisherId } : {}),
      ...(publisher ? { publisher: { id: publisherId, login: rowText(publisher, 'github_login'), avatar: rowText(publisher, 'owner_avatar') } } : {}),
      ...(rowOptionalText(v, 'max_app_ver') ? { maxAppVer: rowText(v, 'max_app_ver') } : {}),
      stateCode: rowText(v, 'state_code'),
      ...(rowOptionalText(v, 'changelog') ? { changelog: rowText(v, 'changelog') } : {}),
      ...(rowOptionalText(v, 'published_at') ? { publishedAt: rowText(v, 'published_at') } : {}),
    };
  }));
  await r2.writeJson(key, { ok: true, marketVersion: 2, entryId, generatedAt: isoNow(), items });
  return { written: [key] };
}
