import {  isoNow, makeArtifactNodeId, makeEntryId, makeProjectId, makeVersionId, slug } from '../shared.js';
import type { MarketMutation } from '../types.js';

interface RepoPublishInput {
  type: string;
  title: string;
  description: string;
  categoryId?: string;
  publisherId: string;
  authorId: string;
  repoOwner: string;
  repoName: string;
  sourceUrl: string;
  refType: string;
  refName: string;
  subdir?: string;
  manifestPath?: string;
  installConfig?: string;
  commitSha: string;
  version: string;
  formatVer: string;
  minAppVer: string;
  maxAppVer?: string;
  changelog?: string;
  createdAt?: string;
}

interface ArtifactNodeInput { nodeKey: string; runtimePackageId?: string }
interface ArtifactAssetInput { kind: string; url: string; sha256: string; name?: string; assetName?: string }
interface ArtifactPublishInput {
  type: string;
  title: string;
  description: string;
  categoryId?: string;
  publisherId: string;
  authorId: string;
  version: string;
  formatVer: string;
  minAppVer: string;
  maxAppVer?: string;
  changelog?: string;
  projectKey: string;
  rootNodeId: string;
  nodes?: ArtifactNodeInput[];
  assets?: ArtifactAssetInput[];
  createdAt?: string;
}

export function publishRepoMutation(input: RepoPublishInput): MarketMutation {
  const time = input.createdAt || isoNow();
  const entryId = makeEntryId(input.type, { owner: input.repoOwner, repo: input.repoName, ...(input.subdir !== undefined ? { subdir: input.subdir } : {}) });
  const versionId = makeVersionId(entryId, input.version);
  const specId = `repo-spec-${slug(entryId)}`;

  const objects: MarketMutation['objects'] = [
    {
      kind: 'Entry',
      operation: 'create',
      id: entryId,
      value: {
        id: entryId,
        type: input.type,
        title: input.title,
        description: input.description,
        authorId: input.authorId,
        publisherId: input.publisherId,
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        stateCode: 'pending',
        createdAt: time,
        updatedAt: time,
      },
    },
    {
      kind: 'Version',
      operation: 'create',
      id: versionId,
      value: {
        id: versionId,
        entryId,
        version: input.version,
        formatVer: input.formatVer,
        minAppVer: input.minAppVer,
        ...(input.maxAppVer !== undefined ? { maxAppVer: input.maxAppVer } : {}),
        stateCode: 'pending',
        ...(input.changelog !== undefined ? { changelog: input.changelog } : {}),
        createdAt: time,
        updatedAt: time,
      },
    },
    {
      kind: 'RepoSource',
      operation: 'create',
      id: specId,
      value: { id: specId, entryId, sourceUrl: input.sourceUrl, createdAt: time, updatedAt: time },
    },
    {
      kind: 'RepoVersion',
      operation: 'create',
      id: `repo-version-${slug(versionId)}`,
      value: {
        id: `repo-version-${slug(versionId)}`,
        versionId,
        refType: input.refType,
        refName: input.refName,
        commitSha: input.commitSha,
        ...(input.subdir !== undefined ? { subdir: input.subdir } : {}),
        ...(input.manifestPath !== undefined ? { manifestPath: input.manifestPath } : {}),
        ...(input.installConfig !== undefined ? { installConfig: input.installConfig } : {}),
        createdAt: time,
        updatedAt: time,
      },
    },
  ];

  return {
    type: 'mutation',
    id: `mut-publish-${entryId}-${Date.now()}`,
    actor: { authorId: input.publisherId, role: 'publisher' },
    reason: 'entry.published',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
      { projection: 'private.publisherShard', scope: { authorId: input.publisherId } },
      { projection: 'private.publisherEntry', scope: { authorId: input.publisherId, entryId } },
    ],
  };
}

export function publishArtifactMutation(input: ArtifactPublishInput): MarketMutation {
  const time = input.createdAt || isoNow();
  const entryId = makeEntryId(input.type, { version: input.version, kind: 'artifact' });
  const versionId = makeVersionId(entryId, input.version);
  const projectId = makeProjectId(entryId, input.version);

  const objects: MarketMutation['objects'] = [
    {
      kind: 'Entry', operation: 'create', id: entryId,
      value: {
        id: entryId,
        type: input.type,
        title: input.title,
        description: input.description,
        authorId: input.authorId,
        publisherId: input.publisherId,
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        stateCode: 'pending',
        createdAt: time,
        updatedAt: time,
      },
    },
    {
      kind: 'Version', operation: 'create', id: versionId,
      value: {
        id: versionId,
        entryId,
        version: input.version,
        formatVer: input.formatVer,
        minAppVer: input.minAppVer,
        ...(input.maxAppVer !== undefined ? { maxAppVer: input.maxAppVer } : {}),
        stateCode: 'pending',
        ...(input.changelog !== undefined ? { changelog: input.changelog } : {}),
        createdAt: time,
        updatedAt: time,
      },
    },
    {
      kind: 'ArtifactProject', operation: 'create', id: projectId,
      value: { id: projectId, entryId, projectKey: input.projectKey, rootNodeId: input.rootNodeId, createdAt: time, updatedAt: time },
    },
  ];

  for (const node of input.nodes || []) {
    const id = makeArtifactNodeId(projectId, node.nodeKey);
    objects.push({
      kind: 'ArtifactNode', operation: 'create', id,
      value: { id, projectId, versionId, nodeKey: node.nodeKey, ...(node.runtimePackageId !== undefined ? { runtimePackageId: node.runtimePackageId } : {}), createdAt: time, updatedAt: time },
    });
  }

  for (const asset of input.assets || []) {
    const id = `asset-${slug(entryId)}-${slug(asset.name || asset.assetName || asset.url)}`;
    objects.push({
      kind: 'Asset', operation: 'create', id,
      value: { id, versionId, kind: asset.kind, url: asset.url, sha256: asset.sha256, createdAt: time },
    });
  }

  return {
    type: 'mutation',
    id: `mut-publish-${entryId}-${Date.now()}`,
    actor: { authorId: input.publisherId, role: 'publisher' },
    reason: 'entry.published',
    createdAt: time,
    objects,
    effects: [
      { projection: 'list.page', scope: { list: {}, sort: 'updated', page: 1 } },
      { projection: 'entry.shard', scope: { entryId } },
      { projection: 'entry.versions', scope: { entryId } },
      { projection: 'private.publisherShard', scope: { authorId: input.publisherId } },
      { projection: 'private.publisherEntry', scope: { authorId: input.publisherId, entryId } },
    ],
  };
}
