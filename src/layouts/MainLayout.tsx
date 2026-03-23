import React, { useState, useRef, Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Typography,
  Button,
  Row,
  Col,
  Space,
  Avatar,
  Switch,
  Dropdown,
  FloatButton,
  Anchor,
  Drawer,
  Spin,
  theme,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  GlobalOutlined,
  BookOutlined,
  MenuOutlined,
  SunOutlined,
  MoonOutlined,
  ZoomInOutlined,
  ShopOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import ParticleBackground from '../components/ParticleBackground';
import DownloadLatestButton from '../components/DownloadLatestButton';
import { translations } from '../translations';
import logo from '/logo.png';
import './MainLayout.css';

const { Header } = Layout;
const { Title } = Typography;

interface Language {
  key: string;
  label: string;
  icon: string;
}

const languages: Language[] = [
  { key: 'zh', label: '简体中文', icon: '🇨🇳' },
  { key: 'en', label: 'English', icon: '🇺🇸' },
];

interface MainLayoutProps {
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;
  dpi: number;
  setDpi: (dpi: number) => void;
}

const RouteFallback: React.FC = () => (
  <div style={{
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 96,
  }}>
    <Spin size="large" />
  </div>
);

const MainLayout: React.FC<MainLayoutProps> = ({ darkMode, setDarkMode, language, setLanguage, dpi, setDpi }) => {
  const { token } = theme.useToken();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef<string>(location.pathname);

  // 响应式处理
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992); // 从768px增加到992px，让平板也使用简化布局
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 回到主页时重置DPI（仅当从其他页面导航到主页时）
  React.useEffect(() => {
    const prevPath = prevPathRef.current;
    const currentPath = location.pathname;
    
    // 如果从其他页面导航到主页，则重置DPI
    if (currentPath === '/' && prevPath !== '/') {
      setDpi(100);
    }
    
    // 更新之前的路径
    prevPathRef.current = currentPath;
  }, [location.pathname, setDpi]);

  const t = (key: string): string => {
    const translation = translations[language];
    const value = translation[key as keyof typeof translation];
    return typeof value === 'string' ? value : key;
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLElement>, link: { href: string }) => {
    e.preventDefault();
    const targetId = link.href.split('#')[1];
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const languageMenuItems: MenuProps['items'] = languages.map(lang => ({
    key: lang.key,
    label: (
      <Space>
        <span>{lang.icon}</span>
        <span>{lang.label}</span>
      </Space>
    ),
    onClick: () => setLanguage(lang.key as 'zh' | 'en'),
  }));

  const dpiOptions = [
    { value: 75, label: t('dpi75') },
    { value: 90, label: t('dpi90') },
    { value: 100, label: t('dpiNormal') },
    { value: 110, label: t('dpi110') },
    { value: 125, label: t('dpi125') },
  ];

  const dpiMenuItems: MenuProps['items'] = dpiOptions.map(option => ({
    key: option.value.toString(),
    label: option.label,
    onClick: () => setDpi(option.value),
  }));

  const isHomePage = location.pathname === '/';
  const isGuideArea = location.pathname.startsWith('/guide');
  const marketLabel = language === 'zh' ? '市场' : 'Market';
  const projectUpdateLabel = language === 'zh' ? '项目近况' : 'Project Update';
  
  return (
    <Layout style={{ 
      minHeight: '100vh',
      background: 'transparent'
    }}>
      {isHomePage && <ParticleBackground darkMode={darkMode} />}
      <Header style={{ 
        background: 'rgba(0,0,0,0)', // Let parent container control color
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: 'fixed',
        width: '100%',
        zIndex: 1000,
        padding: '0 24px'
      }}>
        <Row justify="space-between" align="middle" style={{ height: '100%' }}>
          <Col>
            <Space align="center">
              <Link to="/">
                <Space align="center">
                  <Avatar 
                    size={40} 
                    src={logo}
                    style={{ backgroundColor: 'transparent' }}
                  />
                  <Title 
                    level={3} 
                    style={{ 
                      margin: 0, 
                      color: token.colorText,
                      fontWeight: 'bold',
                      letterSpacing: '1px'
                    }}
                  >
                    Operit AI
                  </Title>
                </Space>
              </Link>
            </Space>
          </Col>

          <Col xs={0} lg={8}>
            <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
              {isHomePage ? (
                <Space size="large">
                  <Anchor
                    direction="horizontal"
                    onClick={(e, link) => {
                      if (link.href.includes('#guide')) {
                        e.preventDefault();
                        navigate('/guide');
                      } else {
                        handleAnchorClick(e, link);
                      }
                    }}
                    items={[
                      { key: 'home', href: '#home', title: t('home') },
                    ]}
                    style={{ backgroundColor: 'transparent' }}
                  />
                  <Link
                    to="/guide"
                    style={{
                      color: token.colorText,
                      textDecoration: 'none'
                    }}
                  >
                    {t('userGuide')}
                  </Link>
                  <Link
                    to="/market"
                    style={{
                      color: token.colorText,
                      textDecoration: 'none'
                    }}
                  >
                    {marketLabel}
                  </Link>
                  <Link
                    to="/project-update"
                    style={{
                      color: token.colorText,
                      textDecoration: 'none'
                    }}
                  >
                    {projectUpdateLabel}
                  </Link>
                  <Link
                    to="/operit-submission-center"
                    style={{
                      color: token.colorText,
                      textDecoration: 'none'
                    }}
                  >
                    {t('personalCenter')}
                  </Link>
                </Space>
              ) : (
                <Space size="large">
                  <Link 
                    to="/" 
                    style={{ 
                      color: token.colorText,
                      textDecoration: 'none'
                    }}
                  >
                    {t('home')}
                  </Link>
                  <Link 
                    to="/guide"
                    style={{ 
                      color: isGuideArea ? token.colorPrimary : token.colorText,
                      textDecoration: 'none',
                      fontWeight: isGuideArea ? 'bold' : 'normal'
                    }}
                  >
                    {t('userGuide')}
                  </Link>
                  <Link
                    to="/market"
                    style={{
                      color: location.pathname.startsWith('/market') ? token.colorPrimary : token.colorText,
                      textDecoration: 'none',
                      fontWeight: location.pathname.startsWith('/market') ? 'bold' : 'normal'
                    }}
                  >
                    {marketLabel}
                  </Link>
                  <Link
                    to="/project-update"
                    style={{
                      color: location.pathname.startsWith('/project-update') ? token.colorPrimary : token.colorText,
                      textDecoration: 'none',
                      fontWeight: location.pathname.startsWith('/project-update') ? 'bold' : 'normal'
                    }}
                  >
                    {projectUpdateLabel}
                  </Link>
                  <Link
                    to="/operit-submission-center"
                    style={{
                      color: location.pathname.startsWith('/operit-submission-center') ? token.colorPrimary : token.colorText,
                      textDecoration: 'none',
                      fontWeight: location.pathname.startsWith('/operit-submission-center') ? 'bold' : 'normal'
                    }}
                  >
                    {t('personalCenter')}
                  </Link>
                </Space>
              )}
            </Space>
          </Col>

          <Col>
            <Space>
              {!isMobile && (
                <>
                  <Switch
                    checkedChildren={<MoonOutlined />}
                    unCheckedChildren={<SunOutlined />}
                    checked={darkMode}
                    onChange={setDarkMode}
                  />
                  
                  <Dropdown menu={{ items: dpiMenuItems }} placement="bottomRight">
                    <Button type="text" icon={<ZoomInOutlined />} title={t('adjustDPI')}>
                      {dpi}%
                    </Button>
                  </Dropdown>
                  
                  <Dropdown menu={{ items: languageMenuItems }} placement="bottomRight">
                    <Button type="text" icon={<GlobalOutlined />}>
                      {languages.find(l => l.key === language)?.icon}
                    </Button>
                  </Dropdown>

                  <DownloadLatestButton
                    downloadText={t('downloadLatest')}
                    language={language}
                    buttonSize="middle"
                    withMotion={false}
                  />
                </>
              )}

              {isMobile && (
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                />
              )}
            </Space>
          </Col>
        </Row>
      </Header>

      {/* 移动端菜单抽屉 */}
      <Drawer
        title="菜单"
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        bodyStyle={{ padding: 0 }}
        headerStyle={{ 
          background: token.colorBgElevated,
          color: token.colorText
        }}
        style={{
          backgroundColor: token.colorBgElevated
        }}
      >
        <div style={{ padding: '20px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Space>
                <span style={{ color: token.colorText }}>主题模式:</span>
                <Switch
                  checkedChildren={<MoonOutlined />}
                  unCheckedChildren={<SunOutlined />}
                  checked={darkMode}
                  onChange={setDarkMode}
                />
              </Space>
            </div>
            
            <div>
              <Space>
                <span style={{ color: token.colorText }}>DPI:</span>
                <Dropdown menu={{ items: dpiMenuItems }} placement="bottomLeft">
                  <Button type="text" icon={<ZoomInOutlined />}>
                    {dpi}%
                  </Button>
                </Dropdown>
              </Space>
            </div>
            
            <div>
              <Space>
                <span style={{ color: token.colorText }}>语言:</span>
                <Dropdown menu={{ items: languageMenuItems }} placement="bottomLeft">
                  <Button type="text" icon={<GlobalOutlined />}>
                    {languages.find(l => l.key === language)?.icon} {languages.find(l => l.key === language)?.label}
                  </Button>
                </Dropdown>
              </Space>
            </div>

            <DownloadLatestButton
              downloadText={t('downloadLatest')}
              language={language}
              block
              buttonSize="middle"
              style={{ width: '100%' }}
              withMotion={false}
            />

            <Link to="/guide" style={{ width: '100%' }}>
              <Button 
                type="default"
                icon={<BookOutlined />}
                style={{ width: '100%' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('userGuide')}
              </Button>
            </Link>

            <Link to="/market" style={{ width: '100%' }}>
              <Button
                type="default"
                icon={<ShopOutlined />}
                style={{ width: '100%' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {marketLabel}
              </Button>
            </Link>

            <Link to="/project-update" style={{ width: '100%' }}>
              <Button
                type="default"
                icon={<ReadOutlined />}
                style={{ width: '100%' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {projectUpdateLabel}
              </Button>
            </Link>

            <Link to="/operit-submission-center" style={{ width: '100%' }}>
              <Button
                type="default"
                icon={<Avatar size="small" src={logo} />}
                style={{ width: '100%' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('personalCenter')}
              </Button>
            </Link>
          </Space>
        </div>
      </Drawer>

      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>

      <FloatButton.Group>
        <FloatButton 
          icon={<BookOutlined />}
          tooltip="用户手册"
          onClick={() => navigate('/guide')}
        />
        <FloatButton.BackTop />
      </FloatButton.Group>
    </Layout>
  );
};

export default MainLayout; 
