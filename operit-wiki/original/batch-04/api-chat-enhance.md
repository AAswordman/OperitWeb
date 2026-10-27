---
title: 对话增强管线
module: app
sources: 9
date: 2026-10-01
---

# 对话增强管线

对话增强管线是云端 Chat API 下的一组加工类。它干的是"模型请求前后"的活：把 APP 内部的聊天记录整理成模型能吃的格式，把模型返回的 XML 工具标签拆成一条条工具调用，把文件编辑需求打成补丁写进文件，再把多个模型服务按功能管起来。9 个文件，3763 行。

## AI 速览

**核心符号清单**：`ConversationService`（`processChatMessageWithTools` / `prepareConversationHistory` / `generateSummaryFromPromptTurns`）、`ToolExecutionManager`（`executeInvocations` / `checkToolPermission`）、`FileBindingService`（`processFileBinding` / `applyFuzzyPatch`）、`MultiServiceManager`（`getServiceForFunction` / `createServiceFromConfig`）、`ConversationMarkupManager`（`formatToolResultForMessage`）、`ConversationRoundManager`（`getDisplayContent`）、`InputProcessor`（`processUserInput`）、`OrderedToolResults`（`complete` / `finish`）、`ReferenceManager`（`extractReferences`）。

**主入口**：历史转模型格式走 `ConversationService.prepareConversationHistory`；工具执行总装配走 `ToolExecutionManager.executeInvocations`。

**数据流向一句话**：APP 聊天记录 → 历史钩子 → XML 标签重组 → `PromptTurn` 列表 → 模型；模型返回的工具标签 → 暴露模式/角色卡/权限拦截 → 执行 → 保序 XML 结果 → 下一轮模型请求。

## 核心机制

### 1. 历史准备与系统提示拼接

`prepareConversationHistory` 在 `conversationMutex.withLock` 内全程串行执行。开始派发 `before_prepare_history` 钩子，结束派发 `after_prepare_history` 钩子，返回 `afterContext.preparedHistory`。钩子可以替换整个准备结果。

没有 SYSTEM 轮时，用 `SystemPromptConfig.getSystemPromptWithCustomPrompts` 组装系统提示，再按固定顺序拼出 `finalSystemPrompt`：头像 mood 规则 → 系统提示 → `assistant_role` 标签包裹的代理角色提示 → waifu 规则 → user_profile。`replacePromptPlaceholders` 把 `{{user}}` 换成全局用户名（取不到时为 User），`{{char}}` 换成 AI 名称。

### 2. XML 标签重组

`splitXmlTag` 委托 `NativeXmlSplitter.splitXmlTag` 从消息里切出 XML 标签。`processChatMessageWithTools` 按标签名分派：`text`、`think`/`thinking` 归 ASSISTANT；`status` 含 `type=complete` 或 `wait_for_user_need` 归 ASSISTANT，其余 `status` 归 USER；`tool_result` 归 TOOL_RESULT；`tool` 归 TOOL_CALL。重组后连续同角色的片段合并为一条，TOOL_CALL 与 TOOL_RESULT 不参与合并。

TOOL_RESULT 轮在准备时走 `normalizeToolResultMarkupForModel`：只改写 `apply_file` 工具的结果，把 `file-request-content` 的 CDATA 真实请求内容抽出来替换原 body。

### 3. 工具执行

`executeInvocations` 是总装配：暴露模式拦截 → 角色卡拦截 → Hook 拦截与权限检查 → 并行串行分组 → 执行聚合。

- `extractToolInvocations` 用 `StreamXmlPlugin` 切分字符流，再按 `toolCallPattern` 与 `toolParamPattern` 提取工具名、参数与原文位置；`unescapeXml` 剥离 CDATA 并还原转义。
- `resolveToolTarget` 处理包代理：`package_proxy` 与 `CliToolModeSupport.PROXY_TOOL_NAME` 按 `tool_name` 参数解析真实目标；`isJsPackageTool` 判定 `包名:工具名` 写法且包名在 JS 包集合中。
- `checkToolPermission`：CLI 公开工具自动放行；调用原文含 `deny_tool` 时跳过权限检查直接放行。
- 12 个只读工具可并行（`list_files`、`read_file`、`read_file_part`、`read_file_full`、`file_exists`、`find_files`、`file_info`、`grep_code`、`calculate`、`ffmpeg_info`、`visit_web`、`download_file`），`OrderedToolResults` 按原始调用下标保序发布结果。
- `executeTool` 在 `ToolRuntimeContext` 的 ThreadLocal 上下文中执行；取不到执行器时构造"工具不可用"错误，`buildToolNotAvailableErrorMessage` 按点号/冒号/裸包名三种写法给出修正提示。
- `aggregateToolResults`：空结果集返回固定错误；多段结果换行拼接，success 取最后一段。

