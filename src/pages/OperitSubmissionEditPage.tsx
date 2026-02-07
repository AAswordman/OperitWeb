import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Layout,
  List,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircleOutlined } from '@ant-design/icons';
import TurnstileWidget from '../components/TurnstileWidget';
import OperitMarkdownEditor, { type OperitMarkdownEditorHandle } from '../components/OperitMarkdownEditor';
import { translations } from '../translations';
import {
  deleteOperitDraft,
  getOperitDraft,
  getOperitHistory,
  getOperitProfile,
  getOperitTemplates,
  saveOperitDraft,
  saveOperitHistory,
  saveOperitProfile,
  setOperitProgressEntry,
  type OperitDraft,
  type OperitEditorMode,
  type OperitHistoryEntry,
  type OperitTemplate,
  type OperitViewMode,
} from '../utils/operitLocalStore';
import {
  buildOperitLocalImageUri,
  deleteOperitLocalImage,
  extractOperitLocalImageIds,
  getOperitLocalImage,
  saveOperitLocalImage,
} from '../utils/operitLocalImageStore';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const extractTitle = (content: string, fallback: string) => {
  for (const line of content.split('\n')) {
    const match = line.trim().match(/^#\s+(.+)$/);
    if (match) return match[1].trim();
  }
  return fallback;
};

const normalizeBase = (base: string) => (base.endsWith('/') ? base : `${base}/`);
const formatDateTime = (value: string) => new Date(value).toLocaleString();

const toSha256Hex = async (blob: Blob) => {
  const data = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

interface OperitSubmissionEditPageProps {
  language: 'zh' | 'en';
}

interface SubmissionResult {
  id: string;
  status: string;
  created_at: string;
}

interface IpBanInfo {
  reason?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  banned_by?: string | null;
}

const OperitSubmissionEditPage: React.FC<OperitSubmissionEditPageProps> = ({ language }) => {
  const t = translations[language].submission;
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const targetPath = searchParams.get('path') || '';
  const apiBase = localStorage.getItem('operit_submission_admin_api_base') || 'https://api.aaswordsman.org';
  const draftStorageKey = useMemo(
    () => (targetPath ? `operit_submission_draft:${targetPath}` : ''),
    [targetPath],
  );
  const editorRef = useRef<OperitMarkdownEditorHandle>(null);

  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [ipBanInfo, setIpBanInfo] = useState<IpBanInfo | null>(null);
  const [draftInfo, setDraftInfo] = useState<OperitDraft | null>(null);
  const [draftPending, setDraftPending] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<OperitHistoryEntry[]>([]);
  const [editorMode, setEditorMode] = useState<OperitEditorMode>('visual');
  const [viewMode, setViewMode] = useState<OperitViewMode>('split');
  const [fontSize, setFontSize] = useState(14);
  const [templates, setTemplates] = useState<OperitTemplate[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImageUrls, setLocalImageUrls] = useState<Record<string, string>>({});
  const localImageUrlsRef = useRef<Record<string, string>>({});

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const targetLanguage = useMemo(() => {
    if (targetPath.includes('/en/')) return 'en';
    if (targetPath.includes('/zh/')) return 'zh';
    return language;
  }, [targetPath, language]);

  const hasDraftData = useMemo(() => (
    Boolean(title.trim() || content.trim() || authorName.trim() || authorEmail.trim())
  ), [title, content, authorName, authorEmail]);

  const hasEdits = useMemo(() => {
    const titleChanged = title.trim() && title.trim() !== originalTitle.trim();
    const contentChanged = content.trim() && content.trim() !== originalContent.trim();
    const authorChanged = Boolean(authorName.trim() || authorEmail.trim());
    return Boolean(titleChanged || contentChanged || authorChanged);
  }, [title, content, authorName, authorEmail, originalTitle, originalContent]);

  const saveDraft = useCallback((force?: boolean) => {
    if (!draftStorageKey || !targetPath) return;
    if (!hasDraftData) return;
    if (!force && !hasEdits) return;
    const payload: OperitDraft = {
      target_path: targetPath,
      title,
      content,
      author_name: authorName,
      author_email: authorEmail,
      updated_at: new Date().toISOString(),
    };
    try {
      saveOperitDraft(payload);
      setDraftSavedAt(payload.updated_at);
      setDraftInfo(payload);
    } catch {
      // ignore localStorage errors
    }
  }, [draftStorageKey, targetPath, hasDraftData, hasEdits, title, content, authorName, authorEmail]);

  const loadDoc = useCallback(async () => {
    if (!targetPath) {
      setDocError(t.errorMissingPath);
      return;
    }
    if (!targetPath.startsWith('content/')) {
      setDocError(t.errorInvalidPath);
      return;
    }

    setDocLoading(true);
    setDocError(null);

    try {
      const baseUrl = normalizeBase(import.meta.env.BASE_URL || '/');
      const response = await fetch(`${baseUrl}${targetPath}`);
      if (!response.ok) {
        throw new Error(t.errorLoadFailed);
      }
      const text = await response.text();
      setContent(text);
      const extractedTitle = extractTitle(text, targetPath.split('/').pop() || t.defaultTitle);
      setTitle(prev => prev || extractedTitle);
      setOriginalTitle(extractedTitle);
      setOriginalContent(text);
    } catch (err) {
      setDocError((err as Error).message || t.errorLoadFailed);
    } finally {
      setDocLoading(false);
    }
  }, [targetPath, t]);

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
    loadDoc();
    loadConfig();
  }, [loadDoc, loadConfig]);

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const draft = getOperitDraft(targetPath);
      if (draft?.target_path === targetPath) {
        setDraftInfo(draft);
        setDraftPending(true);
        setDraftSavedAt(draft.updated_at || null);
        return;
      }
      setDraftInfo(null);
      setDraftPending(false);
      setDraftSavedAt(null);
    } catch {
      setDraftInfo(null);
      setDraftPending(false);
      setDraftSavedAt(null);
    }
  }, [draftStorageKey, targetPath]);

  useEffect(() => {
    setSubmissionHistory(getOperitHistory().slice(0, 50));
  }, []);

  useEffect(() => {
    setTemplates(getOperitTemplates());
  }, []);

  useEffect(() => {
    const profile = getOperitProfile();
    setEditorMode(profile.editorMode);
    setViewMode(profile.viewMode);
    setFontSize(profile.fontSize || 14);
    setAuthorName(prev => prev || profile.authorName);
    setAuthorEmail(prev => prev || profile.authorEmail);
  }, []);

  useEffect(() => {
    saveOperitProfile({
      authorName,
      authorEmail,
      editorMode,
      viewMode,
      fontSize,
    });
  }, [authorName, authorEmail, editorMode, viewMode, fontSize]);

  useEffect(() => {
    if (!draftStorageKey || draftPending || !hasEdits) return;
    const timer = window.setTimeout(() => {
      saveDraft();
      setOperitProgressEntry(targetPath, {
        status: 'edited',
        updated_at: new Date().toISOString(),
        title: title.trim() || targetPath,
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey, draftPending, hasEdits, saveDraft, targetPath, title]);

  useEffect(() => {
    localImageUrlsRef.current = localImageUrls;
  }, [localImageUrls]);

  useEffect(() => {
    const localIds = extractOperitLocalImageIds(content);
    if (!localIds.length) {
      setLocalImageUrls(prev => {
        const urls = Object.values(prev);
        urls.forEach(url => URL.revokeObjectURL(url));
        if (!Object.keys(prev).length) return prev;
        return {};
      });
      return;
    }

    const active = new Set(localIds);
    setLocalImageUrls(prev => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([id, url]) => {
        if (active.has(id)) {
          next[id] = url;
        } else {
          URL.revokeObjectURL(url);
        }
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length
        && prevKeys.every(key => next[key] === prev[key])
      ) {
        return prev;
      }
      return next;
    });

    let cancelled = false;
    const loadImages = async () => {
      for (const id of localIds) {
        if (cancelled) return;
        if (localImageUrlsRef.current[id]) continue;
        try {
          const asset = await getOperitLocalImage(id);
          if (!asset?.blob || cancelled) continue;
          const objectUrl = URL.createObjectURL(asset.blob);
          setLocalImageUrls(prev => {
            if (!active.has(id)) {
              URL.revokeObjectURL(objectUrl);
              return prev;
            }
            if (prev[id]) {
              URL.revokeObjectURL(objectUrl);
              return prev;
            }
            return {
              ...prev,
              [id]: objectUrl,
            };
          });
        } catch {
          // ignore missing local assets
        }
      }
    };
    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => () => {
    Object.values(localImageUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
  }, []);

  const handleUseDraft = () => {
    if (!draftInfo) return;
    setTitle(draftInfo.title || '');
    setContent(draftInfo.content || '');
    setAuthorName(draftInfo.author_name || '');
    setAuthorEmail(draftInfo.author_email || '');
    setDraftPending(false);
    setDraftSavedAt(draftInfo.updated_at || null);
  };

  const handleDiscardDraft = () => {
    if (draftStorageKey) {
      try {
        deleteOperitDraft(targetPath);
      } catch {
        // ignore localStorage errors
      }
    }
    setDraftInfo(null);
    setDraftPending(false);
    setDraftSavedAt(null);
  };

  const handleClearHistory = () => {
    setSubmissionHistory([]);
    try {
      saveOperitHistory([]);
    } catch {
      // ignore localStorage errors
    }
  };

  const handleInsertTemplate = (templateId: string) => {
    const template = templates.find(item => item.id === templateId);
    if (!template) return;
    const contentToInsert = content.trim() ? `\n\n${template.content}\n` : `${template.content}\n`;
    editorRef.current?.insertText(contentToInsert);
    message.success(t.templateInserted);
  };

  const resolveImageUrl = useCallback((uri: string) => {
    const match = uri.match(/^operit-local:\/\/([a-z0-9][a-z0-9_-]{7,63})$/i);
    if (!match) return uri;
    return localImageUrls[match[1]] || '';
  }, [localImageUrls]);

  const handleInsertImage = useCallback(async () => {
    if (uploadingImage) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    const files = await new Promise<File[]>((resolve) => {
      input.onchange = () => {
        const selected = input.files ? Array.from(input.files) : [];
        resolve(selected);
      };
      input.click();
    });

    if (!files.length) return;

    setUploadingImage(true);
    try {
      let inserted = 0;
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          message.warning(`${file.name}: unsupported image type`);
          continue;
        }
        const asset = await saveOperitLocalImage(file);
        const alt = (asset.name || 'image').replace(/\.[^.]+$/, '');
        editorRef.current?.insertText(`![${alt}](${buildOperitLocalImageUri(asset.id)})`);
        inserted += 1;
      }
      if (inserted > 0) {
        message.success(`Inserted ${inserted} image${inserted > 1 ? 's' : ''}`);
      }
    } catch {
      message.error('Image insert failed');
    } finally {
      setUploadingImage(false);
    }
  }, [uploadingImage]);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!title.trim()) {
      const msg = t.errorTitleRequired;
      setSubmitError(msg);
      message.error(msg);
      return;
    }
    if (!content.trim() || content.trim().length < 20) {
      const msg = t.errorContentTooShort;
      setSubmitError(msg);
      message.error(msg);
      return;
    }
    if (!authorName.trim()) {
      const msg = t.errorAuthorRequired;
      setSubmitError(msg);
      message.error(msg);
      return;
    }
    if (!turnstileToken) {
      const msg = t.errorTurnstileRequired;
      setSubmitError(msg);
      message.error(msg);
      return;
    }

    setSubmitLoading(true);
    setIpBanInfo(null);
    try {
      const localImageIds = extractOperitLocalImageIds(content);
      const formData = new FormData();
      const payload = {
        type: 'edit',
        language: targetLanguage,
        target_path: targetPath,
        title: title.trim(),
        content: content.trim(),
        author_name: authorName.trim(),
        author_email: authorEmail.trim() || undefined,
        turnstile_token: turnstileToken,
      };
      formData.set('payload', JSON.stringify(payload));

      if (localImageIds.length) {
        const manifest: Array<{ id: string; name: string; type: string; size: number; sha256: string }> = [];
        for (const assetId of localImageIds) {
          const asset = await getOperitLocalImage(assetId);
          if (!asset?.blob) {
            throw new Error(`local_image_missing:${assetId}`);
          }
          const file = new File([asset.blob], asset.name || `${assetId}.bin`, {
            type: asset.type || 'application/octet-stream',
          });
          const sha256 = await toSha256Hex(asset.blob);
          manifest.push({
            id: assetId,
            name: file.name,
            type: file.type,
            size: file.size,
            sha256,
          });
          formData.append(`asset_${assetId}`, file, file.name);
        }
        formData.set('assets_manifest', JSON.stringify(manifest));
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45000);
      const response = await fetch(`${apiBase.replace(/\/+$/, '')}/api/submissions`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data?.error === 'ip_banned') {
          setIpBanInfo({
            reason: data?.reason || null,
            expires_at: data?.expires_at || null,
            created_at: data?.created_at || null,
            banned_by: data?.banned_by || null,
          });
          setSubmitError(t.ipBanTitle);
          message.error(t.ipBanTitle);
          return;
        }
        const msg = data?.error ? `${t.errorSubmitFailed}: ${data.error}` : t.errorSubmitFailed;
        setSubmitError(msg);
        throw new Error(msg);
      }
      const createdAt = data?.created_at || new Date().toISOString();
      const status = data?.status || 'pending';
      const id = data?.id || '-';
      setSubmissionResult({
        id,
        status,
        created_at: createdAt,
      });

      for (const assetId of localImageIds) {
        try {
          await deleteOperitLocalImage(assetId);
        } catch {
          // ignore local cleanup failure
        }
      }

      setSubmissionHistory(prev => {
        const next = [
          {
            id,
            status,
            created_at: createdAt,
            title: title.trim(),
            target_path: targetPath,
            language: targetLanguage,
            author_name: authorName.trim(),
            author_email: authorEmail.trim() || undefined,
          },
          ...prev,
        ].slice(0, 50);
        try {
          saveOperitHistory(next);
        } catch {
          // ignore localStorage errors
        }
        return next;
      });
      setOperitProgressEntry(targetPath, {
        status: 'submitted',
        updated_at: new Date().toISOString(),
        title: title.trim() || targetPath,
      });
      message.success(t.submitSuccess);
      setIpBanInfo(null);
      setTurnstileToken('');
      setTurnstileResetKey(prev => prev + 1);
    } catch (err) {
      const msg = (err as Error).name === 'AbortError'
        ? t.errorSubmitTimeout
        : (err as Error).message || t.errorSubmitFailed;
      setSubmitError(msg);
      message.error(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
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
            <Alert type="info" showIcon message={t.ipNotice} />
            <Space>
              <Button onClick={() => navigate('/operit-submission-center')}>
                {t.openCenter}
              </Button>
            </Space>
          </Space>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={16}>
              <Text type="secondary">{t.pathLabel}</Text>
              <div>
                <Text code>{targetPath || '-'}</Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <Text type="secondary">{t.languageLabel}</Text>
              <div>
                <Tag>{targetLanguage}</Tag>
              </div>
            </Col>
          </Row>
        </Card>

        {docError && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            message={t.errorTitle}
            description={docError}
          />
        )}

        {ipBanInfo && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            message={t.ipBanTitle}
            description={(
              <Space direction="vertical" size={0}>
                <Text>{t.ipBanSubtitle}</Text>
                <Text type="secondary">
                  {t.ipBanReasonLabel}: {ipBanInfo.reason || '-'}
                </Text>
                <Text type="secondary">
                  {t.ipBanExpiresLabel}:{' '}
                  {ipBanInfo.expires_at ? formatDateTime(ipBanInfo.expires_at) : t.ipBanPermanent}
                </Text>
                <Text type="secondary">
                  {t.ipBanByLabel}: {ipBanInfo.banned_by || '-'}
                </Text>
              </Space>
            )}
          />
        )}

        {submissionResult ? (
          <Card style={{ marginTop: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space align="center">
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <Title level={4} style={{ margin: 0 }}>
                  {t.successTitle}
                </Title>
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t.successSubtitle}
              </Paragraph>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Text type="secondary">{t.successIdLabel}</Text>
                  <div>
                    <Text code>{submissionResult.id}</Text>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <Text type="secondary">{t.successStatusLabel}</Text>
                  <div>
                    <Tag color="gold">{submissionResult.status}</Tag>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <Text type="secondary">{t.successTimeLabel}</Text>
                  <div>{new Date(submissionResult.created_at).toLocaleString()}</div>
                </Col>
              </Row>
              <Alert type="info" showIcon message={t.successTip} />
              <Space>
                <Button onClick={() => navigate(-1)}>{t.backToDoc}</Button>
                <Button onClick={() => setSubmissionResult(null)}>{t.submitAnother}</Button>
              </Space>
            </Space>
          </Card>
        ) : (
          <>
            {draftPending && draftInfo && !docLoading && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
                message={t.draftFound}
                description={t.draftFoundDesc.replace('{time}', formatDateTime(draftInfo.updated_at))}
                action={(
                  <Space direction="vertical">
                    <Button size="small" type="primary" onClick={handleUseDraft}>
                      {t.draftUse}
                    </Button>
                    <Button size="small" onClick={handleDiscardDraft}>
                      {t.draftDiscard}
                    </Button>
                  </Space>
                )}
              />
            )}
            <Card style={{ marginTop: 16 }}>
              {docLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Spin />
                </div>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">{t.titleLabel}</Text>
                  <Input value={title} onChange={event => setTitle(event.target.value)} />
                </div>
                <div>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} md={16}>
                        <Text type="secondary">{t.templateInsertLabel}</Text>
                        <Select
                          style={{ width: '100%' }}
                          placeholder={t.templateSelectPlaceholder}
                          options={templates.map(item => ({ value: item.id, label: item.title }))}
                          onSelect={value => handleInsertTemplate(value as string)}
                          disabled={!templates.length}
                        />
                      </Col>
                      <Col xs={24} md={8}>
                        <Text type="secondary" style={{ display: 'block' }}>{t.templateManageLabel}</Text>
                        <Button onClick={() => navigate('/operit-submission-center')}>
                          {t.templateManageButton}
                        </Button>
                      </Col>
                    </Row>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} md={12}>
                        <Text type="secondary">{t.editorModeLabel}</Text>
                        <div>
                          <Segmented
                            value={editorMode}
                            options={[
                              { label: t.editorModeVisual, value: 'visual' },
                              { label: t.editorModeMarkdown, value: 'markdown' },
                            ]}
                            onChange={value => setEditorMode(value as OperitEditorMode)}
                          />
                        </div>
                      </Col>
                      <Col xs={24} md={12}>
                        <Text type="secondary">{t.viewModeLabel}</Text>
                        <div>
                          <Segmented
                            value={viewMode}
                            options={[
                              { label: t.viewModeEdit, value: 'edit' },
                              { label: t.viewModeSplit, value: 'split' },
                              { label: t.viewModePreview, value: 'preview' },
                            ]}
                            onChange={value => setViewMode(value as OperitViewMode)}
                          />
                        </div>
                      </Col>
                    </Row>
                    <Text type="secondary">{t.contentLabel}</Text>
                    <OperitMarkdownEditor
                      ref={editorRef}
                      value={content}
                      onChange={setContent}
                      placeholder={t.contentPlaceholder}
                      mode={editorMode}
                      view={viewMode}
                      fontSize={fontSize}
                      onInsertImage={handleInsertImage}
                      resolveImageUrl={resolveImageUrl}
                      labels={{
                        toolbarBold: t.toolbarBold,
                        toolbarItalic: t.toolbarItalic,
                        toolbarStrike: t.toolbarStrike,
                        toolbarH1: t.toolbarH1,
                        toolbarH2: t.toolbarH2,
                        toolbarH3: t.toolbarH3,
                        toolbarQuote: t.toolbarQuote,
                        toolbarCode: t.toolbarCode,
                        toolbarCodeBlock: t.toolbarCodeBlock,
                        toolbarList: t.toolbarList,
                        toolbarOrdered: t.toolbarOrdered,
                        toolbarChecklist: t.toolbarChecklist,
                        toolbarLink: t.toolbarLink,
                        toolbarImage: t.toolbarImage,
                        previewEmpty: t.previewEmpty,
                      }}
                    />
                  </Space>
                </div>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.authorLabel}</Text>
                      <Input
                        value={authorName}
                        onChange={event => setAuthorName(event.target.value)}
                        placeholder={t.authorPlaceholder}
                      />
                    </Col>
                    <Col xs={24} md={12}>
                      <Text type="secondary">{t.emailLabel}</Text>
                      <Input
                        value={authorEmail}
                        onChange={event => setAuthorEmail(event.target.value)}
                        placeholder={t.emailPlaceholder}
                      />
                    </Col>
                  </Row>

                  <div>
                    <Text type="secondary">{t.turnstileLabel}</Text>
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

                  {submitError && (
                    <Alert type="error" showIcon message={t.errorTitle} description={submitError} />
                  )}

                  <Space>
                    <Button onClick={() => navigate(-1)}>{t.back}</Button>
                    <Button
                      type="primary"
                      loading={submitLoading}
                      onClick={handleSubmit}
                    >
                      {t.submitButton}
                    </Button>
                  </Space>
                </Space>
              )}
            </Card>
            <Card style={{ marginTop: 16 }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Title level={4} style={{ margin: 0 }}>
                  {t.draftTitle}
                </Title>
                {draftSavedAt ? (
                  <Text type="secondary">
                    {t.draftSavedAt.replace('{time}', formatDateTime(draftSavedAt))}
                  </Text>
                ) : (
                  <Text type="secondary">{t.draftEmpty}</Text>
                )}
                <Space>
                  <Button onClick={() => saveDraft(true)} disabled={!hasDraftData}>
                    {t.draftSave}
                  </Button>
                  <Button onClick={handleDiscardDraft} disabled={!draftSavedAt && !draftInfo}>
                    {t.draftClear}
                  </Button>
                </Space>
              </Space>
            </Card>
          </>
        )}

        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              {t.historyTitle}
            </Title>
            {submissionHistory.length ? (
              <List
                size="small"
                dataSource={submissionHistory}
                renderItem={item => (
                  <List.Item
                    actions={[
                      <Tag key={`${item.id}-lang`}>{item.language}</Tag>,
                      <Text key={`${item.id}-id`} code>
                        {item.id}
                      </Text>,
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
            <Space>
              <Button onClick={handleClearHistory} disabled={!submissionHistory.length}>
                {t.historyClear}
              </Button>
            </Space>
          </Space>
        </Card>
      </Content>
    </main>
  );
};

export default OperitSubmissionEditPage;
