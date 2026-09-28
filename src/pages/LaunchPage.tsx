import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from 'antd';
import { ArrowRightOutlined, ArrowUpOutlined, AppleOutlined, AndroidOutlined, DesktopOutlined, BookOutlined, AppstoreOutlined, CodeOutlined } from '@ant-design/icons';
import Footer from '../components/Footer';
import './LaunchPage.css';

interface LaunchPageProps { language: 'zh' | 'en'; }

export default function LaunchPage({ language }: LaunchPageProps) {
  const zh = language === 'zh';
  const [platform, setPlatform] = useState<string | null>(null);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <div className="release-page">
    <main>
      <section className="release-hero" aria-labelledby="release-title">
        <div className="release-hero-light" aria-hidden="true" />
        <div className="release-orbit release-orbit-one" aria-hidden="true" /><div className="release-orbit release-orbit-two" aria-hidden="true" />
        <div className="release-hero-side release-hero-side-left" aria-hidden="true">A NEW PERSPECTIVE<br /><span>EST. 2024 — EVOLVING</span></div>
        <div className="release-hero-side release-hero-side-right" aria-hidden="true">DESIGNED FOR<br /><span>WHAT COMES NEXT ↗</span></div>
        <div className="release-hero-content">
          <span className="release-kicker">THE NEXT CHAPTER OF OPERIT</span>
          <h1 id="release-title" className="release-wordmark"><span>Operit</span><span className="release-two">2</span></h1>
          <h2>{zh ? <>下一步，<span>不止于此。</span></> : <>Your next step.<span> Beyond the familiar.</span></>}</h2>
          <p>{zh ? <>全新的设计，全新的期待。<br />Operit 2 内测已开启，正式版本敬请期待。</> : <>A fresh design. A new experience.<br />Now in private beta. The full release is on its way.</>}</p>
          <div className="release-actions"><button className="release-button release-button-primary" onClick={() => setPlatform('Operit 2')}>{zh ? '了解 Operit 2' : 'Discover Operit 2'}<ArrowRightOutlined /></button><Link className="release-button release-button-secondary" to="/classic">{zh ? '探索 Operit 1' : 'Explore Operit 1'}<ArrowRightOutlined /></Link></div>
          <div className="release-hero-footnote"><span className="release-live-dot" />{zh ? '正在打磨，值得等待。' : 'Thoughtfully crafted. Worth the wait.'}</div>
        </div>
        <div className="release-hero-bottom"><span>01 — INTRODUCING OPERIT 2</span><button onClick={() => scrollTo('release-products')}>{zh ? '继续探索' : 'Keep exploring'}<span>↓</span></button><span>MADE FOR MORE.</span></div>
      </section>

      <section className="release-platform-ribbon" aria-label={zh ? '平台进展' : 'Platform status'}><div><span className="release-kicker">BEYOND ONE DEVICE</span><p>{zh ? '从掌心，到桌面。' : 'From your hand to your desktop.'}</p></div><button onClick={() => setPlatform('iOS')}><AppleOutlined /><span>iOS</span><span className="release-status">{zh ? '公测已开启' : 'Public testing'}</span><ArrowRightOutlined /></button><button onClick={() => setPlatform('macOS')}><DesktopOutlined /><span>macOS</span><span className="release-status">{zh ? '公测已开启' : 'Public testing'}</span><ArrowRightOutlined /></button></section>

      <section className="release-section" id="release-products" aria-labelledby="release-products-title">
        <div className="release-section-heading"><div><span className="release-kicker">THE OPERIT FAMILY</span><h2 id="release-products-title">{zh ? '向前探索，也自在当下。' : 'Explore tomorrow. Enjoy today.'}</h2></div><p>{zh ? <>下一代体验，和你熟悉的伙伴。<br />选择适合你的 Operit。</> : <>The next generation and your everyday companion.<br />Choose your Operit experience.</>}</p></div>
        <div className="release-product-grid">
          <article className="release-product-card release-product-next"><div className="release-product-top"><span className="release-product-category">NEXT GENERATION</span><span className="release-status"><span className="release-live-dot" />{zh ? '内测进行中' : 'Private beta'}</span></div><div className="release-product-copy"><h3>Operit 2</h3><p>{zh ? '焕然一新。不止于眼前。' : 'A new perspective. Beyond the familiar.'}</p></div><div className="release-product-art" aria-hidden="true">2</div><div className="release-product-bottom"><span>{zh ? '正式版本 · 敬请期待' : 'Public release · Coming soon'}</span><button onClick={() => setPlatform('Operit 2')} aria-label={zh ? '查看 Operit 2 内测说明' : 'View Operit 2 beta information'}><ArrowRightOutlined /></button></div></article>
          <article className="release-product-card release-product-current"><div className="release-product-top"><span className="release-product-category">YOUR EVERYDAY COMPANION</span><span className="release-status release-status-neutral"><AndroidOutlined />Android</span></div><div className="release-product-copy"><h3>Operit 1</h3><p>{zh ? '不止对话，更能行动。' : 'More than conversation. Ready for action.'}</p></div><div className="release-current-tools" aria-hidden="true"><span>AI</span><span>&lt;/&gt;</span><span>⌘</span><span>↗</span></div><div className="release-product-bottom"><span>{zh ? '下载、功能与生态，尽在这里。' : 'Downloads, features and a world of tools.'}</span><Link to="/classic" aria-label={zh ? '进入 Operit 1 官网' : 'Visit Operit 1'}><ArrowRightOutlined /></Link></div></article>
        </div>
      </section>

      <section className="release-world release-section" id="release-platforms" aria-labelledby="release-platforms-title"><div className="release-world-copy"><span className="release-kicker">MORE SCREENS. MORE POSSIBILITIES.</span><h2 id="release-platforms-title">{zh ? <>让期待，<br />不止在一块屏幕。</> : <>More room<br />for what comes next.</>}</h2><p>{zh ? 'iOS 与 macOS 公测已开启。\n从移动端到桌面端，探索 Operit 的下一步。' : 'Public testing is live on iOS and macOS.\nDiscover the next step for Operit, on mobile and desktop.'}</p><span className="release-platform-disclaimer">{zh ? '测试不代表正式发布。具体参与方式与开放范围，以官方公告为准。' : 'Testing is not a general release. Availability and participation details will follow in official announcements.'}</span></div><div className="release-platform-list">{[{name:'Android',icon:<AndroidOutlined />,status:zh ? 'Operit 1 可用' : 'Operit 1 available'}, {name:'iOS',icon:<AppleOutlined />,status:zh ? '公测已开启' : 'Public testing is live'}, {name:'macOS',icon:<DesktopOutlined />,status:zh ? '公测已开启' : 'Public testing is live'}].map(item => <div key={item.name} className="release-platform-row"><span className="release-platform-icon">{item.icon}</span><div><h3>{item.name}</h3><p><span className="release-live-dot" />{item.status}</p></div>{item.name === 'Android' ? <Link to="/classic" aria-label={zh ? '探索 Android 版本' : 'Explore Android'}><ArrowRightOutlined /></Link> : <button onClick={() => setPlatform(item.name)} aria-label={zh ? `查看 ${item.name} 公测进展` : `View ${item.name} testing status`}><ArrowRightOutlined /></button>}</div>)}</div></section>

      <section className="release-section release-resources" aria-labelledby="release-resources-title"><div className="release-section-heading"><div><span className="release-kicker">BUILD YOUR OWN POSSIBILITIES</span><h2 id="release-resources-title">{zh ? '从这里，发现更多。' : 'Go a little further.'}</h2></div><Link className="release-inline-link" to="/guide">{zh ? '探索全部资源' : 'Explore all resources'}<ArrowRightOutlined /></Link></div><div className="release-resource-grid">{[{to:'/guide',icon:<BookOutlined />,title:zh ? '使用文档' : 'Documentation',desc:zh ? '从第一次配置，到更进阶的玩法。' : 'From your first setup to advanced workflows.',label:'LEARN'}, {to:'/market',icon:<AppstoreOutlined />,title:zh ? '插件市场' : 'Marketplace',desc:zh ? '发现工具与插件，拓展你的助手。' : 'Find tools and plugins to extend your assistant.',label:'EXPLORE'}, {to:'/guide/plugin',icon:<CodeOutlined />,title:zh ? '开发者指南' : 'Developer guides',desc:zh ? '构建属于自己的工具与工作流。' : 'Build tools and workflows of your own.',label:'BUILD'}].map(item => <Link to={item.to} className="release-resource-card" key={item.to}><div>{item.icon}<span>{item.label}</span></div><h3>{item.title}</h3><p>{item.desc}</p><ArrowRightOutlined /></Link>)}</div></section>
      <section className="release-closing"><span className="release-kicker">THIS IS ONLY THE BEGINNING</span><h2>{zh ? '下一次见面，值得期待。' : 'The best is yet to come.'}</h2><div><span>Operit 2. {zh ? '敬请期待。' : 'Coming soon.'}</span><button aria-label={zh ? '返回顶部' : 'Back to top'} onClick={() => window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'})}><ArrowUpOutlined /></button></div></section>
    </main>
    <Footer language={language} />
    <Modal open={platform !== null} onCancel={() => setPlatform(null)} footer={null} title={platform === 'Operit 2' ? (zh ? 'Operit 2 · 内测已开启' : 'Operit 2 · Private beta is live') : `${platform ?? ''} · ${zh ? '公测已开启' : 'Public testing is live'}`}>
      <div className="release-test-details"><p>{platform === 'Operit 2' ? (zh ? 'Operit 2 正在内测中，全新版本尚未正式发布。感谢你的关注，敬请期待。' : 'Operit 2 is in private beta and has not been publicly released. Thank you for your interest. Stay tuned.') : (zh ? `${platform} 版本公测已开启。参与方式与开放范围将以官方公告为准。` : `${platform} public testing has begun. Participation details and availability will be shared in official announcements.`)}</p><p>{zh ? '本站暂未提供测试申请或安装入口。你仍可访问 Operit 1 官网，使用已有功能与文档。' : 'Testing signup and installation links are not available on this site yet. You can still explore Operit 1 and its documentation.'}</p><Link to="/classic" className="release-button release-button-primary" onClick={() => setPlatform(null)}>{zh ? '探索 Operit 1' : 'Explore Operit 1'}<ArrowRightOutlined /></Link></div>
    </Modal>
  </div>;
}
