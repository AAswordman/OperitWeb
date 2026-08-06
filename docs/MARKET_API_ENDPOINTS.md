# Operit 插件市场接口说明

本文档记录当前 `market-v2` 已实现的公开接口、管理接口和保留的 v1 接口。

## 域名分工

| 域名 | 用途 | 经过 Worker |
| --- | --- | --- |
| `https://static.operit.app` | v2 公开静态读取（列表、entry 分片、manifest、评论页） | 否，直连 R2 |
| `https://api.operit.app` | v2 鉴权、发布、评论写入、点赞、通知、下载统计、审核管理；v1 旧接口 | 是 |

客户端禁止通过 `api.operit.app` 读取静态资源。静态资源一律走 `static.operit.app`，不消耗 Worker 额度。

`static.operit.app` 是 `operit-market-stats-static` 的 R2 自定义域名。该 bucket 的 CORS
规则由 [`r2-cors.json`](../workers/market/r2-cors.json) 声明，并允许任意来源读取公开静态
JSON；R2 CORS 不承担访问控制，因为对象已通过该公开域名直接提供。

## 鉴权

### v2 用户会话

需要用户登录的接口使用：

```text
Authorization: Bearer <market_session>
```

`market_session` 通过 GitHub token 换取：

```http
POST https://api.operit.app/market/v2/auth/github
Authorization: Bearer <github_access_token>
```

返回：

```json
{
  "ok": true,
  "session": "...",
  "githubId": 123,
  "login": "user",
  "avatarUrl": "https://..."
}
```

- GitHub token 只在登录换 session 时发送给 Worker。
- Worker 校验 GitHub 用户后签发市场 session，不保存、不打日志、不写 D1/R2/Analytics。
- 后续发布、评论、点赞等接口使用市场 session。
- 新版客户端先通过 `/oauth/github/*` Broker 取得 GitHub access token；该流程将 OAuth secret 和授权码交换保留在 Worker。详情见 [GitHub OAuth Broker](GITHUB_OAUTH_BROKER.md)。

### v2 管理员鉴权

审核、精选、构建等管理接口使用管理员 token：

```text
Authorization: Bearer <admin_token>
```
或：
```text
x-operit-admin-token: <admin_token>
```

对接 `operit-api` 的 `admin_sessions`，角色要求 `admin` 或 `reviewer`。

## v2 静态读取接口（全部走 static.operit.app）

以下接口由 R2 静态 JSON 承载，客户端直接读 `https://static.operit.app`，不经过 Worker。

### 市场清单

```http
GET /market/v2/manifest.json
```

### 全市场列表

```http
GET /market/v2/lists/all/{sort}/page-{page}.json
```

`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小固定为 `100`。

精选不再作为服务端列表或排序。R2 entry payload 内输出 `featured: boolean`，客户端默认开启“精选”本地筛选；用户关闭精选筛选后，仍使用同一套 `updated` / `likes` / `downloads` 静态列表。

列表页的 `items[]` 与 entry 分片的 `entriesById[id]` 使用同一套完整 entry payload；客户端从列表打开详情或 artifact 版本弹窗时，不应再请求 entry 分片。

### 按类型列表

```http
GET /market/v2/lists/type/{type}/{sort}/page-{page}.json
```

`type`：`skill` | `mcp` | `package` | `script`。`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小固定为 `100`。

客户端按 tab 浏览时应使用该接口，不应读取全市场列表后本地过滤。

### 按分类列表

```http
GET /market/v2/lists/category/{categoryId}/{sort}/page-{page}.json
```

`categoryId` 来自 `/market/v2/manifest.json` 的 `categories[].id`。`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小固定为 `100`。

### 按类型 + 分类列表

```http
GET /market/v2/lists/type/{type}/category/{categoryId}/{sort}/page-{page}.json
```

`type`：`skill` | `mcp` | `package` | `script`。`categoryId` 来自 manifest。`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小 `100`。

客户端进入某个分类的单独界面后，类型筛选应使用该接口，不应读取分类全量后本地过滤。

### Entry 分片

```http
GET /market/v2/entries/{shard}.json
```

`shard` 为 entryId hash 前两位（`00`-`ff`）。

返回 `entriesById` map，用于从作者页、通知等场景按 id 查 entry。

