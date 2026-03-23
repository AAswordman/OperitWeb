import React from 'react';
import { Layout, Button, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import FooterComponent from '../components/Footer';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const GuideNewPage: React.FC<{ darkMode: boolean; language: 'zh' | 'en' }> = ({ darkMode, language }) => {
  const copy = language === 'zh'
    ? {
        title: '新文档',
        desc: '新版用户文档会在这里逐步重写。当前这一轮只保留最小占位页，不恢复之前那批多页占位稿。',
        oldDocs: '去旧文档',
        plugin: '去插件教程',
      }
    : {
        title: 'New Docs',
        desc: 'The rewritten user guide will be built here gradually. This round keeps only a minimal placeholder page and does not restore the previous multi-page placeholders.',
        oldDocs: 'Go to Legacy Docs',
        plugin: 'Go to Plugin Tutorial',
      };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', paddingTop: 64, background: 'transparent' }}>
      <Content
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 920,
            width: '100%',
            margin: '0 auto',
            flex: 1,
          }}
        >
          <div
            style={{
              background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.72)',
              backdropFilter: 'blur(10px)',
              border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              borderRadius: 12,
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <Title level={2}>{copy.title}</Title>
            <Paragraph style={{ maxWidth: 720, margin: '0 auto 24px', fontSize: 16 }}>
              {copy.desc}
            </Paragraph>
            <Space wrap>
              <Link to="/guide/old">
                <Button type="primary">{copy.oldDocs}</Button>
              </Link>
              <Link to="/guide/plugin">
                <Button>{copy.plugin}</Button>
              </Link>
            </Space>
          </div>
        </div>
        <div style={{ maxWidth: 920, width: '100%', margin: '16px auto 0' }}>
          <FooterComponent language={language} />
        </div>
      </Content>
    </Layout>
  );
};

export default GuideNewPage;
