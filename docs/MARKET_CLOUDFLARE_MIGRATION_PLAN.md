# Operit 插件市场 Cloudflare 迁移设计

把 Operit 插件市场从 GitHub Issue 迁移到 Cloudflare（D1 + R2 + Analytics Engine）。
同时让已发布的旧 Android 客户端继续浏览、下载、发布旧格式插件。

## 1. 结论

双入口、双市场分离：

```
新客户端 / Web 浏览 → R2 静态市场 JSON
新客户端发布/交互   → CF Market API → D1/Analytics Engine → R2 静态刷新
旧客户端            → GitHub Issue v1 市场（独立运行）
一次性迁移          → 旧 Issue 全量导出 → 手动整理 → D1 v2 主库
```

核心决策：

- D1 是市场唯一主库。
- R2 存公开高频读取 JSON（列表、entry 分片详情、搜索索引、分类）。
- Analytics Engine 记下载事件。
- GitHub Issue 是旧客户端 v1 市场，不再作为 v2 的兼容层或同步层。
- 用户插件资产仍在用户自己的 GitHub，CF 只存元数据、状态、评论、统计计数。
- 新 Android 不再把 `GitHubIssue` 当市场模型。

## 2. 当前代码事实

已经在 CF 上的部分：`MarketStatsApiService` 读 `static.operit.app/market-stats`；下载统计调 `api.operit.app/market-stats/download`；artifact 已有静态 JSON。

绑定 GitHub Issue 的部分：`GitHubIssueMarketService` 封装所有市场操作；三个 MarketViewModel 发版都创建 Issue；`IssueInteractionController` 读写 GitHub 评论/点赞；UI 层多处暴露 `GitHubIssue`。

旧 Issue 仓库：

| 类型 | 仓库 | 可见 label | 隐藏 JSON |
| --- | --- | --- | --- |
| script | `AAswordman/OperitScriptMarket` | `script-artifact` | `operit-market-json` |
| package | `AAswordman/OperitPackageMarket` | `package-artifact` | `operit-market-json` |
| skill | `AAswordman/OperitSkillMarket` | `skill-plugin` | `operit-skill-json` |
| mcp | `AAswordman/OperitMCPMarket` | `mcp-plugin` | `operit-mcp-json` |

审核 label：`review:changes-requested` / `review:rejected` / `market:featured` / `reason:*`。

CF 当前分工：`market-stats`（公开数据 + 下载统计）和 `operit-api`（审核后台），数据源都是 GitHub Issue。

## 3. 迁移目标

必须满足：
- 旧客户端能继续浏览、下载、发布旧格式插件。
- 新客户端用 CF API，不依赖 GitHub Issue。
- 新市场支持版本兼容、分类、评论、点赞、审核。
- 新增市场类型不复制一套代码（extensibility）。
- 所有类型走统一 entry/version/comment/static JSON 结构和统一 endpoint；类型私有结构用扩展表承载（uniformity）。
- 插件资产属于用户自己的 GitHub。
- 老 Issue 只做一次性导入。
- 迁移后 v1/v2 市场分离运行，不做 Legacy Importer / Legacy Exporter / 自动双向同步。

不做：CF 托管插件二进制 / 改旧客户端代码 / Worker 假装 GitHub API。

## 4. 目标架构

### 4.1 Worker 分工

| Worker | 域名 | 职责 |
| --- | --- | --- |
| `market-stats` | `api.operit.app` | 发布/交互 API、下载统计、R2 静态 JSON 构建 |
| `operit-api` | `api.aaswordsman.org` | 管理员登录、审核后台 API、审核动作 |

两个 Worker 绑定同一个 D1：

```toml
[[d1_databases]]
binding = "OPERIT_MARKET_DB"
database_name = "operit_market"
database_id = "<new-d1-id>"
```

### 4.2 数据流

- 新版浏览：Android/Web → `static.operit.app/market/v2/…` → R2 JSON
- 新版发布：发布者 → 传资产到自己的 GitHub release → `POST /market/v2/publish` → D1 pending → 审核通过 → R2 刷新
- 旧版发布：旧客户端 → GitHub create issue → v1 Issue 市场独立处理，不自动进入 D1 v2
- 旧版下载：旧客户端 → 读 GitHub Issue v1 市场 → 解析 hidden JSON → 下载用户 GitHub asset
- 新版下载：客户端 → `api.operit.app/market/v2/assets/:assetId/download` → Analytics Engine → redirect 到用户 GitHub

### 4.3 模块分工

`market-stats` worker 按数据源拆分，旧端点与新端点不混在同一个模块里：

```
workers/market-stats/src/
  index.js   入口路由（/market/v2/* → 新端点, 其他 → 旧端点）

  old.js     旧端点（从当前 1799 行 index.js 拆出）
              保留：/health、/market-stats/* 静态 JSON fallback
                    /download（Analytics Engine + redirect）
                    /agent/search、/agent/items/*（如仍需要）

  static.js  新公开读接口（R2 数据源）
              处理：manifest fallback、静态 JSON 代理/跳转、
                    缓存头、R2 构建后校验

  entry.js   新条目写入/私有 API（D1 数据源）
              处理：publish、update、new version、my/entries

  interact.js 新交互写入 API（D1 + Analytics Engine）
               处理：comments 写入、comments 静态页重建、
                    reactions 点赞事件

  utils.js   底层统一工具（old 和 new 共用）
              CORS、JSON 响应、Analytics Engine 封装、
              HMAC 市场 session 签发/验签、一次性 GitHub /user 校验、R2 读写


  build.js   R2 索引生成 + 搜索表构建（cron，从 D1 读）

workers/market-stats/scripts/
  marketManualMigration.js   一次性手动迁移
  marketSeed.js              分类、状态码、原因码种子数据
```

`operit-api` 在当前结构上扩展：

```
workers/operit-api/src/
  index.js              入口
  worker.js             路由/认证
  workerAdminAuth.js    管理员认证
  workerMarketReview.js 审核 handler（数据源从 GitHub Issue 改读 D1）
```

Android 新客户端（全新实现，不保留旧市场代码）：

```
data/api/MarketApiService.kt       v2 API 调用（独立实现，不依赖 GitHubApiService）
data/market/MarketModels.kt         新市场模型
ui/features/packages/market/
  MarketViewModel.kt                新 ViewModel（type 参数决定行为）
  MarketInteractionController.kt    新评论/点赞控制器
```

删除的旧文件：`GitHubIssueMarketService.kt`、`IssueInteractionController.kt`、`GitHubForgePublishService.kt`、所有旧 `Market*` 模型和 ViewModel。旧客户端已发版不受影响，继续走 GitHub Issue 链路。

## 5. D1 数据模型

### 5.1 设计原则

- `market_types` 是市场类型注册表，`market_format_versions` 是内容格式版本注册表；两者共同构成 extensibility 核心。
- entry/version 是公共骨架；artifact 项目簇、artifact 下载资产、repo 安装源用扩展表表达。
- 所有条目共有字段进 `market_entries`；类型私有结构进扩展表，不把四种类型的字段混在主表里。
- 所有浏览、搜索、发布、审核、评论、点赞走统一 endpoint 和统一模型。
- 新增市场类型只需：① 插入 `market_types` 行 ② 插入该类型支持的 `market_format_versions` 行 ③ 在代码注册表里增加对应 validator/parser/renderer ④ R2 generator 自动生成该类型的 JSON。

### 5.2 核心表（20 张）

#### `market_meta`

市场级元信息。这个表只放会影响客户端兼容性的全局版本，不放普通业务配置。

