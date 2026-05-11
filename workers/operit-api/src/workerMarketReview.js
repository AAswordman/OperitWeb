import {
  json,
  readJson,
  clampInt,
  GITHUB_API_BASE,
  normalizePem,
  pemToArrayBuffer,
  base64UrlFromBytes,
  base64UrlFromString,
} from './workerShared.js';

const ISSUE_PAGE_SIZE = 100;
const MAX_LIST_LIMIT = 100;
const MAX_LOG_LIMIT = 100;
const DEFAULT_LOG_LIMIT = 50;
const GITHUB_SEARCH_PAGE_SIZE = 100;
const MARKET_REVIEW_TABLE = 'market_review_logs';
const REVIEW_LABELS = {
  changesRequested: 'review:changes-requested',
  rejected: 'review:rejected',
};
const LEGACY_PENDING_LABELS = [
  'Pending Review',
  'pending review',
  'pending-review',
  '待审核',
  '待審核',
];
const DESCRIPTION_LABEL_WORDS = new Set([
  'description',
  'desc',
  'summary',
  'introduction',
  '简介',
  '描述',
  '介绍',
  '说明',
]);
const MARKET_SOURCE_CONFIG = {
  script: {
    code: 'script',
    name: 'Script',
    owner: 'AAswordman',
    repo: 'OperitScriptMarket',
    publicLabel: 'script-artifact',
    parser: 'artifact',
  },
  package: {
    code: 'package',
    name: 'Package',
    owner: 'AAswordman',
    repo: 'OperitPackageMarket',
    publicLabel: 'package-artifact',
    parser: 'artifact',
  },
  skill: {
    code: 'skill',
    name: 'Skill',
    owner: 'AAswordman',
    repo: 'OperitSkillMarket',
    publicLabel: 'skill-plugin',
    parser: 'skill',
  },
  mcp: {
    code: 'mcp',
    name: 'MCP',
    owner: 'AAswordman',
    repo: 'OperitMCPMarket',
    publicLabel: 'mcp-plugin',
    parser: 'mcp',
  },
};
const MARKET_REVIEW_REASONS = [
  {
    code: 'metadata-incomplete',
    label: 'reason:metadata-incomplete',
    zh: '元数据不完整',
    en: 'Metadata incomplete',
    description_zh: '缺少必要字段，或关键信息无法用于审核。',
    description_en: 'Required fields are missing or key metadata is not reviewable.',
  },
  {
    code: 'install-config-invalid',
    label: 'reason:install-config-invalid',
    zh: '安装配置无效',
    en: 'Install or config invalid',
    description_zh: '安装命令、配置格式或接入方式无效。',
    description_en: 'The install command, config format, or integration setup is invalid.',
  },
  {
    code: 'repository-unreachable',
    label: 'reason:repository-unreachable',
    zh: '仓库不可访问',
    en: 'Repository unreachable',
    description_zh: '仓库不存在、私有不可访问，或链接失效。',
    description_en: 'The repository does not exist, is inaccessible, or the link is broken.',
  },
  {
    code: 'repository-content-invalid',
    label: 'reason:repository-content-invalid',
    zh: '仓库内容不合规',
    en: 'Repository content invalid',
    description_zh: '仓库内容与投稿描述不符，或缺少必要实现内容。',
    description_en: 'Repository contents do not match the submission or are missing required implementation.',
  },
  {
    code: 'entry-unusable',
    label: 'reason:entry-unusable',
    zh: '条目不可用',
    en: 'Entry unusable',
    description_zh: '条目无法正常使用，核心功能不可工作。',
    description_en: 'The entry cannot be used and its core functionality does not work.',
  },
  {
    code: 'quality-too-low',
    label: 'reason:quality-too-low',
    zh: '质量过低',
    en: 'Quality too low',
    description_zh: '完成度、稳定性或可维护性低于市场要求。',
    description_en: 'Quality, stability, or maintainability is below marketplace expectations.',
  },
  {
    code: 'ai-hallucination',
    label: 'reason:ai-hallucination',
    zh: '存在 AI 幻觉问题',
    en: 'AI hallucination issue',
    description_zh: '描述、能力或行为存在明显的 AI 幻觉或错误承诺。',
    description_en: 'The description, capability, or behavior contains obvious AI hallucinations or false claims.',
  },
  {
    code: 'security-risk',
    label: 'reason:security-risk',
    zh: '存在安全风险',
    en: 'Security risk',
    description_zh: '存在潜在安全风险，不适合进入公开市场。',
    description_en: 'The submission has security risks and is not suitable for public distribution.',
  },
  {
    code: 'duplicate-submission',
    label: 'reason:duplicate-submission',
    zh: '重复投稿',
    en: 'Duplicate submission',
    description_zh: '与现有条目重复，缺少独立价值。',
    description_en: 'The submission duplicates an existing entry and lacks distinct value.',
  },
  {
    code: 'policy-violation',
    label: 'reason:policy-violation',
    zh: '违反平台规范',
    en: 'Policy violation',
    description_zh: '不符合平台规则、内容规范或分发要求。',
    description_en: 'The submission violates platform rules, content policy, or distribution requirements.',
  },
];

let githubTokenCache = {
  token: '',
  expiresAt: 0,
};

