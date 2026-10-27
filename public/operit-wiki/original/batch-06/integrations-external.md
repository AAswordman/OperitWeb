---
title: 外部聊天入口与自动化集成
module: 外部集成 / app
sources: 13
date: 2026-10-01
---

# 外部聊天入口与自动化集成（integrations-external）

## 概述

Operit 把「让外部程序跟我聊天」做成了一套统一入口：不管是局域网里的 HTTP 请求、Android 广播，还是遵循 A2A（Agent-to-Agent）协议的外部智能体，最后都汇入同一个执行核心做统一处理（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:43`）。

执行核心把外部消息转成内部工具调用发给 AI：`send_message_to_ai` 是同步路径组装的内部工具调用（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:202`），拿到回复后再按各通道的格式返回。

另一半是自动化集成：Tasker 既可以主动触发 Operit 的工作流（动作插件、广播、开机重排），也可以被 AI 反向触发（工具 `trigger_tasker_event`，`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1462`）。

四个子包分工：a2a（A2A 协议服务）、externalchat（共享执行核心）、intent（广播入口）、tasker（Tasker 双向集成）。HTTP 服务本体在 integrations/http，负责把 A2A 与外部聊天挂到同一端口上。

## AI 速览

- **核心符号**：`ExternalChatRequestExecutor`（共享执行核心）、`A2aHttpHandler`（A2A JSON-RPC 处理）、`A2aTaskManager`（A2A 任务生命周期）、`ExternalChatResponseSanitizer`（回复清洗）、`ExternalChatHttpServer`（NanoHTTPD 服务）、`ExternalChatReceiver`（广播入口）、`WorkflowTaskerRunner` / `WorkflowTaskerReceiver` / `WorkflowBootReceiver`（Tasker 三件套）、`triggerAIAgentAction`（反向事件）。
- **主入口**：HTTP POST /api/external-chat（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:81`）、A2A POST /a2a（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:79`）、广播 com.ai.assistance.operit.EXTERNAL_CHAT（`app/src/main/AndroidManifest.xml:385`）。
- **数据流向一句话**：外部请求 → 各通道解析为统一请求模型 → 执行核心转调内部工具 → AI 回复经清洗后按通道格式（JSON / SSE / A2A 任务 / 广播）返回（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:43`）。

## 核心机制

### 1. 共享执行核心：ExternalChatRequestExecutor

这是三个入口（HTTP、A2A、广播）真正的公共底座，提供两个入口方法：

- `execute` —— 同步执行入口，先走 prepareRequest 做准备（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:43`）
- `showFloating` —— 为 true 时先把聊天服务拉起来（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:131`）
- `start_chat_service` —— 拉起聊天服务的内部工具调用（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:141`）
- `createNewChat` / `chatId` / `createIfNone` —— 决定用新聊天、指定聊天还是当前聊天（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:157`）
- `send_message_to_ai` —— 同步路径组装的内部工具调用（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:202`）
- `timeout_ms` —— timeoutMs 大于 0 时才作为参数下发（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:192`）
- `stop_chat_service` —— stopAfter 为 true 时清理阶段调用（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:207`）
- `startStreaming` —— 流式执行入口，调 startMessageToAIStream 拿会话（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:72`）
- `sanitize` —— returnToolStatus 为 true 时原样返回（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatResponseSanitizer.kt:18`）
- `status` / `tool` / `tool_result` —— 为 false 时剥掉这三类标记，只留纯文本（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatResponseSanitizer.kt:91`）

每次执行都新建一个 StandardChatManagerTool 实例，不复用。

### 2. A2A 协议接入

`A2aHttpHandler` 实现 A2A 1.0 的 JSON-RPC 面，挂在外部 HTTP 服务的两个路径上：

- `protocolVersion` / `Operit` —— GET /.well-known/agent-card.json 返回 Agent Card：协议 1.0、名字 Operit、支持流式、不支持推送通知（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:44`）
- `operit-chat` —— Agent Card 声明的唯一 skill id（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:69`）
- 端点 URL 由请求 Host 头拼出 http://host/a2a；Host 含 /、?、# 直接拒绝（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:488`）
- POST /a2a 是 JSON-RPC 2.0 入口，先过 Bearer 鉴权再解析（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:435`）
- `SendMessage` / `GetTask` / `CancelTask` —— 方法名常量；另有 SendStreamingMessage、ListTasks、SubscribeToTask，共 6 个方法（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:582`）
- `ROLE_USER` —— 只收该角色的纯文本消息（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:356`）
- `messageId` / `taskId` —— 消息必须带 messageId；带 taskId 直接拒绝，不接受往已有任务追加消息（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:359`）
- `acceptedOutputModes` —— 不含 text/plain 直接拒绝（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:675`）
- `Content-Length` —— 请求体必填且在 1 到 1MB 之间（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:454`）
- SSE 响应头带 A2A-Version、no-cache、keep-alive（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:268`）
- `artifactUpdate` —— Artifact 事件序列化名，append 为 true、lastChunk 为 false（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:282`）
- `artifactId` —— 为任务 id 加 -result 后缀（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:334`）
- 多文本 part 用换行拼接，拼接后不能为空（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:379`）

