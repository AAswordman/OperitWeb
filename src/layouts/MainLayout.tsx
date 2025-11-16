import React, { useState, useRef } from 'react';
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
  theme,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  GlobalOutlined,
  DownloadOutlined,
  BookOutlined,
  MenuOutlined,
  SunOutlined,
  MoonOutlined,
  GithubOutlined,
  MailOutlined,
  MessageOutlined,
  WechatOutlined,
  ZoomInOutlined,
} from '@ant-design/icons';
import ParticleBackground from '../components/ParticleBackground';
import { translations } from '../translations';
import logo from '/logo.png';

const { Header, Footer } = Layout;
const { Title, Text } = Typography;

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
  const isGuidePage = location.pathname.startsWith('/guide');
  
  return (
    <Layout style={{ 
      minHeight: '100vh',
      background: 'transparent'
    }}>
      {!isGuidePage && <ParticleBackground darkMode={darkMode} />}
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

          <Col xs={0} lg={12}>
            <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
              {isHomePage ? (
                <Anchor
                  direction="horizontal"
                  onClick={handleAnchorClick}
                  items={[
                    { key: 'home', href: '#home', title: t('home') },
                    { key: 'features', href: '#features', title: t('features') },
                    { key: 'guide', href: '#guide', title: t('quickStart') }
                  ]}
                  style={{ backgroundColor: 'transparent' }}
                />
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
                      color: location.pathname === '/guide' ? token.colorPrimary : token.colorText,
                      textDecoration: 'none',
                      fontWeight: location.pathname === '/guide' ? 'bold' : 'normal'
                    }}
                  >
                    {t('userGuide')}
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

                  <Button 
                    type="primary"
                    icon={<DownloadOutlined />}
                    href="https://github.com/AAswordman/Operit/releases"
                    target="_blank"
                  >
                    {t('downloadLatest')}
                  </Button>
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

            <Button 
              type="primary"
              icon={<DownloadOutlined />}
              href="https://github.com/AAswordman/Operit/releases"
              target="_blank"
              style={{ width: '100%' }}
            >
              {t('downloadLatest')}
            </Button>

            <Link to="/guide" style={{ width: '100%' }}>
              <Button 
                type="default"
                icon={<BookOutlined />}
                style={{ width: '100%' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                用户指南
              </Button>
            </Link>
          </Space>
        </div>
      </Drawer>

      <Outlet />

      <Footer style={{ 
        background: 'transparent',
        textAlign: 'center',
        padding: '40px 24px'
      }}>
        <Row justify="center">
          <Col xs={24} lg={16}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space>
                <Avatar 
                  size={32} 
                  src={logo}
                  style={{ backgroundColor: 'transparent' }}
                />
                <Title level={4} style={{ margin: 0, color: token.colorText }}>
                  Operit AI
                </Title>
              </Space>
              
              <div style={{ color: token.colorTextSecondary }}>
                <Title level={5} style={{ color: token.colorText, marginBottom: 12 }}>{t('contact')}</Title>
                <Space wrap size="middle" style={{ justifyContent: 'center' }}>
                  <a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer" style={{ color: token.colorTextSecondary }}>
                    <Space size={4}>
                      <GithubOutlined />
                      <span>{t('githubDiscussions')}</span>
                    </Space>
                  </a>
                  <span>•</span>
                  <a href="mailto:aaswordsman@foxmail.com" style={{ color: token.colorTextSecondary }}>
                    <Space size={4}>
                      <MailOutlined />
                      <span>{t('email')}</span>
                    </Space>
                  </a>
                  <span>•</span>
                  <a href="https://qm.qq.com/q/Sa4fKEH7sO" target="_blank" rel="noopener noreferrer" style={{ color: token.colorTextSecondary }}>
                    <Space size={4}>
                      <WechatOutlined />
                      <span>{t('qqGroup')}</span>
                    </Space>
                  </a>
                  <span>•</span>
                  <a href="https://discord.gg/YnV9MWurRF" target="_blank" rel="noopener noreferrer" style={{ color: token.colorTextSecondary }}>
                    <Space size={4}>
                      <MessageOutlined />
                      <span>{t('discord')}</span>
                    </Space>
                  </a>
                </Space>
              </div>
              
              <Text style={{ color: token.colorTextTertiary, fontSize: 12 }}>
                © 2024 Operit AI. All rights reserved.
              </Text>
            </Space>
          </Col>
        </Row>
      </Footer>

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