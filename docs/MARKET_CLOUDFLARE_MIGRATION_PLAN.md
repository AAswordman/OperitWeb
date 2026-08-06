# Operit 市场 V2 设计

本文档描述已部署的市场 V2 实现，不再记录迁移待办。数据库演进以 [migrations](../workers/market/migrations/) 为准，HTTP 字段与示例以 [接口说明](MARKET_API_ENDPOINTS.md) 为准，审核规则见 [审核规范](MARKET_REVIEW_GUIDELINES.md)。

## 范围和事实来源

- Worker 入口：[index.ts](../workers/market/src/index.ts)
- 市场写入、审核与发布校验：[entry.ts](../workers/market/src/entry.ts)
- Store、D1 和 R2 投影：[store/](../workers/market/src/store/)
- 互动和统计聚合：[interact.ts](../workers/market/src/interact.ts)
- GitHub OAuth Broker：[GITHUB_OAUTH_BROKER.md](GITHUB_OAUTH_BROKER.md)

V2 管理 `script`、`package`、`skill` 和 `mcp`。它不是 GitHub Issue 市场的镜像，也不与 V1 自动同步。

## 系统边界

| 组件 | 职责 | 持久化内容 |
| --- | --- | --- |
| `api.operit.app` Worker | 鉴权、发布、审核、评论、反应、下载跳转、构建调度 | 无业务主数据副本 |
| D1 `operit_market` | 市场事务主库、审核状态、dirty projection、统计聚合游标 | 条目、版本、资产、作者、评论、通知、统计 |
| R2 `operit-market-stats-static` | 公开和私有读取投影 | manifest、列表、entry 分片、版本、评论、资产详情、发布者分片 |
| Analytics Engine | 下载和点赞原始事件 | 匿名去重维度与事件时间 |
| GitHub API | 验证发布来源 | 仓库归属、ref 提交、Release 作者和资产 |

公开读取由 `https://static.operit.app/market/v2/` 承载。用户交互和管理员操作由 `https://api.operit.app` 承载。客户端不应把 R2 投影当作写入接口，也不应从 Worker 读取公开列表。

## 领域模型

### 身份和归属

- `market_authors` 以 GitHub numeric id 派生稳定 author id，格式为 `gh_{github_id}`。
- Entry 有最初发布者 `publisher_id` 和内容作者 `author_id`。Repo Entry 的作者是经 GitHub 验证的仓库 owner；Artifact Entry 的作者是 Release 发布者。
- 每个 Version 都记录 `publisher_id`。因此开放更新的 Entry 可以保留原始归属，同时显示实际版本贡献者。
- `allow_public_updates` 决定非最初发布者能否提交 Version；默认开启。

### 内容和版本

- `market_entries` 保存类型、标题、描述、详情、分类、归属和 Entry 状态。
- `market_versions` 保存版本号、格式版本、应用兼容范围、changelog、状态和版本发布者。一个 Entry 内版本号唯一，提交的新版本必须高于已有最高版本。
- `repo_plugin_specs` 保存 GitHub source URL；`repo_plugin_versions` 保存 ref 类型、ref 名称、解析后的 commit SHA 和安装配置。`subdir` 与 `manifest_path` 已不存在。
- `artifact_projects` 按项目键关联 Artifact Entry；`market_assets` 以 Version 为单位保存经 GitHub Release 验证的下载地址、Release 定位、文件名和 SHA-256。
- `market_comments`、`market_notifications`、`market_curations`、`market_reaction_counts` 与 `market_entry_stats` 保存互动和运营数据。

完整 schema 不在本文重复。新增字段或表时必须新增 migration，并同步更新投影 renderer 和接口文档。

## 状态和公开条件

Entry 与 Version 使用 `pending`、`approved`、`changes_requested`、`rejected`、`withdrawn`。

- 首次审核目标是一个 Version。当 Entry 尚无 approved Version 时，审核结论同时作用于 Entry 和该 Version。
- 已公开 Entry 的后续 Version 单独审核，Entry 保持 `approved`。
- 公开投影只输出 `entry.state_code = approved` 的 Entry，并且只输出 `version.state_code = approved` 的 Version 和对应资产。
- Entry 的最初发布者可以撤回 Entry；打回后必须提交修改后的新 Version，不能直接重新提交原 Entry 或 Version。

审核原因写入 `market_version_reasons`，并通过私有发布者投影反馈给对应发布者。审核流程与人工标准见 [审核规范](MARKET_REVIEW_GUIDELINES.md)。

## 写入和投影流程

所有市场写入都通过 `MarketMutation` 执行：

1. `ObjectRegistry` 校验对象类型、操作和字段形状。
2. `D1Backend` 写入主数据并记录 `market_mutation_log`。
3. Store 为受影响的 projection 写入 `market_dirty_projections`。
4. cron 的增量构建器按 dirty projection 重渲染 R2，并清除成功处理的标记。

`MarketStore.apply()` 的公开投影模式是异步，响应中的 `materialization` 表示预期延迟。发布者私有分片和评论分页在需要即时反馈的路径上会额外同步 materialize；公开列表、entry 分片、版本和资产详情等待增量构建或管理员全量构建。

