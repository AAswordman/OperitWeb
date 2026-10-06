import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SHARED_PATHS } from '../config/products';
import type { Language } from '../config/products';
import { useDocsNavigation } from './DocsNavigationContext';
import './DocsLayout.css';

const mobileQuery = '(max-width: 980px)';
const subscribe = (callback: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
const getSnapshot = () => window.matchMedia(mobileQuery).matches;

// All documentation uses document scrolling. Only the desktop directory is
// sticky; mobile navigation belongs in a focus-managed, dismissible drawer.
export default function DocsLayout({ language, title, context, sidebar, action, children, screenshot = false, fullWidth = false, overview = false }: {
  language: Language;
  title: string;
  context: string;
  sidebar: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  screenshot?: boolean;
  fullWidth?: boolean;
  overview?: boolean;
}) {
  const mobile = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const { open: drawerOpen, setOpen: setDrawerOpen, triggerRef } = useDocsNavigation();
  const sidebarRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeHeading, setActiveHeading] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const zh = language === 'zh';

  useEffect(() => { if (!mobile) setDrawerOpen(false); }, [mobile, setDrawerOpen]);

  useEffect(() => {
    if (mobile || screenshot) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    // Keep the selected chapter inside the directory without scrolling the
    // document or hiding preceding/following chapters under the site header.
    const revealSelection = () => {
      const selected = sidebar.querySelector('.ant-menu-item-selected, a.active');
      if (!selected) return;
      const bounds = sidebar.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      const scale = bounds.height / sidebar.offsetHeight || 1;
      const padding = 16 * scale;
      if (item.bottom > bounds.bottom - padding) sidebar.scrollTop += (item.bottom - bounds.bottom + padding) / scale;
      else if (item.top < bounds.top + padding) sidebar.scrollTop -= (bounds.top + padding - item.top) / scale;
    };
    const observer = new ResizeObserver(revealSelection);
    observer.observe(sidebar);
    const frame = requestAnimationFrame(revealSelection);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [mobile, screenshot, location.pathname, language]);

  useEffect(() => {
    if (screenshot || fullWidth) return;
    const article = articleRef.current;
    if (!article) return;
    let anchorApplied = false;
    const collect = () => {
      const seen = new Map<string, number>();
      const entries = [...article.querySelectorAll('.markdown-body h2, .markdown-body h3')].map(heading => {
        const text = heading.textContent?.trim() ?? '';
        const base = `section-${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}`;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        if (!heading.id) heading.id = count ? `${base}-${count}` : base;
        return { id: heading.id, text, level: Number(heading.tagName.slice(1)) };
      }).filter(entry => entry.text);
      setHeadings(previous => JSON.stringify(previous) === JSON.stringify(entries) ? previous : entries);
      if (location.hash && !anchorApplied) {
        let id = location.hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* tolerate malformed external fragments */ }
        const target = [...article.querySelectorAll('[id]')].find(element => element.id === id);
        if (target) { target.scrollIntoView({ block: 'start' }); anchorApplied = true; }
      }
    };
    collect();
    const observer = new MutationObserver(collect);
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname, location.hash, language, screenshot, fullWidth]);

  useEffect(() => {
    if (!headings.length) { setActiveHeading(''); return; }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 64;
        let current = headings[0].id;
        for (const heading of headings) {
          const element = document.getElementById(heading.id);
          if (element && element.getBoundingClientRect().top <= offset + 48) current = heading.id;
        }
        setActiveHeading(current);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); };
  }, [headings]);

  if (screenshot) return <main className="docs-screenshot">{children}</main>;

  const directory = <div className="docs-directory" onClick={event => {
    if (event.target instanceof Element && event.target.closest('a, [data-doc-navigation]')) setDrawerOpen(false);
  }}>
    <div className="docs-directory-heading"><span>{context}</span><h2>{title}</h2></div>
    {sidebar}
    {action && <div className="docs-directory-action">{action}</div>}
  </div>;

  return <main className="docs-page">
    <div className={`docs-layout${fullWidth ? ' docs-layout-tool' : ''}`}>
      {!mobile && <aside ref={sidebarRef} className="docs-sidebar" aria-label={zh ? '教程目录' : 'Documentation directory'}>{directory}</aside>}
      <article ref={articleRef} className={`docs-article${fullWidth ? ' docs-article-full' : ''}${overview ? ' docs-article-index' : ''}`}>
        {children}
      </article>
      {!fullWidth && <aside className="docs-toc" aria-label={zh ? '本页内容' : 'On this page'}>
        {headings.length > 0 && <><h2>{zh ? '本页内容' : 'On this page'}</h2><nav>{headings.map(heading => <a key={heading.id}
          href={`#${location.pathname}${location.search}#${encodeURIComponent(heading.id)}`}
          className={heading.level === 3 ? 'docs-toc-nested' : undefined}
          aria-current={activeHeading === heading.id ? 'location' : undefined}
          onClick={event => {
            event.preventDefault();
            navigate({ pathname: location.pathname, search: location.search, hash: `#${encodeURIComponent(heading.id)}` }, { preventScrollReset: true });
          }}
        >{heading.text}</a>)}</nav></>}
        <div className="docs-toc-help"><span>{zh ? '需要帮助？' : 'Need a hand?'}</span><a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer">{zh ? '向社区提问 ↗' : 'Ask the community ↗'}</a></div>
      </aside>}
    </div>
    <footer className="docs-footer"><span>Operit · {zh ? '让想法行动起来' : 'Turn ideas into action'}</span><div><Link to={SHARED_PATHS.guides}>{zh ? '其他版本文档' : 'Other versions'}</Link><button onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{zh ? '返回顶部 ↑' : 'Back to top ↑'}</button></div></footer>
    {mobile && <Drawer title={`${context} · ${title}`} placement="left" width="min(340px, 90vw)" open={drawerOpen} onClose={() => { setDrawerOpen(false); requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true })); }} className="docs-drawer" destroyOnHidden afterOpenChange={open => {
      if (!open) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }}>
      {directory}
    </Drawer>}
  </main>;
}
