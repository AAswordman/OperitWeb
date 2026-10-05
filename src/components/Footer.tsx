import { Link, useLocation } from 'react-router-dom';
import { PRODUCTS, SHARED_PATHS, getProductFromPath } from '../config/products';
import { GithubOutlined, MailOutlined, MessageOutlined, WechatOutlined } from '@ant-design/icons';
import { translations } from '../translations';
import './Footer.css';

interface FooterProps { language: 'zh' | 'en'; }

export default function Footer({ language }: FooterProps) {
  const zh = language === 'zh';
  const product = getProductFromPath(useLocation().pathname);
  const t = (key: string): string => {
    const translation = translations[language];
    const value = translation[key as keyof typeof translation];
    return typeof value === 'string' ? value : key;
  };
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="site-footer-brand"><Link to="/"><img src="/logo.svg" alt="" /><span>Operit<span>.</span></span></Link><p>{zh ? '让想法行动起来。' : 'Turn your ideas into action.'}</p><span className="site-footer-caption">YOUR IDEAS. MORE POSSIBILITIES.</span></div>
        <div className="site-footer-column"><h2>{zh ? '探索产品' : 'Explore'}</h2><Link to={PRODUCTS.v2.homePath}>Operit 2</Link><Link to={PRODUCTS.v1.homePath}>Operit 1</Link><Link to={SHARED_PATHS.downloads}>{zh ? '下载与版本选择' : 'Downloads'}</Link><Link to={SHARED_PATHS.market}>{zh ? '插件市场' : 'Plugin market'}</Link></div>
        <div className="site-footer-column"><h2>{zh ? '文档与资源' : 'Resources'}</h2><Link to={SHARED_PATHS.guides}>{zh ? '选择教程版本' : 'Choose documentation'}</Link>{product ? <Link to={product.guidePath}>{product.name} {zh ? '使用教程' : 'guides'}</Link> : <><Link to={PRODUCTS.v2.guidePath}>{zh ? '二代教程' : 'Operit 2 guides'}</Link><Link to={PRODUCTS.v1.guidePath}>{zh ? '一代教程' : 'Operit 1 guides'}</Link></>}<Link to={SHARED_PATHS.pluginGuide}>{zh ? '插件开发' : 'Plugin development'}</Link></div>
        <div className="site-footer-column"><h2>{t('contact')}</h2><a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer"><GithubOutlined />{t('githubDiscussions')}</a><a href="https://qm.qq.com/q/Sa4fKEH7sO" target="_blank" rel="noopener noreferrer"><WechatOutlined />{t('qqGroup')}</a><a href="https://discord.gg/YnV9MWurRF" target="_blank" rel="noopener noreferrer"><MessageOutlined />{t('discord')}</a><a href="mailto:aaswordsman@foxmail.com"><MailOutlined />{t('email')}</a></div>
      </div>
      <div className="site-footer-bottom"><span>© {new Date().getFullYear()} Operit. All rights reserved.</span><span>{zh ? '保持好奇，继续探索。' : 'Stay curious. Keep exploring.'}</span></div>
    </footer>
  );
}
