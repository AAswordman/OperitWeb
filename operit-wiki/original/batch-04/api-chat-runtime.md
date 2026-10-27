---
title: 对话编排运行时
module: app
sources: 4
date: 2026-10-01
---

# 对话编排运行时

## 概述

- 一句话：`EnhancedAIService` 是聊天链路的中枢——一次用户发言进来，它组装提示词、调模型、收流式回复、检测并执行工具调用、把结果再喂回模型，直到产出最终回复；`ChatRuntimeHolder` 管两个会话槽（主窗口和悬浮窗）的核心与跨会话同步；`AIForegroundService` 是保活用的前台服务。
- 三个角色分工：`EnhancedAIService` 干活，`ChatRuntimeHolder` 管槽，`AIForegroundService` 看门保活。

## AI 速览

- **核心符号**：`EnhancedAIService`（对话编排入口）、`SendMessageOptions`（请求参数包）、`MessageExecutionContext`（单次请求执行上下文）、`ChatRuntimeHolder`（双槽核心持有者）、`ChatRuntimeSlot`（`MAIN` / `FLOATING`）、`AIForegroundService`（保活前台服务）、`FOREGROUND_REF_COUNT`（前台服务引用计数）。
- **主入口**：`sendMessage(options)`，传入 `SendMessageOptions`，返回 `Stream<String>` 文本流。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:903`
- **数据流向一句话**：用户消息 → 组装提示词 → 按功能类型租模型服务 → 流式收回复 → 工具调用执行 → 结果回填再请求 → 收尾落盘、发通知、释放前台服务。

## 核心机制

### 双槽会话核心

- `ChatRuntimeHolder` 构造器私有，用双重检查锁实现进程级单例。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:258`
- `cores` 是按 `ChatRuntimeSlot` 做键的 `ConcurrentHashMap`，缓存两个会话核心。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:25`
- `ChatRuntimeSlot` 只有 `MAIN` 和 `FLOATING` 两个值。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeSlot.kt:3`
- `getCore(slot)` 懒创建核心：`MAIN` 槽的选择模式是 `FOLLOW_GLOBAL`，`FLOATING` 槽是 `LOCAL_ONLY`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:44`
- 构造时预创建全部槽位核心，并注册跨会话同步、统计观察与钩子观察。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:32`
- `activeConversationCount` 是两核心活跃聊天 ID 合并去重后的计数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:60`
- `currentSessionToolCount` 统计双核心所有活跃聊天的当轮工具调用总数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:72`
- `observeRuntimeHooks` 对每个槽合并输入处理状态、活跃聊天、工具计数三个流做观察。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:94`
- 状态变化经 `ChatRuntimeHookRegistry.dispatchAsync` 派发 `STATE_CHANGED` 事件。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:113`
- `__DEFAULT_CHAT__` 默认键和未变化的状态不派发。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:106`
- `registerChatSelectionSync` 监听源槽 `currentChatId`，目标槽用 `switchChatLocal` 跟随切换。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:213`
- `syncMainChatSelectionToFloating(chatId)` 是公开的聊天选择同步入口，空串直接返回。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:200`
- `registerTurnSync` 用 `setAdditionalOnTurnComplete` 挂接回合同步回调。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:172`
- 回合同步回调先比对目标核心当前聊天是否为同一 `chatId`，不是直接返回，是才 `reloadChatMessagesSmart` 并同步 token 计数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt:177`

### sendMessage 主流程

- `EnhancedAIService` 构造器私有，`getInstance` 用双重检查锁实现全局单例。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:118`
- `getChatInstance(context, chatId)` 按 `chatId` 在 `CHAT_INSTANCES` 里维护一会话一实例。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:128`
- `releaseChatInstance(chatId)` 移除实例并调 `cancelConversation` 释放。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:137`
- `sendMessage(options)` 返回 `Stream<String>`，流式输出 AI 回复。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:903`
- 每次调用创建一个 `MessageExecutionContext`，`executionId` 自增分配。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:967`
- 非子任务请求先调 `startAiService` 启动前台服务。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:979`
- 非子任务请求把 `inputProcessingState` 置为 `Processing`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:985`
- `SendMessageOptions.functionType` 默认值为 `CHAT`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:333`
- `SendMessageOptions.stream` 默认值为 `true`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:353`
- `SendMessageOptions.enableMemoryAutoUpdate` 默认值为 `true`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:339`
- `getModelExecutionSnapshot` 按功能类型租用模型服务：`CHAT` 功能且有配置覆盖时按配置取，否则按功能取，以 `ServiceLease` 租约持有。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:474`
- `prepareConversationHistory` 组装提示词历史。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2660`
- `estimatePreparedRequestWindow` 估算请求窗口 token 数，可发布到 `requestWindowEstimateFlow`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:712`
- `cancelConversation` 失效全部执行上下文、取消流与工具执行、token 计数清零、调 `stopAiService`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2829`

### 工具调用检测与执行

- `enhanceToolDetection` 用 `StreamXmlPlugin` 对回复做流式 XML 解析，规范化工具标签格式。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1346`
- `detectAndRepairTruncatedToolRound` 检测未闭合的 tool 标签并生成补全的修复后缀。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1443`
- 纯思考输出（去除 thinking 后正文为空）会注入警告状态回传给 AI 继续生成。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1805`
- `disableWarning=true` 时纯思考输出直接结束本轮，不注入警告。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1773`
- `processStreamCompletion`：空内容仍走 `finalizeAssistantResponse` 收尾。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1752`
- `processStreamCompletion`：检测到工具调用走 `handleToolInvocation`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1953`
- `processStreamCompletion`：无工具调用时直接 `finalizeAssistantResponse` 收尾。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1984`
- `handleToolInvocation` 逐个触发 `onToolInvocation` 回调。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2102`
- `handleToolInvocation`：UI 状态置为 `ExecutingTool`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2107`
- `handleToolInvocation` 经 `ToolExecutionManager.executeInvocations` 执行工具。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2116`
- `toolExecutionJobs` 用 `ConcurrentHashMap` 跟踪工具执行任务，`join` 后移除。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2181`
- `processToolResults` 把工具结果经 `ConversationMarkupManager.buildToolResultMessage` 转为 `TOOL_RESULT` 回合。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2222`
- `processToolResults`：token 用量超过阈值时触发 `onTokenLimitExceeded` 并结束对话。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2316`
- `cancelAllToolExecutions` 取消 `toolProcessingScope` 的全部子协程。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2874`

### 工具列表组装

- 全局工具开关关闭时 `getAvailableToolsForFunction` 返回 `null`，不提供任何 Tool Call 工具。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2905`
- 模型配置未启用 Tool Call 时返回 `null`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2914`
- CLI 暴露模式下用 `CliToolModeSupport.buildCliPublicToolPrompts` 构建工具列表。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2940`
- 非 CLI 模式追加 `package_proxy` 代理工具，用于转发已激活工具包的工具。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2978`

### 收尾与通知

- `finalizeAssistantResponse` 把 `isConversationActive` 置 false（执行上下文标记完成）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2024`
- `finalizeAssistantResponse`：记忆自动保存经 `MemoryAutoSaveCandidateRepository.enqueue` 入队。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2044`
- `finalizeAssistantResponse` 随后经 `notifyReplyCompleted` 发通知并 `stopAiService`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2063`
- `notifyReplyCompleted` 委托 `AIForegroundService.notifyReplyCompleted` 发送回复完成通知。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3063`
- 应用在前台时跳过发送回复通知。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:292`
- 通知内容取清理后文本的前 100 字，支持 `BigTextStyle` 展开全文。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:346`
- 通知 tag 为 `ai_reply:` 加 `chatId`，发过的 tag 记入集合用于退出时批量取消。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:379`
- `startAiService` 对 `FOREGROUND_REF_COUNT` 递增；应用不在前台且无常驻职责时跳过启动前台服务。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3026`
- `stopAiService` 仅在引用计数归零时发 `STATE_IDLE` 更新，不真正停止前台服务。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3080`

