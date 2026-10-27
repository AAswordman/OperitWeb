---
title: 聊天服务核心 Delegate 群
module: 系统服务与集成
sources: ApiConfigDelegate.kt, AttachmentDelegate.kt, ChatDisplayWindowPaging.kt, ChatHistoryDelegate.kt, ChatSelectionMode.kt, CurrentChatWindowController.kt, MessageCoordinationDelegate.kt, MessageProcessingDelegate.kt, TokenStatisticsDelegate.kt
date: 2026-10-01
---

# 聊天服务核心 Delegate 群

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 聊天功能真正的"发动机舱"——`services/core/` 目录下的 9 个文件。

打开 App 发一句话，背后不是单个类在干活，而是一个分工明确的 Delegate（委托）小组。`ChatServiceCore` 是组装者：它在 `initializeDelegates()` 里把 7 个 Delegate 逐个 new 出来、互相连上线，自己只做转发，具体逻辑全部下沉到各 Delegate 里。

分工一句话：

1. `MessageCoordinationDelegate`——**总指挥**：发消息先过它，它决定要不要先总结历史、要不要走群组编排、发完要不要自动续写。
2. `MessageProcessingDelegate`——**施工队**：真正把消息拼出来、调 AI 发流、收流、落库、处理取消和重生成。
3. `ChatHistoryDelegate`——**档案室**：聊天列表、消息增删改、显示窗口分页、角色卡开场白。
4. `ApiConfigDelegate`——**配置台**：API Key、模型、上下文长度、总结开关等所有聊天配置。
5. `AttachmentDelegate`——**收发室**：图片、文件、截屏 OCR、通知、位置、@工作区文件等附件。
6. `TokenStatisticsDelegate`——**记账员**：按每个聊天分账记录 token 消耗。
7. `CurrentChatWindowController` + `ChatDisplayWindowPaging` + `ChatSelectionMode`——三个小构件：显示窗口状态、分页算法、会话选择模式。

## AI 速览

- 核心符号：`ChatServiceCore`（装配与转发）、`MessageCoordinationDelegate`（发送总控/总结/群组编排）、`MessageProcessingDelegate`（发送流水线/流收集/取消）、`ChatHistoryDelegate`（历史与显示窗口）、`ApiConfigDelegate`（配置中枢）、`AttachmentDelegate`（附件管线）、`TokenStatisticsDelegate`（token 分账）、`CurrentChatWindowController`（显示窗口状态机）、`ChatDisplayWindowPaging`（分页算法）、`ChatSelectionMode`（`FOLLOW_GLOBAL`/`LOCAL_ONLY`）
- 主入口：`ChatServiceCore.sendUserMessage(...)` → `MessageCoordinationDelegate.sendUserMessage(...)` → 私有 `sendMessageInternal(...)` → `MessageProcessingDelegate.sendUserMessage(...)` → `AIMessageManager.sendMessage(...)`
- 数据流向一句话：用户输入与附件先到协调层做决策（角色卡解析、模型配置、总结检查、群组编排），再进处理层构建消息并发起 AI 流式请求，流收集后由历史层落库并刷新显示窗口，token 统计同步记账。

## 核心机制

### 1. 总装配：ChatServiceCore 只做"接线"

`ChatServiceCore` 的构造函数参数只有 `context`、`coroutineScope`、`selectionMode`，构造时直接调用 `initializeDelegates()`。

`app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:35`

7 个 Delegate 的装配顺序有讲究：`ApiConfigDelegate` 先建（它的 `onConfigChanged` 回调里会启动 token 收集器）；`ChatHistoryDelegate` 建好后订阅它的 `currentChatId`，驱动 `TokenStatisticsDelegate.setActiveChatId` 和输入草稿切换；`MessageProcessingDelegate` 的 `onTurnComplete` 回调里做 token 累计与落库；`onTokenLimitExceeded` 回调连到 `MessageCoordinationDelegate.handleTokenLimitExceeded`，形成"超限→总结→续写"闭环。

`app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:75`

破坏性历史变更（删消息、截断等）发生前，`ChatServiceCore` 给 `ChatHistoryDelegate` 注册了两道钩子：变更前取消该聊天的总结与发送，变更后刷新稳定上下文窗口。

`app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:224`

