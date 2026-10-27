---
title: 工具系统（总览）
module: app
sources: 2
date: 2026-09-30
---

# 工具系统（总览）

## 概述

- 工具是 Operit 里"AI 能动手干的事"：读文件、上网搜索、发消息、调系统能力，全部以工具的形式交给模型调用。你让 AI"查一下今天的天气"，它在回复里夹带一次工具调用，App 替它执行、把结果喂回去，它再组织成自然语言回答你。
- 本页只回答两个问题：① 工具在代码里长什么样（数据模型）；② 一次工具调用在对话增强管线里怎么被调度（执行编排）。
- 工具的注册表、Hook、执行限额、进度总线、工具包模型、结果类型体系由细页 [工具注册与执行框架](entry.html?id=batch-02/core-tools-registry) 深度覆盖，本页不重复搬运。

## AI 速览

- `AITool` — 工具的定义：`name` + `parameters` + `description`。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:12`
- `ToolParameter` — 单个参数：`name` + `value` 两个字符串。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:8`
- `ToolInvocation` — 模型响应中的一次调用：`tool` + `rawText` + `responseLocation`。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:21`
- `ToolResult` — 执行结果：`toolName` + `success` + `result`（`ToolResultData`）+ `error`。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:29`
- `ToolValidationResult` — 参数校验结果：`valid` + `errorMessage`。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:37`
- `ToolExecutionManager` — `object` 单例，工具执行的总调度。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:38`
- `extractToolInvocations` — 主入口之一：从模型响应文本解析出工具调用列表。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:306`
- `executeInvocations` — 主入口之二：批量执行入口，三关拦截 → 并行/串行执行 → 有序聚合。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:504`
- `executeToolSafely` — 单调用安全包装：参数校验 → 流式执行 → 异常转失败结果。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:388`
- `aggregateToolResults` — 把 `Flow<ToolResult>` 聚合成单个 `ToolResult`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:710`
- `checkToolPermission` — 权限检查，返回是否放行与错误结果的二元组。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:429`
- `resolveToolTarget` — 代理调用（package_proxy / CLI 代理）还原出真实目标工具。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:67`
- `buildToolNotAvailableErrorMessage` — 按工具名形态构造"工具不可用"的提示文案。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:743`
- 数据流向一句话：模型响应文本 → XML 解析出 `ToolInvocation` → 三关门禁（暴露模式 / 角色卡 / Hook+权限）→ 并行或串行执行 → 流式结果聚合为 `ToolResult` → 结果标记注入回消息流。

## 核心机制

### 工具的数据长相

- 工具的定义极简：`AITool` 只有三个字段——`name`（调哪个工具）、`parameters`（参数列表，默认空）、`description`（给模型看的描述，默认空）。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:14`
- 参数是键值对：`ToolParameter` 的 `name` 和 `value` 都是字符串，复杂结构由调用方自己序列化成字符串塞进去。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:8`
- 模型"想调工具"时，真正流转的是 `ToolInvocation`：被调的 `AITool`、原始文本 `rawText`、以及调用在响应中的位置区间 `responseLocation`（`IntRange`，`@Contextual` 标注）。位置信息用来把结果插回原文对应处。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:24`
- 执行完产出 `ToolResult`：`toolName`、`success`、结构化载荷 `result`（类型 `ToolResultData`，由 `core.tools` 包提供）、失败原因 `error`（可空，默认 `null`）。成功与失败走同一个结构，调用方只看 `success` 分流。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:33`
- 参数校验的结果单独建模为 `ToolValidationResult`（`valid` + `errorMessage`），校验不过时错误信息原样拼进失败结果。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:37`
- 设计上数据与调度分离：`AITool` 家族是纯数据类（可序列化、跨层传递），`ToolExecutionManager` 只做编排、不持有任何工具实现——真正的执行器来自 `AIToolHandler` 的注册表（注册细节见 [工具注册与执行框架](entry.html?id=batch-02/core-tools-registry)）。

### 调度的五道工序（`executeInvocations`）