`A2aTaskManager` 管任务生命周期：

- `contextChats` —— 同一个 A2A contextId 复用同一个 Operit 聊天，实现多轮连续对话（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:68`）
- `COMPLETED` / `CANCELED` / `FAILED` / `REJECTED` —— 8 种状态常量中的 4 种终态（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:344`）
- `createNewChat` / `existingChatId` —— 有聊天 id 则复用，否则新建（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:121`）
- `returnToolStatus` —— A2A 任务固定为 false，输出强制清洗（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:124`）
- `close` —— 服务停止时取消全部任务并清空映射（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:110`）
- `awaitTerminalTask` —— 等任务到终态后返回快照（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:105`）
- `A2aTaskNotFoundException` —— 未知任务抛 -32001（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:365`）
- `sortedBy` —— listTasks 按任务 id 排序返回（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:89`）
- `pageSize` —— 缺省 50，上限 100（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:395`）
- `nextPageToken` —— 有下一页时为本页最后一个任务 id（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt:424`）
- 空分块不追加到任务输出（`app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt:144`）

### 3. HTTP 服务：ExternalChatHttpServer

基于 NanoHTTPD：

- `LISTEN_HOST` / `0.0.0.0` —— 监听任意网卡，端口取自配置（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:548`）
- `handleChat` —— /api/external-chat 先过 Bearer 鉴权（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:125`）
- `requireBearerToken` —— 配置里没配 token 直接回 401（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:382`）
- `readRequestBody` —— 要求请求带 Content-Length 并读请求体（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:435`）
- `normalizedResponseMode` —— response_mode 非法返回 400（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:165`）
- `ASYNC_CALLBACK` —— stream 与之混用直接拒绝（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:186`）
- `stream` —— 为 true 走 SSE 流式响应（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:197`）
- async_callback 要求回调地址为 http/https 协议（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:213`）
- `executor.execute` —— async_callback 先回 202 Accepted，后台执行完 POST 到回调地址（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:229`）
- `runBlocking` —— sync 模式直接执行并返回结果（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:236`）
- `start` / `delta` / `done` / `error` —— SSE 事件名（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:556`）
- `ExternalChatHealthResponse` —— /api/health 返回 enabled、serviceRunning、port 等字段，同样要鉴权（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatModels.kt:133`）
- `Access-Control-Allow-Origin` —— 所有响应带 CORS 头，允许任意来源（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:539`）
- `useGzipWhenAccepted` —— SSE 响应禁用 gzip（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:96`）

### 4. 广播入口：ExternalChatReceiver

- `ExternalChatReceiver` —— exported=true 且无权限声明的广播接收器（`app/src/main/AndroidManifest.xml:385`）
- 监听 action com.ai.assistance.operit.EXTERNAL_CHAT（`app/src/main/AndroidManifest.xml:388`）
- 把 12 个 extras（request_id、message、group、create_new_chat、chat_id、create_if_none、show_floating、return_tool_status、initial_mode、auto_exit_after_ms、timeout_ms、stop_after）拼成统一请求，用 goAsync 在 IO 线程调 execute（`app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt:112`）
- `EXTRA_RESULT_SUCCESS` / `EXTRA_RESULT_CHAT_ID` / `EXTRA_RESULT_AI_RESPONSE` / `EXTRA_RESULT_ERROR` —— 结果广播携带的 extras，reply_action / reply_package 可自定义（`app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt:114`）
- 隐式结果广播：reply_package 非空时才限定包名（`app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt:105`）

### 5. Tasker 双向集成

**Tasker → Operit（触发工作流）**，三条路：

1. `WorkflowTaskerActivityConfig` —— Tasker 动作插件的配置 Activity（`app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerActivity.kt:22`）
2. `triggerWorkflowsByTaskerEvent` —— 在启用的工作流里找 triggerType="tasker" 的触发节点（`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:840`）
3. `WorkflowTaskerReceiver` —— exported 的广播接收器（`app/src/main/AndroidManifest.xml:460`）
4. `TRIGGER_WORKFLOW` / `FIRE_SETTING` —— 监听自有 action 与 Tasker 的事件 action（`app/src/main/AndroidManifest.xml:464`）
5. `setPackage` —— createTriggerIntent 把广播限定在本应用（`app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerReceiver.kt:30`）
6. `ignoreCase` —— 节点配置的 action 与广播 action 忽略大小写相等即触发（`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:897`）
7. `BOOT_COMPLETED` —— WorkflowBootReceiver 在开机后把所有启用的工作流重新排期（`app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerReceiver.kt:74`）