对外暴露的 `sendUserMessage`、`cancelMessage`、`createNewChat` 等全部是转发方法，真正的逻辑在各 Delegate 里。

`app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:252`

### 2. ApiConfigDelegate：配置中枢

职责就一句：管"这次聊天用哪个配置"。

它持有 5 个管理器：`ApiPreferences`（功能开关）、`ModelConfigManager`（模型配置）、`FunctionalConfigManager`（功能→配置映射）、`CharacterCardManager`、`ActivePromptManager`（当前角色卡）。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:59`

**有效配置解析链**是它的核心：一共三级推导。

- `effectiveChatConfigTarget`：看当前活跃 prompt——如果角色卡的聊天模型绑定模式是 `FIXED_CONFIG`（锁定配置），就用角色卡锁定的配置 ID，否则用全局 `activeConfigId`。
`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:171`
- `effectiveChatConfigId`：取上一级的 `configId`。
`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:207`
- `effectiveChatConfig`：按 ID 从 `ModelConfigManager` 拉出完整的 `ModelConfigData`。
`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:219`

再往下，十几个"有效值" StateFlow（`thinkingOptionId`、`effectiveBaseContextLength`、`effectiveSummaryTokenThreshold`、`effectiveEnableSummary` 等等）全部从 `effectiveChatConfig` 映射而来，UI 层订阅它们即可自动跟随配置切换。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:232`

`contextLength` 这个对外暴露的 StateFlow 是三路合并：`enableMaxContextMode` 为 true 时取 `maxContextLength`，否则取 `baseContextLength`。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:112`

`ChatContextSettings` 是发给发送流水线的"配置快照"数据类，一次带齐 9 个字段：`configId`、`baseContextLength`、`maxContextLength`、`enableMaxContextMode`、`effectiveContextLength`、`summaryTokenThreshold`、`enableSummary`、`enableSummaryByMessageCount`、`summaryMessageCountThreshold`。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:33`

`suspend` 函数 `resolveChatContextSettings(configIdOverride)` 支持按覆盖 ID 解析这份快照，找不到配置直接抛异常。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:407`

`_isConfigured` 默认就是 `true`（注释写明"默认已配置"），`_apiProviderType` 默认 `ApiProviderType.DEEPSEEK`。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:70`

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:153`

`saveDeepSeekConfiguration` 是保存 DeepSeek Key 的专用通道，做了四重校验：Key 格式归一化+合法性检查、保存前后两次确认活跃配置 ID 未发生变化、确认目标配置确实是 DeepSeek 类型，之后才写库并刷新 `EnhancedAIService`。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:548`

`init` 里在后台线程创建 `EnhancedAIService`，建好后切回主线程触发 `onConfigChanged` 回调。

`app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt:330`

### 3. ChatHistoryDelegate + 分页双件套：档案室与显示窗口

`ChatHistoryDelegate` 管两样：聊天列表（增删改、分组、排序、工作区绑定、角色卡绑定）和当前聊天的**显示窗口**。

**显示窗口**是为性能做的设计：几千条消息的聊天不会全读进内存，内存里只保留一个"窗口"（最多 2 页）。分页算法在 `ChatDisplayWindowPaging.kt`：

- 每页由 5 条"触发消息"（`DISPLAY_PAGE_TRIGGER_COUNT = 5`）划定，最多保留 2 页（`MAX_DISPLAY_PAGE_COUNT = 2`）。
`app/src/main/java/com/ai/assistance/operit/services/core/ChatDisplayWindowPaging.kt:6`
- 触发消息指 `sender` 为 `"user"` 或 `"summary"` 的消息；其中 `summary` 消息会**立即**关闭当前页（总结天然是分页边界）。
`app/src/main/java/com/ai/assistance/operit/services/core/ChatDisplayWindowPaging.kt:135`
- `takeNewestDisplayPages` / `takeOldestDisplayPages` 分别取最后 N 页 / 最前 N 页。
`app/src/main/java/com/ai/assistance/operit/services/core/ChatDisplayWindowPaging.kt:47`

窗口的状态机在 `CurrentChatWindowController`：记录显示起止时间戳、是否有更早/更新的持久化历史、是否正在加载。`beginLoadingDisplayWindow()` 自带防重入——正在加载时返回 `false`，调用方直接放弃。

