import React, { useState, useMemo, useRef } from 'react';
import { Layout, Menu, Button, Input } from 'antd';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined } from '@ant-design/icons';
import { translations } from '../translations';
import FooterComponent from '../components/Footer';
import { ENGLISH_STOP_WORDS, CHINESE_STOP_WORDS } from '../utils/dictionary';

const { Sider, Content } = Layout;

type SearchIntent = 'cloud' | 'local' | 'pricing' | null;

const detectSearchIntent = (query: string): SearchIntent => {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  if (/(免费|付费|订阅|套餐|价格|计费|充值|会员|pricing|plan|subscription|billing)/.test(q)) return 'pricing';
  if (/(云端|在线|远程|api|接口|key|token|授权|密匙|密钥)/.test(q)) return 'cloud';
  if (/(本地|离线|mnn)/.test(q)) return 'local';

  return null;
};

const expandKeywordsByIntent = (query: string, baseKeywords: string[]): string[] => {
  const intent = detectSearchIntent(query);
  const keywords = [...baseKeywords];

  if (intent === 'pricing') {
    keywords.push('免费', '付费', '订阅', '套餐', '价格', '计费', '充值', '会员', 'pricing', 'plan', 'subscription', 'billing', '授权');
  } else if (intent === 'cloud') {
    keywords.push('api', '接口', '模型', '配置', '模型配置', '功能模型', '授权', 'key', 'token', '密匙', '密钥');
  } else if (intent === 'local') {
    keywords.push('本地', '离线', 'mnn', 'local');
  }

  return [...new Set(keywords)].filter(Boolean);
};

