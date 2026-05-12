import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Row,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  GithubOutlined,
  LeftOutlined,
  LikeOutlined,
  LinkOutlined,
  MessageOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import OperitMarkdownPreview from '../components/OperitMarkdownPreview';
import './OperitMCPMarketPage.css';

const { Title, Paragraph, Text, Link } = Typography;

interface OperitMCPMarketPageProps {
  language: 'zh' | 'en';
}

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string | null;
}

interface GitHubUser {
  login: string;
  html_url?: string;
  avatar_url?: string;
}

interface GitHubReactions {
  total_count?: number;
  '+1'?: number;
  heart?: number;
  [key: string]: number | undefined;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state?: string;
  created_at: string;
  updated_at: string;
  comments?: number;
  labels: GitHubLabel[];
  user: GitHubUser;
  reactions?: GitHubReactions | null;
  pull_request?: {
    html_url: string;
  };
}

interface MarketLabel {
  name: string;
  color?: string;
}

interface MarketSection {
  heading: string;
  content: string;
}

interface ParsedMarketIssue {
  id: number;
  number: number;
  title: string;
  issueUrl: string;
  repositoryUrl: string | null;
  homepageUrl: string | null;
  description: string;
  labels: MarketLabel[];
  author: string;
  authorUrl: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  sections: MarketSection[];
}

interface ArtifactProjectRankDefaultNode {
  nodeId: string;
  runtimePackageId: string;
  sha256: string;
  version: string;
  downloadUrl: string;
  state: string;
  publishedAt: string | null;
}

interface ArtifactProjectRankEntry {
  projectId: string;
  type: string;
  projectDisplayName: string;
  projectDescription: string;
  rootPublisherLogin: string;
  rootPublisherAvatarUrl: string;
  contributorCount: number;
  downloads: number;
  likes: number;
  latestNodeId: string;
  latestOpenNodeId: string;
  defaultNodeId: string;
  latestPublishedAt: string | null;
  defaultNode: ArtifactProjectRankDefaultNode | null;
  runtimePackageNodeSha256s: string[];
}

interface MarketRankIssueEntry {
  id: string;
  downloads: number;
  lastDownloadAt: string | null;
  updatedAt: string | null;
  statsUpdatedAt: string | null;
  displayTitle: string;
  summaryDescription: string;
  authorLogin: string;
  authorAvatarUrl: string;
  metadata?: unknown;
  issue: GitHubIssue;
}

interface MarketRankPageResponse {
  updatedAt?: string | null;
  type: string;
  metric: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  items: MarketRankIssueEntry[];
}

interface ArtifactProjectRankPageResponse {
  updatedAt?: string | null;
  type: string;
  metric: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  items: ArtifactProjectRankEntry[];
}

interface ArtifactProjectEdge {
  parentNodeId: string;
  childNodeId: string;
}

interface ArtifactProjectNode {
  projectId: string;
  type: string;
  projectDisplayName: string;
  projectDescription: string;
  runtimePackageId: string;
  nodeId: string;
  rootNodeId: string;
  parentNodeIds: string[];
  publisherLogin: string;
  releaseTag: string;
  assetName: string;
  downloadUrl: string;
  sha256: string;
  version: string;
  displayName: string;
  description: string;
  sourceFileName: string;
  minSupportedAppVersion: string | null;
  maxSupportedAppVersion: string | null;
  publishedAt: string | null;
  state: string;
  issue: GitHubIssue;
}

interface ArtifactProjectDetail {
  projectId: string;
  type: string;
  projectDisplayName: string;
  projectDescription: string;
  rootNodeId: string;
  rootPublisherLogin: string;
  rootPublisherAvatarUrl: string;
  contributorCount: number;
  downloads: number;
  likes: number;
  latestNodeId: string;
  latestOpenNodeId: string;
  defaultNodeId: string;
  latestPublishedAt: string | null;
  nodes: ArtifactProjectNode[];
  edges: ArtifactProjectEdge[];
}

interface UiText {
  title: string;
  artifactTab: string;
  mcpTab: string;
  skillTab: string;
  reload: string;
  loading: string;
  loadingArtifactDetail: string;
  loadError: string;
  noData: string;
  updatedAt: string;
  issueButton: string;
  repoButton: string;
  homepageButton: string;
  comments: string;
  author: string;
  notProvided: string;
  detailButton: string;
  detailSummaryTitle: string;
  detailSectionsTitle: string;
  issueNumber: string;
  createdAt: string;
  repository: string;
  homepage: string;
  sectionUntitled: string;
  prevPage: string;
  nextPage: string;
  pageIndicator: string;
  totalPageIndicator: string;
  unknownTotalPageIndicator: string;
  artifactProjectId: string;
  artifactType: string;
  downloads: string;
  likes: string;
  contributors: string;
  nodeCount: string;
  runtimePackageId: string;
  latestVersion: string;
  nodesTitle: string;
  nodeId: string;
  version: string;
  publisher: string;
  releaseTag: string;
  assetName: string;
  publishTime: string;
  state: string;
  downloadButton: string;
  rootIssue: string;
}

type MarketType = 'artifact' | 'mcp' | 'skill';
type ArtifactSourceType = 'script' | 'package';
type IssueSourceType = 'mcp' | 'skill';

interface IssueMarketConfig {
  kind: 'issue';
  statsType: IssueSourceType;
  searchPlaceholderZh: string;
  searchPlaceholderEn: string;
}

interface ArtifactMarketConfig {
  kind: 'artifact';
  searchPlaceholderZh: string;
  searchPlaceholderEn: string;
}

type MarketConfig = IssueMarketConfig | ArtifactMarketConfig;

const ISSUE_PAGE_SIZE = 20;
const ARTIFACT_PAGE_SIZE = 20;
const MARKET_RANK_METRIC = 'updated';
const MARKET_STATIC_BASE_URL = 'https://static.operit.app/market-stats';
const MARKET_STATIC_QUERY = 'client=operit-web&v=20260512-cors2';
const ARTIFACT_SOURCE_TYPES: ArtifactSourceType[] = ['script', 'package'];

