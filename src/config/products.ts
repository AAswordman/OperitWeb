export type Language = 'zh' | 'en';
export type ProductGeneration = 'v1' | 'v2';
export type LocalizedText = Record<Language, string>;

export interface GitHubReleaseSource {
  kind: 'github-release';
  repository: string;
}

export interface PublicBetaPlatform {
  id: 'ios' | 'macos';
  name: string;
  url: string;
}

// Destination for the other-platform beta download entry.
export const OPERIT_V2_BETA_GROUP_NUMBER = '1121622579';
export const OPERIT_V2_BETA_GROUP_URL = `mqqapi://card/show_pslcard?src_type=internal&version=1&uin=${OPERIT_V2_BETA_GROUP_NUMBER}&card_type=group&source=qrcode`;

export const OPERIT_V2_TESTFLIGHT_URL = 'https://testflight.apple.com/join/hzq2xRrH';
export const OPERIT_V2_PUBLIC_BETAS: PublicBetaPlatform[] = [
  { id: 'ios', name: 'iOS', url: OPERIT_V2_TESTFLIGHT_URL },
  { id: 'macos', name: 'macOS', url: OPERIT_V2_TESTFLIGHT_URL },
];


export interface DownloadPlatform {
  id: 'android' | 'ios' | 'windows' | 'macos' | 'linux';
  name: string;
  url: string;
  channel: 'testflight' | 'qq';
}

// Download-page entries only; the overview's Apple beta links stay unchanged.
export const OPERIT_V2_DOWNLOAD_PLATFORMS: DownloadPlatform[] = [
  { id: 'android', name: 'Android', url: OPERIT_V2_BETA_GROUP_URL, channel: 'qq' },
  { ...OPERIT_V2_PUBLIC_BETAS[0], channel: 'testflight' },
  { id: 'windows', name: 'Windows', url: OPERIT_V2_BETA_GROUP_URL, channel: 'qq' },
  { ...OPERIT_V2_PUBLIC_BETAS[1], channel: 'testflight' },
  { id: 'linux', name: 'Linux', url: OPERIT_V2_BETA_GROUP_URL, channel: 'qq' },
];

export interface ProductDefinition {
  id: ProductGeneration;
  name: string;
  number: number;
  homePath: string;
  downloadPath: string;
  guidePath: string;
  markdownRoot: string;
  status: LocalizedText;
  description: LocalizedText;
  download: GitHubReleaseSource | { kind: 'external'; urlEnvironmentKey: string; publicBetas: PublicBetaPlatform[] };
}

// Product generations are independent of the shared Market v2 API/schema version.
export const PRODUCTS: Record<ProductGeneration, ProductDefinition> = {
  v1: {
    id: 'v1', name: 'Operit 1', number: 1,
    homePath: '/v1', downloadPath: '/v1/download', guidePath: '/v1/guide',
    markdownRoot: 'newcontent',
    status: { zh: '当前可用', en: 'Available now' },
    description: { zh: '熟悉的 Android AI 助手，独立的一代下载与使用教程。', en: 'The familiar Android AI assistant, with its own downloads and guides.' },
    download: { kind: 'github-release', repository: 'AAswordman/Operit' },
  },
  v2: {
    id: 'v2', name: 'Operit 2', number: 2,
    homePath: '/v2', downloadPath: '/v2/download', guidePath: '/v2/guide',
    markdownRoot: 'v2content',
    status: { zh: '公测中', en: 'Public beta' },
    description: { zh: '全平台的下一代 Operit。iOS 与 macOS 公测已开放，其他平台内测将逐步开放；插件市场与一代共享。', en: 'The next-generation, cross-platform Operit. Public beta is available on iOS and macOS; private testing on other platforms will open gradually. One shared plugin market.' },
    download: { kind: 'external', urlEnvironmentKey: 'VITE_OPERIT_V2_DOWNLOAD_URL', publicBetas: OPERIT_V2_PUBLIC_BETAS },
  },
};

export const PRODUCT_ORDER: ProductGeneration[] = ['v2', 'v1'];
export const SHARED_PATHS = {
  home: '/', downloads: '/download', guides: '/guide',
  market: '/market', pluginGuide: '/developers/plugins', account: '/operit-submission-center',
} as const;

export function getProductFromPath(pathname: string): ProductDefinition | undefined {
  return Object.values(PRODUCTS).find(product => (
    pathname === product.homePath || pathname.startsWith(`${product.homePath}/`)
  ));
}

export function getExternalDownloadUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
