import { isoNow } from '../../shared.js';
import type { RendererContext } from '../../types.js';
import { rowBool, rowOptionalText, rowText } from './row.js';

export async function renderManifest({ d1, r2, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const key = projectionRegistry.keyOf('manifest', {});
  const [types, formatVersions, categories, states] = await Promise.all([
    d1.getTypes(), d1.getFormatVersions(), d1.getCategories(), d1.getStateCodes(),
  ]);
  await r2.writeJson(key, {
    ok: true,
    marketVersion: 2,
    generatedAt: isoNow(),
    types: types.map((t) => ({ id: rowText(t, 'slug'), name: rowText(t, 'name'), ...(rowOptionalText(t, 'description') !== undefined ? { description: rowText(t, 'description') } : {}) })),
    formatVersions: formatVersions.map((f) => ({
      id: rowText(f, 'id'),
      type: rowText(f, 'type'),
      name: rowText(f, 'name'),
      publishable: rowBool(f, 'publishable'),
      legacyImportable: rowBool(f, 'legacy_importable'),
    })),
    categories: categories.map((c) => ({ id: rowText(c, 'id'), name: rowText(c, 'name'), ...(rowOptionalText(c, 'description') !== undefined ? { description: rowText(c, 'description') } : {}) })),
    states: states.map((s) => ({ code: rowText(s, 'code'), publicListed: rowBool(s, 'public_listed') })),
  });
  return { written: [key] };
}