- 第 0 步先保底：真正执行前调 `toolHandler.registerDefaultTools()`，注释写明默认注册幂等且线程安全、可安全重复调用——启动阶段若推迟了注册，这里补上。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:521`
- 第 1 关是顶层工具暴露模式拦截：`buildToolExposureDeniedResult` 按 `toolExposureMode` 裁决。CLI 模式下调了非公开工具、或完整模式下调了 CLI 专属工具，直接判拒绝。两种模式各有一套工具集，互不串用。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:544`
- 第 2 关是角色卡准入：`callerCardId` 非空时先用 `CharacterCardToolAccessResolver` 解析出该角色卡的工具权限，再逐个判定。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:528`
- 角色卡判定按工具名形态分六路：CLI 搜索工具恒放行；CLI 代理看解析后的真实目标；use_package 先查内置准入、再查 package_name 指向的外部源；package_proxy 先查内置准入、再查解析目标；"包名:工具名"形态查包的外部源准入；普通工具名查内置准入。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:149`
- 第 3 关是 Hook 拦截与权限检查：先 `notifyToolCallRequested`，再用 `resolveToolTarget` 还原真实目标并做 `checkToolInterception`；决策为 `Allow` 时继续走 `checkToolPermission`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:575`
- Hook 决策为 `Block` 时用 `buildToolInterceptionResult` 构造拦截结果，并通知执行结束。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:588`
- 权限检查 `checkToolPermission` 里有个显眼的后门：`rawText` 含 `deny_tool` 标记时跳过权限弹窗、直接放行（通知理由记为 `"Permission check bypassed by deny_tool tag."`）。CLI 模式的搜索/代理工具同样自动放行（`"CLI public tool"`）。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:458`
- 放行后、执行前还有一步包上下文注入：调用方信息（名字/聊天 id/角色卡 id）非空时，给 JS 包工具（`包名:工具名` 且包名在可用包集合中）的调用追加三个 `__operit_package_*` 参数，让包内脚本知道"是谁在调我"。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:601`
- 第 4 步按并行/串行分组：`parallelizableToolNames` 是 12 个工具名的白名单（`list_files`、`read_file`、`read_file_part`、`read_file_full`、`file_exists`、`find_files`、`file_info`、`grep_code`、`calculate`、`ffmpeg_info`、`visit_web`、`download_file`），全部是只读/查询型工具。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:621`
- 白名单内的调用 `async` 并行跑，白名单外的串行跑。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:634`
- 第 5 步执行并有序聚合：并行任务启动后 `awaitAll` 等齐；每个结果按原始调用下标登记，全部到齐后 `finish()` 返回批量结果。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:660`
- `OrderedToolResults` 按调用下标聚合结果，结果标记经 `ensureOwnLine` 处理后由 `collector.emit` 发布。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:515`
- 结果标记通过 `collector.emit(ensureOwnLine(markup))` 写回消息流；`ensureOwnLine` 保证标记块独占一行——注释解释了原因：XML 块检测器只在行边界处开块，粘在上一行末尾的标记会被当成普通模型文本渲染，下一轮从历史里就解析不出来了。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:62`

### 单次执行的包装（`executeToolSafely`）

- 每个工具调用先过 `executor.validateParameters` 参数校验；不过则直接返回失败结果，错误形如 `"Invalid parameters: ..."`，不走到执行器。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:393`
- 执行走 `executor.invokeAndStream` 的流式接口，异常被 `catch` 接住：记日志、通知 `toolHandler.notifyToolExecutionError`，再转成 `"Tool execution error: ..."` 的失败 `ToolResult` 发出去——调用方永远拿到结构化的失败结果，而不是崩溃。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:407`
- 流式多段结果由 `aggregateToolResults` 收拢：收集 `Flow` 内的全部 `ToolResult`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:710`
- 流式结果为空时返回携带无结果 `error` 的失败 `ToolResult`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:721`
- 成功段拼文本、失败段加 `Step error` 前缀，最终 `success` 取最后一段，整体包成 `StringResultData`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:729`

### 代理调用的还原（`resolveToolTarget`）

- 调度层用 `resolveToolTarget` 还原代理调用：非代理调用原样返回，package_proxy 与 CLI 代理则从参数中抠出真实目标。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:67`
- 真实目标名取自 `tool_name` 参数。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:74`
- `params` 参数的 JSON 对象展开为目标的参数列表。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:277`
- 关键点：Hook 拦截、权限检查、错误展示用的都是解析后的真实目标名，而不是代理名——权限不会按代理名误判。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:576`
- `params` JSON 解析失败（`runCatching`）时静默返回空参数列表。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:284`
- JSON 的 `null` 值转成字符串 `"null"`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:292`

## 关键符号

- `AITool`（`name`/`parameters`/`description`）：工具定义的最小数据结构。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:12`
- `ToolInvocation`（`tool`/`rawText`/`responseLocation`）：一次调用的完整快照，位置用于结果回填。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:20`
- `ToolResult`（`toolName`/`success`/`result`/`error`）：成功失败同构的结果结构。`app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt:29`
- `ToolExecutionManager.extractToolInvocations`：响应文本 → `List<ToolInvocation>` 的解析入口（suspend）。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:306`
- `ToolExecutionManager.executeInvocations`：批量调度总入口（suspend）。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:504`
- 批量执行在 `coroutineScope` 内运行，返回 `ToolExecutionBatch`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:514`
- `ToolExecutionManager.checkToolPermission`：权限检查，返回 `(hasPermission, errorResult)`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:429`
- `ToolExecutionManager.executeToolSafely`：校验 + 流式执行 + 异常转失败结果的单调用包装。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:388`
- `ToolExecutionManager.aggregateToolResults`：`Flow<ToolResult>` 聚合成单个 `ToolResult`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:710`
- `ToolExecutionManager.buildToolNotAvailableErrorMessage`：按工具名形态（点号/冒号/纯名）构造不可用提示。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:743`
- `ToolRuntimeContext`（`callerCardId`/`toolExposureMode`）：经 `ThreadLocal` 带入执行协程的运行时上下文。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:46`
- `ToolExposureMode`（`FULL`/`CLI`）：两套互斥的工具暴露模式，定义在 `CliToolModeSupport.kt`。

