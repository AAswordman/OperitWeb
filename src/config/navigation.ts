import { getProductFromPath, SHARED_PATHS } from './products.ts';
import type { ProductDefinition } from './products.ts';

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

// A version is context, not another navigation tier. Shared destinations never
// acquire a generation prefix, and switching versions preserves the section.
export function getNavigationContext(pathname: string) {
  const product = getProductFromPath(pathname);
  const developerDocs = within(pathname, SHARED_PATHS.pluginGuide);
  const guides = within(pathname, product?.guidePath ?? SHARED_PATHS.guides);
  const downloads = within(pathname, product?.downloadPath ?? SHARED_PATHS.downloads);
  return {
    product, developerDocs, guides, downloads,
    documentation: developerDocs || Boolean(product && guides),
    guidePath: product?.guidePath ?? SHARED_PATHS.guides,
    downloadPath: product?.downloadPath ?? SHARED_PATHS.downloads,
    market: within(pathname, SHARED_PATHS.market),
  };
}

export function getProductSwitchPath(pathname: string, target: ProductDefinition) {
  const context = getNavigationContext(pathname);
  if (context.product?.id === target.id) return pathname;
  if (context.guides) return target.guidePath;
  if (context.downloads) return target.downloadPath;
  return target.homePath;
}
