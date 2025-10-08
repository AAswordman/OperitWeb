import React, { useState, useEffect } from 'react';
import { Button, Modal } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

interface DownloadLatestButtonProps {
  downloadText: string;
}

const DownloadLatestButton: React.FC<DownloadLatestButtonProps> = ({ downloadText }) => {
  const [downloadUrl, setDownloadUrl] = useState<string>('https://github.com/AAswordman/Operit/releases');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  useEffect(() => {
    const fetchLatestRelease = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://api.github.com/repos/AAswordman/Operit/releases/latest');
        if (!response.ok) {
          throw new Error(`GitHub API request failed with status ${response.status}`);
        }
        const data = await response.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
        const apkAsset = data.assets?.find((asset) => asset.name.endsWith('.apk'));
        if (apkAsset) {
          setDownloadUrl(apkAsset.browser_download_url);
        }
      } catch (error) {
        console.error('Error fetching GitHub release:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestRelease();
  }, []);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const mirrors = [
    { name: '镜像 1', url: 'https://mirror.ghproxy.com/' },
    { name: '镜像 2', url: 'https://ghfast.top/' },
    { name: '镜像 3', url: 'https://hub.gitmirror.com/' },
    { name: '镜像 4', url: 'https://github.abskoop.workers.dev/' }
  ];

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          type="primary"
          size="large"
          icon={<DownloadOutlined />}
          style={{
            height: 52,
            fontSize: 18,
            paddingLeft: 36,
            paddingRight: 36,
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(24, 144, 255, 0.2)'
          }}
          onClick={showModal}
          loading={isLoading}
        >
          {downloadText}
        </Button>
      </motion.div>
      <Modal
        title="选择下载方式"
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '20px' }}>
          <Button type="primary" href={downloadUrl} target="_blank" onClick={handleCancel}>
            GitHub 下载
          </Button>
          {mirrors.map(mirror => (
            <Button key={mirror.name} href={`${mirror.url}${downloadUrl}`} target="_blank" onClick={handleCancel}>
              {mirror.name}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
};

export default DownloadLatestButton; 