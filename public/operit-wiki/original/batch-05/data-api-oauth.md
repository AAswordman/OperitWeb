---
title: OAuth 与外部 API 客户端
module: 数据层
sources: CodexAuthManager.kt, CodexOAuthClient.kt, CodexUsageClient.kt, GitHubApiService.kt, GitHubOAuthBrokerService.kt, MarketStatsApiService.kt, CodexLoginDialog.kt, GitHubLoginDialog.kt, GitHubOAuthBrowserSession.kt, GitHubOAuthLoopbackCallbackServer.kt
date: 2026-10-01
---

# OAuth 与外部 API 客户端

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲 Operit 怎么跟"别人家的账号和服务"打交道，共有三条线：

1. **Codex 登录**：走 OAuth 授权码 + PKCE 流程，让用户登录自己的 ChatGPT 账号，拿到 token 后调用 Codex 模型。token 存加密库，过期自动刷新。
2. **GitHub 登录**：App 不直接持有 GitHub 的 client_secret，而是经 Operit 自建的 broker（中转服务）完成 OAuth，拿到 token 后调用 GitHub API：查用户信息、搜仓库、创建 Release、上传附件。
3. **应用市场客户端**：用 GitHub 身份换一张市场会话令牌，再去读市场榜单、发评论、发布 / 更新 / 撤下市场条目。

三条线是同一套写法：`suspend` 函数 + `Result` 返回 + `Dispatchers.IO` 线程，OkHttp 发请求。

## AI 速览

- 核心符号：`CodexAuthManager`（Codex 登录态与 token 刷新）、`CodexOAuthClient`（授权码换 token / 刷新 / 吊销）、`CodexOAuthProtocol`（OAuth 常量与协议函数）、`CodexUsageClient`（Codex 用量查询）、`GitHubOAuthBrokerService`（GitHub 登录 broker 中转）、`GitHubApiService`（GitHub REST API）、`MarketStatsApiService`（应用市场 Market V2 客户端）、`CodexAuthPreferences`（Codex 凭证加密库）、`GitHubAuthPreferences`（GitHub 凭证库）、`CodexOAuthCoordinator` / `GitHubOAuthCoordinator`（登录流程编排）
- 主入口：`CodexAuthManager.getInstance(context).getValidAccessToken()` 拿可用的 Codex token；`GitHubOAuthBrokerService.startLogin` / `claimLogin` 走完 GitHub 登录两步；`MarketStatsApiService.getManifest` / `getEntry` / `publish` 读写市场
- 数据流向一句话：用户在系统浏览器完成 OAuth 授权 → 回调带回授权码 → 换 token 落库（Codex 进加密库，GitHub 进 DataStore）→ 后续 API 调用从库里取有效 token，Codex token 快过期时自动刷新。

## 核心机制

### 1. Codex OAuth：授权码 + PKCE + 本机回环回调

OAuth 授权码流程分两步：先让用户去授权服务器（`auth.openai.com`）登录并点同意，服务器把一次性的"授权码"发回 App；App 再拿授权码去换真正的 access token。PKCE 是给"藏不住密钥"的公开客户端（手机 App）加的防线：先随机生成 `verifier`，把它的 SHA-256 摘要（`challenge`）传给服务器；换 token 时出示原 `verifier`，服务器验明一致才发 token。即使授权码被截获，没有 `verifier` 也换不到 token。

`CodexOAuthProtocol` 集中放着这套流程的常量：client_id、授权服务器地址、回调端口 1455、回调路径 `/auth/callback`、登录会话 5 分钟超时。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt:44`

`generatePkce` 用 `SecureRandom` 生成 64 字节随机数做 `verifier`，`challenge` 是它的 SHA-256 摘要；`generateState` 生成 32 字节随机数做防 CSRF 的 `state`。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt:54`

