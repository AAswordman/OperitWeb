---
title: 标准工具·浏览器/网络/聊天/工作流
module: core
sources: 6
date: 2026-10-01
---

# 标准工具·浏览器/网络/聊天/工作流

## 概述

- 本页覆盖 `standard/` 目录下 6 组标准工具：浏览器会话操控（22 个 `browser_*`）、一次性网页访问（`visit_web`）、HTTP 请求（`http_request`/`multipart_request`/`manage_cookies`）、聊天管理（15 个会话操作）、工作流（创建/更新/触发）、记忆查询与管理（12 个记忆工具）。
- 这 6 组都是 AI 可直接调用的内置工具：浏览器组管"动手操作网页"，`visit_web` 管"快速读网页"，HTTP 组管"调外部接口"，聊天组管"会话本身"，工作流组管"多步任务编排"，记忆组管"长期记忆的存取"。
- 能力分界要记牢：`browser_*` 是**持久化多 Tab 的交互式操控**（点、填、截屏），`visit_web` 是**一次性只读抓取**（无任何交互原语），两者互补不重叠。

## AI 速览

- 核心符号：`StandardBrowserSessionTools`（invoke 分发 22 工具）、`StandardWebVisitTool`（单次抓取）、`StandardHttpTools`（prepareHttpRequest 预处理）、`StandardChatManagerTool`（经 FloatingChatService 操作会话）、`StandardWorkflowTools`（WorkflowRepository 持久化）、`MemoryQueryToolExecutor`（invoke 分发 12 工具）。
- 主入口：`ToolRegistration.kt` 集中注册（浏览器 1230 行起、visit_web 1206 行、HTTP 1967 行起、聊天 1612 行起、记忆 809 行起、工作流 1524/1599 行）。
- 数据流向一句话：AI 发起工具调用 → 各执行器按参数校验后执行 → 浏览器走 WebView 悬浮会话、HTTP 走 OkHttp、聊天走 ChatServiceCore、记忆走 MemoryRepository → 结果包成 ToolResult 返回。
- 关键常量：浏览器动作默认超时 10s；visit_web 正文内联上限 12000 字符；HTTP 默认超时 15/20/15s；AI 回复等待 180s；记忆查询快照每 profile 上限 32 个。

## 核心机制

### 浏览器会话操控（StandardBrowserSessionTools）

- **会话是进程级常驻的**：`sessions: ConcurrentHashMap<String, WebSession>` 存全部会话，`sessionOrder` 维护 Tab 顺序，`activeSessionId` 指向当前会话。会话不随单次调用销毁，这就是它能做"登录后翻页"这类多步任务的原因。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:101`
- **22 个工具分三组**：`browser_click`、`browser_close`、`browser_close_all`、`browser_console_messages`、`browser_drag`、`browser_evaluate`、`browser_file_upload`、`browser_fill_form`（点击/关闭/控制台/拖拽/求值/上传/填表）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:219`
- `browser_handle_dialog`、`browser_hover`、`browser_navigate`、`browser_navigate_back`、`browser_network_requests`、`browser_press_key`、`browser_resize`、`browser_run_code`（对话框/悬停/导航/网络/按键/视口/代码执行）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:227`
- `browser_select_option`、`browser_wait_for`、`browser_snapshot`、`browser_tabs`、`browser_take_screenshot`、`browser_type`（下拉/等待/快照/多 Tab/截图/打字）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:234`
- **元素定位靠"快照 ref"**：点击、打字、填表等工具不直接用坐标，而是引用页面快照里的元素 ref；ref 不在快照中就报错并提示重新抓快照。这是 Playwright 风格的定位方式，比坐标稳定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:286`
- **动作有"结算"管线**：每次动作前 `captureActionMarkers` 记录标记，执行后 `settleBrowserAction` 按策略等待页面稳定（文档 ready、导航变化、目标文本出现、固定等待），默认动作超时 10 秒。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:259`
- **主线程同步有熔断**：WebView 操作必须在主线程，`runOnMainSync` 用 `mainHandler.post + CountDownLatch` 同步等待，默认 8 秒超时抛错，防止无限卡死。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:1775`
- **权限门**：`browserNavigate` 先调 `ensureOverlayPermission` 检查悬浮窗权限，无权限直接返回错误——因为浏览器 UI 是悬浮窗形态。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:248`
- 视口调整（1402 行）与 tabs 的 create 分支（1542 行）同样先过悬浮窗权限检查（`ensureOverlayPermission`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:1402``app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:1542`
- **资源上限防滥用**：视口有三重上限（单边 4096 CSS 像素、总像素 8388608、布局像素 33554432），截图有像素上限常量。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:1401`

