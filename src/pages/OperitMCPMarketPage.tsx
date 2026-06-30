import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Drawer, Input, Layout, Row, Segmented, Space, Spin, Tag, Typography } from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  GithubOutlined,
  LeftOutlined,
  LikeOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import OperitMarkdownPreview from '../components/OperitMarkdownPreview';
import {
  MARKET_V2_PAGE_SIZE,
  fetchMarketV2Json,
  marketV2DownloadUrl,
  marketV2StaticUrl,
  type MarketSort,
  type MarketV2Entry,
  type MarketV2ListPage,
  type MarketV2Manifest,
} from '../utils/operitMarketV2';
import './OperitMCPMarketPage.css';

const { Content } = Layout;
const { Title, Paragraph, Text, Link } = Typography;

type MarketFilter = 'all' | 'script' | 'package' | 'skill' | 'mcp';

interface OperitMCPMarketPageProps {
  language: 'zh' | 'en';
}

const SORTS: MarketSort[] = ['updated', 'likes', 'featured'];
const FILTERS: MarketFilter[] = ['all', 'script', 'package', 'skill', 'mcp'];

const parsePageFromQuery = (value: string | null): number => {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
};

const parseSortFromQuery = (value: string | null): MarketSort => (
  value === 'likes' || value === 'featured' || value === 'updated' ? value : 'updated'
);

const parseFilterFromQuery = (value: string | null): MarketFilter => (
  value === 'script' || value === 'package' || value === 'skill' || value === 'mcp' ? value : 'all'
);

const formatTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const typeLabel = (type: string, language: 'zh' | 'en'): string => {
  const zh: Record<string, string> = {
    all: '全部',
    script: 'Script',
    package: 'Package',
    skill: 'Skill',
    mcp: 'MCP',
  };
  const en: Record<string, string> = {
    all: 'All',
    script: 'Script',
    package: 'Package',
    skill: 'Skill',
    mcp: 'MCP',
  };
  return (language === 'zh' ? zh : en)[type] || type;
};

const sortLabel = (sort: string, language: 'zh' | 'en'): string => {
  const zh: Record<string, string> = {
    updated: '最近更新',
    likes: '最多喜欢',
    featured: '精选',
  };
  const en: Record<string, string> = {
    updated: 'Updated',
    likes: 'Likes',
    featured: 'Featured',
  };
  return (language === 'zh' ? zh : en)[sort] || sort;
};

const stateColor = (state?: string): string => {
  if (state === 'approved') return 'green';
  if (state === 'pending') return 'gold';
  if (state === 'changes_requested') return 'orange';
  if (state === 'rejected') return 'red';
  if (state === 'withdrawn') return 'default';
  return 'blue';
};

const likeCountOf = (entry: MarketV2Entry): number => (
  entry.reactions?.find(item => item.reaction === '+1' || item.reaction === 'like')?.total || 0
);

const firstAssetId = (entry: MarketV2Entry): string => entry.assets?.find(asset => asset.id)?.id || '';

const sourceUrlOf = (entry: MarketV2Entry): string => entry.source?.url || '';

const versionOf = (entry: MarketV2Entry): string => entry.latestVersion?.version || '';

const categoryName = (manifest: MarketV2Manifest | null, categoryId?: string): string => (
  manifest?.categories?.find(item => item.id === categoryId)?.name || categoryId || ''
);

const normalizeEntry = (entry: MarketV2Entry): MarketV2Entry => ({
  ...entry,
  title: entry.title || entry.id,
  description: entry.description || '',
  detail: entry.detail || entry.description || '',
  assets: entry.assets || [],
  reactions: entry.reactions || [],
});

const uiText = {
  zh: {
    title: 'Operit 插件市场',
    subtitle: '当前市场页只读取 Market v2 静态 JSON：manifest、全市场列表和 entry 分片。',
    reload: '刷新',
    loading: '加载中...',
    loadError: '加载失败',
    noData: '暂无条目',
    searchPlaceholder: '搜索标题、简介、作者、分类或来源',
    detail: '详情',
    source: '来源',
    download: '下载',
    updatedAt: '更新时间',
    publishedAt: '发布时间',
    createdAt: '创建时间',
    author: '作者',
    publisher: '发布者',
    category: '分类',
    state: '阶段',
    version: '版本',
    formatVersion: '格式版本',
    appVersion: '应用版本',
    projectId: '项目 ID',
    runtimePackage: '运行包',
    assets: '资产',
    description: '简介',
    detailContent: '详情内容',
    notProvided: '-',
    page: '第 {page} 页',
    total: '共 {total} 条',
    filtered: '筛选后 {count} 条',
  },
  en: {
    title: 'Operit Plugin Market',
    subtitle: 'This page reads Market v2 static JSON only: manifest, all-list pages, and entry shards.',
    reload: 'Reload',
    loading: 'Loading...',
    loadError: 'Load failed',
    noData: 'No entries',
    searchPlaceholder: 'Search title, summary, author, category, or source',
    detail: 'Detail',
    source: 'Source',
    download: 'Download',
    updatedAt: 'Updated',
    publishedAt: 'Published',
    createdAt: 'Created',
    author: 'Author',
    publisher: 'Publisher',
    category: 'Category',
    state: 'Stage',
    version: 'Version',
    formatVersion: 'Format',
    appVersion: 'App version',
    projectId: 'Project ID',
    runtimePackage: 'Runtime package',
    assets: 'Assets',
    description: 'Summary',
    detailContent: 'Detail',
    notProvided: '-',
    page: 'Page {page}',
    total: '{total} total',
    filtered: '{count} after filter',
  },
};

