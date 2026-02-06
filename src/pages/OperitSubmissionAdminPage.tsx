import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
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
  SettingOutlined,
} from '@ant-design/icons';
import { translations } from '../translations';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

type SubmissionStatus = 'pending' | 'approved' | 'rejected';
type StatusFilter = SubmissionStatus | 'all';

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
}

interface OperitSubmissionAdminPageProps {
  language: 'zh' | 'en';
}

const STORAGE = {
  apiBase: 'operit_submission_admin_api_base',
  adminToken: 'operit_submission_admin_token',
  rememberToken: 'operit_submission_admin_remember',
  reviewer: 'operit_submission_admin_reviewer',
};

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

const buildAdminHeaders = (token: string): HeadersInit => ({
  'X-Operit-Admin-Token': token.trim(),
});

const OperitSubmissionAdminPage: React.FC<OperitSubmissionAdminPageProps> = ({ language }) => {
  const languageKey = translations[language] ? language : 'zh';
  const t = translations[languageKey].admin;
  const [apiBase, setApiBase] = useState(() => {
    return localStorage.getItem(STORAGE.apiBase) || 'https://api.aaswordsman.org';
  });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(STORAGE.adminToken) || '');
  const [rememberToken, setRememberToken] = useState(() => {
    return localStorage.getItem(STORAGE.rememberToken) === '1';
  });
  const [reviewer, setReviewer] = useState(() => localStorage.getItem(STORAGE.reviewer) || '');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubmissionItem | null>(null);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE.apiBase, apiBase);
  }, [apiBase]);

  useEffect(() => {
    localStorage.setItem(STORAGE.reviewer, reviewer);
  }, [reviewer]);

  useEffect(() => {
    localStorage.setItem(STORAGE.rememberToken, rememberToken ? '1' : '0');
    if (rememberToken && adminToken) {
      localStorage.setItem(STORAGE.adminToken, adminToken);
    } else {
      localStorage.removeItem(STORAGE.adminToken);
    }
  }, [adminToken, rememberToken]);

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

  const triggerAction = (item: SubmissionItem, type: 'approve' | 'reject') => {
    setActionType(type);
    setActionNotes('');
    setSelectedItem(item);
    setActionOpen(true);
  };

  const executeAction = useCallback(async () => {
    if (!selectedItem) return;
    if (!adminToken.trim()) {
      setError(t.errorTokenRequired);
      return;
    }

    const nextStatus = actionType === 'approve' ? 'approved' : 'rejected';
    const payload = {
      reviewer: reviewer.trim() || undefined,
      review_notes: actionNotes.trim() || undefined,
    };

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

      setItems(prev =>
        prev.flatMap(entry => {
          if (entry.id !== selectedItem.id) return [entry];
          if (statusFilter !== 'all' && statusFilter !== nextStatus) return [];
          return [
            {
              ...entry,
              status: nextStatus,
              reviewed_at: reviewedAt,
              reviewer: reviewer || entry.reviewer,
              review_notes: actionNotes || entry.review_notes,
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
          reviewer: reviewer || prev.reviewer,
          review_notes: actionNotes || prev.review_notes,
        };
      });

      message.success(actionType === 'approve' ? t.messageApproved : t.messageRejected);
      setActionOpen(false);
    } catch (err) {
      message.error((err as Error).message || t.messageActionFailed);
    }
  }, [actionNotes, actionType, adminToken, apiBase, fetchJson, reviewer, selectedItem, statusFilter, t]);

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
      render: (_, record) => (
        <Button type="link" onClick={() => openDetail(record)}>
          {record.title}
        </Button>
      ),
    },
    {
      title: t.pathLabel,
      dataIndex: 'target_path',
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
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.author_name || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
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
              onClick={() => triggerAction(record, 'approve')}
            />
          </Tooltip>
          <Tooltip title={t.reject}>
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => triggerAction(record, 'reject')}
            />
          </Tooltip>
        </Space>
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
                <Input
                  addonBefore={<SettingOutlined />}
                  value={apiBase}
                  onChange={event => setApiBase(event.target.value)}
                  placeholder={t.apiBasePlaceholder}
                />
              </Col>
              <Col xs={24} lg={12}>
                <Input.Password
                  value={adminToken}
                  onChange={event => setAdminToken(event.target.value)}
                  placeholder={t.adminTokenPlaceholder}
                />
              </Col>
              <Col xs={24} lg={8}>
                <Input
                  value={reviewer}
                  onChange={event => setReviewer(event.target.value)}
                  placeholder={t.reviewerPlaceholder}
                />
              </Col>
              <Col xs={24} lg={8}>
                <Space>
                  <Button
                    type={rememberToken ? 'primary' : 'default'}
                    onClick={() => setRememberToken(value => !value)}
                  >
                    {rememberToken ? t.tokenSaved : t.rememberToken}
                  </Button>
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={loadSubmissions}
                  >
                    {t.loadSubmissions}
                  </Button>
                  <Button onClick={() => setOffset(0)}>{t.firstPage}</Button>
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
              </Space>
            </Col>
          </Row>

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={false}
            style={{ marginTop: 16 }}
          />
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
        okButtonProps={{ danger: actionType === 'reject' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text>
            {t.modalTargetLabel}: <Text code>{selectedItem?.title || '-'}</Text>
          </Text>
          <Input
            value={reviewer}
            onChange={event => setReviewer(event.target.value)}
            placeholder={t.modalReviewerPlaceholder}
          />
          <Input.TextArea
            rows={4}
            value={actionNotes}
            onChange={event => setActionNotes(event.target.value)}
            placeholder={t.modalNotesPlaceholder}
          />
        </Space>
      </Modal>
    </main>
  );
};

export default OperitSubmissionAdminPage;
