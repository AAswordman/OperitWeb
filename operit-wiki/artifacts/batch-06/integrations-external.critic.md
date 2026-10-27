# Critic 复核报告：integrations-external（Issue #81）

- 复核对象：`review/batch-06/integrations-external.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方法：154 条 facts 全部机检（文件存在/行号越界/±5 窗口 token 支撑）+ 60 条人工逐条看窗口原文；
  quality 10 条 evidence 与源码逐字比对；正文断言逐条 grep 源码验真；status.json 字段核对。
- 总体 verdict：**FAIL**（事实内容基本属实，但引用锚点大面积错位，必须修锚后复验）

## 一、facts.json（154 条）

- 格式：顶层数组，字段仅 `fact`/`ref`，原子化抽查无复合事实（`；` 分隔多断言 0 条）。PASS
- 文件存在性：154 条 ref 文件全部存在，无越界行号。PASS
- 内容真实性：人工核查的 60 条中，**未发现虚构符号或与源码矛盾的断言**，事实内容基本正确。PASS
- **引用锚点：FAIL** —— 约 60 条的 ref 行号落在 ±5 窗口无法支撑断言的位置：
  - 28 条锚在空行或孤括号行（`{`/`}`/`)`/`},`）；
  - 约 35 条锚在无关代码处（差 4~40 行）；
  - 3 条连文件都引错（见下表 [112]、[130]、[144]）。

### 必须修正的锚点清单（fact 序号 → 当前 ref → 正确 ref）

| # | 当前 ref（错） | 正确 ref | 说明 |
|---|---|---|---|
| 14 | A2aHttpHandler.kt:475 | A2aHttpHandler.kt:488 | 端点 URL 由 Host 头拼接在 `buildJsonRpcEndpoint`（491 行 `return "http://$host$A2A_PATH"`） |
| 15 | A2aHttpHandler.kt:481（空行） | A2aHttpHandler.kt:488 | 拒绝含 `/`、`?`、`#` 的 Host 头即该行 |
| 20 | A2aHttpHandler.kt:443 | A2aHttpHandler.kt:454 | Content-Length 必填且 1~1MB（`MAX_REQUEST_BYTES = 1024*1024`） |
| 21 | A2aHttpHandler.kt:423 | A2aHttpHandler.kt:435 | `jsonrpc` 必须等于 `JSON_RPC_VERSION`（"2.0"） |
| 22 | A2aHttpHandler.kt:428（空行） | A2aHttpHandler.kt:439 | id 只接受 String/Number |
| 23 | A2aHttpHandler.kt:464 | A2aHttpHandler.kt:475 | `a2a-version` 不一致抛 `A2A_VERSION_NOT_SUPPORTED`（-32009，见 590 行） |
| 28 | A2aHttpHandler.kt:158 | A2aTaskManager.kt:87 | ListTasks 按 contextId/状态过滤（`listTasks` 本体） |
| 30 | A2aHttpHandler.kt:168 | A2aTaskManager.kt:264 | `requireActive && isTerminalState` 抛不支持操作异常 |
| 35 | A2aHttpHandler.kt:238 | A2aHttpHandler.kt:268 | SSE 响应头 A2A-Version/no-cache/keep-alive/X-Accel-Buffering |
| 37 | A2aHttpHandler.kt:269 | A2aHttpHandler.kt:279 | Artifact 事件序列化为 `artifactUpdate`，append=true、lastChunk=false |
| 39 | A2aHttpHandler.kt:308 | A2aHttpHandler.kt:321 | 状态错误消息 messageId 为 `${task.id}-status` |
| 40 | A2aHttpHandler.kt:320 | A2aHttpHandler.kt:334 | artifactId 为 `$taskId-result`（`artifactToJson`） |
| 48 | A2aHttpHandler.kt:378（`}`） | A2aHttpHandler.kt:379 | 多文本 part 换行拼接（380 行判空） |
| 49 | A2aHttpHandler.kt:394（`}`） | A2aHttpHandler.kt:395 | pageSize 缺省 `DEFAULT_TASK_LIST_PAGE_SIZE`=50、上限 `MAX_TASK_LIST_PAGE_SIZE`=100（596-597 行） |
| 52 | A2aHttpHandler.kt:417 | A2aHttpHandler.kt:424 | `nextPageToken` 为本页最后一个任务 id |
| 59 | A2aTaskManager.kt:93 | A2aTaskManager.kt:89 | `sortedBy(A2aTaskSnapshot::id)` |
| 60 | A2aTaskManager.kt:113（空行） | A2aTaskManager.kt:110 | `close()` 取消全部任务并清空映射 |
| 62 | A2aTaskManager.kt:128 | A2aTaskManager.kt:121 | `createNewChat = existingChatId == null` 复用/新建逻辑 |
| 63 | A2aTaskManager.kt:129（空行） | A2aTaskManager.kt:124 | A2A 任务 `returnToolStatus = false` |
| 66 | A2aTaskManager.kt:148（空行） | A2aTaskManager.kt:144 | 空分块不追加（`chunk.isNotEmpty()`） |
| 67 | A2aTaskManager.kt:152（空行） | A2aTaskManager.kt:150 | Error→`record.fail`，否则 `record.complete()` |
| 71 | A2aTaskManager.kt:167 | A2aTaskManager.kt:365 | 未知任务抛 -32001（`A2aTaskNotFoundException` 定义处） |
| 73 | A2aTaskManager.kt:358（空行） | A2aTaskManager.kt:344 | 8 种状态常量 341-348 行，锚 344 可覆盖 |
| 76 | A2aTaskManager.kt:321（空行） | A2aTaskManager.kt:105 | `awaitTerminalTask`→`awaitTerminal()`（`CompletableDeferred` 见 180 行） |
| 77 | A2aTaskManager.kt:305 | A2aTaskManager.kt:264 | 订阅已终态任务且 requireActive=true 抛异常 |
| 84 | ExternalChatModels.kt:35（空行） | ExternalChatModels.kt:42 | `ExternalChatResult` 五字段（36-49 行） |
| 85 | ExternalChatModels.kt:55 | ExternalChatModels.kt:58 | 措辞建议："在基础请求字段之外增加了 stream/response_mode/callback_url"（该类为独立 data class，非继承，字段为全量复制+3 新增） |
| 88 | ExternalChatRequestExecutor.kt:42（空行） | ExternalChatRequestExecutor.kt:43 | `execute` 同步入口（`send_message_to_ai` 组装见 202-204 行，可在 fact 中补第二引用或改锚 202） |
| 89 | ExternalChatRequestExecutor.kt:63 | ExternalChatRequestExecutor.kt:72 | `startStreaming` 入口（`startMessageToAIStream` 见 75 行，锚 72 覆盖 67-77） |
| 91 | ExternalChatRequestExecutor.kt:112（`}`） | ExternalChatRequestExecutor.kt:131 | `showFloating`→`start_chat_service` |
| 92 | ExternalChatRequestExecutor.kt:114（空行） | ExternalChatRequestExecutor.kt:134 | initial_mode/timeout_ms 参数（133/137 行） |
| 94 | ExternalChatRequestExecutor.kt:132 | ExternalChatRequestExecutor.kt:157 | createNewChat=false、chatId 空、createIfNone=false 时取当前聊天 |
| 95 | ExternalChatRequestExecutor.kt:146 | ExternalChatRequestExecutor.kt:171 | `create_new_chat`（group 参数见 173-174 行） |
| 96 | ExternalChatRequestExecutor.kt:156（空行） | ExternalChatRequestExecutor.kt:186 | sendParams 含 message/chat_id（184-189 行） |
| 97 | ExternalChatRequestExecutor.kt:164 | ExternalChatRequestExecutor.kt:192 | `timeoutMs > 0` 才传 timeout_ms |
| 98 | ExternalChatRequestExecutor.kt:176 | ExternalChatRequestExecutor.kt:207 | `stopAfter`→cleanup 调 `stop_chat_service`（210 行） |
| 99 | ExternalChatRequestExecutor.kt:200 | ExternalChatRequestExecutor.kt:228 | `sanitize(resultData?.aiResponse, returnToolStatus)` |
| 101 | ExternalChatResponseSanitizer.kt:14 | ExternalChatResponseSanitizer.kt:18 | returnToolStatus=true 原样返回（当前锚窗口恰好覆盖 18 行，算弱 PASS，建议改 18） |
| 102 | ExternalChatResponseSanitizer.kt:84（`}`） | ExternalChatResponseSanitizer.kt:91 | 剥离 status/tool/tool_result 三类标签（88-93 行） |
| 104 | ExternalChatResponseSanitizer.kt:55（空行） | ExternalChatResponseSanitizer.kt:70 | 32 字符批量/自然边界刷新（70-73 行） |
| 112 | ExternalChatHttpServer.kt:110（`}`，**文件错**） | ExternalChatModels.kt:133 | 健康响应字段在 `ExternalChatHealthResponse`（129-139 行） |
| 113 | ExternalChatHttpServer.kt:122（空行） | ExternalChatHttpServer.kt:125 | `handleChat` 先 Bearer 鉴权 |
| 114 | ExternalChatHttpServer.kt:126 | ExternalChatHttpServer.kt:435 | Content-Length 校验在 `readRequestBody`（437-444 行） |
| 115 | ExternalChatHttpServer.kt:152 | ExternalChatHttpServer.kt:165 | response_mode 非法→400（165-172 行） |
| 116 | ExternalChatHttpServer.kt:170 | ExternalChatHttpServer.kt:186 | stream+async_callback 混用拒绝（186-194 行） |
| 117 | ExternalChatHttpServer.kt:179 | ExternalChatHttpServer.kt:197 | stream=true 走 SSE（197-199 行） |
| 118 | ExternalChatHttpServer.kt:195（`}`） | ExternalChatHttpServer.kt:213 | callback_url 必须 http/https（213-222 行） |
| 119 | ExternalChatHttpServer.kt:203 | ExternalChatHttpServer.kt:229 | 202 Accepted + 后台执行回调（224-231 行） |
| 120 | ExternalChatHttpServer.kt:218 | ExternalChatHttpServer.kt:236 | sync 用 `runBlocking` 直接返回 |
| 126 | ExternalChatHttpServer.kt:525 | ExternalChatHttpServer.kt:539 | `Access-Control-Allow-Origin: *`（`withCors`，539-542 行） |
| 127 | ExternalChatHttpServer.kt:92（空行） | ExternalChatHttpServer.kt:96 | SSE（text/event-stream）禁用 gzip（94-99 行 `useGzipWhenAccepted`） |
| 130 | ExternalChatReceiver.kt:14（**缺 exported 证据**） | AndroidManifest.xml:385 | exported=true 无权限的原文只在 manifest（385-391 行） |
| 135 | ExternalChatReceiver.kt:100 | ExternalChatReceiver.kt:112 | 结果广播 extras（108-119 行 putExtra） |
| 137 | WorkflowTaskerActivity.kt:23（空行） | WorkflowTaskerActivity.kt:22 | `WorkflowTaskerActivityConfig` 类声明 |
| 143 | WorkflowRepository.kt:845（空行） | WorkflowRepository.kt:846 | `workflows.filter { it.enabled }` |
| 144 | WorkflowTaskerReceiver.kt:61（空行，**文件错**） | AndroidManifest.xml:460 | exported receiver 注册（460-466 行，TRIGGER_WORKFLOW + FIRE_SETTING） |
| 145 | WorkflowTaskerReceiver.kt:47 | WorkflowTaskerReceiver.kt:30 | `createTriggerIntent` 用 `setPackage` 限定本应用（29-33 行） |
| 146 | WorkflowTaskerReceiver.kt:35（空行） | WorkflowRepository.kt:897 | action 忽略大小写相等（`expectedAction.equals(intent.action, ignoreCase = true)`） |
| 148 | WorkflowTaskerReceiver.kt:84 | WorkflowTaskerReceiver.kt:74 | `WorkflowBootReceiver` 判 `ACTION_BOOT_COMPLETED`（67/74 行，建议锚 74） |
| 149 | AIAgentTasker.kt:17（import 行） | AIAgentTasker.kt:29 | `AIAgentActionUpdate` 字段跨 20-39 行，单锚无法全覆盖，建议拆成两条或锚 29 并注明 |
| 152 | AIAgentTasker.kt:107（`}`） | AIAgentTasker.kt:116 | `argsJson = Gson().toJson(args)`（109-118 行） |

