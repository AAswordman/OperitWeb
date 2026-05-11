import React from 'react';
import { Button, Result, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';

interface NotFoundPageProps {
  language: 'zh' | 'en';
}

const copy = {
  zh: {
    title: '404',
    subtitle: '这个页面不存在，或者链接已经失效。',
    extra: '你可以返回首页，或者去用户指南继续浏览。',
    home: '返回首页',
    guide: '前往指南',
  },
  en: {
    title: '404',
    subtitle: 'This page does not exist or the link is no longer available.',
    extra: 'You can go back home or continue browsing in the guide.',
    home: 'Back Home',
    guide: 'Open Guide',
  },
} as const;

const NotFoundPage: React.FC<NotFoundPageProps> = ({ language }) => {
  const text = copy[language];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px 48px',
      }}
    >
      <Result
        status="404"
        title={text.title}
        subTitle={text.subtitle}
        extra={
          <Space direction="vertical" size="middle" align="center">
            <Typography.Text type="secondary">{text.extra}</Typography.Text>
            <Space wrap>
              <Link to="/">
                <Button type="primary">{text.home}</Button>
              </Link>
              <Link to="/guide">
                <Button>{text.guide}</Button>
              </Link>
            </Space>
          </Space>
        }
      />
    </div>
  );
};

export default NotFoundPage;
