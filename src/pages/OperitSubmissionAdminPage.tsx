import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Input,
  InputNumber,
  Layout,
  Modal,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import { translations } from '../translations';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text, Paragraph, Link } = Typography;

type SubmissionStatus = 'pending' | 'approved' | 'rejected';
type StatusFilter = SubmissionStatus | 'all';

type DiffRowType = 'equal' | 'insert' | 'delete' | 'replace';

interface RawDiffRow {
  type: 'equal' | 'insert' | 'delete';
  left: string | null;
  right: string | null;
}

interface DiffRow {
  type: DiffRowType;
  left: string | null;
  right: string | null;
  leftLine: number | null;
  rightLine: number | null;
}

interface SubmissionItem {
  id: string;
  type: 'add' | 'edit';
  language: 'zh' | 'en';
  target_path: string;
  title: string;
  content?: string;
  status: SubmissionStatus;
  author_name?: string | null;
  author_email?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewer?: string | null;
  review_notes?: string | null;
  pr_number?: number | null;
  pr_url?: string | null;
  pr_branch?: string | null;
  pr_state?: string | null;
  pr_created_at?: string | null;
  pr_error?: string | null;
}

interface SubmissionPrInfo {
  status?: string;
  number?: number;
  url?: string;
  branch?: string;
  created_at?: string;
  error?: string;
}

interface IpBanItem {
  ip_hash: string;
  reason?: string | null;
  notes?: string | null;
  created_at: string;
  expires_at?: string | null;
  banned_by?: string | null;
}

interface OperitSubmissionAdminPageProps {
  language: 'zh' | 'en';
}

interface AdminAuthUser {
  username: string;
  display_name?: string | null;
  role?: string | null;
  owner?: boolean;
}

const STORAGE = {
  adminToken: 'operit_submission_admin_token',
};

const DEFAULT_DOCS_BASE = 'https://operit.aaswordsman.org';
const DEFAULT_REPO_OWNER = 'AAswordman';
const DEFAULT_REPO_NAME = 'OperitWeb';
const DEFAULT_REPO_BRANCH = 'main';
const DEFAULT_REPO_PREFIX = 'public';
const DIFF_MAX_LINES = 2000;

const statusColor: Record<SubmissionStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
};

const typeColor: Record<'add' | 'edit', string> = {
  add: 'blue',
  edit: 'purple',
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const normalizePath = (value?: string | null): string => {
  if (!value) return '';
  return String(value).trim().replace(/^\/+/, '');
};

const splitLines = (value: string): string[] => {
  return value.replace(/\r\n/g, '\n').split('\n');
};

const buildDocUrl = (base: string, targetPath: string): string => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = normalizePath(targetPath);
  return `${normalizedBase}/${normalizedPath}`;
};

const buildGithubRawUrl = (targetPath: string): string => {
  const normalizedPath = normalizePath(targetPath);
  return `https://raw.githubusercontent.com/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}/${DEFAULT_REPO_BRANCH}/${DEFAULT_REPO_PREFIX}/${normalizedPath}`;
};

const buildLineDiff = (oldLines: string[], newLines: string[]) => {
  const max = oldLines.length + newLines.length;
  const trace: Map<number, number>[] = [];
  let v = new Map<number, number>();
  v.set(1, 0);

  for (let d = 0; d <= max; d += 1) {
    const next = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      const down = v.get(k + 1) ?? 0;
      const right = v.get(k - 1) ?? 0;
      let x = 0;
      if (k === -d || (k !== d && right < down)) {
        x = down;
      } else {
        x = right + 1;
      }
      let y = x - k;
      while (x < oldLines.length && y < newLines.length && oldLines[x] === newLines[y]) {
        x += 1;
        y += 1;
      }
      next.set(k, x);
      if (x >= oldLines.length && y >= newLines.length) {
        trace.push(next);
        return trace;
      }
    }
    trace.push(next);
    v = next;
  }
  return trace;
};

