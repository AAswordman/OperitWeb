import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Button,
  Card,
  Row,
  Col,
  Space,
  Avatar,
  Badge,
  Statistic,
  Carousel,
} from 'antd';
import { motion } from 'framer-motion';
import {
  RobotOutlined,
  ToolOutlined,
  AppstoreOutlined,
  PlayCircleOutlined,
  GlobalOutlined,
  WindowsOutlined,
  GithubOutlined,
  StarOutlined,
  ForkOutlined,
  TeamOutlined,
  BookOutlined
} from '@ant-design/icons';
import { translations } from '../translations.ts';
import AnimatedSection from '../components/AnimatedSection';
import GachaGallery from '../components/GachaGallery';
import type { GachaGalleryRef } from '../components/GachaGallery';
import useGitHubStats from '../hooks/useGitHubStats';
import DownloadLatestButton from '../components/DownloadLatestButton';

// 导入所有服务商的logo
import openAILogo from '/images/OTHER_LOGO/openai_new.png';
import geminiLogo from '/images/OTHER_LOGO/gemini_new.svg';
import zhipuLogo from '/images/OTHER_LOGO/zhipu.png';
import openRouterLogo from '/images/OTHER_LOGO/OpenRouter.png';
import siliconFlowLogo from '/images/OTHER_LOGO/SiliconFlow.png';
import deepseekLogo from '/images/OTHER_LOGO/DEEPSEEK.png';
import moonshotLogo from '/images/OTHER_LOGO/yuezhianmian.png';
import anthropicLogo from '/images/OTHER_LOGO/anthropic.png';
import tongyiLogo from '/images/OTHER_LOGO/tongyi_new.png';


