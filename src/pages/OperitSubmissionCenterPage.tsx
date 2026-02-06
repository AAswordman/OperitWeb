import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
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
  getOperitProfile,
  getOperitProgress,
  getOperitTemplates,
  importOperitLocalData,
  listOperitDrafts,
  saveOperitProfile,
  saveOperitTemplates,
  type OperitDraft,
  type OperitHistoryEntry,
  type OperitProfile,
  type OperitProgressEntry,
  type OperitTemplate,
} from '../utils/operitLocalStore';

const { Content } = Layout;
const { Title, Text } = Typography;

interface OperitSubmissionCenterPageProps {
  language: 'zh' | 'en';
}

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const OperitSubmissionCenterPage: React.FC<OperitSubmissionCenterPageProps> = ({ language }) => {
  const t = translations[language].submissionCenter;
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
  const [lookupIds, setLookupIds] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
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

  const refreshAll = () => {
    setProfile(getOperitProfile());
    setDrafts(listOperitDrafts());
    setHistory(getOperitHistory());
    setProgress(getOperitProgress());
    setTemplates(getOperitTemplates());
  };

  const handleOpenDraft = (draft: OperitDraft) => {
    navigate(`/operit-submission-edit?path=${encodeURIComponent(draft.target_path)}`);
  };

  const handleDeleteDraft = (draft: OperitDraft) => {
    deleteOperitDraft(draft.target_path);
    setDrafts(listOperitDrafts());
  };

  const handleDeleteHistory = () => {
    Modal.confirm({
      title: t.clearHistoryTitle,
      content: t.clearHistoryHint,
      okText: t.confirm,
      cancelText: t.cancel,
      onOk: () => {
        importOperitLocalData({ history: [] });
        setHistory([]);
      },
    });
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
    if (status === 'submitted') return <Tag color="gold">{t.statusSubmitted}</Tag>;
    if (status === 'edited') return <Tag color="blue">{t.statusEdited}</Tag>;
    return <Tag>{status}</Tag>;
  };

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const handleLookup = async () => {
    const ids = lookupIds
      .split(/[\s,]+/)
      .map(item => item.trim())
      .filter(Boolean);
    const authorName = profile.authorName.trim();
    const authorEmail = profile.authorEmail.trim();

    if (!authorName && !authorEmail && ids.length === 0) {
      message.error(t.lookupRequireIdentity);
      return;
    }
    if (!turnstileToken) {
      message.error(t.lookupRequireTurnstile);
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
          submission_ids: ids.length ? ids : undefined,
          turnstile_token: turnstileToken,
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
      setLookupBan(data?.ip_ban || null);
      setTurnstileToken('');
      setTurnstileResetKey(prev => prev + 1);
    } catch (err) {
      setLookupError((err as Error).message || t.lookupFailed);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                {t.title}
              </Title>
              <Text type="secondary">{t.subtitle}</Text>
            </div>
            <Alert showIcon type="info" message={t.localNotice} />
          </Space>
        </Card>

        <Card style={{ marginTop: 16 }}>
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

        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              {t.lookupTitle}
            </Title>
            <Text type="secondary">{t.lookupSubtitle}</Text>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Text type="secondary">{t.lookupName}</Text>
                <Input
                  value={profile.authorName}
                  onChange={event => setProfile({ ...profile, authorName: event.target.value })}
                />
              </Col>
              <Col xs={24} md={12}>
                <Text type="secondary">{t.lookupEmail}</Text>
                <Input
                  value={profile.authorEmail}
                  onChange={event => setProfile({ ...profile, authorEmail: event.target.value })}
                />
              </Col>
            </Row>
            <div>
              <Text type="secondary">{t.lookupIds}</Text>
              <Input.TextArea
                rows={2}
                value={lookupIds}
                onChange={event => setLookupIds(event.target.value)}
                placeholder={t.lookupIdsPlaceholder}
              />
            </div>
            <div>
              <Text type="secondary">{t.lookupTurnstile}</Text>
              <div style={{ marginTop: 8 }}>
                {siteKey ? (
                  <TurnstileWidget
                    key={turnstileResetKey}
                    siteKey={siteKey}
                    onVerify={handleTurnstileVerify}
                    onExpire={handleTurnstileExpire}
                  />
                ) : (
                  <Alert type="warning" message={t.turnstileMissing} showIcon />
                )}
              </div>
            </div>
            <Space>
              <Button type="primary" loading={lookupLoading} onClick={handleLookup}>
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
                <List
                  size="small"
                  dataSource={lookupResult.items}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.title || item.target_path}
                        description={(
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">{item.target_path}</Text>
                            <Text type="secondary">
                              {item.status} | {formatDateTime(item.created_at)}
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
              </>
            )}
          </Space>
        </Card>

        <Card style={{ marginTop: 16 }}>
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

        <Card style={{ marginTop: 16 }}>
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

        <Card style={{ marginTop: 16 }}>
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
                            {item.status} | {formatDateTime(item.created_at)}
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

        <Card style={{ marginTop: 16 }}>
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

        <Card style={{ marginTop: 16 }}>
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
      </Content>
    </main>
  );
};

export default OperitSubmissionCenterPage;