const backtrackDiff = (trace: Map<number, number>[], oldLines: string[], newLines: string[]): RawDiffRow[] => {
  const rows: RawDiffRow[] = [];
  let x = oldLines.length;
  let y = newLines.length;

  for (let d = trace.length - 1; d > 0; d -= 1) {
    const v = trace[d - 1];
    const k = x - y;
    const down = v.get(k + 1) ?? 0;
    const right = v.get(k - 1) ?? 0;
    const prevK = k === -d || (k !== d && right < down) ? k + 1 : k - 1;
    const prevX = v.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      rows.unshift({ type: 'equal', left: oldLines[x - 1], right: newLines[y - 1] });
      x -= 1;
      y -= 1;
    }

    if (x === prevX) {
      rows.unshift({ type: 'insert', left: null, right: newLines[y - 1] });
      y -= 1;
    } else {
      rows.unshift({ type: 'delete', left: oldLines[x - 1], right: null });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    rows.unshift({ type: 'equal', left: oldLines[x - 1], right: newLines[y - 1] });
    x -= 1;
    y -= 1;
  }
  while (x > 0) {
    rows.unshift({ type: 'delete', left: oldLines[x - 1], right: null });
    x -= 1;
  }
  while (y > 0) {
    rows.unshift({ type: 'insert', left: null, right: newLines[y - 1] });
    y -= 1;
  }

  return rows;
};

const pairChangeRows = (rows: RawDiffRow[]): Array<Pick<DiffRow, 'type' | 'left' | 'right'>> => {
  const paired: Array<Pick<DiffRow, 'type' | 'left' | 'right'>> = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    if (row.type === 'equal') {
      paired.push({ type: 'equal', left: row.left, right: row.right });
      index += 1;
      continue;
    }

    const deleted: string[] = [];
    const inserted: string[] = [];
    while (index < rows.length && rows[index].type !== 'equal') {
      const change = rows[index];
      if (change.type === 'delete' && change.left !== null) {
        deleted.push(change.left);
      }
      if (change.type === 'insert' && change.right !== null) {
        inserted.push(change.right);
      }
      index += 1;
    }

    const max = Math.max(deleted.length, inserted.length);
    for (let i = 0; i < max; i += 1) {
      const left = deleted[i] ?? null;
      const right = inserted[i] ?? null;
      if (left !== null && right !== null) {
        paired.push({ type: 'replace', left, right });
      } else if (left !== null) {
        paired.push({ type: 'delete', left, right: null });
      } else {
        paired.push({ type: 'insert', left: null, right });
      }
    }
  }

  return paired;
};

const addDiffLineNumbers = (
  rows: Array<Pick<DiffRow, 'type' | 'left' | 'right'>>,
): DiffRow[] => {
  let leftLine = 1;
  let rightLine = 1;

  return rows.map(row => {
    const next: DiffRow = {
      ...row,
      leftLine: row.left === null ? null : leftLine,
      rightLine: row.right === null ? null : rightLine,
    };

    if (row.left !== null) {
      leftLine += 1;
    }
    if (row.right !== null) {
      rightLine += 1;
    }

    return next;
  });
};

const buildAdminHeaders = (token: string): HeadersInit => ({
  'X-Operit-Admin-Token': token.trim(),
});

