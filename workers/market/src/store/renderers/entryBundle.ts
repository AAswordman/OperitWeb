import { isArtifactType, isRepoType } from '../../shared.js';
import type { BuildSnapshot, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';

// Incremental D1-based item builder (used by listPage renderer)
export { buildEntryItem } from './entryBundle.inc.js';

export interface EntryItem {
  type: string; id: string; title: string; description: string; detail?: string; authorId: string; publisherId: string; categoryId?: string; stateCode: string; createdAt: string; updatedAt: string; publishedAt?: string;
  source?: { kind: string; url: string };
  artifact?: { projectId: string; rootNodeId?: string; runtimePkg?: string; nodes: { id: string; nodeKey: string; runtimePkg?: string; versionId?: string }[] };
  assets?: { id: string; versionId: string; kind: string; url: string; sha256: string; assetName?: string }[];
  latestVersion?: { id: string; version: string; formatVer: string; minAppVer: string; maxAppVer?: string; publishedAt?: string };
  reactions?: { reaction: string; total: number }[];
}

export interface BuildSnapshotIndex {
  reposByEntryId: Map<string, Row>;
  artifactProjectByEntryId: Map<string, Row>;
  artifactNodesByProjectId: Map<string, Row[]>;
  assetsByEntryId: Map<string, Row[]>;
  approvedVersionsByEntryId: Map<string, Row[]>;
  reactionsByEntryId: Map<string, Row[]>;
}

export function createBuildSnapshotIndex(snap: BuildSnapshot): BuildSnapshotIndex {
  const reposByEntryId = new Map<string, Row>();
  for (const row of snap.repos) reposByEntryId.set(rowText(row, 'entry_id'), row);

  const artifactProjectByEntryId = new Map<string, Row>();
  for (const row of snap.artifactProjects) artifactProjectByEntryId.set(rowText(row, 'entry_id'), row);

  const artifactNodesByProjectId = new Map<string, Row[]>();
  for (const row of snap.artifactNodes) appendToMap(artifactNodesByProjectId, rowText(row, 'project_id'), row);

  const versionEntryIds = new Map<string, string>();
  const approvedVersionsByEntryId = new Map<string, Row[]>();
  for (const row of snap.versions) {
    const entryId = rowText(row, 'entry_id');
    versionEntryIds.set(rowText(row, 'id'), entryId);
    if (rowText(row, 'state_code') === 'approved') appendToMap(approvedVersionsByEntryId, entryId, row);
  }
  for (const list of approvedVersionsByEntryId.values()) {
    list.sort((a, b) => rowText(b, 'published_at').localeCompare(rowText(a, 'published_at')));
  }

  const assetsByEntryId = new Map<string, Row[]>();
  for (const row of snap.assets) {
    const entryId = versionEntryIds.get(rowText(row, 'version_id'));
    if (entryId) appendToMap(assetsByEntryId, entryId, row);
  }

  const reactionsByEntryId = new Map<string, Row[]>();
  for (const row of snap.reactions) appendToMap(reactionsByEntryId, rowText(row, 'entry_id'), row);

  return { reposByEntryId, artifactProjectByEntryId, artifactNodesByProjectId, assetsByEntryId, approvedVersionsByEntryId, reactionsByEntryId };
}

export function buildEntryFromSnapshot(entry: Row, snap: BuildSnapshot, index?: BuildSnapshotIndex): EntryItem {
  const type = rowText(entry, 'type');
  const item: EntryItem = {
    type, id: rowText(entry, 'id'), title: rowText(entry, 'title'), description: rowText(entry, 'description'), detail: rowText(entry, 'detail'),
    authorId: rowText(entry, 'author_id'), publisherId: rowText(entry, 'publisher_id'),
    ...(rowOptionalText(entry, 'category_id') ? { categoryId: rowText(entry, 'category_id') } : {}),
    stateCode: rowText(entry, 'state_code'), createdAt: rowText(entry, 'created_at'), updatedAt: rowText(entry, 'updated_at'),
    ...(rowOptionalText(entry, 'published_at') ? { publishedAt: rowText(entry, 'published_at') } : {}),
  };
  const entryId = item.id;
  if (isRepoType(type)) {
    const spec = index ? index.reposByEntryId.get(entryId) : snap.repos.find((r) => rowText(r, 'entry_id') === entryId);
    if (spec) item.source = { kind: rowText(spec, 'source_kind'), url: rowText(spec, 'source_url') };
  }
  if (isArtifactType(type)) {
    const project = index ? index.artifactProjectByEntryId.get(entryId) : snap.artifactProjects.find((p) => rowText(p, 'entry_id') === entryId);
    if (project) {
      const projId = rowText(project, 'id');
      item.artifact = {
        projectId: rowText(project, 'project_key'),
        ...(rowOptionalText(project, 'root_node_id') ? { rootNodeId: rowText(project, 'root_node_id') } : {}),
        ...(rowOptionalText(project, 'runtime_pkg') ? { runtimePkg: rowText(project, 'runtime_pkg') } : {}),
        nodes: (index ? (index.artifactNodesByProjectId.get(projId) ?? []) : snap.artifactNodes.filter((n) => rowText(n, 'project_id') === projId)).map((n) => ({
          id: rowText(n, 'id'), nodeKey: rowText(n, 'node_key'),
          ...(rowOptionalText(n, 'runtime_pkg') ? { runtimePkg: rowText(n, 'runtime_pkg') } : {}),
          ...(rowOptionalText(n, 'version_id') ? { versionId: rowText(n, 'version_id') } : {}),
        })),
      };
    }
    item.assets = (index ? (index.assetsByEntryId.get(entryId) ?? []) : snap.assets.filter((a) => {
      const version = snap.versions.find((vv) => rowText(vv, 'id') === rowText(a, 'version_id'));
      return version && rowText(version, 'entry_id') === entryId;
    })).map((a) => ({
      id: rowText(a, 'id'), versionId: rowText(a, 'version_id'), kind: rowText(a, 'kind'), url: rowText(a, 'url'), sha256: rowText(a, 'sha256'),
      ...(rowOptionalText(a, 'asset_name') ? { assetName: rowText(a, 'asset_name') } : {}),
    }));
  }
  const versions = index
    ? (index.approvedVersionsByEntryId.get(entryId) ?? [])
    : snap.versions.filter((v) => rowText(v, 'entry_id') === entryId && rowText(v, 'state_code') === 'approved')
      .sort((a, b) => rowText(b, 'published_at').localeCompare(rowText(a, 'published_at')));
  const latest = versions[0];
  if (latest) {
    item.latestVersion = {
      id: rowText(latest, 'id'), version: rowText(latest, 'version'), formatVer: rowText(latest, 'format_ver'), minAppVer: rowText(latest, 'min_app_ver'),
      ...(rowOptionalText(latest, 'max_app_ver') ? { maxAppVer: rowText(latest, 'max_app_ver') } : {}),
      ...(rowOptionalText(latest, 'published_at') ? { publishedAt: rowText(latest, 'published_at') } : {}),
    };
  }
  item.reactions = (index ? (index.reactionsByEntryId.get(entryId) ?? []) : snap.reactions.filter((r) => rowText(r, 'entry_id') === entryId))
    .map((r) => ({ reaction: rowText(r, 'reaction'), total: Number(r.total_count || 0) }));
  return item;
}

function appendToMap(map: Map<string, Row[]>, key: string, row: Row): void {
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
}