```sql
CREATE TABLE market_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

初始值：

| key | value | 说明 |
| --- | --- | --- |
| `market_version` | `2` | 当前市场协议版本。整体结构大改时升到 `3`，新旧客户端按这个值判断是否还能使用当前 API/R2 JSON。 |

`/market/v2/manifest.json` 必须输出 `marketVersion`。客户端启动市场页时先读 manifest；如果不支持该版本，直接提示升级，不继续请求列表和详情。

#### `market_types`

类型注册表。它只描述“这个市场类型叫什么、怎么排序”。发布校验、旧格式解析、详情渲染都属于代码实现，不进入 D1。

```sql
CREATE TABLE market_types (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

| slug | name | 说明 |
| --- | --- | --- |
| script | Script | 沙盒脚本 |
| package | Package | ToolPkg / 沙盒包 |
| skill | Skill | GitHub repo 技能 |
| mcp | MCP | MCP repo / installConfig |

代码里维护 `MARKET_TYPE_REGISTRY` 和 `MARKET_FORMAT_REGISTRY`：前者按 `slug` 提供类型级 renderer key；后者按 `formatVersion` 提供发布校验、一次性迁移解析器、安装解释器。D1 不保存这些实现细节。

旧 Issue 仓库配置和旧格式 parser 只用于一次性迁移脚本，不进入运行时 Worker，不存 D1。

#### `market_format_versions`

内容格式版本注册表。它描述某个 `formatVersion` 属于哪个市场类型、是否允许新 API 发布、是否只用于旧 Issue 迁移。解析器、安装器和校验实现仍然在代码注册表里；D1 只保存公开协议的稳定枚举。

```sql
CREATE TABLE market_format_versions (
  id                 TEXT PRIMARY KEY,          -- script_v2 | toolpkg_v2 | skill_v2 | mcp_v2
  type               TEXT NOT NULL,             -- REFERENCES market_types(slug)
  name               TEXT NOT NULL,
  description        TEXT,
  publishable        INTEGER NOT NULL DEFAULT 1,
  legacy_importable  INTEGER NOT NULL DEFAULT 0,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  FOREIGN KEY(type) REFERENCES market_types(slug)
);

CREATE INDEX idx_format_versions_type ON market_format_versions(type, sort_order);
```

初始格式：

| id | type | publishable | legacy_importable | 说明 |
| --- | --- | ---: | ---: | --- |
| script_v2 | script | 1 | 0 | 新脚本格式 |
| toolpkg_v2 | package | 1 | 0 | 新 ToolPkg / 沙盒包格式 |
| skill_v2 | skill | 1 | 0 | 新 Skill repo 格式 |
| mcp_v2 | mcp | 1 | 0 | 新 MCP repo 格式 |
| script_legacy_issue_v1 | script | 0 | 1 | 旧脚本 Issue hidden JSON 迁移格式 |
| package_legacy_issue_v1 | package | 0 | 1 | 旧包 Issue hidden JSON 迁移格式 |
| skill_legacy_issue_v1 | skill | 0 | 1 | 旧 Skill Issue hidden JSON 迁移格式 |
| mcp_legacy_issue_v1 | mcp | 0 | 1 | 旧 MCP Issue hidden JSON 迁移格式 |

发布校验规则：

- 新 API 必须提交 `version.formatVersion`。
- Worker 在同一事务里校验 `formatVersion` 存在、`publishable=1`，且 `market_format_versions.type == market_entries.type`。
- `legacy_importable=1` 的格式只能由一次性迁移脚本写入，不能由 `/publish` 或 `/entries/:id/versions` 提交，也不由运行时 Worker 写入。

#### `market_state_codes`

状态码表。`market_entries` 不直接写裸字符串，而是引用这张表。

```sql
CREATE TABLE market_state_codes (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  public_listed INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
```

初始状态码：

| code | name | public_listed | 说明 |
| --- | --- | ---: | --- |
| pending | Pending | 0 | 待审核，对应旧 Issue 无公开/打回/拒绝 label |
| approved | Approved | 1 | 通过，对应公开 label；具体 label 由类型注册表提供 |
| changes_requested | Changes Requested | 0 | 打回修改 |
| rejected | Rejected | 0 | 拒绝 |
| withdrawn | Withdrawn | 0 | 作者撤回；曾公开的条目不硬删，只从公开 R2 和旧 Issue 公开列表移除 |

旧 Issue 的 open/closed 不进入状态码；一次性迁移时只作为兜底信号：公开 label 优先为 approved，其次 review label，其次 closed 才视为 withdrawn。`market:featured` 迁移到 `market_curations`。`reason:*` 进入原因码表。旧公开 label 只在迁移脚本中用于状态判断，不存进 D1。

#### `market_reason_codes`

审核原因码表。旧 Issue 的 `reason:*` label 不再散落在代码里，统一进这张表。

```sql
CREATE TABLE market_reason_codes (
  code                TEXT PRIMARY KEY,
  scope               TEXT NOT NULL DEFAULT 'review', -- review | author_block
  name                TEXT NOT NULL,
  description         TEXT,
  legacy_label        TEXT UNIQUE,
  default_state_code  TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(default_state_code) REFERENCES market_state_codes(code)
);
```

初始原因码：

| code | scope | legacy_label | default_state_code | 说明 |
| --- | --- | --- | --- | --- |
| metadata-incomplete | review | `reason:metadata-incomplete` | changes_requested | 元数据缺失 |
| install-config-invalid | review | `reason:install-config-invalid` | changes_requested | 安装配置无效 |
| repository-unreachable | review | `reason:repository-unreachable` | rejected | 仓库不可访问或已失效 |
| repository-content-invalid | review | `reason:repository-content-invalid` | changes_requested | 仓库内容不合规或不可用 |
| entry-unusable | review | `reason:entry-unusable` | rejected | 条目不可用 |
| quality-too-low | review | `reason:quality-too-low` | rejected | 质量过低 |
| ai-hallucination | review | `reason:ai-hallucination` | rejected | 明显幻觉或虚假内容 |
| security-risk | review | `reason:security-risk` | rejected | 安全风险 |
| duplicate-submission | review | `reason:duplicate-submission` | rejected | 重复提交 |
| policy-violation | review | `reason:policy-violation` | rejected | 规则违规 |
| author-spam | author_block |  |  | 刷屏、垃圾评论、刷交互 |
| author-abuse | author_block |  |  | 恶意骚扰或攻击性行为 |
| author-malicious-publish | author_block |  |  | 恶意发布、投毒或伪造资产 |
| author-policy-violation | author_block |  |  | 用户级规则违规 |

规则：

- `scope=review` 的原因码用于 entry/version 审核。
- `scope=author_block` 的原因码用于作者封禁。
- 旧 Issue label 只写 `legacy_label`；非 legacy 原因码可以为空。

#### `market_entry_reasons`

条目当前原因码关系表。一个条目可以有多个原因码。

```sql
CREATE TABLE market_entry_reasons (
  entry_id     TEXT NOT NULL,
  reason_code  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY(entry_id, reason_code),
  FOREIGN KEY(entry_id) REFERENCES market_entries(id),
  FOREIGN KEY(reason_code) REFERENCES market_reason_codes(code)
);

CREATE INDEX idx_entry_reasons_reason ON market_entry_reasons(reason_code);
```

规则：

- `state_code` 表达条目当前市场状态；`market_entry_reasons` 表达审核原因。
- `changes_requested` 和 `rejected` 可以挂多个原因码。
- `pending`、`approved` 和 `withdrawn` 默认不挂原因码；审核或作者撤回到这些状态时清空原因码。
- 一次性迁移脚本把 `reason:*` labels 导入 `market_entry_reasons` / `market_version_reasons`。

#### `market_authors`

作者表。作者是市场的一等对象，不重复塞在每条 entry 里。

```sql
CREATE TABLE market_authors (
  id            TEXT PRIMARY KEY,
  github_id     TEXT NOT NULL UNIQUE,
  github_login  TEXT NOT NULL,
  display_name  TEXT,
  owner_avatar  TEXT,
  profile_url   TEXT,
  status        TEXT NOT NULL DEFAULT 'active',  -- active | blocked
  blocked_reason_code TEXT,
  blocked_at    TEXT,
  blocked_by    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(blocked_reason_code) REFERENCES market_reason_codes(code)
);

CREATE INDEX idx_authors_status ON market_authors(status, updated_at DESC);
CREATE INDEX idx_authors_login ON market_authors(github_login);
```

规则：

- GitHub token 只在 `/auth/github` 换市场 session 时短暂经过 Worker，不保存、不写日志、不进入 D1/R2/Analytics。
- `id` 固定为 `gh_${github_id}`；`github_id` 是稳定身份，`github_login` 只是展示名和搜索字段。
- 发布和评论从 `operit_market_session` 解析当前用户，并在需要写 D1 时 upsert `market_authors`。
- 点赞不 upsert `market_authors`，只验 HMAC session、读公开 R2 判定 entry 可交互，然后写 Analytics Engine 事件，事件里带 `github_id` 用于后续聚合过滤，避免把 D1 暴露成高频攻击面。
- entry 保存 `author_id` 和 `publisher_id`：`author_id` 是插件原作者/资产 owner；`publisher_id` 是提交到市场的人。两者可以相同。
- entry 归属始终属于最初发布者 `publisher_id`；开放协作更新不改变归属。
- 多人协作署名不另建贡献表，统一从 `market_versions.publisher_id` 派生。R2 build 对同一 entry 的公开版本发布者去重后输出 contributors 展示。
- `status=blocked` 的作者不能发布和评论；点赞事件即使被接收，也不进入可信排序分。
- `blocked_reason_code` 必须引用 `market_reason_codes.scope=author_block` 的原因码；不写自由文本原因。
- 封禁只影响市场交互和可信排序；已公开条目、已存在评论不自动下架/隐藏，管理员需要分别改 entry state 或 comment state。
- 后续作者主页、作者作品列表、作者封禁都从这张表做。

#### `market_entries`

```sql
CREATE TABLE market_entries (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  author_id       TEXT NOT NULL,
  publisher_id    TEXT NOT NULL,
  allow_public_updates INTEGER NOT NULL DEFAULT 1,
  category_id     TEXT,
  state_code      TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_at    TEXT,
  FOREIGN KEY(type) REFERENCES market_types(slug),
  FOREIGN KEY(author_id) REFERENCES market_authors(id),
  FOREIGN KEY(publisher_id) REFERENCES market_authors(id),
  FOREIGN KEY(category_id) REFERENCES market_categories(id),
  FOREIGN KEY(state_code) REFERENCES market_state_codes(code)
);

CREATE UNIQUE INDEX idx_entries_type_id ON market_entries(type, id);
CREATE INDEX idx_entries_public ON market_entries(type, state_code, updated_at DESC);
CREATE INDEX idx_entries_author ON market_entries(author_id, updated_at DESC);
CREATE INDEX idx_entries_publisher ON market_entries(publisher_id, updated_at DESC);
```

字段说明：
- `id` = `{type}-{unique}`，例如 `mcp-github-com-alice-example`、`script-proj-abc123`。不另设 slug。
- `market_entries` 只放所有市场条目共同拥有的字段。repo URL、installConfig、artifact project/node/runtime package 都不进这张表。
- artifact 类型通常 `author_id = publisher_id`；repo plugin 类型允许分享转载，`author_id` 是 GitHub repo owner，`publisher_id` 是提交市场的人。
- `allow_public_updates=1` 时，除最初发布者外的登录用户也可以提交新版本；`allow_public_updates=0` 时只有 entry 的 `publisher_id` 可以提交新版本。只有最初发布者可以修改该开关。
- `category_raw` / `category_source` 不存——这些是迁移过程中的中间数据，迁移完成即过期。
- `state_code` 表示条目的市场状态，取值来自 `market_state_codes`。审核状态和作者撤回共用这一张状态码表，避免再拆一套生命周期字段。
- 不做自由 tag；精选、专题、榜单使用 `market_curations`，不污染主表。

#### `market_versions`

```sql
CREATE TABLE market_versions (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL,
  version         TEXT NOT NULL,         -- semver 或旧版原始字符串
  format_ver      TEXT NOT NULL,         -- REFERENCES market_format_versions(id)
  publisher_id    TEXT NOT NULL,         -- REFERENCES market_authors(id); actual publisher of this version
  min_app_ver     TEXT NOT NULL,
  max_app_ver     TEXT,
  state_code      TEXT NOT NULL DEFAULT 'pending',
  changelog       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_at    TEXT,
  runtime_pkg     TEXT,              -- artifact runtime package id; only used by script/package
  FOREIGN KEY(entry_id) REFERENCES market_entries(id),
  FOREIGN KEY(publisher_id) REFERENCES market_authors(id),
  FOREIGN KEY(format_ver) REFERENCES market_format_versions(id),
  FOREIGN KEY(state_code) REFERENCES market_state_codes(code),
  UNIQUE(entry_id, version)
);

CREATE INDEX idx_versions_entry ON market_versions(entry_id, published_at DESC);
CREATE INDEX idx_versions_public ON market_versions(entry_id, state_code, published_at DESC);
```

`market_versions` 是唯一版本表。artifact 不再有 node/root/parent 概念；artifact 的 `runtime_pkg` 直接落在 `market_versions.runtime_pkg`。Skill/MCP 的仓库快照放 `repo_plugin_versions`。`publisher_id` 记录该版本实际发布者，用于历史版本署名和贡献者头像展示；贡献者列表由版本发布者去重派生，不另建贡献表。

兼容规则：
- 市场有三层版本概念：`market_version` 是市场 API/R2 协议版本；`version` 是插件自己的发布版本；`format_ver` 是该插件版本使用的内容格式版本。
- `format_ver` 决定客户端使用哪套解析/安装器，不是市场版本，也不是插件自己的版本号。新发布和新版本提交必须显式提交 `version.formatVersion`，Worker 按 `market_format_versions` 校验类型矩阵。旧 Issue 迁移格式只允许一次性迁移脚本写入，不能由新 API 提交。
- R2 entry shard 和版本列表输出 `formatVersion`，供客户端安装时选择解析/安装器。
- 版本限制落在 `market_versions`，不落在 `market_entries`。同一个插件的不同版本可以支持不同 App 版本。
- `min_app_ver` 必填；`max_app_ver` 可为空，空值表示没有上限。
- 新发布和新版本提交必须带 `formatVersion` 和 `minAppVersion`；`maxAppVersion` 选填。
- 旧 Issue 迁移时如果原始 hidden JSON 没有版本限制，迁移脚本按该类型的 legacy 默认最低版本补齐，不能写空。
- `market_entries.state_code` 管条目元信息和整体上下架；`market_versions.state_code` 管某一次可安装发布的审核状态。
- 已公开 entry 提交新 version 时，entry 继续保持 `approved`，新 version 为 `pending`。R2 的 `latestVersion` 仍取最新 `approved` version。
- 首次发布时 entry 和首个 version 都是 `pending`；审核通过时两者都置为 `approved`。
- `changes_requested/rejected` 的 version 不进入公开 R2，不影响同 entry 已通过的旧 version 下载。

#### `market_version_reasons`

版本当前原因码关系表。条目元信息问题挂 `market_entry_reasons`；版本包、安装配置、兼容范围、下载资产、repo 快照问题挂这里。

```sql
CREATE TABLE market_version_reasons (
  version_id    TEXT NOT NULL,
  reason_code   TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY(version_id, reason_code),
  FOREIGN KEY(version_id) REFERENCES market_versions(id),
  FOREIGN KEY(reason_code) REFERENCES market_reason_codes(code)
);

CREATE INDEX idx_version_reasons_reason ON market_version_reasons(reason_code);
```

规则：

- 新版本审核打回或拒绝时，原因写 `market_version_reasons`，不污染 entry。
- 版本审核通过或重新提交为 `pending` 时，清空该 version 的原因码。
- 旧 Issue 迁移时如果原因明显指向安装包/安装配置/资产/repo 内容，写 `market_version_reasons`；否则写 `market_entry_reasons`。无法判断时优先写 entry 原因，避免丢失旧审核语义。

#### `artifact_projects`

Script / Package artifact 的项目簇。一个项目簇对应一个市场插件/包项目；可安装版本只由 `market_versions` 表达，不再拆 node/root/parent。

```sql
CREATE TABLE artifact_projects (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL UNIQUE,
  project_key     TEXT NOT NULL,         -- old projectId
  runtime_pkg     TEXT,                  -- optional project-level runtime package id cache
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id)
);

CREATE UNIQUE INDEX idx_artifact_project_key ON artifact_projects(project_key);
```

#### Artifact node/root/parent removal

Artifact 不再使用 `artifact_nodes` 表；`nodeId`、`rootNodeId`、`parentNodeIds` 都不是 v2 API 输入，也不会出现在公开 R2 entry payload。历史 v1 迁移只保留 entry、versions、assets，客户端和审核台均以 version 为唯一可安装单位。

#### `repo_plugin_specs`

Skill / MCP 等 repo 类插件的仓库身份。它和 entry 一对一，只表达“这个插件属于哪个 repo”，不表达某次审核过的安装快照。

```sql
CREATE TABLE repo_plugin_specs (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL UNIQUE,
  source_kind     TEXT NOT NULL,         -- github_repo
  source_url      TEXT NOT NULL,         -- full install URL: GitHub repo/tree/blob or raw URL
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id)
);

CREATE UNIQUE INDEX idx_repo_plugin_source ON repo_plugin_specs(source_url);
```

#### `repo_plugin_versions`

Skill / MCP 的 version 级审核快照。MCP/Skill 没有市场托管资产，但必须绑定一个可复现的 GitHub 内容快照，否则审核通过后作者改 default branch 就能绕过市场审核。

```sql
CREATE TABLE repo_plugin_versions (
  id              TEXT PRIMARY KEY,
  version_id      TEXT NOT NULL UNIQUE,
  ref_type        TEXT NOT NULL,         -- tag | branch | commit
  ref_name        TEXT NOT NULL,         -- v1.0.0 | main | commit sha
  commit_sha      TEXT NOT NULL,         -- resolved immutable commit
  install_config  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(version_id) REFERENCES market_versions(id)
);
```

规则：

- 审核以 `commit_sha` 为准；`ref_name` 只保留作者提交时选择的 tag/branch/commit 名称。
- 客户端请求提交完整 `source.url` 和 `refType/refName/installConfig`；GitHub 子目录/文件路径只能由 `source.url` 表达，不再存在 `subdir` 字段。`commit_sha` 由 Worker 公开读取 GitHub ref 后解析并写库。请求体不接受 `commitSha`，避免客户端伪造或误以为自己能决定审核快照。
- `install_config` 属于 version 级字段，可以随版本变化，不放 `repo_plugin_specs`。
- 客户端安装 Skill/MCP 时使用 R2 entry shard 里的 `source.url` 和 approved version 快照，不直接追踪 repo default branch。
- 一个完整 `source_url` 只能对应一个 repo plugin entry。`POST /publish` 提交已存在的 `source_url` 直接拒绝，返回 `duplicate_submission`。

#### `market_assets`

版本下载资产。只有真实可下载文件进这张表；GitHub repo URL 属于 `repo_plugin_specs`，repo 快照和 installConfig 属于 `repo_plugin_versions`。

```sql
CREATE TABLE market_assets (
  id              TEXT PRIMARY KEY,
  version_id      TEXT NOT NULL,
  kind            TEXT NOT NULL,         -- github_release_asset | raw_file
  url             TEXT NOT NULL,
  gh_owner        TEXT,
  gh_repo         TEXT,
  gh_release_tag  TEXT,
  asset_name      TEXT,
  sha256          TEXT,
  size_bytes      INTEGER,
  content_type    TEXT,
  created_at      TEXT NOT NULL,
  FOREIGN KEY(version_id) REFERENCES market_versions(id)
);
```

下载 host allowlist 沿用现有：`github.com`、`objects.githubusercontent.com`、`release-assets.githubusercontent.com`、`raw.githubusercontent.com`。

#### `market_categories`

```sql
CREATE TABLE market_categories (
  id              TEXT PRIMARY KEY,      -- stable categoryId, e.g. dev_code
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
```

`market_categories.id` 就是 API/R2 里的 `categoryId`，也是迁移 CSV 的 `final_category_id`。分类是种子数据，不另设 slug。

#### `market_curations`

精选/运营位表。精选不是 entry 的内在属性，而是某个列表里的展示关系，因此单独建表。

```sql
CREATE TABLE market_curations (
  id          TEXT PRIMARY KEY,
  list_key    TEXT NOT NULL,          -- featured | homepage | editor_pick | category:<category_id>
  entry_id    TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  starts_at   TEXT,
  ends_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id)
);

CREATE INDEX idx_curations_list ON market_curations(list_key, position);
CREATE UNIQUE INDEX idx_curations_unique ON market_curations(list_key, entry_id);
```

规则：

- 首页精选、分类精选、编辑推荐都用这张表表达。
- R2 generator 根据 `market_curations` 生成 featured/homepage/editor_pick 等静态列表。
- `market_entries` 不保存 `featured` 字段。

2026-06-24 线上实际现状：

| 入口 | 数量 |
| --- | --: |
| Skill 市场 | 979 |
| MCP 市场 | 34 |
| Script legacy | 123 |
| Package legacy | 166 |
| Script artifact 项目 | 84 |
| Package artifact 项目 | 77 |

能力分类控制在 10 个主类 + `other`。迁移时按标题/描述/repo/人工判断，不依赖旧 `metadata.category`。

| id | name | 迁移判断 |
| --- | --- | --- |
| search_research | Search & Research | 搜索、爬取、网页读取、资料收集、地图/天气/交通实时信息 |
| dev_code | Development | 编程、构建、反编译、代码审查、DevOps |
| automation_workflow | Automation | 定时、触发、批处理、工作流编排 |
| docs_knowledge | Documents & Knowledge | 文档解析、知识库、学习、课程 |
| media_content | Media & Content | 图片/视频/音频生成与处理、OCR、内容生成 |
| chat_communication | Chat & Communication | 聊天体验、角色设定、记忆整理、消息收发 |
| integration_api | Integrations & APIs | 外部平台接入、API 服务、模型供应商、推理接口 |
| system_data | System & Data | 终端、设备、本地服务、文件操作、备份同步、权限/密钥/安全审计 |
| business_productivity | Business & Productivity | 办公写作、营销、简历、产品、表格、业务流程 |
| life_entertainment | Life & Entertainment | 游戏、娱乐、占卜、健康提醒、生活服务 |
| other | Other / Review Needed | 无法稳定归入的暂存 |

规则：
- `type` = 插件形态（script/package/skill/mcp），`category` = 能力领域。
- 每条 entry 只有一个主分类。不做自由标签；搜索侧需要的关键词由 R2 构建器从标题、描述、分类和类型生成。
- `ui/sidebar`、`model/api key`、`template/example` 不单独作为能力分类：UI 是呈现形态，模型/API 是集成方式，模板/示例适合放精选列表或搜索关键词。
- Web 顶部保留 `沙盒包 / Skill / MCP` type 入口，分类筛选是第二层。
- 迁移时脚本给建议分类，人工确认 `final_category_id` 后写 D1。
- `other` 默认排最后，审核后台提示复核。
- 没有公开条目的分类不展示。

#### `market_comments`

```sql
CREATE TABLE market_comments (
  id              TEXT PRIMARY KEY,
  entry_id        TEXT NOT NULL,
  parent_id       TEXT,                  -- 回复某条评论
  author_id       TEXT NOT NULL,         -- REFERENCES market_authors(id)
  body            TEXT NOT NULL,
  source          TEXT NOT NULL,         -- cf | github_issue
  legacy_issue    INTEGER,               -- old issue number, for reference
  legacy_comment  INTEGER,               -- old comment id, for reference
  status          TEXT NOT NULL DEFAULT 'active',  -- active | hidden
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES market_entries(id),
  FOREIGN KEY(author_id) REFERENCES market_authors(id)
);
```

新评论写 D1，不写回 GitHub Issue。旧评论不迁移；`source=github_issue` 只作为保留枚举，不在本次迁移中使用。

#### `market_reaction_counts`

点赞只存聚合计数，不存用户级明细。

```sql
CREATE TABLE market_reaction_counts (
  id            TEXT PRIMARY KEY,
  entry_id      TEXT NOT NULL,
  reaction      TEXT NOT NULL,         -- +1 | heart
  gh_count      INTEGER NOT NULL DEFAULT 0,   -- imported from GitHub
  cf_count      INTEGER NOT NULL DEFAULT 0,   -- aggregated from Analytics Engine
  total_count   INTEGER NOT NULL DEFAULT 0,   -- gh_count + cf_count
  updated_at    TEXT NOT NULL,
  UNIQUE(entry_id, reaction)
);
```

新点赞流程：客户端携带 `operit_market_session` POST → Worker 验 HMAC session → 读公开 R2 判定 entry 可交互 → 写 Analytics Engine 事件 → Cron 定期聚合到 `cf_count`。R2 公开 JSON 只输出 `total_count`。跨设备"我已点赞"不作为强一致状态；需要展示时使用 KV 做轻量状态，不进 D1。

### 5.3 迁移报告

一次性迁移不写 D1 表。迁移完成后写一个 JSON 到 R2 `market/v2/migration-report.json`，包含批次 ID、各 repo 导入数、失败列表、分类完成率。复盘时读这个文件即可。

## 6. 市场接口设计

原则：公开、无权限、高频读取全部走 `static.operit.app` 的 R2 JSON；`api.operit.app` 只处理写入、私有视图、统计事件、下载跳转和 R2 fallback。D1 是主库，但不是浏览查询库。

读路径预算规则：

- 公开浏览、搜索、详情、作者页、评论页、统计展示全部只读 R2，不允许 fallback 到 D1。
- 作者私有页优先读私有 R2 快照，只有快照缺失或重建中才返回 `not_found` / `server_error`，不临时查 D1 补数据。
- Worker 写接口必须按顺序执行：验 HMAC session → 参数校验 → 限流/状态快速判断 → 必要的 D1 写入。不能为了展示字段先查 D1。
- D1 读只允许出现在：写入事务必需的存在性/权限/状态检查、R2 build、管理后台低频查询。
- 管理后台可以读 D1，但不作为用户侧接口依赖；会影响公开展示的管理动作完成后统一触发 R2 rebuild。

### 6.1 静态 R2 读取契约

静态根路径：`https://static.operit.app/market/v2`。

R2 文件不用 query string 表达筛选条件。列表、排序、分页都落到路径里，保证 CDN 命中稳定。

R2 只输出 `approved` entry、`approved` version 和 `active` 评论。`pending/rejected/changes_requested` entry 或 version 只在作者私有 API 和审核后台可见。
`withdrawn` 条目不进公开列表、entry shard 和搜索；作者后台仍通过私有快照识别“已撤回”。
作者私有页也不直接读 D1；build 额外生成私有 R2 快照，Worker 校验 `operit_market_session` 后按作者 ID 读取私有快照。这样 `/my/entries`、`/my/entries/:id` 仍走 R2，避免把 D1 当查询库。

| R2 路径 | 用途 | 主要来源 |
| --- | --- | --- |
| `/manifest.json` | 市场启动清单：市场版本、类型、分类、状态码、原因码、列表 key、搜索入口、API 地址 | D1 seed + build 配置 |
| `/lists/{listKey}/{sort}/page-{page}.json` | 所有公开列表：全部、类型、分类、类型+分类、作者公开条目；`sort` 只允许 `updated` / `likes` / `downloads`，默认 `updated`；`items[]` 使用与 entry shard 相同的完整 entry payload | `market_entries` + 扩展表 + 统计聚合 |
| `/entries/{shard}.json` | 256 分片条目详情；客户端用 entryId 计算 shard 后读取 `entriesById[entryId]`；每个 entry 内嵌公开 approved 的 `versions[]`，`latestVersion = versions[0]` | entry/version/author/category/type-specific tables |
| `/authors/{authorId}.json` | 作者公开资料和公开条目列表入口 | `market_authors` |
| `/private/authors/{authorId}/entries.json` | 作者私有条目列表：pending/rejected/changes_requested/withdrawn 全量 | `market_entries` + versions + reasons + expanded type data |
| `/private/authors/{authorId}/entries/{entryId}.json` | 作者私有条目详情：含私有状态、原因、版本、草稿信息 | `market_entries` + versions + reasons + expanded type data |
| `/comments/{entryId}/page-{page}.json` | 评论读取页 | `market_comments` |
| `/stats/reactions/{shard}.json` | 点赞聚合覆盖层 | Analytics Engine → `market_reaction_counts` → R2 |
| `/stats/downloads/{shard}.json` | 下载聚合覆盖层 | Analytics Engine → R2 |
| `/assets/{assetId}.json` | 下载跳转所需的资产元信息 | `market_assets` |
| `/search/manifest.json` | 搜索索引清单：分片、字段、生成时间 | R2 build |
| `/search/shards/{shard}.json` | 客户端本地搜索分片 | entry summary + 预处理关键词 |

`manifest.json` 示例：

```jsonc
{
  "marketVersion": 2,
  "schemaVersion": 1,
  "generatedAt": "2026-06-24T00:00:00Z",
  "staticBase": "https://static.operit.app/market/v2",
  "apiBase": "https://api.operit.app/market/v2",
  "pageSize": 100,
  "types": [{ "slug": "skill", "name": "Skill" }],
  "categories": [{ "id": "dev_code", "name": "Programming & Debugging" }],
  "stateCodes": [{ "code": "approved", "name": "Approved" }],
  "reasonCodes": [{ "code": "security-risk", "name": "Security Risk" }],
  "sorts": ["updated", "likes", "downloads"],
  "lists": [
    { "key": "all", "kind": "all", "defaultSort": "updated" },
    { "key": "type_skill", "kind": "type", "type": "skill", "defaultSort": "updated" },
    { "key": "category_dev_code", "kind": "category", "categoryId": "dev_code", "defaultSort": "updated" },
    { "key": "type_skill__category_dev_code", "kind": "type_category", "type": "skill", "categoryId": "dev_code", "defaultSort": "updated" }
  ],
  "search": { "manifest": "search/manifest.json" }
}
```

列表页格式：

列表页 `items[]` 与条目分片 `entriesById[id]` 使用同一套完整 entry payload。客户端从列表进入详情或打开 artifact 版本弹窗时，直接使用列表 item，不应再请求 entry 分片。

```jsonc
{
  "marketVersion": 2,
  "generatedAt": "2026-06-24T00:00:00Z",
  "listKey": "type_skill",
  "sort": "updated",
  "page": 1,
  "pageSize": 100,
  "total": 979,
  "next": "lists/type_skill/popular/page-2.json",
  "items": [
    {
      "id": "entry_xxx",
      "type": "skill",
      "title": "Example Skill",
      "description": "Short public description.",
      "detail": "完整详情正文",
      "featured": true,
      "categoryId": "dev_code",
      "author": { "id": "gh_alice", "login": "alice", "avatar": "https://..." },
      "publisher": { "id": "gh_bob", "login": "bob", "avatar": "https://..." },
      "versions": [
        { "id": "ver_xxx", "version": "1.0.0", "minAppVersion": "1.2.0", "runtimePackageId": "pkg", "publishedAt": "2026-06-24T00:00:00Z" }
      ],
      "latestVersion": {
        "id": "ver_xxx",
        "version": "1.0.0",
        "minAppVersion": "1.2.0",
        "maxAppVersion": null,
        "publishedAt": "2026-06-24T00:00:00Z"
      },
      "artifact": null,
      "assets": [],
      "reactions": [],
      "stats": { "downloads": 120, "likes": 10 },
      "counts": { "reactions": 10, "downloads": 120, "comments": 3 },
      "publishedAt": "2026-06-24T00:00:00Z",
      "updatedAt": "2026-06-24T00:00:00Z"
    }
  ]
}
```

条目分片格式：

```jsonc
{
  "marketVersion": 2,
  "generatedAt": "2026-06-24T00:00:00Z",
  "shard": "7f",
  "entriesById": {
    "entry_xxx": {
      "id": "entry_xxx",
      "type": "package",
      "title": "Example Package",
      "description": "100 字以内简介",
      "detail": "完整详情正文",
      "categoryId": "automation_workflow",
      "versions": [
        { "id": "ver_xxx", "version": "1.0.0", "minAppVersion": "1.2.0", "runtimePackageId": "pkg", "publishedAt": "2026-06-24T00:00:00Z" }
      ],
      "latestVersion": { "id": "ver_xxx", "version": "1.0.0", "minAppVersion": "1.2.0", "runtimePackageId": "pkg", "publishedAt": "2026-06-24T00:00:00Z" },
      "artifact": { "projectId": "project_xxx" },
      "assets": [{ "id": "asset_xxx", "versionId": "ver_xxx", "kind": "github_release_asset", "url": "https://github.com/...", "sha256": "...", "assetName": "pkg.toolpkg" }],
      "reactions": []
    }
  }
}
```

`typeData` 由代码注册表按 `type` 生成。新增市场类型只新增 renderer 和需要的扩展表，不改公共 envelope。

公开 R2 的 `versions[]` 永远只包含 `approved` version，按 `publishedAt DESC` 排列；`latestVersion` 永远等于 `versions[0]`。已公开 entry 提交新 version 后，新 version 审核通过前不进入 `versions[]`，不影响旧 version 展示和下载。

列表页和 entry shard 的 entry payload 必须保持一致；列表不是 summary，避免客户端点击列表项后再请求详情分片。

搜索不走 Worker。客户端读 `/search/manifest.json` 后按需加载分片，在本地用标题、描述、作者、分类、类型和预处理关键词搜索。当前规模可以先生成 `search/shards/all-0.json`；后续量增大时按 `type/category/首字符` 拆分，只改 search manifest，不改客户端主流程。

版本兼容不作为 D1 查询条件。`minAppVersion/maxAppVersion` 写入列表和 entry shard 的 `versions[]/latestVersion`，客户端本地过滤；artifact 的 `runtimePackageId` 同样写入 `versions[]/latestVersion`，客户端安装时用 `assets[].versionId` 找到对应资产。R2 build 支持按兼容维度生成额外列表 key，例如 `compat_android_1_2__type_skill`，用于条目规模扩大后的分页稳定性。

### 6.2 动态 Worker API

动态根路径：`https://api.operit.app/market/v2`。所有响应统一 `{ ok, item/items, error }`，但公开 GET 不默认查 D1。

#### 登录和 session

新客户端只做一次本地 GitHub 授权，scope 为 `read:user,public_repo`。`read:user` 用于市场身份，`public_repo` 只给客户端本地创建/更新用户自己的 GitHub repo、release、asset 使用。CF 不持久保存 GitHub access token。

登录流程：

1. 客户端本地完成 GitHub OAuth，拿到 GitHub access token，并保存在 Android 本地加密存储。
2. 客户端调用 `POST /auth/github`，在 `Authorization: Bearer <github_access_token>` 中携带 token。
3. Worker 只用该 token 调 GitHub `/user`，得到 `github_id/login/avatar_url` 后立即丢弃 token。
4. Worker 用 `MARKET_SESSION_SECRET` 签发 `operit_market_session`，返回给客户端。
5. 后续发布、评论、点赞、作者私有页都只携带 `Authorization: Bearer <operit_market_session>`。

`operit_market_session` 是 HMAC 自包含 session，不在 D1 建 session 表：

```jsonc
{
  "ver": 1,
  "github_id": 123456,
  "github_login": "alice",
  "avatar_url": "https://avatars.githubusercontent.com/u/123456",
  "iat": 1760000000,
  "exp": 1760604800
}
```

session token 格式固定为：

```text
om1.<base64url-json-payload>.<base64url-hmac-sha256-signature>
```

签名内容是 `<base64url-json-payload>`，签名密钥是 `MARKET_SESSION_SECRET`。payload 放 `ver/github_id/github_login/avatar_url/iat/exp`。`github_login/avatar_url` 不是权限凭据，但必须被 HMAC 签名，供后续发布、评论时 upsert `market_authors`，避免 `/auth/github` 写 D1，也避免后续写接口再次携带 GitHub token。建议有效期 7 天。客户端启动时如果 session 剩余不足 24 小时，用本地 GitHub token 再换一次。撤销不做单 token 精准撤销；严重封禁查作者状态，重大事故轮换 `MARKET_SESSION_SECRET`。

| Endpoint | 方法 | 数据源 | 用途 |
| --- | --- | --- | --- |
| `/auth/github` | POST | GitHub `/user` + HMAC | 用本地 GitHub token 换 `operit_market_session`；不写 D1 |
| `/manifest.json` | GET | R2 | R2 manifest fallback；正常客户端直接请求 static host |
| `/publish/proof` | POST | HMAC | 生成发布 proof token；不写 D1 |
| `/publish` | POST | D1 | 创建 entry + 初始 version |
| `/entries/:id` | PATCH | D1 | 作者修改条目公共信息；已公开条目修改后回到 `pending` |
| `/entries/:id/versions` | POST | D1 | 作者发布新版本，新 version 状态为 `pending` |
| `/entries/:id/resubmit` | POST | D1 + R2 | 作者重新提交 `changes_requested/rejected/withdrawn` 条目元信息，entry 状态回到 `pending` |
| `/entries/:id/versions/:versionId/resubmit` | POST | D1 + R2 | 作者重新提交 `changes_requested/rejected` version，version 状态回到 `pending` |
| `/my/entries` | GET | R2 private snapshot + auth gate | 当前登录用户的全部条目，含 pending/rejected/changes_requested/withdrawn |
| `/my/entries/:id` | GET | R2 private snapshot + auth gate | 作者私有详情，含 entry state/reasons 和各 version state/reasons |
| `/entries/:id` | DELETE | D1 + R2 | 作者撤回条目；公开过的条目改为 `withdrawn`，未公开草稿可物理删除 |
| `/entries/:id/versions/:versionId` | DELETE | D1 + R2 | 作者删除未 approved 版本；approved 版本不物理删，只能随条目撤回 |
| `/entries/:id/comments` | POST | D1 + R2 | 发表评论，随后重建该条目的评论静态页 |
| `/comments/:commentId` | PATCH | D1 + R2 | 作者编辑评论 |
| `/comments/:commentId` | DELETE | D1 + R2 | 作者删除自己的评论；管理员隐藏评论走 `operit-api` |
| `/entries/:id/reactions` | POST | HMAC session + R2 + Analytics Engine | 登录后点赞事件；只读公开 R2 判定条目可见，只写 Analytics，不查 D1 |
| `/assets/:assetId/download` | GET | R2 + Analytics Engine | 记录下载事件后 302 到用户 GitHub asset |

发布请求规则：
- type、title、description、version 必填；`version.formatVersion` 和 `version.minAppVersion` 也必填。
- `POST /publish` 和 `POST /entries/:id/versions` 只接受 `Content-Type: application/json` 的统一 v2 发布 envelope。XML、GitHub Issue body、旧 hidden JSON 都不是新 API 输入，直接返回 `validation_failed`。旧格式只存在于一次性迁移脚本。
- 认证只认 `operit_market_session`。Worker 从 session 解析 publisher，不信请求体里的 `publisherId/login/avatar`。
- categoryId 可选，省略时写 `other`，审核后台提示补分类。
- artifact 类型必须带 asset、sha256、projectId 和 version.runtimePackageId，并通过发布 proof 校验。
- repo_plugin 类型必须带 source 和 repoVersion；不要求 publisher 拥有 repo。Worker 校验 repo 公开可读，upsert repo owner 为 `author_id`，并把当前登录用户写为 `publisher_id`。仓库不可访问、owner 无法确认或 source 已失效时直接 `rejected + repository-unreachable`，不能进入公开 R2。
- repo_plugin 发布时请求体不带 `commitSha`。Worker 解析 `repoVersion.refType/refName` 得到 commit SHA 后写 `repo_plugin_versions`；审核和安装都绑定该 `commit_sha`。
- repo_plugin 的完整 source_url 唯一。`POST /publish` 再次提交同一 source_url 直接拒绝，返回 `duplicate_submission`；已有 entry 的原 publisher 发布新版本必须走 `/entries/:id/versions`。
- 发布新版本走 `POST /entries/:id/versions`，使用和首次发布相同的 version 级结构，但不允许改 `title/description/categoryId/source`。artifact 新版本必须重新提交 `version.runtimePackageId + asset` 并通过新的 proof；Skill/MCP 新版本必须提交 `version + repoVersion`，Worker 重新解析 commit SHA 并创建 `pending` version。已公开 entry 的旧 approved version 继续作为 R2 `latestVersion`，直到新 version 审核通过。
- 修改条目元信息走 `PATCH /entries/:id`，只改 `title/description/categoryId` 等 entry 字段；已公开条目修改后 entry 回到 `pending`，但不创建新的可安装 version。
- artifact 发布 proof：客户端先向 `/publish/proof` 申请短期 proof token，token 内容绑定 `github_id/owner/repo/releaseTag/assetName/sha256/exp/nonce` 并由 `MARKET_SESSION_SECRET` 签名。proof token 格式固定为 `op-proof-v1.<base64url-json-payload>.<base64url-hmac-sha256-signature>`。客户端用本地 GitHub token 把 proof token 写入 release body 的固定隐藏块：

```md
<!-- operit-market-proof
op-proof-v1.<payload>.<signature>
-->
```

`POST /publish` 时 Worker 公开读取 GitHub release body 和 asset 信息，确认 proof token 存在且签名、绑定字段、sha256、有效期全部匹配后才写 D1。CF 不需要保存用户 GitHub token。发布 proof 只支持 release body 固定隐藏块，不支持 proof asset，避免多一条 GitHub 写路径。
- URL host 限于 allowlist。
- 发布后返回 `{ ok: true, entryId, versionId, entryStateCode, versionStateCode }`。
- 作者删除规则：
  - `DELETE /entries/:id` 对公开过的条目只做撤回，状态置为 `withdrawn`，R2 从公开列表/搜索移除，但保留 tombstone 和历史引用。
  - 未公开且无外部引用的草稿/驳回条目可物理删除。
  - `DELETE /entries/:id/versions/:versionId` 只允许删除未 approved version；approved version 只能随整条 entry 撤回。
  - `POST /entries/:id/resubmit` 用于 entry 从 `changes_requested/rejected/withdrawn` 回到 `pending`；重新通过审核前不进入公开 R2。
  - `POST /entries/:id/versions/:versionId/resubmit` 用于 version 从 `changes_requested/rejected` 回到 `pending`；通过审核前不进入公开 R2。

artifact 发布示例：

```jsonc
{ "type":"package", "title":"Example", "description":"...", "categoryId":"dev_code",
  "version": { "version":"1.0.0", "formatVersion":"toolpkg_v2",
    "minAppVersion":"1.2.0", "projectId":"project-uuid", "runtimePackageId":"pkg" },
  "asset": { "kind":"github_release_asset",
    "url":"https://github.com/...", "ghOwner":"alice",
    "ghRepo":"OperitForge", "ghReleaseTag":"tag", "assetName":"pkg.toolpkg", "sha256":"..." } }
```

落表规则：`title/description/category` 写 `market_entries`；`version` 的公共字段和 `runtimePackageId` 写 `market_versions`；`projectId` 写 `artifact_projects`；`asset` 写 `market_assets`。不写 node/root/parent。

repo_plugin 发布示例：

```jsonc
{ "type":"mcp", "title":"Example MCP", "description":"...", "categoryId":"search_research",
  "source": { "kind":"github_repo", "url":"https://github.com/alice/example-mcp/tree/main/packages/server" },
  "repoVersion": { "refType":"branch", "refName":"main", "installConfig":"{...}" },
  "version": { "version":"1.0.0", "formatVersion":"mcp_v2",
    "minAppVersion":"1.2.0" } }
```

落表规则：`title/description/category/author_id/publisher_id` 写 `market_entries`；`version` 的公共字段写 `market_versions`；完整 `source.url` 写 `repo_plugin_specs.source_url`；`repoVersion.installConfig` 和 Worker 解析出的 `commit_sha` 写 `repo_plugin_versions`，不写 `market_assets`。

点赞要求 `operit_market_session` 登录。返回只表示事件已接收：

```json
{ "ok": true, "accepted": true }
```

客户端展示的点赞总数来自 R2 的列表、entry shard 和 `stats/reactions` 静态文件。点赞时只验 HMAC session，并读取公开 R2 entry shard 判断 entry 当前是否可交互；approved 公开 entry 才写 Analytics Engine。这个接口不触发 D1 读写、不调用 GitHub；Analytics Engine 聚合任务定期刷新 `market_reaction_counts` 和 R2。

评论读取走 R2，评论写入走 D1。写入成功后 Worker 同步重建该 entry 的 `comments/{entryId}/page-*.json`、作者私有快照和受影响的评论计数；如果 R2 重建失败，只记录日志，下一次 build cron 从 D1 修复。

下载统计不要求客户端先打详情 API。列表和 entry shard 里同时给出 `asset.url` 和 `downloadUrl` 所需信息；正常下载走 `/assets/:assetId/download` 记录 Analytics Engine 后跳转，异常情况下客户端可以直接使用 GitHub asset URL。

API 错误响应固定为：

```json
{ "ok": false, "error": { "code": "unauthorized", "message": "..." } }
```

客户端只依赖 `error.code`，`message` 仅供展示和调试。固定错误码：

| code | 说明 |
| --- | --- |
| `unauthorized` | 未登录或缺少 Authorization |
| `session_expired` | 市场 session 过期 |
| `rate_limited` | 触发限流 |
| `proof_missing` | 发布 proof 不存在 |
| `proof_invalid` | proof 签名或绑定字段不匹配 |
| `proof_expired` | proof 过期 |
| `duplicate_submission` | 重复提交 |
| `duplicate_reaction` | 重复点赞事件被接收但不增加可信计数 |
| `validation_failed` | 请求字段不合法 |
| `state_invalid` | 当前 entry/version 状态不允许该操作 |
| `not_found` | 目标不存在或不可见 |
| `server_error` | 服务端错误 |

### 6.3 R2 生成和失效

R2 build 从 D1 读取规范化数据，输出公开 JSON。它是物化视图，不是第二套数据模型。

触发条件：
- 手动迁移完成后全量 build。
- entry 审核状态变为 `approved/rejected/changes_requested` 后，重建该 entry、相关列表、搜索分片、manifest 计数。
- version 审核状态变为 `approved/rejected/changes_requested` 后，重建该 entry 所在 shard、versions 列表、相关列表和搜索分片；只有 approved version 进入公开 R2。
- 作者修改 entry 后，重建该 entry 私有影响范围；公开条目重新进入 `pending` 时，从公开列表和搜索索引移除。
- 作者发布新 version 后，只重建作者私有详情；该 version 审核通过前不影响公开 R2 的 `latestVersion`。
- 作者撤回 entry 后，重建该 entry tombstone、公开列表、作者页和搜索索引。
- 作者重新提交 entry 后，状态回到 `pending`，重建该 entry tombstone/作者页，但仍不进入公开列表和搜索。
- 评论新增/编辑/删除后，重建该 entry 的评论页和评论计数。
- Analytics Engine 聚合任务刷新点赞/下载统计后，重建 stats 分片和 `likes` / `downloads` 排序列表。
- 每日 cron 做一次全量校验 build，防止局部重建遗漏。

缓存策略：
- `manifest.json`：短缓存，客户端每次进入市场页可重新校验。
- list/search/stats：中短缓存，允许分钟级延迟。
- entry shard/author：可长缓存，但用 `generatedAt` 和 ETag 让客户端判断是否刷新；公开版本列表内嵌在 entry shard 的 `versions[]`。
- API fallback 读取 R2 时使用同一份缓存头，不额外查 D1。

### 6.4 管理端 API

管理端仍在 `operit-api`，低频直接读写 D1，不走 R2 查询。每个会影响公开展示的动作完成后触发对应 R2 rebuild。

| Endpoint | 方法 | 用途 |
| --- | --- | --- |
| `/admin/market/entries` | GET | 审核队列；按 type、stateCode、categoryId、authorId 筛选 |
| `/admin/market/entries/:id` | GET | 审核详情，含所有版本、原因码、扩展表原始数据 |
| `/admin/market/entries/:id/state` | POST | 设置 entry `state_code`，同时写入/替换 entry reason codes |
| `/admin/market/versions/:versionId/state` | POST | 设置 version `state_code`，同时写入/替换 version reason codes |
| `/admin/market/entries/:id/category` | POST | 修正分类 |
| `/admin/market/entries/:id/curations` | POST/DELETE | 加入或移出精选列表 |
| `/admin/market/comments/:id/state` | POST | 隐藏或恢复评论 |
| `/admin/market/authors` | GET | 作者/发布者列表；按 status、githubId、login 搜索 |
| `/admin/market/authors/:authorId/status` | POST | 设置作者 `active/blocked`，可写入 `author_block` reason code |
| `/admin/market/rebuild/:entryId` | POST | 手动重建单个条目的 R2 文件 |
| `/admin/market/rebuild` | POST | 手动全量重建 R2 |

审核动作只改 D1 的 entry/version 状态和原因码，不直接改 R2 JSON。R2 由 build 层统一生成，避免管理端和公开端各写一套 JSON 结构。

作者封禁动作只改 `market_authors.status/blocked_reason_code/blocked_at/blocked_by`。`blocked_reason_code` 必须属于 `market_reason_codes.scope=author_block`。封禁后：

- 发布、评论、作者私有修改接口返回 `state_invalid`。
- 点赞事件仍可被 Analytics Engine 接收，但聚合可信计数时按 `github_id` 过滤 blocked 作者。
- 公开 R2 不自动下架该作者已通过条目；安全风险、垃圾内容、违规内容仍通过 entry/version/comment 状态单独处理。
- 作者页 R2 需要重建，展示 `status=blocked` 时隐藏交互入口。

## 7. v1 / v2 分离

迁移后旧客户端市场（v1 GitHub Issue）和新客户端市场（v2 Cloudflare）分离运行：

- v1 继续使用四个 GitHub Issue 仓库，旧客户端继续按旧协议浏览、下载、发布。
- v2 使用 D1 作为主库，R2 作为公开读取层，Analytics Engine 记录统计事件。
- 不做自动 Legacy Importer：旧客户端迁移后新发的 Issue 不自动进入 D1 v2。
- 不做自动 Legacy Exporter：v2 审核通过的新条目不自动镜像回 GitHub Issue。
- 不做评论、点赞、状态、原因码的双向同步。
- 一次性迁移脚本可以解析旧 hidden JSON，并把迁移时刻的旧数据写入 D1；迁移完成后该脚本不作为 Worker cron 运行。
- v1 和 v2 后续审核、分类、精选、评论、点赞、统计各自独立。

这样做的代价是旧客户端看不到迁移后 v2 新发布的插件，新客户端也不会自动看到迁移后 v1 新发布的插件。接受这个代价，以换取系统简单、额度可控、状态权威清晰。

## 8. 迁移步骤

### 8.1 第一阶段：建表

1. 创建 D1 `operit_market`，给两个 Worker 加 binding。
2. 执行 migration 建 20 张核心表。
3. 插入 `market_categories`、`market_state_codes`、`market_reason_codes` 初始种子数据。
4. 用 D1 控制台确认表存在，分类、状态码、原因码种子数据存在。

### 8.2 第二阶段：手动迁移

一次性迁移，不是先写自动 importer。

1. 从四个 Issue repo 导出全量 Issue、comments、reactions。
2. 解析 hidden JSON，生成中间 CSV：
   - `entries.csv`、`versions.csv`、`artifact_projects.csv`、`.csv`
   - `repo_plugin_specs.csv`、`repo_plugin_versions.csv`、`assets.csv`、`comments.csv`
   - `reaction_counts.csv`、`entry_reasons.csv`、`version_reasons.csv`
   - `category_review.csv`
3. 人工整理 `category_review.csv`：补 `final_category_id` 和异常备注。
4. 人工处理解析失败、重复项目、缺下载 URL。
5. 把整理后的 CSV 写入 D1。
6. 写迁移报告 JSON 到 R2。
7. 从 D1 生成 `market/v2/*` R2 JSON。
8. 抽样核对：热门项目存在、分类基本覆盖、v2 下载链路无断裂。

### 8.3 第三阶段：v2 后续建设

1. 审核 API 改读写 D1。
2. 发布 API 直接写 D1。
3. 评论、点赞、下载统计走 v2 独立链路。
4. R2 build 按 D1 生成公开 JSON、搜索索引、作者页、评论页和统计覆盖层。
5. 新版 Android / Web 切 v2。

不启动 Legacy Importer / Legacy Exporter，不做 v1/v2 自动同步。

### 8.4 上线顺序

1. D1 schema
2. 手动迁移 → R2 v2 JSON
3. 部署 market-stats（保留旧 JSON）
4. 部署 operit-api 新审核 API
5. 新版 Android / Web 切 v2
6. v1 GitHub Issue 市场继续独立运行

## 9. 安全

- 前后端可以开源，API 地址和字段不作为安全边界。
- GitHub token 只允许出现在 `POST /auth/github`，Worker 只用它调用一次 GitHub `/user` 换取 `operit_market_session`，不保存、不打日志、不写 D1/R2/Analytics。
- 发布、评论、点赞、作者私有页都必须携带 `operit_market_session`。Worker 只信 session 解析出的 `github_id/login/avatar_url`，不信客户端传入的用户字段。
- `operit_market_session` 用 `MARKET_SESSION_SECRET` 做 HMAC 签名，不建 D1 session 表。普通撤销等过期；封禁用户走 `market_authors.status=blocked`；大事故轮换 secret。
- 点赞只读公开 R2、只写 Analytics Engine，不读写 D1、不调用 GitHub。D1 只保存定期聚合后的 `market_reaction_counts`，避免免费额度被刷写接口打爆。
- 评论和发布才写 D1，写入前做 session 校验、频率限制、长度限制和状态检查。
- D1 写入型接口查 `market_authors.status`；blocked 作者不能发布、评论、修改作者私有内容。点赞聚合任务按 `github_id` 过滤 blocked 作者，不把其事件计入可信排序分。
- `github_repo` 类型校验 repo 可公开访问；发布者可以分享/转载公开 repo，不要求拥有仓库。
- repo plugin 公开展示原 GitHub repo owner 为 author，提交市场的人为 publisher/shared by。
- repo plugin 审核和安装绑定发布时解析出的 `commit_sha`。
- `github_release_asset` 类型不靠 CF 保存用户 GitHub token 校验 collaborator；客户端必须用本地 GitHub token 把 Worker 签发的发布 proof token 写入 release body 固定隐藏块，Worker 公开读取 GitHub release body 和 asset 信息校验 proof 后才写 D1。
- 未登录用户只能读公开内容和下载，不能评论、发布、点赞。
- 作者可删自己的评论；管理员可隐藏评论。
- 作者可撤回自己的 entry；公开过的 entry 不物理删除。
- `state_code=rejected/withdrawn` 的 entry 不接受新评论和点赞；点赞接口通过公开 R2 entry shard 判断，不查 D1。非 approved version 不可安装下载。安全风险用 `rejected` 加审核原因表达，不新增安全专用状态。
- 管理后台沿用 `operit-api` 当前权限系统。

## 10. 旧版本答案

老版本用户能继续下载和发布，因为旧 GitHub Issue v1 市场继续存在，旧客户端协议不变。

迁移完成后，v1 和 v2 不再自动同步：

- v1 新发布的 Issue 不自动进入 v2 D1。
- v2 新发布的插件不自动镜像回 v1 Issue。
- 两边评论、点赞、审核状态、原因码互不同步。

这是有意设计，不是遗漏。迁移只负责把某个时间点的旧市场数据整理进 v2，之后两个市场分离演进。
