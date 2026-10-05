import { PRODUCTS, SHARED_PATHS } from '../config/products.ts';

const replacePrefix = (pathname: string, from: string, to: string): string | undefined => {
  if (pathname === from || pathname.startsWith(`${from}/`)) {
    return `${to}${pathname.slice(from.length)}`;
  }
  return undefined;
};

// Keep old bookmarks, client announcement links and Markdown deep links working.
// "new" was a rewrite of generation-one docs, not generation-two documentation.
export function resolveLegacyPath(pathname: string): string | undefined {
  const mappings = [
    ['/classic', PRODUCTS.v1.homePath],
    ['/guide/new', PRODUCTS.v1.guidePath],
    ['/guide/old', `${PRODUCTS.v1.guidePath}/reference`],
    ['/guide/plugin', SHARED_PATHS.pluginGuide],
    ['/v1/market', SHARED_PATHS.market],
    ['/v2/market', SHARED_PATHS.market],
  ];
  for (const [from, to] of mappings) {
    const result = replacePrefix(pathname, from, to);
    if (result !== undefined) return result;
  }
  // Before the docs hub existed, articles were linked directly under /guide.
  if (pathname.startsWith('/guide/')) {
    return `${PRODUCTS.v1.guidePath}/reference/${pathname.slice('/guide/'.length)}`;
  }
  return undefined;
}

export function canonicalizeSiteHref(href: string): string {
  // Only rewrite same-site hash routes; never touch external URLs or anchors.
  const match = /^(\/?#)(\/[^?#]*)(.*)$/.exec(href);
  if (!match) return href;
  const pathname = resolveLegacyPath(match[2]) ?? match[2];
  return `${match[1]}${pathname}${match[3]}`;
}
