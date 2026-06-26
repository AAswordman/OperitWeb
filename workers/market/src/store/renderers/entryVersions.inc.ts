import { isoNow } from '../../shared.js';
import type { RendererContext, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';

export async function renderEntryVersions({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const entryId = projectionPlan.scope.entryId || '';
  const key = projectionRegistry.keyOf('entry.versions', { entryId });
  const versions = await d1.listVersionsForEntry(entryId);
  await r2.writeJson(key, { ok: true, marketVersion: 2, entryId, generatedAt: isoNow(), items: versions.map((v: Row) => ({ id: rowText(v, 'id'), version: rowText(v, 'version'), formatVer: rowText(v, 'format_ver'), minAppVer: rowText(v, 'min_app_ver'), ...(rowOptionalText(v, 'max_app_ver') ? { maxAppVer: rowText(v, 'max_app_ver') } : {}), stateCode: rowText(v, 'state_code'), ...(rowOptionalText(v, 'changelog') ? { changelog: rowText(v, 'changelog') } : {}), ...(rowOptionalText(v, 'published_at') ? { publishedAt: rowText(v, 'published_at') } : {}) })) });
  return { written: [key] };
}