其余约 94 条抽查锚点与窗口一致，结论 PASS（示例：[6][7][8] Agent Card 字段、[24][25] SendMessage 阻塞语义、
[55] contextId→chatId 映射、[61] createIfNone=false、[65] sanitizeStream、[68] 取消语义、[81] createIfNone 缺省 true、
[86] response_mode 非法返回 null、[100] AtomicBoolean cleanup、[105] 0.0.0.0、[106] 双持有、[107]-[110] 四条路由、
[129] AIForegroundService 创建服务）。

## 二、quality.json（10 条）

- evidence 逐字比对：10/10 在源码中逐字命中。PASS
- severity 合理性：两条 high 均实锤（manifest 原文见下），6 warn / 3 suggestion 量级恰当。PASS
- **锚点问题 2 条**：
  - [5]（隐式结果广播）：evidence `if (!packageName.isNullOrBlank()) { out.package = packageName }` 实际在
    ExternalChatReceiver.kt:105-106，当前锚 96 行超出 ±5 窗口 → 改锚 105。
  - [8]（Host 头拼端点）：evidence `return "http://$host$A2A_PATH"` 实际在 A2aHttpHandler.kt:491，
    当前锚 485 行差 6 行 → 改锚 491。另建议在 description 补一句緩解说明：
    `buildJsonRpcEndpoint` 已校验 Host 不含 `/`、`?`、`#`（488-489 行），注入面有限，故维持 suggestion 不升级。
