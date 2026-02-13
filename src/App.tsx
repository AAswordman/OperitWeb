import React, { useState, useEffect, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';

const GuidePage = lazy(() => import('./pages/GuidePage'));
const GuideIndex = lazy(() => import('./pages/GuideIndex'));
const MarkdownRenderer = lazy(() => import('./components/MarkdownRenderer'));
const GuideContent = lazy(() => import('./pages/GuideContent'));
const ReturnCodeGeneratorPage = lazy(() => import('./pages/ReturnCodeGeneratorPage'));
const OperitSubmissionAdminPage = lazy(() => import('./pages/OperitSubmissionAdminPage'));
const OperitSubmissionEditPage = lazy(() => import('./pages/OperitSubmissionEditPage'));
const OperitSubmissionCenterPage = lazy(() => import('./pages/OperitSubmissionCenterPage'));
const OperitLoginPage = lazy(() => import('./pages/OperitLoginPage'));
const OperitOwnerAdminPage = lazy(() => import('./pages/OperitOwnerAdminPage'));

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      return JSON.parse(savedMode);
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
  const [dpi, setDpi] = useState<number>(() => {
    const savedDpi = localStorage.getItem('dpi');
    const initialDpi = savedDpi ? parseFloat(savedDpi) : 100;
    // 立即应用DPI设置
    document.documentElement.style.zoom = `${initialDpi / 100}`;
    return initialDpi;
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

  useEffect(() => {
    localStorage.setItem('dpi', dpi.toString());
    document.documentElement.style.zoom = `${dpi / 100}`;
  }, [dpi]);

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
                dpi={dpi}
                setDpi={setDpi}
              />
            }
          >
            <Route index element={<HomePage darkMode={darkMode} language={language} />} />
            <Route path="guide" element={<GuidePage darkMode={darkMode} language={language} />}>
              <Route index element={<GuideIndex language={language} />} />
              <Route path="quick-start" element={<MarkdownRenderer file="quick-start" language={language} />} />
              <Route path="ai-provider-basics" element={<MarkdownRenderer file="ai-provider-basics" language={language} />} />
              <Route path="faq" element={<MarkdownRenderer file="faq" language={language} />} />
              <Route path="tools-and-features/return-code-generator" element={<ReturnCodeGeneratorPage />} />
              <Route path=":category/*" element={<GuideContent language={language} />} />
            </Route>
            <Route path="operit-submission-edit" element={<OperitSubmissionEditPage language={language} />} />
            <Route path="operit-login" element={<OperitLoginPage language={language} />} />
            <Route path="operit-submission-admin" element={<OperitSubmissionAdminPage language={language} />} />
            <Route path="operit-owner-admin" element={<OperitOwnerAdminPage language={language} />} />
            <Route path="operit-submission-center/*" element={<OperitSubmissionCenterPage language={language} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App; 