### 一次性网页访问（StandardWebVisitTool）

- **定位是"只读快读"**：无点击、无填表、无截图。适合"读一篇文章正文"这种场景；需要登录或交互就换浏览器会话工具。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:93`
- **抓取链路**：
  1. 输入：`url`，或 `visit_key` + `link_number`（沿上次抓取的链接列表续访）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:136`
  2. 处理：scheme 只放行 http/https；起 1×1 像素不可触摸的悬浮 WebView 加载页面，注入 JS 提取超链接、meta、正文（`document.body.innerText`），自动滚动触底触发懒加载。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:210`
  3. 输出：正文 ≤12000 字符直接内联；超限写 App 内部 `cleanOnExit` 目录文件，只给前 8000 字符预览并标记 `contentTruncated`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:477`
- **抓完即焚**：`cleanupWebView` 做完整清理——停加载、清历史/缓存/表单/SSL 偏好、跳 `about:blank`、`destroy()` 并 `System.gc()`，不留痕迹。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:916`
- **请求头防注入**：自定义 headers 经过清洗，头名含换行或冒号直接丢弃，头值剥离换行符。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:1649`
- **续访机制**：每次抓取结果进进程级 `visitCache`（key 为 UUID），`getCachedVisitResult` 供外部按 key 取回。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:108`
- `link_number` 参数：取上次抓取链接列表的第 N 个继续访问。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:139`

### HTTP 请求（StandardHttpTools）

- **请求构造**（`prepareHttpRequest`）：
1. 输入：`url`（必填，仅 http/https）、`method`（默认 GET，仅允许 8 种标准方法）、`headers`（JSON，解析失败静默为空）、`body` + `body_type`（json/form/text/xml；GET/HEAD 强制无 body）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:210`
  body 类型传 `multipart` 会被明确拒绝，并指引改用 `multipart_request`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:287`
  2. 处理：按 `connect_timeout`/`read_timeout`/`write_timeout`（默认 15/20/15 秒）构造 OkHttpClient；可选 HTTP 代理；可选把 `custom_cookies` 写入共享 Cookie 池；`ignore_ssl=true` 则关闭 TLS 校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:221`
  3. 输出：`HttpResponseData`（状态码、全部响应头、Content-Type、文本内容、Base64 内容、字节数、当次 Cookie）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:178`
- **响应处理要点**：按 Content-Type 声明的 charset 解码（默认 UTF-8），解码失败文本字段写 `[Binary Content, decoding failed]`；**不做 2xx 校验**——404/500 也返回 `success=true`，状态码只记在字段里，调用方自己判断。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:315`
- **流式**：`httpRequestStream` 是流式请求入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:344`
- 先发 `response_started` 事件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:365`
- 再按 1024 字符块发 `chunk`（带 `chunkIndex` 与累计字节数），最后发完整结果。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:399`
- **Cookie 管理**：工具 `manage_cookies` 在 ToolRegistration 注册。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:2008`
- `manageCookies` 的 `get` 按 domain 查共享池（空 domain 返回全部）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:515`
- `set` 要求 domain 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:552`
- `clear` 在空 domain 时连系统 WebView Cookie 一起清。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:580`
- **文件上传**：工具 `multipart_request` 仅允许 POST/PUT，在 ToolRegistration 注册。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1989`
- `multipartRequest` 解析 `files` 数组。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:623`
- 每项需 `field_name` + `file_path`，文件不存在或不可读直接报错。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:726`
- **无重试**：四个入口的异常都转成失败 ToolResult，headers/cookies 解析失败静默降级，不自动重试。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:339`

### 聊天管理（StandardChatManagerTool）