列表页 `items[]` 和 entry 分片 `entriesById[id]` 必须保持同一 entry 结构。每个 entry 内嵌公开 `approved` 的 `versions[]`，并按 `publishedAt` 降序排列。`latestVersion` 等于 `versions[0]`。Repo 类 entry（`skill` / `mcp`）的 `versions[].installConfig` 保存对应版本的安装配置；`changelog` 只表示版本更新说明。Artifact 类 entry（`script` / `package`）以 `versions[]` 作为唯一版本表；`versions[].runtimePackageId` 是安装和本地冲突判断所需的运行时包 ID。客户端用 `assets[].versionId` 精确关联 `versions[].id` 获取下载资产，不存在 node/root/parent 概念。`featured` 是客户端本地筛选用标记，不对应 `/lists/all/featured/...` 静态列表。

### 评论分页

```http
GET /market/v2/comments/{entryId}/page-{page}.json
```

页大小 `50`。评论页静态对象不存在时可返回 404，客户端应按空评论列表处理。

## v2 交互接口（走 api.operit.app）

### 发布

```http
POST https://api.operit.app/market/v2/publish
Authorization: Bearer <market_session>
```

Repo 类（`skill` / `mcp`）提交完整可安装定位：

```json
{
  "type": "mcp",
  "title": "...",
  "description": "...",
  "categoryId": "search_research",
  "allowPublicUpdates": true,
  "source": { "kind": "github_repo", "url": "https://github.com/owner/repo/tree/main/path" },
  "repoVersion": { "refType": "branch", "refName": "main", "installConfig": "{...}" },
  "version": { "version": "1.0.0", "formatVer": "mcp_v2", "minAppVer": "1.2.0" }
}
```

`source.url` 是唯一安装定位来源，允许 GitHub repo / tree / blob / raw URL；不再存在 `subdir` 字段。Worker 用 `repoVersion.refType/refName` 解析并保存内部 `commitSha`，客户端不提交 `commitSha`。

Repo 类条目必须能公开访问并确认 GitHub repo owner；仓库不可访问、owner 无法确认或 source 已失效时直接拒绝，返回/记录 `repository-unreachable`，不能进入公开 R2。

Artifact 类提交以 `ghOwner`、`ghRepo`、`ghReleaseTag`、`assetName` 和 `sha256` 定位 Release 资产。Worker 验证 Release author 等于当前市场身份后保存 GitHub 返回的 canonical `browser_download_url`；客户端传入的 `asset.url` 不参与接受判定，也不应作为下载来源。

每次发布会在响应结束后写入调试日志：

```text
GET https://static.operit.app/market/v2/debug/publish/latest.json
GET https://static.operit.app/market/v2/debug/publish/{timestamp}-{requestId}.json
```

日志记录请求总耗时，以及 session、GitHub Release 校验、D1 mutation、publisher shard 物化等阶段耗时；不记录 Authorization header、GitHub token 或请求体内容。日志写入通过 Worker `waitUntil` 调度，不参与发布响应时间。

`allowPublicUpdates` 默认 `true`。开启时，任意登录用户都可以通过 `/entries/{entryId}/versions` 为该条目提交新版本；关闭时只有最初 `publisher` 可以提交新版本。只有最初 `publisher` 可以通过 `PATCH /entries/{entryId}` 修改该开关。

条目归属始终属于 `market_entries.publisher_id` 代表的最初发布者。多人协作署名不另建贡献表，而是由 `versions[].publisher` 派生：每个 version 必须记录实际发布者，客户端和 R2 build 从同一 entry 的版本发布者去重生成贡献者展示。

### 编辑 Entry

```http
PATCH https://api.operit.app/market/v2/entries/{entryId}
Authorization: Bearer <market_session>
```

请求体只允许修改 entry 级字段：`title`、`description`、`detail`、`categoryId`、`allowPublicUpdates`。其中 `allowPublicUpdates` 只有最初发布者可改。该接口不允许修改条目归属或历史版本发布者。

该接口只更新 Entry 元数据，不创建 Version，也不改变现有 Entry 状态。投影会异步刷新；已公开 Entry 的元数据更新会在下一次对应 projection materialize 后反映到公开读取层。

响应：

```json
{
  "ok": true,
  "item": {
    "id": "...",
    "stateCode": "approved"
  },
  "stats": {}
}
```

### 发布新版本

```http
POST https://api.operit.app/market/v2/entries/{entryId}/versions
Authorization: Bearer <market_session>
```

