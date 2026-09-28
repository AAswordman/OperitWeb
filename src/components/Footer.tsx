import { Link } from 'react-router-dom';
import { GithubOutlined, MailOutlined, MessageOutlined, WechatOutlined } from '@ant-design/icons';
import { translations } from '../translations';
import './Footer.css';

interface FooterProps { language: 'zh' | 'en'; }

export default function Footer({ language }: FooterProps) {
  const zh = language === 'zh';
  const t = (key: string): string => {
    const translation = translations[language];
    const value = translation[key as keyof typeof translation];
    return typeof value === 'string' ? value : key;
  };
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="site-footer-brand"><Link to="/"><img src="/logo.svg" alt="" /><span>Operit<span>.</span></span></Link><p>{zh ? '让想法行动起来。' : 'Turn your ideas into action.'}</p><span className="site-footer-caption">YOUR IDEAS. MORE POSSIBILITIES.</span></div>
        <div className="site-footer-column"><h2>{zh ? '探索产品' : 'Explore'}</h2><Link to="/">Operit 2</Link><Link to="/classic">Operit 1</Link><Link to="/market">{zh ? '插件市场' : 'Plugin market'}</Link></div>
        <div className="site-footer-column"><h2>{zh ? '文档与资源' : 'Resources'}</h2><Link to="/guide">{zh ? '使用文档' : 'Documentation'}</Link><Link to="/guide/old/quick-start">{zh ? '快速开始' : 'Quick start'}</Link><Link to="/guide/plugin">{zh ? '插件开发' : 'Plugin development'}</Link></div>
        <div className="site-footer-column"><h2>{t('contact')}</h2><a href="https://github.com/AAswordman/Operit/discussions" target="_blank" rel="noopener noreferrer"><GithubOutlined />{t('githubDiscussions')}</a><a href="https://qm.qq.com/q/Sa4fKEH7sO" target="_blank" rel="noopener noreferrer"><WechatOutlined />{t('qqGroup')}</a><a href="https://discord.gg/YnV9MWurRF" target="_blank" rel="noopener noreferrer"><MessageOutlined />{t('discord')}</a><a href="mailto:aaswordsman@foxmail.com"><MailOutlined />{t('email')}</a></div>
      </div>
      <div className="site-footer-bottom"><span>© {new Date().getFullYear()} Operit. All rights reserved.</span><span>{zh ? '保持好奇，继续探索。' : 'Stay curious. Keep exploring.'}</span></div>
    </footer>
  );
}
