import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Language } from '../config/products';
import DocsLayout from '../layouts/DocsLayout';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useWikiResource } from '../hooks/useWikiResource';
import { searchWiki, sourceReferenceUrl, wikiAssetUrl, wikiNeighbors, wikiPagePath, WIKI_PATH } from '../utils/wiki';
import type { WikiFinding, WikiManifest, WikiPage, WikiSearchDocument } from '../utils/wiki';
import './OperitWikiPage.css';

function ResourceError({ message, retry }: { message: string; retry: () => void }) {
  return <Alert type="error" showIcon message={message} action={<Button onClick={retry}>重试 / Retry</Button>} />;
}

// Keep keystrokes local: URL navigation is asynchronous and cannot safely be
// the immediate controlled-input value under rapid typing or slow full-text search.
function WikiSearchInput({ value, onCommit, placeholder }: { value: string; onCommit: (value: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const lastCommit = useRef(value);
  useEffect(() => {
    if (value !== lastCommit.current) setDraft(value);
  }, [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => { lastCommit.current = draft; onCommit(draft); }, 200);
    return () => window.clearTimeout(timer);
  }, [draft, value, onCommit]);
  return <input type="search" value={draft} placeholder={placeholder} onChange={event => setDraft(event.target.value)} />;
}

function SourceNotice({ language }: { language: Language }) {
  return <p className="wiki-notice">{language === 'zh'
    ? '本库针对 Operit 1 Android 源码快照，由上游 AI 辅助编写。批准状态与代码走查均来自上游记录，不代表本站已独立验证，也不代表当前版本或 Operit 2 的行为。'
    : 'This AI-assisted knowledge base documents a pinned Operit 1 Android source snapshot. Approval and code-review records are upstream claims, not independently verified here, and do not describe Operit 2 or necessarily the current release.'}</p>;
}

function WikiHome({ manifest, language }: { manifest: WikiManifest; language: Language }) {
  const zh = language === 'zh';
  return <section className="wiki-home">
    <span className="wiki-eyebrow">OPERIT 1 · SOURCE KNOWLEDGE BASE</span>
    <h1>{zh ? 'Operit 1 源码知识库' : 'Operit 1 Source Knowledge Base'}</h1>
    <p>{zh ? '从使用方法，深入到实现原理。完整收录 Operit-wiki 的知识条目、事实引用与代码走查资料，与现有教程和参考手册并行保留。' : 'Explore implementation details alongside the existing tutorials and reference manual. All upstream articles, source facts and code-review records are preserved.'}</p>
    <div className="wiki-stats">{[
      [manifest.counts.articles, zh ? '知识文章' : 'articles'],
      [manifest.counts.facts.toLocaleString(), zh ? '事实引用' : 'source facts'],
      [manifest.counts.findings.toLocaleString(), zh ? '走查记录' : 'review records'],
    ].map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}</div>
    <SourceNotice language={language} />
    <div className="wiki-quick-links"><Link to={`${WIKI_PATH}/graph`}>{zh ? '探索知识图谱 →' : 'Explore connections →'}</Link><Link to={`${WIKI_PATH}/quality`}>{zh ? '浏览代码走查 →' : 'Browse code reviews →'}</Link><Link to={`${WIKI_PATH}/about`}>{zh ? '来源与完整备份 →' : 'Sources & full archive →'}</Link></div>
    <div className="wiki-chapters">{manifest.chapters.map(chapter => <section className="wiki-chapter" key={chapter.title}>
      <h2>{chapter.title}<span>{chapter.entries.length}</span></h2>
      <ul>{chapter.entries.map(id => <li key={id}><Link to={wikiPagePath(id)}>{manifest.pages.find(page => page.id === id)?.title}</Link></li>)}</ul>
    </section>)}</div>
  </section>;
}

function WikiAudit({ page, language }: { page: WikiPage; language: Language }) {
  const zh = language === 'zh';
  const [limit, setLimit] = useState(30);
  const resource = useWikiResource<{ fact: string; ref: string }[]>(page.artifacts.find(asset => asset.name.endsWith('.facts.json'))?.path);
  return <div className="wiki-audit">
    <h3>{zh ? '事实引用' : 'Source facts'} ({page.facts})</h3>
    {resource.loading && <Spin />}
    {resource.error && <ResourceError message={resource.error} retry={resource.retry} />}
    {!page.facts && <p>{zh ? '此条目没有单独的 facts 文件。' : 'This entry has no separate facts file.'}</p>}
    <ol className="wiki-facts">{resource.data?.slice(0, limit).map((fact, index) => {
      const url = sourceReferenceUrl(page.sourceCommit, fact.ref);
      return <li key={index}><p>{fact.fact}</p>{url ? <a href={url} target="_blank" rel="noopener noreferrer"><code>{fact.ref}</code> ↗</a> : <code>{fact.ref}</code>}</li>;
    })}</ol>
    {resource.data && resource.data.length > limit && <Button onClick={() => setLimit(value => value + 50)}>{zh ? '加载更多事实' : 'Load more facts'}</Button>}
    <h3>{zh ? '原始审核材料' : 'Original review artifacts'}</h3>
    <ul>{page.artifacts.map(asset => <li key={asset.path}><a href={wikiAssetUrl(asset.path)} target="_blank" rel="noopener noreferrer">{asset.name}</a></li>)}</ul>
    <p>{zh ? '审核结论、批准人、源码提交、lint 与多轮评审记录保持原样，供追溯；不自动转为本站审核结论。' : 'Approval, source commits, lint and review rounds are preserved as recorded upstream, not adopted as independent site verification.'}</p>
  </div>;
}

function WikiArticle({ page, manifest, language }: { page: WikiPage; manifest: WikiManifest; language: Language }) {
  const zh = language === 'zh';
  const [auditOpen, setAuditOpen] = useState(false);
  const related = wikiNeighbors(manifest.pages, page.id);
  const ordered = manifest.chapters.flatMap(chapter => chapter.entries);
  const index = ordered.indexOf(page.id);
  const adjacent = [ordered[index - 1], ordered[index + 1]].map(id => manifest.pages.find(item => item.id === id));
  return <>
    <header className="wiki-article-meta">
      <Link to={WIKI_PATH}>{zh ? '源码知识库' : 'Source knowledge base'}</Link><span> / {page.chapter}</span>
      <dl><div><dt>{zh ? '上游状态' : 'Upstream status'}</dt><dd>{page.status === 'approved' ? (zh ? '已批准（上游记录）' : 'Approved upstream') : page.status}</dd></div><div><dt>{zh ? '条目更新' : 'Entry updated'}</dt><dd>{page.updated}</dd></div><div><dt>{zh ? '源码快照' : 'Source snapshot'}</dt><dd>{page.sourceCommit ? <a href={`https://github.com/${page.sourceRepository}/tree/${page.sourceCommit}`} target="_blank" rel="noopener noreferrer"><code>{page.sourceCommit.slice(0, 12)}</code> ↗</a> : (zh ? '未注明' : 'Unspecified')}</dd></div></dl>
      {language === 'en' && <p className="wiki-notice">This entry is available in Chinese. The original text is shown without machine-generated translation.</p>}
      <SourceNotice language={language} />
    </header>
    <MarkdownRenderer file={`source-wiki/${page.id}`} language="zh" sanitizeHtml />
    <details className="wiki-audit-panel" onToggle={event => setAuditOpen(event.currentTarget.open)}>
      <summary>{zh ? '事实引用与审核资料' : 'Source facts & review artifacts'} · {page.facts}</summary>
      {auditOpen && <WikiAudit page={page} language={language} />}
    </details>
    <div className="wiki-article-tools"><a href={wikiAssetUrl(page.original)} target="_blank" rel="noopener noreferrer">{zh ? '原始 Markdown ↗' : 'Original Markdown ↗'}</a><Link to={`${WIKI_PATH}/graph?entry=${page.id}`}>{zh ? '查看条目关联' : 'Explore connections'}</Link><Link to={`${WIKI_PATH}/quality?entry=${page.id}`}>{zh ? '查看本条目走查' : 'Review records for this entry'}</Link></div>
    {(related.outgoing.length > 0 || related.incoming.length > 0) && <section className="wiki-related"><h2>{zh ? '关联阅读' : 'Related reading'}</h2><ul>{[...new Map([...related.outgoing, ...related.incoming].map(item => [item.id, item])).values()].map(item => <li key={item.id}><Link to={wikiPagePath(item.id)}>{item.title}</Link></li>)}</ul></section>}
    <nav className="wiki-pagination" aria-label={zh ? '上一篇与下一篇' : 'Previous and next articles'}>{adjacent.map((item, position) => item ? <Link key={item.id} to={wikiPagePath(item.id)}><small>{position === 0 ? (zh ? '← 上一篇' : '← Previous') : (zh ? '下一篇 →' : 'Next →')}</small>{item.title}</Link> : <span key={position} />)}</nav>
  </>;
}

function WikiGraph({ manifest, language }: { manifest: WikiManifest; language: Language }) {
  const zh = language === 'zh';
  const [params, setParams] = useSearchParams();
  const selected = manifest.pages.find(page => page.id === params.get('entry')) || manifest.pages.find(page => page.links.length) || manifest.pages[0];
  const neighbors = wikiNeighbors(manifest.pages, selected.id);
  const nodes = [...new Map([...neighbors.outgoing, ...neighbors.incoming].map(page => [page.id, page])).values()];
  const visible = nodes.slice(0, 12);
  const changeEntry = (id: string) => setParams({ entry: id });
  return <section className="wiki-graph"><h1>{zh ? '知识图谱' : 'Knowledge connections'}</h1>
    <p>{zh ? `全部 ${manifest.counts.entries} 个条目、${manifest.counts.links} 条文档互链。连线只表示原文显式链接，不推断代码依赖或事实因果关系。` : `${manifest.counts.entries} entries and ${manifest.counts.links} explicit document links. Connections are article references, not inferred code dependencies or causal claims.`}</p>
    <label className="wiki-field">{zh ? '选择中心条目' : 'Choose an entry'}<select value={selected.id} onChange={event => changeEntry(event.target.value)}>{manifest.chapters.map(chapter => <optgroup key={chapter.title} label={chapter.title}>{chapter.entries.map(id => <option key={id} value={id}>{manifest.pages.find(page => page.id === id)?.title}</option>)}</optgroup>)}</select></label>
    <svg className="wiki-graph-canvas" viewBox="0 0 640 390" role="img" aria-label={zh ? `${selected.title} 的文档关联图，下方提供完整可操作列表` : `Connections for ${selected.title}; full accessible lists below`}>
      {visible.map((page, index) => {
        const angle = index * Math.PI * 2 / visible.length;
        const x = 320 + Math.cos(angle) * 225;
        const y = 195 + Math.sin(angle) * 155;
        return <g key={page.id}><line x1="320" y1="195" x2={x} y2={y} /><circle cx={x} cy={y} r="9" /><text x={x} y={y + 24} textAnchor="middle">{page.title.slice(0, 12)}</text></g>;
      })}<circle cx="320" cy="195" r="20" className="wiki-graph-center" /><text x="320" y="237" textAnchor="middle">{selected.title.slice(0, 20)}</text>
    </svg>
    <h2><Link to={wikiPagePath(selected.id)}>{selected.title} →</Link></h2>
    {!nodes.length && <p>{zh ? '该条目没有显式文档互链，可从目录选择其他条目。' : 'This entry has no explicit links. Choose another entry from the directory.'}</p>}
    {visible.length < nodes.length && <p>{zh ? '图中展示前 12 个关联，完整关系见下方。' : 'The diagram shows the first 12 connections; all connections appear below.'}</p>}
    {[{ title: zh ? '引用的条目' : 'Links to', pages: neighbors.outgoing }, { title: zh ? '引用此文的条目' : 'Linked from', pages: neighbors.incoming }].map(group => <section key={group.title}><h3>{group.title} ({group.pages.length})</h3><ul className="wiki-graph-links">{group.pages.map(page => <li key={page.id}><Link to={wikiPagePath(page.id)}>{page.title}</Link><button onClick={() => changeEntry(page.id)}>{zh ? '展开关联' : 'Explore'}</button></li>)}</ul></section>)}
  </section>;
}

function WikiQuality({ manifest, language }: { manifest: WikiManifest; language: Language }) {
  const zh = language === 'zh';
  const resource = useWikiResource<{ findings: WikiFinding[] }>('quality.json');
  const [params, setParams] = useSearchParams();
  const severity = params.get('severity') || '';
  const entry = params.get('entry') || '';
  const query = params.get('q') || '';
  const filtered = useMemo(() => (resource.data?.findings || []).filter(finding => (!severity || finding.severity === severity) && (!entry || finding.page === entry) && `${finding.title} ${finding.detail} ${finding.file} ${finding.pageTitle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [resource.data, severity, entry, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const rawPage = Number(params.get('page'));
  const currentPage = Number.isFinite(rawPage) ? Math.max(1, Math.min(pageCount, Math.floor(rawPage))) : 1;
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: true }); };
  const severityLabel = { high: zh ? '高风险' : 'High', warning: zh ? '警告' : 'Warning', suggestion: zh ? '建议' : 'Suggestion', unspecified: zh ? '未分级' : 'Unspecified' };
  return <section className="wiki-quality"><h1>{zh ? '代码走查' : 'Code-review records'}</h1><SourceNotice language={language} />
    <p>{zh ? '完整保留上游走查发现与证据。风险等级是上游判断，尚未在本站复核，不应当作当前版本已确认的缺陷。' : 'Upstream findings and evidence are preserved in full. Severity reflects upstream assessment, not confirmed defects in the current release.'}</p>
    <div className="wiki-filters"><label className="wiki-field">{zh ? '搜索走查' : 'Search findings'}<WikiSearchInput value={query} onCommit={value => update('q', value)} /></label><label className="wiki-field">{zh ? '风险等级' : 'Severity'}<select value={severity} onChange={event => update('severity', event.target.value)}><option value="">{zh ? '全部等级' : 'All severities'}</option>{Object.entries(severityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="wiki-field">{zh ? '条目' : 'Entry'}<select value={entry} onChange={event => update('entry', event.target.value)}><option value="">{zh ? '全部条目' : 'All entries'}</option>{manifest.pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label></div>
    {resource.loading && <Spin />}{resource.error && <ResourceError message={resource.error} retry={resource.retry} />}
    {resource.data && <><p role="status">{zh ? `共 ${filtered.length} 条记录 · 第 ${currentPage} / ${pageCount} 页` : `${filtered.length} records · Page ${currentPage} / ${pageCount}`}</p>
      {!filtered.length && <p>{zh ? '没有符合筛选条件的走查记录。' : 'No review records match these filters.'}</p>}
      <div className="wiki-findings">{filtered.slice((currentPage - 1) * 25, currentPage * 25).map(finding => {
        const reference = sourceReferenceUrl(finding.sourceCommit, `${finding.file}:${finding.line}`);
        return <article className="wiki-finding" key={finding.id}><span className={`wiki-severity wiki-severity-${finding.severity}`}>{severityLabel[finding.severity]}</span><h2>{finding.title}</h2><Link to={wikiPagePath(finding.page)}>{finding.pageTitle}</Link><p>{finding.detail}</p><p><small>{finding.category} · {zh ? '上游置信度' : 'Upstream confidence'}: {finding.confidence}</small></p>{reference ? <a href={reference} target="_blank" rel="noopener noreferrer"><code>{finding.file}:{finding.line}</code> ↗</a> : <span>{finding.file ? `${finding.file}:${finding.line}` : (zh ? '原文未单列文件行号，见证据与原始记录。' : 'No separate file/line; see evidence and the original record.')}</span>}{finding.evidence && <details><summary>{zh ? '查看原始证据' : 'Show evidence'}</summary><pre><code>{finding.evidence}</code></pre></details>}<details><summary>{zh ? '完整原始记录（含补充证据）' : 'Complete original record (including extra evidence)'}</summary><pre><code>{JSON.stringify(finding.raw, null, 2)}</code></pre></details></article>;
      })}</div><div className="wiki-pager"><Button disabled={currentPage <= 1} onClick={() => update('page', String(currentPage - 1))}>{zh ? '上一页' : 'Previous'}</Button><span>{currentPage} / {pageCount}</span><Button disabled={currentPage >= pageCount} onClick={() => update('page', String(currentPage + 1))}>{zh ? '下一页' : 'Next'}</Button></div></>}
  </section>;
}

function WikiAbout({ manifest, language }: { manifest: WikiManifest; language: Language }) {
  const zh = language === 'zh';
  return <section className="wiki-about"><h1>{zh ? '来源、维护与完整备份' : 'Sources, maintenance & complete archive'}</h1><SourceNotice language={language} />
    <dl><dt>{zh ? '迁移来源' : 'Snapshot repository'}</dt><dd><a href={`https://github.com/${manifest.repository}`} target="_blank" rel="noopener noreferrer">{manifest.repository}</a></dd><dt>{zh ? '固定导入提交' : 'Pinned import commit'}</dt><dd><a href={`https://github.com/${manifest.repository}/tree/${manifest.revision}`} target="_blank" rel="noopener noreferrer"><code>{manifest.revision}</code></a></dd><dt>{zh ? '索引时间（上游字段）' : 'Upstream index timestamp'}</dt><dd>{manifest.upstreamUpdated}</dd><dt>{zh ? '版权与许可证' : 'Copyright & license'}</dt><dd>{manifest.copyright} · <a href={wikiAssetUrl('LICENSE.txt')}>MIT</a></dd></dl>
    <h2>{zh ? '完整保留，不只是搬运页面' : 'Full preservation, not just rendered pages'}</h2><p>{zh ? '收录全部索引条目（包括两份大纲）、事实数据、审核状态、lint、多轮评审及代码走查记录。完整仓库压缩包还保留原站、构建脚本、规范、大纲和跟踪数据。' : 'All indexed entries, outlines, facts, statuses, lint, review rounds and code-review records are included. The full repository archive also retains the original site, scripts, schemas and tracking data.'}</p>
    <ul><li><a href={wikiAssetUrl('upstream.zip')} download>{zh ? '下载完整上游仓库快照 ZIP' : 'Download the complete upstream repository ZIP'}</a></li><li><a href={wikiAssetUrl('manifest.json')} target="_blank" rel="noopener noreferrer">{zh ? '来源索引与内容校验值 JSON' : 'Source manifest & content checksums JSON'}</a></li><li><a href={wikiAssetUrl('NOTICE.txt')}>{zh ? '导入与改编说明' : 'Import & adaptation notice'}</a></li><li><a href={wikiAssetUrl('LICENSE.txt')}>{zh ? '原始 MIT 许可证' : 'Original MIT license'}</a></li></ul>
    <h2>{zh ? '原站功能如何接入' : 'Integration details'}</h2><p>{zh ? 'Wiki 阅读、事实浏览、审核材料、代码走查及文档关系图已融入本站。图谱根据原文显式互链生成，不沿用依赖缺失的旧图谱构建工具，也不把推断关系混为源码事实。' : 'Wiki reading, source facts, review artifacts, code reviews and document connections are integrated into this site. The graph uses explicit document links rather than the old graph builder’s unavailable local dependencies or inferred code relationships.'}</p>
    <h2>{zh ? '教程分享与历史评论' : 'Community tutorials & historical comments'}</h2><p>{zh ? '原站教程分享和评论从 luojiaping/Operit-wiki 的 GitHub Issues 动态获取，不包含在这个备份仓库中。导入时（2026-10-26）该原仓库返回 404，因此无法从此备份恢复这些站外数据；本站不会伪造教程、评论，或把历史 Issue 编号错误关联到备份仓库。现有教程、参考手册与本站投稿功能继续保留。' : 'The original site fetched community tutorials and comments from luojiaping/Operit-wiki GitHub Issues; these are not included in this backup. That repository returned 404 during import on October 26, 2026, so those external records cannot be recovered from this snapshot. We do not fabricate records or map old issue numbers to the backup repository. Existing site tutorials, reference docs and submissions remain available.'}</p>
    <div className="wiki-quick-links"><Link to="/v1/guide">{zh ? '一代入门教程' : 'Generation-one tutorials'}</Link><Link to="/v1/guide/reference">{zh ? '完整参考手册' : 'Full reference manual'}</Link><Link to="/operit-submission-center">{zh ? '本站投稿中心' : 'Site submission center'}</Link></div>
  </section>;
}

export default function OperitWikiPage({ language }: { language: Language }) {
  const zh = language === 'zh';
  const navigate = useNavigate();
  const { '*': section = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const resource = useWikiResource<WikiManifest>('manifest.json');
  const searchResource = useWikiResource<{ pages: WikiSearchDocument[] }>(query.trim() && !['quality', 'graph', 'about'].includes(section) ? 'search.json' : undefined);
  const manifest = resource.data;
  const results = useMemo(() => searchWiki(manifest?.pages || [], searchResource.data?.pages || [], query), [manifest, searchResource.data, query]);
  const page = manifest?.pages.find(item => item.id === section);
  const screenshot = params.get('mode') === 'screenshot';
  return <DocsLayout language={language} context="Operit 1" title={zh ? '源码知识库' : 'Source knowledge base'} screenshot={screenshot}
    sidebar={<><nav aria-label={zh ? '知识库导航' : 'Knowledge base navigation'}><NavLink end to={WIKI_PATH}>{zh ? '知识库首页' : 'Knowledge base home'}</NavLink><NavLink to={`${WIKI_PATH}/graph`}>{zh ? '知识图谱' : 'Knowledge connections'}</NavLink><NavLink to={`${WIKI_PATH}/quality`}>{zh ? '代码走查' : 'Code-review records'}</NavLink><NavLink to={`${WIKI_PATH}/about`}>{zh ? '来源与完整备份' : 'Sources & full archive'}</NavLink></nav>
    <label className="wiki-field wiki-sidebar-search">{zh ? '搜索全部知识条目' : 'Search all entries'}<WikiSearchInput value={['quality', 'graph', 'about'].includes(section) ? '' : query} placeholder={zh ? '标题、正文、源码路径…' : 'Title, content, source path…'} onCommit={value => {
      if (['quality', 'graph', 'about'].includes(section)) { navigate(`${WIKI_PATH}?q=${encodeURIComponent(value)}`); return; }
      const next = new URLSearchParams(params); if (value) next.set('q', value); else next.delete('q'); setParams(next, { replace: true, preventScrollReset: true });
    }} /></label>
    {manifest && query.trim() && !['quality', 'graph', 'about'].includes(section) ? <div className="wiki-search-results" role="status">
      <p>{searchResource.loading ? (zh ? '全文搜索中…' : 'Searching full text…') : (zh ? `${results.length} 个结果` : `${results.length} results`)}</p>
      {searchResource.error && <ResourceError message={searchResource.error} retry={searchResource.retry} />}
      {results.map(result => <Link data-doc-navigation key={result.page.id} to={`${wikiPagePath(result.page.id)}?q=${encodeURIComponent(query)}`}><strong>{result.page.title}</strong><small>{result.excerpt}</small></Link>)}
      {!results.length && !searchResource.loading && <p>{zh ? '未找到相关内容，请尝试其他关键词。' : 'No results. Try another search term.'}</p>}
    </div> : manifest && <nav aria-label={zh ? '全部知识条目' : 'All knowledge entries'}>{manifest.chapters.map(chapter => <details className="wiki-nav-chapter" key={`${chapter.title}-${page?.chapter === chapter.title}`} open={page?.chapter === chapter.title || undefined}><summary>{chapter.title}<span>{chapter.entries.length}</span></summary>{chapter.entries.map(id => <NavLink data-doc-navigation key={id} to={wikiPagePath(id)}>{manifest.pages.find(item => item.id === id)?.title}</NavLink>)}</details>)}</nav>}
    <nav className="wiki-sidebar-resources"><span className="docs-nav-label">{zh ? '一代文档' : 'GENERATION ONE'}</span><Link to="/v1/guide">{zh ? '入门教程' : 'Tutorials'}</Link><Link to="/v1/guide/reference">{zh ? '完整参考手册' : 'Reference manual'}</Link><a href={wikiAssetUrl('upstream.zip')} download>{zh ? '完整仓库备份 ↓' : 'Full repository archive ↓'}</a></nav></>}
  >
    {resource.loading && <div className="wiki-loading"><Spin /><p>{zh ? '正在加载知识库…' : 'Loading knowledge base…'}</p></div>}
    {resource.error && <ResourceError message={resource.error} retry={resource.retry} />}
    {manifest && (section === '' ? <WikiHome manifest={manifest} language={language} /> : section === 'graph' ? <WikiGraph manifest={manifest} language={language} /> : section === 'quality' ? <WikiQuality manifest={manifest} language={language} /> : section === 'about' ? <WikiAbout manifest={manifest} language={language} /> : page ? <WikiArticle key={`${page.id}-${language}`} page={page} manifest={manifest} language={language} /> : <section className="wiki-not-found"><h1>{zh ? '未找到知识条目' : 'Knowledge entry not found'}</h1><p>{zh ? '该地址不在本次导入的知识库索引中。' : 'This URL is not in the imported knowledge base.'}</p><Link to={WIKI_PATH}>{zh ? '返回知识库首页' : 'Return to the knowledge base'}</Link></section>)}
  </DocsLayout>;
}