const OperitSubmissionAdminPage: React.FC<OperitSubmissionAdminPageProps> = ({ language }) => {
  const languageKey = translations[language] ? language : 'zh';
  const t = translations[languageKey].admin;
  const navigate = useNavigate();
  const [apiBase] = useState('https://api.aaswordsman.org');
  const [docsBase] = useState(DEFAULT_DOCS_BASE);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(STORAGE.adminToken) || '');
  const [authUser, setAuthUser] = useState<AdminAuthUser | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubmissionItem | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffSource, setDiffSource] = useState<string | null>(null);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [ipBanModalOpen, setIpBanModalOpen] = useState(false);
  const [ipBanForm, setIpBanForm] = useState({
    submissionId: '',
    ip: '',
    reason: '',
    notes: '',
    days: 0,
  });
  const [ipBans, setIpBans] = useState<IpBanItem[]>([]);
  const [ipBanLoading, setIpBanLoading] = useState(false);
  const [ipBanListLoading, setIpBanListLoading] = useState(false);
  const [ipBanError, setIpBanError] = useState<string | null>(null);

  const reviewerName = (authUser?.display_name || authUser?.username || '').trim();

  useEffect(() => {
    if (adminToken) {
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
    return { response, data, text };
  }, []);

  const loadAdminProfile = useCallback(async (token: string) => {
    if (!token.trim()) {
      setAuthUser(null);
      return false;
    }
    try {
      const { response, data } = await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/auth/me`, {
        headers: buildAdminHeaders(token),
      });
      if (!response.ok) {
        setAuthUser(null);
        return false;
      }
      const user = (data as { user?: AdminAuthUser })?.user || null;
      setAuthUser(user);
      return true;
    } catch {
      setAuthUser(null);
      return false;
    }
  }, [apiBase, fetchJson]);

  useEffect(() => {
    if (!adminToken.trim()) {
      setAuthUser(null);
      navigate('/operit-login?next=/operit-submission-admin', { replace: true });
      return;
    }
    let active = true;
    loadAdminProfile(adminToken).then(ok => {
      if (!active) return;
      if (!ok) {
        setAdminToken('');
        navigate('/operit-login?next=/operit-submission-admin', { replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [adminToken, loadAdminProfile, navigate]);

  const loadOriginalContent = useCallback(
    async (targetPath?: string, type?: 'add' | 'edit') => {
      if (!targetPath) {
        setOriginalContent(null);
        setDiffError(null);
        setDiffSource(null);
        return;
      }
      const urls = [];
      if (docsBase.trim()) {
        urls.push(buildDocUrl(docsBase, targetPath));
      }
      urls.push(buildGithubRawUrl(targetPath));

      setDiffLoading(true);
      setDiffError(null);
      setDiffSource(null);

      let notFound = false;
      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok) {
            const text = await response.text();
            setOriginalContent(text);
            setDiffSource(url);
            setDiffLoading(false);
            return;
          }
          if (response.status === 404) {
            notFound = true;
          }
        } catch {
          // ignore and try next source
        }
      }

      if (type === 'add' && notFound) {
        setOriginalContent('');
        setDiffError(null);
      } else {
        setOriginalContent(null);
        setDiffError(t.diffFetchFailed);
      }
      setDiffLoading(false);
    },
    [docsBase, t.diffFetchFailed],
  );

  const openIpBanModal = (submissionId?: string) => {
    setIpBanForm(prev => ({
      ...prev,
      submissionId: submissionId || prev.submissionId,
    }));
    setIpBanModalOpen(true);
  };

  const loadIpBans = useCallback(async () => {
    if (!adminToken.trim()) {
      setIpBanError(t.errorTokenRequired);
      return;
    }
    setIpBanListLoading(true);
    setIpBanError(null);
    try {
      const url = new URL(`${apiBase.replace(/\/+$/, '')}/api/admin/ip-bans`);
      url.searchParams.set('limit', '100');
      const { response, data } = await fetchJson(url.toString(), {
        headers: buildAdminHeaders(adminToken),
      });
      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || t.ipBanLoadFailed);
      }
      const list = (data as { items?: IpBanItem[] })?.items || [];
      setIpBans(list);
    } catch (err) {
      setIpBanError((err as Error).message || t.ipBanLoadFailed);
    } finally {
      setIpBanListLoading(false);
    }
  }, [adminToken, apiBase, fetchJson, t]);

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
    setAdminToken('');
    setAuthUser(null);
    setItems([]);
    setSelectedItem(null);
    setDetailOpen(false);
    localStorage.removeItem(STORAGE.adminToken);
    message.success('Logged out');
    navigate('/operit-login?next=/operit-submission-admin', { replace: true });
  }, [adminToken, apiBase, fetchJson, navigate, t]);

  const createIpBan = useCallback(async () => {
    if (!adminToken.trim()) {
      setIpBanError(t.errorTokenRequired);
      return;
    }
    if (!ipBanForm.submissionId.trim() && !ipBanForm.ip.trim()) {
      message.error(t.ipBanTargetRequired);
      return;
    }
    const days = Number(ipBanForm.days || 0);
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : undefined;
    setIpBanLoading(true);
    try {
      const url = `${apiBase.replace(/\/+$/, '')}/api/admin/ip-bans`;
      const payload = {
        submission_id: ipBanForm.submissionId.trim() || undefined,
        ip: ipBanForm.ip.trim() || undefined,
        reason: ipBanForm.reason.trim() || undefined,
        notes: ipBanForm.notes.trim() || undefined,
        banned_by: reviewerName || undefined,
        expires_at: expiresAt,
      };
      const { response, data } = await fetchJson(url, {
        method: 'POST',
        headers: {
          ...buildAdminHeaders(adminToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || t.ipBanFailed);
      }
      message.success(t.ipBanSuccess);
      setIpBanModalOpen(false);
      setIpBanForm(prev => ({
        ...prev,
        submissionId: '',
        ip: '',
        reason: '',
        notes: '',
        days: 0,
      }));
      loadIpBans();
    } catch (err) {
      message.error((err as Error).message || t.ipBanFailed);
    } finally {
      setIpBanLoading(false);
    }
  }, [adminToken, apiBase, fetchJson, ipBanForm, reviewerName, t, loadIpBans]);

  const deleteIpBan = useCallback(async (ipHash: string) => {
    if (!adminToken.trim()) {
      setIpBanError(t.errorTokenRequired);
      return;
    }
    try {
      const url = `${apiBase.replace(/\/+$/, '')}/api/admin/ip-bans/${encodeURIComponent(ipHash)}`;
      const { response, data } = await fetchJson(url, {
        method: 'POST',
        headers: buildAdminHeaders(adminToken),
      });
      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || t.ipUnbanFailed);
      }
      message.success(t.ipUnbanSuccess);
      setIpBans(prev => prev.filter(item => item.ip_hash !== ipHash));
    } catch (err) {
      message.error((err as Error).message || t.ipUnbanFailed);
    }
  }, [adminToken, apiBase, fetchJson, t]);

  const loadSubmissions = useCallback(async () => {
    if (!adminToken.trim()) {
      setError(t.errorTokenRequired);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${apiBase.replace(/\/+$/, '')}/api/admin/submissions`);
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter);
      }
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));

      const { response, data } = await fetchJson(url.toString(), {
        headers: buildAdminHeaders(adminToken),
      });

      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || t.messageRequestFailed);
      }

      const list = (data as { items?: SubmissionItem[] })?.items || [];
      setItems(list);
    } catch (err) {
      setError((err as Error).message || t.messageRequestFailed);
    } finally {
      setLoading(false);
    }
  }, [adminToken, apiBase, fetchJson, limit, offset, statusFilter, t]);

  const openDetail = useCallback(
    async (item: SubmissionItem) => {
      if (!adminToken.trim()) {
        setError(t.errorTokenRequired);
        return;
      }

      setDetailOpen(true);
      setDetailLoading(true);
      setSelectedItem(null);

      try {
        const url = `${apiBase.replace(/\/+$/, '')}/api/admin/submissions/${item.id}`;
        const { response, data } = await fetchJson(url, {
          headers: buildAdminHeaders(adminToken),
        });

        if (!response.ok) {
          const apiError = (data as { error?: string })?.error || response.statusText;
          throw new Error(apiError || t.messageRequestFailed);
        }

        const detail = (data as { item?: SubmissionItem })?.item || null;
        setSelectedItem(detail);
      } catch (err) {
        message.error((err as Error).message || t.messageRequestFailed);
      } finally {
        setDetailLoading(false);
      }
    },
    [adminToken, apiBase, fetchJson, t],
  );

  useEffect(() => {
    if (!selectedItem?.target_path) {
      setOriginalContent(null);
      setDiffError(null);
      setDiffSource(null);
      return;
    }
    loadOriginalContent(selectedItem.target_path, selectedItem.type);
  }, [loadOriginalContent, selectedItem?.target_path, selectedItem?.type]);

  const triggerAction = (item: SubmissionItem, type: 'approve' | 'reject') => {
    setActionType(type);
    setActionNotes('');
    setSelectedItem(item);
    setActionOpen(true);
  };

  const executeAction = useCallback(async () => {
    if (!selectedItem) return;
    if (actionSubmitting) return;
    if (!adminToken.trim()) {
      setError(t.errorTokenRequired);
      return;
    }

    const nextStatus = actionType === 'approve' ? 'approved' : 'rejected';
    const payload = {
      reviewer: reviewerName || undefined,
      review_notes: actionNotes.trim() || undefined,
    };

    setActionSubmitting(true);
    try {
      const url = `${apiBase.replace(/\/+$/, '')}/api/admin/submissions/${selectedItem.id}/${actionType}`;
      const { response, data } = await fetchJson(url, {
        method: 'POST',
        headers: {
          ...buildAdminHeaders(adminToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || t.messageRequestFailed);
      }

      const reviewedAt = (data as { reviewed_at?: string })?.reviewed_at || new Date().toISOString();
      const pr = (data as { pr?: SubmissionPrInfo })?.pr;
      const prInfo = pr
        ? {
            pr_number: pr.number ?? null,
            pr_url: pr.url ?? null,
            pr_branch: pr.branch ?? null,
            pr_state: pr.status ?? null,
            pr_created_at: pr.created_at ?? null,
            pr_error: pr.error ?? null,
          }
        : {};

      setItems(prev =>
        prev.flatMap(entry => {
          if (entry.id !== selectedItem.id) return [entry];
          if (statusFilter !== 'all' && statusFilter !== nextStatus) return [];
          return [
            {
              ...entry,
              status: nextStatus,
              reviewed_at: reviewedAt,
              reviewer: reviewerName || entry.reviewer,
              review_notes: actionNotes || entry.review_notes,
              ...prInfo,
            },
          ];
        }),
      );

      setSelectedItem(prev => {
        if (!prev || prev.id !== selectedItem.id) return prev;
        return {
          ...prev,
          status: nextStatus,
          reviewed_at: reviewedAt,
          reviewer: reviewerName || prev.reviewer,
          review_notes: actionNotes || prev.review_notes,
          ...prInfo,
        };
      });

      message.success(actionType === 'approve' ? t.messageApproved : t.messageRejected);
      if (pr?.status === 'failed') {
        message.warning(t.messagePrFailed);
      }
      setActionOpen(false);
      if (statusFilter !== 'all') {
        await loadSubmissions();
      }
    } catch (err) {
      message.error((err as Error).message || t.messageActionFailed);
    } finally {
      setActionSubmitting(false);
    }
  }, [
    actionNotes,
    actionSubmitting,
    actionType,
    adminToken,
    apiBase,
    fetchJson,
    reviewerName,
    selectedItem,
    statusFilter,
    t,
    loadSubmissions,
  ]);

  const statusOptions = useMemo(
    () => [
      { label: t.statusPending, value: 'pending' },
      { label: t.statusApproved, value: 'approved' },
      { label: t.statusRejected, value: 'rejected' },
      { label: t.statusAll, value: 'all' },
    ],
    [t],
  );

  const statusLabels: Record<SubmissionStatus, string> = {
    pending: t.statusPending,
    approved: t.statusApproved,
    rejected: t.statusRejected,
  };

  const typeLabels: Record<'add' | 'edit', string> = {
    add: t.typeAdd,
    edit: t.typeEdit,
  };

  const diffRows = useMemo(() => {
    if (originalContent === null || !selectedItem?.content) return null;
    const oldLines = splitLines(originalContent);
    const newLines = splitLines(selectedItem.content);
    if (oldLines.length + newLines.length > DIFF_MAX_LINES) {
      return { tooLarge: true, rows: [] as DiffRow[] };
    }
    const trace = buildLineDiff(oldLines, newLines);
    const rawRows = backtrackDiff(trace, oldLines, newLines);
    const pairedRows = pairChangeRows(rawRows);
    return { tooLarge: false, rows: addDiffLineNumbers(pairedRows) };
  }, [originalContent, selectedItem?.content]);

  const columns: ColumnsType<SubmissionItem> = [
    {
      title: t.statusLabel,
      dataIndex: 'status',
      width: 120,
      render: value => (
        <Tag color={statusColor[value as SubmissionStatus]}>
          {statusLabels[value as SubmissionStatus] || value}
        </Tag>
      ),
    },
    {
      title: t.typeLabel,
      dataIndex: 'type',
      width: 100,
      render: value => (
        <Tag color={typeColor[value as 'add' | 'edit']}>
          {typeLabels[value as 'add' | 'edit'] || value}
        </Tag>
      ),
    },
    {
      title: t.titleLabel,
      dataIndex: 'title',
      width: 260,
      ellipsis: true,
      render: (_, record) => (
        <Button type="link" onClick={() => openDetail(record)}>
          {record.title}
        </Button>
      ),
    },
    {
      title: t.pathLabel,
      dataIndex: 'target_path',
      width: 260,
      ellipsis: true,
      render: value => (
        <Text code style={{ whiteSpace: 'nowrap' }}>
          {value}
        </Text>
      ),
    },
    {
      title: t.languageLabel,
      dataIndex: 'language',
      width: 90,
      render: value => <Tag>{value}</Tag>,
    },
    {
      title: t.authorLabel,
      dataIndex: 'author_name',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text ellipsis>{record.author_name || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {record.author_email || ''}
          </Text>
        </Space>
      ),
    },
    {
      title: t.createdLabel,
      dataIndex: 'created_at',
      width: 180,
      render: value => formatDateTime(value),
    },
    {
      title: t.actionsLabel,
      dataIndex: 'actions',
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t.viewDetail}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          </Tooltip>
          <Tooltip title={t.approve}>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={actionSubmitting}
              onClick={() => triggerAction(record, 'approve')}
            />
          </Tooltip>
          <Tooltip title={t.reject}>
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              disabled={actionSubmitting}
              onClick={() => triggerAction(record, 'reject')}
            />
          </Tooltip>
          <Tooltip title={t.ipBanOpenAction}>
            <Button
              size="small"
              icon={<BlockOutlined />}
              onClick={() => openIpBanModal(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const ipBanColumns: ColumnsType<IpBanItem> = [
    {
      title: t.ipBanColumnIp,
      dataIndex: 'ip_hash',
      render: value => (
        <Text code style={{ whiteSpace: 'nowrap' }}>
          {value}
        </Text>
      ),
    },
    {
      title: t.ipBanColumnReason,
      dataIndex: 'reason',
      render: value => value || '-',
    },
    {
      title: t.ipBanColumnBy,
      dataIndex: 'banned_by',
      render: value => value || '-',
    },
    {
      title: t.ipBanColumnCreated,
      dataIndex: 'created_at',
      render: value => formatDateTime(value),
    },
    {
      title: t.ipBanColumnExpires,
      dataIndex: 'expires_at',
      render: value => (value ? formatDateTime(value) : t.ipBanPermanent),
    },
    {
      title: t.ipBanColumnActions,
      dataIndex: 'actions',
      width: 120,
      render: (_, record) => (
        <Button size="small" danger onClick={() => deleteIpBan(record.ip_hash)}>
          {t.ipUnban}
        </Button>
      ),
    },
  ];

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                {t.title}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t.subtitle}
              </Paragraph>
            </div>

            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} lg={12}>
                <Space>
                  <Tag color="blue">
                    Reviewer: {authUser?.display_name || authUser?.username || '-'}
                  </Tag>
                  <Tag color={authUser?.role === 'admin' ? 'red' : 'geekblue'}>
                    {authUser?.role || 'reviewer'}
                  </Tag>
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space>
                  <Tag color={adminToken.trim() ? 'green' : 'default'}>
                    {adminToken.trim() ? 'Logged in' : 'Not logged in'}
                  </Tag>
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space>
                  <Button
                    onClick={handleLogout}
                    disabled={!adminToken.trim()}
                  >
                    Logout
                  </Button>
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={loadSubmissions}
                    disabled={!adminToken.trim()}
                  >
                    {t.loadSubmissions}
                  </Button>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>

        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            message={t.errorTitle}
            description={error}
          />
        )}

        <Card style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]} align="middle" justify="space-between">
            <Col>
              <Segmented
                options={statusOptions}
                value={statusFilter}
                onChange={value => setStatusFilter(value as StatusFilter)}
              />
            </Col>
            <Col>
              <Space>
                <span>{t.limitLabel}</span>
                <InputNumber
                  min={1}
                  max={200}
                  value={limit}
                  onChange={value => setLimit(value || 1)}
                />
                <span>{t.offsetLabel}</span>
                <InputNumber
                  min={0}
                  max={10000}
                  value={offset}
                  onChange={value => setOffset(value || 0)}
                />
                <Button onClick={loadSubmissions} icon={<ReloadOutlined />}>
                  {t.refresh}
                </Button>
                {authUser && (
                  <Tag color="blue">
                    {authUser.display_name || authUser.username || 'admin'} ({authUser.role || 'admin'})
                  </Tag>
                )}
              </Space>
            </Col>
          </Row>

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 'max-content' }}
            tableLayout="fixed"
            style={{ marginTop: 16 }}
          />
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                {t.ipBanTitle}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t.ipBanSubtitle}
              </Paragraph>
            </div>
            <Space>
              <Button icon={<BlockOutlined />} onClick={() => openIpBanModal()}>
                {t.ipBanAction}
              </Button>
              <Button loading={ipBanListLoading} onClick={loadIpBans} icon={<ReloadOutlined />}>
                {t.ipBanLoad}
              </Button>
            </Space>
            {ipBanError && (
              <Alert type="error" showIcon message={t.ipBanLoadFailed} description={ipBanError} />
            )}
            <Table
              rowKey="ip_hash"
              loading={ipBanListLoading}
              columns={ipBanColumns}
              dataSource={ipBans}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Space>
        </Card>
      </Content>

      <Drawer
        title={t.detailTitle}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
      >
        {detailLoading && <Text type="secondary">{t.loading}</Text>}
        {!detailLoading && selectedItem && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={1}
              bordered
              labelStyle={{ width: 160 }}
            >
              <Descriptions.Item label={t.detailStatus}>
                <Tag color={statusColor[selectedItem.status]}>
                  {statusLabels[selectedItem.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t.detailType}>
                <Tag color={typeColor[selectedItem.type]}>{typeLabels[selectedItem.type]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t.detailLanguage}>
                <Tag>{selectedItem.language}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t.detailTitleLabel}>{selectedItem.title}</Descriptions.Item>
              <Descriptions.Item label={t.detailTargetPath}>
                <Text code>{selectedItem.target_path}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t.detailAuthor}>
                <Space direction="vertical" size={0}>
                  <Text>{selectedItem.author_name || '-'}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedItem.author_email || ''}
                  </Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t.detailCreated}>
                {formatDateTime(selectedItem.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label={t.detailReviewed}>
                {formatDateTime(selectedItem.reviewed_at)}
              </Descriptions.Item>
              <Descriptions.Item label={t.detailReviewer}>
                {selectedItem.reviewer || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t.detailPr}>
                {selectedItem.pr_url ? (
                  <Link href={selectedItem.pr_url} target="_blank" rel="noreferrer">
                    #{selectedItem.pr_number || 'PR'}
                  </Link>
                ) : selectedItem.pr_state === 'failed' ? (
                  <Text type="danger">{t.prStatusFailed}</Text>
                ) : selectedItem.pr_state === 'skipped' ? (
                  <Text type="secondary">{t.prStatusSkipped}</Text>
                ) : selectedItem.pr_state === 'created' ? (
                  <Text type="secondary">{t.prStatusCreated}</Text>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t.detailPrBranch}>
                {selectedItem.pr_branch ? (
                  <Text code>{selectedItem.pr_branch}</Text>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              {selectedItem.pr_error && (
                <Descriptions.Item label={t.detailPrError}>
                  <Text type="danger">{selectedItem.pr_error}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            <div>
              <Title level={5}>{t.detailContent}</Title>
              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: 16,
                  background: 'rgba(0,0,0,0.02)',
                  maxHeight: 360,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                {selectedItem.content || '-'}
              </div>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              <Space align="center" style={{ marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {t.detailDiffTitle}
                </Title>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => loadOriginalContent(selectedItem.target_path, selectedItem.type)}
                >
                  {t.diffReload}
                </Button>
              </Space>
              {diffSource && (
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  {t.diffSourceLabel}: <Text code>{diffSource}</Text>
                </Paragraph>
              )}
              {diffError && (
                <Alert
                  type="warning"
                  showIcon
                  message={t.diffFetchFailed}
                  description={diffError}
                  style={{ marginBottom: 12 }}
                />
              )}
              {diffLoading && <Text type="secondary">{t.diffLoading}</Text>}
              {!diffLoading && selectedItem.content && originalContent === null && !diffError && (
                <Text type="secondary">{t.diffMissingOriginal}</Text>
              )}
              {!diffLoading && !selectedItem.content && (
                <Text type="secondary">{t.diffMissingContent}</Text>
              )}
              {!diffLoading && diffRows?.tooLarge && (
                <Text type="secondary">{t.diffTooLarge}</Text>
              )}
              {!diffLoading && diffRows && !diffRows.tooLarge && (
                <div
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      background: 'rgba(0,0,0,0.2)',
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ padding: '6px 10px' }}>{t.diffOriginalLabel}</div>
                    <div style={{ padding: '6px 10px' }}>{t.diffSubmittedLabel}</div>
                  </div>
                  <div style={{ maxHeight: 360, overflow: 'auto' }}>
                    {diffRows.rows.map((row, index) => {
                      const leftBg =
                        row.type === 'delete' || row.type === 'replace'
                          ? 'rgba(255,77,79,0.16)'
                          : 'transparent';
                      const rightBg =
                        row.type === 'insert' || row.type === 'replace'
                          ? 'rgba(82,196,26,0.16)'
                          : 'transparent';
                      const rowBg = row.type === 'equal' ? 'transparent' : 'rgba(255,255,255,0.02)';
                      return (
                        <div
                          key={`${row.type}-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            background: rowBg,
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              padding: '4px 10px',
                              background: leftBg,
                              whiteSpace: 'pre-wrap',
                              display: 'grid',
                              gridTemplateColumns: '44px 1fr',
                              columnGap: 8,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 11, userSelect: 'none' }}>
                              {row.leftLine ?? ''}
                            </Text>
                            <span>{row.left ?? ''}</span>
                          </div>
                          <div
                            style={{
                              padding: '4px 10px',
                              background: rightBg,
                              whiteSpace: 'pre-wrap',
                              display: 'grid',
                              gridTemplateColumns: '44px 1fr',
                              columnGap: 8,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 11, userSelect: 'none' }}>
                              {row.rightLine ?? ''}
                            </Text>
                            <span>{row.right ?? ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Title level={5}>{t.detailReviewNotes}</Title>
              <Text>{selectedItem.review_notes || '-'}</Text>
            </div>

            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => triggerAction(selectedItem, 'approve')}
              >
                {t.approve}
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => triggerAction(selectedItem, 'reject')}
              >
                {t.reject}
              </Button>
              <Button
                icon={<BlockOutlined />}
                onClick={() => openIpBanModal(selectedItem.id)}
              >
                {t.ipBanOpenAction}
              </Button>
            </Space>
          </Space>
        )}
      </Drawer>

      <Modal
        title={actionType === 'approve' ? t.modalTitleApprove : t.modalTitleReject}
        open={actionOpen}
        onCancel={() => setActionOpen(false)}
        onOk={executeAction}
        okText={actionType === 'approve' ? t.approve : t.reject}
        okButtonProps={{ danger: actionType === 'reject', loading: actionSubmitting }}
        confirmLoading={actionSubmitting}
        cancelButtonProps={{ disabled: actionSubmitting }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text>
            {t.modalTargetLabel}: <Text code>{selectedItem?.title || '-'}</Text>
          </Text>
          <Text type="secondary">
            Reviewer: {reviewerName || '-'}
          </Text>
          <Input.TextArea
            rows={4}
            value={actionNotes}
            onChange={event => setActionNotes(event.target.value)}
            placeholder={t.modalNotesPlaceholder}
          />
        </Space>
      </Modal>

      <Modal
        title={t.ipBanTitle}
        open={ipBanModalOpen}
        onCancel={() => setIpBanModalOpen(false)}
        onOk={createIpBan}
        okText={t.ipBanAction}
        confirmLoading={ipBanLoading}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            value={ipBanForm.submissionId}
            onChange={event => setIpBanForm(prev => ({ ...prev, submissionId: event.target.value }))}
            placeholder={t.ipBanTargetLabel}
          />
          <Input
            value={ipBanForm.ip}
            onChange={event => setIpBanForm(prev => ({ ...prev, ip: event.target.value }))}
            placeholder={t.ipBanIpLabel}
          />
          <Input
            value={ipBanForm.reason}
            onChange={event => setIpBanForm(prev => ({ ...prev, reason: event.target.value }))}
            placeholder={t.ipBanReasonLabel}
          />
          <Input.TextArea
            rows={3}
            value={ipBanForm.notes}
            onChange={event => setIpBanForm(prev => ({ ...prev, notes: event.target.value }))}
            placeholder={t.ipBanNotesLabel}
          />
          <InputNumber
            min={0}
            max={3650}
            value={ipBanForm.days}
            onChange={value => setIpBanForm(prev => ({ ...prev, days: Number(value || 0) }))}
            style={{ width: '100%' }}
            placeholder={t.ipBanDaysLabel}
          />
          <Text type="secondary">{t.ipBanDaysLabel}</Text>
        </Space>
      </Modal>
    </main>
  );
};

export default OperitSubmissionAdminPage;
