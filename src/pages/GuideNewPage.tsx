import React, { useMemo, useState, useRef } from 'react';
import { Layout, Menu, Button, Input } from 'antd';
import { Outlet, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined } from '@ant-design/icons';
import FooterComponent from '../components/Footer';
import { translations } from '../translations';

const { Sider, Content } = Layout;
const CATEGORY_SLUG = 'beginner-tutorial';

const GuideNewPage: React.FC<{ darkMode: boolean; language: 'zh' | 'en' }> = ({ darkMode, language }) => {
  const location = useLocation();
  const { category, slug } = useParams();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [broken, setBroken] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentCacheRef = useRef(new Map<string, string>());

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
          { slug: '08-built-in-tools-and-permissions', label: '08. 内置工具与权限' },
          { slug: '09-tool-sandbox-package', label: '09. 工具：沙盒包' },
          { slug: '10-tool-mcp', label: '10. 工具：MCP' },
          { slug: '11-tool-skill', label: '11. 工具：SKILL' },
          { slug: '12-waifu-mode', label: '12. WAIFU模式' },
          { slug: '13-workspace-basics', label: '13. 工作区基础' },
          { slug: '14-data-backup', label: '14. 数据备份' },
          { slug: '15-statistics', label: '15. 统计' },
        ]
      : [
          { slug: '01-quick-start', label: '01. Quick Start' },
          { slug: '02-permission-authorization', label: '02. Permissions Explained' },
          { slug: '03-interface-overview', label: '03. First Look at the UI' },
          { slug: '04-model-configuration', label: '04. Model Configuration' },
          { slug: '05-feature-models', label: '05. Feature Models Explained' },
          { slug: '06-context-and-compression', label: '06. Context and Compression' },
          { slug: '07-character-cards', label: '07. Character Cards' },
          { slug: '08-built-in-tools-and-permissions', label: '08. Built-in Tools and Permissions' },
          { slug: '09-tool-sandbox-package', label: '09. Tool: Sandbox Package' },
          { slug: '10-tool-mcp', label: '10. Tool: MCP' },
          { slug: '11-tool-skill', label: '11. Tool: SKILL' },
          { slug: '12-waifu-mode', label: '12. WAIFU Mode' },
          { slug: '13-workspace-basics', label: '13. Workspace Basics' },
          { slug: '14-data-backup', label: '14. Data Backup' },
          { slug: '15-statistics', label: '15. Statistics' },
        ]
  ), [language]);

  const labels = useMemo(() => (
    language === 'zh'
      ? {
          welcome: '欢迎页',
          beginner: '初级教程',
          searchPlaceholder: '搜索教程...',
          searching: '搜索中...',
          searchResults: '搜索结果',
          noResults: '未找到相关内容',
        }
      : {
          welcome: 'Welcome',
          beginner: 'Beginner Tutorial',
          searchPlaceholder: 'Search tutorials...',
          searching: 'Searching...',
          searchResults: 'Search Results',
          noResults: 'No results found',
        }
  ), [language]);

  const t = labels;

  // 搜索功能
  const searchTutorials = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results: any[] = [];

    for (const item of tutorialItems) {
      const labelLower = item.label.toLowerCase();
      const queryLower = query.trim().toLowerCase();
      
      if (labelLower.includes(queryLower)) {
        results.push({
          key: item.slug,
          label: item.label,
          path: `/guide/new/${CATEGORY_SLUG}/${item.slug}`,
          score: 100,
          matchType: 'title' as const,
        });
        continue;
      }

      // 搜索文档内容
      try {
        const filePath = `/newcontent/${language}/${CATEGORY_SLUG}/${item.slug}.md`;
        let content = contentCacheRef.current.get(filePath);
        if (!content) {
          const response = await fetch(filePath);
          if (response.ok) {
            content = await response.text();
            contentCacheRef.current.set(filePath, content);
          }
        }

        if (content && content.toLowerCase().includes(queryLower)) {
          const matchIndex = content.toLowerCase().indexOf(queryLower);
          const start = Math.max(0, matchIndex - 40);
          const end = Math.min(content.length, matchIndex + 80);
          const highlight = content.slice(start, end).replace(/\s+/g, ' ').trim();

          results.push({
            key: item.slug,
            label: item.label,
            path: `/guide/new/${CATEGORY_SLUG}/${item.slug}`,
            score: 60,
            matchType: 'content' as const,
            highlight,
          });
        }
      } catch (error) {
        console.error(`Error searching ${item.slug}:`, error);
      }
    }

    results.sort((a, b) => b.score - a.score);
    setSearchResults(results.slice(0, 10));
    setIsSearching(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchTutorials(value);
    }, 250);
  };

  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setSearchResults([]);
  };

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

  const isScreenshotMode = useMemo(
    () => new URLSearchParams(location.search).get('mode') === 'screenshot',
    [location.search],
  );

  return (
    <Layout
      style={{
        minHeight: isScreenshotMode ? 'auto' : 'calc(100vh - 64px)',
        paddingTop: isScreenshotMode ? 0 : 64,
        background: isScreenshotMode ? '#ffffff' : 'transparent',
      }}
    >
      {!isScreenshotMode && <Sider
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
        <div style={{ padding: '12px', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)' }}>
          <Input
            placeholder={t.searchPlaceholder}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={handleSearchChange}
            allowClear
            style={{
              background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
              borderRadius: '8px',
            }}
          />
        </div>

        {searchQuery && (
          <div style={{
            padding: '8px 12px',
            borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {isSearching ? (
              <div style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', padding: '8px' }}>
                {t.searching}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div style={{
                  fontSize: '12px',
                  color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  {t.searchResults} ({searchResults.length})
                </div>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleResultClick(result.path)}
                    style={{
                      padding: '8px 12px',
                      marginBottom: '4px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: darkMode ? '#fff' : '#000',
                      marginBottom: '4px',
                    }}>
                      {result.label}
                    </div>
                    {result.matchType === 'content' && result.highlight && (
                      <div style={{
                        fontSize: '12px',
                        color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {result.highlight}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', padding: '8px' }}>
                {t.noResults}
              </div>
            )}
          </div>
        )}

        <Menu
          theme={darkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={defaultOpenKeys}
          items={menuItems}
          style={{ height: '100%', borderRight: 0, background: 'transparent' }}
        />
      </Sider>}
      <Layout style={{ background: 'transparent', minWidth: 0 }}>
        {!isScreenshotMode && broken && !collapsed && (
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

        {!isScreenshotMode && broken && (
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
            height: isScreenshotMode ? 'auto' : 'calc(100vh - 64px)',
            overflow: isScreenshotMode ? 'visible' : 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: isScreenshotMode ? 'visible' : 'auto',
              padding: isScreenshotMode ? '32px 0 48px' : broken ? '8px' : '24px',
            }}
          >
            <div
              style={{
                background: isScreenshotMode
                  ? 'transparent'
                  : darkMode
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(255, 255, 255, 0.72)',
                backdropFilter: isScreenshotMode ? 'none' : 'blur(10px)',
                border: isScreenshotMode
                  ? 'none'
                  : darkMode
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : 'none',
                borderRadius: isScreenshotMode ? 0 : 12,
                padding: isScreenshotMode ? 0 : '6px 24px',
                minHeight: '100%',
              }}
            >
              <Outlet />
            </div>
            {!isScreenshotMode && <div style={{ marginTop: 16 }}>
              <FooterComponent language={language} />
            </div>}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default GuideNewPage;
