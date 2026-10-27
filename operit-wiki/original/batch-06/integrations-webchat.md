---
title: WebChat 本地 HTTP 服务
module: integrations-webchat
sources: app/src/main/java/com/ai/assistance/operit/integrations/http/
date: 2026-10-01
---

# WebChat 本地 HTTP 服务（integrations-webchat）

> 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（v1.12.2）
> 范围：`app/src/main/java/com/ai/assistance/operit/integrations/http/` 下全部 10 个文件，共 4671 行，100% 全文阅读。

## 概述

WebChat 本地 HTTP 服务是 Operit 在手机上开的一个**本地网页聊天入口**：手机启动一个基于 NanoHTTPD 的 HTTP 服务器（绑定 `0.0.0.0`，无 TLS），浏览器打开手机 IP+端口就能看到一个完整聊天网页（静态资源随 APK 打包在 `assets/web-chat/` 里），经由 `/api/web/*` 约 20 条 REST/SSE 接口与手机上的聊天核心（ChatServiceCore）交互——看会话列表、发消息看流式输出、换模型/角色/记忆空间、传文件、改标题/分组/锁定/置顶/主题。

同一个服务器还顺带托管了另外两个通道：**外部聊天 API**（`POST /api/external-chat`，sync/async_callback/SSE 三种回执模式）和 **A2A 协议通道**（agent-card + JSON-RPC）。鉴权全靠一个 Bearer token：每个请求都比对 `Authorization: Bearer <token>`，token 未配置时所有鉴权请求直接 401。

## AI 速览

- **核心符号**：`ExternalChatHttpServer`（服务器/路由总入口，~570 行）、`WebChatHttpBridge`（网页通道实现主体，2959 行）、`WebChatModels`（~50 个数据模型）、`bridge/WebChatActionBridge`（手动记忆更新/会话总结）、`bridge/WebChatInputSettingsBridge`（14 项输入设置）、`bridge/WebChatManagementBridge`（会话管理）、`bridge/WebChatMemorySelectorBridge`（记忆空间切换）、`ExternalChatHttpAutoStarter`（开机自启）、`ExternalChatHttpNetworkInfo`（取本机 IPv4）、`ExternalChatHttpState`（运行状态）。
- **主入口**：`ExternalChatHttpServer.serve()` —— NanoHTTPD 回调，按 URI 前缀分发到 A2A 处理器、健康检查、外部聊天、WebChatHttpBridge、静态资源。
- **数据流向一句话**：浏览器请求 → `serve()` 按路径分发 → Bearer token 校验（assets 路由和静态页除外）→ `WebChatHttpBridge` 执行业务 → 读写 `ChatServiceCore`/`ChatHistoryManager` → JSON 或 SSE 事件流返回。

## 核心机制

### 1. 服务器与路由分发（`ExternalChatHttpServer`，约 570 行）

服务器类继承 NanoHTTPD，绑定 `0.0.0.0`（`LISTEN_HOST`），端口来自用户配置。`startServer()`/`stopServer()` 用 `AtomicBoolean` 防重复启停，停止时顺带关闭 A2A 处理器。

`serve()` 的路由顺序是硬编码的 `when`：

1. `OPTIONS` → 直接返回 CORS 预检头；
2. A2A agent-card 路径、A2A JSON-RPC 路径 → `A2aHttpHandler`；
3. `GET /api/health` → 健康检查（要 Bearer token）；
4. `POST /api/external-chat` → 外部聊天（要 Bearer token）；
5. `/api/web/*` → `WebChatHttpBridge.handleApi()`；
6. 不以 `/api` 开头的路径 → `WebChatHttpBridge.serveStatic()`（静态网页，**无鉴权**）；
7. 其他 `/api/*` → 404 `"API endpoint not found"`。

`useGzipWhenAccepted()` 对 `text/event-stream` 显式禁 gzip，防止 SSE 被压缩缓冲。

### 2. 鉴权：无状态 Bearer token 明文比对

两处各有一个 `requireBearerToken`（服务器 :379、桥接器 :2623），逻辑相同：