const REASON_CODE_SET = new Set(MARKET_REVIEW_REASONS.map(item => item.code));
const REASON_LABEL_TO_CODE = new Map(MARKET_REVIEW_REASONS.map(item => [normalizeLabelName(item.label), item.code]));
const REASON_CODE_TO_LABEL = new Map(MARKET_REVIEW_REASONS.map(item => [item.code, item.label]));
const REVIEW_LABEL_SET = new Set([
  normalizeLabelName(REVIEW_LABELS.changesRequested),
  normalizeLabelName(REVIEW_LABELS.rejected),
]);
const LEGACY_PENDING_LABEL_SET = new Set(LEGACY_PENDING_LABELS.map(item => normalizeLabelName(item)));
const MARKET_CONFIG_LIST = Object.values(MARKET_SOURCE_CONFIG);
const ALL_PUBLIC_LABELS = MARKET_CONFIG_LIST.map(config => config.publicLabel);

function normalizeMarketType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(MARKET_SOURCE_CONFIG, normalized) ? normalized : '';
}

function normalizeReviewState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['pending', 'approved', 'changes_requested', 'rejected'].includes(normalized) ? normalized : '';
}

function normalizeShelfState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['open', 'closed'].includes(normalized) ? normalized : '';
}

function normalizeReviewAction(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['approve', 'changes_requested', 'reject', 'reset_pending'].includes(normalized)) {
    return normalized;
  }
  return '';
}

function normalizeLabelName(value) {
  return String(value || '').trim().toLowerCase();
}

function getMarketConfig(marketType) {
  const normalized = normalizeMarketType(marketType);
  return normalized ? MARKET_SOURCE_CONFIG[normalized] : null;
}

function getManagedLabelSet(publicLabel) {
  const managed = new Set(REVIEW_LABEL_SET);
  managed.add(normalizeLabelName(publicLabel));
  for (const legacy of LEGACY_PENDING_LABEL_SET) {
    managed.add(legacy);
  }
  for (const reason of MARKET_REVIEW_REASONS) {
    managed.add(normalizeLabelName(reason.label));
  }
  return managed;
}

function extractIssueLabelObjects(issue) {
  const labels = Array.isArray(issue?.labels) ? issue.labels : [];
  return labels
    .map(label => {
      if (typeof label === 'string') {
        return { name: String(label), color: '' };
      }
      const name = String(label?.name || '').trim();
      if (!name) return null;
      return {
        name,
        color: String(label?.color || '').trim(),
      };
    })
    .filter(Boolean);
}

function extractIssueLabelNames(issue) {
  return extractIssueLabelObjects(issue).map(label => label.name);
}

function getReviewStateFromLabels(labelNames, publicLabel) {
  const normalizedNames = new Set(labelNames.map(label => normalizeLabelName(label)));
  if (normalizedNames.has(normalizeLabelName(REVIEW_LABELS.rejected))) {
    return 'rejected';
  }
  if (normalizedNames.has(normalizeLabelName(REVIEW_LABELS.changesRequested))) {
    return 'changes_requested';
  }
  if (normalizedNames.has(normalizeLabelName(publicLabel))) {
    return 'approved';
  }
  return 'pending';
}

function getReviewReasonCodesFromLabels(labelNames) {
  const normalizedNames = new Set(labelNames.map(label => normalizeLabelName(label)));
  return MARKET_REVIEW_REASONS
    .filter(item => normalizedNames.has(normalizeLabelName(item.label)))
    .map(item => item.code);
}

function normalizeReasonCode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('reason:')) {
    return REASON_LABEL_TO_CODE.get(raw) || '';
  }
  return REASON_CODE_SET.has(raw) ? raw : '';
}

function normalizeReasonCodeList(input) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const normalized = [];

  for (const item of list) {
    const code = normalizeReasonCode(item);
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    normalized.push(code);
  }

  return normalized;
}

function buildTargetReviewLabels(action, publicLabel, reasonCodes) {
  if (action === 'approve') {
    return [publicLabel];
  }
  if (action === 'changes_requested') {
    return [REVIEW_LABELS.changesRequested, ...reasonCodes.map(code => REASON_CODE_TO_LABEL.get(code)).filter(Boolean)];
  }
  if (action === 'reject') {
    return [REVIEW_LABELS.rejected, ...reasonCodes.map(code => REASON_CODE_TO_LABEL.get(code)).filter(Boolean)];
  }
  return [];
}

function buildNextIssueLabels(currentLabelNames, action, publicLabel, reasonCodes) {
  const managed = getManagedLabelSet(publicLabel);
  const preserved = [];
  const preservedSet = new Set();

  for (const labelName of currentLabelNames) {
    const normalized = normalizeLabelName(labelName);
    if (!normalized || managed.has(normalized) || preservedSet.has(normalized)) {
      continue;
    }
    preserved.push(labelName);
    preservedSet.add(normalized);
  }

  for (const labelName of buildTargetReviewLabels(action, publicLabel, reasonCodes)) {
    const normalized = normalizeLabelName(labelName);
    if (!normalized || preservedSet.has(normalized)) {
      continue;
    }
    preserved.push(labelName);
    preservedSet.add(normalized);
  }

  return preserved;
}