- **会话是"导演"在管**：本工具不直接碰数据库，而是绑定 `FloatingChatService` 拿到 `ChatServiceCore` 再操作。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:40`
- 会话数据经 `ChatHistoryManager` 单例持久化，当前会话由 `currentChatIdFlow` 维护。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:876`
- **会话 CRUD（15 个工具，在 ToolRegistration 注册）**：`start_chat_service`、`stop_chat_service`：聊天服务的启停。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1615`
- `create_new_chat`：建新会话（支持分组、设为当前、绑定角色卡）。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1626`
- `list_chats`、`find_chat`：查会话列表 / 按 id 或标题找会话。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1643`
- `agent_status`、`switch_chat`：查 Agent 状态 / 切换当前会话。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1662`
- `update_chat_title`、`delete_chat`：改标题 / 删会话。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1682`
- `send_message_to_ai`、`send_message_to_ai_streaming`：发消息（同步阻塞 / 流式）。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1702`
- `call_chat_model`、`list_character_cards`：直调模型 / 列角色卡。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1733`
- `get_chat_messages`：读会话历史。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1744`
- `get_chat_messages_range`：按下标范围读历史。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1757`
- `deleteChat`：删除会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:983`
- 其中 `locked` 标记为 true 的会话拒绝删除。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1006`
- **读历史**：`getChatMessages` 读会话历史。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:534`
- `order` 仅取 asc/desc（默认 desc）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:546`
- `limit` 默认 20，钳制 1–200。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:569`
- `getChatMessagesRange` 按下标范围读历史。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:604`
- `start`/`end` 要求是整数，且满足 0≤start≤end。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:663`
- 历史里会过滤掉 `sender` 为 `summary` 的消息并剥离协议 XML 块。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:514`
- **发消息链路**：
1. 输入：`message` 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1738`
  - `runtime`：默认 floating 槽位。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1723`
  - `timeout_ms`：等待超时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1774`
  - `chat_id`：指定则后台发送到该会话、不切换 UI。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1853`
  2. 处理：并发预检——等待目标会话无活跃流，否则返回 "Previous message is still being processed"；经 `core.sendUserMessage` 投递，等待新的响应流。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1873`