- 两条 high 复核实锤：
  - [0] `ExternalChatReceiver`：manifest 385-391 行，`android:exported="true"` 且无 `android:permission`，
    action 为 `com.ai.assistance.operit.EXTERNAL_CHAT`。任意第三方应用可发送广播借 Operit 身份发起 AI 聊天。HIGH 成立。
  - [1] `WorkflowTaskerReceiver`：manifest 460-466 行，`android:exported="true"` 无权限，
    监听 `TRIGGER_WORKFLOW` 与 Tasker 的 `FIRE_SETTING`。HIGH 成立。
- 其余 [2][3][4][6][7][9]：锚点与 evidence 一致，描述与源码相符。PASS

## 三、正文 integrations-external.md

- 结构：概述 / AI 速览 / 核心机制 / 关键符号 / 输入→处理→输出 / 来源，符合双受众模板。PASS
- 事实断言抽查（grep 源码逐条验真）：Agent Card skill `operit-chat`（A2aHttpHandler.kt:69）、
  version 取自 `BuildConfig.VERSION_NAME`（:90）、只收 ROLE_USER（:356）、messageId 必填（:359）、
  带 taskId 拒绝（:360-363）、acceptedOutputModes 无 text/plain 拒绝（:668-680）、
  SSE 事件 start/delta/done/error（ExternalChatHttpServer.kt:556-559）、无 token 直接 401
  （:379-389）、`WorkflowTaskerRunner` 存在（WorkflowTaskerActivity.kt:69）、
  `trigger_tasker_event` 工具存在（ToolRegistration.kt:1464）、`toExecutionRequest`（ExternalChatModels.kt:100）、
  来源 9 文件行数与实际一致（682/374/158/254/111/123/120/94/102）。PASS
