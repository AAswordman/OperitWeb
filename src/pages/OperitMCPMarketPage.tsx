import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  EyeOutlined,
  GithubOutlined,
  LeftOutlined,
  LinkOutlined,
  MessageOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import './OperitMCPMarketPage.css';

const { Title, Paragraph, Text, Link } = Typography;

interface OperitMCPMarketPageProps {
  language: 'zh' | 'en';
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  labels: Array<{ id: number; name: string; color: string }>;
  user: {
    login: string;
    html_url: string;
  };
  pull_request?: {
    html_url: string;
  };
}

interface GitHubSearchIssuesResponse {
  total_count: number;
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
  rawBody: string;
  sections: MarketSection[];
}

interface UiText {
  title: string;
  subtitle: string;
  mcpTab: string;
  skillTab: string;
  sourceLabel: string;
  sourceLink: string;
  reload: string;
  searchPlaceholder: string;
  loading: string;
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
  detailRawTitle: string;
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
}

const GITHUB_OWNER = 'AAswordman';
const PER_PAGE = 30;

type MarketType = 'mcp' | 'skill';

interface MarketConfig {
  repo: string;
  approvedLabel: string;
}

const MARKET_CONFIG: Record<MarketType, MarketConfig> = {
  mcp: {
    repo: 'OperitMCPMarket',
    approvedLabel: 'mcp-plugin',
  },
  skill: {
    repo: 'OperitSkillMarket',
    approvedLabel: 'skill-plugin',
  },
};

const getIssuesWebUrl = (repo: string): string => `https://github.com/${GITHUB_OWNER}/${repo}/issues`;
const getIssuesApiUrl = (repo: string): string => `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/issues`;
const getIssuesSearchApiUrl = (repo: string, approvedLabel: string): string => {
  const query = encodeURIComponent(`repo:${GITHUB_OWNER}/${repo} is:issue is:open label:${approvedLabel}`);
  return `https://api.github.com/search/issues?q=${query}&per_page=1&page=1`;
};

