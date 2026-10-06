import { Link } from 'react-router-dom';
import { ArrowRightOutlined, ArrowUpOutlined, AppleOutlined, AndroidOutlined, DesktopOutlined, BookOutlined, AppstoreOutlined, CodeOutlined } from '@ant-design/icons';
import Footer from '../components/Footer';
import { PRODUCTS, SHARED_PATHS, OPERIT_V2_PUBLIC_BETAS } from '../config/products';
import './LaunchPage.css';

interface LaunchPageProps { language: 'zh' | 'en'; productPage?: boolean; }

export default function LaunchPage({ language, productPage = false }: LaunchPageProps) {
  const zh = language === 'zh';
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
          <p>{zh ? <>全新的设计，全平台的体验。<br />iOS 与 macOS 公测已开放，其他平台内测将逐步开放。</> : <>A fresh design. A cross-platform experience.<br />Public beta on iOS and macOS. Private testing on other platforms opens gradually.</>}</p>
          <div className="release-actions"><Link className="release-button release-button-primary" to={productPage ? PRODUCTS.v2.downloadPath : PRODUCTS.v2.homePath}>{productPage ? (zh ? '下载' : 'Download') : (zh ? '了解 Operit 2' : 'Discover Operit 2')}<ArrowRightOutlined /></Link><Link className="release-button release-button-secondary" to={productPage ? PRODUCTS.v2.guidePath : PRODUCTS.v1.homePath}>{productPage ? (zh ? '使用教程' : 'Guides') : (zh ? '探索 Operit 1' : 'Explore Operit 1')}<ArrowRightOutlined /></Link></div>
          <div className="release-hero-footnote"><span className="release-live-dot" />{zh ? '全平台 · iOS / macOS 公测进行中' : 'Cross-platform · iOS / macOS public beta'}</div>
        </div>
        <div className="release-hero-bottom"><span>01 — INTRODUCING OPERIT 2</span><button onClick={() => scrollTo('release-products')}>{zh ? '继续探索' : 'Keep exploring'}<span>↓</span></button><span>MADE FOR MORE.</span></div>
      </section>

      <section className="release-platform-ribbon" aria-label={zh ? '平台进展' : 'Platform status'}><div><span className="release-kicker">BUILT FOR ALL PLATFORMS</span><p>{zh ? '从掌心，到桌面。' : 'From your hand to your desktop.'}</p></div>{OPERIT_V2_PUBLIC_BETAS.map(platform => <a key={platform.id} href={platform.url} target="_blank" rel="noopener noreferrer" aria-label={zh ? `加入 Operit 2 ${platform.name} TestFlight 公测` : `Join Operit 2 ${platform.name} TestFlight beta`}>{platform.id === 'ios' ? <AppleOutlined /> : <DesktopOutlined />}<span>{platform.name}</span><span className="release-status">{zh ? '加入公测' : 'Join public beta'}</span><ArrowRightOutlined /></a>)}</section>

      <section className="release-section" id="release-products" aria-labelledby="release-products-title">
        <div className="release-section-heading"><div><span className="release-kicker">THE OPERIT FAMILY</span><h2 id="release-products-title">{zh ? '向前探索，也自在当下。' : 'Explore tomorrow. Enjoy today.'}</h2></div><p>{zh ? <>下一代体验，和你熟悉的伙伴。<br />选择适合你的 Operit。</> : <>The next generation and your everyday companion.<br />Choose your Operit experience.</>}</p></div>
        <div className="release-product-grid">
          <article className="release-product-card release-product-next"><div className="release-product-top"><span className="release-product-category">NEXT GENERATION</span><span className="release-status"><span className="release-live-dot" />{zh ? 'iOS / macOS 公测中' : 'iOS / macOS public beta'}</span></div><div className="release-product-copy"><h3>Operit 2</h3><p>{zh ? '全平台体验，不止于一块屏幕。' : 'A cross-platform experience. Beyond one screen.'}</p></div><div className="release-product-art" aria-hidden="true">2</div><div className="release-product-bottom"><span>{zh ? '公测已开放 · 其他平台内测逐步开放' : 'Public beta live · More platforms to follow'}</span><Link to={PRODUCTS.v2.homePath} aria-label={zh ? '查看 Operit 2' : 'Explore Operit 2'}><ArrowRightOutlined /></Link></div></article>
          <article className="release-product-card release-product-current"><div className="release-product-top"><span className="release-product-category">YOUR EVERYDAY COMPANION</span><span className="release-status release-status-neutral"><AndroidOutlined />Android</span></div><div className="release-product-copy"><h3>Operit 1</h3><p>{zh ? '不止对话，更能行动。' : 'More than conversation. Ready for action.'}</p></div><div className="release-current-tools" aria-hidden="true"><span>AI</span><span>&lt;/&gt;</span><span>⌘</span><span>↗</span></div><div className="release-product-bottom"><span>{zh ? '下载、功能与生态，尽在这里。' : 'Downloads, features and a world of tools.'}</span><Link to={PRODUCTS.v1.homePath} aria-label={zh ? '进入 Operit 1 官网' : 'Visit Operit 1'}><ArrowRightOutlined /></Link></div></article>
        </div>
      </section>

      <section className="release-world release-section" id="release-platforms" aria-labelledby="release-platforms-title">
        <div className="release-world-copy"><span className="release-kicker">ALL PLATFORMS. MORE POSSIBILITIES.</span><h2 id="release-platforms-title">{zh ? <>全平台，<br />不止一块屏幕。</> : <>All platforms.<br />Beyond one screen.</>}</h2><p>{zh ? 'Operit 2 面向全平台。iOS 与 macOS 公测已开放，可通过 TestFlight 参与。\n其他平台正在内测，参与入口将逐步开放。' : 'Operit 2 is built for all platforms. Join the iOS and macOS public betas through TestFlight.\nOther platforms are in private testing, with access opening gradually.'}</p><span className="release-platform-disclaimer">{zh ? '公测不代表正式发布。各平台开放范围与后续进展，以官方公告为准。' : 'Public beta is not a general release. Platform availability and further updates follow official announcements.'}</span></div>
        <div className="release-platform-list">
          {OPERIT_V2_PUBLIC_BETAS.map(platform => <div key={platform.id} className="release-platform-row"><span className="release-platform-icon">{platform.id === 'ios' ? <AppleOutlined /> : <DesktopOutlined />}</span><div><h3>{platform.name}</h3><p><span className="release-live-dot" />{zh ? '公测已开放 · TestFlight' : 'Public beta available · TestFlight'}</p></div><a href={platform.url} target="_blank" rel="noopener noreferrer" aria-label={zh ? `加入 ${platform.name} 公测` : `Join ${platform.name} public beta`}><ArrowRightOutlined /></a></div>)}
          <div className="release-platform-row"><span className="release-platform-icon"><DesktopOutlined /></span><div><h3>{zh ? '其他平台' : 'Other platforms'}</h3><p><span className="release-live-dot" />{zh ? '内测中 · 参与入口逐步开放' : 'Private testing · Access opens gradually'}</p></div><Link to={PRODUCTS.v2.downloadPath} aria-label={zh ? '查看其他平台内测进展' : 'View other-platform testing status'}><ArrowRightOutlined /></Link></div>
        </div>
      </section>

      <section className="release-section release-resources" aria-labelledby="release-resources-title"><div className="release-section-heading"><div><span className="release-kicker">BUILD YOUR OWN POSSIBILITIES</span><h2 id="release-resources-title">{zh ? '从这里，发现更多。' : 'Go a little further.'}</h2></div><Link className="release-inline-link" to={productPage ? PRODUCTS.v2.guidePath : SHARED_PATHS.guides}>{zh ? '探索全部资源' : 'Explore all resources'}<ArrowRightOutlined /></Link></div><div className="release-resource-grid">{[{to:productPage ? PRODUCTS.v2.guidePath : SHARED_PATHS.guides,icon:<BookOutlined />,title:zh ? '使用文档' : 'Documentation',desc:productPage ? (zh ? '从快速入门到进阶使用，找到你需要的说明。' : 'Find what you need, from getting started to advanced usage.') : (zh ? '按产品代际选择教程，避免用错版本。' : 'Choose guides for your generation of Operit.'),label:'LEARN'}, {to:SHARED_PATHS.market,icon:<AppstoreOutlined />,title:zh ? '插件市场' : 'Marketplace',desc:productPage ? (zh ? '发现插件与工具，扩展你的助手。' : 'Discover plugins and tools. Extend your assistant.') : (zh ? '一代与二代共用一份市场，扩展你的助手。' : 'One marketplace for both generations. Extend your assistant.'),label:'EXPLORE'}, {to:SHARED_PATHS.pluginGuide,icon:<CodeOutlined />,title:zh ? '开发者指南' : 'Developer guides',desc:zh ? '构建属于自己的工具与工作流。' : 'Build tools and workflows of your own.',label:'BUILD'}].map(item => <Link to={item.to} className="release-resource-card" key={item.to}><div>{item.icon}<span>{item.label}</span></div><h3>{item.title}</h3><p>{item.desc}</p><ArrowRightOutlined /></Link>)}</div></section>
      <section className="release-closing"><span className="release-kicker">THIS IS ONLY THE BEGINNING</span><h2>{zh ? '下一次见面，值得期待。' : 'The best is yet to come.'}</h2><div><span>Operit 2. {zh ? '全平台，公测已启程。' : 'Cross-platform. Public beta is live.'}</span><button aria-label={zh ? '返回顶部' : 'Back to top'} onClick={() => window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'})}><ArrowUpOutlined /></button></div></section>
    </main>
    <Footer language={language} />

  </div>;
}
