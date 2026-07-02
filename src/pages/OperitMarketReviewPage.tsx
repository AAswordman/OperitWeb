import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Input,
  Layout,
  Modal,
  Select,
  Spin,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { Avatar } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  LogoutOutlined,
  ReloadOutlined,
  StarFilled,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './OperitMarketReviewPage.css';
import OperitMarkdownPreview from '../components/OperitMarkdownPreview';

import {
  MARKET_TYPE_ORDER,
  REVIEW_STATE_COLORS,
  getMarketTypeLabel,
  getReasonDescription,
  getReasonLabel,
  getReviewActionLabel,
  getReviewStateLabel,
  type MarketType,
  type ReviewReasonOption,
  type ReviewState,
} from '../utils/operitMarketReview';
import {
  fetchMarketV2Json,
  marketV2ApiUrl,
  marketV2StaticUrl,
  type MarketEntryType,
  type MarketV2Entry,
  type MarketV2ListPage,
  type MarketV2Manifest,
} from '../utils/operitMarketV2';
import './OperitMarketReviewPage.css';

const { Content } = Layout;
const { Title, Paragraph, Text, Link } = Typography;

interface OperitMarketReviewPageProps {
  language: 'zh' | 'en';
}

interface AdminAuthUser {
  username: string;
  display_name?: string | null;
  contact_email?: string | null;
  contact_qq?: string | null;
  contact_telegram?: string | null;
  role?: string | null;
  owner?: boolean;
}

interface ReviewEntrySummary {
  id: string;
  type: MarketEntryType;
  title: string;
  description: string;
  authorId: string;
  publisherId: string;
  author?: { id?: string; login?: string; avatar?: string };
  publisher?: { id?: string; login?: string; avatar?: string };
  categoryId: string;
  stateCode: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  version?: ReviewVersion;
}