当 entry 的 `allowPublicUpdates=true` 时，任意登录用户都可以为该 entry 提交新版本；关闭时只有最初 `publisher` 可以提交。新版本号必须大于该 entry 已有版本号，否则返回 `version_conflict`。新版本初始状态为 `pending`，审核通过后才会进入公开 entry 的 `versions[]` 和 `latestVersion`。

请求体可选携带 `entry` patch，用于随版本提交 Entry 级元信息。`entry` 只允许包含 `title`、`description`、`detail`、`categoryId`、`allowPublicUpdates`，且只能由最初 `publisher` 提交。该 patch 会保存在待审 Version 上；只有该 Version 审核通过时才会写入公开 Entry。打回、拒绝和待审期间都不会修改已公开 Entry，也不会自动将 Entry 状态改为 `pending`。

Repo 类（`skill` / `mcp`）请求体：

```json
{
  "entry": {
    "description": "...",
    "detail": "..."
  },
  "version": {
    "version": "1.1.0",
    "formatVer": "mcp_v2",
    "minAppVer": "1.2.0",
    "maxAppVer": "2.0.0",
    "changelog": "..."
  },
  "repoVersion": {
    "refType": "tag",
    "refName": "v1.1.0",
    "installConfig": "{...}"
  }
}
```

Artifact 类（`script` / `package`）请求体：

```json
{
  "entry": {
    "description": "...",
    "detail": "..."
  },
  "version": {
    "version": "1.1.0",
    "formatVer": "script_v2",
    "minAppVer": "1.2.0",
    "maxAppVer": "2.0.0",
    "changelog": "...",
    "projectId": "...",
    "runtimePackageId": "..."
  },
  "asset": {
    "kind": "github_release_asset",
    "ghOwner": "owner",
    "ghRepo": "repo",
    "ghReleaseTag": "v1.1.0",
    "assetName": "file.zip",
    "sha256": "..."
  }
}
```

响应：

```json
{
  "ok": true,
  "entryId": "...",
  "versionId": "...",
  "stats": {}
}
```

### 撤回

```http
DELETE https://api.operit.app/market/v2/entries/{entryId}
Authorization: Bearer <market_session>
```

打回后的条目不能直接重新提交。作者必须修改后通过“提交新版本”接口重新进入审核队列：

```http
POST https://api.operit.app/market/v2/entries/{entryId}/versions
Authorization: Bearer <market_session>
```

`version.version` 必须高于该条目的现有版本；包体、最低客户端版本、变更说明和可修改的条目元信息都应随新版本提交。

### 评论

```http
POST   https://api.operit.app/market/v2/entries/{entryId}/comments # 发表评论
PATCH  https://api.operit.app/market/v2/comments/{id}               # 编辑评论
DELETE https://api.operit.app/market/v2/comments/{id}               # 删除评论
Authorization: Bearer <market_session>
```

### 点赞

```http
POST https://api.operit.app/market/v2/entries/{entryId}/reactions
Authorization: Bearer <market_session>
```

写入 Analytics Engine，不写 D1。事件内只携带匿名 `actorHash` 和 UTC 日桶，聚合时按 `entryId + actorHash + dayBucket` 去重后计入公开点赞数，避免重复点击刷榜。

聚合任务会将 Analytics Engine 中的点赞事件写入 `market_reaction_counts`，并刷新 v2 entry/list 静态 JSON。

### 下载资产

```http
GET https://api.operit.app/market/v2/assets/{assetId}/download
```

读取资产详情，写入下载事件，并以 `302` 跳转到白名单 GitHub 下载地址。不需要登录。响应携带 asset id、SHA-256 和文件名 header；Worker 不代理二进制流。下载事件携带由 IP + User-Agent + salt 生成的匿名 `actorHash` 和 UTC 日桶；公开下载量按 `assetId + actorHash + dayBucket` 去重聚合，不在下载入口写 D1。

### 用户已发布条目

```http
GET https://api.operit.app/market/v2/my/entries?type={type}
Authorization: Bearer <market_session>
```

Worker 鉴权后读取私有静态分片：

```http
GET /market/v2/private/publishers/{shard}.json
```

该静态文件内部按作者分桶，避免不同作者 hash 到同一个 `{shard}` 时串列表：

```json
{
  "ok": true,
  "marketVersion": 2,
  "shard": "46",
  "authors": {
    "gh_1001": {
      "entries": [
        { "id": "...", "title": "...", "type": "mcp", "relation": "owner", "stateCode": "changes_requested", "categoryId": "...", "updatedAt": "...", "reasonCodes": ["metadata-incomplete"], "reviewDetail": "请补齐缺失字段后重新提交。", "reviewDetailUpdatedAt": "2026-08-04T12:00:00.000Z" }
      ]
    }
  }
}
```