const { Title, Paragraph, Text } = Typography;

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

  // 使用GitHub Stats Hook
  const { stargazersCount, forksCount, contributorsCount, loading, error } = useGitHubStats('AAswordman', 'Operit');

  const providers = [
    { name: 'OpenAI', logo: openAILogo },
    { name: 'Google Gemini', logo: geminiLogo },
    { name: 'Anthropic', logo: anthropicLogo },
    { name: 'Zhipu AI', logo: zhipuLogo },
    { name: 'OpenRouter', logo: openRouterLogo },
    { name: 'SiliconFlow', logo: siliconFlowLogo },
    { name: 'DeepSeek', logo: deepseekLogo },
    { name: 'Moonshot AI', logo: moonshotLogo },
    { name: 'Tongyi Qianwen', logo: tongyiLogo }
  ];

  const features = [
    {
      icon: <RobotOutlined />,
      title: t('aiAssistant'),
      description: t('aiAssistantDesc'),
      color: '#1890ff'
    },
    {
      icon: <ToolOutlined />,
      title: t('richTools'),
      description: t('richToolsDesc'),
      color: '#52c41a'
    },
    {
      icon: <AppstoreOutlined />,
      title: t('pluginSystem'),
      description: t('pluginSystemDesc'),
      color: '#722ed1'
    },
    {
      icon: <PlayCircleOutlined />,
      title: t('gameCreation'),
      description: t('gameCreationDesc'),
      color: '#fa541c'
    },
    {
      icon: <GlobalOutlined />,
      title: t('webDev'),
      description: t('webDevDesc'),
      color: '#13c2c2'
    },
    {
      icon: <WindowsOutlined />,
      title: t('floatingWindow'),
      description: t('floatingWindowDesc'),
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

  return (
    <main style={{ paddingTop: 88, paddingBottom: 40 }}>
      {/* Hero Section */}
      <div id="home" style={{ padding: '100px 24px 80px', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge.Ribbon 
              text="Android AI Assistant" 
              color="blue"
              style={{ 
                top: -10,
                fontSize: '14px',
                padding: '4px 12px',
                borderRadius: '6px'
              }}
            >
              <Title
                level={1}
                style={{
                  fontSize: 'clamp(36px, 7vw, 72px)',
                  color: darkMode ? '#fff' : '#0d1a26',
                  marginBottom: 24,
                  lineHeight: 1.2,
                  fontWeight: 700
                }}
              >
                {t('heroTitle1')}<Text style={{ color: '#52c41a' }}>{t('heroTitle2')}</Text>
                <br />
                {t('heroTitle3')}
                <br />
                <Text
                  style={{
                    background: 'linear-gradient(45deg, #1890ff, #722ed1, #eb2f96)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    fontSize: 'inherit',
                    animation: 'gradient-animation 5s ease infinite',
                  }}
                >
                  {t('heroTitle4')}
                </Text>
              </Title>
            </Badge.Ribbon>
            
            <Paragraph
              style={{
                fontSize: 20,
                color: darkMode ? '#a0a0a0' : '#595959',
                maxWidth: 600,
                margin: '0 auto 32px',
                lineHeight: 1.7
              }}
            >
              {t('heroSubtitle')}
            </Paragraph>

            <Space size="large" wrap style={{ justifyContent: 'center' }}>
              <DownloadLatestButton downloadText={t('downloadLatest')} />
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/guide">
                  <Button
                    size="large"
                    icon={<BookOutlined />}
                    style={{
                      height: 52,
                      fontSize: 18,
                      paddingLeft: 36,
                      paddingRight: 36,
                      borderRadius: '8px',
                    }}
                  >
                    {t('viewDocs')}
                  </Button>
                </Link>
              </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="large"
                  icon={<StarOutlined />}
                style={{
                  height: 52,
                  fontSize: 18,
                  paddingLeft: 36,
                  paddingRight: 36,
                  borderRadius: '8px',
                  }}
                  onClick={() => {
                    const gachaElement = document.getElementById('gacha-gallery');
                    if (gachaElement) {
                      gachaElement.scrollIntoView({ behavior: 'smooth' });
                      setTimeout(() => {
                        gachaRef.current?.draw();
                      }, 500); // 等待滚动动画结束
                    }
                  }}
                >
                  {t('goToGacha')}
              </Button>
            </motion.div>
            </Space>
          </motion.div>
      </div>
      
      {/* 抽卡功能 */}
      <AnimatedSection className="site-section">
        <div id="gacha-gallery">
          <GachaGallery darkMode={darkMode} ref={gachaRef} />
        </div>
      </AnimatedSection>
      
      <style>
        {`
          @keyframes gradient-animation {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .ant-carousel .slick-dots li button {
            background: ${darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} !important;
          }
          .ant-carousel .slick-dots li.slick-active button {
            background: ${darkMode ? '#1890ff' : '#1890ff'} !important;
          }
          .dark-mode-anchor .ant-anchor-link-title { color: #e5e7eb !important; }
          .dark-mode-anchor .ant-anchor-ink-ball { border-color: #e5e7eb !important; }
          .dark-mode-steps .ant-steps-item-title,
          .dark-mode-steps .ant-steps-item-description {
              color: rgba(255, 255, 255, 0.85) !important;
          }
          .dark-mode-steps .ant-steps-item-icon {
              background-color: rgba(255, 255, 255, 0.1) !important;
              border-color: rgba(255, 255, 255, 0.25) !importa
nt;
          }
          .dark-mode-steps .ant-steps-item-icon .ant-steps-icon {
              color: rgba(255, 255, 255, 0.85) !important;
          }
          .dark-mode-steps .ant-steps-item-tail::after {
              background-color: rgba(255, 255, 255, 0.25) !important;
          }
          .dark-mode-statistic .ant-statistic-title {
              color: rgba(255, 255, 255, 0.85) !important;
          }
        `}
      </style>

      {/* 示例卡片画廊 */}
      <AnimatedSection className="site-section">
        <div style={{ padding: '60px 24px' }}>
          <Row justify="center">
            <Col xs={24} lg={20}>
              <Title level={2} style={{ textAlign: 'center', color: darkMode ? 'white' : '#0d1a26', marginBottom: 40 }}>
                {t('featureShowcase')}
              </Title>
                <Carousel
                  autoplay
                  dots={{ className: 'custom-dots' }}
                  style={{ margin: '40px 0' }}
                  slidesToShow={3}
                  responsive={[
                    {
                      breakpoint: 1024,
                      settings: {
                        slidesToShow: 2,
                      }
                    },
                    {
                      breakpoint: 600,
                      settings: {
                        slidesToShow: 1,
                      }
                    }
                  ]}
                >
                  {exampleCards.map((card, index) => (
                    <div key={index} style={{ padding: '0 8px' }}>
                      <motion.div whileHover={{ y: -10, transition: { duration: 0.3 } }}>
                        <Card
                          hoverable
                          style={{
                            textAlign: 'center',
                            background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px'
                          }}
                        >
                          <Badge.Ribbon text={card.rarity} color={
                            card.rarity === 'SSR' ? '#f5222d' : 
                            card.rarity === 'SR' ? '#fa541c' : '#52c41a'
                          }>
                            <Title level={4} style={{ color: darkMode ? 'white' : '#1890ff', minHeight: 56 }}>
                              {card.title}
                            </Title>
                            <Paragraph style={{ color: darkMode ? '#d1d5db' : '#666', minHeight: 66 }}>
                              {card.description}
                            </Paragraph>
                          </Badge.Ribbon>
                        </Card>
                      </motion.div>
                    </div>
                  ))}
                </Carousel>
            </Col>
          </Row>
        </div>
      </AnimatedSection>
      
      {/* AI服务商支持 */}
      <AnimatedSection className="site-section">
        <div style={{ padding: '60px 24px' }}>
          <Row justify="center">
            <Col xs={24} lg={20}>
              <Title level={2} style={{ textAlign: 'center', color: darkMode ? 'white' : '#0d1a26', marginBottom: 40 }}>
                {t('serviceProviders')}
              </Title>
              <Row gutter={[24, 24]} justify="center" align="middle">
                {providers.map((provider, index) => (
                  <Col xs={8} sm={6} md={4} lg={3} key={index}>
                    <motion.div whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}>
                      <Card
                        hoverable
                        style={{
                          textAlign: 'center',
                          background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                        bodyStyle={{ padding: '16px 8px' }}
                      >
                          <Space direction="vertical" size={8}>
                           <img 
                             src={provider.logo} 
                             alt={provider.name} 
                             style={{ 
                               height: '32px', 
                               width: '100%',
                               maxWidth: '80px',
                               objectFit: 'contain', 
                               margin: '0 auto',
                               display: 'block'
                             }} 
                           />
                           <Text
                            style={{ 
                              fontSize: 12, 
                              color: darkMode ? '#d1d5db' : '#666' 
                            }}
                          >
                            {provider.name}
                          </Text>
                        </Space>
                      </Card>
                    </motion.div>
                  </Col>
                ))}
              </Row>
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <Text style={{ color: darkMode ? '#d1d5db' : '#666', fontSize: 16 }}>{t('andMore')}</Text>
              </div>
            </Col>
          </Row>
        </div>
      </AnimatedSection>

      {/* 核心功能 */}
      <AnimatedSection className="site-section">
        <div id="features" style={{ padding: '60px 24px' }}>
          <Row justify="center">
            <Col xs={24} lg={20}>
              <Title level={2} style={{ textAlign: 'center', color: darkMode ? 'white' : '#0d1a26', marginBottom: 40 }}>
                {t('coreFeatures')}
              </Title>
              <Row gutter={[32, 32]} style={{ marginTop: 40 }}>
                {features.map((feature, index) => (
                  <Col xs={24} sm={12} lg={8} key={index}>
                    <motion.div whileHover={{ y: -10, transition: { duration: 0.3 } }} style={{height: '100%'}}>
                      <Card
                        hoverable
                        style={{
                          height: '100%',
                          background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                          backdropFilter: 'blur(10px)',
                          border: `1px solid ${feature.color}50`,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          padding: '24px'
                        }}
                      >
                        <Space direction="vertical" size="middle" align="center" style={{ width: '100%', textAlign: 'center' }}>
                          <Avatar
                            size={64}
                            style={{ backgroundColor: `${feature.color}30`, color: feature.color, marginBottom: 16 }}
                            icon={React.cloneElement(feature.icon, {style: {fontSize: '32px'}})}
                          />
                          <Title level={4} style={{ color: darkMode ? 'white' : '#1890ff' }}>
                            {feature.title}
                          </Title>
                          <Paragraph style={{ color: darkMode ? '#d1d5db' : '#666' }}>
                            {feature.description}
                          </Paragraph>
                        </Space>
                      </Card>
                    </motion.div>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
        </div>
      </AnimatedSection>
      
      {/* GitHub统计 */}
      <AnimatedSection className="site-section">
        <div style={{ padding: '60px 24px' }}>
          <Row justify="center">
            <Col xs={24} lg={16}>
              <Card
                style={{
                  background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={8}>
                    <div className={darkMode ? 'dark-mode-statistic' : ''}>
                      <Statistic
                        title={t('projectStars')}
                        value={loading ? 0 : stargazersCount}
                        prefix={<StarOutlined />}
                        valueStyle={{ color: '#fadb14' }}
                        loading={loading}
                      />
                    </div>
                  </Col>
                  <Col xs={24} sm={8}>
                    <div className={darkMode ? 'dark-mode-statistic' : ''}>
                      <Statistic
                        title={t('forkCount')}
                        value={loading ? 0 : forksCount}
                        prefix={<ForkOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                        loading={loading}
                      />
                    </div>
                  </Col>
                  <Col xs={24} sm={8}>
                    <div className={darkMode ? 'dark-mode-statistic' : ''}>
                      <Statistic
                        title={t('contributorsTitle')}
                        value={loading ? 0 : contributorsCount}
                        prefix={<TeamOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                        loading={loading}
                      />
                    </div>
                  </Col>
                </Row>
                {error && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {t('githubDataError')}
                    </Text>
                  </div>
                )}
                <div style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    icon={<GithubOutlined />}
                    size="large"
                    href="https://github.com/AAswordman/Operit"
                    target="_blank"
                  >
                    {t('starOnGitHub')}
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </AnimatedSection>
    </main>
  );
};

export default HomePage; 