interface ReviewVersion {
  id: string;
  entryId?: string;
  version: string;
  formatVer: string;
  publisherId?: string;
  publisher?: { id?: string; login?: string; avatar?: string };
  minAppVer?: string;
  maxAppVer?: string;
  runtimePackageId?: string;
  stateCode: string;
  changelog?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

interface ReviewEntryDetail {
  ok?: boolean;
  item: ReviewEntrySummary & { detail: string };
  versions: ReviewVersion[];
  repoSource?: Record<string, unknown>;
  artifactProject?: Record<string, unknown>;
  assets?: Record<string, unknown>[];
}

interface MarketReviewRow {
  id: string;
  type: MarketType;
  title: string;
  description: string;
  detail?: string;
  authorId: string;
  publisherId: string;
  authorLogin: string;
  authorAvatar: string;
  publisherLogin: string;
  publisherAvatar: string;
  categoryId: string;
  stateCode: ReviewState | string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  version?: ReviewVersion;
  versionId?: string;
  versionLabel?: string;
  versionStateCode?: ReviewState | string;
  versionPublisherId?: string;
  versionPublisherLogin?: string;
  versionPublisherAvatar?: string;
  featured: boolean;
  source: 'review' | 'published';
}

interface VersionActionConfig {
  target: MarketReviewRow;
  approve: string;
  changes: string;
  reject: string;
  openActionModal: (action: MarketReviewAction, row: MarketReviewRow, versionId?: string) => void;
}

type ReviewFilter = ReviewState | 'all';
type FeaturedFilter = 'all' | 'featured' | 'normal';
type SourceFilter = 'all' | 'review' | 'published';
type MarketReviewAction = 'approve' | 'changes_requested' | 'reject' | 'set_featured' | 'unset_featured';

const STORAGE = {
  adminToken: 'operit_submission_admin_token',
};

const ADMIN_API_BASE = 'https://api.aaswordsman.org';

const FALLBACK_REASONS: ReviewReasonOption[] = [
  { code: 'metadata-incomplete', label: 'metadata-incomplete', zh: '元数据不完整', en: 'Metadata incomplete', description_zh: '标题、简介、详情、分类、版本或来源信息缺失。', description_en: 'Title, description, detail, category, version, or source metadata is incomplete.' },
  { code: 'install-config-invalid', label: 'install-config-invalid', zh: '安装配置无效', en: 'Invalid install config', description_zh: '安装配置无法被客户端识别或执行。', description_en: 'Install config cannot be recognized or executed by the client.' },
  { code: 'repository-unreachable', label: 'repository-unreachable', zh: '仓库不可访问', en: 'Repository unreachable', description_zh: 'GitHub 仓库、引用或目录不可访问。', description_en: 'GitHub repository, ref, or subdirectory is unreachable.' },
  { code: 'repository-content-invalid', label: 'repository-content-invalid', zh: '仓库内容无效', en: 'Invalid repository content', description_zh: '仓库内容与提交类型不匹配。', description_en: 'Repository content does not match the submitted type.' },
  { code: 'entry-unusable', label: 'entry-unusable', zh: '插件不可用', en: 'Entry unusable', description_zh: '插件无法安装、加载或完成基本运行。', description_en: 'Entry cannot be installed, loaded, or run normally.' },
  { code: 'quality-too-low', label: 'quality-too-low', zh: '质量过低', en: 'Quality too low', description_zh: '内容质量不足以上架。', description_en: 'Quality is too low for listing.' },
  { code: 'security-risk', label: 'security-risk', zh: '安全风险', en: 'Security risk', description_zh: '存在明显安全风险或危险行为。', description_en: 'Contains obvious security risks or dangerous behavior.' },
  { code: 'duplicate-submission', label: 'duplicate-submission', zh: '重复投稿', en: 'Duplicate submission', description_zh: '与已有条目重复。', description_en: 'Duplicates an existing entry.' },
  { code: 'policy-violation', label: 'policy-violation', zh: '违反规则', en: 'Policy violation', description_zh: '违反市场发布规则。', description_en: 'Violates market publishing rules.' },
];

const TEXT = {
  zh: {
    title: 'Operit 市场审核台',
    subtitle: '统一审核 MCP / Skill / Script / Package 四类插件投稿，管理已上架插件与精选。',
    currentUser: '当前账号',
    currentRole: '角色',
    logout: '退出登录',
    reload: '刷新',
    filters: '筛选条件',
    market: '市场类型',
    reviewState: '审核状态',
    category: '分类',
    featured: '精选',
    source: '数据范围',
    search: '搜索',
    searchPlaceholder: '搜索标题、ID、作者、发布者、分类、简介',
    reviewListTitle: '市场条目',
    detail: '查看详情',
    detailTitle: '插件详情',
    metaInfo: '基础信息',
    reviewInfo: '审核信息',
    contentInfo: '内容信息',
    versions: '版本',
    sourceInfo: '来源信息',
    artifactInfo: 'Artifact 信息',
    assets: '资产',
    description: '简介',
    detailField: '详情',
    unknown: '未知',
    all: '全部',
    onlyFeatured: '只看精选',
    notFeatured: '非精选',
    reviewQueue: '审核队列',
    publishedList: '已上架列表',
    loading: '加载中...',
    empty: '暂无条目',
    updatedAtLabel: '更新时间',
    loadFailed: '加载失败',
    loginExpired: '管理员登录已失效，请重新登录。',
    approve: '审核通过',
    changes: '打回修改',
    reject: '拒绝',
    setFeatured: '设为精选',
    unsetFeatured: '取消精选',
    actionTarget: '操作对象',
    actionReasonTitle: '请选择原因码',
    actionSubmit: '确认提交',
    actionCancel: '取消',
    actionSuccess: '操作已提交。',
    reasonRequired: '打回或拒绝必须选择原因码。',
    versionRequired: '请在版本列表中选择具体版本进行审核。',
    noReason: '无原因码',
    publishedHint: '已上架列表来自 R2 静态产物；审核操作仍走管理员 API。',
  },
  en: {
    title: 'Operit Market Review',
    subtitle: 'Review MCP / Skill / Script / Package submissions and manage published entries and featured curation.',
    currentUser: 'User',
    currentRole: 'Role',
    logout: 'Sign out',
    reload: 'Reload',
    filters: 'Filters',
    market: 'Type',
    reviewState: 'Review State',
    category: 'Category',
    featured: 'Featured',
    source: 'Source',
    search: 'Search',
    searchPlaceholder: 'Search title, ID, author, publisher, category, description',
    reviewListTitle: 'Market Entries',
    detail: 'Detail',
    detailTitle: 'Entry Detail',
    metaInfo: 'Basic Info',
    reviewInfo: 'Review Info',
    contentInfo: 'Content',
    versions: 'Versions',
    sourceInfo: 'Source',
    artifactInfo: 'Artifact',
    assets: 'Assets',
    description: 'Description',
    detailField: 'Detail',
    unknown: 'Unknown',
    all: 'All',
    onlyFeatured: 'Featured only',
    notFeatured: 'Not featured',
    reviewQueue: 'Review queue',
    publishedList: 'Published list',
    loading: 'Loading...',
    empty: 'No entries',
    updatedAtLabel: 'Updated',
    loadFailed: 'Load failed',
    loginExpired: 'Admin session expired. Please sign in again.',
    approve: 'Approve',
    changes: 'Request changes',
    reject: 'Reject',
    setFeatured: 'Set featured',
    unsetFeatured: 'Unset featured',
    actionTarget: 'Target',
    actionReasonTitle: 'Select reason code',
    actionSubmit: 'Submit',
    actionCancel: 'Cancel',
    actionSuccess: 'Action submitted.',
    reasonRequired: 'A reason code is required for changes or rejection.',
    versionRequired: 'Select a specific version in the version list before reviewing.',
    noReason: 'No reason',
    publishedHint: 'Published list is loaded from R2 static output; review actions still use admin API.',
  },
};

function buildAdminHeaders(token: string): HeadersInit {
  const trimmed = token.trim();
  return {
    Authorization: `Bearer ${trimmed}`,
    'X-Operit-Admin-Token': trimmed,
    'x-operit-admin-token': trimmed,
    'Content-Type': 'application/json',
  };
}

function buildMarketV2AdminHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    'Content-Type': 'application/json',
  };
}

