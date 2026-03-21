import React, { useState } from 'react';
import { Alert, Button, Modal, Space, Typography } from 'antd';
import type { ButtonProps } from 'antd';
import { GlobalOutlined, HeartOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { translations } from '../translations';

const { Paragraph, Text } = Typography;

interface SupportDevelopmentButtonProps {
  language: 'zh' | 'en';
  buttonText?: string;
  block?: boolean;
  buttonSize?: ButtonProps['size'];
  buttonType?: ButtonProps['type'];
  className?: string;
  style?: React.CSSProperties;
  withMotion?: boolean;
}

const SupportDevelopmentButton: React.FC<SupportDevelopmentButtonProps> = ({
  language,
  buttonText,
  block = false,
  buttonSize = 'large',
  buttonType = 'default',
  className,
  style,
  withMotion = true,
}) => {
  const [open, setOpen] = useState(false);

  const t = (key: string): string => {
    const translation = translations[language];
    const value = translation[key as keyof typeof translation];
    return typeof value === 'string' ? value : key;
  };

  const trigger = (
    <Button
      block={block}
      className={className}
      type={buttonType}
      size={buttonSize}
      icon={<HeartOutlined />}
      style={style}
      onClick={() => setOpen(true)}
    >
      {buttonText ?? t('supportDevelopment')}
    </Button>
  );

  return (
    <>
      {withMotion ? (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          {trigger}
        </motion.div>
      ) : (
        trigger
      )}

      <Modal
        title={t('supportDialogTitle')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
      >
        <Space direction="vertical" size="middle" style={{ width: '100%', paddingTop: 8 }}>
          <Paragraph style={{ marginBottom: 0 }}>
            {t('supportDialogLead')}
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            {t('supportDevelopmentDesc')}
          </Paragraph>

          <Alert
            type="info"
            showIcon
            message={t('supportDevelopmentNote')}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Button
                type="primary"
                icon={<GlobalOutlined />}
                href="https://www.patreon.com/c/aaswordsman"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  borderRadius: 999,
                  background: '#f96854',
                  borderColor: '#f96854',
                }}
              >
                {t('supportPatreon')}
              </Button>
              <Text type="secondary">{t('supportPatreonHint')}</Text>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Button
                icon={<HeartOutlined />}
                href="https://ifdian.net/a/aaswordsman"
                target="_blank"
                rel="noopener noreferrer"
                style={{ borderRadius: 999 }}
              >
                {t('supportAfdian')}
              </Button>
              <Text type="secondary">{t('supportAfdianHint')}</Text>
            </div>
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default SupportDevelopmentButton;