- 预期 token 为空 → 401 `"Bearer token not configured"`；
- 取 `Authorization` 头（大小写不敏感），剥掉 `Bearer ` 前缀后与配置值做 `==` 明文比较；
- 不一致 → 401 `"Unauthorized"`。

注意两处例外：`/api/web/assets/<uuid>` 路由在 token 校验**之前**就短路返回（靠 UUID 不可猜测性代替鉴权），静态网页 `serveStatic` 全程无鉴权（任何人打开 IP 就能看到聊天 UI 界面，但调 API 仍要 token）。

CORS 全开：`Access-Control-Allow-Origin: *`，允许方法 GET/POST/PATCH/DELETE/OPTIONS，允许头 Authorization/Content-Type/Accept。

### 3. 外部聊天三模式（`/api/external-chat`）

`handleChat` 先做五层校验：token → 请求体可读 → 非空 → JSON 可解析 → `response_mode` 合法 → `message` 非空；`stream=true` 与 `async_callback` 互斥。

- **sync**：`runBlocking` 同步执行 `ExternalChatRequestExecutor`，200 直接返回结果；
- **async_callback**：`callback_url` 必须 http/https，`serviceScope.launch` 后台执行，立即回 202 `ExternalChatAcceptedResponse`，做完后 OkHttp POST 回调（失败只打日志）；
- **stream=true**：SSE 流。64KB `PipedInputStream/PipedOutputStream` 做生产者-消费者桥接；后台协程执行并写 `event: start/delta/done/error` 事件，`writeSseEvent` 保证多行 payload 按 SSE 规范拆行；客户端断开（`FilterInputStream.close`）→ 取消流任务 + `streamingSession.cleanup()` + 取消响应会话。

请求体读取要求 `Content-Length` 头必须存在且 ≤ `Int.MAX_VALUE`，按 `charset=` 参数解码（缺省 UTF-8）。

### 4. WebChat API：约 20 条路由（`WebChatHttpBridge.handleApi`）

`handleApi` 每次入口先 `cleanupExpiredEntries()` 清理过期资源，然后 assets 路由短路、Bearer 校验，再进 `when` 路由表：

| 路由 | 方法 | 功能 |
|---|---|---|
| `/api/web/bootstrap` | GET | 启动快照：版本号、当前会话、主题、能力开关 |
| `/api/web/character-selector` | GET/POST | 角色卡/角色组列表、设置 active prompt |
| `/api/web/model-selector` | GET/POST | 模型列表、切换模型 |
| `/api/web/memory-selector` | GET/POST | 记忆空间列表、切换记忆空间 |
| `/api/web/input-settings` | GET/PATCH | 14 项输入设置聚合查询/条件更新 |
| `/api/web/manual-memory-update`、`/api/web/manual-conversation-summary` | POST | 手动更新记忆、手动总结会话 |
| `/api/web/chats` | GET/POST | 会话列表、新建会话 |
| `/api/web/chats/reorder`、`/api/web/chat-group/rename`、`/api/web/chat-group/delete` | POST | 重排、分组改名/删除 |
| `/api/web/chats/{id}` | PATCH/DELETE | 改标题/分组/锁定/置顶/角色绑定、删除 |
| `/api/web/chats/{id}/select` | POST | 切换当前会话 |
| `/api/web/chats/{id}/messages` | GET | 分页拉消息（缺省 24，上限 120，before/after 二选一） |
| `/api/web/chats/{id}/message-locator`、`/messages/reveal`、`/messages/favorite` | GET/POST/PATCH | 消息定位、展开、收藏 |
| `/api/web/chats/{id}/theme` | GET | 会话主题快照 |
| `/api/web/chats/{id}/messages/stream` | POST | 发消息 + SSE 流式回包 |
| `/api/web/uploads` | POST | multipart 文件上传 |
| `/api/web/assets/<uuid>` | GET/HEAD | 已注册资源直链（免鉴权） |

### 5. 流式发消息（`handleStream`）

