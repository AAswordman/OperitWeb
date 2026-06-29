import { isArtifactType, isRepoType } from '../../shared.js';
import type { RendererContext, Row } from '../../types.js';
import { rowOptionalText, rowText } from './row.js';
import type { EntryItem } from './entryBundle.js';

export async function buildEntryItem(d1: RendererContext['d1'], entry: Row): Promise<EntryItem> {
  const type = rowText(entry, 'type');
  const item: EntryItem = { type, id: rowText(entry, 'id'), title: rowText(entry, 'title'), description: rowText(entry, 'description'), detail: rowText(entry, 'detail'), authorId: rowText(entry, 'author_id'), publisherId: rowText(entry, 'publisher_id'), ...(rowOptionalText(entry, 'category_id') ? { categoryId: rowText(entry, 'category_id') } : {}), stateCode: rowText(entry, 'state_code'), createdAt: rowText(entry, 'created_at'), updatedAt: rowText(entry, 'updated_at'), ...(rowOptionalText(entry, 'published_at') ? { publishedAt: rowText(entry, 'published_at') } : {}) };

  const author = await d1.getAuthor(item.authorId);
  if (author) item.author = { id: item.authorId, login: rowText(author, 'github_login'), avatar: rowText(author, 'owner_avatar') };
  const publisher = item.publisherId !== item.authorId ? await d1.getAuthor(item.publisherId) : author;
  if (publisher) item.publisher = { id: item.publisherId, login: rowText(publisher, 'github_login'), avatar: rowText(publisher, 'owner_avatar') };

  if (isRepoType(type)) { const spec = await d1.getRepoSpecByEntry(item.id); if (spec) item.source = { kind: rowText(spec, 'source_kind'), url: rowText(spec, 'source_url') }; }
  if (isArtifactType(type)) {
    const project = await d1.getArtifactProject(item.id);
    if (project) {
      item.artifact = { projectId: rowText(project, 'project_key'), ...(rowOptionalText(project, 'runtime_pkg') ? { runtimePkg: rowText(project, 'runtime_pkg') } : {}) };
    }
    item.assets = (await d1.listAssets(item.id)).map((a: Row) => ({ id: rowText(a, 'id'), versionId: rowText(a, 'version_id'), kind: rowText(a, 'kind'), url: rowText(a, 'url'), sha256: rowText(a, 'sha256'), ...(rowOptionalText(a, 'asset_name') ? { assetName: rowText(a, 'asset_name') } : {}) }));
  }
  const versions = (await d1.listVersionsForEntry(item.id)).filter((v: Row) => rowText(v, 'state_code') === 'approved').sort((a: Row, b: Row) => rowText(b, 'published_at').localeCompare(rowText(a, 'published_at')));
  const latest = versions[0];
  item.versions = await Promise.all(versions.map(async (version: Row) => {
    const repoVersion = isRepoType(type) ? await d1.getRepoVersion(rowText(version, 'id')) : null;
    return {
      id: rowText(version, 'id'), version: rowText(version, 'version'), formatVer: rowText(version, 'format_ver'), minAppVer: rowText(version, 'min_app_ver'),
      ...(rowOptionalText(version, 'max_app_ver') ? { maxAppVer: rowText(version, 'max_app_ver') } : {}),
      ...(rowOptionalText(version, 'changelog') ? { changelog: rowText(version, 'changelog') } : {}),
      ...(repoVersion && rowOptionalText(repoVersion, 'install_config') ? { installConfig: rowText(repoVersion, 'install_config') } : {}),
      ...(rowOptionalText(version, 'runtime_pkg') ? { runtimePackageId: rowText(version, 'runtime_pkg') } : {}),
      ...(rowOptionalText(version, 'published_at') ? { publishedAt: rowText(version, 'published_at') } : {}),
    };
  }));
  if (!latest) return item;
  const repoVersion = isRepoType(type) ? await d1.getRepoVersion(rowText(latest, 'id')) : null;
  item.latestVersion = { id: rowText(latest, 'id'), version: rowText(latest, 'version'), formatVer: rowText(latest, 'format_ver'), minAppVer: rowText(latest, 'min_app_ver'), ...(rowOptionalText(latest, 'max_app_ver') ? { maxAppVer: rowText(latest, 'max_app_ver') } : {}), ...(rowOptionalText(latest, 'changelog') ? { changelog: rowText(latest, 'changelog') } : {}), ...(repoVersion && rowOptionalText(repoVersion, 'install_config') ? { installConfig: rowText(repoVersion, 'install_config') } : {}), ...(rowOptionalText(latest, 'runtime_pkg') ? { runtimePackageId: rowText(latest, 'runtime_pkg') } : {}), ...(rowOptionalText(latest, 'published_at') ? { publishedAt: rowText(latest, 'published_at') } : {}) };
  item.reactions = (await d1.getReactionCounts(item.id)).map((r: Row) => ({ reaction: rowText(r, 'reaction'), total: Number(r.total_count || 0) }));
  const likes = item.reactions.filter((r) => r.reaction === '+1' || r.reaction.toLowerCase() === 'like').reduce((sum, r) => sum + Number(r.total || 0), 0);
  const entryStats = await d1.getEntryStats(item.id);
  const downloads = Number(entryStats?.downloads_total || 0);
  const totalLikes = Number(entryStats?.likes_total ?? likes);
  item.downloads = downloads;
  item.downloadCount = downloads;
  item.stats = {
    downloads,
    likes: totalLikes,
    ...(rowOptionalText(entryStats || {}, 'last_download_at') ? { lastDownloadAt: rowText(entryStats || {}, 'last_download_at') } : {}),
    ...(rowOptionalText(entryStats || {}, 'updated_at') ? { updatedAt: rowText(entryStats || {}, 'updated_at') } : {}),
  };
  return item;
}

