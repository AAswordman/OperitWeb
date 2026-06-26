# Operit Market v2 统一底层设计

本文档只定义 Market v2 的底层结构和施工约束。顶层市场语义仍以迁移总文档为准：v1 GitHub Issue 市场和 v2 Cloudflare 市场分离运行，不做自动双向同步；v2 的公开读取尽量走 R2，写入和私有操作才经过 Worker。

## 1. 目标

Market v2 的底层必须同时满足三件事：

1. 统一：发布、审核、评论、点赞聚合、作者页、静态构建都通过同一套 Store 写入和物化，不为某个功能单独开一条 D1/R2 路径。
2. 可扩展：以后新增市场类型、列表、状态、原因码、投放页，不需要复制一套业务代码。
3. 精简：D1 只保存主数据和必要索引；R2 只保存公开读、事件、脏标记和构建产物；业务层不直接操作表、SQL、R2 key。

最终边界：

```text
业务层 -> MarketMutation -> MarketStore.apply()
构建层 -> MarketProjection -> MarketStore.materialize()
公开读 -> R2 静态 JSON
私有读/写 -> Worker -> MarketStore
```

业务层只能认识市场对象和投影，不能认识 D1 表名、SQL、R2 key、dirty key、event key。

## 2. 非目标

v2 不做这些事：

- 不兼容旧客户端协议。
- 不把 GitHub Issue 作为 v2 数据源。
- 不做 v1/v2 自动导入、导出、反向同步。
- 不用 `{ table, op, data }` 形式的 ChangeSet。
- 不让业务层直接 `env.DB.prepare()` 或 `env.R2.put()`。
- 不让公开浏览默认打 Worker/D1。
- 不为 comment、publish、review 各自写一套底层存储。

## 3. 数据边界

D1 是唯一主库，保存可审核、可修复、可重建的规范数据。

R2 是投影层，保存四类对象：

```text
public projection  公开市场 JSON
private projection 私有作者/后台 JSON，可选
mutation event     对象级变更事件，用于审计和修复
dirty marker       等待重建的投影标记
```

Analytics Engine 只记录高频事件，例如下载和点赞点击。D1 不承接每次点赞写入，只保存聚合后的可信计数。点赞要求登录，登录只用于降低刷接口门槛和过滤封禁作者。

D1 和 R2 不共享事务，因此 Store 必须按幂等方式实现：D1 先写，R2 event/dirty 后写；materialize 可重复执行；repair 可以从 D1 最近变更重新推导 dirty。

## 4. MarketStore

底层只暴露两个核心接口：

```js
await store.apply(mutation)
await store.materialize(projection)
```

辅助接口只能服务于构建、修复和测试：

```js
await store.readProjection(projection)
await store.scanDirty(limit)
await store.repair(options)
await store.usage()
```

禁止暴露：

```js
store.commit({ table, op, data })
store.d1.prepare(sql)
store.r2.put(key, value)
store.command('comment.create')
```

`MarketStore` 内部由三层组成：

```text
ObjectRegistry      定义对象类型、字段约束、对象到 D1 的内部映射
ProjectionRegistry  定义投影类型、scope、投影到 R2 key 的内部映射
Backend             D1Backend / R2Backend / AnalyticsBackend
```

业务代码只能创建对象级 mutation，不能绕过 Registry。

## 5. MarketObject

MarketObject 是市场对象，不等于数据库表。一个对象可以落到一张表、多张表，也可以参与多个 R2 投影。

固定对象类型：

```text
Author              GitHub 用户或原作者
Entry               市场条目
Version             条目版本，必须带格式版本和 App 版本限制
RepoSource          repo 型插件来源：skill / mcp
ArtifactProject     package/script 项目簇
ArtifactNode        package/script 节点
Asset               可下载资产或安装入口
Comment             评论
ReactionStat        点赞等聚合统计
Curation            精选/人工列表
ReviewReason        审核原因码绑定
```

对象到 D1 的映射只允许 Store 内部知道。例如：