授权 URL 拼在 `{ISSUER}/oauth/authorize` 上，`response_type=code`，scope 固定为 `openid profile email offline_access`，`code_challenge_method` 固定 `S256`，另带 `id_token_add_organizations=true`、`codex_cli_simplified_flow=true` 和 `originator=operit` 标识调用方。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt:76`

`CodexOAuthCoordinator.startLogin` 先在本机 127.0.0.1 起一个只监听 1455 端口的回环服务器，redirect_uri 就是 `http://localhost:1455/auth/callback`，再生成 PKCE 与 state、拼出授权 URL 交给浏览器打开。
`app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexOAuthCoordinator.kt:33`

回环服务器只认 `GET` 请求、拒绝带 scheme 或 authority 的绝对 URI、路径必须恰好是 `/auth/callback`；命中返回 200 提示页，未命中返回 404。
`app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexOAuthLoopbackCallbackServer.kt:47`

`completeLogin` 先校验回调的 `state` 与会话一致（防 CSRF），再看有没有 `error` 参数，最后取 `code` 去换 token、经 `saveLoginTokens` 落库。
`app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexOAuthCoordinator.kt:51`

换 token 是向 `{issuer}/oauth/token` 发 POST 表单：`grant_type=authorization_code` + `code` + `redirect_uri` + `client_id` + `code_verifier`，成功后强制要求 id/access/refresh 三种 token 齐全。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt:156`

### 2. Token 的存与刷：Codex 进加密库，5 分钟提前量

`saveLoginTokens` 拿到 token 后解析 access token 的 JWT claims：`accountId` 优先取 id token 的，退回 access token 的；过期时间优先取 JWT 的 `exp`，没有才用 `expires_in` 换算；三者缺一不可，缺了就抛错不存。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:32`

JWT 解析是"只解码不验签"：按 `.` 切三段、base64url 解第二段。`accountId` 从 `chatgpt_account_id` / `https://api.openai.com/auth` 命名空间 / `organizations` 首个 id 里取首个非空；`residency` 取 `chatgpt_compute_residency`（值为 `no_constraint` 时置空）；`email` 取 `email` 字段或 profile 命名空间下的；`exp` 乘 1000 得毫秒。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt:93`

Codex 凭证存在 `EncryptedSharedPreferences` 里（库名 `codex_oauth_credentials`，MasterKey AES256_GCM，键 AES256_SIV、值 AES256_GCM），`save` 要求三 token 与 accountId 非空、过期时间大于 0。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:146`

App 启动读加密库遇到 `SecurityException`（比如系统备份恢复后 Keystore 对不上）时删库重建并视为未登录，保证设置页能正常打开。
`app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt:65`

`getValidAccessToken` 是所有 Codex 调用的统一拿 token 口：离过期超过 5 分钟直接返回当前 token；快过期了就拿 `refreshMutex` 加锁，锁里再检查一次（防并发重复刷新），确认过期才调刷新。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:57`

刷新是向 token 端点发 `grant_type=refresh_token`；响应没带新的 refresh_token 就沿用旧的，刷新完写回加密库。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt:177`

登出时先尝试吊销 refresh token（`token_type_hint=refresh_token`），失败只记日志；无论成败最终清空本地凭证。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:98`

Codex 的模型调用方（`CodexProvider.getApiKey`）直接把 `getValidAccessToken()` 的返回值当 API key 用——也就是说 Codex 没有独立的 key，OAuth access token 就是钥匙。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:20`

注意不对称：GitHub 的 access token 存在**明文** DataStore（`github_auth_preferences`，未加密），与 Codex 的加密存储形成反差；详见代码走查。
`app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt:20`

### 3. GitHub 登录：broker 中转，App 不碰 client_secret

GitHub OAuth 的 client_secret 不能进 App，所以 Operit 自建了一个 broker（`https://api.operit.app`）当中转：App 只跟 broker 打交道，真正的 secret 留在服务端。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubOAuthBrokerService.kt:144`

`startLogin` 向 `{broker}/oauth/github/start` POST `{completionRedirectUri}`，拿回 `transactionId`、`deliveryCredential`（领取凭证）、`authorizationUrl`（给用户浏览器打开的 GitHub 授权页）、`completionRedirectUri` 和 `expiresAt`。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubOAuthBrokerService.kt:60`