const parseLinkHeader = (linkHeader: string | null): { hasNext: boolean; lastPage: number | null } => {
  if (!linkHeader) {
    return { hasNext: false, lastPage: null };
  }

  const hasNext = /rel="next"/.test(linkHeader);
  const lastMatch = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  const lastPage = lastMatch ? Number.parseInt(lastMatch[1], 10) : null;

  return { hasNext, lastPage: Number.isFinite(lastPage) ? lastPage : null };
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

const hasApprovedLabel = (issue: GitHubIssue, approvedLabel: string): boolean =>
  issue.labels.some(label => label.name.trim().toLowerCase() === approvedLabel.toLowerCase());

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
    authorUrl: issue.user.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    comments: issue.comments,
    rawBody: body.trim(),
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

const OperitMCPMarketPage: React.FC<OperitMCPMarketPageProps> = ({ language }) => {
  const [marketType, setMarketType] = useState<MarketType>('mcp');
  const currentMarketConfig = MARKET_CONFIG[marketType];
  const currentIssuesWebUrl = getIssuesWebUrl(currentMarketConfig.repo);

  const uiText: UiText =
    language === 'zh'
      ? {
          title: 'Operit 插件市场',
          subtitle: '仅展示带有过审标签的条目，支持详情查看与快速筛选。',
          mcpTab: 'MCP 市场',
          skillTab: 'Skill 市场',
          sourceLabel: '数据源',
          sourceLink: '查看 Issues',
          reload: '刷新',
          searchPlaceholder: '搜索标题、简介、标签或仓库',
          loading: '正在加载市场数据...',
          loadError: '加载失败，可能是 GitHub API 速率限制或网络问题。',
          noData: '当前没有可展示的条目。',
          updatedAt: '更新时间',
          issueButton: 'Issue',
          repoButton: '仓库',
          homepageButton: '主页',
          comments: '评论',
          author: '作者',
          notProvided: '未提供简介',
          detailButton: '查看详情',
          detailSummaryTitle: '项目简介',
          detailSectionsTitle: 'Issue 详情分段',
          detailRawTitle: '原始 Issue 内容',
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
        }
      : {
          title: 'Operit Plugin Market',
          subtitle: 'Only approved-tagged entries are shown, with detail view and quick filters.',
          mcpTab: 'MCP Market',
          skillTab: 'Skill Market',
          sourceLabel: 'Source',
          sourceLink: 'Open Issues',
          reload: 'Refresh',
          searchPlaceholder: 'Search title, summary, labels, or repo',
          loading: 'Loading market data...',
          loadError: 'Failed to load data. This may be a GitHub API rate-limit or network issue.',
          noData: 'No entries available.',
          updatedAt: 'Updated At',
          issueButton: 'Issue',
          repoButton: 'Repo',
          homepageButton: 'Homepage',
          comments: 'Comments',
          author: 'Author',
          notProvided: 'No summary provided',
          detailButton: 'Details',
          detailSummaryTitle: 'Summary',
          detailSectionsTitle: 'Issue Sections',
          detailRawTitle: 'Raw Issue Body',
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
        };

  const [issues, setIssues] = useState<ParsedMarketIssue[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<ParsedMarketIssue | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);

  const currentMarketName = marketType === 'mcp' ? uiText.mcpTab : uiText.skillTab;
  const marketSubtitle =
    language === 'zh'
      ? `当前展示 ${currentMarketName}，仅包含标签 ${currentMarketConfig.approvedLabel} 的过审项目。`
      : `Showing ${currentMarketName}, filtered by approved label: ${currentMarketConfig.approvedLabel}.`;

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const requestUrl = new URL(getIssuesApiUrl(currentMarketConfig.repo));
      requestUrl.searchParams.set('state', 'open');
      requestUrl.searchParams.set('sort', 'updated');
      requestUrl.searchParams.set('direction', 'desc');
      requestUrl.searchParams.set('per_page', String(PER_PAGE));
      requestUrl.searchParams.set('page', String(page));
      requestUrl.searchParams.set('labels', currentMarketConfig.approvedLabel);

      const response = await fetch(requestUrl.toString(), {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (response.status === 403 && remaining === '0') {
          throw new Error('GitHub API rate limit reached');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const { hasNext, lastPage: parsedLastPage } = parseLinkHeader(response.headers.get('link'));
      if (totalPages !== null) {
        setHasNextPage(page < totalPages);
      } else {
        setHasNextPage(hasNext);
        if (parsedLastPage !== null) {
          setTotalPages(Math.max(1, parsedLastPage));
        } else if (!hasNext) {
          setTotalPages(page);
        } else {
          setTotalPages(null);
        }
      }

      const pageIssues = (await response.json()) as GitHubIssue[];
      const parsed = pageIssues
        .filter(item => !item.pull_request && hasApprovedLabel(item, currentMarketConfig.approvedLabel))
        .map(parseIssue);
      setIssues(parsed);
      setSelectedIssue(prevSelected =>
        prevSelected ? parsed.find(item => item.id === prevSelected.id) ?? null : null,
      );
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentMarketConfig.approvedLabel, currentMarketConfig.repo, page, totalPages]);

  const loadTotalPages = useCallback(async () => {
    try {
      const searchUrl = getIssuesSearchApiUrl(currentMarketConfig.repo, currentMarketConfig.approvedLabel);
      const response = await fetch(searchUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        return;
      }

      const searchData = (await response.json()) as GitHubSearchIssuesResponse;
      const preciseTotalPages = Math.max(1, Math.ceil(searchData.total_count / PER_PAGE));
      setTotalPages(preciseTotalPages);
      setPage(prevPage => Math.min(prevPage, preciseTotalPages));
    } catch {
      // Keep fallback pagination behavior based on Link header when search API is unavailable.
    }
  }, [currentMarketConfig.approvedLabel, currentMarketConfig.repo]);

  const handleRefresh = useCallback(() => {
    void loadTotalPages();
    void loadIssues();
  }, [loadIssues, loadTotalPages]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    void loadTotalPages();
  }, [loadTotalPages]);

  useEffect(() => {
    if (totalPages !== null) {
      setHasNextPage(page < totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIssue(null);
    setPage(1);
    setTotalPages(null);
    setHasNextPage(false);
    setSearchText('');
  }, [marketType]);

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
        issue.rawBody,
        issue.labels.map(label => label.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [issues, searchText]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [language],
  );

  const detailSections = useMemo(
    () =>
      (selectedIssue?.sections ?? []).map((section, index) => ({
        key: `${selectedIssue?.id ?? 'issue'}-${index}`,
        label: section.heading || `${uiText.sectionUntitled} ${index + 1}`,
        children: <div className="market-detail-section-content">{section.content || '-'}</div>,
      })),
    [selectedIssue, uiText.sectionUntitled],
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
                      { label: uiText.mcpTab, value: 'mcp' },
                      { label: uiText.skillTab, value: 'skill' },
                    ]}
                    value={marketType}
                    onChange={value => setMarketType(value as MarketType)}
                  />
                  <Space wrap>
                    <Text strong>{uiText.sourceLabel}:</Text>
                    <Link href={currentIssuesWebUrl} target="_blank">
                      {uiText.sourceLink}
                    </Link>
                  </Space>
                </Space>
              </Col>
              <Col xs={24} lg={12}>
                <Space wrap className="market-toolbar-actions">
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={uiText.searchPlaceholder}
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

        {!loading && filteredIssues.length === 0 && (
          <Empty description={uiText.noData} className="market-empty" />
        )}

        <Row gutter={[18, 18]}>
          {filteredIssues.map((issue, index) => (
            <Col xs={24} md={12} xl={8} key={issue.id}>
              <div
                className="market-item-wrap"
                style={{ animationDelay: `${(index % 10) * 0.04}s` }}
              >
                <Card className="market-item-card" bodyStyle={{ padding: 0 }}>
                  <div className="market-item-shell">
                    <div className="market-item-cover">
                      <div className="market-item-cover-meta">
                        <Tag className="market-id-tag">#{issue.number}</Tag>
                        <Text className="market-cover-time">
                          {timeFormatter.format(new Date(issue.updatedAt))}
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
                          onClick={() => setSelectedIssue(issue)}
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
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
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
                  onClick={() => setPage(Number(token.value))}
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
                setPage(prev => prev + 1);
              }}
              disabled={loading || !hasNextPage}
              aria-label={uiText.nextPage}
            />
          </div>
        </div>
      </section>

      <Drawer
        title={selectedIssue?.title ?? uiText.detailButton}
        open={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        width={860}
        destroyOnClose
        className="market-detail-drawer"
      >
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
                {timeFormatter.format(new Date(selectedIssue.createdAt))}
              </Descriptions.Item>
              <Descriptions.Item label={uiText.updatedAt}>
                {timeFormatter.format(new Date(selectedIssue.updatedAt))}
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
              <Paragraph className="market-detail-summary">
                {selectedIssue.description || uiText.notProvided}
              </Paragraph>
            </Card>

            <Card title={uiText.detailSectionsTitle}>
              {detailSections.length > 0 ? (
                <Collapse items={detailSections} />
              ) : (
                <Text type="secondary">{uiText.notProvided}</Text>
              )}
            </Card>

            <Card title={uiText.detailRawTitle}>
              <pre className="market-raw-body">
                {selectedIssue.rawBody || uiText.notProvided}
              </pre>
            </Card>
          </Space>
        )}
      </Drawer>
    </main>
  );
};

export default OperitMCPMarketPage;
