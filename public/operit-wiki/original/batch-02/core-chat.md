---
title: 聊天与消息处理（总览）
module: app
sources: 8
date: 2026-09-30
---

# 聊天与消息处理（总览）

## 概述

- 聊天章管的是一条用户消息的完整一生：从输入框发出，到变成发给模型的请求，再到 AI 回复流式呈现、落库、记账。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:54`
- 分工上，`MessageProcessingDelegate` 是每场会话的导演（管流程与状态）。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:54`
- `AIMessageManager` 是无状态的信使，只管和 AI 服务打交道。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:75`
- `ChatHistoryDelegate` 是档案馆，管持久化与展示窗口。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:32`
- `TokenStatisticsDelegate` 是记账员，管 token 统计。`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:16`
- 本页是总览：主链路与分工在此讲清，消息管理细节、Hook 与插件的完整机制见细页。

## AI 速览

核心符号清单（一行一个）：

- `MessageProcessingDelegate` — 每会话消息处理总导演：发送、取消、重生成、流收集、自动朗读。
- `AIMessageManager` — 无状态单例：构建用户消息内容、发消息给 AI 服务、生成对话总结。
- `ChatHistoryDelegate` — 聊天历史档案馆：Room 持久化、展示窗口分页、开场白/分支/总结插入。
- `TokenStatisticsDelegate` — token 记账员：按会话累计输入/输出 token 与窗口大小。
- `CurrentChatWindowController` — 展示窗口滑块：维护内存中可见消息的起止与翻页标志。
- `MessageProcessingPluginRegistry` — 消息处理插件插槽：首个匹配的插件可接管整轮处理。
- `ChatRuntimeHookRegistry` — 运行时钩子广播站：向钩子分发事件。
- `ChatTurnOptions` — 本轮开关：是否落库、是否通知、是否隐藏用户消息、是否禁警告。

主入口函数：UI 层发消息只调 `sendUserMessage` 这一个函数。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:681`

数据流向一句话：用户文本 → sendUserMessage 校验组装并落库用户消息 → AIMessageManager.sendMessage（插件接管或 EnhancedAIService 流式）→ 流式收集修订落库并回填 token → ChatHistoryDelegate 持久化、TokenStatisticsDelegate 记账 → CurrentChatWindowController 更新展示窗口。

## 核心机制

### 一条消息的一生（人话版）

你在输入框敲完发送，发送入口先做空消息安检：空文本、无附件、非自动续写、非群组编排时直接忽略。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:711`

同一会话还在等上一轮回复（`isLoading` 为 true）时，新的发送直接忽略并记警告日志。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:719`

每轮分配 `turnId`（`turnSequence` 自增），写入 `activeTurnId` 供取消时识别过期回合。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:726`

`buildUserMessageContent` 把原始文本"加料"成发给模型的完整内容。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:126`

先过 `processUserInput` 做输入钩子处理。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:144`

再依次拼上代理发送者标签、回复引用标签、工作区变更附件、多媒体附件标签。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:156`

图片附件经 `ImagePoolManager.addImage` 入池。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:219`

再按附件类型调 `MediaLinkBuilder` 的 image/file/audio/video 方法转成模型可读的 link。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:233`

按 `shouldAddUserMessageToChat` 决定本轮是否落库用户消息。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:815`

落库走 `addMessageToChat`。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:872`

首条消息先用 `fallbackConversationTitle`（附件名或"新会话"）占位标题。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:111`

再由 `launchConversationTitleGeneration` 异步生成真实标题，仅当标题仍为占位时才更新。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:116`

发送阶段先调 `getMemoryFromMessages`，只取上条总结之后的消息。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:380`

旧轮次的图片/音视频 link 按配置裁剪，只留最近 N 轮，防止上下文爆炸。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:588`

然后问插件注册表有没有插件认领：`createExecutionIfMatched` 返回首个匹配插件的执行体。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:431`

有接管时整轮交由插件执行，不调大模型。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:447`

无接管则调 AI 服务发送，响应流经 `shareRevisable` 共享给多路消费者。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:511`

模型回复是字符流。`TextStreamRevisionTracker` 在流收集协程里实例化，处理流中的修订事件。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1231`

遇到 `SAVEPOINT`/`ROLLBACK` 时回滚到保存点，保证最终文本与流修订一致。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1327`

流快照每 1000ms 落库一次（`claimStreamingSnapshot`），而不是每字一写。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1283`

自动朗读走 WaifuMessageProcessor.streamTtsText 把字符流转成朗读文本流。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1237`

朗读切句用 TtsSegmenter.nextSegmentEnd 在标点处断句，逐段播报。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1265`

流结束做收尾：`resolveFinalContent` 优先用共享流的重放缓存重建最终文本（防丢尾字）。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1895`

