export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface D1PreparedStatementLike {
  bind(...params: SqlParam[]): D1PreparedStatementLike;
  run(): Promise<unknown> | unknown;
  first<T extends Row = Row>(): Promise<T | null> | T | null;
  all<T extends Row = Row>(): Promise<T[]> | T[] | { results?: T[] };
}

export type SqlParam = unknown;
export type Row = Record<string, string | number | boolean | null>;

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
}

export interface R2ObjectLike {
  text(): Promise<string>;
  body?: string;
  httpEtag?: string;
}

export interface R2BucketLike {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown> | unknown;
  get(key: string): Promise<R2ObjectLike | null>;
  delete?(key: string): Promise<unknown> | unknown;
  list?(options: { prefix: string }): Promise<{ objects: { key: string }[] }> | { objects: { key: string }[] };
}

export interface AnalyticsLike {
  events?: unknown[];
  writeDataPoint?(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export interface MarketEnv {
  db?: D1DatabaseLike;
  r2?: R2BucketLike;
  MARKET_STATS_BUCKET?: R2BucketLike;
  MARKET_ANALYTICS?: AnalyticsLike;
  MARKET_ANALYTICS_ACCOUNT_ID?: string;
  MARKET_ANALYTICS_API_TOKEN?: string;
  MARKET_ANALYTICS_DATASET?: string;
  CLOUDFLARE_API_TOKEN?: string;
  MARKET_SESSION_SECRET?: string;
  OPERIT_GITHUB_OAUTH_CLIENT_ID?: string;
  OPERIT_GITHUB_OAUTH_CLIENT_SECRET?: string;
  OPERIT_GITHUB_OAUTH_TRANSACTION_KEY?: string;
  GITHUB_TOKEN?: string;
  OPERIT_GITHUB_TOKEN?: string;
  GITHUB_APP_ID?: string;
  OPERIT_GITHUB_APP_ID?: string;
  GITHUB_APP_PEM?: string;
  GITHUB_PRIVATE_KEY?: string;
  OPERIT_GITHUB_PRIVATE_KEY?: string;
  GITHUB_INSTALLATION_ID?: string;
  OPERIT_GITHUB_INSTALLATION_ID?: string;
  // operit-api admin auth
  OPERIT_OWNER_TOKEN?: string;
  OPERIT_ADMIN_TOKEN?: string;
  OPERIT_ADMIN_AUTH_SALT?: string;
  OPERIT_IP_SALT?: string;
  OPERIT_SUBMISSION_DB?: D1DatabaseLike;
  store?: MarketStore;
  d1Backend?: D1Backend;
  r2Backend?: R2Backend;
  objectRegistry?: ObjectRegistry;
  projectionRegistry?: ProjectionRegistry;
  mockGitHubGetUser?: (token: string, env: MarketEnv) => Promise<GitHubUser>;
  mockGitHubGetRepo?: (owner: string, repo: string, env: MarketEnv) => Promise<GitHubRepoInfo>;
  mockGitHubResolveRef?: (owner: string, repo: string, refType: string, refName: string, env: MarketEnv) => Promise<string>;
  mockGitHubGetRelease?: (owner: string, repo: string, tag: string, env: MarketEnv) => Promise<GitHubReleaseInfo>;
}

export interface GitHubUser { id: number; login: string; avatar_url?: string }
export interface GitHubRepoInfo { ownerId: number; ownerLogin: string; ownerAvatar?: string; isPublic: boolean }
export interface GitHubReleaseAssetInfo { name: string; browserDownloadUrl: string; sha256?: string }
export interface GitHubReleaseInfo { authorId: number; assets: GitHubReleaseAssetInfo[] }

export interface UsageStats {
  d1Reads: number;
  d1Writes: number;
  r2Reads: number;
  r2Writes: number;
  r2Lists: number;
  r2Deletes: number;
  analyticsWrites: number;
}

export interface R2WriteStat {
  key: string;
  chars: number;
  stringifyMs: number;
  putMs: number;
  totalMs: number;
}

export interface R2OperationStats {
  reads: number;
  writes: number;
  lists: number;
  deletes: number;
  jsonCharsWritten: number;
  stringifyMs: number;
  putMs: number;
  recentWrites: R2WriteStat[];
}

export type ActorRole = 'publisher' | 'admin' | 'system';
export interface MarketActor { authorId: string; role: ActorRole | string }

export type MarketObjectKind =
  | 'Author' | 'Entry' | 'Version' | 'RepoSource' | 'RepoVersion'
  | 'ArtifactProject' | 'Asset' | 'Comment'
  | 'ReactionStat' | 'Curation' | 'ReviewReason';

export type MarketObjectOperation = 'create' | 'update' | 'hide' | 'withdraw' | 'approve' | 'reject' | 'request_changes' | 'aggregate';

export interface MarketObjectChange<TValue extends object = Record<string, unknown>, TPatch extends object = Record<string, unknown>> {
  kind: MarketObjectKind;
  operation: MarketObjectOperation;
  id: string;
  value?: TValue;
  patch?: TPatch;
}

export type ProjectionName =
  | 'manifest'
  | 'list.page'
  | 'entry.shard'
  | 'entry.versions'
  | 'comments.page'
  | 'asset.detail'
  | 'private.publisherShard';

export interface ProjectionScope {
  entryId?: string;
  page?: number;
  pageSize?: number;
  shard?: string;
  sort?: string;
  assetId?: string;
  authorId?: string;
  list?: { type?: string | null; categoryId?: string | null; featured?: string | null };
}

export interface ProjectionPlan {
  projection: ProjectionName;
  scope: ProjectionScope;
  pageSize?: number;
}

export interface MarketMutation {
  type: 'mutation';
  id: string;
  actor: MarketActor;
  reason: string;
  createdAt?: string;
  objects: MarketObjectChange[];
  effects: ProjectionPlan[];
}

export interface NormalizedMarketMutation extends MarketMutation { createdAt: string }

export interface D1Backend {
  getMeta(key: string): Promise<{ value: string; updated_at: string } | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  stats: { reads: number; writes: number };
  createComment(value: Record<string, unknown>): Promise<unknown>;
  updateComment(id: string, patch: Record<string, unknown>): Promise<unknown>;
  createEntry(value: Record<string, unknown>): Promise<unknown>;
  updateEntry(id: string, patch: Record<string, unknown>): Promise<unknown>;
  createVersion(value: Record<string, unknown>): Promise<unknown>;
  updateVersion(id: string, patch: Record<string, unknown>): Promise<unknown>;
  createRepoSource(value: Record<string, unknown>): Promise<unknown>;
  createRepoVersion(value: Record<string, unknown>): Promise<unknown>;
  updateRepoSource(id: string, patch: Record<string, unknown>): Promise<unknown>;
  getRepoVersion(versionId: string): Promise<Row | null>;
  createReviewReason(value: Record<string, unknown>): Promise<unknown>;
  createCuration(value: Record<string, unknown>): Promise<unknown>;
  hideCuration(id: string, patch: Record<string, unknown>): Promise<unknown>;
  aggregateReaction(value: Record<string, unknown>): Promise<unknown>;
  upsertEntryStats(value: Record<string, unknown>): Promise<unknown>;
  incrementEntryStats(value: Record<string, unknown>): Promise<unknown>;
  recordAnalyticsAggregateWindow(value: Record<string, unknown>): Promise<unknown>;
  createAsset(value: Record<string, unknown>): Promise<unknown>;
  createArtifactProject(value: Record<string, unknown>): Promise<unknown>;
  getEntry(entryId: string): Promise<Row | null>;
  getAuthor(authorId: string): Promise<Row | null>;
  getComment(commentId: string): Promise<Row | null>;
  getRepoSpecByEntry(entryId: string): Promise<Row | null>;
  getCategories(): Promise<Row[]>;
  getTypes(): Promise<Row[]>;
  getFormatVersions(): Promise<Row[]>;
  getStateCodes(): Promise<Row[]>;
  listVersionReasons(versionId: string): Promise<Row[]>;
  listAuthorEntryVersions(authorId: string, entryId: string): Promise<Row[]>;
  listPublisherEntries(publisherId: string): Promise<Row[]>;
  listVersionPublisherEntries(publisherId: string): Promise<Row[]>;
  listShardPublisherEntries(shard: string): Promise<Row[]>;
  listReviewVersions(stateCode: string | undefined, limit: number, offset: number): Promise<Row[]>;
  listAllEntries(): Promise<Row[]>;
  listVersionsForEntry(entryId: string): Promise<Row[]>;
  listVersionsForArtifactProjectKey(projectKey: string): Promise<Row[]>;
  getArtifactProject(entryId: string): Promise<Row | null>;
  listAssets(entryId: string): Promise<Row[]>;
  getAssetWithEntry(assetId: string): Promise<Row | null>;
  getReactionCounts(entryId: string): Promise<Row[]>;
  getEntryStats(entryId: string): Promise<Row | null>;
  listCurations(listKey: string): Promise<Row[]>;
  listActiveComments(entryId: string, page: number, pageSize: number): Promise<Row[]>;
  countActiveComments(entryId: string): Promise<number>;
  countActiveCommentsBefore(entryId: string, createdAt: string, commentId: string): Promise<number>;
  writeMutationLog(value: Record<string, unknown>): Promise<unknown>;
  upsertDirty(projection: string, scopeKey: string, reason: string, mutationId: string, updatedAt: string): Promise<unknown>;
  deleteDirty(projection: string, scopeKey: string): Promise<unknown>;
  listDirty(limit: number): Promise<Row[]>;
  // notifications
  createNotification(value: Record<string, unknown>): Promise<unknown>;
  listNotifications(recipient: string, limit: number, offset: number, since?: string): Promise<Row[]>;
  // bulk load for full R2 rebuild (single-shot, ~8 D1 queries)
  loadBuildSnapshot(): Promise<BuildSnapshot>;
}

export interface BuildSnapshot {
  entries: Row[];
  versions: Row[];
  repos: Row[];
  repoVersions: Row[];
  artifactProjects: Row[];
  assets: Row[];
  reactions: Row[];
  entryStats: Row[];
  categories: Row[];
  types: Row[];
  formatVersions: Row[];
  stateCodes: Row[];
  versionReasons: Row[];
  curations: Row[];
  authors: Row[];
}

export interface V2AnalyticsAggregateRow {
  event: string;
  type: string;
  entryId: string;
  total: number;
  sampleInterval: number;
  lastAt: string;
}

export interface V2AnalyticsAggregateInput {
  windowStart: string;
  windowEnd: string;
  source: string;
  rows: V2AnalyticsAggregateRow[];
}

export interface R2Backend {
  stats: R2OperationStats;
  writeJson(key: string, value: unknown): Promise<string>;
  readJson(key: string): Promise<JsonValue | null>;
  delete(key: string): Promise<string>;
  list(prefix: string): Promise<{ objects: { key: string }[] }>;
}

export interface ObjectRegistry {
  assertAllowed(kind: string, operation: string, value: object, patch: object): void;
  apply(change: MarketObjectChange, backend: D1Backend): Promise<unknown>;
}

export interface RendererContext {
  d1: D1Backend;
  r2: R2Backend;
  projectionPlan: ProjectionPlan;
  projectionRegistry: ProjectionRegistry;
}

export interface ProjectionRegistry {
  assertAllowed(projection: string | undefined, scope: ProjectionScope | undefined): void;
  keyOf(projection: ProjectionName, scope: ProjectionScope): string;
  dirtyKey(projection: ProjectionName, scope: ProjectionScope): string;
  scopeKeyOf(scope: ProjectionScope): string;
  normalizeScope(projection: ProjectionName, scope: ProjectionScope): ProjectionScope;
  render(ctx: { d1: D1Backend; r2: R2Backend }, projectionPlan: ProjectionPlan): Promise<{ written: string[] }>;
}

export interface MarketStore {
  d1: D1Backend;
  r2: R2Backend;
  objectRegistry: ObjectRegistry;
  projectionRegistry: ProjectionRegistry;
  apply(input: MarketMutation): Promise<{ ok: true; mutationId: string; reason: string; objects: number; events: string[]; dirty: { projection: ProjectionName; scope: ProjectionScope; key: string }[]; stats: UsageStats; materialization: { mode: 'async'; estimatedDelaySeconds: number } }>;
  materialize(projectionPlan: ProjectionPlan): Promise<{ ok: true; projection: ProjectionName; scope: ProjectionScope; written: string[]; clearedDirty: string[]; stats: UsageStats }>;
  materializeEntryAssets(entryId: string): Promise<{ ok: true; materialized: number }>;
  materializeEntryAssetsByEntryVersionDirty(entryId: string): Promise<{ ok: true; materialized: number }>;
  readProjection(projectionPlan: ProjectionPlan): Promise<JsonValue | null>;
  getMeta(key: string): Promise<{ value: string; updated_at: string } | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  listDirty(limit?: number): Promise<Row[]>;
  deleteDirty(projection: ProjectionName, scopeKey: string): Promise<void>;
  loadBuildSnapshot(): Promise<BuildSnapshot>;
  aggregateV2Analytics(input: V2AnalyticsAggregateInput): Promise<JsonObject>;
  scanDirty(limit?: number): Promise<{ key: string }[]>;
  repair(): Promise<{ ok: true; repaired: number; stats: UsageStats }>;
  usage(): UsageStats;
}
