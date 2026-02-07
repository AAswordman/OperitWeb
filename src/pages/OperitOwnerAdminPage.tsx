import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Layout,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

interface OwnerAdminUser {
  username: string;
  display_name?: string | null;
  role: 'admin' | 'reviewer';
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  disabled_at?: string | null;
}

interface OperitOwnerAdminPageProps {
  language: 'zh' | 'en';
}

const STORAGE = {
  apiBase: 'operit_submission_admin_api_base',
  ownerToken: 'operit_owner_token',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const OperitOwnerAdminPage: React.FC<OperitOwnerAdminPageProps> = () => {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem(STORAGE.apiBase) || 'https://api.aaswordsman.org');
  const [ownerToken, setOwnerToken] = useState(() => localStorage.getItem(STORAGE.ownerToken) || '');
  const [items, setItems] = useState<OwnerAdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    displayName: '',
    role: 'reviewer' as 'admin' | 'reviewer',
    password: '',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    role: 'reviewer' as 'admin' | 'reviewer',
    password: '',
    disabled: false,
  });

  useEffect(() => {
    localStorage.setItem(STORAGE.apiBase, apiBase);
  }, [apiBase]);

  useEffect(() => {
    if (ownerToken.trim()) {
      localStorage.setItem(STORAGE.ownerToken, ownerToken);
    } else {
      localStorage.removeItem(STORAGE.ownerToken);
    }
  }, [ownerToken]);

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

  const ownerHeaders = useCallback(
    () => ({
      'X-Operit-Owner-Token': ownerToken.trim(),
    }),
    [ownerToken],
  );

  const loadUsers = useCallback(async () => {
    if (!ownerToken.trim()) {
      setError('Owner token required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { response, data } = await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/owner/users`, {
        headers: ownerHeaders(),
      });
      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || 'request_failed');
      }
      const list = (data as { items?: OwnerAdminUser[] })?.items || [];
      setItems(list);
    } catch (err) {
      setError((err as Error).message || 'request_failed');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetchJson, ownerHeaders, ownerToken]);

  const createUser = useCallback(async () => {
    if (!ownerToken.trim()) {
      setError('Owner token required');
      return;
    }
    setCreateSubmitting(true);
    try {
      const payload = {
        username: createForm.username.trim(),
        display_name: createForm.displayName.trim() || undefined,
        role: createForm.role,
        password: createForm.password,
      };
      const { response, data } = await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/owner/users`, {
        method: 'POST',
        headers: {
          ...ownerHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || 'request_failed');
      }
      setCreateOpen(false);
      setCreateForm({ username: '', displayName: '', role: 'reviewer', password: '' });
      message.success('Admin created');
      await loadUsers();
    } catch (err) {
      message.error((err as Error).message || 'request_failed');
    } finally {
      setCreateSubmitting(false);
    }
  }, [apiBase, createForm, fetchJson, loadUsers, ownerHeaders, ownerToken]);

  const saveEditUser = useCallback(async () => {
    if (!ownerToken.trim()) {
      setError('Owner token required');
      return;
    }
    if (!editForm.username.trim()) {
      message.error('username required');
      return;
    }
    setEditSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        display_name: editForm.displayName.trim() || '',
        role: editForm.role,
        disabled: editForm.disabled,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }
      const { response, data } = await fetchJson(
        `${apiBase.replace(/\/+$/, '')}/api/admin/owner/users/${encodeURIComponent(editForm.username.trim())}`,
        {
          method: 'POST',
          headers: {
            ...ownerHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const apiError = (data as { error?: string })?.error || response.statusText;
        throw new Error(apiError || 'request_failed');
      }
      setEditOpen(false);
      setEditForm({ username: '', displayName: '', role: 'reviewer', password: '', disabled: false });
      message.success('Admin updated');
      await loadUsers();
    } catch (err) {
      message.error((err as Error).message || 'request_failed');
    } finally {
      setEditSubmitting(false);
    }
  }, [apiBase, editForm, fetchJson, loadUsers, ownerHeaders, ownerToken]);

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      width: 180,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: 'Display Name',
      dataIndex: 'display_name',
      width: 220,
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      width: 120,
      render: (value: string) => <Tag color={value === 'admin' ? 'red' : 'blue'}>{value}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'disabled_at',
      width: 140,
      render: (value: string | null) => <Tag color={value ? 'default' : 'green'}>{value ? 'disabled' : 'active'}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Actions',
      dataIndex: 'actions',
      width: 120,
      render: (_: unknown, record: OwnerAdminUser) => (
        <Button
          size="small"
          onClick={() => {
            setEditForm({
              username: record.username,
              displayName: record.display_name || '',
              role: record.role,
              password: '',
              disabled: Boolean(record.disabled_at),
            });
            setEditOpen(true);
          }}
        >
          Edit
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
                Operit 站长后台
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                仅站长可访问：管理管理员账号、角色与启用状态。
              </Paragraph>
            </div>

            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} lg={12}>
                <Input
                  value={apiBase}
                  onChange={event => setApiBase(event.target.value)}
                  placeholder="API Base (https://api.aaswordsman.org)"
                />
              </Col>
              <Col xs={24} lg={12}>
                <Input.Password
                  value={ownerToken}
                  onChange={event => setOwnerToken(event.target.value)}
                  placeholder="Owner token"
                />
              </Col>
              <Col xs={24}>
                <Space>
                  <Button type="primary" onClick={loadUsers} loading={loading}>
                    Load admins
                  </Button>
                  <Button onClick={() => setCreateOpen(true)} disabled={!ownerToken.trim()}>
                    New admin
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
            message="Owner panel error"
            description={error}
          />
        )}

        <Card style={{ marginTop: 16 }}>
          <Table
            rowKey="username"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>

        <Modal
          title="Create admin"
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          onOk={createUser}
          confirmLoading={createSubmitting}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Input
              value={createForm.username}
              onChange={event => setCreateForm(prev => ({ ...prev, username: event.target.value }))}
              placeholder="username"
            />
            <Input
              value={createForm.displayName}
              onChange={event => setCreateForm(prev => ({ ...prev, displayName: event.target.value }))}
              placeholder="display name"
            />
            <Select
              value={createForm.role}
              options={[
                { label: 'reviewer', value: 'reviewer' },
                { label: 'admin', value: 'admin' },
              ]}
              onChange={value => setCreateForm(prev => ({ ...prev, role: value as 'admin' | 'reviewer' }))}
            />
            <Input.Password
              value={createForm.password}
              onChange={event => setCreateForm(prev => ({ ...prev, password: event.target.value }))}
              placeholder="password"
            />
          </Space>
        </Modal>

        <Modal
          title={`Edit admin: ${editForm.username || '-'}`}
          open={editOpen}
          onCancel={() => setEditOpen(false)}
          onOk={saveEditUser}
          confirmLoading={editSubmitting}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Input disabled value={editForm.username} placeholder="username" />
            <Input
              value={editForm.displayName}
              onChange={event => setEditForm(prev => ({ ...prev, displayName: event.target.value }))}
              placeholder="display name"
            />
            <Select
              value={editForm.role}
              options={[
                { label: 'reviewer', value: 'reviewer' },
                { label: 'admin', value: 'admin' },
              ]}
              onChange={value => setEditForm(prev => ({ ...prev, role: value as 'admin' | 'reviewer' }))}
            />
            <Input.Password
              value={editForm.password}
              onChange={event => setEditForm(prev => ({ ...prev, password: event.target.value }))}
              placeholder="new password (optional)"
            />
            <Space>
              <Switch
                checked={editForm.disabled}
                onChange={checked => setEditForm(prev => ({ ...prev, disabled: checked }))}
              />
              <Text>Disable account</Text>
            </Space>
          </Space>
        </Modal>
      </Content>
    </main>
  );
};

export default OperitOwnerAdminPage;

