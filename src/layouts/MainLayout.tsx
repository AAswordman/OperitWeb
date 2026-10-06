import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import SiteHeader from '../components/SiteHeader';
import ParticleBackground from '../components/ParticleBackground';
import type { SitePreferences } from '../components/SiteHeader';
import './MainLayout.css';
import { getNavigationContext } from '../config/navigation';
import { DocsNavigationContext } from './DocsNavigationContext';

export default function MainLayout(props: SitePreferences) {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const screenshot = new URLSearchParams(location.search).get('mode') === 'screenshot';
  const navigation = getNavigationContext(location.pathname);
  const { product } = navigation;
  const [docsOpen, setDocsOpen] = useState(false);
  const docsTrigger = useRef<HTMLButtonElement>(null);
  const isProductPage = location.pathname === '/' || location.pathname === product?.homePath;

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      setDocsOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  return <DocsNavigationContext.Provider value={{ active: navigation.documentation && !screenshot, open: docsOpen, setOpen: setDocsOpen, triggerRef: docsTrigger }}><div className={`site-shell${isProductPage ? ' site-shell-product' : ''}`}>
    {!screenshot && <SiteHeader {...props} key={location.pathname} />}
    {!screenshot && isProductPage && <div className="site-starfield" aria-hidden="true"><ParticleBackground darkMode={props.darkMode} foregroundLayer /></div>}
    <div id="site-content" className={`site-route-content${screenshot ? ' site-route-screenshot' : product ? ' site-route-content-versioned' : navigation.developerDocs ? ' site-route-content-docs' : ''}`} tabIndex={-1}>
      <Suspense fallback={<div className="site-route-loading"><Spin size="large" /></div>}><Outlet /></Suspense>
    </div>
  </div></DocsNavigationContext.Provider>;
}
