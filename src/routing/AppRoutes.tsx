import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import type { SitePreferences } from '../components/SiteHeader';
import LaunchPage from '../pages/LaunchPage';
import { PRODUCTS, SHARED_PATHS } from '../config/products';
import LegacyRedirect from './LegacyRedirect';

const HomePage = lazy(() => import('../pages/HomePage'));
const VersionHubPage = lazy(() => import('../pages/VersionHubPage'));
const ProductDownloadPage = lazy(() => import('../pages/ProductDownloadPage'));
const GuidePage = lazy(() => import('../pages/GuidePage'));
const GuideIndex = lazy(() => import('../pages/GuideIndex'));
const GuideNewPage = lazy(() => import('../pages/GuideNewPage'));
const GuideNewContent = lazy(() => import('../pages/GuideNewContent'));
const GuideV2Page = lazy(() => import('../pages/GuideV2Page'));
const GuideContent = lazy(() => import('../pages/GuideContent'));
const MarkdownRenderer = lazy(() => import('../components/MarkdownRenderer'));
const PluginTutorialPage = lazy(() => import('../pages/PluginTutorialPage'));
const PluginTutorialContent = lazy(() => import('../pages/PluginTutorialContent'));
const ReturnCodeGeneratorPage = lazy(() => import('../pages/ReturnCodeGeneratorPage'));
const OperitSubmissionAdminPage = lazy(() => import('../pages/OperitSubmissionAdminPage'));
const OperitSubmissionEditPage = lazy(() => import('../pages/OperitSubmissionEditPage'));
const OperitSubmissionCenterPage = lazy(() => import('../pages/OperitSubmissionCenterPage'));
const OperitLoginPage = lazy(() => import('../pages/OperitLoginPage'));
const OperitReviewerApplyPage = lazy(() => import('../pages/OperitReviewerApplyPage'));
const OperitOwnerAdminPage = lazy(() => import('../pages/OperitOwnerAdminPage'));
const OperitMCPMarketPage = lazy(() => import('../pages/OperitMCPMarketPage'));
const OperitMarketReviewPage = lazy(() => import('../pages/OperitMarketReviewPage'));
const ProjectUpdatePage = lazy(() => import('../pages/ProjectUpdatePage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

// Product pages live under generation namespaces. Account, market and developer
// routes deliberately stay at the site root, using a single implementation/API.
export default function AppRoutes(preferences: SitePreferences) {
  const { darkMode, language } = preferences;
  const referencePath = `${PRODUCTS.v1.guidePath}/reference`;
  return <Routes>
    <Route path="/" element={<MainLayout {...preferences} />}>
      <Route index element={<LaunchPage language={language} />} />
      <Route path={SHARED_PATHS.downloads} element={<VersionHubPage language={language} section="download" />} />
      <Route path={SHARED_PATHS.guides} element={<VersionHubPage language={language} section="guide" />} />
      <Route path="v1">
        <Route index element={<HomePage darkMode={darkMode} language={language} />} />
        <Route path="download" element={<ProductDownloadPage generation="v1" language={language} />} />
        <Route path="guide">
          <Route element={<GuideNewPage darkMode={darkMode} language={language} basePath={PRODUCTS.v1.guidePath} />}>
            <Route index element={<MarkdownRenderer file={`${PRODUCTS.v1.markdownRoot}/index`} language={language} />} />
            <Route path="beginner-tutorial/:slug" element={<GuideNewContent language={language} />} />
          </Route>
          <Route path="reference" element={<GuidePage darkMode={darkMode} language={language} basePath={referencePath} />}>
            <Route index element={<GuideIndex language={language} basePath={referencePath} />} />
            <Route path="quick-start" element={<MarkdownRenderer file="quick-start" language={language} />} />
            <Route path="ai-provider-basics" element={<MarkdownRenderer file="ai-provider-basics" language={language} />} />
            <Route path="faq" element={<MarkdownRenderer file="faq" language={language} />} />
            <Route path="tools-and-features/return-code-generator" element={<ReturnCodeGeneratorPage />} />
            <Route path=":category/*" element={<GuideContent language={language} />} />
          </Route>
        </Route>
        <Route path="market/*" element={<LegacyRedirect />} />
      </Route>
      <Route path="v2">
        <Route index element={<LaunchPage language={language} productPage />} />
        <Route path="download" element={<ProductDownloadPage generation="v2" language={language} />} />
        <Route path="guide" element={<GuideV2Page language={language} />}>
          <Route index element={<MarkdownRenderer file={`${PRODUCTS.v2.markdownRoot}/index`} language={language} />} />
          <Route path="release-information" element={<MarkdownRenderer file={`${PRODUCTS.v2.markdownRoot}/release-information`} language={language} />} />
        </Route>
        <Route path="market/*" element={<LegacyRedirect />} />
      </Route>
      <Route path={SHARED_PATHS.pluginGuide} element={<PluginTutorialPage darkMode={darkMode} language={language} basePath={SHARED_PATHS.pluginGuide} homePath={SHARED_PATHS.guides} />}>
        <Route index element={<MarkdownRenderer file="plugin-tutorial/index" language={language} />} />
        <Route path=":slug" element={<PluginTutorialContent language={language} />} />
      </Route>
      <Route path="classic/*" element={<LegacyRedirect />} />
      <Route path="guide/*" element={<LegacyRedirect />} />
      <Route path="operit-submission-edit" element={<OperitSubmissionEditPage language={language} />} />
      <Route path="operit-login" element={<OperitLoginPage language={language} />} />
      <Route path="operit-reviewer-apply" element={<OperitReviewerApplyPage language={language} />} />
      <Route path="operit-submission-admin" element={<OperitSubmissionAdminPage language={language} />} />
      <Route path="operit-owner-admin" element={<OperitOwnerAdminPage language={language} />} />
      <Route path="operit-market-review" element={<OperitMarketReviewPage language={language} />} />
      <Route path="operit-submission-center/*" element={<OperitSubmissionCenterPage language={language} />} />
      <Route path="project-update" element={<ProjectUpdatePage darkMode={darkMode} language={language} />} />
      <Route path={SHARED_PATHS.market} element={<OperitMCPMarketPage language={language} />} />
      <Route path="*" element={<NotFoundPage language={language} />} />
    </Route>
  </Routes>;
}
