---
title: 工具注册与执行框架
module: core
sources: 7
date: 2026-09-30
---

# 工具注册与执行框架

## 概述

- 调度核心是 `AIToolHandler`（单例），集中管理工具的注册、钩子与执行。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:29`
- 注册表是它内部的 `availableTools`（`ConcurrentHashMap`），按工具名映射执行器。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:45`

## 注册机制

- `registerTool` 是唯一的注册方法，同名重复注册会直接覆盖旧执行器。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:184`
- `registerTool` 另有重载，接受 `(AITool) -> ToolResult` 类型的 lambda，简化无流式需求的工具注册。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:193`
- 上述 lambda 重载内部被包成匿名 `object : ToolExecutor`。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:202`
- `registerDefaultTools()` 用双重检查保证全部内置工具只注册一次。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:211`
- 幂等标志 `defaultToolsRegistered` 是 `AtomicBoolean` 类型。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:48`
- `unregisterTool(toolName)` 按名移除注册。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:59`
- `reset()` 在同一 `synchronized` 块内清空注册表、置空 `packageManagerInstance`、重置注册标志。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:277`
- `getAllToolNames()` 返回当前已注册的全部工具名。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:160`

## 集中注册（ToolRegistration）

- `registerAllTools` 是集中注册全部内置工具的顶层函数。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:36`
- 文件内共调用 `handler.registerTool` 182 次，工具名无重复。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:270`
- `execute_shell` 在注释中标注为"不在提示词加入的工具"。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:270`
- `close_all_virtual_displays` 同样标注为不在提示词加入。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:282`
- 注册按功能分组组织：shell/终端、音乐播放、软件设置、记忆组、蓝牙组等。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:270`
- `use_package` 通过包管理器激活沙盒包。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1002`
- 浏览器工具组共 22 个，以 `browser_click` 起始。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1230`
- 浏览器工具组以 `browser_wait_for` 结束。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1373`
- 蓝牙工具组覆盖经典蓝牙与 BLE，以 `get_bluetooth_state` 起始。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:2432`
- 计算器工具用 `getCalculator().evalExpression(expression)` 求表达式的值。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1187`

## 执行框架（调用链）

- `executeTool(tool: AITool): ToolResult` 是同步执行入口。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:363`
- 调用链共 8 步：
  1. `notifyToolCallRequested(tool)` 通知钩子"收到调用请求"。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:95`
  2. `checkToolInterception(tool)` 逐个询问钩子是否放行。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:100`
  3. 拦截决策类型是 `AIToolHookDecision.Block`（携带原因字符串）。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:7`
  4. 钩子回调本身抛异常时直接按阻断处理（fail-closed）。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:107`
  5. 被拦截时用 `buildToolInterceptionResult` 构造失败结果并返回。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:120`
  - 构造的结果 `success=false`、`error` 为拦截原因。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:126`
  6. `getToolExecutorOrActivate(tool.name)` 获取执行器：缺失时先补一次默认注册。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:303`
  7. 工具名含冒号时自动调用 `usePackage` 激活对应工具包。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:324`
  8. MCP 包可用但服务不活跃时自动重新激活。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:345`
- 执行器仍缺失则返回 `Tool not found` 的失败结果。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:383`
- `executor.validateParameters(tool)` 做参数校验。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:391`
- 参数校验不通过时返回携带 `errorMessage` 的失败结果。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:398`
- `notifyToolExecutionStarted` 后调用 `executor.invoke(tool)`。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:405`
- 成功时 `notifyToolExecutionResult`；抛异常时 `notifyToolExecutionError` 并重新抛出。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:408`
- `finally` 中必调 `notifyToolExecutionFinished`。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:414`
- `executeToolAndStream(tool): Flow<ToolResult>` 是流式执行入口：拦截、缺失、校验逻辑与同步入口一致。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:419`
- 流式入口把执行器的中间结果逐个 `emit` 并通知钩子。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:467`
- `ToolExecutor` 接口只强制实现 `invoke`。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:479`
- `invokeAndStream` 默认实现为 `flowOf(invoke(tool))`。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:482`
- `validateParameters` 默认返回有效。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:488`
- 4 个内置工具用匿名 `object : ToolExecutor` 同时覆写 `invoke` 与 `invokeAndStream`，支持真正的流式输出。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:341`
  - `execute_in_terminal_session_streaming`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:331`
  - `send_message_to_ai_streaming`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1707`
  - `http_request`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1967`
  - `apply_file`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:2123`