流程：解析 `WebSendMessageRequest`（文本和附件至少其一）→ 附件 id 必须全部命中上传表 → 64KB 管道 + `serviceScope.launch(Dispatchers.IO)` 后台协程 → `switchAppChatContext` 切 App 会话上下文（最多等 3 秒，失败直接 error 事件）→ `core.clearAttachments()` + 添加附件 + `updateUserMessage` → 先写 `start` 事件和乐观用户消息 → `core.sendUserMessage(preferActiveRoleCard=true)` → 等响应流就绪（10 秒超时）→ 逐 chunk 写 `assistant_delta` → 终态 `awaitFinalState`（10 秒超时）→ `assistant_done`（失败则 error）。

断开处理三保险：`CancellationException`/`IOException`/普通异常分别取消消息；响应输入流 `close()` 时取消流任务 + 取消消息。

### 6. 上传与资源注册

- **上传**（`handleUpload`）：必须 `multipart/form-data`；单文件超 25MB（`MAX_UPLOAD_BYTES`）返回 400；文件名经 `sanitizeFilename` 消毒；落盘 `cacheDir/external_http_uploads/<uuid>_<文件名>`；附件记入 `uploadsById`（UUID 做 id），**上传后 2 小时过期自动删文件**。
- **资源注册**（`registerAsset`）：按 `source|mime` 去重，已存在则刷新时间戳并复用 URL；id 为 UUID，URL 形如 `/api/web/assets/<uuid>`；`readRegisteredAsset` 按五分支读取：`file:///android_asset/`、`android_asset/`（APK 内置资源）、`content://`/`android.resource://`（ContentProvider）、`file://`（本地文件 URI）、普通文件路径；**附件 6 小时过期**。
- 每次 API 入口都跑 `cleanupExpiredEntries()` 做懒清理。

### 7. 静态网页服务（`serveStatic`）

只允许 GET/HEAD；`normalizeStaticPath` 挡掉 `..`、反斜杠、空路径段防目录穿越；资源从 `assets/web-chat/` 读取，缺扩展名或根路径回落 `web-chat/index.html`；MIME 按扩展名映射（js/css/json/map/wasm 等），未知走 `application/octet-stream`。

### 8. 四个 bridge 子模块

- `WebChatActionBridge`：`manuallyUpdateMemory()` / `manuallySummarizeConversation()`，直调消息协调代理。
- `WebChatInputSettingsBridge`：`resolveState()` 聚合 14 项设置（思考模式、流式输出、上下文长度、权限等级等）；`update()` 逐项"目标值不同才 toggle"，**权限等级变更走 `ToolPermissionSystem`**；`waitForUpdate` 最多轮询 12 次等状态收敛。
- `WebChatManagementBridge`：会话改标题/分组/锁定/置顶/角色绑定（卡与组二选一）、重排（`displayOrder`+分组）、分组改名/删除；更新绑定后若是当前会话会同步 active prompt。
- `WebChatMemorySelectorBridge`：`selectProfile()` 空 id 拒绝 → `setActiveMemorySpace` → `waitForSelection` 轮询 12 次（每次约 30ms）等 `currentProfileId` 生效。

### 9. 自启与网络信息

`ExternalChatHttpAutoStarter.ensureRunningIfEnabled`：`AtomicBoolean` 防并发 → 读配置（未启用/端口非法直接跳过）→ 已在同端口运行则跳过 → 调 `AIForegroundService.ensureRunningForExternalHttp` 拉起前台服务。`ExternalChatHttpNetworkInfo.getLocalIpv4Addresses()` 枚举 up 且非回环非虚拟网卡的 IPv4，用于设置页展示"浏览器访问地址"。

## 关键符号（英文原名）

