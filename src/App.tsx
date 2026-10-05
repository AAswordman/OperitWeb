import React, { useState, useEffect } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import AppRoutes from './routing/AppRoutes';
import SiteMetadata from './components/SiteMetadata';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    // The midnight redesign defaults to dark, independently of the legacy theme.
    // Subsequent explicit theme choices remain persistent.
    return localStorage.getItem('operit-theme-v2') !== 'light';
  });
  const [language, setLanguage] = useState<'zh' | 'en'>(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage === 'zh' || savedLanguage === 'en') {
      return savedLanguage;
    }
    // 获取浏览器语言
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  });
  const [dpi, setDpi] = useState<number>(() => {
    const savedDpi = localStorage.getItem('dpi');
    const initialDpi = savedDpi ? parseFloat(savedDpi) : 100;
    // 立即应用DPI设置
    document.documentElement.style.zoom = `${initialDpi / 100}`;
    return initialDpi;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    localStorage.setItem('operit-theme-v2', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('dpi', dpi.toString());
    document.documentElement.style.zoom = `${dpi / 100}`;
  }, [dpi]);

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#4285ff',
          colorInfo: '#4285ff',
          borderRadius: 10,
          fontFamily: "Inter, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          ...(darkMode ? {
            colorBgBase: '#060911',
            colorBgContainer: '#0d1523',
            colorBgElevated: '#111e32',
            colorBorder: '#263852',
            colorBorderSecondary: '#1b2a41',
            colorText: '#e8f0ff',
            colorTextSecondary: '#a1b2cc',
          } : {}),
        },
      }}
    >
      <Router>
        <SiteMetadata language={language} />
        <AppRoutes
          darkMode={darkMode} setDarkMode={setDarkMode}
          language={language} setLanguage={setLanguage}
          dpi={dpi} setDpi={setDpi}
        />
      </Router>
    </ConfigProvider>
  );
}

export default App; 