### 4. 文件绑定与模糊补丁

`processFileBinding` 拒绝整文件覆写：原内容非空且 AI 代码不含 `[START-` 块时，返回原内容与操作指引。含 `[START-` 块走 `applyFuzzyPatch`，无结构块默认整文件替换（统一换行符并 trim）。

`applyFuzzyOperations` 对每个 OLD 块调用 `findBestMatchRange`：去空白后用 3-gram Jaccard 相似度做并行滑动窗口搜索，窗口尺寸容差为目标行数的 20% 加 2 行；只接受相似度大于 0.9 的结果。同一 OLD 块有多个完美匹配时中止，避免歧义替换。多个操作按起始行降序从下往上应用，避免行号漂移；单行对单行替换中，新行没有缩进时沿用原行缩进。成功后 `generateUnifiedDiff` 输出 `Changes: +N -M lines` 统计与带行号的 hunks。

### 5. 多服务管理

`MultiServiceManager` 按 FunctionType 缓存 `AIService` 实例。`acquireServiceForFunction` 取服务时 `activeLeases` 加一，lease 关闭时经 `releaseLease` 减一；`ServiceLease.close()` 用 `AtomicBoolean.compareAndSet` 保证只执行一次。

`createServiceFromConfig` 用 `getValidModelIndex` 计算有效索引（越界打警告用第一个模型）；`requestLimitPerMinute` 与 `maxConcurrentRequests` 先钳到不小于 0；两项都为 0 时返回裸服务，否则按配置 id 注册限流器与并发信号量并包装。CHAT 功能创建的实例同时记为 `defaultService`；刷新 CHAT 时清空全部自定义配置实例。`cancelAllStreaming` 遍历全部实例逐个取消流式，单个失败只记日志。`hasImageRecognitionConfigured` 检查 `enableDirectImageProcessing` 是否开启。

### 6. 会话总结

`generateSummaryFromPromptTurns` 是主入口：先 `stripGeminiThoughtSignatureMetaTurns` 再 `stripOpenAiResponsesProtocolMarkupTurns` 两层清洗；系统提示由 `FunctionalPrompts.buildSummarySystemPrompt` 构建；`buildSummaryPreparedHistory` 拼出 SYSTEM 系统提示 + 历史消息 + USER 总结提问三段。

前后派发三阶段钩子：`before_prepare_summary_prompt`、`before_send_to_model`、`after_generate_summary`（可用 `summaryResult` 覆盖总结内容）。流式过程中按章节标记推进进度（写标题 0.20 → 核心任务 0.40 → 交互 0.55 → 进展 0.70 → 关键信息 0.85 → 收尾 0.95），完成上报 1.0。内容经 `ChatUtils.removeThinkingContent` 去除思考过程；token 统计取 `inputTokenCount`、`cachedInputTokenCount`、`outputTokenCount`；结果空白时返回固定文案；异常记日志后原样 rethrow。

`generateConversationTitle` 用 TITLE_GENERATION 服务非流式生成（`stream=false`、`enableRetry=false`），`sanitizeConversationTitle` 取首个非空行、去 markdown 符号与控制字符、截断到 40 字符。

### 7. 小件

- `ConversationMarkupManager`：生成标准化的 XML 状态消息与工具结果文本；`createBoundedToolResultXml` 按 `ToolExecutionLimits.MAX_SINGLE_TOOL_RESULT_MESSAGE_CHARS` 限长，超长保留前部并拼接 `[工具结果过长，已截断]`；图片链接单独成行追加，单行超预算跳过。
- `ConversationRoundManager`：按轮号存 `SmartString` 内容；`getDisplayContent` 按轮升序拼接，`getRawContent` 每轮前加 `--- Round N ---` 分隔。
- `InputProcessor.processUserInput`：派发 `before_process` / `after_process` 两阶段输入钩子，结果层层回退。
- `ReferenceManager.extractReferences`：用 Markdown 链接正则提取 http(s) 链接转为 `AiReference`。
- `translateText` 按 `LocaleUtils.getCurrentLanguage` 选目标语言，取不到映射默认中文，走 TRANSLATION 服务。
- `analyzeImageWithIntent` / `analyzeAudioWithIntent` / `analyzeVideoWithIntent`：图片走 `ImagePoolManager`，音视频走 `MediaPoolManager`，分析后清理；取不到 mime 时兜底 `audio/*` / `video/*`。