`app/src/main/java/com/ai/assistance/operit/services/core/CurrentChatWindowController.kt:90`

`ChatHistoryDelegate` 从数据库取窗口数据时按 80 条一批（`DISPLAY_WINDOW_QUERY_BATCH_SIZE = 80`）倒序拉取，凑够目标页数就停。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:44`

`revealMessageForCurrentChat` 支持"定位到某条消息"：先用轻量 locator 预览算出所有页的时间戳区间，找到目标页后只加载该窗口。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:372`

`loadOlderMessagesForCurrentChat` 向前翻页时，如果当前已占满 2 页，只保留最旧 1 页再拼接新取的 1 页，内存占用恒定。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:416`

**会话选择模式** `ChatSelectionMode` 只有两个值：`FOLLOW_GLOBAL` 跟随全局 `currentChatIdFlow`（主界面用），`LOCAL_ONLY` 只取一次初始 ID 不跟随（悬浮窗用，300ms 拿不到就用当前值）。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatSelectionMode.kt:2`

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:540`

**破坏性变更框架**：删消息、截断、清空等操作走 `runDestructiveHistoryMutation`——先触发"变更前"钩子（取消总结与发送），在 `historyUpdateMutex` 内执行，成功后再触发"变更后"钩子（刷新上下文窗口）。`runCurrentChatDestructiveHistoryMutation` 还多一道保险：执行前快照 `currentChatId`，mutex 内发现聊天已切换就打日志放弃，避免删到别的聊天头上。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:302`

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:313`

**开场白同步** `syncOpeningStatementIfNoUserMessage`：打开聊天或切换角色卡时，如果该聊天还没有用户消息，就按角色卡的开场白同步一条 AI 消息（`provider`/`modelName` 留空以标记"非 AI 生成"）；群组绑定的聊天跳过；开场白被清空则删除旧开场白。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:640`

`createNewChat` 会先保存当前聊天的 token 统计、继承当前分组、解析角色卡并插入开场白，然后最多等 500ms 让数据库 Flow 发出新聊天。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:775`

`switchChat` 切换时先把 `allowAddMessage` 置为 false 禁止写入，保存当前聊天后再切；全局同步模式最多等 500ms，本地模式只改内存不写回 DataStore。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:864`

删**当前**聊天时不会直接删：`moveCurrentChatAwayBeforeDeletion` 先找同组/同角色卡下最近更新的另一个聊天切过去，找不到才建新聊天，切走之后再删。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1020`

`addMessageToChat` 是所有消息落库的统一入口：`historyUpdateMutex` 加锁；变体预览只更新内存；切换中则跳过内存但继续持久化；非当前会话用 `updateMessage` 做 upsert；当前会话按时间戳 upsert。**每次**持久化都会调用 `ToolPkgChatMessageHookBridge.dispatchMessagePersisted` 通知插件。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1400`

`saveCurrentChat` 只有在消息非空或任一计数非零时才写库，空聊天不产生写操作。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1227`

聊天排序/分组调整 `updateChatOrderAndGroup` 是 UI 立即生效、持久化防抖 350ms，避免拖拽过程中 Room Flow 反复发射导致列表跳动。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1510`

总结消息的插入位置 `findProperSummaryPosition` 定在**最后一条 AI 消息之后**，即上一个完整对话轮次的末尾。

`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1659`

### 4. MessageCoordinationDelegate：发送总指挥

这是最复杂的一个 Delegate，管"发消息"这件事的全部决策。

`sendUserMessage` 是公开入口：如果连当前对话都没有，先自动建一个，最多等 1 秒（10 次 × 100ms），超时则报错并丢弃本次发送。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:327`

真正的发送逻辑在私有 `sendMessageInternal`，按顺序做这些事：

1. **群组编排门控**：只有 `promptFunctionType` 为 `CHAT`、非续写、没有任何覆盖参数、且当前活跃 prompt 是角色组时，才走 `orchestrateGroupConversation`；编排出问题就回退普通发送。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:770`
2. **角色与模型解析**：`resolveRoleCardId` 按"显式覆盖 > 活跃角色卡（可选）> 会话绑定卡 > 全局活跃卡"定角色；角色卡 `FIXED_CONFIG` 绑定则锁定模型配置 ID 与序号；`FIXED_PROFILE` 绑定则锁定记忆空间。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:230`
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1415`
3. **算力上限**：`maxTokens = effectiveContextLength × 1024`，转 Int 并钳制在 `0..Int.MAX`。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:676`
4. **发送前总结检查**：调 `AIMessageManager.shouldGenerateSummary`，命中则 `launchAsyncSummaryForSend` 异步生成总结（不阻塞发送），同时本轮 token 阈值 `+0.5` 放宽，避免总结刚生成完又触发。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:683`
5. **代理发送降级**：`proxySenderNameOverride` 非空时视为代理发言，关闭记忆自动更新。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:722`
6. **派发**：调 `MessageProcessingDelegate.sendUserMessage`，手动发送成功后清空附件、重置附件面板、清除回复引用。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:760`

