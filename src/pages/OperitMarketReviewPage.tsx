import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Drawer,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  LogoutOutlined,
  ReloadOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './OperitMarketReviewPage.css';
import {
  MARKET_TYPE_ORDER,
  REVIEW_STATE_COLORS,
  SHELF_STATE_COLORS,
  getMarketTypeLabel,
  getReasonDescription,
  getReasonLabel,
  getReviewActionLabel,
  getReviewStateLabel,
  getShelfStateLabel,
  type MarketType,
  type ReviewAction,
  type ReviewReasonOption,
  type ReviewState,
  type ShelfState,
} from '../utils/operitMarketReview';

const { Content } = Layout;
const { Title, Paragraph, Text, Link } = Typography;

interface OperitMarketReviewPageProps {
  language: 'zh' | 'en';
}

interface AdminAuthUser {
  username: string;
  display_name?: string | null;
  role?: string | null;
  owner?: boolean;
}

interface MarketLabel {
  name: string;
  color?: string;
}

interface MarketMetadata {
  description?: string;
  repository_url?: string;
  homepage_url?: string;
  install_config?: string;
  category?: string;
  tags?: string[];
  version?: string;
  project_id?: string;
}

interface MarketReviewItem {
  id: number;
  market_type: MarketType;
  market_name: string;
  repo_owner: string;
  repo_name: string;
  public_label: string;
  issue_number: number;
  title: string;
  html_url: string;
  created_at: string | null;
  updated_at: string | null;
  shelf_state: ShelfState;
  review_state: ReviewState;
  review_reason_codes: string[];
  is_publicly_visible: boolean;
  labels: MarketLabel[];
  author_login: string;
  author_url: string;
  comments: number;
  body_excerpt: string;
  metadata: MarketMetadata;
  raw_body?: string;
}

interface MarketReviewLog {
  id: number;
  market_type: MarketType;
  repo: string;
  issue_number: number;
  issue_title: string;
  action: ReviewAction;
  reason_codes: string[];
  previous_review_state: string;
  next_review_state: string;
  actor_username: string;
  actor_display_name: string;
  actor_role: string;
  created_at: string | null;
}

interface ReviewMetaResponse {
  reasons: ReviewReasonOption[];
  markets: Array<{
    code: MarketType;
    name: string;
    owner: string;
    repo: string;
    public_label: string;
  }>;
}

const STORAGE = {
  apiBase: 'operit_submission_admin_api_base',
  adminToken: 'operit_submission_admin_token',
};