`GitHubOAuthCoordinator` 把这次事务的 `transactionId` / `deliveryCredential` / `expiresAt` 存进 `GitHubAuthPreferences`；用户在浏览器点完同意跳回 App 后，`completeLogin` 先核对回调里的 `transactionId` 与进行中事务一致（防串台），再看 `status`：`complete` 才继续，`denied` 视为用户取消，`error` 直接失败。
`app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubOAuthCoordinator.kt:35`

然后 `claimLogin` 向 `{broker}/oauth/github/claim` POST `{transactionId, deliveryCredential}` 领取 token：要求 HTTP 200、`ok=true`、`status="complete"`，缺一不可；拿到 `accessToken`、`tokenType`、`scope`、`expiresIn`、`refreshToken`、`user` 后 `saveAuthInfo` 落库并清理事务。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubOAuthBrokerService.kt:84`

申请的 scope 是 `notifications,public_repo,user:email,read:user`；会话有效的硬条件是 `authVersion >= 3` 且已授权 scope 包含全部必需项，否则 token 取不出来。
`app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt:42`

进行中的 OAuth 事务有过期时间，`getActiveOAuthTransaction` 发现过期自动清理并返回 null。
`app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt:245`

### 4. GitHub API 客户端：用户、仓库、Release 一把梭

`GitHubApiService` 封装 `https://api.github.com`，拦截器给每个请求加 `User-Agent: Operit-MCP-Client`，缺 `Accept` 头时默认补 `application/vnd.github.v3+json`。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt:131`

读操作：`getCurrentUser`（`GET /user`，未登录直接失败）、`getUser(username)`（公开信息，登录时附认证头提配额）、`searchRepositories`（默认按 star 倒序，每页 30）、`getUserRepositories`（不传用户名查自己的 `/user/repos`，必须登录）、`getRepository`、`getRepositoryReleases`。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt:154`

写操作：`createRepository`（默认建公开库）、`createTextFile`（先查现有 sha，404 视为新建，再 PUT 内容，内容 Base64 编码）、`createRelease` / `updateRelease`（PATCH）/ `deleteRelease` / `deleteReleaseAsset`、`uploadReleaseAsset`（向 `uploads.github.com` POST，文件名作 query 参数）。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt:410`

两个 404 语义：`getRepositoryContentFile` 遇到 404 返回成功 null（文件不存在不算错）；`findReleaseByTag` 在 404 时返回 null。
`app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt:537`

### 5. 市场客户端：静态读 + 动态写双通道

`MarketStatsApiService` 是应用市场（Market V2）的客户端。读榜单、条目、评论走**静态通道**（`https://static.operit.app` 上的预生成 JSON）；发评论、发布、改条目走**动态通道**（`https://api.operit.app`），User-Agent `Operit-Market-V2`，超时 15 秒。
`app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt:510`

动态接口的鉴权不是直接用 GitHub token，而是先 `POST /market/v2/auth/github` 用 GitHub token 换一张**市场会话**（`marketSession`，`@Volatile` + 锁做双重检查缓存），之后每个动态请求自动带 `Authorization: Bearer {marketSession}`。
`app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt:1106`

条目按分片存放：`marketShard` 取 `fnv1a32Hex(entryId)` 的前 2 个字符，`getEntry` 拉 `/market/v2/entries/{shard}.json` 再按 id 取。
`app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt:1330`

榜单页：`getRankPage` / `getAllRankPage` / `getTypeRankPage` / `getCategoryRankPage` / `getTypedCategoryRankPage` / `getArtifactRankPage`，排序参数只有三档（likes / downloads / updated），总页数至少为 1。
`app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt:558`

