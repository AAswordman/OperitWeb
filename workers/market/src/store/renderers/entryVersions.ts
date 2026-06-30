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
        ...(rowOptionalText(v, 'publisher_id') ? { publisherId: rowText(v, 'publisher_id') } : {}),
        ...(authorInfo(snap, rowText(v, 'publisher_id')) ? { publisher: authorInfo(snap, rowText(v, 'publisher_id')) } : {}),
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

function authorInfo(snap: BuildSnapshot, authorId: string): { id: string; login: string; avatar: string } | undefined {
  if (!authorId) return undefined;
  const author = snap.authors.find((row) => rowText(row, 'id') === authorId);
  return author ? { id: authorId, login: rowText(author, 'github_login'), avatar: rowText(author, 'owner_avatar') } : undefined;
}