async function fetchJson(url: string, options?: RequestInit): Promise<{ response: Response; data: unknown; text: string }> {
  const response = await fetch(url, options);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { response, data, text };
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function asReviewState(value: string): ReviewState | string {
  return value || 'pending';
}

function normalizeEntry(entry: ReviewEntrySummary | MarketV2Entry, source: 'review' | 'published', featuredIds: Set<string>): MarketReviewRow {
  const author = 'author' in entry ? entry.author : undefined;
  const publisher = 'publisher' in entry ? entry.publisher : undefined;
  const version = 'version' in entry ? entry.version : undefined;
  const versionPublisher = version?.publisher;
  const stateCode = source === 'review'
    ? asReviewState(String(version?.stateCode || entry.stateCode || 'pending'))
    : asReviewState(String(entry.stateCode || 'approved'));
  const updatedAt = source === 'review'
    ? String(version?.updatedAt || entry.updatedAt)
    : String(entry.updatedAt);
  return {
    id: String(entry.id),
    type: String(entry.type) as MarketType,
    title: String(entry.title),
    description: String(entry.description),
    detail: 'detail' in entry ? String(entry.detail) : '',
    authorId: String(entry.authorId),
    publisherId: String(entry.publisherId),
    authorLogin: author?.login || '',
    authorAvatar: author?.avatar || '',
    publisherLogin: publisher?.login || '',
    publisherAvatar: publisher?.avatar || '',
    categoryId: String(entry.categoryId),
    stateCode,
    createdAt: String(entry.createdAt),
    updatedAt,
    publishedAt: 'publishedAt' in entry ? String(entry.publishedAt) : '',
    version,
    versionId: version?.id,
    versionLabel: version?.version,
    versionStateCode: version?.stateCode,
    versionPublisherId: version?.publisherId,
    versionPublisherLogin: versionPublisher?.login || '',
    versionPublisherAvatar: versionPublisher?.avatar || '',
    featured: featuredIds.has(String(entry.id)),
    source,
  };
}

function stateColor(state: string): string {
  return REVIEW_STATE_COLORS[state as ReviewState] || (state === 'withdrawn' ? 'default' : 'blue');
}

function shortText(value: string, fallback: string): string {
  const text = value.trim();
  return text || fallback;
}

function versionSortValue(version: ReviewVersion): string {
  return version.publishedAt || version.updatedAt || version.createdAt || version.version;
}

function renderVersionList(versions: ReviewVersion[], language: 'zh' | 'en', actions?: VersionActionConfig): React.ReactNode {
  const rows = [...versions].sort((a, b) => versionSortValue(b).localeCompare(versionSortValue(a)));
  return (
    <div className="operit-market-review-version-graph">
      {rows.map(version => (
        <div key={version.id} className="operit-market-review-version-row">
          <div className="operit-market-review-version-lanes" style={{ width: 28 }}>
            <span className="operit-market-review-version-dot" />
          </div>
          <div className="operit-market-review-version-content">
            <Space wrap size={[8, 4]}>
              <Text strong>{version.version}</Text>
              <Text type="secondary">{version.formatVer}</Text>
              <Text type="secondary">min {version.minAppVer}</Text>
              {version.maxAppVer ? <Text type="secondary">max {version.maxAppVer}</Text> : null}
              {version.runtimePackageId ? <Text type="secondary">runtime {version.runtimePackageId}</Text> : null}
              <Tag color={stateColor(version.stateCode)}>{getReviewStateLabel(version.stateCode, language)}</Tag>
              <Text type="secondary">{formatDateTime(version.publishedAt)}</Text>
              {actions && version.stateCode !== 'approved' ? (
                <>
                  <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => actions.openActionModal('approve', actions.target, version.id)}>{actions.approve}</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => actions.openActionModal('changes_requested', actions.target, version.id)}>{actions.changes}</Button>
                  <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => actions.openActionModal('reject', actions.target, version.id)}>{actions.reject}</Button>
                </>
              ) : null}
            </Space>
            {version.changelog ? <Paragraph type="secondary" className="operit-market-review-version-changelog">{version.changelog}</Paragraph> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function renderRepoSource(source: Record<string, unknown>): React.ReactNode {
  const sourceUrl = displayValue(source.source_url || source.sourceUrl || source.url);
  return (
    <Descriptions column={1} size="small" bordered>
      {sourceUrl ? (
        <Descriptions.Item label="Repository">
          <Link href={sourceUrl} target="_blank">{sourceUrl}</Link>
        </Descriptions.Item>
      ) : null}
      {displayValue(source.repo_owner || source.repoOwner) ? <Descriptions.Item label="Owner">{displayValue(source.repo_owner || source.repoOwner)}</Descriptions.Item> : null}
      {displayValue(source.repo_name || source.repoName) ? <Descriptions.Item label="Repo">{displayValue(source.repo_name || source.repoName)}</Descriptions.Item> : null}
    </Descriptions>
  );
}

function renderArtifactInfo(project?: Record<string, unknown>): React.ReactNode {
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {project ? (
        <Descriptions column={1} size="small" bordered>
          {displayValue(project.project_key || project.projectId) ? <Descriptions.Item label="Project">{displayValue(project.project_key || project.projectId)}</Descriptions.Item> : null}
          {displayValue(project.runtime_pkg || project.runtimePkg) ? <Descriptions.Item label="Runtime">{displayValue(project.runtime_pkg || project.runtimePkg)}</Descriptions.Item> : null}
        </Descriptions>
      ) : null}
    </Space>
  );
}

function renderAssets(assets: Record<string, unknown>[]): React.ReactNode {
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      {assets.map((asset, index) => {
        const url = displayValue(asset.url);
        const name = displayValue(asset.asset_name || asset.assetName || asset.name || asset.id) || `Asset ${index + 1}`;
        return (
          <Descriptions key={`${name}-${index}`} column={1} size="small" bordered>
            <Descriptions.Item label="Name">{name}</Descriptions.Item>
            {displayValue(asset.kind) ? <Descriptions.Item label="Kind">{displayValue(asset.kind)}</Descriptions.Item> : null}
            {url ? <Descriptions.Item label="URL"><Link href={url} target="_blank">{url}</Link></Descriptions.Item> : null}
            {displayValue(asset.sha256) ? <Descriptions.Item label="SHA-256"><Text copyable>{displayValue(asset.sha256)}</Text></Descriptions.Item> : null}
          </Descriptions>
        );
      })}
    </Space>
  );
}

const OperitMarketReviewPage: React.FC<OperitMarketReviewPageProps> = ({ language }) => {
  const t = TEXT[language];
  const navigate = useNavigate();
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(STORAGE.adminToken) || '');
  const [authUser, setAuthUser] = useState<AdminAuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<MarketV2Manifest | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewEntrySummary[]>([]);
  const [publishedRows, setPublishedRows] = useState<MarketV2Entry[]>([]);
  const [featuredRows, setFeaturedRows] = useState<MarketV2Entry[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(() => new Set());
  const [marketFilter, setMarketFilter] = useState<MarketType | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ReviewEntryDetail | null>(null);
  const [detailFallback, setDetailFallback] = useState<MarketReviewRow | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<MarketReviewAction>('approve');
  const [actionTarget, setActionTarget] = useState<MarketReviewRow | null>(null);
  const [actionVersionId, setActionVersionId] = useState<string | null>(null);
  const [selectedReasonCodes, setSelectedReasonCodes] = useState<string[]>([]);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(STORAGE.adminToken);
    setAdminToken('');
    setAuthUser(null);
    message.warning(t.loginExpired);
    navigate('/operit-login?next=/operit-market-review', { replace: true });
  }, [navigate, t.loginExpired]);

  const loadAdminProfile = useCallback(async (token: string): Promise<boolean> => {
    if (!token.trim()) return false;
    try {
      const { response, data } = await fetchJson(`${ADMIN_API_BASE}/api/admin/auth/me`, {
        headers: buildAdminHeaders(token),
      });
      if (!response.ok) return false;
      const user = (data as { user?: AdminAuthUser })?.user || null;
      setAuthUser(user);
      return Boolean(user);
    } catch {
      return false;
    }
  }, []);

  const loadData = useCallback(async (token: string) => {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [manifestData, reviewData, updatedData, featuredData] = await Promise.all([
        fetchMarketV2Json<MarketV2Manifest>(marketV2StaticUrl('manifest.json')),
        fetchMarketV2Json<{ ok?: boolean; items?: ReviewEntrySummary[] }>(marketV2ApiUrl('admin/review/entries?limit=100&offset=0'), {
          headers: buildMarketV2AdminHeaders(token),
        }),
        fetchMarketV2Json<MarketV2ListPage>(marketV2StaticUrl('lists/all/updated/page-1.json')),
        fetchMarketV2Json<MarketV2ListPage>(marketV2StaticUrl('lists/all/featured/page-1.json')),
      ]);
      const featuredItems = featuredData.items || [];
      setManifest(manifestData);
      setReviewRows(reviewData.items || []);
      setPublishedRows(updatedData.items || []);
      setFeaturedRows(featuredItems);
      setFeaturedIds(new Set(featuredItems.map(item => item.id)));
    } catch (err) {
      const messageText = (err as Error).message || t.loadFailed;
      setError(messageText);
      if (/401|403|unauthorized|forbidden/i.test(messageText)) handleUnauthorized();
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, t.loadFailed]);

  useEffect(() => {
    if (!adminToken.trim()) {
      navigate('/operit-login?next=/operit-market-review', { replace: true });
      return;
    }
    let active = true;
    setAuthChecking(true);
    loadAdminProfile(adminToken).then(ok => {
      if (!active) return;
      setAuthChecking(false);
      if (!ok) {
        handleUnauthorized();
        return;
      }
      void loadData(adminToken);
    });
    return () => {
      active = false;
    };
  }, [adminToken, handleUnauthorized, loadAdminProfile, loadData, navigate]);

  const categoryOptions = useMemo(() => {
    const categories = manifest?.categories || [];
    const known = new Map(categories.map(category => [category.id, category.name || category.id]));
    for (const row of reviewRows) if (row.categoryId && !known.has(row.categoryId)) known.set(row.categoryId, row.categoryId);
    for (const row of publishedRows) if (row.categoryId && !known.has(row.categoryId)) known.set(row.categoryId, row.categoryId);
    for (const row of featuredRows) if (row.categoryId && !known.has(row.categoryId)) known.set(row.categoryId, row.categoryId);
    return [{ label: t.all, value: 'all' }, ...Array.from(known.entries()).map(([id, name]) => ({ label: `${name} (${id})`, value: id }))];
  }, [featuredRows, manifest?.categories, publishedRows, reviewRows, t.all]);

  const categoryLabel = useCallback((categoryId: string): string => {
    if (!categoryId) return '-';
    const category = manifest?.categories?.find(item => item.id === categoryId);
    return category ? `${category.name || category.id} (${category.id})` : categoryId;
  }, [manifest?.categories]);

  const rows = useMemo(() => {
    const byId = new Map<string, MarketReviewRow>();
    for (const row of publishedRows) byId.set(row.id, normalizeEntry(row, 'published', featuredIds));
    for (const row of featuredRows) byId.set(row.id, { ...normalizeEntry(row, 'published', featuredIds), featured: true });
    for (const row of reviewRows) {
      const normalized = normalizeEntry(row, 'review', featuredIds);
      byId.set(`${normalized.id}::${normalized.versionId || ''}`, normalized);
    }
    return Array.from(byId.values()).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [featuredIds, featuredRows, publishedRows, reviewRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      if (marketFilter !== 'all' && row.type !== marketFilter) return false;
      if (reviewFilter !== 'all' && row.stateCode !== reviewFilter) return false;
      if (categoryFilter !== 'all' && row.categoryId !== categoryFilter) return false;
      if (featuredFilter === 'featured' && !row.featured) return false;
      if (featuredFilter === 'normal' && row.featured) return false;
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (!query) return true;
      return [row.id, row.versionId, row.versionLabel, row.title, row.description, row.authorLogin, row.publisherLogin, row.versionPublisherLogin, row.categoryId, row.stateCode, row.type]
        .some(value => String(value).toLowerCase().includes(query));
    });
  }, [categoryFilter, featuredFilter, marketFilter, reviewFilter, rows, search, sourceFilter]);

  const loadDetail = useCallback(async (row: MarketReviewRow) => {
    setDetailOpen(true);
    setDetailFallback(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await fetchMarketV2Json<ReviewEntryDetail>(marketV2ApiUrl(`admin/review/entries/${encodeURIComponent(row.id)}`), {
        headers: buildMarketV2AdminHeaders(adminToken),
      });
      setDetail(data);
    } catch (err) {
      if (row.source === 'published') {
        setDetail({
          item: {
            id: row.id,
            type: row.type as MarketEntryType,
            title: row.title,
            description: row.description,
            authorId: row.authorId,
            publisherId: row.publisherId,
            author: { id: row.authorId, login: row.authorLogin, avatar: row.authorAvatar },
            publisher: { id: row.publisherId, login: row.publisherLogin, avatar: row.publisherAvatar },
            categoryId: row.categoryId,
            stateCode: String(row.stateCode || 'approved'),
            createdAt: row.createdAt || '',
            updatedAt: row.updatedAt || '',
            publishedAt: row.publishedAt || '',
            detail: row.detail || '',
          },
          versions: [],
        });
        return;
      }
      const messageText = (err as Error).message || t.loadFailed;
      message.error(messageText);
      if (/401|403|unauthorized|forbidden/i.test(messageText)) handleUnauthorized();
    } finally {
      setDetailLoading(false);
    }
  }, [adminToken, handleUnauthorized, t.loadFailed]);

  const openActionModal = useCallback((action: MarketReviewAction, row: MarketReviewRow, versionId?: string) => {
    setActionType(action);
    setActionTarget(row);
    setActionVersionId(versionId || row.versionId || null);
    setSelectedReasonCodes([]);
    setActionOpen(true);
  }, []);

  const submitAction = useCallback(async () => {
    if (!actionTarget) return;
    if (actionType !== 'set_featured' && actionType !== 'unset_featured' && !actionVersionId) {
      message.warning(t.versionRequired);
      return;
    }
    if ((actionType === 'changes_requested' || actionType === 'reject') && selectedReasonCodes.length === 0) {
      message.warning(t.reasonRequired);
      return;
    }
    setActionSubmitting(true);
    try {
      if (actionType === 'set_featured' || actionType === 'unset_featured') {
        await fetchMarketV2Json(marketV2ApiUrl(`entries/${encodeURIComponent(actionTarget.id)}/curation`), {
          method: 'POST',
          headers: buildMarketV2AdminHeaders(adminToken),
          body: JSON.stringify({
            entryId: actionTarget.id,
            listKey: 'featured',
            position: 1,
            ...(actionType === 'unset_featured' ? { operation: 'hide' } : {}),
          }),
        });
      } else {
        const endpoint = actionType === 'approve' ? 'approve' : actionType === 'reject' ? 'reject' : 'changes';
        await fetchMarketV2Json(marketV2ApiUrl(`entries/${encodeURIComponent(actionTarget.id)}/review/${endpoint}`), {
          method: 'POST',
          headers: buildMarketV2AdminHeaders(adminToken),
          body: JSON.stringify({
            entryId: actionTarget.id,
            ...(actionVersionId ? { versionId: actionVersionId } : {}),
            reasonCode: selectedReasonCodes[0],
          }),
        });
      }
      message.success(t.actionSuccess);
      setActionOpen(false);
      setDetailOpen(false);
      await loadData(adminToken);
    } catch (err) {
      const messageText = (err as Error).message || t.loadFailed;
      message.error(messageText);
      if (/401|403|unauthorized|forbidden/i.test(messageText)) handleUnauthorized();
    } finally {
      setActionSubmitting(false);
    }
  }, [actionTarget, actionType, actionVersionId, adminToken, handleUnauthorized, loadData, selectedReasonCodes, t.actionSuccess, t.loadFailed, t.reasonRequired]);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE.adminToken);
    setAdminToken('');
    setAuthUser(null);
    navigate('/operit-login?next=/operit-market-review', { replace: true });
  }, [navigate]);

  const renderRowActions = useCallback((record: MarketReviewRow) => (
    <Space wrap className="operit-market-review-row-actions">
      <Button size="small" icon={<EyeOutlined />} onClick={() => void loadDetail(record)}>{t.detail}</Button>
      {record.source === 'review' && record.versionId ? (
        <>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openActionModal('approve', record, record.versionId)}>{t.approve}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openActionModal('changes_requested', record, record.versionId)}>{t.changes}</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openActionModal('reject', record, record.versionId)}>{t.reject}</Button>
        </>
      ) : null}
      {record.stateCode === 'approved' ? (
        <Button
          size="small"
          icon={<StarFilled />}
          onClick={() => openActionModal(record.featured ? 'unset_featured' : 'set_featured', record)}
        >
          {record.featured ? t.unsetFeatured : t.setFeatured}
        </Button>
      ) : null}
    </Space>
  ), [loadDetail, openActionModal, t.approve, t.changes, t.detail, t.reject, t.setFeatured, t.unsetFeatured]);

  const columns = useMemo<ColumnsType<MarketReviewRow>>(() => [
    {
      title: t.market,
      dataIndex: 'type',
      width: 110,
      render: (type: MarketType) => <Tag color="blue">{getMarketTypeLabel(type, language)}</Tag>,
      filters: MARKET_TYPE_ORDER.map(type => ({ text: getMarketTypeLabel(type, language), value: type })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: '条目',
      dataIndex: 'title',
      render: (_value, record) => (
        <Space direction="vertical" size={2} style={{ maxWidth: 520 }}>
          <Space wrap size={[6, 4]}>
            <Text strong>{shortText(record.title, record.id)}</Text>
            {record.featured ? <Tag color="gold" icon={<StarFilled />}>{t.featured}</Tag> : null}
            <Tag color={record.source === 'review' ? 'purple' : 'green'}>{record.source === 'review' ? t.reviewQueue : t.publishedList}</Tag>
          </Space>
          <Text type="secondary" copyable={{ text: record.id }}>{record.id}</Text>
          {record.versionId ? (
            <Text type="secondary" copyable={{ text: record.versionId }}>
              version {record.versionLabel || record.versionId}
            </Text>
          ) : null}
          <Paragraph className="operit-market-review-excerpt" type="secondary">
            {shortText(record.description, '-')}
          </Paragraph>
        </Space>
      ),
    },
    {
      title: t.reviewState,
      dataIndex: 'stateCode',
      width: 130,
      render: (state: string) => <Tag color={stateColor(state)}>{getReviewStateLabel(state, language)}</Tag>,
    },
    {
      title: t.category,
      dataIndex: 'categoryId',
      width: 180,
      render: (categoryId: string) => categoryLabel(categoryId),
    },
    {
      title: '作者 / 发布者 / 版本发布者',
      width: 230,
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Space size={6}>
            <Avatar size={22} icon={!record.authorAvatar ? <UserOutlined /> : undefined} src={record.authorAvatar || undefined} />
            <Text>{record.authorLogin}</Text>
          </Space>
          <Space size={6}>
            <Avatar size={22} icon={!record.publisherAvatar ? <UserOutlined /> : undefined} src={record.publisherAvatar || undefined} />
            <Text type="secondary">{record.publisherLogin}</Text>
          </Space>
          {record.versionPublisherId ? (
            <Space size={6}>
              <Avatar size={22} icon={!record.versionPublisherAvatar ? <UserOutlined /> : undefined} src={record.versionPublisherAvatar || undefined} />
              <Text type="secondary">{record.versionPublisherLogin || record.versionPublisherId}</Text>
            </Space>
          ) : null}
        </Space>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      sorter: (a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')),
      defaultSortOrder: 'descend',
      render: formatDateTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      fixed: 'right',
      render: (_value, record) => renderRowActions(record),
    },
  ], [categoryLabel, language, renderRowActions, t.category, t.featured, t.market, t.publishedList, t.reviewQueue, t.reviewState]);

  const detailItem = detail?.item;
  const reasonOptions = FALLBACK_REASONS.map(reason => ({
    label: (
      <div className="operit-market-review-reason-option">
        <Text>{getReasonLabel(reason, language)}</Text>
        <Text type="secondary">{getReasonDescription(reason, language) || reason.code}</Text>
      </div>
    ),
    value: reason.code,
  }));

  if (authChecking) {
    return (
      <main style={{ paddingTop: 88, paddingBottom: 48 }}>
        <Content style={{ maxWidth: 1480, margin: '0 auto', padding: '0 24px' }}>
          <Card>
            <div className="operit-market-review-detail-loading">
              <Spin size="large" />
              <Text type="secondary">{t.loading}</Text>
            </div>
          </Card>
        </Content>
      </main>
    );
  }

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 1480, margin: '0 auto', padding: '0 24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div className="operit-market-review-topbar" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div>
                  <Title level={2} style={{ marginBottom: 8 }}>{t.title}</Title>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>{t.subtitle}</Paragraph>
                </div>
                <Space wrap>
                  {authUser ? (
                    <Text>
                      {t.currentUser}: {authUser.display_name || authUser.username || t.unknown}
                      {' · '}
                      {t.currentRole}: {authUser.role || 'reviewer'}
                    </Text>
                  ) : null}
                  <Button icon={<ReloadOutlined />} onClick={() => void loadData(adminToken)} loading={loading}>{t.reload}</Button>
                  <Button danger icon={<LogoutOutlined />} onClick={logout}>{t.logout}</Button>
                </Space>
              </div>
              <Alert type="info" showIcon message={t.publishedHint} />
            </Space>
          </Card>

          <Card title={t.filters}>
            <Space wrap className="operit-market-review-filters-row">
              <Select className="operit-market-review-filter-select" value={marketFilter} onChange={setMarketFilter} options={[{ label: t.all, value: 'all' }, ...MARKET_TYPE_ORDER.map(type => ({ label: getMarketTypeLabel(type, language), value: type }))]} />
              <Select className="operit-market-review-filter-select" value={reviewFilter} onChange={setReviewFilter} options={[{ label: t.all, value: 'all' }, ...(['pending', 'approved', 'changes_requested', 'rejected'] as ReviewState[]).map(state => ({ label: getReviewStateLabel(state, language), value: state }))]} />
              <Select className="operit-market-review-filter-select" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} showSearch optionFilterProp="label" />
              <Select className="operit-market-review-filter-select" value={featuredFilter} onChange={setFeaturedFilter} options={[{ label: t.all, value: 'all' }, { label: t.onlyFeatured, value: 'featured' }, { label: t.notFeatured, value: 'normal' }]} />
              <Select className="operit-market-review-filter-select" value={sourceFilter} onChange={setSourceFilter} options={[{ label: t.all, value: 'all' }, { label: t.reviewQueue, value: 'review' }, { label: t.publishedList, value: 'published' }]} />
              <Input.Search className="operit-market-review-search" allowClear value={search} onChange={event => setSearch(event.target.value)} placeholder={t.searchPlaceholder} />
            </Space>
          </Card>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Card title={`${t.reviewListTitle} (${filteredRows.length}/${rows.length})`}>
            <div className="operit-market-review-table-wrap">
              <Table
                rowKey={record => record.source === 'review' ? `${record.id}::${record.versionId || ''}` : record.id}
                loading={loading}
                columns={columns}
                dataSource={filteredRows}
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `Total ${total}` }}
              />
            </div>
            <div className="operit-market-review-mobile-list">
              {loading ? (
                <div className="operit-market-review-mobile-loading"><Spin tip={t.loading} /></div>
              ) : filteredRows.length === 0 ? (
                <div className="operit-market-review-mobile-empty">{t.empty}</div>
              ) : filteredRows.map(record => (
                <Card key={record.source === 'review' ? `${record.id}::${record.versionId || ''}` : record.id} size="small" className="operit-market-review-mobile-card">
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div className="operit-market-review-mobile-card-head">
                      <Space wrap size={[6, 4]}>
                        <Tag color="blue">{getMarketTypeLabel(record.type, language)}</Tag>
                        <Tag color={stateColor(record.stateCode)}>{getReviewStateLabel(record.stateCode, language)}</Tag>
                        {record.featured ? <Tag color="gold" icon={<StarFilled />}>{t.featured}</Tag> : null}
                        <Tag color={record.source === 'review' ? 'purple' : 'green'}>{record.source === 'review' ? t.reviewQueue : t.publishedList}</Tag>
                      </Space>
                    </div>
                    <div className="operit-market-review-mobile-title">{shortText(record.title, record.id)}</div>
                    <Text className="operit-market-review-mobile-id" type="secondary" copyable={{ text: record.id }}>{record.id}</Text>
                    {record.versionId ? <Text className="operit-market-review-mobile-id" type="secondary" copyable={{ text: record.versionId }}>version {record.versionLabel || record.versionId}</Text> : null}
                    <Paragraph className="operit-market-review-excerpt" type="secondary">{shortText(record.description, '-')}</Paragraph>
                    <div className="operit-market-review-mobile-meta">
                      <div>{t.category}: {categoryLabel(record.categoryId)}</div>
                      <div>{t.updatedAtLabel}: {formatDateTime(record.updatedAt)}</div>
                    </div>
                    <div className="operit-market-review-mobile-people">
                      <Space size={6}>
                        <Avatar size={22} icon={!record.authorAvatar ? <UserOutlined /> : undefined} src={record.authorAvatar || undefined} />
                        <Text>{record.authorLogin}</Text>
                      </Space>
                      <Space size={6}>
                        <Avatar size={22} icon={!record.publisherAvatar ? <UserOutlined /> : undefined} src={record.publisherAvatar || undefined} />
                        <Text type="secondary">{record.publisherLogin}</Text>
                      </Space>
                    </div>
                    {renderRowActions(record)}
                  </Space>
                </Card>
              ))}
            </div>
          </Card>
        </Space>

        <Drawer
          title={detailItem?.title || detailFallback?.title || t.detailTitle}
          open={detailOpen}
          width={860}
          onClose={() => setDetailOpen(false)}
          extra={detailFallback ? (
            <Space wrap className="operit-market-review-drawer-actions">
              {detailFallback.stateCode === 'approved' ? (
                <Button
                  icon={<StarFilled />}
                  onClick={() => openActionModal(detailFallback.featured ? 'unset_featured' : 'set_featured', detailFallback)}
                >
                  {detailFallback.featured ? t.unsetFeatured : t.setFeatured}
                </Button>
              ) : null}
            </Space>
          ) : null}
        >
          {detailLoading ? (
            <div className="operit-market-review-detail-loading"><Spin size="large" tip={t.loading} /></div>
          ) : detailItem ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small" title={t.metaInfo}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="ID"><Text copyable>{detailItem.id}</Text></Descriptions.Item>
                  <Descriptions.Item label="Title">{detailItem.title}</Descriptions.Item>
                  <Descriptions.Item label={t.market}>{getMarketTypeLabel(detailItem.type, language)}</Descriptions.Item>
                  <Descriptions.Item label={t.category}>{categoryLabel(detailItem.categoryId)}</Descriptions.Item>
                  <Descriptions.Item label="Author">
                    <Space size={6}>
                      <Avatar size={22} icon={!detailFallback?.authorAvatar ? <UserOutlined /> : undefined} src={detailFallback?.authorAvatar || undefined} />
                      <Text>{detailFallback?.authorLogin}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Publisher">
                    <Space size={6}>
                      <Avatar size={22} icon={!detailFallback?.publisherAvatar ? <UserOutlined /> : undefined} src={detailFallback?.publisherAvatar || undefined} />
                      <Text>{detailFallback?.publisherLogin}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Created">{formatDateTime(detailItem.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label="Updated">{formatDateTime(detailItem.updatedAt)}</Descriptions.Item>
                  <Descriptions.Item label="Published">{formatDateTime(detailItem.publishedAt)}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title={t.reviewInfo}>
                <Space wrap>
                  <Tag color={stateColor(detailItem.stateCode)}>{getReviewStateLabel(detailItem.stateCode, language)}</Tag>
                  {detailFallback?.featured ? <Tag color="gold" icon={<StarFilled />}>{t.featured}</Tag> : null}
                  <Tag color={detailFallback?.source === 'review' ? 'purple' : 'green'}>{detailFallback?.source === 'review' ? t.reviewQueue : t.publishedList}</Tag>
                </Space>
              </Card>

              <Card size="small" title={t.contentInfo}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {detailItem.description ? (
                    <div>
                      <Text strong>{t.description}</Text>
                      <OperitMarkdownPreview content={detailItem.description} />
                    </div>
                  ) : null}
                  {detailItem.detail ? (
                    <div>
                      <Text strong>{t.detailField}</Text>
                      <OperitMarkdownPreview content={detailItem.detail} />
                    </div>
                  ) : null}
                  {!detailItem.description && !detailItem.detail ? <Text type="secondary">-</Text> : null}
                </Space>
              </Card>

              <Card size="small" title={t.versions}>
                {renderVersionList(detail.versions || [], language, detailFallback ? {
                  target: detailFallback,
                  approve: t.approve,
                  changes: t.changes,
                  reject: t.reject,
                  openActionModal,
                } : undefined)}
              </Card>

              {detail.repoSource ? (
                <Card size="small" title={t.sourceInfo}>{renderRepoSource(detail.repoSource)}</Card>
              ) : null}

              {detail.artifactProject ? (
                <Card size="small" title={t.artifactInfo}>
                  {renderArtifactInfo(detail.artifactProject || undefined)}
                </Card>
              ) : null}

              {detail.assets && detail.assets.length > 0 ? (
                <Card size="small" title={t.assets}>{renderAssets(detail.assets)}</Card>
              ) : null}
            </Space>
          ) : null}
        </Drawer>

        <Modal
          title={getReviewActionLabel(actionType, language)}
          open={actionOpen}
          onCancel={() => setActionOpen(false)}
          onOk={submitAction}
          okText={t.actionSubmit}
          cancelText={t.actionCancel}
          confirmLoading={actionSubmitting}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {actionTarget ? (
              <Alert
                type="info"
                showIcon
                message={`${t.actionTarget}: ${actionTarget.title || actionTarget.id}`}
                description={`${getMarketTypeLabel(actionTarget.type, language)} / ${getReviewStateLabel(actionTarget.stateCode, language)} / ${actionVersionId || actionTarget.id}`}
              />
            ) : null}
            {actionType === 'changes_requested' || actionType === 'reject' ? (
              <>
                <Paragraph style={{ marginBottom: 0 }}>{t.actionReasonTitle}</Paragraph>
                <Checkbox.Group
                  style={{ width: '100%' }}
                  value={selectedReasonCodes}
                  options={reasonOptions}
                  onChange={values => setSelectedReasonCodes((values as string[]).slice(0, 1))}
                />
              </>
            ) : null}
          </Space>
        </Modal>
      </Content>
    </main>
  );
};

export default OperitMarketReviewPage;