- `ExternalChatHttpServer` / `serve()` / `handleChat()` / `sseResponse()` / `requireBearerToken()` / `withCors()` / `LISTEN_HOST` / `SSE_PIPE_BUFFER_SIZE`
- `WebChatHttpBridge` / `handleApi()` / `handleStream()` / `handleUpload()` / `handleRegisteredAsset()` / `serveStatic()` / `registerAsset()` / `cleanupExpiredEntries()` / `switchAppChatContext()`
- `WebChatModels`：`WebBootstrapResponse` / `WebChatSummary` / `WebChatMessage` / `WebSendMessageRequest` / `WebChatStreamEvent` / `WebInputSettingsState` / `WebMemorySelectorState`
- `bridge/WebChatActionBridge` / `bridge/WebChatInputSettingsBridge` / `bridge/WebChatManagementBridge` / `bridge/WebChatMemorySelectorBridge`
- `ExternalChatHttpAutoStarter.ensureRunningIfEnabled()` / `ExternalChatHttpNetworkInfo.getLocalIpv4Addresses()` / `ExternalChatHttpState`

## 输入 → 处理 → 输出调用链

**链路 A：网页端发消息看流式输出**
1. 输入：浏览器 `POST /api/web/chats/{id}/messages/stream`，Header 带 `Authorization: Bearer <token>`，Body 为 `WebSendMessageRequest{message, attachment_ids}`。
2. 处理：`serve()` → `handleApi()`（清过期项 → Bearer 校验 → 路由）→ `handleStream()`：附件 id 全量命中检查 → 64KB 管道 + 后台协程 → `switchAppChatContext`（3 秒超时）→ `core.clearAttachments()`/`addAttachments`/`updateUserMessage` → 写 `start` 事件 → `core.sendUserMessage(preferActiveRoleCard=true)` → 10 秒内等响应流 → 逐 chunk 写 `assistant_delta` → `awaitFinalState`（10 秒）→ `assistant_done`。
3. 输出：`text/event-stream` 分块响应，事件序列 `start → user_message → assistant_delta* → assistant_done/error`；客户端断开自动取消消息。

**链路 B：外部系统调聊天 API（异步回调模式）**
1. 输入：`POST /api/external-chat`，Bearer token，Body 为 `ExternalChatHttpRequest{message, response_mode="async_callback", callback_url}`。
2. 处理：`serve()` → `handleChat()`：token 校验 → Content-Length/JSON/`response_mode`/`message` 五层校验 → `callback_url` 必须 http/https → `serviceScope.launch` 后台 `executor.execute()`。
3. 输出：立即 202 `ExternalChatAcceptedResponse{requestId}`；执行完成后 OkHttp POST 结果到 `callback_url`（失败只记日志）。

**链路 C：文件上传后在消息里引用**
1. 输入：`POST /api/web/uploads`，Bearer token，`multipart/form-data` 文件（≤25MB）。
2. 处理：`handleUpload()`：Content-Type 检查 → NanoHTTPD 落临时文件 → 大小校验 → `sanitizeFilename` → 拷贝到 `cacheDir/external_http_uploads/<uuid>_<名>` → 登记 `uploadsById`（2 小时 TTL）。
3. 输出：`WebUploadedAttachment{attachmentId(uuid), fileName, mimeType, size}`；发消息时带 `attachment_ids`，`handleStream` 按 id 取附件拼到用户消息。

**链路 D：开机自启**
1. 输入：应用启动/配置变更，`reason` 字符串。
2. 处理：`ensureRunningIfEnabled()`：`AtomicBoolean` 防并发 → 读 `ExternalHttpApiPreferences`（未启用或端口非法跳过）→ `AIForegroundService.externalHttpState` 已同端口运行跳过 → `ensureRunningForExternalHttp()`。
3. 输出：前台服务拉起 → `startServer()` 绑定 `0.0.0.0:端口`，状态写入 `externalHttpState`。

## 来源

- `app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt`（570 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/http/WebChatHttpBridge.kt`（2959 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/http/WebChatModels.kt`（760 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/http/bridge/WebChatActionBridge.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/http/bridge/WebChatInputSettingsBridge.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/http/bridge/WebChatManagementBridge.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/http/bridge/WebChatMemorySelectorBridge.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpAutoStarter.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpNetworkInfo.kt`
- `app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpState.kt`
- 机器可读事实：`integrations-webchat.facts.json`（153 条，引用逐条验真）
- 代码走查：`integrations-webchat.quality.json`