const GuidePage: React.FC<{ darkMode: boolean; language: 'zh' | 'en' }> = ({ darkMode, language }) => {
  const t = translations[language].guide;
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);
  const contentCacheRef = useRef(new Map<string, string>());

  interface SearchResult {
    key: string;
    label: string;
    path: string;
    category: string;
    matchType: 'title' | 'content';
    highlight?: string;
    score?: number;
    matchedKeywords?: string[];
    level?: number;
  }

  // 获取所有文档的元数据
  const getAllDocuments = () => {
    const docs = [
      { key: '/guide', label: t.welcome, path: '/guide', category: 'welcome', level: 0 },
      { key: 'quick-start', label: t.quickStart, path: '/guide/quick-start', category: 'quick-start', level: 1 },
      { key: 'model-config', label: t.modelConfig, path: '/guide/basic-config/model-config', category: 'basic-config', level: 2 },
      { key: 'terminal-config', label: t.terminalConfig, path: '/guide/basic-config/terminal-config', category: 'basic-config', level: 3 },
      { key: 'mnn-local-model', label: t.mnnLocalModel, path: '/guide/basic-config/mnn-local-model', category: 'basic-config', level: 4 },
      { key: 'image-recognition', label: t.imageRecognition, path: '/guide/basic-config/image-recognition', category: 'basic-config', level: 5 },
      { key: 'functional-model-config', label: t.functionalModelConfig, path: '/guide/basic-config/functional-model-config', category: 'basic-config', level: 6 },
      { key: 'user-preferences', label: t.userPreferences, path: '/guide/basic-config/user-preferences', category: 'basic-config', level: 7 },
      { key: 'ai-permissions', label: t.aiPermissions, path: '/guide/basic-config/ai-permissions', category: 'basic-config', level: 8 },
      { key: 'software-authorization', label: t.softwareAuthorization, path: '/guide/basic-config/software-authorization', category: 'basic-config', level: 9 },
      { key: 'character-cards', label: t.characterCards, path: '/guide/character-system/character-cards', category: 'character-system', level: 10 },
      { key: 'tags', label: t.tags, path: '/guide/character-system/tags', category: 'character-system', level: 11 },
      { key: 'voice-chat', label: t.voiceChat, path: '/guide/character-system/voice-chat', category: 'character-system', level: 12 },
      { key: 'tts-reading', label: t.ttsReading, path: '/guide/character-system/tts-reading', category: 'character-system', level: 13 },
      { key: 'desktop-pet', label: t.desktopPet, path: '/guide/character-system/desktop-pet', category: 'character-system', level: 14 },
      { key: 'share-conversation', label: t.shareConversation, path: '/guide/character-system/share-conversation', category: 'character-system', level: 15 },
      { key: 'ai-tools', label: t.aiTools, path: '/guide/tools-and-features/ai-tools', category: 'tools-and-features', level: 16 },
      { key: 'toolkits', label: t.toolkits, path: '/guide/tools-and-features/toolkits', category: 'tools-and-features', level: 17 },
      { key: 'mcp', label: t.mcp, path: '/guide/tools-and-features/mcp', category: 'tools-and-features', level: 18 },
      { key: 'knowledge-base', label: t.knowledgeBase, path: '/guide/tools-and-features/knowledge-base', category: 'tools-and-features', level: 19 },
      { key: 'toolbox', label: t.toolbox, path: '/guide/tools-and-features/toolbox', category: 'tools-and-features', level: 20 },
      { key: 'context-summary', label: t.contextSummary, path: '/guide/tools-and-features/context-summary', category: 'tools-and-features', level: 21 },
      { key: 'deep-search', label: t.deepSearch, path: '/guide/tools-and-features/deep-search', category: 'tools-and-features', level: 22 },
      { key: 'workflow', label: t.workflow, path: '/guide/tools-and-features/workflow', category: 'tools-and-features', level: 23 },
      { key: 'ui-automation', label: t.uiAutomation, path: '/guide/automation/ui-automation', category: 'automation', level: 24 },
      { key: 'autoglm-mode', label: t.autoglmMode, path: '/guide/automation/autoglm-mode', category: 'automation', level: 25 },
      { key: 'web-development', label: t.webDevelopment, path: '/guide/development/web-development', category: 'development', level: 26 },
      { key: 'web-packaging', label: t.webPackaging, path: '/guide/development/web-packaging', category: 'development', level: 27 },
      { key: 'mobile-development', label: t.mobileDevelopment, path: '/guide/development/mobile-development', category: 'development', level: 28 },
      { key: 'panel-introduction', label: t.panelIntroduction, path: '/guide/interface-guide/panel-introduction', category: 'interface-guide', level: 29 },
      { key: 'return-code-generator', label: t.returnCodeGenerator, path: '/guide/tools-and-features/return-code-generator', category: 'tools-and-features', level: 30 },
      { key: 'faq', label: t.faq, path: '/guide/faq', category: 'faq', level: 31 },
    ];
    return docs;
  };

  // 简单的中文分词（浏览器兼容）
  const extractKeywords = async (query: string): Promise<string[]> => {
    const keywords: string[] = [];

    // 检测是否包含中文
    const hasChinese = /[\u4e00-\u9fa5]/.test(query);

    if (hasChinese) {
      const chineseWords: string[] = [];
      const segments = query.match(/[\u4e00-\u9fa5]+/g) || [];
      for (const seg of segments) {
        const trimmed = seg.trim();
        if (!trimmed) continue;

        if (trimmed.length <= 4 && !CHINESE_STOP_WORDS.has(trimmed)) {
          chineseWords.push(trimmed);
        }

        if (trimmed.length >= 2) {
          for (let i = 0; i < trimmed.length; i++) {
            for (let len = 2; len <= Math.min(4, trimmed.length - i); len++) {
              chineseWords.push(trimmed.slice(i, i + len));
            }
          }
        }
      }

      chineseWords.forEach(word => {
        const trimmedWord = word.trim();
        if (trimmedWord.length >= 2 && !CHINESE_STOP_WORDS.has(trimmedWord)) {
          keywords.push(trimmedWord);
        }
      });

      // 3. 提取英文单词和数字
      const englishWords = query.match(/[a-zA-Z]+/g) || [];
      englishWords.forEach(word => {
        const lowerWord = word.toLowerCase();
        if (!ENGLISH_STOP_WORDS.has(lowerWord) && word.length > 1) {
          keywords.push(lowerWord);
        }
      });

      // 提取数字
      const numbers = query.match(/\d+/g) || [];
      keywords.push(...numbers);
    } else {
      const words = query
        .split(/[\s\p{P}]+/u)
        .map(w => w.trim())
        .filter(w => w.length > 1);

      words.forEach(word => {
        const lowerWord = word.toLowerCase();
        if (!ENGLISH_STOP_WORDS.has(lowerWord)) {
          keywords.push(lowerWord);
        }
      });

      const numbers = query.match(/\d+/g) || [];
      keywords.push(...numbers);
    }

    return [...new Set(keywords)].filter(Boolean);
  };

  // 计算匹配分数
  const calculateMatchScore = (
    content: string,
    keywords: string[],
    rawQuery?: string,
  ): { score: number; matches: string[]; bestMatchIndex: number } => {
    const lowerContent = content.toLowerCase();
    const matches: string[] = [];
    let score = 0;
    let bestMatchIndex = -1;

    const firstLine = (content.split('\n')[0] || '').toLowerCase();
    const headings = content.match(/^#+.*$/gm) || [];

    const normalizedQuery = (rawQuery || '').trim().toLowerCase();
    if (normalizedQuery && lowerContent.includes(normalizedQuery)) {
      score += 80;
      bestMatchIndex = lowerContent.indexOf(normalizedQuery);
    }

    keywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      if (!lowerKeyword) return;

      const escaped = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const matchesInContent = lowerContent.match(regex);

      if (!matchesInContent) return;

      const count = matchesInContent.length;
      score += Math.min(60, count * 12);
      matches.push(keyword);

      if (firstLine.includes(lowerKeyword)) {
        score += 30;
      }

      for (const h of headings) {
        if (h.toLowerCase().includes(lowerKeyword)) {
          score += 20;
          break;
        }
      }

      const idx = lowerContent.indexOf(lowerKeyword);
      if (idx !== -1 && (bestMatchIndex === -1 || idx < bestMatchIndex)) {
        bestMatchIndex = idx;
      }
    });

    score += Math.min(30, new Set(matches.map(m => m.toLowerCase())).size * 6);

    return { score, matches: [...new Set(matches)], bestMatchIndex };
  };

  const buildHighlight = (content: string, bestMatchIndex: number): string => {
    const plain = content.replace(/\s+/g, ' ').trim();
    if (!plain) return '';
    if (bestMatchIndex < 0) {
      return plain.slice(0, 120);
    }
    const start = Math.max(0, bestMatchIndex - 40);
    const end = Math.min(plain.length, bestMatchIndex + 80);
    return plain.slice(start, end);
  };

  const calculateLabelScore = (doc: { key: string; label: string }, query: string, keywords: string[], intent: SearchIntent): number => {
    const labelLower = String(doc.label).toLowerCase();
    const queryLower = query.trim().toLowerCase();

    let score = 0;

    if (queryLower && labelLower.includes(queryLower)) {
      score += 100;
    }

    for (const k of keywords) {
      const kl = String(k).toLowerCase();
      if (kl && labelLower.includes(kl)) {
        score += 25;
      }
    }

    if (intent === 'cloud') {
      if (doc.key === 'mnn-local-model' || /local|mnn/.test(doc.key)) score -= 80;
      if (doc.key === 'model-config' || doc.key === 'functional-model-config' || doc.key === 'software-authorization') score += 30;
    } else if (intent === 'local') {
      if (doc.key === 'mnn-local-model') score += 30;
    } else if (intent === 'pricing') {
      if (doc.key === 'software-authorization' || doc.key === 'faq') score += 40;
    }

    return score;
  };

  // 搜索文档内容和标题
  const searchDocuments = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const intent = detectSearchIntent(query);

    setIsSearching(true);
    const results: (SearchResult & { score: number; matchedKeywords: string[] })[] = [];
    const docs = getAllDocuments();

    // 提取关键词
    const keywords = await extractKeywords(query);

    // 如果没有提取到关键词，使用原始查询
    const baseKeywords = keywords.length > 0 ? keywords : [query.toLowerCase()];
    const searchKeywords = expandKeywordsByIntent(query, baseKeywords);

    const labelResults: (SearchResult & { score: number; matchedKeywords: string[] })[] = [];
    for (const doc of docs) {
      const score = calculateLabelScore(doc, query, searchKeywords, intent);
      if (score > 0) {
        labelResults.push({
          ...doc,
          matchType: 'title',
          highlight: doc.label,
          score,
          matchedKeywords: searchKeywords,
          level: doc.level,
        });
      }
    }

    if (labelResults.length > 0) {
      labelResults.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.level !== undefined && b.level !== undefined && a.level !== b.level) {
          return a.level - b.level;
        }
        return String(a.label).localeCompare(String(b.label));
      });

      if (requestId === searchRequestIdRef.current) {
        setSearchResults(labelResults);
        setIsSearching(false);
      }
      return;
    }

    // 搜索每个文档
    for (const doc of docs) {
      try {
        // 构建文档路径
        let filePath = '';
        if (doc.key === 'faq') {
          filePath = `/content/${language}/faq.md`;
        } else if (doc.key === 'quick-start') {
          filePath = `/content/${language}/quick-start.md`;
        } else if (doc.category === 'basic-config') {
          filePath = `/content/${language}/basic-config/${doc.key}.md`;
        } else if (doc.category === 'character-system') {
          filePath = `/content/${language}/character-system/${doc.key}.md`;
        } else if (doc.category === 'tools-and-features') {
          filePath = `/content/${language}/tools-and-features/${doc.key}.md`;
        } else if (doc.category === 'automation') {
          filePath = `/content/${language}/automation/${doc.key}.md`;
        } else if (doc.category === 'development') {
          filePath = `/content/${language}/development/${doc.key}.md`;
        } else if (doc.category === 'interface-guide') {
          filePath = `/content/${language}/interface-guide/${doc.key}.md`;
        }

        if (filePath) {
          let content = contentCacheRef.current.get(filePath);
          if (!content) {
            const response = await fetch(filePath);
            if (!response.ok) continue;
            content = await response.text();
            contentCacheRef.current.set(filePath, content);
          }

          const { score: baseScore, matches, bestMatchIndex } = calculateMatchScore(content, searchKeywords, query);

          let score = baseScore;

          const labelLower = String(doc.label).toLowerCase();
          const queryLower = query.trim().toLowerCase();
          if (queryLower && labelLower.includes(queryLower)) {
            score += 50;
          } else {
            for (const k of searchKeywords) {
              const kl = String(k).toLowerCase();
              if (kl && labelLower.includes(kl)) {
                score += 18;
                break;
              }
            }
          }

          if (intent === 'cloud') {
            if (doc.key === 'mnn-local-model' || /local|mnn/.test(doc.key)) {
              score -= 80;
            }

            if (doc.key === 'model-config' || doc.key === 'functional-model-config' || doc.key === 'software-authorization') {
              score += 40;
            }
          } else if (intent === 'local') {
            if (doc.key === 'mnn-local-model') {
              score += 40;
            }
          } else if (intent === 'pricing') {
            if (doc.key === 'software-authorization' || doc.key === 'faq') {
              score += 40;
            }
          }

          if (score > 0) {
            const highlight = buildHighlight(content, bestMatchIndex) || doc.label;

            results.push({
              ...doc,
              matchType: score >= 60 ? 'title' : 'content',
              highlight,
              score,
              matchedKeywords: matches,
              level: doc.level
            });
          }
        }
      } catch (error) {
        console.error(`Error searching ${doc.key}:`, error);
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.level !== undefined && b.level !== undefined && a.level !== b.level) {
        return a.level - b.level;
      }
      return String(a.label).localeCompare(String(b.label));
    });

    if (requestId === searchRequestIdRef.current) {
      setSearchResults(results);
      setIsSearching(false);
    }
  };

  // 防抖搜索
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (!value.trim()) {
      searchRequestIdRef.current += 1;
      setIsSearching(false);
      setSearchResults([]);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchDocuments(value);
    }, 250);
  };

  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setSearchResults([]);
  };

  const menuItems = useMemo(() => [
    { key: '/guide', label: <Link to="/guide">{t.welcome}</Link> },
    { key: 'quick-start', label: <Link to="/guide/quick-start">{t.quickStart}</Link> },
    {
      key: 'basic-config',
      label: t.basicConfig,
      children: [
        { key: 'model-config', label: <Link to="/guide/basic-config/model-config">{t.modelConfig}</Link> },
        { key: 'terminal-config', label: <Link to="/guide/basic-config/terminal-config">{t.terminalConfig}</Link> },
        { key: 'mnn-local-model', label: <Link to="/guide/basic-config/mnn-local-model">{t.mnnLocalModel}</Link> },
        { key: 'image-recognition', label: <Link to="/guide/basic-config/image-recognition">{t.imageRecognition}</Link> },
        { key: 'functional-model-config', label: <Link to="/guide/basic-config/functional-model-config">{t.functionalModelConfig}</Link> },
        { key: 'user-preferences', label: <Link to="/guide/basic-config/user-preferences">{t.userPreferences}</Link> },
        { key: 'ai-permissions', label: <Link to="/guide/basic-config/ai-permissions">{t.aiPermissions}</Link> },
        { key: 'software-authorization', label: <Link to="/guide/basic-config/software-authorization">{t.softwareAuthorization}</Link> },
      ],
    },
    {
      key: 'character-system',
      label: t.characterSystem,
      children: [
        { key: 'character-cards', label: <Link to="/guide/character-system/character-cards">{t.characterCards}</Link> },
        { key: 'tags', label: <Link to="/guide/character-system/tags">{t.tags}</Link> },
        { key: 'voice-chat', label: <Link to="/guide/character-system/voice-chat">{t.voiceChat}</Link> },
        { key: 'tts-reading', label: <Link to="/guide/character-system/tts-reading">{t.ttsReading}</Link> },
        { key: 'desktop-pet', label: <Link to="/guide/character-system/desktop-pet">{t.desktopPet}</Link> },
        { key: 'share-conversation', label: <Link to="/guide/character-system/share-conversation">{t.shareConversation}</Link> },
      ],
    },
    {
      key: 'tools-and-features',
      label: t.toolsAndFeatures,
      children: [
        { key: 'ai-tools', label: <Link to="/guide/tools-and-features/ai-tools">{t.aiTools}</Link> },
        { key: 'toolkits', label: <Link to="/guide/tools-and-features/toolkits">{t.toolkits}</Link> },
        { key: 'mcp', label: <Link to="/guide/tools-and-features/mcp">{t.mcp}</Link> },
        { key: 'knowledge-base', label: <Link to="/guide/tools-and-features/knowledge-base">{t.knowledgeBase}</Link> },
        { key: 'toolbox', label: <Link to="/guide/tools-and-features/toolbox">{t.toolbox}</Link> },
        { key: 'context-summary', label: <Link to="/guide/tools-and-features/context-summary">{t.contextSummary}</Link> },
        { key: 'deep-search', label: <Link to="/guide/tools-and-features/deep-search">{t.deepSearch}</Link> },
        { key: 'workflow', label: <Link to="/guide/tools-and-features/workflow">{t.workflow}</Link> },
      ],
    },
        {
          key: 'automation',
          label: t.automation,
          children: [
            { key: 'ui-automation', label: <Link to="/guide/automation/ui-automation">{t.uiAutomation}</Link> },
            { key: 'autoglm-mode', label: <Link to="/guide/automation/autoglm-mode">{t.autoglmMode}</Link> },
          ],
        },
        {
          key: 'development',
          label: t.development,
          children: [
            { key: 'web-development', label: <Link to="/guide/development/web-development">{t.webDevelopment}</Link> },
            { key: 'web-packaging', label: <Link to="/guide/development/web-packaging">{t.webPackaging}</Link> },
            { key: 'mobile-development', label: <Link to="/guide/development/mobile-development">{t.mobileDevelopment}</Link> },
          ],
        },
    {
      key: 'interface-guide',
      label: t.interfaceGuide,
      children: [
        { key: 'panel-introduction', label: <Link to="/guide/interface-guide/panel-introduction">{t.panelIntroduction}</Link> },
      ],
    },
    
    { key: 'return-code-generator', label: <Link to="/guide/tools-and-features/return-code-generator">{t.returnCodeGenerator}</Link> },
    { key: 'faq', label: <Link to="/guide/faq">{t.faq}</Link> },
  ], [t]);
  const [collapsed, setCollapsed] = useState(false);
  const [broken, setBroken] = useState(false);
  const location = useLocation();

  const isToolPage = location.pathname.startsWith('/guide/tools/');

  const getSelectedKeys = () => {
    const path = location.pathname.split('/').pop() || 'quick-start';
    if (location.pathname === '/guide' || location.pathname === '/guide/') {
      return ['/guide'];
    }
    if (location.pathname.includes('/guide/tools/')) {
      return [path];
    }
    return [path];
  };
  
  const getDefaultOpenKeys = () => {
    const pathParts = location.pathname.split('/');
    if (pathParts.length > 3 && pathParts[1] === 'guide') {
      return [pathParts[2]];
    }
    return [];
  };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', paddingTop: 64, background: 'transparent' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={setBroken}
        trigger={null}
        style={{
          overflow: 'auto',
          height: 'calc(100vh - 64px)',
          background: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
          backdropFilter: 'blur(10px)',
          borderRight: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
          zIndex: 1001, // 设置比Header更高的z-index
          position: broken ? 'fixed' : 'relative', // 移动端时使用固定定位
          top: broken ? '64px' : 'auto',
          left: broken ? 0 : 'auto',
        }}
      >
        {/* 搜索框 */}
        <div style={{ padding: '12px', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)' }}>
          <Input
            placeholder={t.searchPlaceholder}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={handleSearchChange}
            allowClear
            style={{
              background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
              borderRadius: '8px',
            }}
          />
        </div>

        {/* 搜索结果 */}
        {searchQuery && (
          <div style={{
            padding: '8px 12px',
            borderBottom: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {isSearching ? (
              <div style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', padding: '8px' }}>
                {t.searching}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div style={{
                  fontSize: '12px',
                  color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  {t.searchResults} ({searchResults.length})
                </div>
                {searchResults.slice(0, 10).map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleResultClick(result.path)}
                    style={{
                      padding: '8px 12px',
                      marginBottom: '4px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: darkMode ? '#fff' : '#000',
                      marginBottom: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{result.label}</span>
                      <span style={{
                        fontSize: '11px',
                        color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                        background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {result.score}分
                      </span>
                    </div>
                    {result.matchType === 'content' && result.highlight && (
                      <div style={{
                        fontSize: '12px',
                        color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {result.highlight}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', padding: '8px' }}>
                {t.noResults}
              </div>
            )}
          </div>
        )}

        <Menu
          theme={darkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getDefaultOpenKeys()}
          items={menuItems}
          style={{ height: '100%', borderRight: 0, background: 'transparent' }}
            />
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        {/* 移动端遮罩层 */}
        {broken && !collapsed && (
          <div
            style={{
              position: 'fixed',
              top: 64,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
            }}
            onClick={() => setCollapsed(true)}
          />
        )}
        
        {broken && (
          <Button
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              position: 'fixed',
              top: 74,
              left: 16,
              zIndex: 1002, // 确保按钮在遮罩层之上
            }}
            type="primary"
            shape="circle"
          />
        )}
        <Content 
          style={{ 
            padding: isToolPage ? '0' : (broken ? '8px' : '24px'), 
            margin: 0, 
            minHeight: 280,
            height: 'calc(100vh - 64px)', // 固定高度
            overflow: 'auto', // 独立滚动
          }}
        >
          {isToolPage ? (
            <Outlet />
          ) : (
            <div style={{
              background: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              borderRadius: '12px',
              padding: '6px 24px',
              minHeight: 'calc(100vh - 112px)', // 确保内容有足够高度
            }}>
              <Outlet />
            </div>
          )}

          <FooterComponent language={language} />
        </Content>
      </Layout>
    </Layout>
  );
};

export default GuidePage; 