**群组编排** `orchestrateGroupConversation`：用 `ROLE_RESPONSE_PLANNER` 功能模型规划"谁第几轮说不说话"（`PlannedRounds`），首轮首成员用用户原文、其余成员空消息续写，每发完一个成员 `awaitTurnComplete` 等回合计数器达标（默认 180 秒超时），最后按需总结。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:800`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1251`

规划结果的 JSON 解析 `parsePlannedRounds` 兼容新格式 `{"rounds":[[...]]}` 和旧格式 `{"order"/"plan"/"members":[...]}`，成员可按 id 或名称解析、同轮去重。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1080`

**总结双轨**：手动/超限触发的同步总结走 `summarizeHistory`（`_isSummarizing` 防重入），发送时触发的异步总结走 `launchAsyncSummaryForSend`（`_isSendTriggeredSummarizing` 独立状态）。同步总结成功且要求自动继续时：上一轮还在跑就 `queuePendingAutoContinuation` 排队等回合结束，否则直接 `sendMessageInternal(isAutoContinuation = true)` 续写。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1855`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1300`

`handleTokenLimitExceeded` 收到超限信号后覆盖 `summaryJob` 发起"总结并自动继续"。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1618`

`cancelSummaryInternal` 取消时先真正取消 `SUMMARY` 模型的流式请求、清 `ToolProgressBus`，再取消协程 Job 并把 UI 状态机拨回 Idle。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1640`

`refreshStableContextWindow` 用 `AIMessageManager.calculateStableContextWindow` 重算稳定上下文窗口，持久化到聊天记录，并在主线程刷新 token 统计。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:264`

`readSummaryConfig` 从功能配置映射找到 CHAT 用的模型配置，读出总结自定义规则、段落覆盖、对话评审开关，读失败返回默认配置。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:2031`

**记忆**：`manuallyUpdateMemory` 手动把运行时历史调 `saveConversationToMemoryAsync` 存进记忆；`enqueueSelectedMessagesForMemoryAutoSave` 只收 `sender` 为 `user` 且内容非空的选中消息进自动记忆队列。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1450`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:1470`

新聊天的标题先取首个附件的文件名、没有附件就用"新对话"做 fallback，AI 生成标题是异步的，只有当前标题**仍然**是 fallback 时才覆盖，避免覆盖用户手改过的标题。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:155`

**单条重生成** `regenerateSingleAiMessage`：校验成功后取目标消息时间戳之前的运行时历史，调 `MessageProcessingDelegate.regenerateAiMessageVariant`，以"变体预览→变体落库"两步完成。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:380`

### 5. MessageProcessingDelegate：发送流水线

真正的"发"发生在这里。每个聊天有一个 `ChatRuntime` 运行态：`sendJob`（发送协程）、`responseStream`（共享字符流）、`activeStreamingTurn`（流式中的 AI 消息）、`streamCollectionJob`/`stateCollectionJob`（流收集与状态收集协程）、`turnSequence`（回合序号）、`activeTurnId`、`cancellationMutex`、`isLoading`。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:200`

运行态按 `chatKey(chatId ?: "__DEFAULT_CHAT__")` 存在 `ConcurrentHashMap` 里，多聊天并发各自独立。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:240`

`sendUserMessage` 开头两道闸：空消息（无文本无附件、非自动续写、非群组轮次）直接忽略；该聊天正在加载中再次发送也直接忽略并打日志。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:695`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:707`

发送前 `turnSequence.incrementAndGet()` 分配本轮 `turnId`，取消/重入判断都认它。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:726`

