import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/guide', label: <Link to="/guide">欢迎</Link> },
  { key: 'quick-start', label: <Link to="/guide/quick-start">快速使用</Link> },
  {
    key: 'basic-config',
    label: '基础配置',
    children: [
      { key: 'model-config', label: <Link to="/guide/basic-config/model-config">模型配置</Link> },
      { key: 'functional-model-config', label: <Link to="/guide/basic-config/functional-model-config">功能模型配置</Link> },
      { key: 'user-preferences', label: <Link to="/guide/basic-config/user-preferences">用户偏好配置</Link> },
      { key: 'ai-permissions', label: <Link to="/guide/basic-config/ai-permissions">AI权限控制</Link> },
      { key: 'software-authorization', label: <Link to="/guide/basic-config/software-authorization">授权软件</Link> },
    ],
  },
  {
    key: 'character-system',
    label: '角色与对话',
    children: [
      { key: 'character-cards', label: <Link to="/guide/character-system/character-cards">角色卡</Link> },
      { key: 'tags', label: <Link to="/guide/character-system/tags">标签</Link> },
      { key: 'voice-chat', label: <Link to="/guide/character-system/voice-chat">语音对话</Link> },
      { key: 'desktop-pet', label: <Link to="/guide/character-system/desktop-pet">桌宠</Link> },
    ],
  },
  {
    key: 'tools-and-features',
    label: '工具与功能',
    children: [
      { key: 'ai-tools', label: <Link to="/guide/tools-and-features/ai-tools">AI工具</Link> },
      { key: 'toolkits', label: <Link to="/guide/tools-and-features/toolkits">工具包</Link> },
      { key: 'mcp', label: <Link to="/guide/tools-and-features/mcp">MCP</Link> },
      { key: 'knowledge-base', label: <Link to="/guide/tools-and-features/knowledge-base">知识库</Link> },
      { key: 'toolbox', label: <Link to="/guide/tools-and-features/toolbox">工具箱</Link> },
    ],
  },
  {
    key: 'development',
    label: '开发与部署',
    children: [
      { key: 'web-development', label: <Link to="/guide/development/web-development">制作Web</Link> },
      { key: 'web-packaging', label: <Link to="/guide/development/web-packaging">打包Web为软件</Link> },
      { key: 'mobile-development', label: <Link to="/guide/development/mobile-development">移动端开发</Link> },
    ],
  },
  {
    key: 'interface-guide',
    label: '界面指南',
    children: [
      { key: 'panel-introduction', label: <Link to="/guide/interface-guide/panel-introduction">面板介绍</Link> },
    ],
  },
  
  { key: 'return-code-generator', label: <Link to="/guide/tools-and-features/return-code-generator">返回码生成器</Link> },
  { key: 'faq', label: <Link to="/guide/faq">常见问题</Link> },
];

const GuidePage: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [broken, setBroken] = useState(false);
  const location = useLocation();

  const isToolPage = location.pathname.startsWith('/guide/tools/');

  const getSelectedKeys = () => {
    const path = location.pathname.split('/').pop() || 'quick-start';
    if (location.pathname === '/guide' || location.pathname === '/guide/') {
      return ['/guide'];
    }
    if (location.pathname.includes('/guide/tools/')) {
      return [path];
    }
    return [path];
  };
  
  const getDefaultOpenKeys = () => {
    const pathParts = location.pathname.split('/');
    if (pathParts.length > 3 && pathParts[1] === 'guide') {
      return [pathParts[2]];
    }
    return [];
  };

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
          zIndex: 1001, // 设置比Header更高的z-index
          position: broken ? 'fixed' : 'relative', // 移动端时使用固定定位
          top: broken ? '64px' : 'auto',
          left: broken ? 0 : 'auto',
        }}
      >
        <Menu
          theme={darkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getDefaultOpenKeys()}
          items={menuItems}
          style={{ height: '100%', borderRight: 0, background: 'transparent' }}
            />
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        {/* 移动端遮罩层 */}
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
              zIndex: 1002, // 确保按钮在遮罩层之上
            }}
            type="primary"
            shape="circle"
          />
        )}
        <Content 
          style={{ 
            padding: isToolPage ? '0' : '24px', 
            margin: 0, 
            minHeight: 280,
            height: 'calc(100vh - 64px)', // 固定高度
            overflow: 'auto', // 独立滚动
          }}
        >
          {isToolPage ? (
            <Outlet />
          ) : (
            <div style={{
              background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              borderRadius: '12px',
              padding: '24px',
              minHeight: 'calc(100vh - 112px)', // 确保内容有足够高度
            }}>
              <Outlet />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default GuidePage; 