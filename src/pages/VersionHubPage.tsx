import { Link } from 'react-router-dom';
import { AppstoreOutlined, ArrowRightOutlined, BookOutlined, CodeOutlined, DownloadOutlined } from '@ant-design/icons';
import Footer from '../components/Footer';
import { PRODUCTS, PRODUCT_ORDER, SHARED_PATHS } from '../config/products';
import type { Language } from '../config/products';
import './VersionPages.css';

export default function VersionHubPage({ language, section }: { language: Language; section: 'guide' | 'download' }) {
  const zh = language === 'zh';
  const guides = section === 'guide';
  return <main className="version-hub version-page">
    <div className="version-page-inner">
      <header className="version-page-heading">
        <span className="version-eyebrow">{guides ? 'DOCUMENTATION' : 'DOWNLOAD OPERIT'}</span>
        <h1>{guides ? (zh ? '从你的 Operit 开始。' : 'Start with your Operit.') : (zh ? '选择你的 Operit。' : 'Choose your Operit.')}</h1>
        <p>{zh ? '一代与二代拥有各自的下载和教程，共用同一个插件市场。请选择你正在使用或准备体验的版本。' : 'Each generation has its own downloads and guides. Both share one plugin market. Choose the version you use or want to explore.'}</p>
      </header>
      <div className="version-card-grid">
        {PRODUCT_ORDER.map(id => {
          const product = PRODUCTS[id];
          return <article className="version-card" key={id}>
            <div className="version-card-top"><span className="version-number">{product.number}</span><span className="version-status">{product.status[language]}</span></div>
            <h2>{product.name}</h2><p>{product.description[language]}</p>
            {guides && id === 'v1' && <p className="version-card-note">{zh ? '教程式文档与完整参考手册均保留在一代专区。' : 'Tutorials and the full reference manual are both in the generation-one section.'}</p>}
            {guides && id === 'v2' && <p className="version-card-note">{zh ? '二代教程专区已独立建立，正式使用教程将随版本发布补充。' : 'Generation-two docs have their own section. Usage tutorials will follow the release.'}</p>}
            <Link className="version-primary-link" to={guides ? product.guidePath : product.downloadPath}>{guides ? <BookOutlined /> : <DownloadOutlined />}{zh ? `进入${product.number === 1 ? '一' : '二'}代${guides ? '教程' : '下载'}` : `${product.name} ${guides ? 'guides' : 'downloads'}`}<ArrowRightOutlined /></Link>
            <Link className="version-secondary-link" to={product.homePath}>{zh ? '了解产品' : 'Explore product'}<ArrowRightOutlined /></Link>
          </article>;
        })}
      </div>
      <aside className="version-shared-note"><AppstoreOutlined /><div><h2>{zh ? '两代产品，一个插件生态。' : 'Two generations. One plugin ecosystem.'}</h2><p>{zh ? '无需切换市场账号或另找一份插件列表。安装前请查看插件标注的应用版本要求。' : 'Use the same account and plugin catalog. Check each plugin’s app-version requirements before installing.'}</p></div><Link to={SHARED_PATHS.market}>{zh ? '插件市场' : 'Marketplace'}<ArrowRightOutlined /></Link></aside>
      {guides && <Link className="version-developer-link" to={SHARED_PATHS.pluginGuide}><CodeOutlined />{zh ? '开发插件？前往共享插件开发文档' : 'Building plugins? Open the shared developer docs'}<ArrowRightOutlined /></Link>}
    </div>
    <Footer language={language} />
  </main>;
}
