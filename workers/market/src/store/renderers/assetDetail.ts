import type { RendererContext } from '../../types.js';
import { rowText } from './row.js';

export async function renderAssetDetail({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const assetId = projectionPlan.scope.assetId || '';
  const key = projectionRegistry.keyOf('asset.detail', { assetId });
  const asset = await d1.getAssetWithEntry(assetId);
  if (!asset) return { written: [] };
  if (rowText(asset, 'entry_state_code') !== 'approved' || rowText(asset, 'version_state_code') !== 'approved') return { written: [] };
  await r2.writeJson(key, {
    ok: true,
    marketVersion: 2,
    generatedAt: new Date().toISOString(),
    item: {
      id: rowText(asset, 'id'),
      entryId: rowText(asset, 'entry_id'),
      type: rowText(asset, 'type'),
      versionId: rowText(asset, 'version_id'),
      kind: rowText(asset, 'kind'),
      url: rowText(asset, 'url'),
      sha256: rowText(asset, 'sha256'),
    },
  });
  return { written: [key] };
}
