import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type Language = 'zh' | 'en';

interface SiteMetadataProps {
  language: Language;
}

interface MetaContent {
  title: string;
  description: string;
  locale: string;
}

const SITE_NAME = 'Operit AI';
const SITE_URL = 'https://operit.aaswordsman.org/';
const SITE_IMAGE = `${SITE_URL}logo.png`;

const META_TAGS: Array<{ selector: string; attribute: 'name' | 'property'; key: string }> = [
  { selector: 'meta[name="description"]', attribute: 'name', key: 'description' },
  { selector: 'meta[property="og:title"]', attribute: 'property', key: 'og:title' },
  { selector: 'meta[property="og:description"]', attribute: 'property', key: 'og:description' },
  { selector: 'meta[property="og:url"]', attribute: 'property', key: 'og:url' },
  { selector: 'meta[property="og:image"]', attribute: 'property', key: 'og:image' },
  { selector: 'meta[property="og:image:alt"]', attribute: 'property', key: 'og:image:alt' },
  { selector: 'meta[property="og:locale"]', attribute: 'property', key: 'og:locale' },
  { selector: 'meta[name="twitter:title"]', attribute: 'name', key: 'twitter:title' },
  { selector: 'meta[name="twitter:description"]', attribute: 'name', key: 'twitter:description' },
  { selector: 'meta[name="twitter:image"]', attribute: 'name', key: 'twitter:image' },
];

function ensureMeta(selector: string, attribute: 'name' | 'property', key: string): HTMLMetaElement {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) {
    return existing;
  }

  const meta = document.createElement('meta');
  meta.setAttribute(attribute, key);
  document.head.appendChild(meta);
  return meta;
}

function ensureLink(rel: string): HTMLLinkElement {
  const selector = `link[rel="${rel}"]`;
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  if (existing) {
    return existing;
  }

  const link = document.createElement('link');
  link.setAttribute('rel', rel);
  document.head.appendChild(link);
  return link;
}

function getRouteMetadata(pathname: string, language: Language): MetaContent {
  if (pathname.startsWith('/guide')) {
    return language === 'zh'
      ? {
          title: 'Operit AI 文档 | Android AI 助手使用手册',
          description:
            '查看 Operit AI 的中文使用文档，涵盖 API 配置、工具与工作流、自动化、本地模型、语音交互与移动端开发能力。',
          locale: 'zh_CN',
        }
      : {
          title: 'Operit AI Docs | Android AI Assistant Guides',
          description:
            'Explore Operit AI documentation covering setup, tools, workflows, automation, local models, voice features, and mobile development.',
          locale: 'en_US',
        };
  }

  if (pathname.startsWith('/market')) {
    return language === 'zh'
      ? {
          title: 'Operit AI 市场 | MCP 与 Skill 插件生态',
          description:
            '浏览 Operit AI 的 MCP 与 Skill 市场，扩展工具能力、工作流编排与移动端自动化场景。',
          locale: 'zh_CN',
        }
      : {
          title: 'Operit AI Market | MCP and Skill Ecosystem',
          description:
            'Discover MCP and Skill extensions for Operit AI, including tooling, workflow automation, and mobile productivity integrations.',
          locale: 'en_US',
        };
  }

  return language === 'zh'
    ? {
        title: 'Operit AI | Android AI 助手与自动化平台',
        description:
          'Operit AI 是面向 Android 的全功能 AI 助手与自动化平台，支持 Ubuntu 24 终端、本地模型、40+ 工具、MCP/Skill 插件、语音交互、文件管理与工作流自动化。',
        locale: 'zh_CN',
      }
    : {
        title: 'Operit AI | Android AI Assistant and Automation Platform',
        description:
          'Operit AI is a full-featured Android AI assistant with Ubuntu 24 terminal access, local models, 40+ built-in tools, MCP/Skill extensions, voice interaction, file management, and workflow automation.',
        locale: 'en_US',
      };
}

export default function SiteMetadata({ language }: SiteMetadataProps) {
  const location = useLocation();

  useEffect(() => {
    const { title, description, locale } = getRouteMetadata(location.pathname, language);
    const currentUrl = window.location.href;

    document.title = title;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';

    const metaValues = new Map<string, string>([
      ['description', description],
      ['og:title', title],
      ['og:description', description],
      ['og:url', currentUrl],
      ['og:image', SITE_IMAGE],
      ['og:image:alt', `${SITE_NAME} Logo`],
      ['og:locale', locale],
      ['twitter:title', title],
      ['twitter:description', description],
      ['twitter:image', SITE_IMAGE],
    ]);

    META_TAGS.forEach(({ selector, attribute, key }) => {
      const meta = ensureMeta(selector, attribute, key);
      meta.setAttribute('content', metaValues.get(key) ?? '');
    });

    ensureLink('canonical').setAttribute('href', pathnameToCanonical(location.pathname));
    ensureLink('icon').setAttribute('href', '/logo.png');
    ensureLink('apple-touch-icon').setAttribute('href', '/logo.png');
  }, [language, location.pathname]);

  return null;
}

function pathnameToCanonical(pathname: string): string {
  if (pathname === '/') {
    return SITE_URL;
  }

  return `${SITE_URL}#${pathname}`;
}
