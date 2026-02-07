import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Grid,
  Input,
  Layout,
  List,
  Modal,
  Row,
  Segmented,
  Slider,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { DownloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import TurnstileWidget from '../components/TurnstileWidget';
import { translations } from '../translations';
import {
  clearOperitLocalData,
  deleteOperitDraft,
  exportOperitLocalData,
  getOperitHistory,
  getOperitLeaderboard,
  getOperitProfile,
  getOperitProgress,
  getOperitTemplates,
  importOperitLocalData,
  listOperitDrafts,
  saveOperitLeaderboard,
  saveOperitProfile,
  saveOperitHistory,
  saveOperitProgress,
  saveOperitTemplates,
  type OperitDraft,
  type OperitHistoryEntry,
  type OperitLeaderboardEntry,
  type OperitLeaderboardCache,
  type OperitProfile,
  type OperitProgressEntry,
  type OperitTemplate,
} from '../utils/operitLocalStore';

const { Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

interface OperitSubmissionCenterPageProps {
  language: 'zh' | 'en';
}

interface AdminAuthUser {
  username: string;
  display_name?: string | null;
  role?: string | null;
  owner?: boolean;
}

type MobileSectionGroup = 'account' | 'workbench' | 'resources' | 'system';
type MobileSectionLeaf =
  | 'profile'
  | 'lookup'
  | 'progress'
  | 'drafts'
  | 'history'
  | 'leaderboard'
  | 'templates'
  | 'data';

const formatDateTime = (value: string) => new Date(value).toLocaleString();
const LEADERBOARD_TTL_MS = 12 * 60 * 60 * 1000;
const STORAGE = {
  adminToken: 'operit_submission_admin_token',
};

const MOBILE_GROUP_TO_SECTIONS: Record<MobileSectionGroup, MobileSectionLeaf[]> = {
  account: ['profile', 'lookup'],
  workbench: ['progress', 'drafts', 'history'],
  resources: ['leaderboard', 'templates'],
  system: ['data'],
};

const LEFT_COLUMN_SECTIONS: MobileSectionLeaf[] = ['profile', 'lookup', 'progress', 'drafts'];
const RIGHT_COLUMN_SECTIONS: MobileSectionLeaf[] = ['history', 'leaderboard', 'templates', 'data'];

const OperitSubmissionCenterPage: React.FC<OperitSubmissionCenterPageProps> = ({ language }) => {
  const t = translations[language].submissionCenter;
  const isZh = language === 'zh';
  const screens = useBreakpoint();
  const isMobileLayout = !screens.md;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBase = localStorage.getItem('operit_submission_admin_api_base') || 'https://api.aaswordsman.org';

  const [profile, setProfile] = useState<OperitProfile>(() => getOperitProfile());
  const [drafts, setDrafts] = useState<OperitDraft[]>(() => listOperitDrafts());
  const [history, setHistory] = useState<OperitHistoryEntry[]>(() => getOperitHistory());
  const [progress, setProgress] = useState<Record<string, OperitProgressEntry>>(() => getOperitProgress());
  const [templates, setTemplates] = useState<OperitTemplate[]>(() => getOperitTemplates());
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupBan, setLookupBan] = useState<{
    reason?: string | null;
    expires_at?: string | null;
    created_at?: string | null;
    banned_by?: string | null;
    notes?: string | null;
  } | null>(null);
  const [lookupResult, setLookupResult] = useState<{
    items: Array<{
      id: string;
      title: string;
      target_path: string;
      language: string;
      status: string;
      created_at: string;
      reviewed_at: string | null;
    }>;
    counts: { total: number; pending: number; approved: number; rejected: number };
    last_reviewed_at: string | null;
  } | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [lookupExpanded, setLookupExpanded] = useState(false);
  const [lookupVerifyOpen, setLookupVerifyOpen] = useState(false);

  const [leaderboardItems, setLeaderboardItems] = useState<OperitLeaderboardEntry[]>([]);
  const [leaderboardUpdatedAt, setLeaderboardUpdatedAt] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [adminAuthUser, setAdminAuthUser] = useState<AdminAuthUser | null>(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminLogoutLoading, setAdminLogoutLoading] = useState(false);
  const [mobileSectionGroup, setMobileSectionGroup] = useState<MobileSectionGroup>('account');
  const [mobileSectionLeaf, setMobileSectionLeaf] = useState<MobileSectionLeaf>('profile');

  const canOpenAdminReview = Boolean(adminAuthUser && (adminAuthUser.role === 'admin' || adminAuthUser.owner));

  const mobileGroupOptions = useMemo(
    () => [
      { label: isZh ? '账户' : 'Account', value: 'account' },
      { label: isZh ? '创作' : 'Creation', value: 'workbench' },
      { label: isZh ? '资源' : 'Resources', value: 'resources' },
      { label: isZh ? '系统' : 'System', value: 'system' },
    ],
    [isZh],
  );

  const mobileLeafOptionsMap = useMemo(
    () => ({
      account: [
        { label: t.profileTitle, value: 'profile' },
        { label: t.lookupTitle, value: 'lookup' },
      ],
      workbench: [
        { label: t.progressTitle, value: 'progress' },
        { label: t.draftTitle, value: 'drafts' },
        { label: t.historyTitle, value: 'history' },
      ],
      resources: [
        { label: t.leaderboardTitle, value: 'leaderboard' },
        { label: t.templateTitle, value: 'templates' },
      ],
      system: [{ label: t.dataTitle, value: 'data' }],
    }),
    [t],
  );

  const showSection = useCallback(
    (section: MobileSectionLeaf) => !isMobileLayout || mobileSectionLeaf === section,
    [isMobileLayout, mobileSectionLeaf],
  );

  const showLeftColumn = !isMobileLayout || LEFT_COLUMN_SECTIONS.includes(mobileSectionLeaf);
  const showRightColumn = !isMobileLayout || RIGHT_COLUMN_SECTIONS.includes(mobileSectionLeaf);

  const progressItems = useMemo(
    () =>
      Object.entries(progress).sort(([, a], [, b]) =>
        (b.updated_at || '').localeCompare(a.updated_at || ''),
      ),
    [progress],
  );

  useEffect(() => {
    saveOperitProfile(profile);
  }, [profile]);

  useEffect(() => {
    const allowedLeaves = MOBILE_GROUP_TO_SECTIONS[mobileSectionGroup];
    if (!allowedLeaves.includes(mobileSectionLeaf)) {
      setMobileSectionLeaf(allowedLeaves[0]);
    }
  }, [mobileSectionGroup, mobileSectionLeaf]);

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase.replace(/\/+$/, '')}/api/config`);
      if (!response.ok) return;
      const data = await response.json();
      if (data?.turnstile_site_key) {
        setSiteKey(data.turnstile_site_key);
      }
    } catch {
      setSiteKey('');
    }
  }, [apiBase]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const cached = getOperitLeaderboard();
    if (cached?.items?.length) {
      setLeaderboardItems(cached.items);
      setLeaderboardUpdatedAt(cached.updated_at || null);
    }
  }, []);

  useEffect(() => {
    const token = (localStorage.getItem(STORAGE.adminToken) || '').trim();
    if (!token) {
      setAdminAuthUser(null);
      setAdminAuthLoading(false);
      return;
    }

    let cancelled = false;
    setAdminAuthLoading(true);

    fetch(`${apiBase.replace(/\/+$/, '')}/api/admin/auth/me`, {
      headers: {
        'X-Operit-Admin-Token': token,
      },
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error('auth_invalid');
        }
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        setAdminAuthUser((data as { user?: AdminAuthUser })?.user || null);
      })
      .catch(() => {
        if (cancelled) return;
        setAdminAuthUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setAdminAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const refreshAll = () => {
    setProfile(getOperitProfile());
    setDrafts(listOperitDrafts());
    setHistory(getOperitHistory());
    setProgress(getOperitProgress());
    setTemplates(getOperitTemplates());
    const cached = getOperitLeaderboard();
    if (cached?.items?.length) {
      setLeaderboardItems(cached.items);
      setLeaderboardUpdatedAt(cached.updated_at || null);
    }
  };

  const handleAdminLogout = useCallback(async () => {
    const token = (localStorage.getItem(STORAGE.adminToken) || '').trim();
    setAdminLogoutLoading(true);
    try {
      if (token) {
        await fetch(`${apiBase.replace(/\/+$/, '')}/api/admin/auth/logout`, {
          method: 'POST',
          headers: {
            'X-Operit-Admin-Token': token,
          },
        });
      }
    } catch {
      // ignore logout request failures
    } finally {
      localStorage.removeItem(STORAGE.adminToken);
      setAdminAuthUser(null);
      setAdminAuthLoading(false);
      setAdminLogoutLoading(false);
      message.success(isZh ? '退出登录成功' : 'Signed out successfully');
    }
  }, [apiBase, isZh]);

  const handleOpenDraft = (draft: OperitDraft) => {
    navigate(`/operit-submission-edit?path=${encodeURIComponent(draft.target_path)}`);
  };

  const handleDeleteDraft = (draft: OperitDraft) => {
    deleteOperitDraft(draft.target_path);
    setDrafts(listOperitDrafts());
  };

  const handleDeleteHistory = () => {
    setClearHistoryOpen(true);
  };

  const handleExport = () => {
    const payload = JSON.stringify(exportOperitLocalData(), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'operit_submission_local.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importOperitLocalData(data);
      message.success(t.importSuccess);
      refreshAll();
    } catch {
      message.error(t.importFailed);
    } finally {
      event.target.value = '';
    }
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: t.clearAllTitle,
      content: t.clearAllHint,
      okText: t.confirm,
      cancelText: t.cancel,
      onOk: () => {
        clearOperitLocalData();
        refreshAll();
      },
    });
  };

  const handleAddTemplate = () => {
    if (!templateTitle.trim() || !templateContent.trim()) {
      message.error(t.templateMissing);
      return;
    }
    const next: OperitTemplate[] = [
      {
        id: `tmpl-${Date.now()}`,
        title: templateTitle.trim(),
        content: templateContent.trim(),
        updated_at: new Date().toISOString(),
      },
      ...templates,
    ].slice(0, 50);
    saveOperitTemplates(next);
    setTemplates(next);
    setTemplateTitle('');
    setTemplateContent('');
  };

  const handleRemoveTemplate = (item: OperitTemplate) => {
    const next = templates.filter(template => template.id !== item.id);
    saveOperitTemplates(next);
    setTemplates(next);
  };

  const statusTag = (status: string) => {
    if (status === 'pending') return <Tag color="gold">{t.statusPending}</Tag>;
    if (status === 'approved') return <Tag color="green">{t.statusApproved}</Tag>;
    if (status === 'rejected') return <Tag color="red">{t.statusRejected}</Tag>;
    if (status === 'submitted') return <Tag color="gold">{t.statusSubmitted}</Tag>;
    if (status === 'edited') return <Tag color="blue">{t.statusEdited}</Tag>;
    return <Tag>{status}</Tag>;
  };

  const formatStatusText = (status: string) => {
    if (status === 'pending') return t.statusPending;
    if (status === 'approved') return t.statusApproved;
    if (status === 'rejected') return t.statusRejected;
    if (status === 'submitted') return t.statusSubmitted;
    if (status === 'edited') return t.statusEdited;
    return status;
  };

  const loadLeaderboard = useCallback(async (force?: boolean) => {
    if (leaderboardLoading) return;
    const cached = getOperitLeaderboard();
    if (!force && cached?.updated_at) {
      const cachedTime = new Date(cached.updated_at).getTime();
      if (!Number.isNaN(cachedTime) && Date.now() - cachedTime < LEADERBOARD_TTL_MS) {
        setLeaderboardItems(cached.items || []);
        setLeaderboardUpdatedAt(cached.updated_at || null);
        return;
      }
    }

    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const url = new URL(`${apiBase.replace(/\/+$/, '')}/api/submissions/leaderboard`);
      url.searchParams.set('limit', '20');
      const response = await fetch(url.toString());
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || t.leaderboardLoadFailed);
      }
      const items = (data?.items || []) as OperitLeaderboardEntry[];
      const updatedAt = data?.generated_at || new Date().toISOString();
      const cache: OperitLeaderboardCache = { updated_at: updatedAt, items };
      saveOperitLeaderboard(cache);
      setLeaderboardItems(items);
      setLeaderboardUpdatedAt(updatedAt);
    } catch (err) {
      setLeaderboardError((err as Error).message || t.leaderboardLoadFailed);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [apiBase, leaderboardLoading, t.leaderboardLoadFailed]);

  const maskEmail = (email?: string | null) => {
    if (!email) return '-';
    const [local, domain] = email.split('@');
    if (!domain) return `${local?.[0] || '*'}***`;
    const domainParts = domain.split('.');
    const domainHead = domainParts[0] || '';
    const tail = domainParts.length > 1 ? `.${domainParts.slice(1).join('.')}` : '';
    const maskedLocal = local ? `${local[0]}***` : '*';
    const maskedDomain = domainHead ? `${domainHead[0]}***` : '*';
    return `${maskedLocal}@${maskedDomain}${tail}`;
  };

  useEffect(() => {
    loadLeaderboard(false);
  }, [loadLeaderboard]);

  const syncLocalWithLookup = useCallback((items: Array<{
    id: string;
    title: string;
    target_path: string;
    language: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
  }>) => {
    if (!items.length) return;

    const byId = new Map(items.map(item => [item.id, item]));

    const historyNext = getOperitHistory().map(entry => {
      const match = byId.get(entry.id);
      if (!match) return entry;
      return {
        ...entry,
        status: match.status || entry.status,
        created_at: match.created_at || entry.created_at,
        reviewed_at: match.reviewed_at || entry.reviewed_at,
      };
    });
    saveOperitHistory(historyNext);
    setHistory(historyNext);

    const progressNext = getOperitProgress();
    let progressChanged = false;
    items.forEach(item => {
      if (!item.target_path) return;
      const updatedAt = item.reviewed_at || item.created_at || new Date().toISOString();
      const existing = progressNext[item.target_path];
      const nextStatus = item.status as OperitProgressEntry['status'];
      const nextTitle = item.title || existing?.title || item.target_path;
      if (!existing || existing.status !== nextStatus || existing.updated_at !== updatedAt || existing.title !== nextTitle) {
        progressNext[item.target_path] = {
          status: nextStatus,
          updated_at: updatedAt,
          title: nextTitle,
        };
        progressChanged = true;
      }
    });
    if (progressChanged) {
      saveOperitProgress(progressNext);
      setProgress(progressNext);
    }
  }, []);

  const handleLookup = async (token: string) => {
    const authorName = profile.authorName.trim();
    const authorEmail = profile.authorEmail.trim();

    if (!authorName && !authorEmail) {
      message.error(t.lookupRequireIdentity);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupBan(null);
    try {
      const response = await fetch(`${apiBase.replace(/\/+$/, '')}/api/submissions/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName || undefined,
          author_email: authorEmail || undefined,
          turnstile_token: token,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || t.lookupFailed);
      }
      setLookupResult({
        items: data?.items || [],
        counts: data?.counts || { total: 0, pending: 0, approved: 0, rejected: 0 },
        last_reviewed_at: data?.last_reviewed_at || null,
      });
      setLookupExpanded(false);
      setLookupBan(data?.ip_ban || null);
      if (Array.isArray(data?.items)) {
        syncLocalWithLookup(data.items);
      }
      setTurnstileResetKey(prev => prev + 1);
    } catch (err) {
      setLookupError((err as Error).message || t.lookupFailed);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                {t.title}
              </Title>
              <Text type="secondary">{t.subtitle}</Text>
            </div>
            <Alert showIcon type="info" message={t.localNotice} />
            {isMobileLayout && (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Segmented
                  block
                  options={mobileGroupOptions}
                  value={mobileSectionGroup}
                  onChange={value => setMobileSectionGroup(value as MobileSectionGroup)}
                />
                <Segmented
                  block
                  options={mobileLeafOptionsMap[mobileSectionGroup]}
                  value={mobileSectionLeaf}
                  onChange={value => setMobileSectionLeaf(value as MobileSectionLeaf)}
                />
              </Space>
            )}
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Space wrap>
                <Button onClick={() => navigate('/operit-login?next=/operit-submission-center')}>
                  {adminAuthUser ? (isZh ? '切换登录' : 'Switch sign-in') : (isZh ? '登录' : 'Sign in')}
                </Button>
                {adminAuthUser && (
                  <Button danger onClick={handleAdminLogout} loading={adminLogoutLoading}>
                    {isZh ? '退出登录' : 'Sign out'}
                  </Button>
                )}
                {canOpenAdminReview && (
                  <Button type="primary" onClick={() => navigate('/operit-submission-admin')}>
                    {isZh ? '进入审核入口' : 'Open review entry'}
                  </Button>
                )}
              </Space>
              {adminAuthLoading ? (
                <Text type="secondary">{isZh ? '正在检查登录状态…' : 'Checking sign-in status…'}</Text>
              ) : adminAuthUser ? (
                <Text type="secondary">
                  {isZh
                    ? `当前已登录：${adminAuthUser.display_name || adminAuthUser.username}${adminAuthUser.role ? `（${adminAuthUser.role}）` : ''}`
                    : `Signed in as: ${adminAuthUser.display_name || adminAuthUser.username}${adminAuthUser.role ? ` (${adminAuthUser.role})` : ''}`}
                </Text>
              ) : null}
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={12} style={showLeftColumn ? undefined : { display: 'none' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card style={showSection('profile') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.profileTitle}
                  </Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.profileName}</Text>
                      <Input
                        value={profile.authorName}
                        onChange={event => setProfile({ ...profile, authorName: event.target.value })}
                      />
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.profileEmail}</Text>
                      <Input
                        value={profile.authorEmail}
                        onChange={event => setProfile({ ...profile, authorEmail: event.target.value })}
                      />
                    </Col>
                  </Row>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.profileEditorMode}</Text>
                      <div>
                        <Segmented
                          value={profile.editorMode}
                          options={[
                            { label: t.editorModeVisual, value: 'visual' },
                            { label: t.editorModeMarkdown, value: 'markdown' },
                          ]}
                          onChange={value => setProfile({ ...profile, editorMode: value as OperitProfile['editorMode'] })}
                        />
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.profileViewMode}</Text>
                      <div>
                        <Segmented
                          value={profile.viewMode}
                          options={[
                            { label: t.viewModeEdit, value: 'edit' },
                            { label: t.viewModeSplit, value: 'split' },
                            { label: t.viewModePreview, value: 'preview' },
                          ]}
                          onChange={value => setProfile({ ...profile, viewMode: value as OperitProfile['viewMode'] })}
                        />
                      </div>
                    </Col>
                  </Row>
                  <div>
                    <Text type="secondary">{t.profileFontSize}</Text>
                    <Slider
                      min={12}
                      max={20}
                      value={profile.fontSize}
                      onChange={value => setProfile({ ...profile, fontSize: value as number })}
                    />
                  </div>
                </Space>
              </Card>

              <Card style={showSection('lookup') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.lookupTitle}
                  </Title>
                  <Text type="secondary">{t.lookupSubtitle}</Text>
                  <Space>
                    <Button
                      type="primary"
                      loading={lookupLoading}
                      onClick={() => {
                        if (!profile.authorName.trim() && !profile.authorEmail.trim()) {
                          message.error(t.lookupRequireIdentity);
                          return;
                        }
                        setLookupVerifyOpen(true);
                      }}
                    >
                      {t.lookupAction}
                    </Button>
                  </Space>
                  {lookupError && <Alert type="error" showIcon message={t.lookupFailed} description={lookupError} />}
                  {lookupBan && (
                    <Alert
                      type="error"
                      showIcon
                      message={t.ipBanTitle}
                      description={(
                        <Space direction="vertical" size={0}>
                          <Text>{t.ipBanSubtitle}</Text>
                          <Text type="secondary">
                            {t.ipBanReasonLabel}: {lookupBan.reason || '-'}
                          </Text>
                          <Text type="secondary">
                            {t.ipBanExpiresLabel}:{' '}
                            {lookupBan.expires_at ? formatDateTime(lookupBan.expires_at) : t.ipBanPermanent}
                          </Text>
                          <Text type="secondary">
                            {t.ipBanByLabel}: {lookupBan.banned_by || '-'}
                          </Text>
                        </Space>
                      )}
                    />
                  )}
                  {lookupResult && (
                    <>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={6}>
                          <Card size="small">
                            <Text type="secondary">{t.lookupTotal}</Text>
                            <Title level={4} style={{ margin: 0 }}>{lookupResult.counts.total}</Title>
                          </Card>
                        </Col>
                        <Col xs={24} md={6}>
                          <Card size="small">
                            <Text type="secondary">{t.lookupPending}</Text>
                            <Title level={4} style={{ margin: 0 }}>{lookupResult.counts.pending}</Title>
                          </Card>
                        </Col>
                        <Col xs={24} md={6}>
                          <Card size="small">
                            <Text type="secondary">{t.lookupApproved}</Text>
                            <Title level={4} style={{ margin: 0 }}>{lookupResult.counts.approved}</Title>
                          </Card>
                        </Col>
                        <Col xs={24} md={6}>
                          <Card size="small">
                            <Text type="secondary">{t.lookupRejected}</Text>
                            <Title level={4} style={{ margin: 0 }}>{lookupResult.counts.rejected}</Title>
                          </Card>
                        </Col>
                      </Row>
                      <Card size="small">
                        <Text type="secondary">{t.lookupLastReviewed}</Text>
                        <div>{lookupResult.last_reviewed_at ? formatDateTime(lookupResult.last_reviewed_at) : t.lookupNoReviewYet}</div>
                      </Card>
                      <Space>
                        <Button size="small" onClick={() => setLookupExpanded(value => !value)}>
                          {lookupExpanded ? t.lookupCollapse : t.lookupExpand}
                        </Button>
                      </Space>
                      {lookupExpanded && (
                        <List
                          size="small"
                          dataSource={lookupResult.items}
                          style={{ maxHeight: 320, overflow: 'auto' }}
                          renderItem={item => (
                            <List.Item>
                              <List.Item.Meta
                                title={item.title || item.target_path}
                                description={(
                                  <Space direction="vertical" size={0}>
                                    <Text type="secondary">{item.target_path}</Text>
                                    <Text type="secondary">
                                      {formatStatusText(item.status)} | {formatDateTime(item.created_at)}
                                    </Text>
                                    {item.reviewed_at && (
                                      <Text type="secondary">
                                        {t.lookupReviewedAt.replace('{time}', formatDateTime(item.reviewed_at))}
                                      </Text>
                                    )}
                                  </Space>
                                )}
                              />
                              <Tag>{item.language}</Tag>
                            </List.Item>
                          )}
                        />
                      )}
                    </>
                  )}
                </Space>
              </Card>

              <Card style={showSection('progress') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.progressTitle}
                  </Title>
                  {progressItems.length ? (
                    <List
                      size="small"
                      dataSource={progressItems}
                      renderItem={([path, item]) => (
                        <List.Item
                          actions={[
                            <Button
                              key="open"
                              size="small"
                              onClick={() => navigate(`/operit-submission-edit?path=${encodeURIComponent(path)}`)}
                            >
                              {t.openEdit}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={item.title || path}
                            description={(
                              <Space direction="vertical" size={0}>
                                <Text type="secondary">{path}</Text>
                                <Text type="secondary">
                                  {statusTag(item.status)} {formatDateTime(item.updated_at)}
                                </Text>
                              </Space>
                            )}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Text type="secondary">{t.progressEmpty}</Text>
                  )}
                </Space>
              </Card>

              <Card style={showSection('drafts') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.draftTitle}
                  </Title>
                  {drafts.length ? (
                    <List
                      size="small"
                      dataSource={drafts}
                      renderItem={draft => (
                        <List.Item
                          actions={[
                            <Button key="open" size="small" onClick={() => handleOpenDraft(draft)}>
                              {t.openEdit}
                            </Button>,
                            <Button
                              key="delete"
                              size="small"
                              danger
                              onClick={() => handleDeleteDraft(draft)}
                            >
                              {t.deleteDraft}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={draft.title || draft.target_path}
                            description={(
                              <Space direction="vertical" size={0}>
                                <Text type="secondary">{draft.target_path}</Text>
                                <Text type="secondary">{formatDateTime(draft.updated_at)}</Text>
                              </Space>
                            )}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Text type="secondary">{t.draftEmpty}</Text>
                  )}
                </Space>
              </Card>
            </Space>
          </Col>

          <Col xs={24} xl={12} style={showRightColumn ? undefined : { display: 'none' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card style={showSection('history') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.historyTitle}
                  </Title>
                  {history.length ? (
                    <List
                      size="small"
                      dataSource={history}
                      renderItem={item => (
                        <List.Item
                          actions={[
                            <Button
                              key="open"
                              size="small"
                              onClick={() => navigate(`/operit-submission-edit?path=${encodeURIComponent(item.target_path)}`)}
                            >
                              {t.openEdit}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={item.title || t.historyUntitled}
                            description={(
                              <Space direction="vertical" size={0}>
                                <Text type="secondary">{item.target_path}</Text>
                                <Text type="secondary">
                                  {formatStatusText(item.status)} | {formatDateTime(item.created_at)}
                                </Text>
                              </Space>
                            )}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Text type="secondary">{t.historyEmpty}</Text>
                  )}
                  <Button danger onClick={handleDeleteHistory} icon={<DeleteOutlined />}>
                    {t.historyClear}
                  </Button>
                </Space>
              </Card>

              <Card style={showSection('leaderboard') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.leaderboardTitle}
                  </Title>
                  <Space wrap>
                    <Button size="small" onClick={() => loadLeaderboard(true)} loading={leaderboardLoading}>
                      {t.leaderboardRefresh}
                    </Button>
                    {leaderboardUpdatedAt && (
                      <Text type="secondary">
                        {t.leaderboardUpdatedAt.replace('{time}', formatDateTime(leaderboardUpdatedAt))}
                      </Text>
                    )}
                  </Space>
                  {leaderboardError && (
                    <Alert type="error" showIcon message={t.leaderboardLoadFailed} description={leaderboardError} />
                  )}
                  {leaderboardItems.length ? (
                    <List
                      size="small"
                      dataSource={leaderboardItems}
                      renderItem={(item, index) => (
                        <List.Item>
                          <List.Item.Meta
                            title={`${index + 1}. ${item.author_name || t.leaderboardAnonymous}`}
                            description={(
                              <Space direction="vertical" size={0}>
                                <Text type="secondary">
                                  {t.leaderboardEmailLabel}: {maskEmail(item.author_email)}
                                </Text>
                                <Text type="secondary">
                                  {t.leaderboardCountLabel}: {item.changed_words}
                                </Text>
                              </Space>
                            )}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Text type="secondary">{t.leaderboardEmpty}</Text>
                  )}
                </Space>
              </Card>

              <Card style={showSection('templates') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.templateTitle}
                  </Title>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.templateName}</Text>
                      <Input value={templateTitle} onChange={event => setTemplateTitle(event.target.value)} />
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.templateContent}</Text>
                      <Input.TextArea
                        rows={4}
                        value={templateContent}
                        onChange={event => setTemplateContent(event.target.value)}
                      />
                    </Col>
                  </Row>
                  <Button type="primary" onClick={handleAddTemplate}>
                    {t.templateAdd}
                  </Button>
                  {templates.length ? (
                    <List
                      size="small"
                      dataSource={templates}
                      renderItem={item => (
                        <List.Item
                          actions={[
                            <Button key="remove" size="small" danger onClick={() => handleRemoveTemplate(item)}>
                              {t.templateRemove}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={item.title}
                            description={(
                              <Space direction="vertical" size={0}>
                                <Text type="secondary">{formatDateTime(item.updated_at)}</Text>
                                <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                                  {item.content}
                                </Text>
                              </Space>
                            )}
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Text type="secondary">{t.templateEmpty}</Text>
                  )}
                </Space>
              </Card>

              <Card style={showSection('data') ? undefined : { display: 'none' }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Title level={4} style={{ margin: 0 }}>
                    {t.dataTitle}
                  </Title>
                  <Space wrap>
                    <Button icon={<DownloadOutlined />} onClick={handleExport}>
                      {t.exportData}
                    </Button>
                    <Button icon={<UploadOutlined />} onClick={handleImportClick}>
                      {t.importData}
                    </Button>
                    <Button danger icon={<DeleteOutlined />} onClick={handleClearAll}>
                      {t.clearAll}
                    </Button>
                    <Button onClick={refreshAll}>{t.refresh}</Button>
                  </Space>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    aria-label={t.importAriaLabel}
                    title={t.importAriaLabel}
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                  />
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>
      </Content>

      <Modal
        title={t.clearHistoryTitle}
        open={clearHistoryOpen}
        onCancel={() => setClearHistoryOpen(false)}
        onOk={() => {
          importOperitLocalData({ history: [] });
          setHistory([]);
          setClearHistoryOpen(false);
        }}
        okText={t.confirm}
        cancelText={t.cancel}
      >
        <Text>{t.clearHistoryHint}</Text>
      </Modal>

      <Modal
        title={t.lookupTurnstile}
        open={lookupVerifyOpen}
        onCancel={() => setLookupVerifyOpen(false)}
        footer={null}
      >
        <div style={{ marginTop: 8 }}>
          {siteKey ? (
            <TurnstileWidget
              key={turnstileResetKey}
              siteKey={siteKey}
              onVerify={token => {
                if (lookupLoading) return;
                setLookupVerifyOpen(false);
                handleLookup(token);
              }}
              onExpire={() => {
                // no-op
              }}
            />
          ) : (
            <Alert type="warning" message={t.turnstileMissing} showIcon />
          )}
        </div>
      </Modal>
    </main>
  );
};

export default OperitSubmissionCenterPage;
