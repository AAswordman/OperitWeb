import { Link, NavLink, Outlet } from 'react-router-dom';
import Footer from '../components/Footer';
import { PRODUCTS, SHARED_PATHS } from '../config/products';
import type { Language } from '../config/products';
import './VersionPages.css';

export default function GuideV2Page({ language }: { language: Language }) {
  const zh = language === 'zh';
  const product = PRODUCTS.v2;
  return <main className="version-docs-page">
    <div className="version-docs-layout">
      <aside className="version-docs-sidebar">
        <span className="version-eyebrow">OPERIT 2 / GUIDES</span>
        <nav aria-label={zh ? '二代教程目录' : 'Generation-two docs'}>
          <NavLink end to={product.guidePath}>{zh ? '欢迎与版本说明' : 'Welcome & versions'}</NavLink>
          <NavLink to={`${product.guidePath}/release-information`}>{zh ? '发布前说明' : 'Pre-release notes'}</NavLink>
          <Link to={product.downloadPath}>{zh ? '二代下载入口' : 'Generation-two downloads'}</Link>
          <Link to={SHARED_PATHS.pluginGuide}>{zh ? '共享插件开发文档' : 'Shared plugin developer docs'}</Link>
          <Link to={SHARED_PATHS.guides}>{zh ? '返回教程选择' : 'Choose a generation'}</Link>
        </nav>
      </aside>
      <article className="version-docs-article"><div className="version-docs-notice">{zh ? '这是 Operit 2 专属教程区。一代教程不会作为二代教程展示。' : 'This section is for Operit 2. Generation-one tutorials are not reused here.'}</div><Outlet /></article>
    </div><Footer language={language} />
  </main>;
}