function normalizeTagList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20);
  }
  return String(value || '')
    .replace(/[;|]/g, ',')
    .split(/[,\n，]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseCommentJson(body, prefix) {
  const source = String(body || '');
  const start = source.indexOf(prefix);
  if (start < 0) {
    return null;
  }

  const jsonStart = start + prefix.length;
  const spacedEnd = source.indexOf(' -->', jsonStart);
  const compactEnd = source.indexOf('-->', jsonStart);
  const end = spacedEnd > jsonStart ? spacedEnd : compactEnd;
  if (end <= jsonStart) {
    return null;
  }

  try {
    return JSON.parse(source.slice(jsonStart, end));
  } catch {
    return null;
  }
}

function parseArtifactMetadata(body) {
  const metadata = parseCommentJson(body, '<!-- operit-market-json: ');
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const publisherLogin = String(metadata.publisherLogin || '').trim();
  const forgeRepo = String(metadata.forgeRepo || '').trim();
  const projectId = String(metadata.projectId || metadata.normalizedId || metadata.runtimePackageId || '').trim();
  const repositoryUrl = publisherLogin && forgeRepo
    ? `https://github.com/${publisherLogin}/${forgeRepo}`
    : '';
  const description = String(metadata.description || metadata.projectDescription || '').trim();

  return {
    description,
    repositoryUrl,
    homepageUrl: '',
    installConfig: '',
    category: '',
    tags: [],
    version: String(metadata.version || ''),
    projectId,
  };
}

function parseSkillMetadata(body) {
  const metadata = parseCommentJson(body, '<!-- operit-skill-json: ');
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  return {
    description: String(metadata.description || metadata.summary || ''),
    repositoryUrl: String(metadata.repositoryUrl || metadata.repoUrl || ''),
    homepageUrl: String(metadata.homepageUrl || metadata.homepage || ''),
    installConfig: String(metadata.installConfig || metadata.installCommand || ''),
    category: String(metadata.category || ''),
    tags: normalizeTagList(metadata.tags),
    version: String(metadata.version || ''),
    projectId: String(metadata.projectId || metadata.normalizedId || ''),
  };
}

function parseMcpMetadata(body) {
  const metadata = parseCommentJson(body, '<!-- operit-mcp-json: ');
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  return {
    description: String(metadata.description || metadata.summary || ''),
    repositoryUrl: String(metadata.repositoryUrl || metadata.repoUrl || ''),
    homepageUrl: String(metadata.homepageUrl || metadata.homepage || ''),
    installConfig: String(metadata.installConfig || metadata.installCommand || metadata.install || ''),
    category: String(metadata.category || ''),
    tags: normalizeTagList(metadata.tags),
    version: String(metadata.version || ''),
    projectId: String(metadata.projectId || metadata.normalizedId || ''),
  };
}

function parseIssueMetadata(body, parser) {
  if (parser === 'artifact') {
    return parseArtifactMetadata(body);
  }
  if (parser === 'skill') {
    return parseSkillMetadata(body);
  }
  if (parser === 'mcp') {
    return parseMcpMetadata(body);
  }
  return null;
}

function isLabelOnlyLine(raw) {
  const normalized = String(raw || '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .trim()
    .replace(/[:：]+$/, '');
  if (!normalized) {
    return false;
  }

  const parts = normalized
    .split(/[\/|]/)
    .map(item => item.trim())
    .filter(Boolean);
  if (!parts.length) {
    return false;
  }

  return parts.every(item => DESCRIPTION_LABEL_WORDS.has(item.toLowerCase()));
}

function extractHumanDescriptionFromBody(body) {
  const source = String(body || '');
  if (!source.trim()) {
    return '';
  }

  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '\n');
  const withoutCodeBlocks = withoutComments.replace(/```[\s\S]*?```/g, '\n');
  const paragraphs = [];
  let currentParagraph = '';

  const flush = () => {
    const paragraph = currentParagraph.trim();
    if (paragraph) {
      paragraphs.push(paragraph);
    }
    currentParagraph = '';
  };

  for (const rawLine of withoutCodeBlocks.split(/\r?\n/)) {
    const trimmedRaw = rawLine.trim();
    if (!trimmedRaw) {
      flush();
      continue;
    }

    if (isLabelOnlyLine(trimmedRaw)) continue;
    if (trimmedRaw.startsWith('#')) continue;
    if (trimmedRaw.startsWith('|')) continue;
    if (trimmedRaw === '---') continue;

    const trimmed = trimmedRaw
      .replace(/^\*\*[^*]+\*\*\s*[:：]\s*/, '')
      .replace(/^(描述|简介|介绍|说明|description|desc|summary|introduction)\s*[:：]\s*/i, '')
      .trim();
    if (!trimmed) continue;

    currentParagraph += currentParagraph ? ` ${trimmed}` : trimmed;
    if (currentParagraph.length >= 400) {
      flush();
      break;
    }
  }
  flush();

  const candidate = paragraphs.find(paragraph =>
    paragraph.length >= 6 &&
    !paragraph.startsWith('{') &&
    !paragraph.toLowerCase().includes('operit-')
  );

  return (candidate || '').slice(0, 300).trim();
}

function findFirstUrl(value, matcher) {
  const matches = String(value || '').match(matcher) || [];
  for (const matched of matches) {
    const sanitized = String(matched || '').trim().replace(/[)>.,]+$/g, '');
    if (sanitized && !sanitized.includes('{') && !sanitized.includes('}')) {
      return sanitized;
    }
  }
  return '';
}

function guessRepositoryUrl(body) {
  return findFirstUrl(body, /https?:\/\/github\.com\/[^\s)>\]}]+/gi);
}