## 关键符号

| 符号 | 位置 | 一句话 |
|---|---|---|
| `ConversationService` | ConversationService.kt | 会话加工总入口：历史准备、XML 重组、总结、标题、翻译、意图分析 |
| `ToolExecutionManager` | ToolExecutionManager.kt | 工具执行：切分、拦截、权限、并行分组、聚合 |
| `FileBindingService` | FileBindingService.kt | 文件绑定：拒绝覆写、模糊补丁、diff 生成 |
| `MultiServiceManager` | MultiServiceManager.kt | 按功能类型缓存 AIService，lease 引用计数，限流包装 |
| `ConversationMarkupManager` | ConversationMarkupManager.kt | 工具结果 XML 生成与限长截断 |
| `ConversationRoundManager` | ConversationRoundManager.kt | 按轮存取流式内容 |
| `InputProcessor` | InputProcessor.kt | 用户输入两阶段钩子 |
| `OrderedToolResults` | OrderedToolResults.kt | 按调用下标保序发布工具结果 |
| `ReferenceManager` | ReferenceManager.kt | Markdown 链接提取为 AiReference |
| `prepareConversationHistory` | ConversationService.kt:451 | 历史转 PromptTurn，带钩子与互斥锁 |
| `processChatMessageWithTools` | ConversationService.kt:718 | 带 XML 标签消息的重组主入口 |
| `executeInvocations` | ToolExecutionManager.kt:504 | 工具执行总装配 |
| `checkToolPermission` | ToolExecutionManager.kt:429 | 工具权限检查（含 deny_tool 放行分支） |
| `applyFuzzyOperations` | FileBindingService.kt:263 | 模糊补丁应用 |
| `createServiceFromConfig` | MultiServiceManager.kt:298 | 按配置创建限流包装的服务 |

## 调用链

**链路一：历史准备（输入 → 处理 → 输出）**

1. 输入：`ChatMessage` 列表、FunctionType、`AIToolHandler`、角色卡与提示配置。
2. 处理：派发 `before_prepare_history` 钩子 → `conversationMutex` 内逐轮处理（ASSISTANT 含 XML 标签走 `processChatMessageWithTools` 重组；TOOL_RESULT 走标记归一化；SYSTEM 缺失则拼接 `finalSystemPrompt`）→ 派发 `after_prepare_history` 钩子。
3. 输出：`List<PromptTurn>`，直接喂给 `AIService` 发起模型请求。

**链路二：工具执行（输入 → 处理 → 输出）**

1. 输入：模型返回的 XML 工具标签文本。
2. 处理：`extractToolInvocations` 切分出调用 → 暴露模式/角色卡/`before_tool_call` Hook 拦截 → `checkToolPermission` 权限检查 → 并行白名单分组执行，`OrderedToolResults` 保序发布。
3. 输出：`ToolExecutionBatch`（XML 结果），既发布给已保存流，也供下一轮模型请求使用。

**链路三：文件绑定（输入 → 处理 → 输出）**

1. 输入：目标文件原内容与 AI 生成的编辑代码。
2. 处理：含 `[START-` 块则 `parseEditOperations` 解析 → `findBestMatchRange` 模糊定位（>0.9 接受，多完美匹配中止）→ 降序自下而上应用。
3. 输出：新文件内容 + `generateUnifiedDiff` 生成的 diff 文本。

## 来源

- 源码：Operit @ `dbf71916`，`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/` 下 9 个文件（ConversationMarkupManager.kt、ConversationRoundManager.kt、ConversationService.kt、FileBindingService.kt、InputProcessor.kt、MultiServiceManager.kt、OrderedToolResults.kt、ReferenceManager.kt、ToolExecutionManager.kt），共 3763 行，已逐行读完。
- 事实清单：`api-chat-enhance.facts.json`（126 条原子事实，引用精确到行）。
- 代码走查：`api-chat-enhance.quality.json`（5 条：high 1 / warning 2 / suggestion 2），其中 `deny_tool` 权限绕过为 high。