## 调用链

**输入 → 解析出调用**

1. 模型响应文本进入 `extractToolInvocations`，转成字符流并用 `StreamXmlPlugin` 做 XML 块切分。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:310`
2. 每个 XML 块用 `ChatMarkupRegex.toolCallPattern` 匹配工具调用，工具名取匹配组 `[2]`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:321`
3. 参数用 `MessageContentParser.toolParamPattern` 从块体提取，值经 `unescapeXml` 还原转义，封装为 `AITool`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:330`
4. 调用位置 `toolMatch.range` 存入 `responseLocation`，供结果回填定位。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:338`

**处理 → 三关门禁与执行**

4. 批量执行先保底调 `registerDefaultTools()`，再依次过三关：暴露模式拦截 → 角色卡准入 → Hook 拦截 + 权限检查；任一关拒绝即登记失败结果，不再往下走。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:521`
5. 放行调用按需注入包调用上下文（三个 `__operit_package_*` 参数），再按 12 个只读工具白名单分成并行组与串行组。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:601`
6. 私有 executeTool 执行单个调用：用 `getToolExecutorOrActivate(toolName)` 取执行器。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:679`
7. 执行器缺失时用 `buildToolNotAvailableErrorMessage` 构造不可用错误。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:683`
8. 执行前发 `notifyToolExecutionStarted` 通知，再经 `executeToolSafely` 走流式执行。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:695`
9. `finally` 块必调 `notifyToolExecutionFinished`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:703`
10. 执行期用 `toolRuntimeContextThreadLocal.asContextElement` 把运行时上下文带入协程。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:677`

**输出 → 聚合回填**

7. 流式结果逐段收拢：成功段拼文本、失败段加 `Step error` 前缀，最终 `success` 取最后一段。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:726`
8. 结果按原始调用下标排回原顺序，`finish()` 得到批量结果。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:662`
9. 结果标记经 `ensureOwnLine` 独占一行后 `emit` 进消息流，供下一轮模型请求复用。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt:516`

## 本章地图（工具系统）

- [工具系统（总览）](entry.html?id=batch-02/core-tools)：本页——工具的数据模型与执行编排总览。
- [工具注册与执行框架](entry.html?id=batch-02/core-tools-registry)：`AIToolHandler` 注册表、Hook、限额、进度总线、工具包模型、结果类型体系（已上评审）。
- [标准工具·文件系统](entry.html?id=batch-03/core-tools-standard-filesystem)：文件读写/搜索/归档/SAF、路径校验与沙箱（规划中）。
- [标准工具·浏览器/网络/聊天/工作流](entry.html?id=batch-03/core-tools-standard-webchat)：浏览器会话、网页访问、HTTP、聊天管理、工作流、记忆查询（规划中）。
- [标准工具·系统操作/多媒体/UI](entry.html?id=batch-03/core-tools-standard-system)：系统操作、Shell/终端、多媒体、UI 自动化（规划中）。
- [网页会话·浏览器宿主](entry.html?id=batch-03/core-tools-websession-browser)：WebView 宿主架构（规划中）。
- [网页会话·用户脚本引擎](entry.html?id=batch-03/core-tools-websession-userscript)：Tampermonkey 式脚本解析与注入（规划中）。
- [工具执行模式](entry.html?id=batch-03/core-tools-execmodes)：Debugger/Root/无障碍/Admin 四种权限模式（规划中）。
- [JS 引擎与 Java 互操作桥](entry.html?id=batch-03/core-tools-jsengine)：QuickJS 引擎与 JsJavaBridge（规划中）。
- [JS 工具脚本执行与注册](entry.html?id=batch-03/core-tools-jstools)：JS 工具注册、执行上下文、超时追踪（规划中）。
- [插件包管理与解析](entry.html?id=batch-04/core-tools-packtool)：ToolPkg 解析加载与运行时监控（规划中）。
- [系统底层能力](entry.html?id=batch-04/core-tools-system)：Shell 执行器分层、Action 监听器、终端、截屏投屏（规划中）。
- [专项工具](entry.html?id=batch-04/core-tools-misc)：PhoneAgent、计算器、MCP、Skill、CLI 模式、条件工具（规划中）。

## 关联条目

- [工具注册与执行框架](entry.html?id=batch-02/core-tools-registry)：注册表与执行框架的细粒度展开，含 `AIToolHandler` 调用链与 `ToolPackage` 模型。
- [云端 Chat API 接入](entry.html?id=batch-02/api-chat)：工具调用请求的来源（对话管线）。
- [数据模型（总览）](entry.html?id=batch-02/data-model)：`AITool`、`ToolResult` 等数据类的归属说明。

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/model/AITool.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ToolExecutionManager.kt`