function guessHomepageUrl(body, repositoryUrl) {
  const matches = String(body || '').match(/https?:\/\/[^\s)>\]}]+/gi) || [];
  for (const matched of matches) {
    const sanitized = String(matched || '').trim().replace(/[)>.,]+$/g, '');
    if (!sanitized || sanitized === repositoryUrl) {
      continue;
    }
    return sanitized;
  }
  return '';
}

function toIsoDateString(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

function toTimestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildIssueSummary(issue, marketType, config, options = {}) {
  const includeBody = Boolean(options.includeBody);
  const rawBody = String(issue?.body || '');
  const labelObjects = extractIssueLabelObjects(issue);
  const labelNames = labelObjects.map(label => label.name);
  const metadata = parseIssueMetadata(rawBody, config.parser) || {};
  const repositoryUrl = String(
    metadata.repositoryUrl ||
      (config.parser === 'artifact' ? '' : guessRepositoryUrl(rawBody)) ||
      ''
  ).trim();
  const homepageUrl = String(
    metadata.homepageUrl ||
      (config.parser === 'artifact' ? '' : guessHomepageUrl(rawBody, repositoryUrl)) ||
      ''
  ).trim();
  const reviewState = getReviewStateFromLabels(labelNames, config.publicLabel);
  const reviewReasonCodes = getReviewReasonCodesFromLabels(labelNames);
  const createdAt = toIsoDateString(issue?.created_at);
  const updatedAt = toIsoDateString(issue?.updated_at);
  const shelfState = String(issue?.state || '').trim().toLowerCase() === 'closed' ? 'closed' : 'open';

  return {
    id: Number(issue?.id || 0),
    market_type: marketType,
    market_name: config.name,
    repo_owner: config.owner,
    repo_name: config.repo,
    public_label: config.publicLabel,
    issue_number: Number(issue?.number || 0),
    title: String(issue?.title || '').trim(),
    html_url: String(issue?.html_url || '').trim(),
    created_at: createdAt,
    updated_at: updatedAt,
    shelf_state: shelfState,
    review_state: reviewState,
    review_reason_codes: reviewReasonCodes,
    is_publicly_visible: shelfState === 'open' && reviewState === 'approved',
    labels: labelObjects,
    author_login: String(issue?.user?.login || '').trim(),
    author_url: String(issue?.user?.html_url || '').trim(),
    comments: Number(issue?.comments || 0),
    body_excerpt: String(metadata.description || extractHumanDescriptionFromBody(rawBody) || '').trim(),
    metadata: {
      description: String(metadata.description || '').trim(),
      repository_url: repositoryUrl,
      homepage_url: homepageUrl,
      install_config: String(metadata.installConfig || '').trim(),
      category: String(metadata.category || '').trim(),
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      version: String(metadata.version || '').trim(),
      project_id: String(metadata.projectId || '').trim(),
    },
    raw_body: includeBody ? rawBody : undefined,
  };
}

async function importPrivateKey(pem) {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function createGitHubAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlFromString(JSON.stringify(header));
  const encodedPayload = base64UrlFromString(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function getGitHubAuth(env, requireToken = false) {
  const pat = String(env.OPERIT_GITHUB_TOKEN || '').trim();
  if (pat) {
    return { token: pat, source: 'pat' };
  }

  const appId = String(env.OPERIT_GITHUB_APP_ID || '').trim();
  const installationId = String(env.OPERIT_GITHUB_INSTALLATION_ID || '').trim();
  const privateKey = normalizePem(env.OPERIT_GITHUB_PRIVATE_KEY || '');

  if (!appId || !installationId || !privateKey) {
    if (requireToken) {
      throw new Error('github_auth_missing');
    }
    return null;
  }

  const now = Date.now();
  if (githubTokenCache.token && githubTokenCache.expiresAt - now > 60_000) {
    return { token: githubTokenCache.token, source: 'app' };
  }

  const jwt = await createGitHubAppJwt(appId, privateKey);
  const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'operit-market-review',
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || response.statusText || 'github_app_token_failed';
    throw new Error(message);
  }

  const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : now + 30 * 60 * 1000;
  githubTokenCache = {
    token: String(data?.token || ''),
    expiresAt,
  };

  if (!githubTokenCache.token && requireToken) {
    throw new Error('github_auth_missing');
  }

  return githubTokenCache.token ? { token: githubTokenCache.token, source: 'app' } : null;
}

async function githubApiRequest(path, options, env, requestOptions = {}) {
  const allowStatuses = Array.isArray(requestOptions.allowStatuses) ? requestOptions.allowStatuses : [];
  const auth = await getGitHubAuth(env, Boolean(requestOptions.requireToken));
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'operit-market-review',
    ...(options?.headers || {}),
  };

  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok && !allowStatuses.includes(response.status)) {
    const message = data?.message || response.statusText || 'github_request_failed';
    throw new Error(message);
  }

  return { response, data, text };
}

function buildQuotedSearchTerm(value) {
  return `"${String(value || '').replace(/"/g, '\\"')}"`;
}

