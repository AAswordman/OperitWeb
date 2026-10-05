import { getProductFromPath, SHARED_PATHS } from './products.ts';
import type { Language } from './products.ts';

export interface RouteMetadata { title: string; description: string; locale: string; }

export function getRouteMetadata(pathname: string, language: Language): RouteMetadata {
  const zh = language === 'zh';
  const locale = zh ? 'zh_CN' : 'en_US';
  const product = getProductFromPath(pathname);
  if (product) {
    const isGuide = pathname === product.guidePath || pathname.startsWith(`${product.guidePath}/`);
    const isDownload = pathname === product.downloadPath;
    const section = isGuide ? (zh ? '使用教程' : 'Guides') : isDownload ? (zh ? '下载' : 'Downloads') : (zh ? '官方网站' : 'Official Website');
    return {
      title: `${product.name} ${section} | Operit`,
      description: isGuide
        ? (zh ? `${product.name} 专属教程与版本说明。请使用与你的产品代际对应的文档；插件开发文档与插件市场由两代共享。` : `Guides and version notes for ${product.name}. Use documentation for your generation; plugin developer docs and the marketplace are shared.`)
        : isDownload
          ? (product.id === 'v2' ? (zh ? 'Operit 2 全平台下载与测试入口：iOS 和 macOS 已开放 TestFlight 公测，其他平台内测逐步开放。' : 'Cross-platform Operit 2 downloads and testing: iOS and macOS public betas on TestFlight, with private access to other platforms opening gradually.') : (zh ? `${product.name} 独立下载入口与发布信息，不与其他代际的安装包混用。` : `Dedicated ${product.name} downloads and release information, separate from other generations.`))
          : product.description[language],
      locale,
    };
  }
  if (pathname === SHARED_PATHS.guides) {
    return { title: zh ? 'Operit 使用教程 | 选择一代或二代文档' : 'Operit Guides | Choose Generation One or Two', description: zh ? '选择 Operit 1 或 Operit 2 的独立使用教程，或浏览共享的插件开发文档。' : 'Choose separate Operit 1 or Operit 2 guides, or browse shared plugin developer documentation.', locale };
  }
  if (pathname === SHARED_PATHS.downloads) {
    return { title: zh ? '下载 Operit | 选择一代或二代' : 'Download Operit | Choose Your Generation', description: zh ? '分别访问 Operit 1 与 Operit 2 的下载入口，了解各代际的发布状态。' : 'Separate download entries and release status for Operit 1 and Operit 2.', locale };
  }
  if (pathname === SHARED_PATHS.pluginGuide || pathname.startsWith(`${SHARED_PATHS.pluginGuide}/`)) {
    return { title: zh ? 'Operit 插件开发文档 | 两代共享' : 'Operit Plugin Developer Docs | Shared Ecosystem', description: zh ? 'Operit 1 与 Operit 2 共享的插件开发资料，涵盖 JavaScript、TypeScript、插件结构、调试与宿主类型。' : 'Shared Operit plugin developer resources covering JavaScript, TypeScript, package structure, debugging and host types.', locale };
  }
  if (pathname === SHARED_PATHS.market) {
    return { title: zh ? 'Operit 插件市场 | 一代与二代共享生态' : 'Operit Plugin Market | One Shared Ecosystem', description: zh ? 'Operit 1 与 Operit 2 共用的插件市场。浏览 MCP、Skill 和脚本扩展，安装前查看应用版本要求。' : 'One plugin marketplace for Operit 1 and Operit 2. Browse MCP, Skill and script extensions, and check app-version requirements.', locale };
  }
  if (pathname === '/project-update') {
    return { title: zh ? 'Operit AI 项目近况与赞助说明' : 'Operit AI Project Update and Sponsorship Note', description: zh ? '查看 Operit AI 关于官网赞助、项目维护节奏、社区建设与后续规划的完整说明。' : 'Read the Operit AI statement about sponsorship, project maintenance, community building and future plans.', locale };
  }
  return { title: zh ? 'Operit 官方网站 | 一代与二代，共享插件生态' : 'Operit Official Website | Two Generations, One Ecosystem', description: zh ? '了解 Operit 1 与全平台 Operit 2。iOS、macOS 公测已开放，其他平台内测逐步开放，两代共用插件市场。' : 'Explore Operit 1 and cross-platform Operit 2. iOS and macOS public betas are live; private access to other platforms opens gradually. One shared plugin marketplace.', locale };
}