3. 输出：同步版阻塞收集完整回复（默认 180 秒超时）；流式版走 `channelFlow`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:2057`
  - 先发 `start` 事件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:2093`
  - 再按块发 `chunk` 事件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:2115`
- **直接调模型**：`callChatModel` 是不经过会话的直调模型入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1667`
- 底层走 `EnhancedAIService` 的 `callFunctionModel`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1692`
- `function_type` 与 `turns` 必填且逐项校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1673`
- **状态查询**：`agentStatus` 查询 Agent 当前状态。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:714`
- 内部 `InputProcessingState`（如 `Idle`、`Completed`）映射为可读的状态字符串。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:753`
- **熔断器**：`floating_chat_prefs` 标记 `service_disabled_due_to_crashes=true` 时拒绝启动/绑定聊天服务，防止崩溃循环。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1110`

### 工作流（StandardWorkflowTools）

- **工作流的数据模型**：`Workflow`（`id`/`name`/`description`/`nodes`/`connections`/`enabled`）。`app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:15`
- 节点分 trigger（触发器）、execute（执行）、condition（条件）、logic（逻辑）、extract（提取）五种类型，经 `WorkflowRepository` 持久化。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:39`
- **增量更新是亮点**：`patchWorkflow` 是工作流增量更新入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:449`
- 接受 `node_patches`/`connection_patches` 两种 patch 数组。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:479`
- 每项 op 只能是 add/update/remove。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:688`
- `add` 时 id 重复直接抛错。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:693`
- `update` 要求节点存在，`remove` 级联删相关连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:706`
- 不允许改节点类型。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:543`
- patch 结束自动清理非法连接（引用不存在的节点或自环）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:785`
- **节点间传数据**：`ParameterValue.NodeReference(nodeId)`——执行节点的 actionConfig、条件节点的 left/right、提取节点的 source 都可以引用其他节点的输出，形成数据流。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:1281`
- **触发**：`triggerWorkflow` 手动触发工作流。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:884`
- 对 `CancellationException` 特殊处理：在 `NonCancellable` 上下文里先取消工作流再重新抛出，保证取消语义不丢失。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:914`
- **边界**：`TriggerNode.triggerType` 缺省 `manual`；定时/条件触发的语义不在本文件实现，只解析存储，实际由 WorkflowRepository/引擎侧决定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt:987`

### 记忆查询与管理（MemoryQueryToolExecutor）

- **12 个工具一次看清**：查（`query_memory`、`get_memory_by_title`）、增删改（`create_memory`、`update_memory`、`delete_memory`、`move_memory`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:193`
- 用户画像（`update_user_profile`、`update_user_preferences`）、链接管理（`link_memories`、`query_memory_links`、`update_memory_link`、`delete_memory_link`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:199`
- `invoke` 按工具名分发，未知名返回 "Unknown tool"。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:188`
- **混合检索**：关键词、标签、语义向量、图边四权重加权（`keywordWeight`/`tagWeight`/`vectorWeight`/`edgeWeight`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:303`
- `threshold` 缺省 0.0；`start_time`/`end_time` 只过滤创建时间。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:222`
- **跨次去重**：同一 `snapshot_id` 内已返回的记忆 id 不再返回；每个 profile 最多 32 个快照，超限按最后访问时间淘汰最老的。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:218`
- **文档分块读**：`executeGetMemoryByTitle` 对文档节点支持分块读取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:340`
- 优先级：`query` 模糊搜块 > `chunk_range` 范围取块 > `chunk_index` 单块，都有越界校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:355`
- **CRUD 按标题定位**：`create_memory` 要求 title + content 双必填；update/delete/move 按标题找，不存在直接失败；`move_memory` 支持按标题集合和/或源文件夹批量移动。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:198`
- **记忆链接是图**：`executeLinkMemories` 在两个记忆间建有向边。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:807`
- `link_type` 缺省 `related`，`weight` 缺省 0.7、钳制 0–1。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:825`
- 更新/删除支持 `link_id` 直接定位，或按源+目标标题定位。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:890`
- **多 profile 隔离**：每个 profileId 独立 `MemoryRepository`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:94`
- 角色卡绑定 `FIXED_PROFILE` 模式时用绑定 profile，否则用活跃记忆空间。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:80`

## 关键符号

- `StandardBrowserSessionTools`：22 个 `browser_*` 的执行器；`WebSession`（id/webView/currentUrl/pageLoaded/isLoading）；`sessions`（进程级会话表）；`BrowserActionSettlementPolicy`（动作结算策略）；`runOnMainSync`（主线程同步，8s 超时）。
- `StandardWebVisitTool`：`visitWebPage`（抓取主流程）；`extractPageContent`（JS 提取）；`persistVisitContentIfNeeded`（超长落盘）；`visitCache`（续访缓存）；`MAX_INLINE_VISIT_CONTENT_CHARS = 12_000`。
- `StandardHttpTools`：`prepareHttpRequest`（请求预处理）；`httpRequest`/`httpRequestStream`（同步/流式）；`manageCookies`；`multipartRequest`；`cookieStore`（进程级共享 Cookie 池）；`applyUnsafeSsl`（关闭 TLS 校验）。
- `StandardChatManagerTool`：`sendMessageToAI`/`sendMessageToAIStream`（发消息）；`startMessageToAIStream`（并发预检）；`callChatModel`（直调模型）；`agentStatus`（状态映射）；`AI_RESPONSE_TIMEOUT = 180000L`。
- `StandardWorkflowTools`：`WorkflowRepository`（持久层）；`createWorkflow`/`updateWorkflow`/`patchWorkflow`/`deleteWorkflow`/`triggerWorkflow`；`WorkflowNode` 五种子类；`ParameterValue.NodeReference`（节点间引用）。
- `MemoryQueryToolExecutor`：`executeQueryMemory`（混合检索）；`buildResultData`（结果格式化）；`getOrCreateQuerySnapshot`（去重快照）；`MemoryRepository`（按 profile 隔离）；`MAX_QUERY_SNAPSHOTS_PER_PROFILE = 32`。

## 调用链

### 浏览器操控（browser_click 为例）

1. 输入：`AITool(name="browser_click", parameters={ref, button, modifiers, doubleClick})` → `invoke` 按名分发。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:213`
2. 处理：`browserClick` 经 `getSession` 取活动会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:287`
  - `requireSnapshotNode` 校验 ref 在快照中，不在则报错提示重抓。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:315`
  - `captureActionMarkers` 记录动作前标记。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:322`
  - `dispatchClickByRef` 在页面 JS 里定位元素（含 iframe 穿透）派发鼠标事件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:343`
  - `settleBrowserAction` 等待页面稳定后返回。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:377`
3. 输出：`buildSettledBrowserResponse` 拼装结果（含回显的 Playwright 风格代码串、新快照、控制台增量、下载事件）→ `ToolResult`。

### 网页抓取（visit_web）

1. 输入：`url` 或 `visit_key` + `link_number` → scheme 校验 → `visitWebPage`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:373`
2. 处理：`visitWebPage` 用 `runBlocking` 包起协程，拉起 1×1 悬浮 WebView 抓取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:379`
  - `loadWebPageAndExtractContent` 负责加载页面。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:548`
  - `extractPageContent` 注入 JS 提取正文与链接，`autoScrollToBottom` 滚动触底触发懒加载。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:1190`
  - 最后 `cleanupWebView` 销毁 WebView。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt:916`