const TEXT = {
  zh: {
    title: 'Operit 市场审核台',
    subtitle: '统一审核 MCP / Skill / Script / Package 四类市场投稿，审核意见只使用固定状态与原因码。',
    apiBase: 'API 地址',
    currentUser: '当前账号',
    currentRole: '角色',
    loggedIn: '已登录',
    logout: '退出登录',
    filters: '筛选条件',
    market: '市场类型',
    reviewState: '审核状态',
    shelfState: '上架状态',
    search: '搜索',
    searchPlaceholder: '搜索标题、作者、标签、仓库、原因码',
    reload: '刷新',
    detail: '查看详情',
    loadFailed: '加载失败',
    reviewListTitle: '审核列表',
    openIssue: '打开 Issue',
    detailTitle: '投稿详情',
    rawBody: '原始内容',
    labels: '全部标签',
    auditLogs: '审核日志',
    noLogs: '暂无审核日志',
    metaInfo: '基础信息',
    reviewInfo: '审核信息',
    metadata: '投稿元数据',
    repository: '仓库地址',
    homepage: '主页地址',
    installConfig: '安装配置',
    category: '分类',
    version: '版本',
    projectId: '项目 ID',
    description: '描述',
    author: '作者',
    comments: '评论数',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    reviewReasons: '未通过原因',
    reviewAction: '审核操作',
    approve: '审核通过',
    changesRequested: '打回',
    reject: '拒绝',
    resetPending: '作者重新提交',
    actionSubmit: '确认提交',
    actionCancel: '取消',
    actionReasonRequired: '打回或拒绝时，至少选择一个原因码。',
    actionReasonTitle: '请选择原因码',
    actionTarget: '目标条目',
    publiclyVisible: '公开可见',
    notPubliclyVisible: '未公开',
    unknown: '-',
    issueNumber: 'Issue 编号',
    repo: '仓库',
    reviewerActionSuccess: '审核状态已更新。',
    detailLoadFailed: '加载详情失败。',
    actionFailed: '提交审核动作失败。',
    loginExpired: '登录已失效，请重新登录。',
    noReason: '无',
    empty: '暂无数据',
    all: '全部',
    open: '上架中',
    closed: '已下架',
  },
  en: {
    title: 'Operit Market Review',
    subtitle: 'Review MCP / Skill / Script / Package submissions with fixed states and reason codes only.',
    apiBase: 'API Base',
    currentUser: 'Current User',
    currentRole: 'Role',
    loggedIn: 'Signed in',
    logout: 'Sign out',
    filters: 'Filters',
    market: 'Market',
    reviewState: 'Review State',
    shelfState: 'Shelf State',
    search: 'Search',
    searchPlaceholder: 'Search title, author, labels, repo, or reason code',
    reload: 'Reload',
    detail: 'View Detail',
    loadFailed: 'Load failed',
    reviewListTitle: 'Review Queue',
    openIssue: 'Open Issue',
    detailTitle: 'Submission Detail',
    rawBody: 'Raw Body',
    labels: 'Labels',
    auditLogs: 'Audit Logs',
    noLogs: 'No audit logs yet',
    metaInfo: 'Basic Info',
    reviewInfo: 'Review Info',
    metadata: 'Submission Metadata',
    repository: 'Repository',
    homepage: 'Homepage',
    installConfig: 'Install Config',
    category: 'Category',
    version: 'Version',
    projectId: 'Project ID',
    description: 'Description',
    author: 'Author',
    comments: 'Comments',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    reviewReasons: 'Reasons',
    reviewAction: 'Review Actions',
    approve: 'Approve',
    changesRequested: 'Changes Requested',
    reject: 'Reject',
    resetPending: 'Reset Pending',
    actionSubmit: 'Submit',
    actionCancel: 'Cancel',
    actionReasonRequired: 'At least one reason code is required for changes requested or reject.',
    actionReasonTitle: 'Select reason codes',
    actionTarget: 'Target',
    publiclyVisible: 'Publicly Visible',
    notPubliclyVisible: 'Not Public',
    unknown: '-',
    issueNumber: 'Issue Number',
    repo: 'Repository',
    reviewerActionSuccess: 'Review state updated.',
    detailLoadFailed: 'Failed to load detail.',
    actionFailed: 'Failed to submit review action.',
    loginExpired: 'Your session expired. Please sign in again.',
    noReason: 'None',
    empty: 'No data',
    all: 'All',
    open: 'Open',
    closed: 'Closed',
  },
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildAdminHeaders(token: string): HeadersInit {
  return {
    'X-Operit-Admin-Token': token.trim(),
  };
}

function resolveApiError(response: Response, data: unknown, isZh: boolean) {
  const payload = (data || {}) as { error?: unknown };
  const code = typeof payload.error === 'string' ? payload.error : '';
  const zh: Record<string, string> = {
    unauthorized: '管理员登录已失效。',
    session_expired: '管理员登录已过期。',
    account_disabled: '该审核账号已被停用。',
    market_invalid: '市场类型无效。',
    review_state_invalid: '审核状态筛选无效。',
    shelf_state_invalid: '上架状态筛选无效。',
    issue_number_invalid: 'Issue 编号无效。',
    action_invalid: '审核动作无效。',
    reason_codes_required: '打回或拒绝必须选择至少一个原因码。',
    reason_code_invalid: '存在无效原因码。',
    github_issue_not_found: '未找到对应的 GitHub Issue。',
    github_issue_is_pull_request: '目标不是普通 Issue，无法审核。',
    github_auth_missing: '服务端未配置 GitHub 审核权限。',
    invalid_json: '请求格式错误。',
  };
  const en: Record<string, string> = {
    unauthorized: 'Admin session is invalid.',
    session_expired: 'Admin session expired.',
    account_disabled: 'This reviewer account is disabled.',
    market_invalid: 'Invalid market type.',
    review_state_invalid: 'Invalid review state filter.',
    shelf_state_invalid: 'Invalid shelf state filter.',
    issue_number_invalid: 'Invalid issue number.',
    action_invalid: 'Invalid review action.',
    reason_codes_required: 'At least one reason code is required.',
    reason_code_invalid: 'One or more reason codes are invalid.',
    github_issue_not_found: 'GitHub issue not found.',
    github_issue_is_pull_request: 'Target is not a regular issue.',
    github_auth_missing: 'GitHub review credentials are not configured on the server.',
    invalid_json: 'Invalid request payload.',
  };
  const mapped = (isZh ? zh : en)[code];
  return mapped || code || `${isZh ? '请求失败' : 'Request failed'} (HTTP ${response.status})`;
}

const OperitMarketReviewPage: React.FC<OperitMarketReviewPageProps> = ({ language }) => {
  const isZh = language === 'zh';
  const t = TEXT[language];
  const navigate = useNavigate();

  const [apiBase, setApiBase] = useState(() => localStorage.getItem(STORAGE.apiBase) || 'https://api.aaswordsman.org');
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(STORAGE.adminToken) || '');
  const [authUser, setAuthUser] = useState<AdminAuthUser | null>(null);
  const [meta, setMeta] = useState<ReviewMetaResponse | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [marketFilter, setMarketFilter] = useState<'all' | MarketType>('all');
  const [reviewStateFilter, setReviewStateFilter] = useState<'all' | ReviewState>('pending');
  const [shelfStateFilter, setShelfStateFilter] = useState<'all' | ShelfState>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const [items, setItems] = useState<MarketReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<MarketReviewItem | null>(null);
  const [detailLogs, setDetailLogs] = useState<MarketReviewLog[]>([]);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionType, setActionType] = useState<ReviewAction>('approve');
  const [actionTarget, setActionTarget] = useState<MarketReviewItem | null>(null);
  const [selectedReasonCodes, setSelectedReasonCodes] = useState<string[]>([]);

  const reasonMap = useMemo(() => {
    const map = new Map<string, ReviewReasonOption>();
    for (const option of meta?.reasons || []) {
      map.set(option.code, option);
    }
    return map;
  }, [meta]);

  useEffect(() => {
    localStorage.setItem(STORAGE.apiBase, apiBase);
  }, [apiBase]);

  useEffect(() => {
    if (adminToken.trim()) {
      localStorage.setItem(STORAGE.adminToken, adminToken);
    } else {
      localStorage.removeItem(STORAGE.adminToken);
    }
  }, [adminToken]);

  const fetchJson = useCallback(async (url: string, options?: RequestInit) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { response, data };
  }, []);

  const handleUnauthorized = useCallback(() => {
    setAdminToken('');
    setAuthUser(null);
    localStorage.removeItem(STORAGE.adminToken);
    navigate('/operit-login?next=/operit-market-review', { replace: true });
  }, [navigate]);

  const loadAdminProfile = useCallback(async (token: string) => {
    const { response, data } = await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/auth/me`, {
      headers: buildAdminHeaders(token),
    });
    if (!response.ok) {
      return null;
    }
    return ((data as { user?: AdminAuthUser })?.user || null) as AdminAuthUser | null;
  }, [apiBase, fetchJson]);

  const loadMeta = useCallback(async (token: string) => {
    setLoadingMeta(true);
    try {
      const { response, data } = await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/market-review/meta`, {
        headers: buildAdminHeaders(token),
      });
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(resolveApiError(response, data, isZh));
      }
      setMeta((data || null) as ReviewMetaResponse | null);
    } finally {
      setLoadingMeta(false);
    }
  }, [apiBase, fetchJson, handleUnauthorized, isZh]);

  const loadIssues = useCallback(async () => {
    if (!adminToken.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBase.replace(/\/+$/, '')}/api/admin/market-review/issues`);
      url.searchParams.set('market', marketFilter);
      url.searchParams.set('review_state', reviewStateFilter);
      url.searchParams.set('shelf_state', shelfStateFilter);
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('offset', String((page - 1) * pageSize));
      if (searchQuery.trim()) {
        url.searchParams.set('q', searchQuery.trim());
      }

      const { response, data } = await fetchJson(url.toString(), {
        headers: buildAdminHeaders(adminToken),
      });
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(resolveApiError(response, data, isZh));
      }

      const payload = (data || {}) as { items?: MarketReviewItem[]; total?: number };
      setItems(payload.items || []);
      setTotal(Number(payload.total || 0));
    } catch (err) {
      setError((err as Error).message || t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [
    adminToken,
    apiBase,
    fetchJson,
    handleUnauthorized,
    isZh,
    marketFilter,
    page,
    pageSize,
    reviewStateFilter,
    searchQuery,
    shelfStateFilter,
    t.loadFailed,
  ]);

  const loadDetail = useCallback(async (marketType: MarketType, issueNumber: number) => {
    if (!adminToken.trim()) {
      return;
    }

    setDetailLoading(true);
    try {
      const { response, data } = await fetchJson(
        `${apiBase.replace(/\/+$/, '')}/api/admin/market-review/issues/${marketType}/${issueNumber}`,
        {
          headers: buildAdminHeaders(adminToken),
        },
      );
      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(resolveApiError(response, data, isZh));
      }
      const payload = (data || {}) as { item?: MarketReviewItem; logs?: MarketReviewLog[] };
      setDetailItem(payload.item || null);
      setDetailLogs(payload.logs || []);
      setDetailOpen(true);
    } catch (err) {
      message.error((err as Error).message || t.detailLoadFailed);
    } finally {
      setDetailLoading(false);
    }
  }, [adminToken, apiBase, fetchJson, handleUnauthorized, isZh, t.detailLoadFailed]);

  const handleLogout = useCallback(async () => {
    try {
      if (adminToken.trim()) {
        await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/auth/logout`, {
          method: 'POST',
          headers: buildAdminHeaders(adminToken),
        });
      }
    } catch {
      // ignore logout request failures
    }
    handleUnauthorized();
  }, [adminToken, apiBase, fetchJson, handleUnauthorized]);

  useEffect(() => {
    if (!adminToken.trim()) {
      handleUnauthorized();
      return;
    }

    let active = true;
    (async () => {
      try {
        const user = await loadAdminProfile(adminToken);
        if (!active) {
          return;
        }
        if (!user) {
          message.warning(t.loginExpired);
          handleUnauthorized();
          return;
        }
        setAuthUser(user);
        await loadMeta(adminToken);
      } catch (err) {
        if (!active) {
          return;
        }
        setError((err as Error).message || t.loadFailed);
      }
    })();

    return () => {
      active = false;
    };
  }, [adminToken, handleUnauthorized, loadAdminProfile, loadMeta, t.loadFailed, t.loginExpired]);

  useEffect(() => {
    if (!authUser) {
      return;
    }
    loadIssues();
  }, [authUser, loadIssues]);

  const openActionModal = useCallback((action: ReviewAction, item: MarketReviewItem) => {
    setActionType(action);
    setActionTarget(item);
    setSelectedReasonCodes(
      action === 'changes_requested' || action === 'reject' ? item.review_reason_codes || [] : [],
    );
    setActionOpen(true);
  }, []);

  const submitAction = useCallback(async () => {
    if (!adminToken.trim() || !actionTarget) {
      return;
    }
    if ((actionType === 'changes_requested' || actionType === 'reject') && selectedReasonCodes.length === 0) {
      message.error(t.actionReasonRequired);
      return;
    }

    setActionSubmitting(true);
    try {
      const { response, data } = await fetchJson(
        `${apiBase.replace(/\/+$/, '')}/api/admin/market-review/issues/${actionTarget.market_type}/${actionTarget.issue_number}/action`,
        {
          method: 'POST',
          headers: {
            ...buildAdminHeaders(adminToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: actionType,
            reason_codes: selectedReasonCodes,
          }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(resolveApiError(response, data, isZh));
      }

      message.success(t.reviewerActionSuccess);
      setActionOpen(false);
      const currentTarget = actionTarget;
      await loadIssues();
      if (detailOpen && detailItem && currentTarget.market_type === detailItem.market_type && currentTarget.issue_number === detailItem.issue_number) {
        await loadDetail(currentTarget.market_type, currentTarget.issue_number);
      }
    } catch (err) {
      message.error((err as Error).message || t.actionFailed);
    } finally {
      setActionSubmitting(false);
    }
  }, [
    actionTarget,
    actionType,
    adminToken,
    apiBase,
    detailItem,
    detailOpen,
    fetchJson,
    handleUnauthorized,
    isZh,
    loadDetail,
    loadIssues,
    selectedReasonCodes,
    t.actionFailed,
    t.actionReasonRequired,
    t.reviewerActionSuccess,
  ]);

  const columns = useMemo<ColumnsType<MarketReviewItem>>(() => [
    {
      title: t.issueNumber,
      dataIndex: 'issue_number',
      width: 116,
      render: (value: number, record) => (
        <Space direction="vertical" size={4}>
          <Text strong>#{value}</Text>
          <Tag color={record.is_publicly_visible ? 'green' : 'default'}>
            {record.is_publicly_visible ? t.publiclyVisible : t.notPubliclyVisible}
          </Tag>
        </Space>
      ),
    },
    {
      title: isZh ? '标题' : 'Title',
      dataIndex: 'title',
      render: (_value: string, record) => (
        <Space direction="vertical" size={4}>
          <Button type="link" onClick={() => loadDetail(record.market_type, record.issue_number)} style={{ paddingInline: 0 }}>
            {record.title || t.unknown}
          </Button>
          {record.body_excerpt ? (
            <Text type="secondary" className="operit-market-review-excerpt">
              {record.body_excerpt}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t.market,
      dataIndex: 'market_type',
      width: 120,
      render: (value: string) => <Tag color="geekblue">{getMarketTypeLabel(value, language)}</Tag>,
    },
    {
      title: t.reviewState,
      dataIndex: 'review_state',
      width: 148,
      render: (value: ReviewState) => (
        <Tag color={REVIEW_STATE_COLORS[value] || 'default'}>
          {getReviewStateLabel(value, language)}
        </Tag>
      ),
    },
    {
      title: t.shelfState,
      dataIndex: 'shelf_state',
      width: 120,
      render: (value: ShelfState) => (
        <Tag color={SHELF_STATE_COLORS[value] || 'default'}>
          {getShelfStateLabel(value, language)}
        </Tag>
      ),
    },
    {
      title: t.reviewReasons,
      dataIndex: 'review_reason_codes',
      render: (value: string[]) => (
        <Space wrap size={[4, 4]}>
          {(value || []).length > 0
            ? value.map(code => {
                const option = reasonMap.get(code);
                return (
                  <Tag key={code} color="orange">
                    {option ? getReasonLabel(option, language) : code}
                  </Tag>
                );
              })
            : <Text type="secondary">{t.noReason}</Text>}
        </Space>
      ),
    },
    {
      title: t.author,
      dataIndex: 'author_login',
      width: 160,
      render: (_value: string, record) => (
        record.author_url ? (
          <Link href={record.author_url} target="_blank" rel="noreferrer">
            {record.author_login || t.unknown}
          </Link>
        ) : (
          <Text>{record.author_login || t.unknown}</Text>
        )
      ),
    },
    {
      title: t.updatedAt,
      dataIndex: 'updated_at',
      width: 180,
      render: (value: string | null) => formatDateTime(value),
    },
    {
      title: isZh ? '操作' : 'Actions',
      key: 'actions',
      width: 150,
      render: (_value: unknown, record) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => loadDetail(record.market_type, record.issue_number)}>
            {t.detail}
          </Button>
        </Space>
      ),
    },
  ], [
    isZh,
    language,
    loadDetail,
    reasonMap,
    t.author,
    t.detail,
    t.issueNumber,
    t.market,
    t.noReason,
    t.notPubliclyVisible,
    t.publiclyVisible,
    t.reviewReasons,
    t.reviewState,
    t.shelfState,
    t.unknown,
    t.updatedAt,
  ]);

  const reasonOptions = useMemo(() => {
    return (meta?.reasons || []).map(option => ({
      label: (
        <div className="operit-market-review-reason-option">
          <Text strong>{getReasonLabel(option, language)}</Text>
          {getReasonDescription(option, language) ? (
            <Text type="secondary">{getReasonDescription(option, language)}</Text>
          ) : null}
        </div>
      ),
      value: option.code,
    }));
  }, [language, meta]);

  const actionNeedsReasons = actionType === 'changes_requested' || actionType === 'reject';

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 1480, margin: '0 auto', padding: '0 24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Title level={2} style={{ marginBottom: 8 }}>
                  {t.title}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {t.subtitle}
                </Paragraph>
              </div>

              <Space wrap size={[12, 12]} className="operit-market-review-topbar">
                <Input
                  value={apiBase}
                  onChange={event => setApiBase(event.target.value)}
                  addonBefore={t.apiBase}
                  className="operit-market-review-api-input"
                />
                <Tag color={adminToken.trim() ? 'green' : 'default'}>
                  {adminToken.trim() ? t.loggedIn : (isZh ? '未登录' : 'Not signed in')}
                </Tag>
                {authUser ? (
                  <Text>
                    {t.currentUser}: {authUser.display_name || authUser.username || t.unknown}
                    {' · '}
                    {t.currentRole}: {authUser.role || 'reviewer'}
                  </Text>
                ) : null}
                <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                  {t.logout}
                </Button>
              </Space>
            </Space>
          </Card>

          <Card title={t.filters} extra={<Button icon={<ReloadOutlined />} onClick={loadIssues} loading={loading || loadingMeta}>{t.reload}</Button>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {error ? (
                <Alert showIcon type="error" message={t.loadFailed} description={error} />
              ) : null}
              <Space wrap size={[12, 12]} className="operit-market-review-filters-row">
                <Select
                  value={marketFilter}
                  onChange={value => {
                    setMarketFilter(value as 'all' | MarketType);
                    setPage(1);
                  }}
                  className="operit-market-review-filter-select"
                  options={[
                    { label: t.all, value: 'all' },
                    ...[...(meta?.markets || [])].sort((left, right) => MARKET_TYPE_ORDER.indexOf(left.code) - MARKET_TYPE_ORDER.indexOf(right.code)).map(item => ({
                      label: getMarketTypeLabel(item.code, language),
                      value: item.code,
                    })),
                  ]}
                />
                <Select
                  value={reviewStateFilter}
                  onChange={value => {
                    setReviewStateFilter(value as 'all' | ReviewState);
                    setPage(1);
                  }}
                  className="operit-market-review-filter-select"
                  options={[
                    { label: t.all, value: 'all' },
                    { label: getReviewStateLabel('pending', language), value: 'pending' },
                    { label: getReviewStateLabel('approved', language), value: 'approved' },
                    { label: getReviewStateLabel('changes_requested', language), value: 'changes_requested' },
                    { label: getReviewStateLabel('rejected', language), value: 'rejected' },
                  ]}
                />
                <Select
                  value={shelfStateFilter}
                  onChange={value => {
                    setShelfStateFilter(value as 'all' | ShelfState);
                    setPage(1);
                  }}
                  className="operit-market-review-filter-select"
                  options={[
                    { label: t.all, value: 'all' },
                    { label: t.open, value: 'open' },
                    { label: t.closed, value: 'closed' },
                  ]}
                />
                <Input.Search
                  allowClear
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  onSearch={value => {
                    setSearchQuery(value);
                    setPage(1);
                  }}
                  placeholder={t.searchPlaceholder}
                  className="operit-market-review-search"
                />
              </Space>
            </Space>
          </Card>

          <Card title={t.reviewListTitle}>
            <Table
              rowKey={record => `${record.market_type}:${record.issue_number}`}
              loading={loading || loadingMeta}
              columns={columns}
              dataSource={items}
              locale={{ emptyText: t.empty }}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                onChange: (nextPage, nextPageSize) => {
                  setPage(nextPage);
                  setPageSize(nextPageSize);
                },
              }}
              scroll={{ x: 1180 }}
            />
          </Card>
        </Space>

        <Drawer
          title={t.detailTitle}
          open={detailOpen}
          width={860}
          onClose={() => setDetailOpen(false)}
          extra={detailItem ? (
            <Space wrap className="operit-market-review-drawer-actions">
              <Button icon={<ReloadOutlined />} loading={detailLoading} onClick={() => loadDetail(detailItem.market_type, detailItem.issue_number)}>
                {t.reload}
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openActionModal('approve', detailItem)}>
                {t.approve}
              </Button>
              <Button icon={<EditOutlined />} onClick={() => openActionModal('changes_requested', detailItem)}>
                {t.changesRequested}
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={() => openActionModal('reject', detailItem)}>
                {t.reject}
              </Button>
              <Button icon={<UndoOutlined />} onClick={() => openActionModal('reset_pending', detailItem)}>
                {t.resetPending}
              </Button>
            </Space>
          ) : null}
        >
          {detailItem ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Card size="small" title={t.metaInfo} loading={detailLoading}>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label={t.issueNumber}>#{detailItem.issue_number}</Descriptions.Item>
                  <Descriptions.Item label={t.market}>{getMarketTypeLabel(detailItem.market_type, language)}</Descriptions.Item>
                  <Descriptions.Item label={t.repo}>{detailItem.repo_owner}/{detailItem.repo_name}</Descriptions.Item>
                  <Descriptions.Item label={t.author}>
                    {detailItem.author_url ? (
                      <Link href={detailItem.author_url} target="_blank" rel="noreferrer">
                        {detailItem.author_login || t.unknown}
                      </Link>
                    ) : (
                      detailItem.author_login || t.unknown
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t.createdAt}>{formatDateTime(detailItem.created_at)}</Descriptions.Item>
                  <Descriptions.Item label={t.updatedAt}>{formatDateTime(detailItem.updated_at)}</Descriptions.Item>
                  <Descriptions.Item label={t.shelfState}>
                    <Tag color={SHELF_STATE_COLORS[detailItem.shelf_state] || 'default'}>
                      {getShelfStateLabel(detailItem.shelf_state, language)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.comments}>{detailItem.comments}</Descriptions.Item>
                  <Descriptions.Item label={t.openIssue} span={2}>
                    <Link href={detailItem.html_url} target="_blank" rel="noreferrer">
                      {detailItem.title || t.unknown}
                    </Link>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title={t.reviewInfo}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={REVIEW_STATE_COLORS[detailItem.review_state] || 'default'}>
                      {getReviewStateLabel(detailItem.review_state, language)}
                    </Tag>
                    <Tag color={detailItem.is_publicly_visible ? 'green' : 'default'}>
                      {detailItem.is_publicly_visible ? t.publiclyVisible : t.notPubliclyVisible}
                    </Tag>
                  </Space>
                  <div>
                    <Text strong>{t.reviewReasons}</Text>
                    <div style={{ marginTop: 8 }}>
                      <Space wrap size={[4, 4]}>
                        {detailItem.review_reason_codes.length > 0 ? detailItem.review_reason_codes.map(code => {
                          const option = reasonMap.get(code);
                          return (
                            <Tag key={code} color="orange">
                              {option ? getReasonLabel(option, language) : code}
                            </Tag>
                          );
                        }) : <Text type="secondary">{t.noReason}</Text>}
                      </Space>
                    </div>
                  </div>
                </Space>
              </Card>

              <Card size="small" title={t.metadata}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label={t.description}>
                    {detailItem.metadata?.description || detailItem.body_excerpt || t.unknown}
                  </Descriptions.Item>
                  <Descriptions.Item label={t.repository}>
                    {detailItem.metadata?.repository_url ? (
                      <Link href={detailItem.metadata.repository_url} target="_blank" rel="noreferrer">
                        {detailItem.metadata.repository_url}
                      </Link>
                    ) : t.unknown}
                  </Descriptions.Item>
                  <Descriptions.Item label={t.homepage}>
                    {detailItem.metadata?.homepage_url ? (
                      <Link href={detailItem.metadata.homepage_url} target="_blank" rel="noreferrer">
                        {detailItem.metadata.homepage_url}
                      </Link>
                    ) : t.unknown}
                  </Descriptions.Item>
                  <Descriptions.Item label={t.installConfig}>
                    {detailItem.metadata?.install_config || t.unknown}
                  </Descriptions.Item>
                  <Descriptions.Item label={t.category}>
                    {detailItem.metadata?.category || t.unknown}
                  </Descriptions.Item>
                  <Descriptions.Item label={isZh ? '标签' : 'Tags'}>
                    <Space wrap size={[4, 4]}>
                      {(detailItem.metadata?.tags || []).length > 0
                        ? detailItem.metadata?.tags?.map(tag => <Tag key={tag}>{tag}</Tag>)
                        : <Text type="secondary">{t.unknown}</Text>}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={t.version}>
                    {detailItem.metadata?.version || t.unknown}
                  </Descriptions.Item>
                  <Descriptions.Item label={t.projectId}>
                    {detailItem.metadata?.project_id || t.unknown}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title={t.labels}>
                <Space wrap size={[4, 4]}>
                  {detailItem.labels.length > 0 ? detailItem.labels.map(label => (
                    <Tag key={label.name} color={label.color ? `#${label.color}` : undefined}>
                      {label.name}
                    </Tag>
                  )) : <Text type="secondary">{t.empty}</Text>}
                </Space>
              </Card>

              <Card size="small" title={t.auditLogs}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {detailLogs.length > 0 ? detailLogs.map(log => (
                    <div key={log.id} className="operit-market-review-log">
                      <Space wrap>
                        <Tag color="processing">{getReviewActionLabel(log.action, language)}</Tag>
                        <Tag color={REVIEW_STATE_COLORS[(log.next_review_state as ReviewState) || 'pending'] || 'default'}>
                          {getReviewStateLabel(log.next_review_state, language)}
                        </Tag>
                        <Text type="secondary">{formatDateTime(log.created_at)}</Text>
                      </Space>
                      <div>
                        <Text>
                          {(log.actor_display_name || log.actor_username || t.unknown)}
                          {log.actor_role ? ` (${log.actor_role})` : ''}
                        </Text>
                      </div>
                      <Space wrap size={[4, 4]}>
                        {log.reason_codes.length > 0 ? log.reason_codes.map(code => {
                          const option = reasonMap.get(code);
                          return (
                            <Tag key={`${log.id}-${code}`} color="orange">
                              {option ? getReasonLabel(option, language) : code}
                            </Tag>
                          );
                        }) : <Text type="secondary">{t.noReason}</Text>}
                      </Space>
                    </div>
                  )) : <Text type="secondary">{t.noLogs}</Text>}
                </Space>
              </Card>

              <Divider style={{ margin: 0 }} />

              <Card size="small" title={t.rawBody}>
                <pre className="operit-market-review-raw-body">
                  {detailItem.raw_body || ''}
                </pre>
              </Card>
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
                message={`${t.actionTarget}: #${actionTarget.issue_number} · ${actionTarget.title}`}
                description={`${getMarketTypeLabel(actionTarget.market_type, language)} / ${getReviewStateLabel(actionTarget.review_state, language)}`}
              />
            ) : null}

            {actionNeedsReasons ? (
              <>
                <Paragraph style={{ marginBottom: 0 }}>
                  {t.actionReasonTitle}
                </Paragraph>
                <Checkbox.Group
                  style={{ width: '100%' }}
                  value={selectedReasonCodes}
                  options={reasonOptions}
                  onChange={values => setSelectedReasonCodes(values as string[])}
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