const OperitMCPMarketPage: React.FC<OperitMCPMarketPageProps> = ({ language }) => {
  const t = uiText[language];
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePageFromQuery(searchParams.get('page'));
  const sort = parseSortFromQuery(searchParams.get('sort'));
  const filter = parseFilterFromQuery(searchParams.get('market'));
  const requestRef = useRef(0);

  const [manifest, setManifest] = useState<MarketV2Manifest | null>(null);
  const [items, setItems] = useState<MarketV2Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<MarketV2Entry | null>(null);

  const setQuery = useCallback((next: { page?: number; sort?: MarketSort; filter?: MarketFilter }) => {
    const params = new URLSearchParams(searchParams);
    if (next.page !== undefined) params.set('page', String(next.page));
    if (next.sort !== undefined) params.set('sort', next.sort);
    if (next.filter !== undefined) params.set('market', next.filter);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadPage = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const [nextManifest, pageData] = await Promise.all([
        fetchMarketV2Json<MarketV2Manifest>(marketV2StaticUrl('manifest.json')),
        fetchMarketV2Json<MarketV2ListPage>(marketV2StaticUrl(`lists/all/${sort}/page-${page}.json`)),
      ]);
      if (requestId !== requestRef.current) return;
      if (nextManifest.marketVersion !== 2 || pageData.marketVersion !== 2) {
        throw new Error('market_version_not_supported');
      }
      setManifest(nextManifest);
      setItems((pageData.items || []).map(normalizeEntry));
      setTotal(Number(pageData.total || 0));
      setGeneratedAt(pageData.generatedAt || nextManifest.generatedAt || null);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError((err as Error).message || t.loadError);
      setItems([]);
      setTotal(0);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [page, sort, t.loadError]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return items.filter(entry => {
      if (filter !== 'all' && entry.type !== filter) return false;
      if (!query) return true;
      const haystack = [
        entry.title,
        entry.description,
        entry.detail,
        entry.id,
        entry.authorId,
        entry.publisherId,
        entry.categoryId,
        categoryName(manifest, entry.categoryId),
        sourceUrlOf(entry),
        entry.artifact?.projectId,
        entry.artifact?.runtimePkg,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [filter, items, manifest, searchText]);

  const totalPages = Math.max(1, Math.ceil(total / MARKET_V2_PAGE_SIZE));
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_item, index) => start + index);
  }, [page, totalPages]);

  const openDetail = useCallback((entry: MarketV2Entry) => {
    setSelectedEntry(entry);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  const selectedAssetId = selectedEntry ? firstAssetId(selectedEntry) : '';
  const selectedSourceUrl = selectedEntry ? sourceUrlOf(selectedEntry) : '';

  return (
    <main className="market-page">
      <Content className="market-container">
        <section className="market-hero-content">
          <Title level={1} className="market-title">{t.title}</Title>
          <Paragraph className="market-subtitle">{t.subtitle}</Paragraph>
        </section>

        <Card className="market-toolbar-card">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap size={[12, 12]} className="market-toolbar-actions">
              <Segmented
                value={filter}
                options={FILTERS.map(value => ({ label: typeLabel(value, language), value }))}
                onChange={value => setQuery({ filter: value as MarketFilter, page: 1 })}
              />
              <Segmented
                value={sort}
                options={SORTS.map(value => ({ label: sortLabel(value, language), value }))}
                onChange={value => setQuery({ sort: value as MarketSort, page: 1 })}
              />
              <Input
                allowClear
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="market-search"
              />
              <Button icon={<ReloadOutlined />} onClick={loadPage} loading={loading}>
                {t.reload}
              </Button>
            </Space>
            <Space wrap>
              <Tag>{t.page.replace('{page}', String(page))}</Tag>
              <Tag>{t.total.replace('{total}', String(total))}</Tag>
              <Tag>{t.filtered.replace('{count}', String(filteredItems.length))}</Tag>
              {generatedAt && <Tag>{t.updatedAt}: {formatTime(generatedAt)}</Tag>}
            </Space>
          </Space>
        </Card>

        {error && (
          <Alert type="error" showIcon message={t.loadError} description={error} style={{ marginTop: 16 }} />
        )}

        <section className="market-main-section">
          {loading ? (
            <Card className="market-loading-card">
              <Space size="middle" style={{ width: '100%', justifyContent: 'center' }}>
                <Spin />
                <Text>{t.loading}</Text>
              </Space>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Alert className="market-empty" type="info" showIcon message={t.noData} />
          ) : (
            <Row gutter={[16, 16]}>
              {filteredItems.map((entry, index) => {
                const assetId = firstAssetId(entry);
                const sourceUrl = sourceUrlOf(entry);
                return (
                  <Col xs={24} md={12} xl={8} key={entry.id}>
                    <div className="market-item-wrap" style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}>
                      <Card className="market-item-card" styles={{ body: { padding: 0, height: '100%' } }}>
                        <div className="market-item-shell">
                          <div className="market-item-cover">
                            <div className="market-item-cover-meta">
                              <Space size={6}>
                                <Tag className="market-id-tag">{typeLabel(entry.type, language)}</Tag>
                                <Tag color={stateColor(entry.stateCode)}>{entry.stateCode || 'approved'}</Tag>
                              </Space>
                              <Text className="market-cover-time">{formatTime(entry.updatedAt)}</Text>
                            </div>
                            <Title level={4} className="market-item-title">{entry.title}</Title>
                            {sourceUrl && (
                              <Link className="market-cover-repo" href={sourceUrl} target="_blank" rel="noreferrer">
                                {sourceUrl.replace(/^https?:\/\//, '')}
                              </Link>
                            )}
                          </div>
                          <div className="market-item-body">
                            <Paragraph className="market-item-description" ellipsis={{ rows: 3 }}>
                              {entry.description || t.notProvided}
                            </Paragraph>
                            <div className="market-item-tags">
                              {entry.categoryId && <Tag className="market-chip">{categoryName(manifest, entry.categoryId)}</Tag>}
                              {versionOf(entry) && <Tag className="market-chip">v{versionOf(entry)}</Tag>}
                              {entry.artifact?.projectId && <Tag className="market-chip">{entry.artifact.projectId}</Tag>}
                            </div>
                            <div className="market-item-meta">
                              <span><UserOutlined /> {entry.publisher?.login || entry.author?.login || entry.publisherId || entry.authorId || t.notProvided}</span>
                              <span><LikeOutlined /> {likeCountOf(entry)}</span>
                              {entry.publishedAt && <span><StarOutlined /> {formatTime(entry.publishedAt)}</span>}
                            </div>
                            <Space wrap className="market-item-actions">
                              <Button className="market-detail-btn" icon={<EyeOutlined />} onClick={() => openDetail(entry)}>
                                {t.detail}
                              </Button>
                              {sourceUrl && (
                                <Button size="small" icon={<GithubOutlined />} href={sourceUrl} target="_blank">
                                  {t.source}
                                </Button>
                              )}
                              {assetId && (
                                <Button size="small" icon={<DownloadOutlined />} href={marketV2DownloadUrl(assetId)} target="_blank">
                                  {t.download}
                                </Button>
                              )}
                            </Space>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}

          <div className="market-google-pagination">
            <Text type="secondary" className="market-page-status">
              {t.page.replace('{page}', String(page))} / {totalPages}
            </Text>
            <div className="market-page-strip">
              <Button
                className="market-page-arrow"
                icon={<LeftOutlined />}
                disabled={page <= 1}
                onClick={() => setQuery({ page: page - 1 })}
                aria-label="Previous page"
              />
              {pageNumbers.map(value => (
                <Button
                  key={value}
                  className={`market-page-number${value === page ? ' active' : ''}`}
                  type="text"
                  onClick={() => setQuery({ page: value })}
                >
                  {value}
                </Button>
              ))}
              <Button
                className="market-page-arrow"
                icon={<RightOutlined />}
                disabled={page >= totalPages}
                onClick={() => setQuery({ page: page + 1 })}
                aria-label="Next page"
              />
            </div>
          </div>
        </section>

        <Drawer
          title={selectedEntry?.title || t.detail}
          open={Boolean(selectedEntry)}
          onClose={closeDetail}
          width={860}
          destroyOnClose
          className="market-detail-drawer"
        >
          {selectedEntry && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div className="market-detail-tags">
                <Tag className="market-id-tag">{selectedEntry.id}</Tag>
                <Tag className="market-chip">{typeLabel(selectedEntry.type, language)}</Tag>
                <Tag color={stateColor(selectedEntry.stateCode)}>{selectedEntry.stateCode || 'approved'}</Tag>
                {versionOf(selectedEntry) && <Tag className="market-chip">v{versionOf(selectedEntry)}</Tag>}
              </div>

              <Space wrap>
                {selectedSourceUrl && (
                  <Button icon={<GithubOutlined />} href={selectedSourceUrl} target="_blank">
                    {t.source}
                  </Button>
                )}
                {selectedAssetId && (
                  <Button icon={<DownloadOutlined />} href={marketV2DownloadUrl(selectedAssetId)} target="_blank">
                    {t.download}
                  </Button>
                )}
              </Space>

              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="ID">{selectedEntry.id}</Descriptions.Item>
                <Descriptions.Item label={t.author}>{selectedEntry.author?.login || selectedEntry.authorId || t.notProvided}</Descriptions.Item>
                <Descriptions.Item label={t.publisher}>{selectedEntry.publisher?.login || selectedEntry.publisherId || t.notProvided}</Descriptions.Item>
                <Descriptions.Item label={t.category}>{categoryName(manifest, selectedEntry.categoryId) || t.notProvided}</Descriptions.Item>
                <Descriptions.Item label={t.state}>{selectedEntry.stateCode || t.notProvided}</Descriptions.Item>
                <Descriptions.Item label={t.createdAt}>{formatTime(selectedEntry.createdAt)}</Descriptions.Item>
                <Descriptions.Item label={t.updatedAt}>{formatTime(selectedEntry.updatedAt)}</Descriptions.Item>
                <Descriptions.Item label={t.publishedAt}>{formatTime(selectedEntry.publishedAt)}</Descriptions.Item>
                <Descriptions.Item label={t.version}>{selectedEntry.latestVersion?.version || t.notProvided}</Descriptions.Item>
                <Descriptions.Item label={t.formatVersion}>{selectedEntry.latestVersion?.formatVer || t.notProvided}</Descriptions.Item>
                <Descriptions.Item label={t.appVersion}>
                  {selectedEntry.latestVersion?.minAppVer || selectedEntry.latestVersion?.maxAppVer
                    ? `${selectedEntry.latestVersion?.minAppVer || '*'} - ${selectedEntry.latestVersion?.maxAppVer || '*'}`
                    : t.notProvided}
                </Descriptions.Item>
                {selectedEntry.artifact?.projectId && (
                  <Descriptions.Item label={t.projectId}>{selectedEntry.artifact.projectId}</Descriptions.Item>
                )}
                {(selectedEntry.latestVersion?.runtimePackageId || selectedEntry.artifact?.runtimePkg) && (
                  <Descriptions.Item label={t.runtimePackage}>{selectedEntry.latestVersion?.runtimePackageId || selectedEntry.artifact?.runtimePkg}</Descriptions.Item>
                )}
                {selectedSourceUrl && (
                  <Descriptions.Item label={t.source}>
                    <Link href={selectedSourceUrl} target="_blank" rel="noreferrer">
                      {selectedSourceUrl}
                    </Link>
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Card title={t.description}>
                <div className="market-detail-summary market-detail-section-content">
                  {selectedEntry.description ? <OperitMarkdownPreview content={selectedEntry.description} /> : <Text type="secondary">{t.notProvided}</Text>}
                </div>
              </Card>

              <Card title={t.detailContent}>
                <div className="market-detail-summary market-detail-section-content">
                  {selectedEntry.detail ? <OperitMarkdownPreview content={selectedEntry.detail} /> : <Text type="secondary">{t.notProvided}</Text>}
                </div>
              </Card>

              <Card title={`${t.assets} (${selectedEntry.assets?.length || 0})`}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {(selectedEntry.assets || []).length > 0 ? selectedEntry.assets?.map(asset => (
                    <Space key={asset.id} wrap>
                      <Tag>{asset.kind || 'asset'}</Tag>
                      <Text code>{asset.assetName || asset.id}</Text>
                      <Button size="small" icon={<DownloadOutlined />} href={marketV2DownloadUrl(asset.id)} target="_blank">
                        {t.download}
                      </Button>
                      {asset.url && (
                        <Button size="small" icon={<LinkOutlined />} href={asset.url} target="_blank">
                          URL
                        </Button>
                      )}
                    </Space>
                  )) : <Text type="secondary">{t.notProvided}</Text>}
                </Space>
              </Card>
            </Space>
          )}
        </Drawer>
      </Content>
    </main>
  );
};

export default OperitMCPMarketPage;
