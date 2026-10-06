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
    const root = document.documentElement;
    const scale = dpi / 100;
    root.style.zoom = `${scale}`;
    // CSS viewport units do not shrink with root CSS zoom. Express the
    // visible height in the same logical pixels as the scaled sidebar.
    const updateViewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--site-viewport-height', `${height / scale}px`);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
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
            colorBgBase: '#0b0c0f',
            colorBgContainer: '#121418',
            colorBgElevated: '#1a1c22',
            colorBorder: '#292c33',
            colorBorderSecondary: '#22252d',
            colorText: '#f0f1f3',
            colorTextSecondary: '#9499a4',
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


