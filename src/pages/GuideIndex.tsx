import React, { useMemo } from 'react';
import { Card, Row, Col, Typography } from 'antd';
import { Link } from 'react-router-dom';
import {
  AppstoreOutlined,
  ApiOutlined,
  BuildOutlined,
  QuestionCircleOutlined,
  UserAddOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { translations } from '../translations';

const { Title, Paragraph } = Typography;

const GuideIndex: React.FC<{ language: 'zh' | 'en' }> = ({ language }) => {
  const t = translations[language].guide;
  
  const guideItems = useMemo(() => [
    {
      title: t.interfaceGuide,
      description: t.interfaceGuideDesc,
      link: '/guide/interface-guide/panel-introduction',
      icon: <AppstoreOutlined />,
    },
    {
      title: t.quickStart,
      description: t.quickStartDesc,
      link: '/guide/quick-start',
      icon: <BookOutlined />,
    },
    {
      title: t.modelConfig,
      description: t.modelConfigDesc,
      link: '/guide/basic-config/model-config',
      icon: <ApiOutlined />,
    },
    {
      title: t.webPackagingTitle,
      description: t.webPackagingDesc,
      link: '/guide/development/web-packaging',
      icon: <BuildOutlined />,
    },
    {
      title: t.faq,
      description: t.faqDesc,
      link: '/guide/faq',
      icon: <QuestionCircleOutlined />,
    },
    {
      title: t.characterCards,
      description: t.characterCardsDesc,
      link: '/guide/character-system/character-cards',
      icon: <UserAddOutlined />,
    },
  ], [t]);

  return (
    <div>
      <Title level={2} style={{ textAlign: 'center', margin: '20px 0' }}>
        {t.welcomeTitle}
      </Title>
      <Paragraph style={{ textAlign: 'center', marginBottom: '48px', fontSize: '16px' }}>
        {t.welcomeDesc}
      </Paragraph>
      <Row gutter={[24, 24]}>
        {guideItems.map((item, index) => (
          <Col xs={24} sm={12} md={8} key={index}>
            <Link to={item.link}>
              <Card hoverable style={{ height: '100%'}}>
                <Card.Meta
                  avatar={React.cloneElement(item.icon, { style: { fontSize: '32px', color: '#1890ff' } })}
                  title={<Title level={5}>{item.title}</Title>}
                  description={<Paragraph style={{minHeight: '44px'}}>{item.description}</Paragraph>}
                />
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default GuideIndex; 