import React from 'react';
import { Layout, Card, Col, Row, Typography } from 'antd';
import { BookOutlined, CodeOutlined, ReadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import FooterComponent from '../components/Footer';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const GuideHubPage: React.FC<{ darkMode: boolean; language: 'zh' | 'en' }> = ({ darkMode, language }) => {
  const copy = language === 'zh'
    ? {
        title: '用户手册',
        desc: '从这里进入旧文档、新文档占位页和插件教程。当前完整可用内容仍以旧文档为主。',
        cards: [
          {
            title: '旧文档',
            desc: '进入现有完整用户文档，保留原来的目录、搜索和内容结构。',
            link: '/guide/old',
            icon: <BookOutlined />,
          },
          {
            title: '新文档',
            desc: '进入新版用户文档占位页。这里后续会承接重写后的教程内容。',
            link: '/guide/new',
            icon: <ReadOutlined />,
          },
          {
            title: '插件教程',
            desc: '进入插件开发教程，查看插件结构、调试与实践内容。',
            link: '/guide/plugin',
            icon: <CodeOutlined />,
          },
        ],
      }
    : {
        title: 'User Guide',
        desc: 'Choose between the legacy docs, the new-docs placeholder, and the plugin tutorial. The legacy docs remain the main complete manual for now.',
        cards: [
          {
            title: 'Legacy Docs',
            desc: 'Open the current full user manual with the original sidebar, search, and content structure.',
            link: '/guide/old',
            icon: <BookOutlined />,
          },
          {
            title: 'New Docs',
            desc: 'Open the placeholder page for the rewritten user guide. New tutorial-style content will land here later.',
            link: '/guide/new',
            icon: <ReadOutlined />,
          },
          {
            title: 'Plugin Tutorial',
            desc: 'Open the plugin tutorial for structure, debugging, and hands-on development guides.',
            link: '/guide/plugin',
            icon: <CodeOutlined />,
          },
        ],
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
            maxWidth: 1080,
            width: '100%',
            margin: '0 auto',
            flex: 1,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.72)',
              backdropFilter: 'blur(10px)',
              border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              borderRadius: 12,
              padding: '32px 24px',
              minHeight: '100%',
            }}
          >
            <Title level={2} style={{ textAlign: 'center', marginBottom: 12 }}>
              {copy.title}
            </Title>
            <Paragraph style={{ textAlign: 'center', marginBottom: 32, fontSize: 16 }}>
              {copy.desc}
            </Paragraph>
            <Row gutter={[24, 24]}>
              {copy.cards.map((card) => (
                <Col xs={24} md={8} key={card.link}>
                  <Link to={card.link}>
                    <Card hoverable style={{ height: '100%' }}>
                      <Card.Meta
                        avatar={React.cloneElement(card.icon, { style: { fontSize: '32px', color: '#1677ff' } })}
                        title={<Title level={5}>{card.title}</Title>}
                        description={<Paragraph style={{ minHeight: 66 }}>{card.desc}</Paragraph>}
                      />
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
            <div style={{ marginTop: 32 }}>
              <FooterComponent language={language} />
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default GuideHubPage;