输入框草稿按聊天 ID 分开存（`userMessageDraftsByChatId`），切换聊天时自动保存/恢复。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:580`

`setChatInputProcessingState` 有三条守卫：运行时 `isLoading` 为 true 时不接受 `Idle`/`Completed` 终端态；被 `setSuppressIdleCompletedStateForChat` 压住时同样拦截；状态不是 `ExecutingTool`/`Summarizing` 时清掉 `ToolProgressBus`。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:280`

流水线（都在 `Dispatchers.IO` 的 sendJob 里）：

1. 聊天绑定了工作区就临时挂 `WorkspaceBackupManager` 的 tool hook，`finally` 里卸载。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:855`
2. 首条用户消息设 fallback 标题并异步生成 AI 标题。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:735`
3. 从模型配置读直接处理开关：图片/音频/视频直传各自独立；**文件直传只在供应商为 `OPENAI_CODEX` 且开启图片直传时才启用**。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:755`
4. 服务获取优先 `EnhancedAIService.getChatInstance(context, chatId)`（按聊天隔离的实例），拿不到才用全局；都没有就报错返回。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:920`
5. `AIMessageManager.buildUserMessageContent` 拼出最终用户消息（含附件、回复引用、钩子注入）。
6. 群组轮次给内容加 `"[From user]\n"` 前缀；编排预建的消息会从历史末尾剥离一条，防止模型收到两份。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1039`
7. AI 消息用 `ChatMessageTimestampAllocator.next()` 分配时间戳，`provider`/`modelName` 记录实际供应商与模型。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1060`

流收集协程同时做四件事：`TextStreamRevisionTracker` 处理 `SAVEPOINT`/`ROLLBACK` 修订事件；滚动事件 200ms 节流（`STREAM_SCROLL_THROTTLE_MS = 200L`）；流式快照每 1000ms 持久化一次（`STREAM_PERSIST_INTERVAL_MS = 1000L`）；自动朗读走 `TtsSegmenter` 按标点切分边播边读。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:80`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1130`

waifu 模式是另一条路：`WaifuMessageProcessor.streamSegmentsWithTypingQueue` 按字符延迟把流切成多条短消息，逐条落库、逐段朗读。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1300`

回合结束从 service 读 `getCurrentInputTokenCount` / `getCurrentOutputTokenCount` / `getCurrentCachedInputTokenCount`，算出 `waitDurationMs`（首包等待）与 `outputDurationMs`（输出耗时）写进消息指标。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1400`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1412`

`finalizeMessageAndNotify` 用共享流的 replayCache 重建最终文本（避免完成信号早于收集协程导致丢尾字），然后清流落库；`notifyTurnComplete` 把 `turnCompleteCounterByChatId` 加一、重算窗口、调 `onTurnComplete` 回调。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1880`

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1840`

**取消** `cancelMessageInternal`：`cancellationMutex` 加锁，按 `turnId` 核对；`keepPartialResponse=true` 时读当前 token 快照、`detachStreamingAiMessage` 把已流出的半截回复落库（含指标回填到用户消息）；最后清掉运行态并拨回 Idle。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:496`

**单条变体再生** `regenerateAiMessageVariant`：复用目标消息的时间戳，流式收集后经 `onVariantPreviewStarted`（预览）与 `onVariantReady`（落库变体）两个回调交还给协调层。

`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1604`

### 6. AttachmentDelegate：附件收发室

附件在内存里就是 `_attachments: StateFlow<List<AttachmentInfo>>`，所有修改经 `attachmentListLock` 同步；`addAttachments` 按 `filePath` 去重，重名文件自动改成 `name_2.ext`、`name_3.ext`。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:55`

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:105`

`createAttachmentReference` 生成插入用户消息的 XML 引用：`<attachment id="..." filename="..." type="..." size="..." content="..."/>`。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:133`

`handleAttachment` 是统一入口，先看三个魔术字符串：`"screen_capture"` 截屏 OCR、`"notifications_capture"` 读通知、`"location_capture"` 取位置；`"package_attach:"` 前缀走包附件。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:194`

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:202`

`content://` 的 URI 走 ContentResolver 取文件名与 MIME；本地路径直接读文件。无论哪种，**原文件都会被复制**到 `OperitPaths.cleanOnExitDir()` 临时目录（带 `.nomedia` 防媒体扫描），附件引用的是副本路径。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:290`