支持的 projection 键：

| Projection | R2 键 |
| --- | --- |
| manifest | `market/v2/manifest.json` |
| list page | `market/v2/lists/{all|type/...|category/...}/{sort}/page-{n}.json` |
| entry shard | `market/v2/entries/{00-ff}.json` |
| entry versions | `market/v2/entries/{entryId}/versions.json` |
| comments page | `market/v2/comments/{entryId}/page-{n}.json` |
| asset detail | `market/v2/assets/{assetId}.json` |
| private publisher shard | `market/v2/private/publishers/{00-ff}.json` |

V2 list renderer 和全量构建当前都以每页 `100` 项生成列表，不读取 `MARKET_RANK_PAGE_SIZE`。列表排序只支持 `updated`、`likes`、`downloads`；精选是 Entry payload 中的 `featured` 标记，而不是独立排序值。

## 发布校验

### Repo 类型：`skill` 与 `mcp`

发布请求必须给出 GitHub source URL 和 `repoVersion.refType`、`repoVersion.refName`。Worker：

- 仅接受 `github.com` 或 `raw.githubusercontent.com` 的 GitHub source URL
- 读取仓库并拒绝非公开仓库
- 将 GitHub 仓库 owner 写为内容作者
- 将 branch、tag 或 commit ref 解析为不可变 commit SHA
- 将安装配置与目标 Version 一起保存

客户端不提交 commit SHA，不能以本地字符串替代 GitHub 验证结果。

### Artifact 类型：`script` 与 `package`

Artifact 发布必须定位到 GitHub Release：`ghOwner`、`ghRepo`、`ghReleaseTag`、`assetName`、`sha256`、项目键和运行时包 ID。Worker 查询 Release 后：

- Release author 必须等于当前市场 session 的 GitHub 身份
- 指定 `assetName` 必须存在
- 保存 GitHub 返回的 canonical `browser_download_url`，不信任客户端给出的下载 URL
- GitHub 返回 SHA-256 metadata 时必须与请求值一致

`POST /market/v2/publish/proof` 仍保留为旧工具接口，但发布与新版本校验不读取 proof token，也不依赖 Release 描述或评论中的 proof 标记。

## 鉴权和安全

### 市场 session

需要用户权限的市场接口使用 `Authorization: Bearer <market_session>`。`POST /market/v2/auth/github` 验证 GitHub access token 并签发短期市场 session；session 只携带签名身份信息，不作为 D1 市场记录保存。

新版应用先走 `/oauth/github/start`、`/oauth/github/callback`、`/oauth/github/complete`、`/oauth/github/claim`。Broker 将 OAuth client secret、PKCE verifier、回调和一次性加密交付记录保留在 Worker 与 D1 中。应用自己准备完成地址、展示授权页并把完成链接交给 Core；Core 校验事务后只 claim 一次。详见 [GitHub OAuth Broker](GITHUB_OAUTH_BROKER.md)。

### 管理员与下载

- 管理接口使用 `Authorization` 或 `x-operit-admin-token`，由 `admin_sessions` 校验 `admin` 或 `reviewer` 角色。
- 下载入口从公开 asset projection 读取地址、记录匿名统计事件并以 `302` 重定向至白名单 GitHub 主机。Worker 不代理二进制流。
- GitHub token、OAuth client secret、session secret、Analytics 查询 token 和管理员 token 都只能作为 Worker secret 或受控环境变量配置，不能进入客户端构建或仓库。

## 互动和统计

- 评论写入 D1，并立即重建受影响的评论页。评论作者或 Entry 最初发布者可以删除评论。
- 点赞和下载只写 Analytics Engine 原始事件；聚合时按事件、Entry、匿名 actor hash 和 UTC 日去重。
- cron 先聚合 Analytics，再执行必要的全量构建，最后处理 dirty projection。聚合后的统计写回 D1，并标脏受影响的 entry/list projection。
- Worker 将 cron 执行日志写入 R2 的 `market/v2/debug/cron/`，用于运维排查。

## 运行和维护

- Worker 名称为 `market-v2`，路由为 `api.operit.app`，cron 为 `0 */6 * * *`。
- 数据库变更按编号添加到 `workers/market/migrations/`，先执行远端 D1 migration，再部署 Worker。
- `POST /market/v2/build` 是管理员全量投影构建入口；`POST /market/v2/admin/incremental-build` 只处理 dirty projection。
- 发布前至少执行 `pnpm build`。测试覆盖位于 `workers/market/test/`。

## V1 边界

未带 `/market/v2/` 前缀的旧市场路由继续由 `old.ts` 处理。V1 与 V2 可以共用 Worker 和基础设施，但不共享条目、审核、评论、点赞或发布流程；不做自动双向同步。

## Entry 元数据与版本审核

`POST /market/v2/entries/{entryId}/versions` 可携带可选 `entry` patch，但只有最初发布者可以提交。服务端将该 patch 暂存到目标 Version，并且只在该 Version 审核通过时应用到 Entry；待审、打回和拒绝不会改变公开元数据。