const buildIssueRankUrl = (type: IssueSourceType, page: number): string =>
  `${MARKET_STATIC_BASE_URL}/rank/${type}-${MARKET_RANK_METRIC}-page-${page}.json?${MARKET_STATIC_QUERY}`;

const buildArtifactRankUrl = (type: ArtifactSourceType, page: number): string =>
  `${MARKET_STATIC_BASE_URL}/artifact-rank/${type}-${MARKET_RANK_METRIC}-page-${page}.json?${MARKET_STATIC_QUERY}`;

const buildArtifactProjectUrl = (projectId: string): string =>
  `${MARKET_STATIC_BASE_URL}/artifact-projects/${encodeURIComponent(projectId)}.json?${MARKET_STATIC_QUERY}`;

const MARKET_CONFIG: Record<MarketType, MarketConfig> = {
  artifact: {
    kind: 'artifact',
    searchPlaceholderZh: '搜索名称或作者',
    searchPlaceholderEn: 'Search name or author',
  },
  mcp: {
    kind: 'issue',
    statsType: 'mcp',
    searchPlaceholderZh: '搜索标题、简介、标签或仓库',
    searchPlaceholderEn: 'Search title, summary, labels, or repo',
  },
  skill: {
    kind: 'issue',
    statsType: 'skill',
    searchPlaceholderZh: '搜索标题、简介、标签或仓库',
    searchPlaceholderEn: 'Search title, summary, labels, or repo',
  },
};

const normalizeKey = (value: string): string =>
  value.toLowerCase().replace(/[`*_~:[\]【】()（）\s-]/g, '');

const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const parseSections = (body: string): Array<{ heading: string; content: string }> => {
  const sections: Array<{ heading: string; content: string }> = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n').trim(),
        });
      }
      currentHeading = headingMatch[1];
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentHeading || currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections;
};

const getFirstValidUrl = (value: string, matcher?: RegExp): string | null => {
  const urlRegex = matcher ?? /https?:\/\/[^\s)>\]}]+/gi;
  const matches = value.match(urlRegex) ?? [];
  for (const matchedUrl of matches) {
    const sanitized = matchedUrl.trim();
    if (!sanitized.includes('{') && !sanitized.includes('}')) {
      return sanitized;
    }
  }
  return null;
};

const parseTags = (value: string): string[] => {
  const normalized = stripMarkdown(value).replace(/[;|]/g, ',');
  return normalized
    .split(/[,\n，]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 10);
};

const getTextByAliases = (
  sectionMap: Map<string, string>,
  aliases: string[],
): string | null => {
  const normalizedAliases = aliases.map(alias => normalizeKey(alias));
  for (const alias of normalizedAliases) {
    for (const [key, value] of sectionMap.entries()) {
      if (!value) {
        continue;
      }
      if (key.includes(alias) || alias.includes(key)) {
        return value.trim();
      }
    }
  }
  return null;
};

const dedupeLabels = (labels: MarketLabel[]): MarketLabel[] => {
  const seen = new Set<string>();
  const result: MarketLabel[] = [];
  for (const label of labels) {
    const normalized = label.name.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(label);
  }
  return result;
};

const parseIssue = (issue: GitHubIssue): ParsedMarketIssue => {
  const body = issue.body ?? '';
  const sections = parseSections(body)
    .map(section => ({
      heading: section.heading.trim(),
      content: section.content.trim(),
    }))
    .filter(section => section.heading || section.content);

  const sectionMap = new Map<string, string>();
  for (const section of sections) {
    const normalizedHeading = normalizeKey(section.heading);
    if (!normalizedHeading) {
      continue;
    }
    const cleanedContent = stripMarkdown(section.content);
    if (cleanedContent) {
      sectionMap.set(normalizedHeading, cleanedContent);
    }
  }

  const repositoryFromSection = getTextByAliases(sectionMap, [
    'github仓库地址',
    '仓库地址',
    '仓库链接',
    '仓库',
    'repository',
    'repo',
    'github',
  ]);
  const repositoryUrl =
    getFirstValidUrl(repositoryFromSection ?? '', /https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi) ??
    getFirstValidUrl(body, /https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi);

  const homepageFromSection = getTextByAliases(sectionMap, ['主页', 'homepage', 'website', '文档', 'docs']);
  const homepageUrl = getFirstValidUrl(homepageFromSection ?? '');

  const descriptionFromSection = getTextByAliases(sectionMap, [
    '简介',
    '描述',
    'description',
    'summary',
    '功能',
    '用途',
    '介绍',
  ]);
  const allSectionContent = Array.from(sectionMap.values());
  const fallbackDescription =
    allSectionContent.find(content => content.length >= 24 && !content.includes('确认')) ??
    stripMarkdown(body).split('\n').find(line => line.trim().length >= 24) ??
    '';
  const description = (descriptionFromSection ?? fallbackDescription).trim();

  const tagsFromSection = getTextByAliases(sectionMap, ['标签', 'tag', 'tags', '分类', 'category']);
  const issueLabels: MarketLabel[] = issue.labels
    .map(label => ({
      name: label.name.trim(),
      color: label.color ? `#${label.color}` : undefined,
    }))
    .filter(label => Boolean(label.name));

  const parsedTags: MarketLabel[] = tagsFromSection
    ? parseTags(tagsFromSection).map(name => ({ name }))
    : [];
  const labels = dedupeLabels([...issueLabels, ...parsedTags]).slice(0, 12);

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title.trim(),
    issueUrl: issue.html_url,
    repositoryUrl,
    homepageUrl,
    description,
    labels,
    author: issue.user.login,
    authorUrl: issue.user.html_url ?? issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    comments: issue.comments ?? 0,
    sections,
  };
};

