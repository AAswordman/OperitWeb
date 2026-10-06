import { Alert } from 'antd';
import { Link } from 'react-router-dom';
import { AppleOutlined, DesktopOutlined, AndroidOutlined, ArrowRightOutlined, BookOutlined, DownloadOutlined, GithubOutlined } from '@ant-design/icons';
import DownloadLatestButton from '../components/DownloadLatestButton';
import Footer from '../components/Footer';
import { PRODUCTS, SHARED_PATHS, getExternalDownloadUrl } from '../config/products';
import type { Language, ProductGeneration } from '../config/products';
import './VersionPages.css';

export default function ProductDownloadPage({ generation, language }: { generation: ProductGeneration; language: Language }) {
  const product = PRODUCTS[generation];
  const zh = language === 'zh';
  const source = product.download;
  const externalUrl = source.kind === 'external' ? getExternalDownloadUrl(import.meta.env[source.urlEnvironmentKey]) : undefined;
  return <main className="product-download-page version-page">
    <div className="version-page-inner download-page-inner">
      <header className="version-page-heading"><span className="version-eyebrow">{product.name.toUpperCase()} / DOWNLOAD</span><h1>{zh ? `下载 ${product.name}` : `Download ${product.name}`}</h1><p>{zh ? '选择你的设备，开始使用。' : 'Choose your device. Make it yours.'}</p></header>
      <section className="version-download-panel" aria-label={zh ? `${product.name} 下载入口` : `${product.name} downloads`}>
        {source.kind === 'github-release' && <h2><AndroidOutlined />{product.name} for Android</h2>}
        {source.kind === 'github-release' ? <>
          <p>{zh ? '此入口仅下载 Operit 1。自动获取一代 GitHub Release 中的最新 APK，并保留原有的下载线路选择。' : 'This entry downloads Operit 1 only. It fetches the latest APK from the generation-one GitHub releases, with download-source selection.'}</p>
          <div className="version-download-actions"><DownloadLatestButton releaseSource={source} downloadText={zh ? '下载 Operit 1 APK' : 'Download Operit 1 APK'} language={language} withMotion={false} /><a href={`https://github.com/${source.repository}/releases`} target="_blank" rel="noopener noreferrer"><GithubOutlined />{zh ? '历史版本与发布说明' : 'Release history'}</a></div>
        </> : <>
          <p>{zh ? 'Operit 2 是全平台产品，不只面向 Apple 设备。目前 iOS 与 macOS 已开放 TestFlight 公测，其他平台的内测将逐步开放。' : 'Operit 2 is a cross-platform product, not limited to Apple devices. iOS and macOS public betas are available through TestFlight; private testing on other platforms will open gradually.'}</p>
          <div className="version-platform-downloads">
            {source.publicBetas.map(platform => <article className="version-platform-download" key={platform.id}>
              <div className="version-platform-heading"><span className="version-platform-download-icon">{platform.id === 'ios' ? <AppleOutlined /> : <DesktopOutlined />}</span><div><h3>{platform.name}</h3><span className="version-platform-caption">Operit 2 · {zh ? '公测已开放' : 'Public beta available'}</span></div></div>
              <p>{zh ? `通过 TestFlight 参与 ${platform.name} 公测。` : `Join the ${platform.name} public beta through TestFlight.`}</p>
              <a className="version-primary-link" href={platform.url} target="_blank" rel="noopener noreferrer" data-platform={platform.id}><DownloadOutlined />{zh ? `加入 ${platform.name} 公测` : `Join ${platform.name} beta`}<ArrowRightOutlined /></a>
            </article>)}
          </div>
          <Alert type="info" showIcon message={zh ? '其他平台 · 内测逐步开放' : 'Other platforms · private testing opens gradually'} description={zh ? 'Operit 2 面向全平台。其他平台正在内测，参与入口将逐步开放，请关注后续官方公告。请勿将 Operit 1 的安装包作为二代安装包。' : 'Operit 2 is designed for all platforms. Other platforms are in private testing, with access opening gradually. Follow official announcements; Operit 1 packages are not Operit 2 installers.'} />
          {externalUrl && <a className="version-primary-link version-additional-download" href={externalUrl} target="_blank" rel="noopener noreferrer"><DownloadOutlined />{zh ? '其他官方二代发布入口' : 'Additional official Operit 2 releases'}<ArrowRightOutlined /></a>}
        </>}
        <div className="version-download-guide"><BookOutlined /><Link to={product.guidePath}>{zh ? `查看 ${product.name} 使用教程` : `${product.name} guides`}</Link><ArrowRightOutlined /></div>
      </section>
      <aside className="version-shared-note"><div><h2>{zh ? '确认版本，再开始。' : 'Choose the right generation.'}</h2><p>{zh ? '下载与教程必须对应你安装的产品代际；插件市场是两代共享的独立入口。' : 'Use guides for the generation you install. The plugin market is a separate, shared destination.'}</p></div><Link to={SHARED_PATHS.downloads}>{zh ? '切换下载版本' : 'Other generation'}<ArrowRightOutlined /></Link><Link to={SHARED_PATHS.market}>{zh ? '共享插件市场' : 'Shared marketplace'}<ArrowRightOutlined /></Link></aside>
    </div><Footer language={language} />
  </main>;
}
