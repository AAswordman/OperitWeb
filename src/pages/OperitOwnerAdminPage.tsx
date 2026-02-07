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

const OWNER_USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const OWNER_PASSWORD_MIN_LENGTH = 8;

const mapOwnerApiError = (code: string, isZh: boolean) => {
  const zh: Record<string, string> = {
    owner_unauthorized: '站长令牌无效，请检查 Owner token。',
    owner_token_not_configured: '服务端未配置站长令牌。',
    username_invalid: '用户名不合法（3-32位，仅小写字母/数字/._-）。',
    password_too_short: '密码太短（至少 8 位）。',
    role_invalid: '角色无效，请使用 admin 或 reviewer。',
    user_exists: '该用户名已存在。',
    invalid_json: '请求格式错误，请重试。',
    no_changes: '未检测到修改。',
    not_found: '目标用户不存在。',
    d1_binding_missing: '服务端数据库未绑定。',
  };
  const en: Record<string, string> = {
    owner_unauthorized: 'Invalid owner token.',
    owner_token_not_configured: 'Owner token is not configured on server.',
    username_invalid: 'Invalid username (3-32 chars, lowercase letters/numbers/._-).',
    password_too_short: 'Password is too short (min 8 chars).',
    role_invalid: 'Invalid role, use admin or reviewer.',
    user_exists: 'Username already exists.',
    invalid_json: 'Invalid request payload.',
    no_changes: 'No changes detected.',
    not_found: 'Target user not found.',
    d1_binding_missing: 'Server database is not configured.',
  };
  const table = isZh ? zh : en;
  return table[code] || '';
};

