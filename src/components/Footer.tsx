import React from 'react';
import { theme, Layout, Typography, Row, Col, Space, Avatar } from 'antd';
import {
    GithubOutlined,
    MailOutlined,
    MessageOutlined,
    WechatOutlined,
} from '@ant-design/icons';
import { translations } from '../translations';
import logo from '/logo.png';

const { Footer: AntFooter } = Layout;
const { Title, Text } = Typography;

interface FooterProps {
    language: 'zh' | 'en';
}

const Footer: React.FC<FooterProps> = ({ language }) => {
    const { token } = theme.useToken();
    const t = (key: string): string => {
        const translation = translations[language];
        const value = translation[key as keyof typeof translation];
        return typeof value === 'string' ? value : key;
    };

    return (
        <AntFooter
            style={{
                background: 'transparent',
                textAlign: 'center',
                padding: '40px 24px',
            }}
        >
            <Row justify="center">
                <Col xs={24} lg={16}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Space>
                            <Avatar
                                size={32}
                                src={logo}
                                style={{ backgroundColor: 'transparent' }}
                            />
                            <Title level={4} style={{ margin: 0, color: token.colorText }}>
                                Operit AI
                            </Title>
                        </Space>

                        <div style={{ color: token.colorTextSecondary }}>
                            <Title
                                level={5}
                                style={{ color: token.colorText, marginBottom: 12 }}
                            >
                                {t('contact')}
                            </Title>
                            <Space wrap size="middle" style={{ justifyContent: 'center' }}>
                                <a
                                    href="https://github.com/AAswordman/Operit/discussions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: token.colorTextSecondary }}
                                >
                                    <Space size={4}>
                                        <GithubOutlined />
                                        <span>{t('githubDiscussions')}</span>
                                    </Space>
                                </a>
                                <span>•</span>
                                <a
                                    href="mailto:aaswordsman@foxmail.com"
                                    style={{ color: token.colorTextSecondary }}
                                >
                                    <Space size={4}>
                                        <MailOutlined />
                                        <span>{t('email')}</span>
                                    </Space>
                                </a>
                                <span>•</span>
                                <a
                                    href="https://qm.qq.com/q/Sa4fKEH7sO"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: token.colorTextSecondary }}
                                >
                                    <Space size={4}>
                                        <WechatOutlined />
                                        <span>{t('qqGroup')}</span>
                                    </Space>
                                </a>
                                <span>•</span>
                                <a
                                    href="https://discord.gg/YnV9MWurRF"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: token.colorTextSecondary }}
                                >
                                    <Space size={4}>
                                        <MessageOutlined />
                                        <span>{t('discord')}</span>
                                    </Space>
                                </a>
                            </Space>
                        </div>

                        <Text style={{ color: token.colorTextTertiary, fontSize: 12 }}>
                            © 2024 Operit AI. All rights reserved.
                        </Text>
                    </Space>
                </Col>
            </Row>
        </AntFooter>
    );
};

export default Footer;