**Operit → Tasker（AI 反向触发）**：

- `trigger_tasker_event` —— AI 在对话中主动发事件的工具，task_type 必填（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1462`）
- `task_type` / `arg1` —— AI Agent 事件插件的输入字段（`app/src/main/java/com/ai/assistance/operit/integrations/tasker/AIAgentTasker.kt:24`）
- `args_json` —— 参数 Map 转 JSON 后的输入字段（`app/src/main/java/com/ai/assistance/operit/integrations/tasker/AIAgentTasker.kt:34`）
- `argsJson` —— triggerAIAgentAction 把参数 Map 转成 JSON 存入（`app/src/main/java/com/ai/assistance/operit/integrations/tasker/AIAgentTasker.kt:116`）

## 关键符号

| 符号 | 说明 |
|---|---|
| `ExternalChatRequestExecutor` | 三个入口共用的执行核心：`execute` / `startStreaming` |
| `ExternalChatRequest` | 统一请求模型（snake_case 序列化） |
| `ExternalChatResult` | 统一结果模型（`request_id` / `success` / `chat_id` / `ai_response` / `error`） |
| `ExternalChatResponseSanitizer` | 回复清洗：剥离 `status` / `tool` / `tool_result` 标记 |
| `ExternalChatStreamingSession` | 流式会话封装，`cleanup` 幂等 |
| `A2aHttpHandler` | A2A JSON-RPC 处理：Agent Card + 6 个方法 |
| `A2aTaskManager` | A2A 任务生命周期与 `contextId`→`chatId` 映射 |
| `A2aTaskSnapshot` / `A2aTaskEvent` | 任务快照 / 状态与 Artifact 事件 |
| `ExternalChatHttpServer` | NanoHTTPD 服务：`/api/external-chat`、`/api/health`、A2A 路由 |
| `ExternalChatReceiver` | 广播入口 `com.ai.assistance.operit.EXTERNAL_CHAT` |
| `WorkflowTaskerRunner` | Tasker 动作插件执行器 |
| `WorkflowTaskerReceiver` / `WorkflowBootReceiver` | Tasker 广播触发 / 开机重排 |
| `triggerAIAgentAction` | AI 向 Tasker 发事件的出口函数 |
| `AIAgentActionEventRunner` | Tasker 侧"AI Agent Action"事件插件 |

## 输入→处理→输出调用链

1. **输入**：三路进入——HTTP POST /api/external-chat（JSON 体，stream / response_mode 选模式）；A2A POST /a2a（JSON-RPC 2.0）；广播 EXTERNAL_CHAT（12 个 extras）。HTTP 与 A2A 先过 Bearer 鉴权（`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt:125`）。
2. **处理**：各通道把请求归一化为统一请求模型（HTTP 经 toExecutionRequest，A2A 经 A2aTaskManager 构造并绑定 contextId→chatId，广播直接映射 extras）→ 执行核心定聊天目标 → 调内部工具发给 AI 执行（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt:43`）。
3. **输出**：按 returnToolStatus 清洗回复（`app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatResponseSanitizer.kt:18`）→ 按通道返回：HTTP 同步 JSON / 202+回调 POST / SSE；A2A 返回任务 JSON 或 SSE 任务事件流；广播发结果广播。

Tasker 链路：Tasker 动作/广播 → triggerWorkflowsByTaskerEvent / triggerWorkflowsByIntentEvent 匹配启用的工作流触发节点 → 执行；反向：AI 调 trigger_tasker_event → triggerAIAgentAction → Tasker 事件插件收到 task_type / arg1-5 / args_json（`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:840`）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aHttpHandler.kt`（682 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/a2a/A2aTaskManager.kt`（374 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatModels.kt`（158 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatRequestExecutor.kt`（254 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/externalchat/ExternalChatResponseSanitizer.kt`（111 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/intent/ExternalChatReceiver.kt`（123 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/tasker/AIAgentTasker.kt`（120 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerActivity.kt`（94 行）
- `app/src/main/java/com/ai/assistance/operit/integrations/tasker/WorkflowTaskerReceiver.kt`（102 行）
- 相邻：`app/src/main/java/com/ai/assistance/operit/integrations/http/ExternalChatHttpServer.kt`（路由与鉴权）、`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt`（`triggerWorkflowsByTaskerEvent` / `triggerWorkflowsByIntentEvent`）、`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`（`trigger_tasker_event` 工具）、`app/src/main/AndroidManifest.xml`（接收器与插件 Activity 注册）