```text
Entry
  -> market_entries
  -> market_entry_reasons
  -> 影响 list.page / entry.shard / search.shard / private.authorEntries

Version
  -> market_versions
  -> market_version_reasons
  -> repo_plugin_versions 或 artifact_nodes / market_assets
  -> 影响 entry.shard / entry.versions / list.page

RepoSource
  -> repo_plugin_specs
  -> repo_plugin_versions

ArtifactProject + ArtifactNode
  -> artifact_projects
  -> artifact_nodes
  -> 

Comment
  -> market_comments
  -> 影响 comments.page

Curation
  -> market_curations
  -> 影响 featured/manual 列表
```

## 6. MarketMutation

所有写入都用 MarketMutation 表达。

```js
{
  type: 'mutation',
  id: 'mut_...',
  actor: {
    authorId: 'gh_123',
    role: 'publisher | admin | system'
  },
  reason: 'comment.created',
  objects: [
    {
      kind: 'Comment',
      operation: 'create',
      id: 'comment_...',
      value: {}
    }
  ],
  effects: [
    {
      projection: 'comments.page',
      scope: { entryId: 'entry_...', page: 1 }
    }
  ]
}
```

`operation` 只允许：

```text
create
update
hide
withdraw
approve
reject
request_changes
aggregate
```

对象变化必须带 `id`，mutation id 必须幂等。同一个 mutation 重放时不能重复插入评论、重复加计数或重复制造脏标记。

## 7. MarketProjection

Projection 是 R2 输出的统一表达，不是文件路径。

```js
{
  projection: 'list.page',
  scope: {
    list: { type: 'mcp', categoryId: 'dev_code' },
    sort: 'updated',
    page: 1
  }
}
```

固定投影：

```text
manifest
list.page
entry.shard
entry.versions
comments.page
search.manifest
search.shard
asset.detail
private.authorEntries
private.authorEntry
```

Projection 到 R2 key 的映射只存在于 `ProjectionRegistry`。业务层不能拼接 `market/v2/...`。

公开 R2 输出约定：

```text
market/v2/manifest.json
market/v2/lists/all/{sort}/page-{page}.json
market/v2/lists/featured/manual/page-{page}.json
market/v2/lists/type/{type}/{sort}/page-{page}.json
market/v2/lists/category/{categoryId}/{sort}/page-{page}.json
market/v2/lists/type/{type}/category/{categoryId}/{sort}/page-{page}.json
market/v2/entries/{shard}.json
market/v2/entries/{entryId}/versions.json
market/v2/comments/{entryId}/page-{page}.json
market/v2/search/manifest.json
market/v2/search/shards/{shardId}.json
market/v2/assets/{assetId}.json
```

列表页必须包含打开详情所需的主要信息。客户端从列表打开详情时不再逐条请求详情；外链直达、作者页跳转或缓存缺失时，客户端用 entryId 计算 256 分片，读取 `entries/{shard}.json` 后从 `entriesById[entryId]` 取完整 bundle。

## 8. 客户端读取

公开读默认直接访问 R2：

```text
进入市场：
GET staticBase/manifest.json
GET staticBase/lists/all/updated/page-1.json

切换类型：
GET staticBase/lists/type/{type}/updated/page-1.json

切换分类：
GET staticBase/lists/category/{categoryId}/updated/page-1.json

类型 + 分类：
GET staticBase/lists/type/{type}/category/{categoryId}/updated/page-1.json

打开列表内详情：
0 次额外请求，使用 list item 内的 detail bundle

外链详情 / 作者页直达：
GET staticBase/entries/{shard}.json
读取 entriesById[entryId]

查看版本：
GET staticBase/entries/{entryId}/versions.json

展开评论：
GET staticBase/comments/{entryId}/page-1.json

搜索：
GET staticBase/search/manifest.json
GET staticBase/search/shards/{shardId}.json
```

需要 Worker 的路径：

