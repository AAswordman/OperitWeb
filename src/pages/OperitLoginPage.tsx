import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Layout, Space, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

interface OperitLoginPageProps {
  language: 'zh' | 'en';
}

const STORAGE = {
  adminToken: 'operit_submission_admin_token',
  loginUsername: 'operit_submission_admin_login_username',
};

const API_BASE = 'https://api.aaswordsman.org';

const OperitLoginPage: React.FC<OperitLoginPageProps> = ({ language }) => {
  const isZh = language === 'zh';
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const next = params.get('next') || '/operit-submission-admin';
    if (!next.startsWith('/')) return '/operit-submission-admin';
    return next;
  }, [location.search]);

  const [username, setUsername] = useState(() => localStorage.getItem(STORAGE.loginUsername) || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(isZh ? '请输入用户名和密码' : 'Username and password are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const text = await response.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const apiError = (data as { error?: string })?.error;
        throw new Error(apiError || response.statusText || 'login_failed');
      }

      const token = String((data as { token?: string })?.token || '');
      if (!token) {
        throw new Error('token_missing');
      }

      localStorage.setItem(STORAGE.adminToken, token);
      localStorage.setItem(STORAGE.loginUsername, username.trim());
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError((err as Error).message || (isZh ? '登录失败' : 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 520, margin: '0 auto', padding: '0 24px' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                {isZh ? 'Operit 登录' : 'Operit Login'}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {isZh
                  ? '统一登录入口（后续可扩展普通用户与管理员）。'
                  : 'Unified sign-in entry (extensible for users and admins).'}
              </Paragraph>
            </div>

            <Input
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder={isZh ? '用户名' : 'Username'}
              autoComplete="username"
            />
            <Input.Password
              value={password}
              onChange={event => setPassword(event.target.value)}
              onPressEnter={handleLogin}
              placeholder={isZh ? '密码' : 'Password'}
              autoComplete="current-password"
            />
            <Button type="primary" loading={submitting} onClick={handleLogin}>
              {isZh ? '登录' : 'Sign In'}
            </Button>

            {error && (
              <Alert
                type="error"
                showIcon
                message={isZh ? '登录失败' : 'Sign-in Failed'}
                description={error}
              />
            )}
          </Space>
        </Card>
      </Content>
    </main>
  );
};

export default OperitLoginPage;

