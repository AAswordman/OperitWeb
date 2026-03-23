import React, { useMemo, useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import FooterComponent from '../components/Footer';

const { Sider, Content } = Layout;

const PluginTutorialPage: React.FC<{
  darkMode: boolean;
  language: 'zh' | 'en';
  basePath?: string;
  homePath?: string;
}> = ({
  darkMode,
  language,
  basePath = '/guide/plugin',
  homePath = '/guide'
}) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [broken, setBroken] = useState(false);
  const basePathParts = useMemo(() => basePath.split('/').filter(Boolean), [basePath]);
  const linkTo = (path?: string) => path ? `${basePath}/${path}` : basePath;

  const labels = useMemo(() => (
    language === 'zh'
      ? {
          guideHome: '用户手册首页',
          overview: '总览',
          setup: '起步与仓库',
          javascript: 'JavaScript 脚本包',
          typescriptIntro: 'TypeScript 入门',
          engineering: 'TypeScript 工程化',
          toolpkg: 'ToolPkg 插件包',
          debugging: '调试与排错',
          setupAndRepoMap: '开发环境与仓库地图',
          javascriptBasics: '变量、对象与数组',
          javascriptFunctionsFlow: '函数、模板字符串与流程控制',
          javascriptAsyncRuntime: '异步、错误处理与宿主运行时',
          javascriptPackage: '第一个 JavaScript 脚本包',
          metadataExportsComplete: 'METADATA、exports 与 complete',
          typescriptBasics: 'TypeScript 类型入门',
          migrateJsToTs: '从 JavaScript 迁移到 TypeScript',
          tsconfig: 'tsconfig 基础模板',
          tsconfigScenarios: '场景化 tsconfig 与排错',
          projectStructure: '项目结构与目录演进',
          toolpkgBasics: 'ToolPkg 基础与 manifest',
          toolpkgMainAndHooks: 'main、hooks 与注册流程',
          buildAndDebug: '编译、运行与调试',
          pitfalls: '常见坑与定位方法',
        }
      : {
          guideHome: 'Manual Home',
          overview: 'Overview',
          setup: 'Setup & Repo',
          javascript: 'JavaScript Script Packages',
          typescriptIntro: 'TypeScript Intro',
          engineering: 'TypeScript Engineering',
          toolpkg: 'ToolPkg Bundles',
          debugging: 'Debugging',
          setupAndRepoMap: 'Environment & Repo Map',
          javascriptBasics: 'Values, Objects & Arrays',
          javascriptFunctionsFlow: 'Functions, Templates & Flow Control',
          javascriptAsyncRuntime: 'Async, Errors & Host Runtime',
          javascriptPackage: 'Your First JavaScript Package',
          metadataExportsComplete: 'METADATA, exports & complete',
          typescriptBasics: 'TypeScript Type Basics',
          migrateJsToTs: 'Migrate JavaScript to TypeScript',
          tsconfig: 'tsconfig Basics',
          tsconfigScenarios: 'Scenario tsconfig & Troubleshooting',
          projectStructure: 'Project Structure & Evolution',
          toolpkgBasics: 'ToolPkg Basics & manifest',
          toolpkgMainAndHooks: 'main, Hooks & Registration',
          buildAndDebug: 'Build, Run & Debug',
          pitfalls: 'Pitfalls & Diagnostics',
        }
  ), [language]);

  const menuItems = useMemo(() => [
    { key: 'guide-home', label: <Link to={homePath}>{labels.guideHome}</Link> },
    { key: 'overview', label: <Link to={linkTo()}>{labels.overview}</Link> },
    {
      key: 'setup',
      label: labels.setup,
      children: [
        { key: 'setup-and-repo-map', label: <Link to={linkTo('setup-and-repo-map')}>{labels.setupAndRepoMap}</Link> },
      ],
    },
    {
      key: 'javascript',
      label: labels.javascript,
      children: [
        { key: 'javascript-basics', label: <Link to={linkTo('javascript-basics')}>{labels.javascriptBasics}</Link> },
        { key: 'javascript-functions-flow', label: <Link to={linkTo('javascript-functions-flow')}>{labels.javascriptFunctionsFlow}</Link> },
        { key: 'javascript-async-runtime', label: <Link to={linkTo('javascript-async-runtime')}>{labels.javascriptAsyncRuntime}</Link> },
        { key: 'javascript-package', label: <Link to={linkTo('javascript-package')}>{labels.javascriptPackage}</Link> },
        { key: 'metadata-exports-complete', label: <Link to={linkTo('metadata-exports-complete')}>{labels.metadataExportsComplete}</Link> },
      ],
    },
    {
      key: 'typescript-intro',
      label: labels.typescriptIntro,
      children: [
        { key: 'typescript-basics', label: <Link to={linkTo('typescript-basics')}>{labels.typescriptBasics}</Link> },
      ],
    },
    {
      key: 'engineering',
      label: labels.engineering,
      children: [
        { key: 'migrate-js-to-ts', label: <Link to={linkTo('migrate-js-to-ts')}>{labels.migrateJsToTs}</Link> },
        { key: 'tsconfig', label: <Link to={linkTo('tsconfig')}>{labels.tsconfig}</Link> },
        { key: 'tsconfig-scenarios', label: <Link to={linkTo('tsconfig-scenarios')}>{labels.tsconfigScenarios}</Link> },
        { key: 'project-structure', label: <Link to={linkTo('project-structure')}>{labels.projectStructure}</Link> },
      ],
    },
    {
      key: 'toolpkg',
      label: labels.toolpkg,
      children: [
        { key: 'toolpkg-basics', label: <Link to={linkTo('toolpkg-basics')}>{labels.toolpkgBasics}</Link> },
        { key: 'toolpkg-main-and-hooks', label: <Link to={linkTo('toolpkg-main-and-hooks')}>{labels.toolpkgMainAndHooks}</Link> },
      ],
    },
    {
      key: 'debugging',
      label: labels.debugging,
      children: [
        { key: 'build-and-debug', label: <Link to={linkTo('build-and-debug')}>{labels.buildAndDebug}</Link> },
        { key: 'pitfalls', label: <Link to={linkTo('pitfalls')}>{labels.pitfalls}</Link> },
      ],
    },
  ], [basePath, homePath, labels]);

  const selectedKeys = useMemo(() => {
    if (location.pathname === basePath || location.pathname === `${basePath}/`) {
      return ['overview'];
    }
    const parts = location.pathname.split('/').filter(Boolean);
    return [parts[basePathParts.length] || 'overview'];
  }, [basePath, basePathParts.length, location.pathname]);

  const defaultOpenKeys = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const slug = parts[basePathParts.length];
    const slugGroupMap: Record<string, string> = {
      'setup-and-repo-map': 'setup',
      'javascript-basics': 'javascript',
      'javascript-functions-flow': 'javascript',
      'javascript-async-runtime': 'javascript',
      'javascript-package': 'javascript',
      'metadata-exports-complete': 'javascript',
      'typescript-basics': 'typescript-intro',
      'migrate-js-to-ts': 'engineering',
      'tsconfig': 'engineering',
      'tsconfig-scenarios': 'engineering',
      'project-structure': 'engineering',
      'toolpkg-basics': 'toolpkg',
      'toolpkg-main-and-hooks': 'toolpkg',
      'build-and-debug': 'debugging',
      pitfalls: 'debugging',
    };
    if (!slug) {
      return ['setup', 'javascript', 'typescript-intro', 'engineering', 'toolpkg', 'debugging'];
    }
    if (slugGroupMap[slug]) return [slugGroupMap[slug]];
    return [];
  }, [basePathParts.length, location.pathname]);

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
                background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                borderRadius: '12px',
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

export default PluginTutorialPage;