```text
POST /market/v2/auth/github
POST /market/v2/publish
POST /market/v2/entries/{entryId}/versions
POST /market/v2/comments
PATCH /market/v2/comments/{commentId}
DELETE /market/v2/comments/{commentId}
POST /market/v2/reactions
GET  /market/v2/me/entries
GET  /market/v2/me/entries/{entryId}
POST /market/v2/assets/{assetId}/download
```

管理后台接口仍由管理员 Worker 承担，但必须调用同一套 MarketStore。

## 9. 类型和格式

市场类型固定由 `market_types` 承载：

```text
script
package
skill
mcp
```

新增市场类型时，只新增类型配置、对象映射和 renderer 需要的字段，不复制 API。

格式版本由 `market_format_versions` 承载。每个 Version 必须明确：

```text
format_ver
min_app_ver
max_app_ver
```

v2 发布格式必须是统一 manifest，不再使用旧 Issue hidden JSON 或 XML。旧格式只允许迁移脚本读取，不能成为 v2 发布接口。

repo 型插件：

```text
skill / mcp
  source_url
  repo_owner
  repo_name
  subdir
  commit_sha
```

`commit_sha` 必须在发布或更新时解析并绑定。repo 里有多个插件不允许用同一个提交记录混发；一个提交对应一个市场条目版本。

artifact 型插件：

```text
script / package
  ArtifactProject
  ArtifactNode
  Asset
```

项目簇、节点和边必须作为结构化对象保存，不能塞进 Entry 的 JSON 字段里。

## 10. 状态和原因

状态使用 `market_state_codes`，原因使用 `market_reason_codes`。Entry 和 Version 都引用状态码，审核原因通过绑定表表达。

基础状态：

```text
pending             待审核
approved            公开展示
changes_requested   要求修改
rejected            拒绝
withdrawn           发布者撤回
```

旧 Issue 的 open/closed/tag 在一次性迁移时转换为状态码和原因码：

```text
open + 无拒绝/打回 label        -> pending 或 approved，按迁移人工结果决定
closed + changes-requested      -> changes_requested
closed + rejected               -> rejected
reason:*                        -> market_reason_codes
market:featured                 -> Curation
```

旧 Issue 的 close 本身不是 v2 状态；它只作为迁移判断信号。v2 不保存 legacy issue id，也不做评论、点赞、状态反向同步。

状态和原因必须进入 R2 投影，客户端不需要再理解 GitHub label。

## 11. 作者、登录和封禁

作者表必须保留：

```text
github_id
github_login
owner_avatar
status
blocked_reason_code
```

登录流程：客户端本地持有 GitHub token，只在 `POST /auth/github` 时发给 Worker 一次。Worker 调 GitHub `/user` 换取用户身份，签发 `operit_market_session`，不保存、不记录、不返回 GitHub access token。

Session 用 HMAC 签名，不建 D1 session 表。普通撤销等过期；大事故轮换 secret；封禁走 `market_authors.status=blocked`。

要求登录的操作：

```text
发布
更新版本
评论
删除/编辑自己的评论
点赞
作者私有页
```

未登录用户只能公开浏览和下载。写入型接口必须检查作者状态；blocked 作者不能发布、评论、点赞或修改私有内容。点赞聚合也要过滤 blocked 作者。

## 12. 发布和审核

发布者可以分享/转载公开 GitHub repo。repo 的原 owner 是资产原作者，提交市场的人是 publisher。

发布写入流程：

```text
校验 session
校验作者未封禁
校验 manifest
解析 repo/release/commit
生成 Entry / Version / Source / Asset 对象
MarketStore.apply(publish mutation)
返回 pending
```

审核写入流程：

```text
管理员操作
生成 Entry / Version / ReviewReason / Curation mutation
MarketStore.apply(review mutation)
标记受影响投影 dirty
```

审核通过后对应版本才能安装下载。被拒绝、撤回或要求修改的 entry/version 不进入公开列表。

## 13. 评论、点赞、下载

评论写 D1，但不触发全量 build。评论创建、编辑、删除只标记对应 `comments.page` dirty；局部 materialize 后写 R2 评论页。

