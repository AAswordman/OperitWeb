import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
} from 'antd';
import {
  RobotOutlined,
  ToolOutlined,
  AppstoreOutlined,
  PlayCircleOutlined,
  GlobalOutlined,
  WindowsOutlined,
  StarOutlined,
  BookOutlined,
  ArrowRightOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { translations } from '../translations.ts';
import GachaGallery from '../components/GachaGallery';
import type { GachaGalleryRef } from '../components/GachaGallery';
import DownloadLatestButton from '../components/DownloadLatestButton';
import FooterComponent from '../components/Footer.tsx';
import SupportDevelopmentButton from '../components/SupportDevelopmentButton';
import './HomePage.css';

// 导入所有服务商的logo
import openAILogo from '/images/OTHER_LOGO/openai_latest.svg';
import geminiLogo from '/images/OTHER_LOGO/gemini_latest.svg';
import zhipuLogo from '/images/OTHER_LOGO/zhipu_latest.svg';
import openRouterLogo from '/images/OTHER_LOGO/openrouter_latest.svg';
import siliconFlowLogo from '/images/OTHER_LOGO/siliconflow_latest.svg';
import deepseekLogo from '/images/OTHER_LOGO/deepseek_latest.png';
import moonshotLogo from '/images/OTHER_LOGO/moonshot_latest.ico';
import anthropicLogo from '/images/OTHER_LOGO/anthropic_latest.svg';
import alibabaCloudLogo from '/images/OTHER_LOGO/alibabacloud_latest.svg';
import baiduLogo from '/images/OTHER_LOGO/baidu_latest.svg';
import mnnLogo from '/images/OTHER_LOGO/mnn_latest.png';


const { Title, Paragraph } = Typography;

interface HomePageProps {
  darkMode: boolean;
  language: 'zh' | 'en';
}

const HomePage: React.FC<HomePageProps> = ({ darkMode, language }) => {
  const t = (key: string): string => {
    const translation = translations[language];
    const value = translation[key as keyof typeof translation];
    return typeof value === 'string' ? value : key;
  };

  const gachaRef = useRef<GachaGalleryRef>(null);
  const [activeUseCase, setActiveUseCase] = useState(0);
  const zh = language === 'zh';

  const providers = [
    { name: 'OpenAI', logo: openAILogo },
    { name: 'Google Gemini', logo: geminiLogo },
    { name: 'Anthropic', logo: anthropicLogo },
    { name: 'DeepSeek', logo: deepseekLogo },
    { name: 'Zhipu AI', logo: zhipuLogo },
    { name: 'Moonshot AI', logo: moonshotLogo },
    { name: 'OpenRouter', logo: openRouterLogo },
    { name: 'SiliconFlow', logo: siliconFlowLogo },
    { name: zh ? '阿里云 · 通义千问' : 'Alibaba Cloud', logo: alibabaCloudLogo },
    { name: zh ? '百度 · 文心' : 'Baidu Wenxin', logo: baiduLogo },
    { name: 'MNN (Local Models)', logo: mnnLogo }
  ];

  const features = [
    {
      icon: <WindowsOutlined />,
      title: t('homeFeatureUbuntuTitle'),
      description: t('homeFeatureUbuntuDesc'),
      color: '#1890ff'
    },
    {
      icon: <RobotOutlined />,
      title: t('homeFeatureMemoryTitle'),
      description: t('homeFeatureMemoryDesc'),
      color: '#52c41a'
    },
    {
      icon: <PlayCircleOutlined />,
      title: t('homeFeatureVoiceTitle'),
      description: t('homeFeatureVoiceDesc'),
      color: '#722ed1'
    },
    {
      icon: <GlobalOutlined />,
      title: t('homeFeatureLocalModelTitle'),
      description: t('homeFeatureLocalModelDesc'),
      color: '#fa541c'
    },
    {
      icon: <AppstoreOutlined />,
      title: t('homeFeaturePersonaTitle'),
      description: t('homeFeaturePersonaDesc'),
      color: '#13c2c2'
    },
    {
      icon: <ToolOutlined />,
      title: t('homeFeatureWorkflowTitle'),
      description: t('homeFeatureWorkflowDesc'),
      color: '#eb2f96'
    }
  ];

  const exampleCards = [
    { title: t('smartDocProcessing'), description: t('smartDocProcessingDesc'), rarity: 'SSR' },
    { title: t('voiceToText'), description: t('voiceToTextDesc'), rarity: 'SR' },
    { title: t('imageRecognition'), description: t('imageRecognitionDesc'), rarity: 'SR' },
    { title: t('codeGeneration'), description: t('codeGenerationDesc'), rarity: 'SSR' },
    { title: t('scheduleManagement'), description: t('scheduleManagementDesc'), rarity: 'R' },
    { title: t('webScraping'), description: t('webScrapingDesc'), rarity: 'R' }
  ];

  const toolchainOverview = [
    {
      title: t('homeToolchainLinuxTitle'),
      description: t('homeToolchainLinuxDesc')
    },
    {
      title: t('homeToolchainFileTitle'),
      description: t('homeToolchainFileDesc')
    },
    {
      title: t('homeToolchainNetworkTitle'),
      description: t('homeToolchainNetworkDesc')
    },
    {
      title: t('homeToolchainAutomationTitle'),
      description: t('homeToolchainAutomationDesc')
    },
    {
      title: t('homeToolchainMediaTitle'),
      description: t('homeToolchainMediaDesc')
    },
    {
      title: t('homeToolchainDevTitle'),
      description: t('homeToolchainDevDesc')
    },
    {
      title: t('homeToolchainCreationTitle'),
      description: t('homeToolchainCreationDesc')
    },
    {
      title: t('homeToolchainSearchTitle'),
      description: t('homeToolchainSearchDesc')
    },
    {
      title: t('homeToolchainWorkflowTitle'),
      description: t('homeToolchainWorkflowDesc')
    }
  ];

  const useCaseCards = [
    {
      title: t('homeUseCaseStudentTitle'),
      description: t('homeUseCaseStudentDesc')
    },
    {
      title: t('homeUseCaseDeveloperTitle'),
      description: t('homeUseCaseDeveloperDesc')
    },
    {
      title: t('homeUseCaseCreatorTitle'),
      description: t('homeUseCaseCreatorDesc')
    },
    {
      title: t('homeUseCaseProductivityTitle'),
      description: t('homeUseCaseProductivityDesc')
    },
    {
      title: t('homeUseCaseDailyTitle'),
      description: t('homeUseCaseDailyDesc')
    },
    {
      title: t('homeUseCaseModelOpsTitle'),
      description: t('homeUseCaseModelOpsDesc')
    }
  ];

  return (
    <main className="classic-page" style={{ paddingTop: 88 }}>
      <div className="operit-legacy-banner">
        <span><strong>OPERIT 1</strong>{language === 'zh' ? '熟悉的功能、下载与生态，继续为你保留。' : 'Your familiar features, downloads and ecosystem, all still here.'}</span>
        <Link to="/">{language === 'zh' ? '了解 Operit 2 →' : 'Discover Operit 2 →'}</Link>
      </div>
      <section id="home" className="classic-hero" aria-labelledby="classic-hero-title">
        <div className="classic-hero-label"><span />Operit 1 <span className="classic-label-divider">/</span> {t('homeRibbonText')}</div>
        <Title id="classic-hero-title" level={1} className="classic-hero-title">
          {t('heroTitle1')}{!zh && ' '}<small className="classic-hero-first">{t('heroTitle2')}</small><br />
          {t('heroTitle3')}<br />
          <span>{t('heroTitle4')}</span>
        </Title>
        <Paragraph className="classic-hero-description">{t('homeHeroDescription')}</Paragraph>
        <div className="classic-hero-primary">
          <DownloadLatestButton downloadText={zh ? '下载 Operit 1' : 'Download Operit 1'} language={language} withMotion={false} style={{ height: 50, padding: '0 27px', fontSize: 15, borderRadius: 9 }} />
          <Link to="/guide" className="classic-docs-button"><BookOutlined />{t('viewDocs')}<ArrowRightOutlined /></Link>
        </div>
        <div className="classic-hero-secondary">
          <button onClick={() => { document.getElementById('gacha-gallery')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><StarOutlined />{zh ? '探索演示' : 'Explore demos'}</button>
          <span className="classic-action-divider" aria-hidden="true" />
          <SupportDevelopmentButton language={language} buttonText={t('supportDevelopment')} buttonType="text" buttonSize="small" withMotion={false} />
        </div>
      </section>

      <nav className="classic-section-nav" aria-label={zh ? 'Operit 1 内容导航' : 'Operit 1 sections'}>
        {[
          ['features', zh ? '核心能力' : 'Capabilities'],
          ['providers', zh ? '模型接入' : 'Models'],
          ['use-cases', zh ? '使用场景' : 'Use cases'],
          ['toolkit', zh ? '工具生态' : 'Toolkit'],
          ['gacha-gallery', zh ? '探索演示' : 'Explore demos'],
        ].map(([id, label]) => <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{label}<span>↗</span></button>)}
      </nav>

      <div className="classic-content">
        <section className="classic-section" id="features" aria-labelledby="classic-features-title">
          <div className="classic-section-heading">
            <div><span className="classic-eyebrow">01 / CAPABILITIES</span><h2 id="classic-features-title">{zh ? '不止对话，更能行动。' : 'Beyond conversation. Into action.'}</h2></div>
            <p>{zh ? '从记住你的偏好，到执行复杂任务。\n将日常所需，放进一个助手。' : 'From remembering your preferences to running complex tasks. Your everyday tools, together in one assistant.'}</p>
          </div>
          <div className="classic-feature-grid">
            {features.map((feature, index) => <article className="classic-feature" key={feature.title}>
              <div className="classic-feature-top"><span className="classic-feature-icon">{feature.icon}</span><span className="classic-index">0{index + 1}</span></div>
              <h3>{feature.title}</h3><p>{feature.description}</p>
            </article>)}
          </div>
        </section>

        <section className="classic-section" id="providers" aria-labelledby="classic-providers-title">
          <div className="classic-section-heading">
            <div><span className="classic-eyebrow">02 / MODEL CONNECTIONS</span><h2 id="classic-providers-title">{zh ? '模型，由你选择。' : 'Your assistant. Your choice of model.'}</h2></div>
            <p>{zh ? '云端服务与本地模型，各取所长。\n在同一个助手中，找到适合自己的配置。' : 'Cloud services and local models, each with their strengths. Find the right setup for you.'}</p>
          </div>
          <div className="classic-provider-panel">
            <div className="classic-panel-label"><span>{zh ? '云端模型与接入平台' : 'CLOUD MODELS & PLATFORMS'}</span><span>{zh ? '灵活配置 · 自由选择' : 'FLEXIBLE BY DESIGN'}</span></div>
            <ul className="classic-provider-grid">
              {providers.slice(0, -1).map(provider => <li key={provider.name}><span className="classic-provider-logo"><img src={provider.logo} alt="" loading="lazy" /></span><span>{provider.name}</span></li>)}
            </ul>
            <div className="classic-provider-bottom"><span>{t('andMore')}</span><Link to="/guide/old/ai-provider-basics">{zh ? '了解模型接入' : 'Model setup guide'} <ArrowRightOutlined /></Link></div>
          </div>
          <div className="classic-local-models"><div className="classic-local-icon"><GlobalOutlined /></div><div><h3>{zh ? '也可以，让 AI 留在本地。' : 'Or keep your AI local.'}</h3><p>{zh ? '支持 MNN 与 llama.cpp（GGUF）本地模型。' : 'Local model support with MNN and llama.cpp (GGUF).'}</p></div><span className="classic-model-tag">MNN</span><span className="classic-model-tag">llama.cpp</span></div>
          <p className="classic-provider-note">{zh ? '此处展示支持接入的服务与平台，不代表合作或背书。模型可用性、账户与费用以对应服务商为准。' : 'Listed services indicate supported integrations, not partnerships or endorsements. Model availability, accounts and fees depend on each provider.'}</p>
        </section>

        <section className="classic-section" id="use-cases" aria-labelledby="classic-cases-title">
          <div className="classic-section-heading"><div><span className="classic-eyebrow">03 / MADE FOR YOUR DAY</span><h2 id="classic-cases-title">{zh ? '从你的日常，开始。' : 'Start with your everyday.'}</h2></div><p>{zh ? '学习、开发、创作，或是少做一些重复工作。\n看看 Operit 能如何融入你的生活。' : 'Study, build, create, or spend less time on repetitive tasks. Find your way to use Operit.'}</p></div>
          <div className="classic-usecase-layout">
            <div className="classic-usecase-list" role="group" aria-label={zh ? '选择使用场景' : 'Choose a use case'}>{useCaseCards.map((item, index) => <button key={item.title} aria-pressed={activeUseCase === index} aria-controls="classic-usecase-detail" onClick={() => setActiveUseCase(index)}><span className="classic-index">0{index + 1}</span><span>{item.title}</span><ArrowRightOutlined /></button>)}</div>
            <div className="classic-usecase-detail" id="classic-usecase-detail" aria-live="polite" aria-atomic="true"><span className="classic-eyebrow">OPERIT 1 / EVERYDAY POSSIBILITIES</span><span className="classic-usecase-number" aria-hidden="true">0{activeUseCase + 1}</span><div><h3>{useCaseCards[activeUseCase].title}</h3><p>{useCaseCards[activeUseCase].description}</p><Link to="/guide/old">{zh ? '从使用手册开始' : 'Get started with the guide'} <ArrowRightOutlined /></Link></div></div>
          </div>
          <div className="classic-examples-heading"><h3>{t('featureShowcase')}</h3><span>{zh ? '把想法，变成具体的任务。' : 'Turn ideas into practical tasks.'}</span></div>
          <div className="classic-example-grid">{exampleCards.map(card => <article key={card.title}><CheckOutlined /><div><h4>{card.title}</h4><p>{card.description}</p></div></article>)}</div>
        </section>

        <section className="classic-section" id="toolkit" aria-labelledby="classic-tools-title">
          <div className="classic-section-heading"><div><span className="classic-eyebrow">04 / THE TOOLKIT</span><h2 id="classic-tools-title">{zh ? '能力，从这里延伸。' : 'Room to do more.'}</h2></div><p>{zh ? '从文件处理到工作流编排。\n展开分类，了解每一组工具的能力。' : 'From files to workflows. Expand a category to explore the tools within.'}</p></div>
          <div className="classic-tools-grid">{toolchainOverview.map((item, index) => <details key={item.title} className="classic-tool"><summary><span className="classic-index">0{index + 1}</span><span>{item.title}</span><span className="classic-tool-toggle" aria-hidden="true">+</span></summary><p>{item.description}</p></details>)}</div>
          <div className="classic-ecosystem-links"><Link to="/market"><AppstoreOutlined /><span>{zh ? '探索插件市场' : 'Explore the plugin market'}</span><ArrowRightOutlined /></Link><Link to="/guide/plugin"><BookOutlined /><span>{zh ? '阅读插件开发教程' : 'Read the plugin developer guide'}</span><ArrowRightOutlined /></Link></div>
        </section>

        <section className="classic-section classic-demo-section" id="gacha-gallery" aria-labelledby="classic-demo-title"><div className="classic-section-heading"><div><span className="classic-eyebrow">05 / EXPLORE THE POSSIBILITIES</span><h2 id="classic-demo-title">{zh ? '还有一些，意想不到。' : 'Discover something unexpected.'}</h2></div><p>{zh ? '抽取一组真实演示，看看更多玩法。' : 'Draw a set of real demos and discover more ways to use Operit.'}</p></div><GachaGallery darkMode={darkMode} ref={gachaRef} /></section>

        <section className="classic-start"><div><span className="classic-eyebrow">READY WHEN YOU ARE</span><h2>{zh ? '让下一件事，简单一点。' : 'Make your next task a little easier.'}</h2><p>{zh ? '继续使用 Operit 1，或了解即将到来的 Operit 2。' : 'Start with Operit 1, or discover what’s next with Operit 2.'}</p></div><div className="classic-start-actions"><DownloadLatestButton downloadText={zh ? '下载 Operit 1' : 'Download Operit 1'} language={language} /><Link to="/">{zh ? '了解 Operit 2' : 'Discover Operit 2'} <ArrowRightOutlined /></Link></div></section>
      </div>

      <FooterComponent language={language} />
    </main>
  );
};

export default HomePage; 