相机拍照存为 `camera_<时间戳>.jpg` 后走同样流程。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:160`

**包附件** `attachPackage`：包名在标准包、技能包、MCP 服务包任一集合里才继续；标准包先 `enablePackage`；`usePackage` 取回的文本经 `isPackageAttachmentError`（匹配 `"Package not found: "` 等错误前缀）校验；附件路径记为 `package_attach:<包名>`，显示名 `"包: <包名>"`，重复添加走替换。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:340`

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:455`

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:560`

**工作区 @引用** `attachWorkspaceMention`：相对路径归一化（反斜杠转斜杠、去首尾斜杠）；`workspaceEnv` 为空直接读本地 File，否则走 `file_exists` / `read_file_full` / `list_files` 工具读；附件路径记为 `workspace_mention:<相对路径>`，目录的 MIME 是 `application/vnd.workspace-directory+plain`。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:400`

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:463`

**截屏内容** `captureScreenContent`：调 `capture_screenshot` 工具截图 → `OCRUtils.recognizeText(..., Quality.HIGH)` 识别文字 → 生成 `screen_content.txt` 文本附件（末尾附 `OCR_INLINE_INSTRUCTION`，指示模型直接基于附件内容回答、不再读文件），最后删除临时截图。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:39`

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:600`

**通知** `captureNotifications`：`get_notifications` 工具，默认取 10 条、含进行中通知，生成 `notifications.json`。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:699`

**位置** `captureLocation`：`get_device_location` 工具，高精度、10 秒超时，生成 `location.json`。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:738`

**记忆文件夹** `captureMemoryFolders`：生成 `memory_context.xml`，里面用英文指令要求模型搜索记忆时**必须**用 `query_memory` 工具且 `folder_path` 必须是列表中的路径。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:795`

`getMimeTypeFromPath` 内置了常见扩展名映射表，查不到才回退到 `MimeTypeMap`。

`app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt:885`

### 7. TokenStatisticsDelegate：按聊天分账的记账员

四个对外 StateFlow：`cumulativeInputTokensFlow`、`cumulativeOutputTokensFlow`（累计输入/输出）、`currentWindowSizeFlow`（当前窗口）、`perRequestTokenCountFlow`（最近一次请求的 token 对）。

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:25`

所有累计值按 `chatKey(chatId ?: "__DEFAULT_CHAT__")` 分聊天存在 `ConcurrentHashMap` 里；`setActiveChatId` 切换当前聊天后从缓存刷新四个 Flow，UI 看到的永远是当前聊天的账。

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:52`

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:58`

`setupCollectors` 订阅**全局**服务的 `perRequestTokenCounts` / `requestWindowEstimateFlow`（记在默认 chat 名下）；`bindChatService` 给每个聊天绑它的隔离服务实例并订阅，重复绑定先取消旧收集协程。

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:102`

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:130`

`updateCumulativeStatistics` 把服务当前计数累加进该聊天的账；`resetTokenStatistics` 清掉全部分账缓存并调各服务的 `resetTokenCounters`；`setTokenCounts` 对写入值做 `coerceAtLeast(0L)` 钳制。

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:183`

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:161`

`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:215`

## 关键符号