const extractRepoName = (repoUrl: string): string => {
  const parts = repoUrl.replace(/https?:\/\/github\.com\//i, '').split('/');
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return repoUrl;
};

const parseMarketTypeFromQuery = (value: string | null): MarketType => {
  if (value === 'mcp' || value === 'skill' || value === 'artifact') {
    return value;
  }
  return 'artifact';
};

const parsePageFromQuery = (value: string | null): number => {
  if (!value) {
    return 1;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
};

const artifactTypeLabel = (type: string, language: 'zh' | 'en'): string => {
  if (type === 'script') {
    return language === 'zh' ? '脚本' : 'Script';
  }
  if (type === 'package') {
    return language === 'zh' ? '工具包' : 'Package';
  }
  return type || (language === 'zh' ? '未分类' : 'Unknown');
};

const sortArtifactEntries = (entries: ArtifactProjectRankEntry[]): ArtifactProjectRankEntry[] =>
  [...entries].sort(
    (left, right) =>
      (right.latestPublishedAt ?? '').localeCompare(left.latestPublishedAt ?? '') ||
      left.projectDisplayName.localeCompare(right.projectDisplayName, undefined, { sensitivity: 'base' }),
  );

const uniqueArtifactEntries = (entries: ArtifactProjectRankEntry[]): ArtifactProjectRankEntry[] => {
  const seen = new Set<string>();
  return entries.filter(entry => {
    if (!entry.projectId || seen.has(entry.projectId)) {
      return false;
    }
    seen.add(entry.projectId);
    return true;
  });
};

const fetchIssueRankPage = async (
  type: IssueSourceType,
  page: number,
): Promise<MarketRankPageResponse> => {
  const response = await fetch(buildIssueRankUrl(type, page), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return {
      type,
      metric: MARKET_RANK_METRIC,
      page,
      pageSize: ISSUE_PAGE_SIZE,
      totalPages: 0,
      totalItems: 0,
      items: [],
    };
  }

  if (!response.ok) {
    throw new Error(`Market rank API error: ${response.status}`);
  }

  return (await response.json()) as MarketRankPageResponse;
};

const fetchArtifactRankPage = async (
  type: ArtifactSourceType,
  page: number,
): Promise<ArtifactProjectRankPageResponse> => {
  const response = await fetch(buildArtifactRankUrl(type, page), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return {
      type,
      metric: MARKET_RANK_METRIC,
      page,
      pageSize: ARTIFACT_PAGE_SIZE,
      totalPages: 0,
      totalItems: 0,
      items: [],
    };
  }

  if (!response.ok) {
    throw new Error(`Artifact rank API error: ${response.status}`);
  }

  return (await response.json()) as ArtifactProjectRankPageResponse;
};

const fetchArtifactProjectDetail = async (projectId: string): Promise<ArtifactProjectDetail> => {
  const response = await fetch(buildArtifactProjectUrl(projectId), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Artifact project API error: ${response.status}`);
  }

  return (await response.json()) as ArtifactProjectDetail;
};

const loadArtifactPagesForType = async (
  type: ArtifactSourceType,
  targetCount: number,
): Promise<{ items: ArtifactProjectRankEntry[]; totalItems: number }> => {
  const firstPage = await fetchArtifactRankPage(type, 1);
  const sourcePageSize = Math.max(1, firstPage.pageSize || ARTIFACT_PAGE_SIZE);
  const totalPages = Math.max(0, firstPage.totalPages || 0);

  if (totalPages <= 1 || firstPage.items.length === 0) {
    return {
      items: firstPage.items,
      totalItems: firstPage.totalItems,
    };
  }

  const pagesNeeded = Math.min(totalPages, Math.max(1, Math.ceil(targetCount / sourcePageSize)));
  if (pagesNeeded === 1) {
    return {
      items: firstPage.items,
      totalItems: firstPage.totalItems,
    };
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pagesNeeded - 1 }, (_, index) => fetchArtifactRankPage(type, index + 2)),
  );

  return {
    items: [...firstPage.items, ...remainingPages.flatMap(page => page.items)],
    totalItems: firstPage.totalItems,
  };
};

const resolveArtifactDefaultNode = (
  project: ArtifactProjectDetail | null,
  item: ArtifactProjectRankEntry | null,
): ArtifactProjectNode | null => {
  const nodes = project?.nodes ?? [];
  if (nodes.length === 0) {
    return null;
  }

  return (
    nodes.find(node => node.nodeId === project?.defaultNodeId) ??
    nodes.find(node => node.nodeId === item?.defaultNodeId) ??
    nodes.find(node => node.nodeId === project?.latestOpenNodeId) ??
    nodes.find(node => node.nodeId === item?.latestOpenNodeId) ??
    nodes.find(node => node.nodeId === project?.latestNodeId) ??
    nodes.find(node => node.nodeId === item?.latestNodeId) ??
    nodes[0]
  );
};

const OperitMCPMarketPage: React.FC<OperitMCPMarketPageProps> = ({ language }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const marketType = parseMarketTypeFromQuery(searchParams.get('market'));
  const page = parsePageFromQuery(searchParams.get('page'));
  const currentMarketConfig = MARKET_CONFIG[marketType];
  const currentIssueMarketConfig = currentMarketConfig.kind === 'issue' ? currentMarketConfig : null;

  const uiText: UiText =
    language === 'zh'
      ? {
          title: 'Operit 插件市场',
          artifactTab: '沙盒包',
          mcpTab: 'MCP 市场',
          skillTab: 'Skill 市场',
          reload: '刷新',
          loading: '正在加载市场数据...',
          loadingArtifactDetail: '正在加载项目详情...',
          loadError: '加载失败，请检查网络或数据源可用性。',
          noData: '当前没有可展示的条目。',
          updatedAt: '更新时间',
          issueButton: 'Issue',
          repoButton: '仓库',
          homepageButton: '主页',
          comments: '评论',
          author: '作者',
          notProvided: '未提供',
          detailButton: '查看详情',
          detailSummaryTitle: '项目简介',
          detailSectionsTitle: 'Issue 详情分段',
          issueNumber: 'Issue 编号',
          createdAt: '创建时间',
          repository: '仓库地址',
          homepage: '主页地址',
          sectionUntitled: '未命名分段',
          prevPage: '上一页',
          nextPage: '下一页',
          pageIndicator: '当前第 {page} 页',
          totalPageIndicator: '共 {total} 页',
          unknownTotalPageIndicator: '总页数未知',
          artifactProjectId: '项目 ID',
          artifactType: '类型',
          downloads: '下载',
          likes: '点赞',
          contributors: '贡献者',
          nodeCount: '节点数',
          runtimePackageId: '运行包 ID',
          latestVersion: '默认版本',
          nodesTitle: '项目节点',
          nodeId: '节点 ID',
          version: '版本',
          publisher: '发布者',
          releaseTag: '发布标签',
          assetName: '资产文件',
          publishTime: '发布时间',
          state: '状态',
          downloadButton: '下载',
          rootIssue: '默认节点 Issue',
        }
      : {
          title: 'Operit Plugin Market',
          artifactTab: 'Sandbox Packages',
          mcpTab: 'MCP Market',
          skillTab: 'Skill Market',
          reload: 'Refresh',
          loading: 'Loading market data...',
          loadingArtifactDetail: 'Loading project detail...',
          loadError: 'Failed to load data. Please check network access or source availability.',
          noData: 'No entries available.',
          updatedAt: 'Updated At',
          issueButton: 'Issue',
          repoButton: 'Repo',
          homepageButton: 'Homepage',
          comments: 'Comments',
          author: 'Author',
          notProvided: 'Not provided',
          detailButton: 'Details',
          detailSummaryTitle: 'Summary',
          detailSectionsTitle: 'Issue Sections',
          issueNumber: 'Issue Number',
          createdAt: 'Created At',
          repository: 'Repository',
          homepage: 'Homepage',
          sectionUntitled: 'Untitled Section',
          prevPage: 'Prev',
          nextPage: 'Next',
          pageIndicator: 'Current {page}',
          totalPageIndicator: 'Total {total}',
          unknownTotalPageIndicator: 'Total unknown',
          artifactProjectId: 'Project ID',
          artifactType: 'Type',
          downloads: 'Downloads',
          likes: 'Likes',
          contributors: 'Contributors',
          nodeCount: 'Nodes',
          runtimePackageId: 'Runtime Package ID',
          latestVersion: 'Default Version',
          nodesTitle: 'Project Nodes',
          nodeId: 'Node ID',
          version: 'Version',
          publisher: 'Publisher',
          releaseTag: 'Release Tag',
          assetName: 'Asset Name',
          publishTime: 'Published At',
          state: 'State',
          downloadButton: 'Download',
          rootIssue: 'Default Issue',
        };

  const [issues, setIssues] = useState<ParsedMarketIssue[]>([]);
  const [artifactProjects, setArtifactProjects] = useState<ArtifactProjectRankEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<ParsedMarketIssue | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactProjectRankEntry | null>(null);
  const [selectedArtifactDetail, setSelectedArtifactDetail] = useState<ArtifactProjectDetail | null>(null);
  const [artifactDetailLoading, setArtifactDetailLoading] = useState<boolean>(false);
  const [artifactDetailError, setArtifactDetailError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [linkHasNextPage, setLinkHasNextPage] = useState<boolean>(false);
  const issuesRequestRef = useRef(0);
  const artifactRequestRef = useRef(0);
  const artifactDetailRequestRef = useRef(0);

  const currentMarketName =
    marketType === 'artifact' ? uiText.artifactTab : marketType === 'mcp' ? uiText.mcpTab : uiText.skillTab;
  const currentSearchPlaceholder =
    language === 'zh'
      ? currentMarketConfig.searchPlaceholderZh
      : currentMarketConfig.searchPlaceholderEn;

  const marketSubtitle = useMemo(() => {
    if (marketType === 'artifact') {
      return language === 'zh'
        ? '当前展示沙盒包，聚合 Script 与 Package 的 artifact 项目排行。'
        : 'Showing sandbox packages, aggregated from script and package artifact rankings.';
    }

    if (!currentIssueMarketConfig) {
      return '';
    }

    return language === 'zh'
      ? `当前展示 ${currentMarketName}，数据来自 static.operit.app 的预生成市场排行。`
      : `Showing ${currentMarketName}, backed by precomputed ranking JSON from static.operit.app.`;
  }, [currentIssueMarketConfig, currentMarketName, language, marketType]);

  const writeQueryState = useCallback((nextMarketType: MarketType, nextPage: number) => {
    const normalizedPage = String(Math.max(1, nextPage));
    const currentMarket = searchParams.get('market');
    const currentPage = searchParams.get('page');

    if (currentMarket === nextMarketType && currentPage === normalizedPage) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('market', nextMarketType);
    nextParams.set('page', normalizedPage);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const setMarketAndResetPage = useCallback((nextMarketType: MarketType) => {
    writeQueryState(nextMarketType, 1);
  }, [writeQueryState]);

  const setPageInQuery = useCallback((nextPage: number) => {
    writeQueryState(marketType, nextPage);
  }, [marketType, writeQueryState]);

  const closeDetailDrawer = useCallback(() => {
    artifactDetailRequestRef.current += 1;
    setSelectedIssue(null);
    setSelectedArtifact(null);
    setSelectedArtifactDetail(null);
    setArtifactDetailError(null);
    setArtifactDetailLoading(false);
  }, []);

  const openIssueDetail = useCallback((issue: ParsedMarketIssue) => {
    artifactDetailRequestRef.current += 1;
    setSelectedArtifact(null);
    setSelectedArtifactDetail(null);
    setArtifactDetailError(null);
    setArtifactDetailLoading(false);
    setSelectedIssue(issue);
  }, []);

  const openArtifactDetail = useCallback((item: ArtifactProjectRankEntry) => {
    const requestId = ++artifactDetailRequestRef.current;
    setSelectedIssue(null);
    setSelectedArtifact(item);
    setSelectedArtifactDetail(null);
    setArtifactDetailError(null);
    setArtifactDetailLoading(true);

    void (async () => {
      try {
        const detail = await fetchArtifactProjectDetail(item.projectId);
        if (requestId !== artifactDetailRequestRef.current) {
          return;
        }
        setSelectedArtifactDetail(detail);
      } catch (fetchError) {
        if (requestId !== artifactDetailRequestRef.current) {
          return;
        }
        const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        setArtifactDetailError(message);
      } finally {
        if (requestId === artifactDetailRequestRef.current) {
          setArtifactDetailLoading(false);
        }
      }
    })();
  }, []);

  const loadIssues = useCallback(async () => {
    if (!currentIssueMarketConfig) {
      return;
    }

    const requestId = ++issuesRequestRef.current;
    setLoading(true);
    setError(null);

    try {
      const rankPage = await fetchIssueRankPage(currentIssueMarketConfig.statsType, page);
      if (requestId !== issuesRequestRef.current) {
        return;
      }

      const resolvedTotalPages = Math.max(1, rankPage.totalPages || 0);
      if (rankPage.totalItems > 0 && page > resolvedTotalPages) {
        setTotalPages(resolvedTotalPages);
        setLinkHasNextPage(false);
        setIssues([]);
        setPageInQuery(resolvedTotalPages);
        return;
      }

      const parsed = rankPage.items
        .map(entry => entry.issue)
        .filter(item => !item.pull_request)
        .map(parseIssue);

      setTotalPages(resolvedTotalPages);
      setLinkHasNextPage(page < resolvedTotalPages);
      setIssues(parsed);
      setSelectedIssue(prevSelected =>
        prevSelected ? parsed.find(item => item.id === prevSelected.id) ?? null : null,
      );
    } catch (fetchError) {
      if (requestId !== issuesRequestRef.current) {
        return;
      }

      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      setError(message);
    } finally {
      if (requestId === issuesRequestRef.current) {
        setLoading(false);
      }
    }
  }, [currentIssueMarketConfig, page, setPageInQuery]);

  const loadArtifacts = useCallback(async () => {
    if (currentMarketConfig.kind !== 'artifact') {
      return;
    }

    const requestId = ++artifactRequestRef.current;
    setLoading(true);
    setError(null);

    try {
      const targetCount = page * ARTIFACT_PAGE_SIZE;
      const artifactGroups = await Promise.all(
        ARTIFACT_SOURCE_TYPES.map(type => loadArtifactPagesForType(type, targetCount)),
      );

      if (requestId !== artifactRequestRef.current) {
        return;
      }

      const merged = uniqueArtifactEntries(sortArtifactEntries(artifactGroups.flatMap(group => group.items)));
      const combinedTotalItems = artifactGroups.reduce((sum, group) => sum + Math.max(0, group.totalItems), 0);
      const resolvedTotalPages = Math.max(1, Math.ceil(combinedTotalItems / ARTIFACT_PAGE_SIZE));

      if (combinedTotalItems > 0 && page > resolvedTotalPages) {
        setTotalPages(resolvedTotalPages);
        setLinkHasNextPage(false);
        setArtifactProjects([]);
        setPageInQuery(resolvedTotalPages);
        return;
      }

      const sliceStart = (page - 1) * ARTIFACT_PAGE_SIZE;
      const visibleItems = merged.slice(sliceStart, sliceStart + ARTIFACT_PAGE_SIZE);

      setArtifactProjects(visibleItems);
      setTotalPages(resolvedTotalPages);
      setLinkHasNextPage(page < resolvedTotalPages);
      setSelectedArtifact(prevSelected =>
        prevSelected ? merged.find(item => item.projectId === prevSelected.projectId) ?? prevSelected : null,
      );
    } catch (fetchError) {
      if (requestId !== artifactRequestRef.current) {
        return;
      }

      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      setError(message);
    } finally {
      if (requestId === artifactRequestRef.current) {
        setLoading(false);
      }
    }
  }, [currentMarketConfig.kind, page, setPageInQuery]);

  const handleRefresh = useCallback(() => {
    if (currentIssueMarketConfig) {
      void loadIssues();
      return;
    }
    void loadArtifacts();
  }, [currentIssueMarketConfig, loadArtifacts, loadIssues]);

  useEffect(() => {
    if (currentIssueMarketConfig) {
      void loadIssues();
      return;
    }
    void loadArtifacts();
  }, [currentIssueMarketConfig, loadArtifacts, loadIssues]);

  useEffect(() => {
    closeDetailDrawer();
    setTotalPages(null);
    setLinkHasNextPage(false);
    setSearchText('');
    setIssues([]);
    setArtifactProjects([]);
  }, [closeDetailDrawer, marketType]);

  const hasNextPage = useMemo(
    () => (totalPages !== null ? page < totalPages : linkHasNextPage),
    [linkHasNextPage, page, totalPages],
  );

  const filteredIssues = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return issues;
    }

    return issues.filter(issue => {
      const haystack = [
        issue.title,
        issue.description,
        issue.repositoryUrl ?? '',
        issue.homepageUrl ?? '',
        issue.author,
        issue.sections
          .map(section => `${section.heading} ${stripMarkdown(section.content)}`)
          .join(' '),
        issue.labels.map(label => label.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [issues, searchText]);

  const filteredArtifactProjects = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return artifactProjects;
    }

    return artifactProjects.filter(project => {
      const haystack = [
        project.projectDisplayName,
        project.projectDescription,
        project.projectId,
        project.rootPublisherLogin,
        project.type,
        project.defaultNode?.runtimePackageId ?? '',
        project.defaultNode?.version ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [artifactProjects, searchText]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [language],
  );

  const formatTime = useCallback((value: string | null | undefined): string => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return timeFormatter.format(date);
  }, [timeFormatter]);

  const detailSections = useMemo(
    () =>
      (selectedIssue?.sections ?? []).map((section, index) => ({
        key: `${selectedIssue?.id ?? 'issue'}-${index}`,
        label: section.heading || `${uiText.sectionUntitled} ${index + 1}`,
        children: section.content ? (
          <div className="market-detail-section-content">
            <OperitMarkdownPreview content={section.content} />
          </div>
        ) : (
          <Text type="secondary">-</Text>
        ),
      })),
    [selectedIssue, uiText.sectionUntitled],
  );

  const artifactNodes = useMemo(
    () =>
      [...(selectedArtifactDetail?.nodes ?? [])].sort(
        (left, right) =>
          (right.publishedAt ?? '').localeCompare(left.publishedAt ?? '') ||
          left.nodeId.localeCompare(right.nodeId),
      ),
    [selectedArtifactDetail],
  );

  const defaultArtifactNode = useMemo(
    () => resolveArtifactDefaultNode(selectedArtifactDetail, selectedArtifact),
    [selectedArtifact, selectedArtifactDetail],
  );

  const artifactNodePanels = useMemo(
    () =>
      artifactNodes.map((node, index) => ({
        key: `${node.nodeId}-${index}`,
        label: `${node.displayName || selectedArtifact?.projectDisplayName || node.nodeId}${
          node.version ? ` · v${node.version}` : ''
        }`,
        children: (
          <div className="market-detail-section-content">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={uiText.nodeId}>{node.nodeId}</Descriptions.Item>
                <Descriptions.Item label={uiText.version}>
                  {node.version || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={uiText.publisher}>
                  {node.publisherLogin || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={uiText.publishTime}>
                  {formatTime(node.publishedAt)}
                </Descriptions.Item>
                <Descriptions.Item label={uiText.runtimePackageId}>
                  {node.runtimePackageId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={uiText.releaseTag}>
                  {node.releaseTag || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={uiText.assetName}>
                  {node.assetName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={uiText.state}>
                  {node.state || '-'}
                </Descriptions.Item>
              </Descriptions>

              {node.description || node.projectDescription ? (
                <div className="market-detail-summary market-detail-section-content">
                  <OperitMarkdownPreview content={node.description || node.projectDescription} />
                </div>
              ) : (
                <Text type="secondary">{uiText.notProvided}</Text>
              )}

              <Space wrap>
                {node.issue?.html_url && (
                  <Button icon={<GithubOutlined />} href={node.issue.html_url} target="_blank">
                    {uiText.issueButton}
                  </Button>
                )}
                {node.downloadUrl && (
                  <Button icon={<DownloadOutlined />} href={node.downloadUrl} target="_blank">
                    {uiText.downloadButton}
                  </Button>
                )}
              </Space>
            </Space>
          </div>
        ),
      })),
    [artifactNodes, formatTime, selectedArtifact?.projectDisplayName, uiText],
  );

  const paginationTokens = useMemo(() => {
    const effectiveTotalPages = totalPages ?? (hasNextPage ? page + 1 : page);
    const pages = Array.from(new Set([1, effectiveTotalPages, page - 1, page, page + 1]))
      .filter(item => item >= 1 && item <= effectiveTotalPages)
      .sort((a, b) => a - b);

    const tokens: Array<{ type: 'page' | 'ellipsis'; value: number | string }> = [];
    let previousPage = 0;
    for (const currentPage of pages) {
      if (previousPage !== 0 && currentPage - previousPage > 1) {
        tokens.push({ type: 'ellipsis', value: `ellipsis-${previousPage}-${currentPage}` });
      }
      tokens.push({ type: 'page', value: currentPage });
      previousPage = currentPage;
    }

    return tokens;
  }, [page, totalPages, hasNextPage]);

  const artifactDetailIssueUrl =
    defaultArtifactNode?.issue?.html_url ?? artifactNodes.find(node => node.issue?.html_url)?.issue.html_url ?? null;
  const artifactDetailDownloadUrl =
    defaultArtifactNode?.downloadUrl || selectedArtifact?.defaultNode?.downloadUrl || null;

  return (
    <main className="market-page">
      <section className="market-hero">
        <div className="market-hero-glow" />
        <div className="market-container">
          <div className="market-hero-content">
            <Title level={2} className="market-title">
              {uiText.title} · {currentMarketName}
            </Title>
            <Paragraph className="market-subtitle">{marketSubtitle}</Paragraph>
          </div>

          <Card className="market-toolbar-card">
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col xs={24} lg={12}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Segmented
                    options={[
                      { label: uiText.artifactTab, value: 'artifact' },
                      { label: uiText.skillTab, value: 'skill' },
                      { label: uiText.mcpTab, value: 'mcp' },
                    ]}
                    value={marketType}
                    onChange={value => setMarketAndResetPage(value as MarketType)}
                  />
                </Space>
              </Col>
              <Col xs={24} lg={12}>
                <Space wrap className="market-toolbar-actions">
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={currentSearchPlaceholder}
                    value={searchText}
                    onChange={event => setSearchText(event.target.value)}
                    className="market-search"
                  />
                  <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
                    {uiText.reload}
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </div>
      </section>

      <section className="market-container market-main-section">
        {error && (
          <Alert
            type="error"
            message={uiText.loadError}
            description={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {loading && (
          <Card className="market-loading-card">
            <Space size="middle" style={{ width: '100%', justifyContent: 'center' }}>
              <Spin />
              <Text>{uiText.loading}</Text>
            </Space>
          </Card>
        )}

        {!loading && marketType === 'artifact' && filteredArtifactProjects.length === 0 && (
          <Empty description={uiText.noData} className="market-empty" />
        )}

        {!loading && marketType !== 'artifact' && filteredIssues.length === 0 && (
          <Empty description={uiText.noData} className="market-empty" />
        )}

        <Row gutter={[18, 18]}>
          {marketType === 'artifact'
            ? filteredArtifactProjects.map((project, index) => (
                <Col xs={24} md={12} xl={8} key={project.projectId}>
                  <div
                    className="market-item-wrap"
                    style={{ animationDelay: `${(index % 10) * 0.04}s` }}
                  >
                    <Card className="market-item-card" styles={{ body: { padding: 0 } }}>
                      <div className="market-item-shell">
                        <div className="market-item-cover">
                          <div className="market-item-cover-meta">
                            <Tag className="market-id-tag">
                              {artifactTypeLabel(project.type, language)}
                            </Tag>
                            <Text className="market-cover-time">
                              {formatTime(project.latestPublishedAt)}
                            </Text>
                          </div>
                          <Title level={4} className="market-item-title">
                            {project.projectDisplayName}
                          </Title>
                          <span className="market-cover-repo">{project.projectId}</span>
                        </div>

                        <div className="market-item-body">
                          <Paragraph className="market-item-description" ellipsis={{ rows: 3 }}>
                            {project.projectDescription || uiText.notProvided}
                          </Paragraph>

                          <div className="market-item-tags">
                            <Tag className="market-chip">{artifactTypeLabel(project.type, language)}</Tag>
                            {project.defaultNode?.version && (
                              <Tag className="market-chip">v{project.defaultNode.version}</Tag>
                            )}
                            {project.defaultNode?.runtimePackageId && (
                              <Tag className="market-chip">{project.defaultNode.runtimePackageId}</Tag>
                            )}
                          </div>

                          <div className="market-item-meta">
                            <span>
                              <UserOutlined /> {project.rootPublisherLogin || '-'}
                            </span>
                            <span>
                              <DownloadOutlined /> {uiText.downloads}: {project.downloads}
                            </span>
                            <span>
                              <LikeOutlined /> {uiText.likes}: {project.likes}
                            </span>
                          </div>

                          <Space wrap className="market-item-actions">
                            <Button
                              className="market-detail-btn"
                              icon={<EyeOutlined />}
                              onClick={() => openArtifactDetail(project)}
                            >
                              {uiText.detailButton}
                            </Button>
                            {project.defaultNode?.downloadUrl && (
                              <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                href={project.defaultNode.downloadUrl}
                                target="_blank"
                              >
                                {uiText.downloadButton}
                              </Button>
                            )}
                          </Space>
                        </div>
                      </div>
                    </Card>
                  </div>
                </Col>
              ))
            : filteredIssues.map((issue, index) => (
                <Col xs={24} md={12} xl={8} key={issue.id}>
                  <div
                    className="market-item-wrap"
                    style={{ animationDelay: `${(index % 10) * 0.04}s` }}
                  >
                    <Card className="market-item-card" styles={{ body: { padding: 0 } }}>
                      <div className="market-item-shell">
                        <div className="market-item-cover">
                          <div className="market-item-cover-meta">
                            <Tag className="market-id-tag">#{issue.number}</Tag>
                            <Text className="market-cover-time">
                              {formatTime(issue.updatedAt)}
                            </Text>
                          </div>
                          <Title level={4} className="market-item-title">
                            {issue.title}
                          </Title>
                          {issue.repositoryUrl && (
                            <a
                              className="market-cover-repo"
                              href={issue.repositoryUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {extractRepoName(issue.repositoryUrl)}
                            </a>
                          )}
                        </div>

                        <div className="market-item-body">
                          <Paragraph className="market-item-description" ellipsis={{ rows: 3 }}>
                            {issue.description || uiText.notProvided}
                          </Paragraph>

                          <div className="market-item-tags">
                            {issue.labels.slice(0, 6).map(label => (
                              <Tag
                                key={`${issue.id}-${label.name}`}
                                className="market-chip"
                              >
                                {label.name}
                              </Tag>
                            ))}
                          </div>

                          <div className="market-item-meta">
                            <span>
                              <UserOutlined /> {issue.author}
                            </span>
                            <span>
                              <MessageOutlined /> {uiText.comments}: {issue.comments}
                            </span>
                          </div>

                          <Space wrap className="market-item-actions">
                            <Button
                              className="market-detail-btn"
                              icon={<EyeOutlined />}
                              onClick={() => openIssueDetail(issue)}
                            >
                              {uiText.detailButton}
                            </Button>
                            <Button size="small" icon={<GithubOutlined />} href={issue.issueUrl} target="_blank">
                              {uiText.issueButton}
                            </Button>
                            {issue.repositoryUrl && (
                              <Button size="small" icon={<LinkOutlined />} href={issue.repositoryUrl} target="_blank">
                                {uiText.repoButton}
                              </Button>
                            )}
                            {issue.homepageUrl && (
                              <Button size="small" icon={<LinkOutlined />} href={issue.homepageUrl} target="_blank">
                                {uiText.homepageButton}
                              </Button>
                            )}
                          </Space>
                        </div>
                      </div>
                    </Card>
                  </div>
                </Col>
              ))}
        </Row>

        <div className="market-google-pagination">
          <Text type="secondary" className="market-page-status">
            {totalPages !== null
              ? `${uiText.totalPageIndicator.replace('{total}', String(totalPages))}，${uiText.pageIndicator.replace('{page}', String(page))}`
              : `${uiText.pageIndicator.replace('{page}', String(page))}（${uiText.unknownTotalPageIndicator}）`}
          </Text>
          <div className="market-page-strip">
            <Button
              className="market-page-arrow"
              icon={<LeftOutlined />}
              onClick={() => setPageInQuery(page - 1)}
              disabled={loading || page <= 1}
              aria-label={uiText.prevPage}
            />
            {paginationTokens.map(token =>
              token.type === 'ellipsis' ? (
                <span key={String(token.value)} className="market-page-ellipsis">
                  ...
                </span>
              ) : (
                <Button
                  key={token.value}
                  className={Number(token.value) === page ? 'market-page-number active' : 'market-page-number'}
                  type="text"
                  onClick={() => setPageInQuery(Number(token.value))}
                  disabled={loading}
                >
                  {token.value}
                </Button>
              ),
            )}
            <Button
              className="market-page-arrow"
              icon={<RightOutlined />}
              onClick={() => {
                if (!hasNextPage) {
                  return;
                }
                setPageInQuery(page + 1);
              }}
              disabled={loading || !hasNextPage}
              aria-label={uiText.nextPage}
            />
          </div>
        </div>
      </section>

      <Drawer
        title={selectedArtifact?.projectDisplayName ?? selectedIssue?.title ?? uiText.detailButton}
        open={Boolean(selectedArtifact || selectedIssue)}
        onClose={closeDetailDrawer}
        width={860}
        destroyOnClose
        className="market-detail-drawer"
      >
        {selectedArtifact && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div className="market-detail-tags">
              <Tag className="market-id-tag">{artifactTypeLabel(selectedArtifact.type, language)}</Tag>
              {selectedArtifact.defaultNode?.version && (
                <Tag className="market-chip">v{selectedArtifact.defaultNode.version}</Tag>
              )}
              {selectedArtifact.defaultNode?.runtimePackageId && (
                <Tag className="market-chip">{selectedArtifact.defaultNode.runtimePackageId}</Tag>
              )}
            </div>

            <Space wrap>
              {artifactDetailIssueUrl && (
                <Button icon={<GithubOutlined />} href={artifactDetailIssueUrl} target="_blank">
                  {uiText.rootIssue}
                </Button>
              )}
              {artifactDetailDownloadUrl && (
                <Button icon={<DownloadOutlined />} href={artifactDetailDownloadUrl} target="_blank">
                  {uiText.downloadButton}
                </Button>
              )}
            </Space>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={uiText.artifactProjectId}>
                {selectedArtifactDetail?.projectId ?? selectedArtifact.projectId}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.artifactType}>
                {artifactTypeLabel(selectedArtifactDetail?.type ?? selectedArtifact.type, language)}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.author}>
                {(selectedArtifactDetail?.rootPublisherLogin ?? selectedArtifact.rootPublisherLogin) || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.contributors}>
                {selectedArtifactDetail?.contributorCount ?? selectedArtifact.contributorCount}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.downloads}>
                {selectedArtifactDetail?.downloads ?? selectedArtifact.downloads}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.likes}>
                {selectedArtifactDetail?.likes ?? selectedArtifact.likes}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.updatedAt}>
                {formatTime(selectedArtifactDetail?.latestPublishedAt ?? selectedArtifact.latestPublishedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.nodeCount}>
                {artifactNodes.length || selectedArtifactDetail?.nodes.length || 0}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.runtimePackageId}>
                {defaultArtifactNode?.runtimePackageId ?? selectedArtifact.defaultNode?.runtimePackageId ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.latestVersion}>
                {defaultArtifactNode?.version ?? selectedArtifact.defaultNode?.version ?? '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card title={uiText.detailSummaryTitle}>
              {selectedArtifactDetail?.projectDescription || selectedArtifact.projectDescription ? (
                <div className="market-detail-summary market-detail-section-content">
                  <OperitMarkdownPreview
                    content={selectedArtifactDetail?.projectDescription || selectedArtifact.projectDescription}
                  />
                </div>
              ) : (
                <Text type="secondary">{uiText.notProvided}</Text>
              )}
            </Card>

            {artifactDetailError && (
              <Alert
                type="error"
                message={uiText.loadError}
                description={artifactDetailError}
                showIcon
              />
            )}

            {artifactDetailLoading && (
              <Card className="market-loading-card">
                <Space size="middle" style={{ width: '100%', justifyContent: 'center' }}>
                  <Spin />
                  <Text>{uiText.loadingArtifactDetail}</Text>
                </Space>
              </Card>
            )}

            <Card title={`${uiText.nodesTitle} (${artifactNodes.length})`}>
              {artifactNodePanels.length > 0 ? (
                <Collapse items={artifactNodePanels} />
              ) : artifactDetailLoading ? (
                <Text type="secondary">{uiText.loadingArtifactDetail}</Text>
              ) : (
                <Text type="secondary">{uiText.notProvided}</Text>
              )}
            </Card>
          </Space>
        )}

        {selectedIssue && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div className="market-detail-tags">
              <Tag className="market-id-tag">#{selectedIssue.number}</Tag>
              {selectedIssue.labels.slice(0, 10).map(label => (
                <Tag key={`detail-${selectedIssue.id}-${label.name}`} className="market-chip">
                  {label.name}
                </Tag>
              ))}
            </div>

            <Space wrap>
              <Button icon={<GithubOutlined />} href={selectedIssue.issueUrl} target="_blank">
                {uiText.issueButton}
              </Button>
              {selectedIssue.repositoryUrl && (
                <Button icon={<LinkOutlined />} href={selectedIssue.repositoryUrl} target="_blank">
                  {uiText.repoButton}
                </Button>
              )}
              {selectedIssue.homepageUrl && (
                <Button icon={<LinkOutlined />} href={selectedIssue.homepageUrl} target="_blank">
                  {uiText.homepageButton}
                </Button>
              )}
            </Space>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={uiText.issueNumber}>
                #{selectedIssue.number}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.author}>
                <Link href={selectedIssue.authorUrl} target="_blank">
                  {selectedIssue.author}
                </Link>
              </Descriptions.Item>
              <Descriptions.Item label={uiText.createdAt}>
                {formatTime(selectedIssue.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.updatedAt}>
                {formatTime(selectedIssue.updatedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.comments}>
                {selectedIssue.comments}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.repository}>
                {selectedIssue.repositoryUrl ? (
                  <Link href={selectedIssue.repositoryUrl} target="_blank">
                    {selectedIssue.repositoryUrl}
                  </Link>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.homepage}>
                {selectedIssue.homepageUrl ? (
                  <Link href={selectedIssue.homepageUrl} target="_blank">
                    {selectedIssue.homepageUrl}
                  </Link>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
            </Descriptions>

            <Card title={uiText.detailSummaryTitle}>
              {selectedIssue.description ? (
                <div className="market-detail-summary market-detail-section-content">
                  <OperitMarkdownPreview content={selectedIssue.description} />
                </div>
              ) : (
                <Text type="secondary">{uiText.notProvided}</Text>
              )}
            </Card>

            <Card title={uiText.detailSectionsTitle}>
              {detailSections.length > 0 ? (
                <Collapse items={detailSections} />
              ) : (
                <Text type="secondary">{uiText.notProvided}</Text>
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </main>
  );
};

export default OperitMCPMarketPage;
