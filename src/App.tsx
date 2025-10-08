import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import GuidePage from './pages/GuidePage';
import GuideIndex from './pages/GuideIndex';
import MarkdownRenderer from './components/MarkdownRenderer';
import GuideContent from './pages/GuideContent';
import ReturnCodeGeneratorPage from './pages/ReturnCodeGeneratorPage';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });
  const [language, setLanguage] = useState<'zh' | 'en'>(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      return savedLanguage as 'zh' | 'en';
    }
    // 获取浏览器语言
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              <MainLayout 
                darkMode={darkMode} 
                setDarkMode={setDarkMode} 
                language={language} 
                setLanguage={setLanguage} 
              />
            }
          >
            <Route index element={<HomePage darkMode={darkMode} language={language} />} />
            <Route path="guide" element={<GuidePage darkMode={darkMode} language={language} />}>
              <Route index element={<GuideIndex language={language} />} />
              <Route path="quick-start" element={<MarkdownRenderer file="quick-start" language={language} />} />
              <Route path="faq" element={<MarkdownRenderer file="faq" language={language} />} />
              <Route path="tools-and-features/return-code-generator" element={<ReturnCodeGeneratorPage />} />
              <Route path=":category/:slug" element={<GuideContent language={language} />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App; 