- `replaceToolInvocation` 按调用位置切开响应原文，把调用点替换为结果块。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:233`
- 结果块以 `**Tool Result [工具名]:**` 为标题头。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:249`

## Hook 机制

- `AIToolHookDecision` 是密封类，只有 `Allow` 与携带 `reason` 字符串的 `Block` 两种决策。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:7`
- `AIToolHook` 接口定义 7 个生命周期回调，全部有默认空实现。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:16`
- `onToolCallRequested`：收到调用请求。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:18`
- `onToolCallIntercept` 是唯一能阻断调用的决策点，默认返回 `Allow`。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:21`
- `onToolPermissionChecked`：权限检查完成后。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:24`
- `onToolExecutionStarted`：实际执行开始前。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:27`
- `onToolExecutionResult`：产出执行结果时。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:30`
- `onToolExecutionError`：执行抛异常时。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:33`
- `onToolExecutionFinished`：请求生命周期结束时。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt:36`
- 钩子存放在 `CopyOnWriteArrayList` 中。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:46`
- `addToolHook` 添加时判重。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:67`
- 钩子回调按文档要求必须是轻量的。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:67`
- `notifyHooks` 对每个钩子回调用 `try/catch` 包裹，单个钩子异常只记日志。`app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt:84`

## 执行限额（ToolExecutionLimits）

- `MAX_FILE_READ_BYTES = 32_000`：文件读取的字节上限。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt:4`
- `DEFAULT_FILE_READ_PART_LINES = 200`：文件分段读取的默认行数。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt:5`
- `MAX_TEXT_RESULT_LENGTH = 5_000`：文本结果的长度上限。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt:6`
- `MAX_SINGLE_TOOL_RESULT_MESSAGE_CHARS` 等于 `MAX_FILE_READ_BYTES` 的两倍：单个工具结果发回模型的字符上限。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt:8`

## 进度总线（ToolProgressBus）