### 前台服务与唤醒

- 类注释：前台服务用于 AI 长时间处理时保活应用，不执行实际工作，仅靠持久通知提升进程优先级。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:102`
- 主通知 ID 为 1，回复通知 ID 为 2001，主通知渠道 ID 为 `AI_SERVICE_CHANNEL`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:105`
- `isRunning` 是静态 `AtomicBoolean` 标志，供外部检查服务是否运行。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:143`
- `EXTRA_STATE` 配合 `STATE_RUNNING` / `STATE_IDLE` 做前台服务状态切换。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:151`
- `onCreate` 把 `isRunning` 置 true，创建通知渠道并以前台方式启动；初始化 `ChatRuntimeHolder` 并启动五组观察。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:924`
- `onStartCommand` 处理 `ACTION_EXIT_APP`：取消当前 AI 任务、停止悬浮窗与调试服务、清除全部通知、杀进程退出。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1083`
- `ACTION_CANCEL_CURRENT_OPERATION` 调用 `AIMessageManager.cancelCurrentOperation` 并刷新通知。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1232`
- `ACTION_START_OR_REFRESH_EXTERNAL_HTTP`（或 intent 为空）启动外部 HTTP 服务；服务运行时返回 `START_STICKY`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1158`
- 外部 HTTP 配置禁用或端口非法则停止服务；同端口已运行则直接复用并更新状态。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:807`
- `stopSelfIfIdle`：AI 忙、唤醒监听、后台保活、外部 HTTP 任一有职责时不停止服务。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:903`
- `onDestroy` 停止外部 HTTP 服务，把 `isRunning` 置 false 并取消唤醒监听。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1276`
- `onBind` 返回 `null`，该服务是启动服务不支持绑定。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1301`
- `observeChatRuntimeStats` 监听双槽活跃会话数与当轮工具数变化，刷新前台通知。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1019`
- 前台通知标题：AI 忙时显示角色名，否则按唤醒监听状态显示运行中或暂停。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1860`
- AI 忙且有活跃会话时，通知内容显示活跃会话数与当轮工具数统计。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1880`
- 前台通知带三个操作按钮：语音悬浮窗、唤醒监听开关、退出应用；AI 忙时额外增加停止当前任务按钮。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1947`
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1966`
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1990`
- 唤醒监听生效条件：已启用且未被 IME、外部录音、悬浮全屏三者任一挂起。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:552`
- 检测到外部应用正在录音时挂起唤醒监听。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:636`
- 唤醒词命中后 3 秒内去重，不重复触发。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1674`
- `triggerWakeLaunch` 打开全屏悬浮窗并自动进入语音聊天。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1810`
- `matchWakePhrase`：正则模式用 `containsMatchIn` 匹配；普通模式做小写去标点后的包含匹配。
  `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt:1829`