随后 `contentStream` 置空并落库终稿。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1908`

`notifyTurnComplete` 负责回合收尾：计数加一、重算窗口、回调上层。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1862`

重算 `nextWindowSize` 后回调 `onTurnComplete`，上层在此触发总结判断与持久化。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1877`

### 为什么这样设计

`AIMessageManager` 是无状态的 `object` 单例。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:80`

各会话的运行时状态放在 `ChatRuntime` 里，按会话隔离在 `chatRuntimes` 映射中，多会话并发互不干扰。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:221`

插件接管优先于调模型：特定消息不需要花 token 走大模型，插件直接产出回复流，又快又省。`app/src/main/java/com/ai/assistance/operit/core/chat/plugins/MessageProcessingPluginRegistry.kt:52`

内存只留"展示窗口"：长会话全量消息放内存会爆，`CurrentChatWindowController` 只维护最近一到两页的展示窗口。`app/src/main/java/com/ai/assistance/operit/services/core/CurrentChatWindowController.kt:14`

翻页时按时间戳向 Room 按需拉取，每批 `DISPLAY_WINDOW_QUERY_BATCH_SIZE`（80 条）。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:44`

取消保留部分回复：用户点停止时已吐出的字是有效内容，`detachStreamingAiMessage` 把流消息固化落库而不是丢弃。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:436`

总结是窗口不够用的解法：`shouldGenerateSummary` 按 token 使用率或消息数触发。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1281`

`summarizeMemory` 把旧消息压缩成一条 sender 为 summary 的消息，后续只带总结加新消息进上下文。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:684`

`ChatTurnOptions` 是内部调用的开关：自动续写、群组编排等场景用 `persistTurn` 等精确控制是否落库、是否通知。`app/src/main/java/com/ai/assistance/operit/data/model/ChatTurnOptions.kt:3`

### 取消与重生成

`cancelMessage` 保留部分回复。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:564`

`cancelMessageForDestructiveMutation` 用于破坏性变更，不保留部分回复。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:575`

内部取消逻辑用 `cancellationMutex` 加锁，并校验 `activeTurnId`，旧取消不会误伤已开始的新回合。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:502`

实际取消走 `cancelOperation`：插件执行、AI 服务对话、ToolPkg JS 执行三连取消。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:644`

`regenerateAiMessageVariant` 按 `targetMessageTimestamp` 重生成单条回复。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1604`

先回调 `onVariantPreviewStarted` 给预览，完成后调 `onVariantReady` 给终稿。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1622`

会话忙时抛 `chat_regenerate_busy` 异常。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1627`

### 历史、开场白与分支

`ChatHistoryDelegate` 管聊天历史的持久化与展示。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:32`

它的内存 `_chatHistory` 只放当前展示窗口的消息。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:65`

`getChatHistory` 读全量持久历史，`getRuntimeChatHistory` 读运行时历史。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:336`

`syncOpeningStatementIfNoUserMessage` 在无用户消息时同步角色卡开场白，群组会话跳过。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:665`

开场白用 provider 为空字符串标记为非 AI 生成。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:749`

`createBranch` 按时间戳建分支，分支继承父会话的 token 统计。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:905`

`deleteChatHistory` 删当前会话前先迁到同角色卡或群组的最新会话。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1061`

每次消息持久化后经 `dispatchMessagePersisted` 通知插件。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1191`

### 运行时钩子

`ChatRuntimeHookEvent` 目前只有 `STATE_CHANGED` 一种事件。`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:15`

`ChatRuntimeHookContext` 携带会话 id、slot、状态、活跃会话集合、本轮工具调用数等。`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:19`

`registerHook` 按 id 去重注册。`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:45`

`dispatch` 逐个调用钩子，单个钩子异常只记日志不中断分发。`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:55`

`dispatchAsync` 走独立协程域（`dispatchScope`）异步分发。`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:72`

## 关键符号

