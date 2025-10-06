import React from 'react';
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

const { Title, Paragraph } = Typography;

const guideItems = [
  {
    title: '界面指南',
    description: '探索Operit AI的各项功能与界面。',
    link: '/guide/interface-guide/panel-introduction',
    icon: <AppstoreOutlined />,
  },
  {
    title: '快速上手',
    description: '一步步教你完成Operit AI的初始设置，开启智能之旅。',
    link: '/guide/quick-start',
    icon: <BookOutlined />,
  },
  {
    title: '模型配置',
    description: '学习如何配置AI模型API，解锁Operit AI的全部潜能。',
    link: '/guide/basic-config/model-config',
    icon: <ApiOutlined />,
  },
  {
    title: '如何打包软件？',
    description: '将你的Web应用打包成桌面应用，轻松分发。',
    link: '/guide/development/web-packaging',
    icon: <BuildOutlined />,
  },
  {
    title: '常见问题',
    description: '查看常见问题解答，快速解决使用中的疑问。',
    link: '/guide/faq',
    icon: <QuestionCircleOutlined />,
  },
  {
    title: '角色卡',
    description: '学习如何导入和管理你的AI角色。',
    link: '/guide/character-system/character-cards',
    icon: <UserAddOutlined />,
  },
];

const GuideIndex: React.FC = () => {
  return (
    <div>
      <Title level={2} style={{ textAlign: 'center', marginBottom: '16px' }}>
        欢迎来到 Operit AI 文档中心
      </Title>
      <Paragraph style={{ textAlign: 'center', marginBottom: '48px', fontSize: '16px' }}>
        在这里你可以找到所有关于 Operit AI 的使用指南和常见问题解答。
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