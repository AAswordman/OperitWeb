# Operit 插件市场接口说明

本文档记录当前 `market-v2` 已实现的公开接口、管理接口和保留的 v1 接口。

## 域名分工

| 域名 | 用途 | 经过 Worker |
| --- | --- | --- |
| `https://static.operit.app` | v2 公开静态读取（列表、entry 分片、manifest、评论页） | 否，直连 R2 |
| `https://api.operit.app` | v2 鉴权、发布、评论写入、点赞、通知、下载统计、审核管理；v1 旧接口 | 是 |

客户端禁止通过 `api.operit.app` 读取静态资源。静态资源一律走 `static.operit.app`，不消耗 Worker 额度。

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

`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小 `100`。

精选不再作为服务端列表或排序。R2 entry payload 内输出 `featured: boolean`，客户端默认开启“精选”本地筛选；用户关闭精选筛选后，仍使用同一套 `updated` / `likes` / `downloads` 静态列表。

列表页的 `items[]` 与 entry 分片的 `entriesById[id]` 使用同一套完整 entry payload；客户端从列表打开详情或 artifact 版本弹窗时，不应再请求 entry 分片。

### 按类型列表

```http
GET /market/v2/lists/type/{type}/{sort}/page-{page}.json
```

`type`：`skill` | `mcp` | `package` | `script`。`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小 `100`。

客户端按 tab 浏览时应使用该接口，不应读取全市场列表后本地过滤。

### 按分类列表

```http
GET /market/v2/lists/category/{categoryId}/{sort}/page-{page}.json
```

`categoryId` 来自 `/market/v2/manifest.json` 的 `categories[].id`。`sort`：`updated` | `likes` | `downloads`，默认 `updated`，页大小 `100`。

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

`allowPublicUpdates` 默认 `true`。开启时，任意登录用户都可以通过 `/entries/{entryId}/versions` 为该条目提交新版本；关闭时只有最初 `publisher` 可以提交新版本。只有最初 `publisher` 可以通过 `PATCH /entries/{entryId}` 修改该开关。

条目归属始终属于 `market_entries.publisher_id` 代表的最初发布者。多人协作署名不另建贡献表，而是由 `versions[].publisher` 派生：每个 version 必须记录实际发布者，客户端和 R2 build 从同一 entry 的版本发布者去重生成贡献者展示。

### 编辑 Entry

```http
PATCH https://api.operit.app/market/v2/entries/{entryId}
Authorization: Bearer <market_session>
```

请求体只允许修改 entry 级字段：`title`、`description`、`detail`、`categoryId`、`allowPublicUpdates`。其中 `allowPublicUpdates` 只有最初发布者可改。该接口不允许修改条目归属或历史版本发布者。

提交成功后，Worker 会将 entry 状态改为 `pending`，该条目需要重新审核；审核通过前不会作为公开条目进入公开列表和公开 entry 分片。

响应：

```json
{
  "ok": true,
  "item": {
    "id": "...",
    "stateCode": "pending"
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

Repo 类（`skill` / `mcp`）请求体：

```json
{
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
    "url": "https://github.com/owner/repo/releases/download/v1.1.0/file.zip",
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

### 撤回 / 重新提交

```http
DELETE https://api.operit.app/market/v2/entries/{entryId}
POST https://api.operit.app/market/v2/entries/{entryId}/resubmit
Authorization: Bearer <market_session>
```

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

读取资产详情，写入下载事件，并由 Worker 代理真实资产流。不需要登录。Worker 对 GitHub release/raw 等白名单上游使用 Cloudflare `fetch` 边缘缓存（`cacheEverything + cacheTtl`），客户端不直接跟随 GitHub 302。下载事件携带由 IP + User-Agent + salt 生成的匿名 `actorHash` 和 UTC 日桶；公开下载量按 `assetId + actorHash + dayBucket` 去重聚合，不在下载入口写 D1。

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
        { "id": "...", "title": "...", "type": "mcp", "relation": "owner", "stateCode": "pending", "categoryId": "...", "updatedAt": "..." }
      ]
    }
  }
}
```

`/my/entries` 只返回当前登录用户对应 `authors[authorId]` 的条目。`relation=owner` 表示该用户是 entry 最初发布者，可编辑、撤回、重新提交；`relation=contributor` 表示该用户为别人归属的 entry 提交过版本，只能从管理页查看详情或继续提交新版本，不能编辑 entry 元信息或撤回 entry。

### 通知

```http
GET https://api.operit.app/market/v2/notifications?limit=50&offset=0&since=...
Authorization: Bearer <market_session>
```

read/unread 由客户端本地维护。

## v2 管理接口（走 api.operit.app）

### 审核

```http
POST https://api.operit.app/market/v2/entries/{entryId}/review/{action}
Authorization: Bearer <admin_token>
```

`action`：`approve` | `reject` | `changes`

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

## v2 定时任务

Worker cron：`0 */6 * * *`

1. `fullBuildIfNeeded`：上次全量构建超过 30 天时触发。
2. `incrementalBuild`：处理 D1 dirty projections。
3. `v1.handleScheduled`：生成旧市场 v1 R2 静态文件。

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