- **FAIL：正文零行内 `file:line` 引用**。writer 任务书明确要求"行内引用格式为 file:line"，
  batch-05 惯例（如 data-mcp.md 有 99 处行内引用），本页正文只有"来源"文件列表，
  关键断言（6 个 A2A 方法、三种响应模式、Tasker 三条路等）无行内锚点。必须补行内引用。

## 四、status.json / lint.md

- status.json：`id`=integrations-external、`issue`=81、`status`=review-pending、
  `source_commit`=dbf71916fae9750cfdc9f9a774f5a0fee56633fb、`refs_valid`=154（与 facts 条数一致）。PASS
- lint.md：记录 0 硬失败/0 警告；本地复跑 lint.py（排除 .lint.md 自扫）确为 0/0。PASS
- 5 文件全文无"通过/批准/LGTM"。PASS

## 总体 verdict：FAIL

必须修的问题清单（修完后需另一名独立 critic 复验）：

1. 按上表修正约 60 条 facts 的 ref 行号（含 [112]、[130]、[144] 三处文件级纠正）；
   [85] 措辞微调（独立 data class，非继承）；[88] 建议锚改 202 或补第二引用覆盖 `send_message_to_ai`。
2. quality [5] 改锚 ExternalChatReceiver.kt:105；quality [8] 改锚 A2aHttpHandler.kt:491，
   并在 [8] 描述中补充 Host 校验緩解说明（488-489 行）。
3. 正文补行内 `file:line` 引用（参照 batch-05 惯例，核心机制每节关键断言都要有）。
4. 修完后重跑 lint（0/0），重检禁用词，更新 `refs_valid`（若条数有变）。