### 其他能力

- `callFunctionModel` 以非流式方式调用指定功能类型的模型，把输出收集为纯文本。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:667`
- `estimateRequestWindowFromMemory` 只做请求窗口的 token 估算，不实际发送请求。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:769`
- `generateSummary` 系列方法委托给 `conversationService` 生成对话总结。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2571`
- `saveConversationToMemoryAsync` 用 `MEMORY` 功能类型的模型在 `toolProcessingScope` 中异步保存记忆。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3168`
- `translateText` 委托给 `conversationService.translateText` 做文本翻译。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3145`
- `analyzeImageWithIntent` 委托给 `conversationService` 做带用户意图的图片分析。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3210`
- 实例方法 `applyFileBinding` 委托给 `fileBindingService.processFileBinding` 做文件绑定。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:3130`
- `getProviderAndModelForFunction` 把 `providerModel` 按第一个冒号拆成 provider 与 modelName。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:595`
- `resetTokenCountersForFunction(functionType=null)` 重置指定功能类型或全部功能类型的 token 计数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2562`
- `_inputProcessingState` 是 `MutableStateFlow`，对外暴露为只读 `StateFlow`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:385`
- `captureCurrentTurnTokenSnapshot` 返回当轮输入、输出、缓存 token 的快照。
  `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2525`

## 关键符号

| 符号 | 说明 |
|---|---|
| `EnhancedAIService` | 对话编排中枢，私有构造 + 全局单例 |
| `sendMessage` | 主入口，返回文本流 |
| `SendMessageOptions` | 请求参数包 |
| `MessageExecutionContext` | 单次请求的执行上下文 |
| `ChatRuntimeHolder` | 双槽会话核心持有者，进程单例 |
| `ChatRuntimeSlot` | MAIN / FLOATING 槽位枚举 |
| `AIForegroundService` | 保活前台服务 |
| `FOREGROUND_REF_COUNT` | 前台服务引用计数 |
| `activeConversationCount` | 双槽活跃会话数 |
| `inputProcessingState` | 输入处理状态流 |

## 调用链

1. **输入**：构造 `SendMessageOptions`（消息、chatId、历史、功能类型等），调用 `sendMessage`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:903`
   - 创建 `MessageExecutionContext`，`executionId` 自增分配。
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:967`
   - 非子任务时 `startAiService` 拉起前台服务，状态置 `Processing`。
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:979`
2. **处理**：
   - `prepareConversationHistory` 组装提示词历史。
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2660`
   - `getModelExecutionSnapshot` 按功能类型租模型服务（`ServiceLease` 租约）。
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:474`
   - 流式接收回复；`processStreamCompletion` 检测工具调用。
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:1953`
   - `handleToolInvocation` 执行工具（`ToolExecutionManager.executeInvocations`），`processToolResults` 把结果转为 `TOOL_RESULT` 回填再请求，循环直到无工具调用。
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2116`
     `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2222`
3. **输出**：`finalizeAssistantResponse` 收尾（`isConversationActive` 置 false）→ 记忆入队 → `notifyReplyCompleted` 发回复通知 → `stopAiService` 释放前台服务引用。
   `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2024`
   `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2044`
   `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt:2063`

## 来源

- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（v1.12.2）
- `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt`（3221 行，100% 已读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/AIForegroundService.kt`（2021 行，100% 已读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeHolder.kt`（266 行，100% 已读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/ChatRuntimeSlot.kt`（6 行，100% 已读）
- 事实清单：`api-chat-runtime.facts.json`（94 条）；代码走查：`api-chat-runtime.quality.json`（10 条）