`/my/entries` 只返回当前登录用户对应 `authors[authorId]` 的条目，一行仍代表一个 entry。`id`、`title`、`type`、`categoryId` 来自 entry；`stateCode`、`reasonCodes`、`updatedAt` 来自该作者在该 entry 下最新提交的 version。这样同一 entry 下不同作者的新版本审核状态互不覆盖。发布和审核会在对应的 R2 publisher shard 内增量更新该 entry，不会扫描该作者的历史条目。`relation=owner` 表示该用户是 entry 最初发布者，可编辑元信息和撤回；`relation=contributor` 表示该用户为别人归属的 entry 提交过版本，只能从管理页查看详情或继续提交新版本，不能编辑 entry 元信息或撤回 entry。

`reasonCodes` 只在该作者最新 version 存在审核原因时返回，取值来自 `market_reason_codes.code`；`pending`、`approved`、`withdrawn` 默认不返回该字段。客户端必须用该字段在私有管理页和修订版提交入口展示打回/拒绝原因。

`revisionAvailableAt` 仅在该作者最新 version 为 `changes_requested` 时返回，表示打回后允许提交修改版新版本的时间。当前冷却期为 12 小时，由服务端强制执行；冷却期间提交 `POST /entries/{entryId}/versions` 会得到 HTTP `429`、错误码 `revision_cooldown`，并在 `error.retryAt` / `error.retryAfterSeconds` 返回重试时间。该限制只针对被打回的投稿，不影响已通过版本的普通版本发布。

`reviewDetail` 是审核人写入该作者最新 version 的具体说明，最长 4000 字符，仅出现在私有 publisher shard 和管理员审核详情；`reviewDetailUpdatedAt` 是其最后更新时刻。客户端应将说明与原因码一起展示给投稿者，且按 Markdown 渲染前做好常规内容安全处理。

### 作者条目详情

```http
GET https://api.operit.app/market/v2/my/entries/{entryId}/detail
Authorization: Bearer <market_session>
```

仅当当前用户是条目发布者或在该条目下提交过版本时可读。响应的 `item` 包含该用户最近提交版本、版本审核状态、仓库配置、包项目和对应资源，用于预填“修改后提交新版本”表单；不会进入公开静态条目分片。

### 通知

```http
GET https://api.operit.app/market/v2/notifications?limit=50&offset=0&since=...
Authorization: Bearer <market_session>
```

read/unread 由客户端本地维护。

响应体：

```json
{
  "ok": true,
  "items": [
    {
      "id": "notif-1719687600000-abc123",
      "kind": "review_approved",
      "entryId": "mcp-example-plugin",
      "commentId": null,
      "actorId": "owner",
      "title": "\"Example Plugin\" approved",
      "body": "Your plugin \"Example Plugin\" was approved by a reviewer.",
      "createdAt": "2026-06-30T13:16:20.847Z"
    }
  ]
}
```

`kind` 枚举：`comment_new` | `comment_reply` | `review_approved` | `review_rejected` | `review_changes` | `entry_curated`

| kind | 触发场景 | 接收者 |
| --- | --- | --- |
| `comment_new` | 有人在你的 entry 下发表了新评论 | entry 发布者 |
| `comment_reply` | 有人回复了你的评论 | 被回复的评论作者 |
| `review_approved` | 审核台通过了你的 entry | entry 发布者 |
| `review_rejected` | 审核台拒绝了你的 entry | entry 发布者 |
| `review_changes` | 审核台要求修改 entry | entry 发布者 |
| `entry_curated` | entry 被列入精选 | entry 发布者 |

## v2 管理接口（走 api.operit.app）

### 审核

```http
POST https://api.operit.app/market/v2/entries/{entryId}/review/{action}
Authorization: Bearer <admin_token>
```

`action`：`approve` | `reject` | `changes`

请求体：

```json
{
  "entryId": "...",
  "versionId": "...",
  "reasonCode": "quality-too-low",
  "reviewDetail": "说明实际发现的问题、受影响内容和作者需采取的修正措施。"
}
```

