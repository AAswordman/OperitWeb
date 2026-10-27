# Critic 报告：data-api-oauth（OAuth 与外部 API 客户端，Issue #71）

- 核验人：独立 critic（与 writer 无关）
- 核验时间：2026-10-01
- 源码版本：~/workspace/Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 HEAD 一致）

## 核验方法

1. 脚本全量验 160 条 facts 引用：文件存在、行号为整数、行号不越界、引用行无重复（重复引用单独复核）。
2. 脚本全量验 14 条 quality evidence：逐字原文匹配（14/14 逐字命中）。
3. 人工抽检 34 条 facts（约每 5 条抽 1 条，覆盖全部 13 个引用文件）±5 行窗口语义支撑。
4. 人工核正文全部具体断言（端口/超时/行数/scope/默认参数/URL/排序档位等）逐条对照源码。
5. 全文 grep 禁用词；核 status.json 字段；核 lint.md。

## 核验结果

### 1. facts.json（160 条）：通过

- 160/160 引用文件存在、行号真实且未越界。
- 抽检 34 条全部语义成立，±5 窗口内可见支撑原文；0 复合事实（无 `；`、无多句断言）。
- 关键行为断言复核：
  - `refreshAccessToken` 不调 `requireComplete`，刷新响应允许只带新 access_token —— 属实（CodexOAuthClient.kt:177–189 → executeTokenRequest 直接构造响应）。
  - `getValidAccessToken` 距过期超 5 分钟直接返回 —— 属实（CodexAuthManager.kt:60，`REFRESH_WINDOW_MILLIS = 5*60*1000`）。
  - 回环服务器只认 GET、拒绝绝对 URI —— 属实（CodexOAuthLoopbackCallbackServer.kt:47）。
  - `getUserRepositories` 不传用户名时必须登录 —— 属实（GitHubApiService.kt:304–307）。
  - scope `notifications,public_repo,user:email,read:user` —— 属实（GitHubAuthPreferences.kt:42）。

### 2. quality.json（14 条走查）：通过

- 14/14 evidence 为逐字代码原文。
- 两条高危复核属实、分级合理：
  - 高危 1：GitHub `access_token`/`refresh_token` 存明文 DataStore `github_auth_preferences`（GitHubAuthPreferences.kt:20–48），而 Codex 凭证确用 `EncryptedSharedPreferences` + MasterKey AES256_GCM（CodexAuthPreferences.kt:145–152）；scope 含 `public_repo` 写权限 —— 双标对比准确，无夸大。
  - 高危 2：`deliveryCredential`（`ACTIVE_OAUTH_DELIVERY_CREDENTIAL`）同库明文落盘 —— 属实。
- 其余 6 warn / 6 suggestion 证据真实、分级恰当（scope 申请列为 suggestion 属设计披露，可接受）。

### 3. 正文 .md：通过

- 结构齐全：概述、## AI 速览、核心机制（6 节）、关键符号（15 个，英文原名）、输入→处理→输出 4 条调用链、来源。
- 具体断言逐条验真：回调端口 1455、会话超时 5 分钟、User-Agent `Operit-MCP-Client` / `Operit-Market-V2`、市场超时 15 秒、排序三档 likes/downloads/updated（else→updated）、`createRepository` 默认公开（`isPrivate=false`）、upload 附件走 `uploads.github.com` 且文件名作 `name` query 参数、用量窗 18000s/604800s 且超 100 钳制、榜单总页数 `coerceAtLeast(1)`、publish 无返回时本地拼 pending 条目 —— 全部属实。
- 来源 13 文件行数标注（148/254/111/830/147/1395）与源码一致。
- 正文与 facts 无矛盾；quality 发现未写入正文（仅一处"详见代码走查"的交叉引用，合规）。
- 禁用词：正文 0 残留。

### 4. status.json：通过

`issue: 71`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916…` 一致，`critic` 为空待填，`refs_valid` 格式与事实相符。

### 5. lint.md：通过

lint.py 单页隔离 0 硬失败 / 0 警告；自查记录完整。

## 轻微问题（3 条，不打回）

1. `data-api-oauth.lint.md` 第 7 行括号内自指性提及"通过/批准/LGTM"字样（在描述扫描动作）。虽在 Issue 评论场景外无误判风险，但按 writer"所有文件零残留"口径，建议改写为"禁用词与模糊词扫描干净"。
2. fact #100（`MarketStatsApiService` 是 Market V2 客户端）引用 `MarketStatsApiService.kt:510`，±5 窗口只显示类声明，"V2" 证据在 524 行（`pathSegments = listOf("market","v2",…)`）。断言为真，建议 ref 改为 524 或补第二引用。
3. facts #85/#86 共用引用行 `GitHubApiService.kt:278`（if/else 两分支各一条事实）。±5 窗口覆盖分支代码、语义成立，可接受；更精确可分别指向 278/280 行。

## 结论

**通过**。无硬问题。3 条轻微问题建议 writer 顺手修正（尤其第 1 条的禁用词自指），不强制打回。