写操作：`postComment` / `editComment` / `deleteComment`（POST / PATCH / DELETE）、`publish`（POST `/market/v2/publish`，服务端无返回时本地拼一个 pending 条目）、`publishNewVersion`、`withdrawEntry`（DELETE 并本地标 withdrawn）、`getUserPublishedEntries` / `getMyEntryDetail` / `getPublisherEntries` / `getNotifications`。
`app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt:927`

`trackDownload` 打下载点：不带市场会话、不跟随重定向，3xx 也算成功。
`app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt:757`

### 6. Codex 用量查询：5 小时窗与 7 天窗

`CodexUsageClient.fetch` 向 `https://chatgpt.com/backend-api/wham/usage` 发 GET，头带 `Authorization: Bearer`、`ChatGPT-Account-ID`、`originator=operit`、`Cache-Control: no-cache`，有 residency 再加 `x-openai-internal-codex-residency`。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexUsageClient.kt:33`

返回的 `rate_limit.primary_window` / `secondary_window` 按 `windowDurationSeconds` 匹配：18000 秒的是 5 小时窗，604800 秒的是 7 天窗；`used_percent` 缺失或为负则丢弃该窗口，超过 100 钳制为 100。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexUsageClient.kt:70`

### 7. 登录对话框 UI：Codex / GitHub 双入口

上面几节讲的是"怎么换 token"，这一节讲"用户看到的登录框"。Codex 与 GitHub 各有一个 `@Composable` 对话框，把"开浏览器 → 等回调 → 收尾"的流程包成弹窗，登录中显示转圈和两段文案（启动中 / 等待中），取消按钮在收尾阶段自动禁用。

Codex 侧：`CodexLoginDialog` 在 `LaunchedEffect` 里调 `coordinator.startLogin()` 生成会话，用 `ACTION_VIEW` 意图打开系统浏览器，再用 `withTimeout(剩余有效期)` 等回环服务器的回调；回调一到先置 `isCompleting=true`，再 `completeLogin` 换 token，成功弹 Toast 并回调 `onLoginSuccess`。
`app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexLoginDialog.kt:61`

GitHub 侧：`GitHubLoginDialog` 先让用户选方式——`GitHubLoginMode` 枚举只有 `CHOOSER` / `EMBEDDED` / `EXTERNAL` 三档，`rememberSaveable` 存住，旋转屏幕不丢。
`app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubLoginDialog.kt:50`

内嵌登录（EMBEDDED）用 `BrowserCallbackDialog` 在应用内嵌浏览器完成授权，事务没建好前先显示加载框，关掉即 `cancelLogin()`。
`app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubLoginDialog.kt:181`

外部登录（EXTERNAL）在 IO 线程上 `GitHubOAuthLoopbackCallbackServer.open()` 打开回环服务器，用服务器的 `completionRedirectUri` 开 broker 事务，再用外部浏览器打开授权页；`withTimeout` 等 `awaitCompletion()`，回调到后 `completeLogin` 拿 user，`finally` 里关服务器并 `cancelLogin()`。
`app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubLoginDialog.kt:244`

GitHub 的回环服务器和 Codex 的那台是两套实现：`GitHubOAuthLoopbackCallbackServer.open()` 在 `127.0.0.1` 上让内核分配随机端口（但要求 ≥1024），回调路径固定为 `/oauth/github/complete`；只认 GET、拒绝带 scheme/authority 的绝对 URI、路径不对回 404，请求行读取 5 秒超时。
`app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubOAuthLoopbackCallbackServer.kt:110`

`clearGitHubOAuthBrowserSession()` 是个顶层挂起函数：在主线程清掉 WebView 的全部存储数据与所有 cookie（含 `flush()`），供用户重新登录 GitHub 前抹掉上一次的浏览器会话。
`app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubOAuthBrowserSession.kt:11`