`entryId` 与路径中的 `{entryId}` 必须一致；`versionId` 必填，且必须属于当前 entry。`reject` / `changes` 必须携带 `reasonCode`，取值来自 `market_reason_codes.code`。`reviewDetail` 为可选字符串，去除首尾空白后最长 4000 字符；审核台在 `reject` / `changes` 时要求填写。它会存储为版本级私有审核说明，并在 `GET /market/v2/admin/review/entries/{entryId}` 的对应 `versions[]` 元素中返回为 `reviewDetail` 和 `reviewDetailUpdatedAt`。

审核动作以 version 为明确目标：

- 首发审核：entry 尚未公开，且没有公开 approved version 时，`approve` / `reject` / `changes` 同时更新 entry 与目标 version。
- 已上架簇的新版本审核：entry 当前为 `approved`，且已存在 approved version 时，`approve` / `reject` / `changes` 只更新目标 version，entry 保持 `approved`。
- 同一 entry 下存在多个待审 version 时，审核台必须分别提交对应 `versionId`；后端不接受缺少 `versionId` 的审核请求。

公开 R2 列表、entry 分片和资产详情只展示 `entry.state_code = approved` 且至少存在一个 `market_versions.state_code = approved` 的内容；公开 `versions[]`、`latestVersion` 和 `assets[]` 只来自 approved version。

### 管理员下架并封禁作者

```http
POST https://api.operit.app/market/v2/admin/entries/{entryId}/moderation
Authorization: Bearer <admin_token>
```

请求体：

```json
{
  "entryId": "...",
  "authorId": "gh_1001",
  "action": "withdraw_and_block",
  "reasonCode": "author-policy-violation"
}
```

仅管理员和审核员可调用。`entryId` 必须与路径一致，`authorId` 必须与条目的最初发布者一致。操作会将该条目标为 `withdrawn`，把发布者标为 `blocked`，记录封禁原因、时间和执行人，并立即触发相关公开列表、entry 分片和作者私有条目的重建。支持的封禁原因码为 `author-spam`、`author-abuse`、`author-malicious-publish` 和 `author-policy-violation`。

### 精选

```http
POST https://api.operit.app/market/v2/entries/{entryId}/curation
Authorization: Bearer <admin_token>
```

请求体：

```json
{ "entryId": "...", "listKey": "featured", "position": 1 }
```

取消精选：

```json
{ "entryId": "...", "listKey": "featured", "position": 1, "operation": "hide" }
```

### 构建触发

```http
POST https://api.operit.app/market/v2/build           # v2 全量构建
POST https://api.operit.app/market/v2/admin/v1-rebuild # v1 R2 重建
Authorization: Bearer <admin_token>
```

### 审核队列

```http
GET https://api.operit.app/market/v2/admin/review/entries?stateCode={code}&limit=50&offset=0
Authorization: Bearer <admin_token>
```

返回 `items[]` 是待审核 version 行，每行携带 entry 摘要和目标 `version`：

```json
{
  "id": "entry-id",
  "title": "...",
  "stateCode": "approved",
  "version": {
    "id": "version-id",
    "entryId": "entry-id",
    "version": "1.2.0",
    "stateCode": "pending",
    "publisherId": "gh_1001"
  }
}
```

`stateCode` 查询参数筛选的是 `market_versions.state_code`。未传时返回所有非 `approved`、非 `withdrawn` 的 version。审核台必须用 `version.id` 提交审核动作；同一 entry 有多个待审 version 时会返回多行。

## v2 定时任务

Worker cron：`0 */6 * * *`

1. `aggregateV2Analytics`：聚合延迟窗口内的下载和点赞事件，并标脏相关投影。
2. `fullBuildIfNeeded`：上次全量构建超过 30 天时触发。
3. `incrementalBuild`：处理 D1 dirty projections。

## v1 保留接口（走 api.operit.app）

旧客户端继续使用，不经过 `/market/v2` 前缀。

```http
GET  /health
GET  /download?type={type}&id={id}&target={url}
GET  /like?type={type}&id={id}
GET  /manifest.json
GET  /stats.json
GET  /stats/{type}.json
GET  /rank/{type}-{metric}-page-{page}.json
GET  /artifact-rank/{type}-{metric}-page-{page}.json
GET  /artifact-projects/{projectId}.json
GET  /agent/search?q={query}&type={type}&limit={limit}
GET  /agent/items/{type}/{id}
GET  /agent/items/{type}/{id}/install-plan
```

`/download` 与 `/like` 均写入 Analytics Engine；旧市场定时构建聚合后刷新 `stats` / `rank` 静态 JSON。
