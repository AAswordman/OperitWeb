import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Drawer } from 'antd';
import { ArrowRightOutlined, DownOutlined, MenuOutlined, SettingOutlined, SunOutlined, MoonOutlined, GlobalOutlined, ArrowUpOutlined, UnorderedListOutlined, CheckOutlined } from '@ant-design/icons';
import Brand from './Brand';
import { PRODUCTS, PRODUCT_ORDER, SHARED_PATHS } from '../config/products';
import { getNavigationContext, getProductSwitchPath } from '../config/navigation';
import { useDocsNavigation } from '../layouts/DocsNavigationContext';

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
  const { pathname } = useLocation();
  const navigation = getNavigationContext(pathname);
  const { product, guidePath, downloadPath } = navigation;
  const docs = useDocsNavigation();
  const [panel, setPanel] = useState<'products' | 'resources' | 'settings' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const productsButton = useRef<HTMLButtonElement>(null);
  const resourcesButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setPanel(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !panel) return;
      ({ products: productsButton, resources: resourcesButton, settings: settingsButton })[panel].current?.focus();
      setPanel(null);
    }
    const media = window.matchMedia('(max-width: 980px)');
    function resized() { setPanel(null); setMobileOpen(false); }
    media.addEventListener('change', resized);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      media.removeEventListener('change', resized);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [panel]);

  const close = () => { setPanel(null); setMobileOpen(false); };
  const toggle = (name: 'products' | 'resources' | 'settings') => setPanel(panel === name ? null : name);
  const preferences = <div className="site-preferences">
    <div className="site-preference-row"><span>{zh ? '外观' : 'Appearance'}</span><div className="site-choice" role="group" aria-label={zh ? '外观' : 'Appearance'}>
      <button aria-pressed={darkMode} onClick={() => setDarkMode(true)}><MoonOutlined />{zh ? '深色' : 'Dark'}</button>
      <button aria-pressed={!darkMode} onClick={() => setDarkMode(false)}><SunOutlined />{zh ? '浅色' : 'Light'}</button>
    </div></div>
    <div className="site-preference-row"><span><GlobalOutlined /> {zh ? '语言' : 'Language'}</span><div className="site-choice" role="group" aria-label={zh ? '语言' : 'Language'}><button aria-pressed={zh} onClick={() => setLanguage('zh')}>中文</button><button aria-pressed={!zh} onClick={() => setLanguage('en')}>EN</button></div></div>
    <label className="site-preference-row"><span>{zh ? '界面缩放' : 'Interface scale'}</span><select value={dpi} onChange={event => setDpi(Number(event.target.value))}>{[75,90,100,110,125].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
  </div>;

  const resources = <>
    <Link to={SHARED_PATHS.pluginGuide} onClick={close} aria-current={navigation.developerDocs ? 'page' : undefined}>{zh ? '插件开发文档' : 'Developer docs'}<span>{zh ? '构建与发布插件' : 'Build and publish plugins'}</span></Link>
    <Link to="/project-update" onClick={close}>{zh ? '项目近况与支持' : 'Project & support'}<span>{zh ? '了解进展，支持开发' : 'Updates and supporting development'}</span></Link>
    <a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer">{zh ? '社区交流' : 'Community'}<ArrowUpOutlined className="site-external-arrow" /></a>
    <a href="https://github.com/AAswordman/Operit" target="_blank" rel="noopener noreferrer">GitHub<ArrowUpOutlined className="site-external-arrow" /></a>
  </>;

  return <>
    <a className="site-skip" href="#site-content" onClick={event => { event.preventDefault(); document.getElementById('site-content')?.focus(); }}>{zh ? '跳至主要内容' : 'Skip to content'}</a>
    <header className={`site-header${docs.active ? ' site-header-docs' : ''}`} ref={headerRef} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setPanel(null); }}>
      <div className="site-header-inner">
        <Brand onClick={close} />
        {product && <Link className="site-header-generation" to={product.homePath} aria-label={product.name}>{product.number}</Link>}
        <nav className="site-navigation" aria-label={zh ? '主导航' : 'Main navigation'}>
          <div className="site-navigation-item">
            <button ref={productsButton} className="site-version-trigger" aria-expanded={panel === 'products'} aria-controls="site-products" onClick={() => toggle('products')}>{product?.name ?? (zh ? '产品' : 'Products')}<DownOutlined /></button>
            {panel === 'products' && <section id="site-products" className="site-dropdown site-product-menu" aria-label={zh ? '切换产品' : 'Switch product'}>
              <span className="site-overline">{zh ? '选择产品' : 'CHOOSE YOUR PRODUCT'}</span>
              {PRODUCT_ORDER.map(id => {
                const item = PRODUCTS[id];
                return <Link key={id} to={getProductSwitchPath(pathname, item)} onClick={close} aria-current={product?.id === id ? 'true' : undefined}>
                  <span className="site-menu-product-icon">{item.number}</span>
                  <span><strong>{item.name}<span className="site-small-label">{item.status[language]}</span></strong><span className="site-product-description">{item.description[language]}</span></span>
                  {product?.id === id ? <CheckOutlined /> : <ArrowRightOutlined />}
                </Link>;
              })}
              <Link className="site-all-products" to={SHARED_PATHS.home} onClick={close}>{zh ? '网站首页' : 'Website home'}<ArrowRightOutlined /></Link>
            </section>}
          </div>
          {product && <Link to={product.homePath} onClick={close} aria-current={pathname === product.homePath ? 'page' : undefined}>{zh ? '概览' : 'Overview'}</Link>}
          <Link to={guidePath} onClick={close} aria-current={navigation.guides ? 'page' : undefined}>{zh ? '教程' : 'Guides'}</Link>
          <Link to={SHARED_PATHS.market} onClick={close} aria-current={navigation.market ? 'page' : undefined}>{zh ? '插件市场' : 'Marketplace'}</Link>
          <div className="site-navigation-item">
            <button ref={resourcesButton} aria-expanded={panel === 'resources'} aria-controls="site-resources" onClick={() => toggle('resources')} className={navigation.developerDocs ? 'is-current' : undefined}>{zh ? '资源' : 'Resources'}<DownOutlined /></button>
            {panel === 'resources' && <nav id="site-resources" className="site-dropdown site-resources-menu" aria-label={zh ? '资源导航' : 'Resources'}>{resources}</nav>}
          </div>
        </nav>
        <div className="site-header-tools">
          <Link className="site-account" to={SHARED_PATHS.account} onClick={close}>{zh ? '个人中心' : 'My account'}</Link>
          <div className="site-settings-wrap"><button ref={settingsButton} className="site-icon-button site-settings-trigger" aria-label={zh ? '网站设置' : 'Site settings'} aria-expanded={panel === 'settings'} aria-controls="site-settings" onClick={() => toggle('settings')}><SettingOutlined /></button>
            {panel === 'settings' && <section id="site-settings" className="site-settings-panel" aria-label={zh ? '网站设置' : 'Site settings'}><h2>{zh ? '按你的习惯' : 'Make it yours'}</h2>{preferences}</section>}
          </div>
          <Link to={downloadPath} className="site-header-start" onClick={close}><span className="site-download-label-full">{zh ? (product ? `下载 ${product.name}` : '下载 Operit') : (product ? `Get ${product.name}` : 'Download')}</span><span className="site-download-label-compact">{zh ? '下载' : 'Download'}</span><ArrowRightOutlined /></Link>
          {docs.active && <button ref={docs.triggerRef} type="button" className="docs-directory-trigger" aria-label={zh ? '打开文档目录' : 'Open documentation contents'} aria-expanded={docs.open} aria-haspopup="dialog" onClick={() => { close(); docs.setOpen(true); }}><UnorderedListOutlined /><span>{zh ? '目录' : 'Contents'}</span></button>}
          <button ref={mobileButton} className="site-icon-button site-mobile-trigger" aria-label={zh ? '打开网站导航' : 'Open site navigation'} aria-expanded={mobileOpen} onClick={() => { docs.setOpen(false); setMobileOpen(true); }}><MenuOutlined /></button>
        </div>
      </div>
    </header>
    <Drawer title={<Brand onClick={close} />} open={mobileOpen} onClose={() => { close(); requestAnimationFrame(() => mobileButton.current?.focus({ preventScroll: true })); }} width="min(380px, 92vw)" className="site-mobile-drawer" destroyOnHidden afterOpenChange={open => { if (!open) requestAnimationFrame(() => mobileButton.current?.focus({ preventScroll: true })); }}>
      <nav className="site-mobile-navigation" aria-label={zh ? '网站导航' : 'Site navigation'}>
        <section className="site-mobile-section">
          <h2>{product ? product.name : zh ? '探索 Operit' : 'Explore Operit'}</h2>
          {product ? <>
            <Link to={product.homePath} onClick={close} aria-current={pathname === product.homePath ? 'page' : undefined}>{zh ? '产品概览' : 'Overview'}<ArrowRightOutlined /></Link>
            <Link to={downloadPath} onClick={close} aria-current={navigation.downloads ? 'page' : undefined}>{zh ? '下载' : 'Download'}<ArrowRightOutlined /></Link>
            <Link to={guidePath} onClick={close} aria-current={navigation.guides ? 'page' : undefined}>{zh ? '使用教程' : 'User guides'}<ArrowRightOutlined /></Link>
          </> : <>
            <Link to={SHARED_PATHS.home} onClick={close}>{zh ? '网站首页' : 'Home'}<ArrowRightOutlined /></Link>
            <Link to={SHARED_PATHS.downloads} onClick={close}>{zh ? '选择下载版本' : 'Downloads'}<ArrowRightOutlined /></Link>
            <Link to={SHARED_PATHS.guides} onClick={close}>{zh ? '选择教程版本' : 'Guides'}<ArrowRightOutlined /></Link>
          </>}
        </section>
        <section className="site-mobile-section">
          <h2>{zh ? '切换产品' : 'Switch product'}</h2>
          <div className="site-mobile-products">{PRODUCT_ORDER.map(id => <Link key={id} to={getProductSwitchPath(pathname, PRODUCTS[id])} onClick={close} aria-current={product?.id === id ? 'true' : undefined}>{PRODUCTS[id].name}{product?.id === id && <CheckOutlined />}</Link>)}</div>
        </section>
        <section className="site-mobile-section">
          <h2>{zh ? '共享生态与资源' : 'Ecosystem & resources'}</h2>
          <Link to={SHARED_PATHS.market} onClick={close} aria-current={navigation.market ? 'page' : undefined}>{zh ? '插件市场' : 'Marketplace'}<ArrowRightOutlined /></Link>
          {resources}
          <Link to={SHARED_PATHS.account} onClick={close}>{zh ? '个人中心' : 'My account'}<ArrowRightOutlined /></Link>
        </section>
      </nav>
      <div className="site-mobile-preferences"><h2>{zh ? '外观与偏好' : 'Preferences'}</h2>{preferences}</div>
    </Drawer>
  </>;
}
