import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Drawer } from 'antd';
import { ArrowRightOutlined, DownOutlined, MenuOutlined, SettingOutlined, SunOutlined, MoonOutlined, GlobalOutlined, ArrowUpOutlined } from '@ant-design/icons';
import Brand from './Brand';

export interface SitePreferences {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  language: 'zh' | 'en';
  setLanguage: (value: 'zh' | 'en') => void;
  dpi: number;
  setDpi: (value: number) => void;
}

export default function SiteHeader(props: SitePreferences) {
  const { language, darkMode, setDarkMode, setLanguage, dpi, setDpi } = props;
  const zh = language === 'zh';
  const location = useLocation();
  const [panel, setPanel] = useState<'products' | 'settings' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const productsButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setPanel(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !panel) return;
      (panel === 'products' ? productsButton : settingsButton).current?.focus();
      setPanel(null);
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [panel]);

  const close = () => { setPanel(null); setMobileOpen(false); };
  const preferences = <div className="site-preferences">
    <div className="site-preference-row"><span>{zh ? '外观' : 'Appearance'}</span><div className="site-choice" role="group" aria-label={zh ? '外观' : 'Appearance'}>
      <button aria-pressed={darkMode} onClick={() => setDarkMode(true)}><MoonOutlined />{zh ? '深色' : 'Dark'}</button>
      <button aria-pressed={!darkMode} onClick={() => setDarkMode(false)}><SunOutlined />{zh ? '浅色' : 'Light'}</button>
    </div></div>
    <div className="site-preference-row"><span><GlobalOutlined /> {zh ? '语言' : 'Language'}</span><div className="site-choice" role="group" aria-label={zh ? '语言' : 'Language'}><button aria-pressed={zh} onClick={() => setLanguage('zh')}>中文</button><button aria-pressed={!zh} onClick={() => setLanguage('en')}>EN</button></div></div>
    <label className="site-preference-row"><span>{zh ? '界面缩放' : 'Interface scale'}</span><select value={dpi} onChange={event => setDpi(Number(event.target.value))}>{[75,90,100,110,125].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
  </div>;

  return <>
    <a className="site-skip" href="#site-content">{zh ? '跳至主要内容' : 'Skip to content'}</a>
    <header className="site-header" ref={headerRef} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setPanel(null); }}>
      <div className="site-header-inner">
        <Brand onClick={close} />
        <nav className="site-navigation" aria-label={zh ? '主导航' : 'Main navigation'}>
          <button ref={productsButton} className={panel === 'products' ? 'is-open' : ''} aria-expanded={panel === 'products'} aria-controls="site-products" onClick={() => setPanel(panel === 'products' ? null : 'products')}>{zh ? '产品' : 'Products'}<DownOutlined /></button>
          <Link to="/guide" onClick={close} aria-current={location.pathname.startsWith('/guide') ? 'page' : undefined}>{zh ? '文档' : 'Docs'}</Link>
          <Link to="/market" onClick={close} aria-current={location.pathname.startsWith('/market') ? 'page' : undefined}>{zh ? '插件市场' : 'Marketplace'}</Link>
          <a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer">{zh ? '社区' : 'Community'}<ArrowUpOutlined className="site-external-arrow" /></a>
        </nav>
        <div className="site-header-tools">
          <Link className="site-account" to="/operit-submission-center" onClick={close}>{zh ? '个人中心' : 'My account'}</Link>
          <div className="site-settings-wrap"><button ref={settingsButton} className="site-icon-button site-settings-trigger" aria-label={zh ? '网站设置' : 'Site settings'} aria-expanded={panel === 'settings'} aria-controls="site-settings" onClick={() => setPanel(panel === 'settings' ? null : 'settings')}><SettingOutlined /></button>
            {panel === 'settings' && <section id="site-settings" className="site-settings-panel" aria-label={zh ? '网站设置' : 'Site settings'}><h2>{zh ? '按你的习惯' : 'Make it yours'}</h2>{preferences}</section>}
          </div>
          <Link to="/classic" className="site-header-start" onClick={close}>{zh ? '开始使用' : 'Get started'}<ArrowRightOutlined /></Link>
          <button className="site-icon-button site-mobile-trigger" aria-label={zh ? '打开导航菜单' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><MenuOutlined /></button>
        </div>
      </div>
      {panel === 'products' && <section id="site-products" className="site-product-menu" aria-label={zh ? '产品导航' : 'Products'}>
        <div className="site-product-menu-heading"><span className="site-overline">THE OPERIT FAMILY</span><p>{zh ? '选择适合你的体验。' : 'Find your experience.'}</p></div>
        <Link to="/" onClick={close}><span className="site-menu-product-icon">2</span><div><strong>Operit 2 <span className="site-small-label">{zh ? '内测中' : 'Private beta'}</span></strong><p>{zh ? '下一代 Operit，全新体验敬请期待。' : 'The next generation. A new experience awaits.'}</p></div><ArrowRightOutlined /></Link>
        <Link to="/classic" onClick={close}><span className="site-menu-product-icon site-menu-product-icon-legacy">1</span><div><strong>Operit 1</strong><p>{zh ? '即刻探索 Android AI 助手与工具生态。' : 'Explore the Android AI assistant and its tools.'}</p></div><ArrowRightOutlined /></Link>
      </section>}
    </header>
    <Drawer title={<Brand onClick={close} />} open={mobileOpen} onClose={close} width="min(420px, 100vw)" className="site-mobile-drawer">
      <span className="site-overline">EXPLORE OPERIT</span>
      <nav className="site-mobile-navigation" aria-label={zh ? '移动导航' : 'Mobile navigation'}>
        {[[ '/', 'Operit 2'], ['/classic','Operit 1'], ['/guide',zh ? '使用文档' : 'Documentation'], ['/market',zh ? '插件市场' : 'Marketplace'], ['/operit-submission-center',zh ? '个人中心' : 'My account']].map(([to,label]) => <Link key={to} to={to} onClick={close}>{label}<ArrowRightOutlined /></Link>)}
        <a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer">{zh ? '社区交流' : 'Community'}<ArrowUpOutlined className="site-external-arrow" /></a>
      </nav>
      <div className="site-mobile-preferences"><span className="site-overline">{zh ? '外观与偏好' : 'PREFERENCES'}</span>{preferences}</div>
    </Drawer>
  </>;
}
