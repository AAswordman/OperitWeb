import { isArtifactType, isRepoType } from '../../shared.js';
import type { RendererContext, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';
import type { EntryItem } from './entryBundle.js';

export async function buildEntryItem(d1: RendererContext['d1'], entry: Row): Promise<EntryItem> {
  const type = rowText(entry, 'type');
  const item: EntryItem = { type, id: rowText(entry, 'id'), title: rowText(entry, 'title'), description: rowText(entry, 'description'), detail: rowText(entry, 'detail'), authorId: rowText(entry, 'author_id'), publisherId: rowText(entry, 'publisher_id'), ...(rowOptionalText(entry, 'category_id') ? { categoryId: rowText(entry, 'category_id') } : {}), stateCode: rowText(entry, 'state_code'), createdAt: rowText(entry, 'created_at'), updatedAt: rowText(entry, 'updated_at'), ...(rowOptionalText(entry, 'published_at') ? { publishedAt: rowText(entry, 'published_at') } : {}) };
  if (isRepoType(type)) { const spec = await d1.getRepoSpecByEntry(item.id); if (spec) item.source = { kind: rowText(spec, 'source_kind'), url: rowText(spec, 'source_url') }; }
  if (isArtifactType(type)) {
    const project = await d1.getArtifactProject(item.id);
    if (project) item.artifact = { projectId: rowText(project, 'project_key'), ...(rowOptionalText(project, 'root_node_id') ? { rootNodeId: rowText(project, 'root_node_id') } : {}), ...(rowOptionalText(project, 'runtime_pkg') ? { runtimePkg: rowText(project, 'runtime_pkg') } : {}), nodes: (await d1.listArtifactNodes(rowText(project, 'id'))).map((n: Row) => ({ id: rowText(n, 'id'), nodeKey: rowText(n, 'node_key'), ...(rowOptionalText(n, 'runtime_pkg') ? { runtimePkg: rowText(n, 'runtime_pkg') } : {}), ...(rowOptionalText(n, 'version_id') ? { versionId: rowText(n, 'version_id') } : {}) })) };
    item.assets = (await d1.listAssets(item.id)).map((a: Row) => ({ id: rowText(a, 'id'), versionId: rowText(a, 'version_id'), kind: rowText(a, 'kind'), url: rowText(a, 'url'), sha256: rowText(a, 'sha256'), ...(rowOptionalText(a, 'asset_name') ? { assetName: rowText(a, 'asset_name') } : {}) }));
  }
  const versions = (await d1.listVersionsForEntry(item.id)).filter((v: Row) => rowText(v, 'state_code') === 'approved').sort((a: Row, b: Row) => rowText(b, 'published_at').localeCompare(rowText(a, 'published_at')));
  const latest = versions[0];
  if (latest) item.latestVersion = { id: rowText(latest, 'id'), version: rowText(latest, 'version'), formatVer: rowText(latest, 'format_ver'), minAppVer: rowText(latest, 'min_app_ver'), ...(rowOptionalText(latest, 'max_app_ver') ? { maxAppVer: rowText(latest, 'max_app_ver') } : {}), ...(rowOptionalText(latest, 'published_at') ? { publishedAt: rowText(latest, 'published_at') } : {}) };
  item.reactions = (await d1.getReactionCounts(item.id)).map((r: Row) => ({ reaction: rowText(r, 'reaction'), total: Number(r.total_count || 0) }));
  return item;
}