3. 输出：`VisitWebResultData`（title/url/content/links/imageLinks）→ 超长则 `persistVisitContentIfNeeded` 落盘 → 写入 `visitCache` → `ToolResult`。

### HTTP 请求（http_request）

1. 输入：`url`/`method`/`headers`/`body`/`body_type`/超时/代理/Cookie/ignore_ssl → `prepareHttpRequest` 校验并构造 OkHttpClient + Request。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:208`
2. 处理：`httpRequest` 执行请求。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:315`
  - `readResponseBody` 读字节并按 charset 解码文本。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:148`
  - `readResponseBodyAsBase64` 把原始字节编成 Base64。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:159`
  - `buildHttpResponseData` 组装（含响应头与当次 Cookie）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt:178`
3. 输出：`HttpResponseData` 包成 `ToolResult`（success=true 与状态码无关）。

### 发消息到 AI（send_message_to_ai_streaming）

1. 输入：`message` 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1738`
  - `runtime`：默认 floating 槽位。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1723`
  - `timeout_ms`：等待超时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1774`
  - `chat_id`：指定则后台发送到该会话、不切换 UI。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:1853`
2. 处理：`core.sendUserMessage(chatIdOverride=...)` 投递 → 等待新的响应流 → `sendMessageToAIStream` 用 `channelFlow` 收集。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt:2057`
3. 输出：`start` 事件 → 若干 `chunk` → 终局 `MessageSendResultData(aiResponse, receivedAt)` → `ToolResult`。

### 记忆查询（query_memory）

1. 输入：`query`（必填，`*` 为通配）、`folder_path`、`limit`、`start_time`/`end_time`、`threshold`、`snapshot_id` → 参数校验（阈值非负、时间格式合法、start≤end）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:219`
2. 处理：读搜索设置（四权重 + scoreMode）→ `memoryRepository.searchMemories(...)` → 快照锁内过滤已见 id、取 limit 条、记入 seen。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt:300`
3. 输出：`buildResultData` 格式化（文档节点二次探查拼分块、通配查询给摘要）→ `MemoryQueryResultData`（memories + snapshotId + 去重排除数）→ `ToolResult`。

## 关联条目

- [[core-tools|工具系统（总览）]]：总览页，本页是其"浏览器/网络/聊天/工作流"分支的细化。
- [[core-tools-standard-filesystem|标准工具·文件/终端]]：兄弟页，同目录下文件系统与终端工具。
- [[core-tools-standard-system|标准工具·系统/设备]]：兄弟页，同目录下系统操作与设备信息工具。
- [[core-tools-websession-browser|浏览器 WebSession 底层]]：浏览器会话的 websession.browser 底层实现（快照、结算、JS 桥）。
- [[core-chat|聊天与消息处理（总览）]]：`ChatServiceCore` 与消息处理链路的归属页。
- [[data-model|数据模型（总览）]]：`ToolResult`、`HttpResponseData`、`VisitWebResultData` 等结果类型的归属页。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWebVisitTool.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardHttpTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardChatManagerTool.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardWorkflowTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/MemoryQueryToolExecutor.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt`