点赞要求登录，但每次点击不写 D1。点赞事件写 Analytics Engine 或等价事件流，定期聚合为 `ReactionStat` 对象，再由 Store 写入 D1 和 R2 投影。公开排序使用聚合结果，不依赖实时 D1 写入。

下载事件走 Worker，因为需要统计和 redirect。下载统计写 Analytics Engine，公开计数由聚合任务更新投影。非 approved version 或不可下载 asset 不允许跳转。

## 14. R2 构建

构建分两类：

```text
局部 materialize：根据 dirty marker 重建少量 projection
全量 repair：从 D1 重新推导并覆盖全部公开 projection
```

普通交互只做局部构建。全量 repair 只用于迁移后初始化、结构变更、数据修复和定期校验，不作为每次写入后的路径。

Materializer 必须统计：

```text
D1 read rows
D1 write rows
R2 read ops
R2 write ops
R2 delete ops
R2 list ops
projection count
elapsed ms
```

本地测试必须使用 SQLite 文件和本地 R2 目录/模拟桶，不能只用内存 Map 证明通过。

## 15. 本地测试要求

施工完成前至少要有这些测试：

1. 加载 `migrations/001_init.sql` 到本地 SQLite。
2. `MarketStore.apply(Comment.create)` 写入真实 SQLite 的 `market_comments`。
3. 同一次 mutation 写入 R2 event 和 dirty marker。
4. `MarketStore.materialize(comments.page)` 从 SQLite 读取并写出本地 R2 JSON。
5. publish mutation 能写 Entry / Version / RepoSource 或 ArtifactProject 结构。
6. review mutation 能把状态和原因码写入 D1，并影响公开列表投影。
7. list projection 输出 detail bundle，客户端打开详情不需要额外请求。
8. migration 样本能把 open/close/tag/reason/featured 转为 v2 状态、原因和精选。
9. usage 统计能输出 D1/R2 操作量，便于估算 Cloudflare 免费额度。

## 16. 代码结构

推荐结构：

```text
workers/market/v2/src/
  index.js                 路由入口
  auth.js                  GitHub 登录和 session
  entry.js                 发布、更新、作者私有页
  interact.js              评论、点赞、下载
  static.js                公开 R2 代理/健康检查，可选
  old.js                   v1 旧端点独立保留，不进入 v2 Store

  store/
    MarketStore.js
    model/
      MarketObject.js
      MarketMutation.js
      MarketProjection.js
    registry/
      ObjectRegistry.js
      ProjectionRegistry.js
      EffectRegistry.js
    backend/
      D1Backend.js
      R2Backend.js
      AnalyticsBackend.js
    renderers/
      manifest.js
      listPage.js
      entryBundle.js
      entryVersions.js
      commentsPage.js
      searchShard.js
      assetDetail.js
      privateAuthor.js

  translators/
    comment.js
    publish.js
    review.js
    reaction.js
```

`old.js` 可以存在，但它是 v1 市场端点，不得调用 v2 Store，也不得成为 v2 兼容层。

## 17. 施工顺序

1. 删除表级 ChangeSet：移除 `Store.commit({ table, op, data })` 和相关 translator。
2. 建立 `MarketStore.apply()` 和 `MarketStore.materialize()`。
3. 建立 ObjectRegistry，把对象操作映射到 D1Backend。
4. 建立 ProjectionRegistry，把 projection 映射到 renderer 和 R2Backend。
5. 先接评论：Comment mutation、event、dirty、comments.page 局部构建。
6. 再接发布：Entry / Version / RepoSource / ArtifactProject / Asset mutation。
7. 再接审核：状态码、原因码、精选列表 mutation。
8. 接点赞聚合和下载统计：高频事件不直接写 D1。
9. 跑本地 SQLite + 本地 R2 测试，输出 usage 统计。
10. 用迁移样本验证状态、原因、分类、精选和公开 R2 输出。

完成标准：业务层没有 D1 表名、SQL、R2 key；公开读可以直接走 R2；写入都通过对象级 mutation；本地测试证明 SQLite 和 R2 文件都发生了真实写入。
