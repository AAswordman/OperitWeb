import React, { useMemo, useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import FooterComponent from '../components/Footer';

const { Sider, Content } = Layout;
const CATEGORY_SLUG = 'beginner-tutorial';

const GuideNewPage: React.FC<{ darkMode: boolean; language: 'zh' | 'en' }> = ({ darkMode, language }) => {
  const location = useLocation();
  const { category, slug } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [broken, setBroken] = useState(false);

  const tutorialItems = useMemo(() => (
    language === 'zh'
      ? [
          { slug: '01-quick-start', label: '01. 快速开始' },
          { slug: '02-permission-authorization', label: '02. 权限授权详解' },
          { slug: '03-interface-overview', label: '03. 初识界面' },
          { slug: '04-model-configuration', label: '04. 模型配置' },
          { slug: '05-feature-models', label: '05. 功能模型详解' },
          { slug: '06-context-and-compression', label: '06. 上下文与压缩' },
          { slug: '07-character-cards', label: '07. 角色卡' },
          { slug: '08-character-tags', label: '08. 角色标签' },
          { slug: '09-built-in-tools-and-permissions', label: '09. 内置工具与权限' },
          { slug: '10-tool-sandbox-package', label: '10. 工具：沙盒包' },
          { slug: '11-tool-mcp', label: '11. 工具：MCP' },
          { slug: '12-tool-skill', label: '12. 工具：SKILL' },
          { slug: '13-waifu-mode', label: '13. WAIFU模式' },
          { slug: '14-workspace-basics', label: '14. 工作区基础' },
          { slug: '15-data-backup', label: '15. 数据备份' },
          { slug: '16-statistics', label: '16. 统计' },
        ]
      : [
          { slug: '01-quick-start', label: '01. Quick Start' },
          { slug: '02-permission-authorization', label: '02. Permissions Explained' },
          { slug: '03-interface-overview', label: '03. First Look at the UI' },
          { slug: '04-model-configuration', label: '04. Model Configuration' },
          { slug: '05-feature-models', label: '05. Feature Models Explained' },
          { slug: '06-context-and-compression', label: '06. Context and Compression' },
          { slug: '07-character-cards', label: '07. Character Cards' },
          { slug: '08-character-tags', label: '08. Character Tags' },
          { slug: '09-built-in-tools-and-permissions', label: '09. Built-in Tools and Permissions' },
          { slug: '10-tool-sandbox-package', label: '10. Tool: Sandbox Package' },
          { slug: '11-tool-mcp', label: '11. Tool: MCP' },
          { slug: '12-tool-skill', label: '12. Tool: SKILL' },
          { slug: '13-waifu-mode', label: '13. WAIFU Mode' },
          { slug: '14-workspace-basics', label: '14. Workspace Basics' },
          { slug: '15-data-backup', label: '15. Data Backup' },
          { slug: '16-statistics', label: '16. Statistics' },
        ]
  ), [language]);

  const labels = useMemo(() => (
    language === 'zh'
      ? {
          welcome: '欢迎页',
          beginner: '初级教程',
        }
      : {
          welcome: 'Welcome',
          beginner: 'Beginner Tutorial',
        }
  ), [language]);

  const menuItems = useMemo(() => [
    { key: 'welcome', label: <Link to="/guide/new">{labels.welcome}</Link> },
    {
      key: 'beginner',
      label: labels.beginner,
      children: tutorialItems.map((item) => ({
        key: item.slug,
        label: <Link to={`/guide/new/${CATEGORY_SLUG}/${item.slug}`}>{item.label}</Link>,
      })),
    },
  ], [labels, tutorialItems]);

  const selectedKeys = useMemo(() => {
    if (location.pathname === '/guide/new' || location.pathname === '/guide/new/') {
      return ['welcome'];
    }
    return [slug ? decodeURIComponent(slug) : 'welcome'];
  }, [location.pathname, slug]);

  const defaultOpenKeys = useMemo(() => {
    if (category === CATEGORY_SLUG || slug) {
      return ['beginner'];
    }
    return [];
  }, [category, slug]);

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', paddingTop: 64, background: 'transparent' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={setBroken}
        trigger={null}
        style={{
          overflow: 'auto',
          height: 'calc(100vh - 64px)',
          background: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
          backdropFilter: 'blur(10px)',
          borderRight: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
          zIndex: 1001,
          position: broken ? 'fixed' : 'relative',
          top: broken ? '64px' : 'auto',
          left: broken ? 0 : 'auto',
        }}
      >
        <Menu
          theme={darkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={defaultOpenKeys}
          items={menuItems}
          style={{ height: '100%', borderRight: 0, background: 'transparent' }}
        />
      </Sider>
      <Layout style={{ background: 'transparent', minWidth: 0 }}>
        {broken && !collapsed && (
          <div
            style={{
              position: 'fixed',
              top: 64,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
            }}
            onClick={() => setCollapsed(true)}
          />
        )}

        {broken && (
          <Button
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'fixed',
              top: 74,
              left: 16,
              zIndex: 1002,
            }}
            type="primary"
            shape="circle"
          />
        )}

        <Content
          style={{
            margin: 0,
            minHeight: 280,
            height: 'calc(100vh - 64px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: broken ? '8px' : '24px',
            }}
          >
            <div
              style={{
                background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.72)',
                backdropFilter: 'blur(10px)',
                border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                borderRadius: 12,
                padding: '6px 24px',
                minHeight: '100%',
              }}
            >
              <Outlet />
            </div>
            <div style={{ marginTop: 16 }}>
              <FooterComponent language={language} />
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default GuideNewPage;