- `MessageProcessingDelegate`：构造注入历史读写、标题、错误、回合完成、token 超限、朗读等回调。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:54`
- `MessageProcessingDelegate.sendUserMessage`：发送总入口。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:681`
- `ChatRuntime`：每会话的运行时状态容器。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:203`
- 用 `turnSequence` 自增与 `activeTurnId` 做回合版本控制。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:214`
- `AIMessageManager.buildUserMessageContent`：用户消息内容构建。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:126`
- `AIMessageManager.sendMessage`：返回共享字符流，插件接管或调 AI 服务。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:346`
- `AIMessageManager.summarizeMemory`：生成总结消息。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:684`
- `AIMessageManager.shouldGenerateSummary`：token 使用率与消息数双阈值。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1281`
- `AIMessageManager.getMemoryFromMessages`：总结之后的消息转 PromptTurn。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1331`
- `ChatHistoryDelegate.addMessageToChat`：`historyUpdateMutex` 串行写入。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1408`
- `ChatHistoryDelegate.switchChat`：切换时 `allowAddMessage` 置 false 禁止写入。`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:864`
- `TokenStatisticsDelegate.updateCumulativeStatistics`：累计值累加服务当前计数。`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:183`
- `TokenStatisticsDelegate.setActiveChatId`：切换活跃会话并刷新 UI 流。`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:125`
- `CurrentChatWindowController.beginLoadingDisplayWindow`：防重入。`app/src/main/java/com/ai/assistance/operit/services/core/CurrentChatWindowController.kt:90`
- `MessageProcessingPluginRegistry.createExecutionIfMatched`：首个匹配插件接管。`app/src/main/java/com/ai/assistance/operit/core/chat/plugins/MessageProcessingPluginRegistry.kt:52`
- `ChatTurnOptions.persistTurn`：默认 true，控制本轮是否落库。`app/src/main/java/com/ai/assistance/operit/data/model/ChatTurnOptions.kt:3`

## 调用链

一条用户消息的主链路（输入 → 处理 → 输出）：

**输入：**

1. UI 调 `sendUserMessage`，空消息直接忽略。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:711`
2. 同一会话还在处理中（`isLoading`）时新的发送被忽略。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:719`
3. `turnId` 自增并写入 `activeTurnId`，用于取消时识别过期回合。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:726`
4. `buildUserMessageContent` 组装用户消息内容（输入钩子、代理标签、回复标签、工作区标签、附件标签）。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:126`
5. 按 `shouldAddUserMessageToChat` 决定本轮是否落库用户消息。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:815`
6. 落库走 `addMessageToChat`。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:872`

**处理：**

7. 取 AI 服务：`getChatInstance` 优先按会话取实例，缺失回退全局实例。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:917`
8. 发送阶段先调 `getMemoryFromMessages` 取总结之后的历史，再裁剪旧多媒体 link。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:380`
9. 问插件注册表：`createExecutionIfMatched` 返回首个匹配插件的执行体，有接管就走插件。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:431`
10. 无接管则调 AI 服务发送，响应流经 `shareRevisable` 共享。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:511`
11. 流收集用修订追踪器处理 `SAVEPOINT`/`ROLLBACK` 事件。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1327`
12. 快照每 1000ms 落库一次（`claimStreamingSnapshot`）。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1283`

**输出：**

13. `resolveFinalContent` 用重放缓存重建最终文本。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1895`
14. `contentStream` 置空并落库终稿。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1908`
15. `notifyTurnComplete` 回调回合完成，上层触发总结判断与持久化。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1862`
16. `cleanupRuntimeAfterSend` 复位运行时状态。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:1955`
17. `updateCumulativeStatistics` 把服务当前计数累加到该会话的 token 统计。`app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt:183`

取消链路：`cancelMessage` 保留部分回复。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:564`

`cancelMessageForDestructiveMutation` 用于破坏性变更，不保留部分回复。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:575`

内部取消用 `cancellationMutex` 加锁并校验 `activeTurnId`，旧取消不会误伤新回合。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:502`

实际取消走 `cancelOperation`：插件执行、AI 服务对话、ToolPkg JS 执行三连取消。`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:644`

最后 `detachStreamingAiMessage` 把流消息固化落库。`app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt:436`

## 关联条目

- [聊天运行时（消息管理/Hook/插件）](entry.html?id=batch-04/core-chat-runtime)：本章细页，AIMessageManager 主循环、Hook 分发、插件匹配执行的完整机制。
- [对话编排运行时](entry.html?id=batch-04/api-chat-runtime)：EnhancedAIService 侧的发送与编排。
- [Token 统计与 usage 上报](entry.html?id=batch-04/api-chat-tokens)：服务侧 token 计数来源。
- [会话记忆与上下文总结](entry.html?id=batch-04/api-chat-memory)：总结消费侧。
- [聊天历史仓库](entry.html?id=batch-05/data-repo-chat)：ChatHistoryManager 的 Room 持久化细节。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt`
- `app/src/main/java/com/ai/assistance/operit/services/core/MessageProcessingDelegate.kt`
- `app/src/main/java/com/ai/assistance/operit/services/core/CurrentChatWindowController.kt`
- `app/src/main/java/com/ai/assistance/operit/core/chat/plugins/MessageProcessingPluginRegistry.kt`
- `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatTurnOptions.kt`
- `app/src/main/java/com/ai/assistance/operit/services/core/TokenStatisticsDelegate.kt`
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt`
