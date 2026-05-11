import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Layout, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import TurnstileWidget from '../components/TurnstileWidget';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface OperitReviewerApplyPageProps {
  language: 'zh' | 'en';
}

const STORAGE = {
  reviewerApplyUsername: 'operit_reviewer_apply_username',
  reviewerApplyDisplayName: 'operit_reviewer_apply_display_name',
  reviewerApplyContact: 'operit_reviewer_apply_contact',
};

const API_BASE = 'https://api.aaswordsman.org';

const mapApplyError = (code: string, isZh: boolean) => {
  const zh: Record<string, string> = {
    username_invalid: '用户名不合法（3-32位，仅小写字母/数字/._-）。',
    password_too_short: '密码至少 8 位。',
    reason_too_short: '申请原因至少填写 10 个字。',
    skills_too_short: '请填写你的能力或经验。',
    contact_required: '请填写联系方式。',
    user_exists: '该账号名已存在。',
    application_exists: '这个账号名已经提交过申请。',
    turnstile_failed: '人机验证失败，请重试。',
    invalid_json: '请求格式错误，请重试。',
    d1_binding_missing: '服务端数据库未配置。',
  };
  const en: Record<string, string> = {
    username_invalid: 'Invalid username (3-32 chars, lowercase letters/numbers/._-).',
    password_too_short: 'Password must be at least 8 characters.',
    reason_too_short: 'Please provide a longer application reason.',
    skills_too_short: 'Please describe your skills or experience.',
    contact_required: 'Contact information is required.',
    user_exists: 'This username already exists.',
    application_exists: 'An application already exists for this username.',
    turnstile_failed: 'Verification failed. Please try again.',
    invalid_json: 'Invalid request payload.',
    d1_binding_missing: 'Server database is not configured.',
  };
  return (isZh ? zh : en)[code] || code;
};

const OperitReviewerApplyPage: React.FC<OperitReviewerApplyPageProps> = ({ language }) => {
  const isZh = language === 'zh';
  const navigate = useNavigate();
  const [siteKey, setSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; createdAt: string } | null>(null);
  const [form, setForm] = useState(() => ({
    username: localStorage.getItem(STORAGE.reviewerApplyUsername) || '',
    displayName: localStorage.getItem(STORAGE.reviewerApplyDisplayName) || '',
    contact: localStorage.getItem(STORAGE.reviewerApplyContact) || '',
    password: '',
    reason: '',
    skills: '',
  }));

  useEffect(() => {
    localStorage.setItem(STORAGE.reviewerApplyUsername, form.username);
    localStorage.setItem(STORAGE.reviewerApplyDisplayName, form.displayName);
    localStorage.setItem(STORAGE.reviewerApplyContact, form.contact);
  }, [form.contact, form.displayName, form.username]);

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

  const handleSubmit = useCallback(async () => {
    if (!form.username.trim() || !form.password.trim() || !form.contact.trim() || !form.reason.trim() || !form.skills.trim()) {
      setError(isZh ? '请把必填项填写完整。' : 'Please fill in all required fields.');
      return;
    }
    if (!siteKey) {
      setError(isZh ? '验证码配置未就绪，请稍后再试。' : 'Verification config is not ready yet.');
      return;
    }
    if (!turnstileToken) {
      setError(isZh ? '请先完成人机验证。' : 'Please complete verification first.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reviewer-applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: form.username.trim().toLowerCase(),
          display_name: form.displayName.trim() || undefined,
          contact: form.contact.trim(),
          password: form.password,
          reason: form.reason.trim(),
          skills: form.skills.trim(),
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
        const code = String((data as { error?: string })?.error || `http_${response.status}`);
        throw new Error(mapApplyError(code, isZh));
      }
      setSuccess({
        id: String((data as { id?: string })?.id || ''),
        createdAt: String((data as { created_at?: string })?.created_at || ''),
      });
      setForm(prev => ({ ...prev, password: '', reason: '', skills: '' }));
      setTurnstileToken('');
      setTurnstileResetKey(prev => prev + 1);
    } catch (err) {
      setError((err as Error).message || (isZh ? '申请提交失败。' : 'Failed to submit application.'));
    } finally {
      setSubmitting(false);
    }
  }, [form, isZh, siteKey, turnstileToken]);

  return (
    <main style={{ paddingTop: 88, paddingBottom: 48 }}>
      <Content style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                {isZh ? '申请成为审核员' : 'Apply to Become a Reviewer'}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {isZh
                  ? '填写账号、密码、能力说明、申请原因和联系方式后提交，等待管理员审批。'
                  : 'Submit your account, password, skills, reason, and contact info for admin approval.'}
              </Paragraph>
            </div>

            <Input
              value={form.username}
              onChange={event => setForm(prev => ({ ...prev, username: event.target.value }))}
              placeholder={isZh ? '账号用户名' : 'Account username'}
              autoComplete="username"
            />
            <Input
              value={form.displayName}
              onChange={event => setForm(prev => ({ ...prev, displayName: event.target.value }))}
              placeholder={isZh ? '显示名（可选）' : 'Display name (optional)'}
            />
            <Input.Password
              value={form.password}
              onChange={event => setForm(prev => ({ ...prev, password: event.target.value }))}
              placeholder={isZh ? '账号密码（至少 8 位）' : 'Password (min 8 chars)'}
              autoComplete="new-password"
            />
            <Input
              value={form.contact}
              onChange={event => setForm(prev => ({ ...prev, contact: event.target.value }))}
              placeholder={isZh ? '联系方式（QQ / 邮箱 / Telegram 等）' : 'Contact info (QQ / email / Telegram, etc.)'}
            />
            <TextArea
              value={form.skills}
              onChange={event => setForm(prev => ({ ...prev, skills: event.target.value }))}
              placeholder={isZh ? '你的能力、经验、擅长审核的方向' : 'Your skills, experience, and review strengths'}
              rows={4}
            />
            <TextArea
              value={form.reason}
              onChange={event => setForm(prev => ({ ...prev, reason: event.target.value }))}
              placeholder={isZh ? '申请原因，为什么想成为审核员' : 'Why do you want to become a reviewer?'}
              rows={5}
            />

            {siteKey ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text type="secondary">{isZh ? '请先完成人机验证' : 'Please complete human verification'}</Text>
                <TurnstileWidget
                  key={turnstileResetKey}
                  siteKey={siteKey}
                  onVerify={token => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
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

            <Space wrap>
              <Button type="primary" loading={submitting} disabled={!siteKey || !turnstileToken} onClick={handleSubmit}>
                {isZh ? '提交申请' : 'Submit application'}
              </Button>
              <Button onClick={() => navigate('/operit-login')}>
                {isZh ? '返回登录' : 'Back to login'}
              </Button>
            </Space>

            {error && <Alert type="error" showIcon message={isZh ? '申请失败' : 'Application failed'} description={error} />}

            {success && (
              <Alert
                type="success"
                showIcon
                message={isZh ? '申请已提交' : 'Application submitted'}
                description={
                  isZh
                    ? `申请编号：${success.id}，提交时间：${new Date(success.createdAt).toLocaleString()}。管理员批准后，你就可以用申请的账号登录审核台。`
                    : `Application ID: ${success.id}. Submitted at ${new Date(success.createdAt).toLocaleString()}. You can sign in after approval.`
                }
              />
            )}
          </Space>
        </Card>
      </Content>
    </main>
  );
};

export default OperitReviewerApplyPage;