- `ChatServiceCore`：装配 7 个 Delegate 并转发调用，自身不实现业务逻辑。
- `MessageCoordinationDelegate`：发送总控；`sendUserMessage` / `sendMessageInternal` / `summarizeHistory` / `orchestrateGroupConversation` / `queuePendingAutoContinuation` / `refreshStableContextWindow` / `regenerateSingleAiMessage` / `handleTokenLimitExceeded`。
- `MessageProcessingDelegate`：发送流水线；`sendUserMessage` / `cancelMessageInternal` / `regenerateAiMessageVariant` / `finalizeMessageAndNotify` / `notifyTurnComplete` / `ChatRuntime` / `turnCompleteCounterByChatId` / `inputProcessingStateByChatId`。
- `ChatHistoryDelegate`：历史与显示窗口；`addMessageToChat` / `createNewChat` / `switchChat` / `deleteChatHistory` / `revealMessageForCurrentChat` / `addSummaryMessage` / `findProperSummaryPosition` / `runDestructiveHistoryMutation` / `saveCurrentChat`。
- `ApiConfigDelegate`：配置中枢；`effectiveChatConfigTarget` / `effectiveChatConfig` / `ChatContextSettings` / `resolveChatContextSettings` / `saveDeepSeekConfiguration` / `contextLength`。
- `AttachmentDelegate`：附件管线；`handleAttachment` / `addAttachments` / `createAttachmentReference` / `attachPackage` / `attachWorkspaceMention` / `captureScreenContent` / `captureNotifications` / `captureLocation` / `captureMemoryFolders`。
- `TokenStatisticsDelegate`：token 分账；`setupCollectors` / `bindChatService` / `updateCumulativeStatistics` / `resetTokenStatistics` / `setActiveChatId` / `getCumulativeTokenCounts`。
- `CurrentChatWindowController`：显示窗口状态机；`applyLoadResult` / `beginLoadingDisplayWindow` / `reset`。
- `ChatDisplayWindowPaging`：分页算法；`splitDisplayPages` / `resolveDisplayPageRanges` / `takeNewestDisplayPages` / `takeOldestDisplayPages` / `DISPLAY_PAGE_TRIGGER_COUNT` / `MAX_DISPLAY_PAGE_COUNT`。
- `ChatSelectionMode`：`FOLLOW_GLOBAL`（跟随全局） / `LOCAL_ONLY`（悬浮窗本地会话）。

## 输入→处理→输出调用链

以"用户在主界面发一句话"为例：

**输入**

1. UI 调 `ChatServiceCore.sendUserMessage(...)`，参数带上 prompt 类型、角色卡覆盖、附件等。
`app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:252`
2. 转发到 `MessageCoordinationDelegate.sendUserMessage`；无当前对话则先建新对话（最多等 1 秒）。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:327`

**处理**

3. `sendMessageInternal` 做决策：群组编排门控 → 角色卡/模型/记忆空间解析 → 算 `maxTokens` → 发送前总结检查（命中则异步总结、本轮阈值 +0.5）。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:618`
4. 调 `MessageProcessingDelegate.sendUserMessage`：拼用户消息（含附件 XML 引用、回复引用）、挂工作区 hook、取按聊天隔离的 `EnhancedAIService`、调 `AIMessageManager.sendMessage` 拿到共享字符流。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:681`
5. 流收集协程收 chunk：修订跟踪处理回滚、200ms 节流滚屏、每秒持久化快照、自动朗读切分播报。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1130`

**输出**

6. 流结束：`finalizeMessageAndNotify` 用 replayCache 重建最终文本落库，`notifyTurnComplete` 回合计数器加一、重算上下文窗口。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1880`
7. `ChatServiceCore` 的 `onTurnComplete` 回调：token 累计记账、按 `turnOptions.persistTurn` 决定是否持久化聊天 token 统计。
`app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:161`
8. 协调层 `refreshStableContextWindow` 刷新稳定窗口；若发送前触发了异步总结，总结消息按锚点插入历史。
`app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt:264`

## 来源

- `app/src/main/java/com/ai/assistance/operit/services/core/ApiConfigDelegate.kt`（806 行）：配置中枢，有效配置三级推导，DeepSeek Key 专用保存通道。
- `app/src/main/java/com/ai/assistance/operit/services/core/AttachmentDelegate.kt`（921 行）：附件收发室，包附件、工作区 @引用、截屏 OCR、通知/位置/时间/记忆文件夹采集。
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatDisplayWindowPaging.kt`（136 行）：显示窗口分页算法。
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt`（1696 行）：聊天历史与显示窗口，破坏性变更框架，开场白同步。
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatSelectionMode.kt`（6 行）：`FOLLOW_GLOBAL` / `LOCAL_ONLY`。
- `app/src/main/java/com/ai/assistance/operit/services/core/CurrentChatWindowController.kt`（101 行）：显示窗口状态机。
- `app/src/main/java/com/ai/assistance/operit/services/core/MessageCoordinationDelegate.kt`（2053 行）：发送总指挥，总结双轨，群组编排，自动续写。
- `app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt`（1985 行）：发送流水线，流收集与修订，取消与变体再生。
- `app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt`（250 行）：按聊天分账的 token 统计。
- `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt`（557 行，调用方）：7 个 Delegate 的装配与转发。
