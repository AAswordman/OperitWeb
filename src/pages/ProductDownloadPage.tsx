import { useState } from 'react';
import { Alert, Button, Modal, QRCode, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { AppleOutlined, DesktopOutlined, AndroidOutlined, ArrowRightOutlined, BookOutlined, DownloadOutlined, GithubOutlined, WindowsOutlined } from '@ant-design/icons';
import DownloadLatestButton from '../components/DownloadLatestButton';
import Footer from '../components/Footer';
import { PRODUCTS, SHARED_PATHS, getExternalDownloadUrl, OPERIT_V2_DOWNLOAD_PLATFORMS, OPERIT_V2_BETA_GROUP_NUMBER, OPERIT_V2_BETA_GROUP_URL } from '../config/products';
import type { DownloadPlatform, Language, ProductGeneration } from '../config/products';
import './VersionPages.css';

export default function ProductDownloadPage({ generation, language }: { generation: ProductGeneration; language: Language }) {
  const [betaPlatform, setBetaPlatform] = useState<DownloadPlatform | null>(null);
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
          <p>{zh ? 'Operit 2 是全平台产品，不只面向 Apple 设备。iOS 与 macOS 通过 TestFlight 参与公测；Android、Windows 与 Linux 可通过各自的公测入口参与测试。' : 'Operit 2 is a cross-platform product, not limited to Apple devices. Join iOS and macOS public betas through TestFlight, or use the Android, Windows and Linux beta entries below.'}</p>
          <div className="version-platform-downloads">
            {OPERIT_V2_DOWNLOAD_PLATFORMS.map(platform => <article className="version-platform-download" key={platform.id}>
              <div className="version-platform-heading"><span className="version-platform-download-icon">{platform.id === 'android' ? <AndroidOutlined /> : platform.id === 'ios' ? <AppleOutlined /> : platform.id === 'windows' ? <WindowsOutlined /> : <DesktopOutlined />}</span><div><h3>{platform.name}</h3><span className="version-platform-caption">Operit 2 · {platform.channel === 'testflight' ? (zh ? '公测已开放' : 'Public beta available') : (zh ? '公测渠道' : 'Beta access')}</span></div></div>
              <p>{platform.channel === 'testflight' ? (zh ? `通过 TestFlight 参与 ${platform.name} 公测。` : `Join the ${platform.name} public beta through TestFlight.`) : (zh ? `通过公测入口获取 ${platform.name} 测试版本与安装说明。` : `Get ${platform.name} test builds and installation instructions through the beta channel.`)}</p>
              {platform.channel === 'testflight' ? <a className="version-primary-link" href={platform.url} target="_blank" rel="noopener noreferrer" data-platform={platform.id}><DownloadOutlined />{zh ? `加入 ${platform.name} 公测` : `Join ${platform.name} beta`}<ArrowRightOutlined /></a> : <button type="button" className="version-primary-link" data-platform={platform.id} aria-haspopup="dialog" onClick={() => setBetaPlatform(platform)}><DownloadOutlined />{zh ? `加入 ${platform.name} 公测` : `Join ${platform.name} beta`}<ArrowRightOutlined /></button>}
            </article>)}
          </div>
          <Alert type="info" showIcon message={zh ? '公测说明' : 'Beta information'} description={zh ? '公测版本不代表正式发布。各平台测试范围与安装说明，以对应公测入口中的公告为准。请勿将 Operit 1 的安装包作为二代安装包。' : 'Beta builds are not a general release. Check the selected platform’s beta channel for availability and installation instructions. Operit 1 packages are not Operit 2 installers.'} />
          {externalUrl && <a className="version-primary-link version-additional-download" href={externalUrl} target="_blank" rel="noopener noreferrer"><DownloadOutlined />{zh ? '其他官方二代发布入口' : 'Additional official Operit 2 releases'}<ArrowRightOutlined /></a>}
        </>}
        <div className="version-download-guide"><BookOutlined /><Link to={product.guidePath}>{zh ? `查看 ${product.name} 使用教程` : `${product.name} guides`}</Link><ArrowRightOutlined /></div>
      </section>
      <aside className="version-shared-note"><div><h2>{zh ? '确认版本，再开始。' : 'Choose the right generation.'}</h2><p>{zh ? '下载与教程必须对应你安装的产品代际；插件市场是两代共享的独立入口。' : 'Use guides for the generation you install. The plugin market is a separate, shared destination.'}</p></div><Link to={SHARED_PATHS.downloads}>{zh ? '切换下载版本' : 'Other generation'}<ArrowRightOutlined /></Link><Link to={SHARED_PATHS.market}>{zh ? '共享插件市场' : 'Shared marketplace'}<ArrowRightOutlined /></Link></aside>
    </div>
    <Modal className="version-beta-modal" title={zh ? `加入 ${betaPlatform?.name ?? ''} 公测` : `Join ${betaPlatform?.name ?? ''} beta`} open={generation === 'v2' && betaPlatform !== null} onCancel={() => setBetaPlatform(null)} centered width={440} footer={null} destroyOnHidden>
      <div className="version-beta-dialog">
        <p>{zh ? '加入公测群，获取测试版本、安装说明和最新公告。' : 'Join the beta group for test builds, installation instructions and announcements.'}</p>
        <div className="version-beta-qrcode" role="img" aria-label={zh ? '公测群入口二维码' : 'Beta group entry QR code'}>
          <QRCode type="svg" value={OPERIT_V2_BETA_GROUP_URL} size={200} color="#111111" bgColor="#ffffff" bordered={false} />
        </div>
        <span className="version-beta-scan-hint">{zh ? '扫描二维码打开群入口，或在 QQ 中搜索以下群号' : 'Scan to open the group entry, or search for this group number in QQ'}</span>
        <div className="version-beta-number">
          <span>{zh ? 'QQ群号' : 'QQ group'}</span>
          <Typography.Text copyable={{ text: OPERIT_V2_BETA_GROUP_NUMBER, tooltips: [zh ? '复制群号' : 'Copy group number', zh ? '已复制' : 'Copied'] }}>{OPERIT_V2_BETA_GROUP_NUMBER}</Typography.Text>
        </div>
        <Button block onClick={() => setBetaPlatform(null)}>{zh ? '关闭' : 'Close'}</Button>
      </div>
    </Modal>
    <Footer language={language} />
  </main>;
}