function buildBaseSearchTerms(config, reviewState, shelfState, query) {
  const terms = [
    `repo:${config.owner}/${config.repo}`,
    'is:issue',
  ];

  const normalizedShelfState = normalizeShelfState(shelfState);
  if (normalizedShelfState) {
    terms.push(`state:${normalizedShelfState}`);
  }

  if (reviewState === 'approved') {
    terms.push(`label:${buildQuotedSearchTerm(config.publicLabel)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.changesRequested)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  } else if (reviewState === 'changes_requested') {
    terms.push(`label:${buildQuotedSearchTerm(REVIEW_LABELS.changesRequested)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  } else if (reviewState === 'rejected') {
    terms.push(`label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  } else if (reviewState === 'pending') {
    terms.push(`-label:${buildQuotedSearchTerm(config.publicLabel)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.changesRequested)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  }

  if (query) {
    terms.push(query);
  }

  return terms;
}

function buildCrossMarketBaseSearchTerms(reviewState, shelfState, query) {
  const terms = [
    ...MARKET_CONFIG_LIST.map(config => `repo:${config.owner}/${config.repo}`),
    'is:issue',
  ];

  const normalizedShelfState = normalizeShelfState(shelfState);
  if (normalizedShelfState) {
    terms.push(`state:${normalizedShelfState}`);
  }

  if (reviewState === 'pending') {
    terms.push(...ALL_PUBLIC_LABELS.map(label => `-label:${buildQuotedSearchTerm(label)}`));
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.changesRequested)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  } else if (reviewState === 'changes_requested') {
    terms.push(`label:${buildQuotedSearchTerm(REVIEW_LABELS.changesRequested)}`);
    terms.push(`-label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  } else if (reviewState === 'rejected') {
    terms.push(`label:${buildQuotedSearchTerm(REVIEW_LABELS.rejected)}`);
  } else {
    return null;
  }

  if (query) {
    terms.push(query);
  }

  return terms;
}

function buildSearchQuery(config, reviewState, shelfState, query) {
  return buildBaseSearchTerms(config, reviewState, shelfState, query).join(' ');
}

async function searchIssuesByQuery(config, query, page, perPage, env) {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('sort', 'updated');
  params.set('order', 'desc');
  params.set('per_page', String(perPage));
  params.set('page', String(page));

  const { data } = await githubApiRequest(
    `/search/issues?${params.toString()}`,
    { method: 'GET' },
    env,
  );

  return {
    total_count: Number(data?.total_count || 0),
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

async function fetchMarketIssues(marketType, reviewState, shelfState, query, targetCount, env) {
  const config = getMarketConfig(marketType);
  if (!config) {
    throw new Error('market_invalid');
  }

  const searchQuery = buildSearchQuery(config, reviewState, shelfState, query);
  const items = [];
  let totalCount = 0;
  let page = 1;
  let exhausted = false;

  while (!exhausted && items.length < targetCount) {
    const result = await searchIssuesByQuery(
      config,
      searchQuery,
      page,
      Math.min(GITHUB_SEARCH_PAGE_SIZE, targetCount),
      env,
    );

    totalCount = Number(result.total_count || 0);
    const pageItems = result.items
      .filter(issue => !issue?.pull_request)
      .map(issue => buildIssueSummary(issue, config.code, config));

    items.push(...pageItems);

    if (pageItems.length < Math.min(GITHUB_SEARCH_PAGE_SIZE, targetCount)) {
      exhausted = true;
    } else {
      page += 1;
    }
  }

  return {
    total: totalCount,
    items: items.slice(0, targetCount),
  };
}

async function fetchAllMarketIssues(reviewState, shelfState, query, targetCount, env) {
  const searchTerms = buildCrossMarketBaseSearchTerms(reviewState, shelfState, query);
  if (!searchTerms) {
    return null;
  }

  const searchQuery = searchTerms.join(' ');
  const items = [];
  let totalCount = 0;
  let page = 1;
  let exhausted = false;

  while (!exhausted && items.length < targetCount) {
    const result = await searchIssuesByQuery(
      null,
      searchQuery,
      page,
      Math.min(GITHUB_SEARCH_PAGE_SIZE, targetCount),
      env,
    );

    totalCount = Number(result.total_count || 0);
    const pageItems = result.items
      .filter(issue => !issue?.pull_request)
      .map(issue => {
        const repoName = String(issue?.repository_url || '').split('/').pop() || '';
        const config = MARKET_CONFIG_LIST.find(candidate => candidate.repo === repoName);
        if (!config) {
          return null;
        }
        return buildIssueSummary(issue, config.code, config);
      })
      .filter(Boolean);

    items.push(...pageItems);

    if (pageItems.length < Math.min(GITHUB_SEARCH_PAGE_SIZE, targetCount)) {
      exhausted = true;
    } else {
      page += 1;
    }
  }

  return {
    total: totalCount,
    items: items.slice(0, targetCount),
  };
}

async function fetchMarketIssueDetail(marketType, issueNumber, env) {
  const config = getMarketConfig(marketType);
  if (!config) {
    throw new Error('market_invalid');
  }

  const { response, data } = await githubApiRequest(
    `/repos/${config.owner}/${config.repo}/issues/${issueNumber}`,
    { method: 'GET' },
    env,
    { allowStatuses: [404] },
  );

  if (response.status === 404) {
    return null;
  }

  if (data?.pull_request) {
    throw new Error('github_issue_is_pull_request');
  }

  return {
    config,
    issue: data,
  };
}

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    item.title,
    item.body_excerpt,
    item.author_login,
    item.repo_name,
    item.market_name,
    item.metadata?.repository_url,
    item.metadata?.homepage_url,
    item.metadata?.category,
    item.metadata?.version,
    item.issue_number,
    ...(Array.isArray(item.labels) ? item.labels.map(label => label.name) : []),
    ...(Array.isArray(item.review_reason_codes) ? item.review_reason_codes : []),
  ]
    .map(value => String(value || '').toLowerCase())
    .join('\n');

  return haystack.includes(query);
}

function compareIssueItems(left, right) {
  const updatedDiff = toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
  if (updatedDiff !== 0) return updatedDiff;
  const createdDiff = toTimestamp(right.created_at) - toTimestamp(left.created_at);
  if (createdDiff !== 0) return createdDiff;
  return Number(right.issue_number || 0) - Number(left.issue_number || 0);
}

async function ensureMarketReviewSchema(env) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return;
  }

  await env.OPERIT_SUBMISSION_DB.prepare(
    `CREATE TABLE IF NOT EXISTS ${MARKET_REVIEW_TABLE} (` +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'market_type TEXT NOT NULL,' +
      'repo TEXT NOT NULL,' +
      'issue_number INTEGER NOT NULL,' +
      'issue_title TEXT,' +
      'action TEXT NOT NULL,' +
      'reason_codes_json TEXT,' +
      'previous_review_state TEXT,' +
      'next_review_state TEXT,' +
      'actor_username TEXT,' +
      'actor_display_name TEXT,' +
      'actor_role TEXT,' +
      'created_at TEXT NOT NULL' +
      ')',
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_${MARKET_REVIEW_TABLE}_issue ON ${MARKET_REVIEW_TABLE}(market_type, issue_number, created_at DESC)`,
  ).run();
  await env.OPERIT_SUBMISSION_DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_${MARKET_REVIEW_TABLE}_created ON ${MARKET_REVIEW_TABLE}(created_at DESC)`,
  ).run();
}

function normalizeLogRow(row) {
  const reasonCodes = (() => {
    try {
      const parsed = JSON.parse(String(row?.reason_codes_json || '[]'));
      return normalizeReasonCodeList(parsed);
    } catch {
      return [];
    }
  })();

  return {
    id: Number(row?.id || 0),
    market_type: String(row?.market_type || '').trim(),
    repo: String(row?.repo || '').trim(),
    issue_number: Number(row?.issue_number || 0),
    issue_title: String(row?.issue_title || '').trim(),
    action: String(row?.action || '').trim(),
    reason_codes: reasonCodes,
    previous_review_state: String(row?.previous_review_state || '').trim(),
    next_review_state: String(row?.next_review_state || '').trim(),
    actor_username: String(row?.actor_username || '').trim(),
    actor_display_name: String(row?.actor_display_name || '').trim(),
    actor_role: String(row?.actor_role || '').trim(),
    created_at: toIsoDateString(row?.created_at),
  };
}

async function insertMarketReviewLog(env, payload) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return null;
  }

  await ensureMarketReviewSchema(env);

  const createdAt = new Date().toISOString();
  const reasonCodesJson = JSON.stringify(normalizeReasonCodeList(payload.reason_codes));
  const result = await env.OPERIT_SUBMISSION_DB.prepare(
    `INSERT INTO ${MARKET_REVIEW_TABLE} (` +
      'market_type, repo, issue_number, issue_title, action, reason_codes_json, previous_review_state, next_review_state, actor_username, actor_display_name, actor_role, created_at' +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    payload.market_type,
    payload.repo,
    payload.issue_number,
    payload.issue_title || null,
    payload.action,
    reasonCodesJson,
    payload.previous_review_state || null,
    payload.next_review_state || null,
    payload.actor_username || null,
    payload.actor_display_name || null,
    payload.actor_role || null,
    createdAt,
  ).run();

  const insertedId = Number(result?.meta?.last_row_id || 0);
  return normalizeLogRow({
    id: insertedId,
    market_type: payload.market_type,
    repo: payload.repo,
    issue_number: payload.issue_number,
    issue_title: payload.issue_title,
    action: payload.action,
    reason_codes_json: reasonCodesJson,
    previous_review_state: payload.previous_review_state,
    next_review_state: payload.next_review_state,
    actor_username: payload.actor_username,
    actor_display_name: payload.actor_display_name,
    actor_role: payload.actor_role,
    created_at: createdAt,
  });
}

async function queryMarketReviewLogs(env, filters = {}) {
  if (!env.OPERIT_SUBMISSION_DB) {
    return [];
  }

  await ensureMarketReviewSchema(env);

  const conditions = [];
  const bindings = [];

  const marketType = normalizeMarketType(filters.market_type);
  if (marketType) {
    conditions.push('market_type = ?');
    bindings.push(marketType);
  }

  const issueNumber = Number.parseInt(String(filters.issue_number || ''), 10);
  if (Number.isFinite(issueNumber) && issueNumber > 0) {
    conditions.push('issue_number = ?');
    bindings.push(issueNumber);
  }

  const query = [
    `SELECT id, market_type, repo, issue_number, issue_title, action, reason_codes_json, previous_review_state, next_review_state, actor_username, actor_display_name, actor_role, created_at`,
    `FROM ${MARKET_REVIEW_TABLE}`,
    conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    'ORDER BY created_at DESC',
    'LIMIT ?',
  ].filter(Boolean).join(' ');

  const limit = clampInt(filters.limit, 1, MAX_LOG_LIMIT, DEFAULT_LOG_LIMIT);
  const { results } = await env.OPERIT_SUBMISSION_DB.prepare(query).bind(...bindings, limit).all();
  return (results || []).map(normalizeLogRow);
}

function createMetaPayload() {
  return {
    markets: Object.values(MARKET_SOURCE_CONFIG).map(config => ({
      code: config.code,
      name: config.name,
      owner: config.owner,
      repo: config.repo,
      public_label: config.publicLabel,
    })),
    review_states: [
      { code: 'pending', label: 'Pending' },
      { code: 'approved', label: 'Approved' },
      { code: 'changes_requested', label: 'Changes Requested' },
      { code: 'rejected', label: 'Rejected' },
    ],
    actions: [
      { code: 'approve', review_state: 'approved' },
      { code: 'changes_requested', review_state: 'changes_requested' },
      { code: 'reject', review_state: 'rejected' },
      { code: 'reset_pending', review_state: 'pending' },
    ],
    review_labels: {
      changes_requested: REVIEW_LABELS.changesRequested,
      rejected: REVIEW_LABELS.rejected,
    },
    reasons: MARKET_REVIEW_REASONS,
    legacy_pending_labels: LEGACY_PENDING_LABELS,
  };
}

function getRequestErrorPayload(error) {
  const message = error instanceof Error ? error.message : String(error || 'internal_error');
  if ([
    'market_invalid',
    'issue_number_invalid',
    'action_invalid',
    'reason_codes_required',
    'reason_code_invalid',
    'github_issue_is_pull_request',
  ].includes(message)) {
    return { status: 400, error: message };
  }
  if (message === 'github_issue_not_found') {
    return { status: 404, error: message };
  }
  if (message === 'github_auth_missing') {
    return { status: 503, error: message };
  }
  return { status: 500, error: message || 'internal_error' };
}

async function handleAdminMarketReviewMeta(_auth, env, corsHeaders) {
  await ensureMarketReviewSchema(env);
  return json({ ok: true, ...createMetaPayload() }, 200, corsHeaders);
}

async function handleAdminMarketReviewList(url, env, corsHeaders) {
  try {
    const requestedMarket = String(url.searchParams.get('market') || 'all').trim().toLowerCase();
    const requestedReviewState = String(url.searchParams.get('review_state') || 'pending').trim().toLowerCase();
    const requestedShelfState = String(url.searchParams.get('shelf_state') || 'open').trim().toLowerCase();
    const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = clampInt(url.searchParams.get('limit'), 1, MAX_LIST_LIMIT, 30);
    const offset = Math.max(0, clampInt(url.searchParams.get('offset'), 0, 100000, 0));

    const markets = requestedMarket === 'all'
      ? Object.keys(MARKET_SOURCE_CONFIG)
      : [normalizeMarketType(requestedMarket)].filter(Boolean);
    if (!markets.length) {
      return json({ error: 'market_invalid' }, 400, corsHeaders);
    }

    if (requestedReviewState !== 'all' && !normalizeReviewState(requestedReviewState)) {
      return json({ error: 'review_state_invalid' }, 400, corsHeaders);
    }

    if (requestedShelfState !== 'all' && !normalizeShelfState(requestedShelfState)) {
      return json({ error: 'shelf_state_invalid' }, 400, corsHeaders);
    }

    const normalizedReviewState = requestedReviewState === 'all' ? '' : requestedReviewState;
    const normalizedShelfState = requestedShelfState === 'all' ? '' : requestedShelfState;
    const targetCount = offset + limit;

    const canUseCrossMarketSearch = requestedMarket === 'all'
      && ['pending', 'changes_requested', 'rejected'].includes(normalizedReviewState);

    let items = [];
    let total = 0;

    if (canUseCrossMarketSearch) {
      const result = await fetchAllMarketIssues(
        normalizedReviewState,
        normalizedShelfState,
        query,
        targetCount,
        env,
      );
      items = (result?.items || []).slice(offset, offset + limit);
      total = Number(result?.total || 0);
    } else {
      const results = await Promise.all(
        markets.map(marketType =>
          fetchMarketIssues(
            marketType,
            normalizedReviewState,
            normalizedShelfState,
            query,
            targetCount,
            env,
          )
        ),
      );
      items = results
        .flatMap(result => result.items)
        .sort(compareIssueItems)
        .slice(offset, offset + limit);
      total = results.reduce((sum, result) => sum + Number(result.total || 0), 0);
    }

    return json({
      ok: true,
      market: requestedMarket,
      review_state: requestedReviewState,
      shelf_state: requestedShelfState,
      q: query,
      limit,
      offset,
      total,
      items,
    }, 200, corsHeaders);
  } catch (error) {
    const failure = getRequestErrorPayload(error);
    return json({ error: failure.error }, failure.status, corsHeaders);
  }
}

async function handleAdminMarketReviewDetail(marketType, issueNumberInput, env, corsHeaders) {
  try {
    const normalizedMarket = normalizeMarketType(marketType);
    if (!normalizedMarket) {
      return json({ error: 'market_invalid' }, 400, corsHeaders);
    }

    const issueNumber = Number.parseInt(String(issueNumberInput || ''), 10);
    if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
      return json({ error: 'issue_number_invalid' }, 400, corsHeaders);
    }

    const detail = await fetchMarketIssueDetail(normalizedMarket, issueNumber, env);
    if (!detail) {
      return json({ error: 'github_issue_not_found' }, 404, corsHeaders);
    }

    const item = buildIssueSummary(detail.issue, normalizedMarket, detail.config, { includeBody: true });
    const logs = await queryMarketReviewLogs(env, {
      market_type: normalizedMarket,
      issue_number: issueNumber,
      limit: DEFAULT_LOG_LIMIT,
    });

    return json({ ok: true, item, logs }, 200, corsHeaders);
  } catch (error) {
    const failure = getRequestErrorPayload(error);
    return json({ error: failure.error }, failure.status, corsHeaders);
  }
}

async function handleAdminMarketReviewLogs(url, env, corsHeaders) {
  try {
    const marketType = String(url.searchParams.get('market') || '').trim().toLowerCase();
    const issueNumber = String(url.searchParams.get('issue_number') || '').trim();
    const limit = clampInt(url.searchParams.get('limit'), 1, MAX_LOG_LIMIT, DEFAULT_LOG_LIMIT);

    if (marketType && !normalizeMarketType(marketType)) {
      return json({ error: 'market_invalid' }, 400, corsHeaders);
    }

    if (issueNumber) {
      const parsed = Number.parseInt(issueNumber, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return json({ error: 'issue_number_invalid' }, 400, corsHeaders);
      }
    }

    const items = await queryMarketReviewLogs(env, {
      market_type: marketType,
      issue_number: issueNumber,
      limit,
    });
    return json({ ok: true, items }, 200, corsHeaders);
  } catch (error) {
    const failure = getRequestErrorPayload(error);
    return json({ error: failure.error }, failure.status, corsHeaders);
  }
}

async function handleAdminMarketReviewAction(marketType, issueNumberInput, request, env, corsHeaders, actor) {
  try {
    const normalizedMarket = normalizeMarketType(marketType);
    if (!normalizedMarket) {
      return json({ error: 'market_invalid' }, 400, corsHeaders);
    }

    const issueNumber = Number.parseInt(String(issueNumberInput || ''), 10);
    if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
      return json({ error: 'issue_number_invalid' }, 400, corsHeaders);
    }

    const bodyResult = await readJson(request);
    if (!bodyResult.ok) {
      return json({ error: 'invalid_json' }, 400, corsHeaders);
    }

    const action = normalizeReviewAction(bodyResult.value?.action);
    if (!action) {
      return json({ error: 'action_invalid' }, 400, corsHeaders);
    }

    const rawReasonCodes = normalizeReasonCodeList(bodyResult.value?.reason_codes);
    const requestedReasons = Array.isArray(bodyResult.value?.reason_codes) ? bodyResult.value.reason_codes : [];
    if (requestedReasons.length > 0 && rawReasonCodes.length !== requestedReasons.length) {
      return json({ error: 'reason_code_invalid' }, 400, corsHeaders);
    }

    if ((action === 'changes_requested' || action === 'reject') && rawReasonCodes.length === 0) {
      return json({ error: 'reason_codes_required' }, 400, corsHeaders);
    }

    const detail = await fetchMarketIssueDetail(normalizedMarket, issueNumber, env);
    if (!detail) {
      return json({ error: 'github_issue_not_found' }, 404, corsHeaders);
    }

    const currentLabelNames = extractIssueLabelNames(detail.issue);
    const previousReviewState = getReviewStateFromLabels(currentLabelNames, detail.config.publicLabel);
    const nextLabelNames = buildNextIssueLabels(
      currentLabelNames,
      action,
      detail.config.publicLabel,
      rawReasonCodes,
    );

    const { data } = await githubApiRequest(
      `/repos/${detail.config.owner}/${detail.config.repo}/issues/${issueNumber}/labels`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels: nextLabelNames }),
      },
      env,
      { requireToken: true },
    );

    const updatedLabels = Array.isArray(data)
      ? data
      : nextLabelNames.map(name => ({ name, color: '' }));
    const nextReviewState = getReviewStateFromLabels(nextLabelNames, detail.config.publicLabel);
    const updatedIssue = {
      ...detail.issue,
      labels: updatedLabels,
    };

    const log = await insertMarketReviewLog(env, {
      market_type: normalizedMarket,
      repo: detail.config.repo,
      issue_number: issueNumber,
      issue_title: detail.issue?.title || '',
      action,
      reason_codes: rawReasonCodes,
      previous_review_state: previousReviewState,
      next_review_state: nextReviewState,
      actor_username: String(actor?.username || '').trim(),
      actor_display_name: String(actor?.display_name || '').trim(),
      actor_role: String(actor?.role || '').trim(),
    });

    const item = buildIssueSummary(updatedIssue, normalizedMarket, detail.config, { includeBody: true });

    return json({
      ok: true,
      action,
      item,
      log,
    }, 200, corsHeaders);
  } catch (error) {
    const failure = getRequestErrorPayload(error);
    return json({ error: failure.error }, failure.status, corsHeaders);
  }
}

export {
  MARKET_SOURCE_CONFIG,
  MARKET_REVIEW_REASONS,
  LEGACY_PENDING_LABELS,
  REVIEW_LABELS,
  normalizeMarketType,
  handleAdminMarketReviewMeta,
  handleAdminMarketReviewList,
  handleAdminMarketReviewDetail,
  handleAdminMarketReviewLogs,
  handleAdminMarketReviewAction,
};
