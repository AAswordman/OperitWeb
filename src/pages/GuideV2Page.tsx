import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import DocsLayout from '../layouts/DocsLayout';
import { PRODUCTS, SHARED_PATHS } from '../config/products';
import type { Language } from '../config/products';

export default function GuideV2Page({ language }: { language: Language }) {
  const zh = language === 'zh';
  const product = PRODUCTS.v2;
  const location = useLocation();
  const screenshot = new URLSearchParams(location.search).get('mode') === 'screenshot';
  return <DocsLayout language={language} context="Operit 2" title={zh ? '使用教程' : 'User guides'} screenshot={screenshot} overview={location.pathname === product.guidePath}
    sidebar={<>
        <nav aria-label={zh ? '二代教程目录' : 'Generation-two docs'}>
          <span className="docs-nav-label">{zh ? '开始使用' : 'GETTING STARTED'}</span>
          <NavLink end to={product.guidePath}>{zh ? '欢迎与版本说明' : 'Welcome & versions'}</NavLink>
          <NavLink to={`${product.guidePath}/release-information`}>{zh ? '发布前说明' : 'Pre-release notes'}</NavLink>
          <span className="docs-nav-label docs-nav-label-spaced">{zh ? '相关资源' : 'RESOURCES'}</span>
          <Link to={product.downloadPath}>{zh ? '二代下载入口' : 'Generation-two downloads'}</Link>
          <Link to={SHARED_PATHS.pluginGuide}>{zh ? '共享插件开发文档' : 'Shared plugin developer docs'}</Link>
          <Link to={SHARED_PATHS.guides}>{zh ? '返回教程选择' : 'Choose a generation'}</Link>
        </nav>
    </>}
  ><Outlet /></DocsLayout>;
}