const resolveOwnerRequestError = (response: Response, data: unknown, isZh: boolean) => {
  const payload = (data || {}) as { error?: unknown; details?: unknown };
  const code = typeof payload.error === 'string' ? payload.error : '';
  const mapped = code ? mapOwnerApiError(code, isZh) : '';
  const fallback = isZh
    ? `请求失败（HTTP ${response.status}）`
    : `Request failed (HTTP ${response.status})`;
  const base = mapped || code || fallback;

  if (Array.isArray(payload.details) && payload.details.length) {
    const detailText = payload.details.map(item => String(item || '').trim()).filter(Boolean).join(', ');
    if (detailText) return `${base}: ${detailText}`;
  }

  return base;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const OperitOwnerAdminPage: React.FC<OperitOwnerAdminPageProps> = ({ language }) => {
  const isZh = language === 'zh';

  const [apiBase, setApiBase] = useState(() => localStorage.getItem(STORAGE.apiBase) || 'https://api.aaswordsman.org');
  const [ownerToken, setOwnerToken] = useState(() => localStorage.getItem(STORAGE.ownerToken) || '');
  const [items, setItems] = useState<OwnerAdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    username: '',
    displayName: '',
    role: 'reviewer' as 'admin' | 'reviewer',
    password: '',
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
    setError(null);
    setSuccess(null);

    if (!ownerToken.trim()) {
      setError(isZh ? '请先填写 Owner token。' : 'Owner token is required.');
      return;
    }

    setLoading(true);
    try {
      const { response, data } = await fetchJson(`${apiBase.replace(/\/+$/, '')}/api/admin/owner/users`, {
        headers: ownerHeaders(),
      });
      if (!response.ok) {
        throw new Error(resolveOwnerRequestError(response, data, isZh));
      }
      const list = (data as { items?: OwnerAdminUser[] })?.items || [];
      setItems(list);
    } catch (err) {
      setError((err as Error).message || (isZh ? '请求失败' : 'Request failed'));
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetchJson, isZh, ownerHeaders, ownerToken]);

  const createUser = useCallback(async () => {
    setCreateError(null);
    setSuccess(null);

    if (!ownerToken.trim()) {
      setCreateError(isZh ? '请先填写 Owner token。' : 'Owner token is required.');
      return;
    }

    const username = createForm.username.trim().toLowerCase();
    const password = createForm.password;

    if (!OWNER_USERNAME_RE.test(username)) {
      setCreateError(
        isZh
          ? '用户名格式不正确（3-32位，仅小写字母/数字/._-）。'
          : 'Invalid username format (3-32 chars, lowercase letters/numbers/._-).',
      );
      return;
    }

    if (password.length < OWNER_PASSWORD_MIN_LENGTH) {
      setCreateError(isZh ? '密码至少 8 位。' : 'Password must be at least 8 characters.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload = {
        username,
        display_name: createForm.displayName.trim() || undefined,
        role: createForm.role,
        password,
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
        throw new Error(resolveOwnerRequestError(response, data, isZh));
      }

      setCreateOpen(false);
      setCreateError(null);
      setCreateForm({ username: '', displayName: '', role: 'reviewer', password: '' });
      setSuccess(isZh ? '管理员创建成功。' : 'Admin created.');
      await loadUsers();
    } catch (err) {
      setCreateError((err as Error).message || (isZh ? '请求失败' : 'Request failed'));
    } finally {
      setCreateSubmitting(false);
    }
  }, [apiBase, createForm, fetchJson, isZh, loadUsers, ownerHeaders, ownerToken]);

  const saveEditUser = useCallback(async () => {
    setEditError(null);
    setSuccess(null);

    if (!ownerToken.trim()) {
      setEditError(isZh ? '请先填写 Owner token。' : 'Owner token is required.');
      return;
    }

    if (!editForm.username.trim()) {
      setEditError(isZh ? '用户名不能为空。' : 'Username is required.');
      return;
    }

    if (editForm.password.trim() && editForm.password.trim().length < OWNER_PASSWORD_MIN_LENGTH) {
      setEditError(isZh ? '新密码至少 8 位。' : 'New password must be at least 8 characters.');
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
        throw new Error(resolveOwnerRequestError(response, data, isZh));
      }

      setEditOpen(false);
      setEditError(null);
      setEditForm({ username: '', displayName: '', role: 'reviewer', password: '', disabled: false });
      setSuccess(isZh ? '管理员更新成功。' : 'Admin updated.');
      await loadUsers();
    } catch (err) {
      setEditError((err as Error).message || (isZh ? '请求失败' : 'Request failed'));
    } finally {
      setEditSubmitting(false);
    }
  }, [apiBase, editForm, fetchJson, isZh, loadUsers, ownerHeaders, ownerToken]);

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
            setEditError(null);
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
                {isZh ? 'Operit 站长后台' : 'Operit Owner Console'}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {isZh ? '仅站长可访问：管理管理员账号、角色与启用状态。' : 'Owner-only panel for managing admin accounts, roles and status.'}
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
                    {isZh ? '加载管理员列表' : 'Load admins'}
                  </Button>
                  <Button
                    onClick={() => {
                      setCreateError(null);
                      setSuccess(null);
                      setCreateOpen(true);
                    }}
                    disabled={!ownerToken.trim()}
                  >
                    {isZh ? '新建管理员' : 'New admin'}
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
            message={isZh ? '站长面板错误' : 'Owner panel error'}
            description={error}
          />
        )}

        {success && (
          <Alert
            type="success"
            showIcon
            style={{ marginTop: 16 }}
            message={isZh ? '操作成功' : 'Success'}
            description={success}
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
          title={isZh ? '创建管理员' : 'Create admin'}
          open={createOpen}
          onCancel={() => {
            setCreateError(null);
            setCreateOpen(false);
          }}
          onOk={createUser}
          confirmLoading={createSubmitting}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {createError && <Alert type="error" showIcon message={createError} />}
            <Input
              value={createForm.username}
              onChange={event => setCreateForm(prev => ({ ...prev, username: event.target.value }))}
              placeholder={isZh ? '用户名（3-32位，小写字母/数字/._-）' : 'username (3-32, lowercase letters/numbers/._-)'}
            />
            <Input
              value={createForm.displayName}
              onChange={event => setCreateForm(prev => ({ ...prev, displayName: event.target.value }))}
              placeholder={isZh ? '显示名（可选）' : 'display name (optional)'}
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
              placeholder={isZh ? '密码（至少8位）' : 'password (min 8 chars)'}
            />
            <Text type="secondary">
              {isZh
                ? '密码至少 8 位；用户名只能小写字母/数字/._-。'
                : 'Password must be at least 8 chars; username allows lowercase letters/numbers/._-.'}
            </Text>
          </Space>
        </Modal>

        <Modal
          title={isZh ? `编辑管理员：${editForm.username || '-'}` : `Edit admin: ${editForm.username || '-'}`}
          open={editOpen}
          onCancel={() => {
            setEditError(null);
            setEditOpen(false);
          }}
          onOk={saveEditUser}
          confirmLoading={editSubmitting}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {editError && <Alert type="error" showIcon message={editError} />}
            <Input disabled value={editForm.username} placeholder="username" />
            <Input
              value={editForm.displayName}
              onChange={event => setEditForm(prev => ({ ...prev, displayName: event.target.value }))}
              placeholder={isZh ? '显示名（可选）' : 'display name (optional)'}
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
              placeholder={isZh ? '新密码（可选，至少8位）' : 'new password (optional, min 8 chars)'}
            />
            <Space>
              <Switch
                checked={editForm.disabled}
                onChange={checked => setEditForm(prev => ({ ...prev, disabled: checked }))}
              />
              <Text>{isZh ? '禁用账号' : 'Disable account'}</Text>
            </Space>
          </Space>
        </Modal>
      </Content>
    </main>
  );
};

export default OperitOwnerAdminPage;
