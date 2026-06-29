import { isArtifactType, isRepoType } from '../../shared.js';
import type { BuildSnapshot, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';

// Incremental D1-based item builder (used by listPage renderer)
export { buildEntryItem } from './entryBundle.inc.js';

export interface EntryItem {
  type: string; id: string; title: string; description: string; detail?: string; authorId: string; publisherId: string; categoryId?: string; stateCode: string; createdAt: string; updatedAt: string; publishedAt?: string;
  author?: { id: string; login: string; avatar: string };
  publisher?: { id: string; login: string; avatar: string };
  source?: { kind: string; url: string };
  artifact?: { projectId: string; runtimePkg?: string };
  assets?: { id: string; versionId: string; kind: string; url: string; sha256: string; assetName?: string }[];
  versions?: { id: string; version: string; formatVer: string; minAppVer: string; maxAppVer?: string; changelog?: string; installConfig?: string; runtimePackageId?: string; publishedAt?: string }[];
  latestVersion?: { id: string; version: string; formatVer: string; minAppVer: string; maxAppVer?: string; changelog?: string; installConfig?: string; runtimePackageId?: string; publishedAt?: string };
  reactions?: { reaction: string; total: number }[];
  downloads?: number;
  downloadCount?: number;
  stats?: { downloads: number; likes: number; lastDownloadAt?: string | null; updatedAt?: string | null };
}

export interface LegacyMarketStats {
  downloads: number;
  likes: number;
  lastDownloadAt?: string | null;
  lastLikeAt?: string | null;
  updatedAt?: string | null;
}

export interface BuildSnapshotIndex {
  reposByEntryId: Map<string, Row>;
  repoVersionsByVersionId: Map<string, Row>;
  artifactProjectByEntryId: Map<string, Row>;
  assetsByEntryId: Map<string, Row[]>;
  approvedVersionsByEntryId: Map<string, Row[]>;
  reactionsByEntryId: Map<string, Row[]>;
  entryStatsByEntryId: Map<string, LegacyMarketStats>;
  authorsByNumber: Map<number, Row>;
}

export function createBuildSnapshotIndex(snap: BuildSnapshot): BuildSnapshotIndex {
  const reposByEntryId = new Map<string, Row>();
  for (const row of snap.repos) reposByEntryId.set(rowText(row, 'entry_id'), row);

  const repoVersionsByVersionId = new Map<string, Row>();
  for (const row of snap.repoVersions) repoVersionsByVersionId.set(rowText(row, 'version_id'), row);

  const artifactProjectByEntryId = new Map<string, Row>();
  for (const row of snap.artifactProjects) artifactProjectByEntryId.set(rowText(row, 'entry_id'), row);


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

  const entryStatsByEntryId = new Map<string, LegacyMarketStats>();
  for (const row of snap.entryStats ?? []) {
    const entryId = rowText(row, 'entry_id');
    if (!entryId) continue;
    entryStatsByEntryId.set(entryId, {
      downloads: Number(row.downloads_total || 0),
      likes: Number(row.likes_total || 0),
      lastDownloadAt: rowOptionalText(row, 'last_download_at') ?? null,
      lastLikeAt: rowOptionalText(row, 'last_like_at') ?? null,
      updatedAt: rowOptionalText(row, 'updated_at') ?? null,
    });
  }

  const authorsByNumber = new Map<number, Row>();
  for (const row of snap.authors ?? []) {
    const num = Number(row.github_id);
    if (!isNaN(num)) authorsByNumber.set(num, row);
  }

  return { reposByEntryId, repoVersionsByVersionId, artifactProjectByEntryId, assetsByEntryId, approvedVersionsByEntryId, reactionsByEntryId, entryStatsByEntryId, authorsByNumber };
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
      item.artifact = {
        projectId: rowText(project, 'project_key'),
        ...(rowOptionalText(project, 'runtime_pkg') ? { runtimePkg: rowText(project, 'runtime_pkg') } : {}),
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
  item.versions = versions.map((version) => {
    const repoVersion = isRepoType(type) && index ? index.repoVersionsByVersionId.get(rowText(version, 'id')) : undefined;
    return {
      id: rowText(version, 'id'), version: rowText(version, 'version'), formatVer: rowText(version, 'format_ver'), minAppVer: rowText(version, 'min_app_ver'),
      ...(rowOptionalText(version, 'max_app_ver') ? { maxAppVer: rowText(version, 'max_app_ver') } : {}),
      ...(rowOptionalText(version, 'changelog') ? { changelog: rowText(version, 'changelog') } : {}),
      ...(repoVersion && rowOptionalText(repoVersion, 'install_config') ? { installConfig: rowText(repoVersion, 'install_config') } : {}),
      ...(rowOptionalText(version, 'runtime_pkg') ? { runtimePackageId: rowText(version, 'runtime_pkg') } : {}),
      ...(rowOptionalText(version, 'published_at') ? { publishedAt: rowText(version, 'published_at') } : {}),
    };
  });
  if (latest) {
    const repoVersion = isRepoType(type) && index ? index.repoVersionsByVersionId.get(rowText(latest, 'id')) : undefined;
    item.latestVersion = {
      id: rowText(latest, 'id'), version: rowText(latest, 'version'), formatVer: rowText(latest, 'format_ver'), minAppVer: rowText(latest, 'min_app_ver'),
      ...(rowOptionalText(latest, 'max_app_ver') ? { maxAppVer: rowText(latest, 'max_app_ver') } : {}),
      ...(rowOptionalText(latest, 'changelog') ? { changelog: rowText(latest, 'changelog') } : {}),
      ...(repoVersion && rowOptionalText(repoVersion, 'install_config') ? { installConfig: rowText(repoVersion, 'install_config') } : {}),
      ...(rowOptionalText(latest, 'runtime_pkg') ? { runtimePackageId: rowText(latest, 'runtime_pkg') } : {}),
      ...(rowOptionalText(latest, 'published_at') ? { publishedAt: rowText(latest, 'published_at') } : {}),
    };
  }
  item.reactions = (index ? (index.reactionsByEntryId.get(entryId) ?? []) : snap.reactions.filter((r) => rowText(r, 'entry_id') === entryId))
    .map((r) => ({ reaction: rowText(r, 'reaction'), total: Number(r.total_count || 0) }));
  const reactionsLikeTotal = item.reactions
    .filter((r) => r.reaction === '+1' || r.reaction.toLowerCase() === 'like')
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
  const entryStats = index?.entryStatsByEntryId.get(entryId);
  const downloads = Number(entryStats?.downloads || 0);
  const likes = Number(entryStats?.likes ?? reactionsLikeTotal);
  item.downloads = downloads;
  item.downloadCount = downloads;
  item.stats = {
    downloads,
    likes,
    ...(entryStats?.lastDownloadAt ? { lastDownloadAt: entryStats.lastDownloadAt } : {}),
    ...(entryStats?.updatedAt ? { updatedAt: entryStats.updatedAt } : {}),
  };

  // append author/publisher display info from snapshot authors list (match on github_id number)
  if (index) {
    const authorDigits = item.authorId ? Number(item.authorId.replace(/^gh_/, '')) : NaN;
    const publisherDigits = item.publisherId ? Number(item.publisherId.replace(/^gh_/, '')) : NaN;
    if (!isNaN(authorDigits)) {
      const author = index.authorsByNumber.get(authorDigits);
      if (author) item.author = { id: item.authorId, login: rowText(author, 'github_login'), avatar: rowText(author, 'owner_avatar') };
    }
    if (!isNaN(publisherDigits)) {
      const publisher = index.authorsByNumber.get(publisherDigits);
      if (publisher) item.publisher = { id: item.publisherId, login: rowText(publisher, 'github_login'), avatar: rowText(publisher, 'owner_avatar') };
    }
  }

  return item;
}

function appendToMap(map: Map<string, Row[]>, key: string, row: Row): void {
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
}
