import { isoNow } from '../../shared.js';
import type { BuildSnapshot, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';

export function writeEntryVersionsR2(entryId: string, snap: BuildSnapshot, r2: { writeJson(key: string, value: unknown): Promise<unknown> }, key: string): { key: string; value: unknown } {
  const versions = snap.versions.filter((v) => rowText(v, 'entry_id') === entryId);
  return {
    key,
    value: {
      ok: true, marketVersion: 2, entryId, generatedAt: isoNow(),
      items: versions.map((v) => ({
        id: rowText(v, 'id'), version: rowText(v, 'version'), formatVer: rowText(v, 'format_ver'), minAppVer: rowText(v, 'min_app_ver'),
        ...(rowOptionalText(v, 'max_app_ver') ? { maxAppVer: rowText(v, 'max_app_ver') } : {}),
        stateCode: rowText(v, 'state_code'),
        ...(rowOptionalText(v, 'changelog') ? { changelog: rowText(v, 'changelog') } : {}),
        ...(rowOptionalText(v, 'published_at') ? { publishedAt: rowText(v, 'published_at') } : {}),
      })),
    },
  };
}

// Keep incremental render
export { renderEntryVersions } from './entryVersions.inc.js';
