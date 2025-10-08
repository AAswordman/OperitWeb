import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Space, message, Typography } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

const ReturnCodeGenerator: React.FC = () => {
  const [invitationCode, setInvitationCode] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const generateRandomDeviceId = (): string => {
    const array = new Uint8Array(8);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('');
  };

  useEffect(() => {
    setDeviceId(generateRandomDeviceId());
  }, []);

  const handleInvitationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInvitationCode(text);
    
    // 正则表达式匹配分享语中的 "邀请码:设备哈希" 部分
    const regex = /\[OperitAI邀请码:([^\]]+)\]/;
    const match = text.match(regex);
    
    if (match && match[1]) {
      // 使用微小的延迟来确保输入操作完成
      setTimeout(() => {
        setInvitationCode(match[1]);
      }, 10);
    }
  };

  const hmacSha256 = async (message: string, secret: string): Promise<string> => {
    // 将字符串显式地使用 UTF-8 编码转换为 ArrayBuffer
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    const secretBuffer = encoder.encode(secret);
    
    // 从密钥创建一个 CryptoKey
    const key = await window.crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // 计算签名
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      key,
      messageBuffer
    );
    
    // 将签名转换为 Base64
    return arrayBufferToBase64(signature);
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const generateConfirmationCode = async (invitationCode: string, deviceId: string): Promise<string> => {
    // 使用 SubtleCrypto API 计算 HMAC-SHA256
    const base64Signature = await hmacSha256(deviceId, invitationCode);
    // 拼接最终的返回码
    return `${deviceId}:${base64Signature}`;
  };

  const handleGenerateCode = async () => {
    const rawCode = invitationCode.trim();
    // 真正的邀请码（密钥）是冒号前的部分
    const cleanInvitationCode = rawCode.split(':')[0];
    const cleanDeviceId = deviceId.trim();
    
    if (!cleanInvitationCode || !cleanDeviceId) {
      message.error('请输入有效的分享语或邀请码');
      return;
    }
    
    try {
      const confirmationCode = await generateConfirmationCode(cleanInvitationCode, cleanDeviceId);
      setGeneratedCode(confirmationCode);
      message.success('返回码生成成功！');
    } catch (error) {
      message.error('生成返回码失败: ' + (error as Error).message);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedCode) return;
    
    try {
      await navigator.clipboard.writeText(generatedCode);
      message.success('复制成功！');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <Card 
      title="邀请返回码生成工具" 
      style={{ width: '100%' }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Paragraph>
            通过此工具，您可以为被邀请用户生成有效的返回码。只需输入您的邀请码和对方的设备ID，点击生成按钮即可。
          </Paragraph>
        </div>

        <div>
          <Text strong>分享语或邀请码:</Text>
          <Input
            placeholder="请粘贴分享语，将自动提取邀请信息"
            value={invitationCode}
            onChange={handleInvitationCodeChange}
            style={{ marginTop: 8 }}
          />
        </div>

        <div>
          <Text strong>设备ID (已随机生成):</Text>
          <Input.Group compact style={{ marginTop: 8 }}>
            <Input
              value={deviceId}
              readOnly
              style={{ width: 'calc(100% - 40px)' }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setDeviceId(generateRandomDeviceId())}
              title="重新生成随机设备ID"
            />
          </Input.Group>
        </div>

        <Button 
          type="primary" 
          onClick={handleGenerateCode}
          style={{ width: '100%' }}
        >
          生成返回码
        </Button>

        {generatedCode && (
          <div>
            <Text strong>返回码：</Text>
            <Input.Group compact style={{ marginTop: 8 }}>
              <Input
                value={generatedCode}
                readOnly
                style={{ width: 'calc(100% - 40px)' }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={copyToClipboard}
                title="复制到剪贴板"
              />
            </Input.Group>
            <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
              返回码格式：设备ID:签名
            </Paragraph>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default ReturnCodeGenerator; 