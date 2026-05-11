import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Input, Layout, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Paragraph } = Typography;
interface OperitReviewerApplyPageProps {
  language: 'zh' | 'en';
}

const STORAGE = {
  reviewerApplyUsername: 'operit_reviewer_apply_username',
  reviewerApplyDisplayName: 'operit_reviewer_apply_display_name',
  reviewerApplyContactEmail: 'operit_reviewer_apply_contact_email',
  reviewerApplyContactQq: 'operit_reviewer_apply_contact_qq',
  reviewerApplyContactTelegram: 'operit_reviewer_apply_contact_telegram',
};

const API_BASE = 'https://api.aaswordsman.org';

const mapApplyError = (code: string, isZh: boolean) => {
  const zh: Record<string, string> = {
    username_invalid: '用户名不合法（3-32位，仅小写字母/数字/._-）。',
    password_too_short: '密码至少 8 位。',
    contact_required: '请填写联系方式。',
    commitment_required: '请先勾选承诺。',
    user_exists: '该账号名已存在。',
    application_exists: '这个账号名已经提交过申请。',
    invalid_json: '请求格式错误，请重试。',
    d1_binding_missing: '服务端数据库未配置。',
  };
  const en: Record<string, string> = {
    username_invalid: 'Invalid username (3-32 chars, lowercase letters/numbers/._-).',
    password_too_short: 'Password must be at least 8 characters.',
    contact_required: 'Contact information is required.',
    commitment_required: 'Please confirm the commitment first.',
    user_exists: 'This username already exists.',
    application_exists: 'An application already exists for this username.',
    invalid_json: 'Invalid request payload.',
    d1_binding_missing: 'Server database is not configured.',
  };
  return (isZh ? zh : en)[code] || code;
};

const OperitReviewerApplyPage: React.FC<OperitReviewerApplyPageProps> = ({ language }) => {
  const isZh = language === 'zh';
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; createdAt: string } | null>(null);
  const [form, setForm] = useState(() => ({
    username: localStorage.getItem(STORAGE.reviewerApplyUsername) || '',
    displayName: localStorage.getItem(STORAGE.reviewerApplyDisplayName) || '',
    contactEmail: localStorage.getItem(STORAGE.reviewerApplyContactEmail) || '',
    contactQq: localStorage.getItem(STORAGE.reviewerApplyContactQq) || '',
    contactTelegram: localStorage.getItem(STORAGE.reviewerApplyContactTelegram) || '',
    password: '',
    commitment: false,
  }));

  useEffect(() => {
    localStorage.setItem(STORAGE.reviewerApplyUsername, form.username);
    localStorage.setItem(STORAGE.reviewerApplyDisplayName, form.displayName);
    localStorage.setItem(STORAGE.reviewerApplyContactEmail, form.contactEmail);
    localStorage.setItem(STORAGE.reviewerApplyContactQq, form.contactQq);
    localStorage.setItem(STORAGE.reviewerApplyContactTelegram, form.contactTelegram);
  }, [form.contactEmail, form.contactQq, form.contactTelegram, form.displayName, form.username]);

  const handleSubmit = useCallback(async () => {
    if (!form.username.trim() || !form.password.trim()) {
      setError(isZh ? '请把必填项填写完整。' : 'Please fill in all required fields.');
      return;
    }
    if (!form.contactEmail.trim() && !form.contactQq.trim() && !form.contactTelegram.trim()) {
      setError(isZh ? '请至少填写一种联系方式。' : 'Please provide at least one contact channel.');
      return;
    }
    if (!form.commitment) {
      setError(isZh ? '请先勾选承诺。' : 'Please confirm the commitment first.');
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
          contact_email: form.contactEmail.trim() || undefined,
          contact_qq: form.contactQq.trim() || undefined,
          contact_telegram: form.contactTelegram.trim() || undefined,
          password: form.password,
          commitment: true,
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
      setForm(prev => ({ ...prev, password: '', commitment: false }));
    } catch (err) {
      setError((err as Error).message || (isZh ? '申请提交失败。' : 'Failed to submit application.'));
    } finally {
      setSubmitting(false);
    }
  }, [form, isZh]);

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
                  ? '填写账号、密码和联系方式，勾选承诺后直接提交，不需要额外写申请理由。'
                  : 'Submit your account, password, and contact info, then confirm the commitment. No extra reason text is required.'}
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
              value={form.contactEmail}
              onChange={event => setForm(prev => ({ ...prev, contactEmail: event.target.value }))}
              placeholder={isZh ? '邮箱（至少填一种联系方式）' : 'Email (at least one contact channel)'}
            />
            <Input
              value={form.contactQq}
              onChange={event => setForm(prev => ({ ...prev, contactQq: event.target.value }))}
              placeholder={isZh ? 'QQ（可选）' : 'QQ (optional)'}
            />
            <Input
              value={form.contactTelegram}
              onChange={event => setForm(prev => ({ ...prev, contactTelegram: event.target.value }))}
              placeholder={isZh ? 'Telegram（可选）' : 'Telegram (optional)'}
            />
            <Checkbox
              checked={form.commitment}
              onChange={event => setForm(prev => ({ ...prev, commitment: event.target.checked }))}
            >
              {isZh
                ? '我愿意负责任地发电，并认真参与审核。'
                : 'I will contribute responsibly and take review work seriously.'}
            </Checkbox>

            <Space wrap>
              <Button type="primary" loading={submitting} onClick={handleSubmit}>
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
