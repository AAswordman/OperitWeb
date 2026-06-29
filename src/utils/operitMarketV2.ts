export type MarketEntryType = 'script' | 'package' | 'skill' | 'mcp';
export type MarketSort = 'updated' | 'likes' | 'featured';

export const MARKET_V2_STATIC_BASE = 'https://static.operit.app/market/v2';
export const MARKET_V2_API_BASE = 'https://api.operit.app/market/v2';
export const MARKET_V2_PAGE_SIZE = 100;

export interface MarketV2Manifest {
  ok?: boolean;
  marketVersion?: number;
  generatedAt?: string;
  types?: Array<{ id: string; name: string; description?: string }>;
  categories?: Array<{ id: string; name: string; description?: string }>;
  states?: Array<{ code: string; publicListed?: boolean }>;
}

export interface MarketV2Asset {
  id: string;
  versionId?: string;
  kind?: string;
  url?: string;
  sha256?: string;
  assetName?: string;
}

export interface MarketV2Entry {
  type: MarketEntryType;
  id: string;
  title: string;
  description?: string;
  detail?: string;
  authorId?: string;
  publisherId?: string;
  author?: { id?: string; login?: string; avatar?: string };
  publisher?: { id?: string; login?: string; avatar?: string };
  categoryId?: string;
  stateCode?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  source?: {
    kind?: string;
    url?: string;
  };
  artifact?: {
    projectId?: string;
    runtimePkg?: string;
  };
  assets?: MarketV2Asset[];
  versions?: Array<{
    id?: string;
    version?: string;
    formatVer?: string;
    minAppVer?: string;
    maxAppVer?: string;
    changelog?: string;
    installConfig?: string;
    runtimePackageId?: string;
    publishedAt?: string;
  }>;
  latestVersion?: {
    id?: string;
    version?: string;
    formatVer?: string;
    minAppVer?: string;
    maxAppVer?: string;
    changelog?: string;
    installConfig?: string;
    runtimePackageId?: string;
    publishedAt?: string;
  };
  reactions?: Array<{ reaction: string; total: number }>;
}

export interface MarketV2ListPage {
  ok?: boolean;
  marketVersion?: number;
  generatedAt?: string;
  sort?: MarketSort;
  page?: number;
  pageSize?: number;
  total?: number;
  items?: MarketV2Entry[];
}

export interface MarketV2EntryShard {
  ok?: boolean;
  marketVersion?: number;
  generatedAt?: string;
  shard?: string;
  entriesById?: Record<string, MarketV2Entry>;
}

export interface MarketV2MyEntrySummary {
  id: string;
  title: string;
  stateCode: string;
  categoryId?: string;
  updatedAt?: string;
}

export interface MarketV2Notification {
  id: string;
  kind: string;
  entryId?: string;
  commentId?: string;
  actorId?: string;
  title?: string;
  body?: string;
  createdAt?: string;
}

export function marketV2StaticUrl(path: string): string {
  return `${MARKET_V2_STATIC_BASE}/${path.replace(/^\/+/, '')}`;
}

export function marketV2ApiUrl(path: string): string {
  return `${MARKET_V2_API_BASE}/${path.replace(/^\/+/, '')}`;
}

export function marketV2DownloadUrl(assetId: string): string {
  return marketV2ApiUrl(`assets/${encodeURIComponent(assetId)}/download`);
}

export function marketV2EntryShard(entryId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < entryId.length; index += 1) {
    hash ^= entryId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).substring(0, 2).padStart(2, '0');
}

export async function fetchMarketV2Json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error || '') : '';
    throw new Error(error || `HTTP ${response.status}`);
  }
  return data as T;
}

export function marketV2AuthHeaders(session: string): HeadersInit {
  return {
    Authorization: `Bearer ${session.trim()}`,
  };
}