`CodexAuthManager.fetchUsage` 拉成功后才把快照（含 accountId 与拉取时间）存进 `CodexUsagePreferences`（明文 DataStore），UI 从 `usageSnapshotFlow` 读。
`app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt:115`

## 关键符号

| 符号 | 角色 |
|---|---|
| `CodexAuthManager` | Codex 登录态单例：存 token、5 分钟提前量自动刷新、登出吊销 |
| `CodexOAuthClient` | 授权码换 token / 刷新 / 吊销的 HTTP 层 |
| `CodexOAuthProtocol` | OAuth 常量（client_id、端点、端口、超时）与 PKCE / JWT 解析函数 |
| `CodexPkceCodes` / `CodexJwtClaims` / `CodexOAuthTokenResponse` | PKCE 码对、JWT claims、token 响应的数据类 |
| `CodexUsageClient` | 查 Codex 5 小时 / 7 天用量窗口 |
| `CodexOAuthCoordinator` | Codex 登录编排：起回环服务器 → 拼授权 URL → 校验回调 → 落库 |
| `CodexLoginDialog` | Codex 登录对话框 UI：开浏览器 → 等回调 → 收尾，取消按钮收尾时禁用 |
| `GitHubLoginDialog` | GitHub 登录对话框 UI：CHOOSER / EMBEDDED / EXTERNAL 三模式选单 |
| `GitHubOAuthLoopbackCallbackServer` | GitHub 版回环回调服务器：127.0.0.1 随机端口，`/oauth/github/complete` |
| `clearGitHubOAuthBrowserSession` | 顶层函数：重登 GitHub 前清空 WebView 存储与 cookie |
| `CodexOAuthLoopbackCallbackServer` | 127.0.0.1:1455 的一次性 OAuth 回调接收器 |
| `CodexAuthPreferences` | Codex 凭证的加密存储（EncryptedSharedPreferences） |
| `CodexUsagePreferences` | 用量快照的明文 DataStore |
| `GitHubOAuthBrokerService` | GitHub 登录 broker 中转：start / claim 两步 |
| `GitHubOAuthCoordinator` | GitHub 登录编排：存事务 → 验 transactionId → claim → 落库 |
| `GitHubAuthPreferences` | GitHub token 与 OAuth 事务的明文 DataStore |
| `GitHubAuthBus` | 内存里的授权码总线（`postAuthCode` 投递） |
| `GitHubApiService` | GitHub REST：用户、仓库、文件、Release、附件 |
| `MarketStatsApiService` | 市场 V2 客户端：静态读榜单/条目，动态写评论/发布 |

## 输入→处理→输出调用链

**链路一：Codex 登录（OAuth 授权码 + PKCE）**

1. 输入：用户在设置页点"登录 Codex"。`CodexOAuthCoordinator.startLogin` 在 127.0.0.1 起 1455 回环服务器，生成 PKCE 与 state，拼出授权 URL。
2. 处理：系统浏览器打开授权 URL，用户登录 ChatGPT 并同意；授权服务器回调 `http://localhost:1455/auth/callback?code=...&state=...`；`completeLogin` 校验 state、取 code；`CodexOAuthClient.exchangeAuthorizationCode` 带 `code_verifier` 换 token。
3. 输出：`CodexAuthManager.saveLoginTokens` 解析 JWT 得 accountId 与过期时间，`CodexAuthState` 存入加密库；`authState` 流通知 UI 已登录。

**链路二：Codex token 使用与刷新**

1. 输入：`CodexProvider.getApiKey`（或用量查询）调 `getValidAccessToken`。
2. 处理：离过期超 5 分钟直接返回；否则 `refreshMutex` 加锁、二次确认后 `refreshAccessToken` 用 refresh token 换新 access token，旧 refresh token 无更新则沿用。
3. 输出：返回可用的 access token 并写回加密库；登出时先吊销 refresh token 再清空。

**链路三：GitHub 登录（broker 中转）**

