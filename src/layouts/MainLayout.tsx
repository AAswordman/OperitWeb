import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import SiteHeader from '../components/SiteHeader';
import type { SitePreferences } from '../components/SiteHeader';
import ParticleBackground from '../components/ParticleBackground';
import './MainLayout.css';

export default function MainLayout(props: SitePreferences) {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const screenshot = new URLSearchParams(location.search).get('mode') === 'screenshot';
  const isProductPage = location.pathname === '/' || location.pathname === '/classic';

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  return <div className={`site-shell${isProductPage ? ' site-shell-product' : ''}`}>
    {!screenshot && <SiteHeader {...props} key={location.pathname} />}
    {!screenshot && isProductPage && <div className="site-starfield" aria-hidden="true"><ParticleBackground darkMode={props.darkMode} foregroundLayer /></div>}
    <div id="site-content" className={`site-route-content${screenshot ? ' site-route-screenshot' : ''}`} tabIndex={-1}>
      <Suspense fallback={<div className="site-route-loading"><Spin size="large" /></div>}><Outlet /></Suspense>
    </div>
  </div>;
}
