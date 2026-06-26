import type { RendererContext } from '../../types.js';
import { rowText } from './row.js';

export async function renderAssetDetail({ d1, r2, projectionPlan, projectionRegistry }: RendererContext): Promise<{ written: string[] }> {
  const assetId = projectionPlan.scope.assetId || '';
  const key = projectionRegistry.keyOf('asset.detail', { assetId });
  const asset = await d1.listAssets('').then((list) => list.find((a) => rowText(a, 'id') === assetId));
  if (!asset) return { written: [] };
  await r2.writeJson(key, { ok: true, marketVersion: 2, generatedAt: new Date().toISOString(), item: { id: rowText(asset, 'id'), versionId: rowText(asset, 'version_id'), kind: rowText(asset, 'kind'), url: rowText(asset, 'url'), sha256: rowText(asset, 'sha256') } });
  return { written: [key] };
}