1. 输入：用户点"GitHub 登录"。`GitHubOAuthCoordinator.startLogin` 调 broker `/oauth/github/start`，把 `transactionId` / `deliveryCredential` / `expiresAt` 存 preferences，浏览器打开返回的 `authorizationUrl`。
2. 处理：用户授权后跳回 App，`completeLogin` 核对 `transactionId`、看 `status`；`claimLogin` 凭事务凭证向 broker 领取 token。
3. 输出：`saveAuthInfo` 存 access token、scope、用户信息并清事务；后续 `GitHubApiService` 经 `getAuthorizationHeader` 取 `Bearer` 头调 GitHub API。

**链路四：市场发布**

1. 输入：用户在市场页发布条目。`MarketStatsApiService.publish` 把请求体 POST 到 `/market/v2/publish`。
2. 处理：`requestDynamic` 先经 `ensureMarketSession`（无缓存时用 GitHub token 换市场会话），请求自动带 `Bearer {marketSession}`。
3. 输出：返回 `MarketV2Entry`；服务端无条目返回时本地拼 pending 条目；`publishNewVersion` / `withdrawEntry` / 评论接口走同一动态通道。

**链路五：登录对话框 UI**

1. 输入：用户在设置页点"登录 Codex"或"GitHub 登录"。Codex 直接进 `CodexLoginDialog`；GitHub 先弹 `GitHubLoginDialog` 的方式选单（内嵌 / 外部浏览器）。
2. 处理：对话框在 `LaunchedEffect` 里驱动 coordinator：开回环服务器（Codex 固定 1455 端口，GitHub 随机端口）→ 打开授权 URL → `withTimeout(剩余有效期)` 等待回调；取消按钮把服务器关掉，收尾阶段（`isCompleting=true`）禁用取消。
3. 输出：回调到达后 `completeLogin` 换 token 落库（走链路一 / 链路三），弹成功 Toast，关对话框。

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/api/CodexAuthManager.kt`（148 行）：Codex 登录态、token 刷新、登出、用量快照调度
- `app/src/main/java/com/ai/assistance/operit/data/api/CodexOAuthClient.kt`（254 行）：PKCE 生成、授权 URL、JWT 解析、换 token / 刷新 / 吊销
- `app/src/main/java/com/ai/assistance/operit/data/api/CodexUsageClient.kt`（111 行）：Codex 用量窗口查询与解析
- `app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt`（830 行）：GitHub 用户、仓库、文件、Release、附件 API
- `app/src/main/java/com/ai/assistance/operit/data/api/GitHubOAuthBrokerService.kt`（147 行）：GitHub 登录 broker 中转
- `app/src/main/java/com/ai/assistance/operit/data/api/MarketStatsApiService.kt`（1395 行）：应用市场 Market V2 客户端
- `app/src/main/java/com/ai/assistance/operit/data/preferences/CodexAuthPreferences.kt`：Codex 凭证加密存储
- `app/src/main/java/com/ai/assistance/operit/data/preferences/CodexUsagePreferences.kt`：用量快照存储
- `app/src/main/java/com/ai/assistance/operit/data/preferences/GitHubAuthPreferences.kt`：GitHub 凭证与 OAuth 事务存储
- `app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexOAuthCoordinator.kt`：Codex 登录编排
- `app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexOAuthLoopbackCallbackServer.kt`：回环回调服务器
- `app/src/main/java/com/ai/assistance/operit/ui/features/codex/CodexLoginDialog.kt`（154 行）：Codex 登录对话框 UI
- `app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubOAuthCoordinator.kt`：GitHub 登录编排
- `app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubLoginDialog.kt`（344 行）：GitHub 登录对话框 UI（三模式选单）
- `app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubOAuthBrowserSession.kt`（24 行）：重登前清空 WebView 会话
- `app/src/main/java/com/ai/assistance/operit/ui/features/github/GitHubOAuthLoopbackCallbackServer.kt`（122 行）：GitHub 版回环回调服务器
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:20`：OAuth token 充当 API key 的使用点
