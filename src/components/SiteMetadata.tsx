import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteMetadata } from '../config/routeMetadata';
import { resolveLegacyPath } from '../routing/paths';

type Language = 'zh' | 'en';

interface SiteMetadataProps {
  language: Language;
}

const SITE_NAME = 'Operit AI';
const SITE_URL = 'https://operit.app/';
const SITE_IMAGE = `${SITE_URL}logo.png?v=2`;

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

export default function SiteMetadata({ language }: SiteMetadataProps) {
  const location = useLocation();

  useEffect(() => {
    const { title, description, locale } = getRouteMetadata(resolveLegacyPath(location.pathname) ?? location.pathname, language);
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

    ensureLink('canonical').setAttribute('href', pathnameToCanonical(resolveLegacyPath(location.pathname) ?? location.pathname));
    const icon = ensureLink('icon');
    icon.setAttribute('href', '/logo.svg');
    icon.setAttribute('type', 'image/svg+xml');
    icon.setAttribute('sizes', 'any');
    ensureLink('apple-touch-icon').setAttribute('href', '/logo.png?v=2');
  }, [language, location.pathname]);

  return null;
}

function pathnameToCanonical(pathname: string): string {
  if (pathname === '/') {
    return SITE_URL;
  }

  return `${SITE_URL}#${pathname}`;
}