- `ToolProgressEvent` 包含 `toolName`、`progress`、`message`、`priority`、`level`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:7`
- `ToolProgressBus` 是 object 单例，对外暴露 `StateFlow<ToolProgressEvent?>` 类型的进度流。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:15`
- `SUMMARY_PROGRESS_TOOL_NAME` 为 `"__SUMMARY__"`，优先级 1000 全场最高。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:16`
- 工具进度优先级：`grep_context`（100）、`grep_code`（10）、`find_files`（5），其余为 0。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:21`
- 进度更新只在四种情况下替换当前事件：无当前事件、同一工具、当前进度已完成、新优先级更高。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:46`
- 同优先级时 `level` 更高才替换。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:50`
- `clear()` 把进度流置为 null。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt:57`

## 工具包模型（ToolPackage）

- `ToolPackage` 是工具包的清单数据类。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:301`
- 清单字段：`name`、`description`（多语言）、`tools`、`states`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:302`
- 清单字段：`env`（环境变量声明）、`isBuiltIn`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:327`
- `enabledByDefault`（JSON 名 `enabled_by_default`）控制是否默认启用。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:330`
- `displayName`、`category`（默认 `"Other"`）用于展示分类。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:332`
- `author`（兼容字符串或数组）、`version`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:335`
- `LocalizedText` 是多语言文本（`Map<String, String>`）。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:39`
- `LocalizedText.resolve(context)` 按系统 locale 逐级回退取文本。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:43`
- 回退顺序为语言标签、`language`、`default`、`en`、`zh`，最后取首个值。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:73`
- `LocalizedTextSerializer` 处理多语言文本的序列化。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:128`
- 值仅含 `default` 时写成纯字符串，否则写成 map。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:158`
- `StringOrStringListSerializer` 反序列化兼容字符串或字符串数组。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:170`
- 单个元素序列化时写成纯字符串。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:193`
- `EnvVar` 声明包的环境变量：`name`、`description`、`required`（默认 true）、`defaultValue`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:204`
- `EnvVarSerializer` 兼容新旧两种环境变量格式。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:215`
- 旧格式的裸字符串视为必填。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:227`
- `ToolPackageState` 定义条件工具集：`id`、`condition`（默认 `"true"`）、`inheritTools`、`excludeTools`、`tools`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:340`
- `PackageTool` 是包内的单个工具：`name`、`description`、`parameters`、`script`（定义工具行为的 JavaScript 脚本）、`advice`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:352`
- `PackageToolParameter` 有 `name`、`description`、`type`、`required`（默认 true）。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:364`
- `PackageToolExecutor.invoke` 要求工具名恰为 `packageName:toolName` 两段式。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:382`
- 包名不匹配或包内无此工具都返回失败的 `ToolResult`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:390`
- 执行时用 `runBlocking` 跑脚本并取流的最后一个结果。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:418`
- `invokeAndStream` 按名称后缀在包内查找工具，直接返回脚本执行的 `Flow`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:423`
- `validateParameters` 校验必填参数是否齐全。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:431`
- 缺失时 `errorMessage` 列出缺失的参数名。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:468`
- `describePackage()` 生成带本地化描述与参数类型表的人类可读包说明。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:478`

## 结果类型体系（ToolResultDataClasses）

- `ToolResultData` 是 `@Serializable` 的密封基类。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:17`
- `toJson` 用 `classDiscriminator = "__type"` 做多态序列化。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:23`
- 设计上刻意区分两个通道：`toString()` 输出给 AI 模型读的文本，结构化字段用于序列化与持久化。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:17`
- `BinaryResultData` 持有 `ByteArray`，`toString` 只报告字节数。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:211`
- `BinaryResultData` 手动重写 `equals` 做内容比较。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:214`
- `BinaryResultData` 配套重写了 `hashCode`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:221`
- 防爆截断遍布各结果类：
  - `VisitWebResultData` 是网页访问的结果类型。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:1048`
  - 其伴生对象定义 `MAX_INLINE_LINKS` 与 `MAX_INLINE_IMAGES`（均为 120）。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:1061`
  - 超限时截断并提示用 `read_file_part` 或 `grep_code` 查看落盘文件。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:1103`
  - `FindFilesResultData` 超过 20 个文件时只列前 10。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:1143`
  - grep 结果最多展示 30 个匹配组。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:1712`
  - `MessageSendResultData` 把消息截断为 50 字符预览、AI 回复截断为 200 字符预览。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:2227`
  - `HttpResponseData` 最多展示 5 个 cookie，值截断 30 字符。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:600`
  - 聊天记录结果的 `toString` 只输出摘要（chatId、order、limit 与总数），不输出消息正文。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:2154`
- 语音与模型配置结果只保存 `apiKeySet` 布尔值与 `apiKeyPreview` 预览。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:2324`
- `TerminalStreamEventData` 的 `toString` 在 `type` 为 chunk 时直接返回分片内容。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:293`
- 文件类结果普遍带 `env` 字段（`@EncodeDefault`，默认 `"android"`），标记结果来源环境。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:237`
- `AppOperationData.toString()` 按 `operationType` 组装文本，未使用 `success` 字段。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:674`
- `ConnectionResultData.toString()` 只输出 `connectionId`，未使用 `isActive`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt:404`

## 代理调用

- `parseProxyInvocation` 要求代理调用恰好一个 `tool_name` 与一个 `params` 参数。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:107`
- `params` 的 JSON 对象被转成 `ToolParameter` 列表透传给被代理工具。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:163`
- `__operit_package_caller_name`、`__operit_package_chat_id`、`__operit_package_caller_card_id` 三个包上下文参数允许透传。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:81`
- CLI 代理工具执行前走 `executeProxyTargetWithPermissionCheck`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:221`
- 该路径调用 `checkToolPermission` 做工具权限检查。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:241`
- 权限拒绝时通知结果 `granted=false`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:247`
- `package_proxy` 要求目标为带包名的限定格式。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1140`
- `package_proxy` 禁止目标为 `package_proxy` 自身。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1157`
- 代理调用随后直接走 `handler.executeTool` 执行。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1165`
- `update_user_preferences` 是兼容别名，故意不在系统提示词中出现。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:852`
- `update_user_profile` 是新会话使用的正式工具名。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:836`

## 关联条目

- [[core-tools|工具系统总览]]：v2 条目，本页是其细粒度展开。
- [[api-chat|对话与 API]]：工具调用请求的来源。
- [[data-model|数据模型]]：`AITool`、`ToolResult` 的定义。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHandler.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/AIToolHook.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolProgressBus.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolResultDataClasses.kt`


