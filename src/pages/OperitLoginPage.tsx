import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Layout, Space, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import TurnstileWidget from '../components/TurnstileWidget';

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
  const [turnstileToken, setTurnstileToken] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/config`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setSiteKey(String(data?.turnstile_site_key || ''));
        }
      } catch {
        if (!cancelled) {
          setSiteKey('');
        }
      }
    };

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(isZh ? '请输入用户名和密码。' : 'Username and password are required');
      return;
    }
    if (!siteKey) {
      setError(isZh ? '验证码配置未就绪，请稍后重试。' : 'Verification config is not ready. Please retry.');
      return;
    }
    if (!turnstileToken) {
      setError(isZh ? '请先完成人机验证。' : 'Please complete verification first.');
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
          turnstile_token: turnstileToken,
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
        if (apiError === 'turnstile_failed') {
          setTurnstileToken('');
          setTurnstileResetKey(prev => prev + 1);
          throw new Error(isZh ? '人机验证失败，请重试。' : 'Verification failed, please try again.');
        }
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

            {siteKey ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {isZh ? '请先完成人机验证' : 'Please complete human verification first'}
                </Paragraph>
                <TurnstileWidget
                  key={turnstileResetKey}
                  siteKey={siteKey}
                  onVerify={handleTurnstileVerify}
                  onExpire={handleTurnstileExpire}
                  theme="light"
                />
              </Space>
            ) : (
              <Alert
                type="warning"
                showIcon
                message={isZh ? '未获取到验证码组件，请稍后刷新。' : 'Verification widget not available. Please refresh.'}
              />
            )}

            <Button
              type="primary"
              loading={submitting}
              onClick={handleLogin}
              disabled={!siteKey || !turnstileToken}
            >
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