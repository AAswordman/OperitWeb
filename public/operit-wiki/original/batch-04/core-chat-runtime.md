---
title: 聊天运行时（消息管理/Hook/插件）
module: app
sources: 7
date: 2026-10-01
---

## 概述

聊天运行时是 Operit 聊天系统的中枢：用户发出的每条消息都要经过它组装、裁剪历史、选择执行路径（插件接管或普通 AI 调用），最后把流式回复交出去。它还负责三件配套的事：生成对话总结（上下文超限时的压缩）、取消进行中的操作、提供 prompt 组装各阶段的钩子扩展点。

设计上它刻意保持无状态：本身不存任何聊天的状态，所有数据都通过方法参数传入，UI 更新和数据持久化由调用方负责。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:73`

## AI 速览

核心符号：

- `AIMessageManager` — object 单例，消息管理中枢；主入口 `sendMessage`，消息组装入口 `buildUserMessageContent`，总结入口 `summarizeMemory`
- `PromptTurn` / `PromptTurnKind` — 发给模型的轮次结构（SYSTEM/USER/ASSISTANT/TOOL_CALL/TOOL_RESULT/SUMMARY 六种）
- `PromptHookRegistry` — 7 组 prompt 阶段钩子（输入/历史/预估历史/系统提示词/工具提示词/定稿/预估定稿），同步串行分发
- `SummaryHookRegistry` — 总结生成钩子
- `ChatRuntimeHookRegistry` — 运行时事件钩子（目前只有 `STATE_CHANGED`），支持异步分发
- `MessageProcessingPluginRegistry` — 消息处理插件注册表，第一个匹配的插件接管本轮
- `buildActivePromptHookMetadata` — 解析当前生效的角色提示（角色组 > 角色卡 > 全局）

主入口：`AIMessageManager.sendMessage(enhancedAiService, chatId, messageContent, chatHistory, …)` 返回 `SharedStream<String>`。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:373`

数据流向一句话：用户原始文本 → `buildUserMessageContent` 组装标签化消息 → `sendMessage` 转历史为 `PromptTurn` 记忆并裁剪媒体链接 → 插件优先匹配，接管或走 `EnhancedAIService` 普通调用 → 流式文本返回，多订阅者共享。

## 核心机制

### 消息组装

`buildUserMessageContent` 把用户输入拼成发给模型的完整字符串，顺序固定：代理发送者标签、处理后的正文、附件标签、工作区标签、回复标签，非空部分用空格拼接。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:315`

组装前先调 `InputProcessor.processUserInput` 做输入预处理（支持 hook 超时回调 `onHookTimeout`）。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:144`

附件有两条路：开启直接图片处理且 mimeType 为图片时，经 `ImagePoolManager.addImage` 入池并用 `MediaLinkBuilder.image` 生成 link。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:217`

图片入池失败时记日志并回退为普通附件格式。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:234`

PDF 开启直接处理时经 `MediaPoolManager.addMedia` 入池、`MediaLinkBuilder.file` 生成 link，入池失败 `check` 直接抛异常。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:251`

音频用 `MediaLinkBuilder.audio` 生成 link，失败回退普通格式。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:262`

视频同理用 `MediaLinkBuilder.video`。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:281`

### 历史裁剪

发送前历史要过两道裁剪：`limitImageLinksInChatHistory` 只保留最近 N 个用户轮次的图片链接，`limitMediaLinksInChatHistory` 只保留最近 N 个用户轮次的音视频链接，N 来自 `apiPreferences` 的配置。被裁掉的链接替换为省略提示文本，避免旧媒体占满上下文。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:405`
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:588`

### 插件接管

`MessageProcessingPluginRegistry.createExecutionIfMatched` 按注册顺序逐个询问插件，第一个返回非空结果的插件接管本轮：它的 controller 登记到活跃表，返回它的文本流。没插件匹配才走普通 AI 调用。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:431`

### 记忆提取

`getMemoryFromMessages` 只取最后一条 summary 消息之后的消息。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1335`

开启角色隔离（`splitByRole` 且目标角色名非空）时：当前角色的 AI 消息作为 ASSISTANT，其他角色的 AI 消息转为 USER 并加角色前缀；群组编排模式下用户消息再加用户前缀。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1335`
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1425`

### 对话总结

总结触发条件由 `shouldGenerateSummary` 判断。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1281`

token 使用率达到 `tokenUsageThreshold` 时触发。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1298`

上次总结后用户消息数达到 `summaryMessageCountThreshold` 时触发（需开启按消息数开关）。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1314`

`summarizeMemory` 只总结上次 summary 之后的消息，经 `enhancedAiService.generateSummary` 生成，返回 sender 为 `summary` 的 `ChatMessage`。总结前剥离 `<memory>` 标签、thinking 内容和媒体链接；开启 `dialogueReviewEnabled` 会在尾部追加对话回顾；还会统计窗口内工具使用 Top 2 的包并拼入预热块。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1046`
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1106`

### 取消

`cancelOperation(chatId)` 一次做三件事：取消插件执行的 controller、取消 `EnhancedAIService` 的对话、取消该聊天的 ToolPkg JS 执行。`cancelAllOperations` 遍历全部活跃键逐个取消。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:644`
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:669`

### Hook 体系

三套钩子分工不同。`PromptHookRegistry` 管 prompt 组装的 7 个阶段，hook 返回 `PromptHookMutation` 做覆盖式修改，metadata 合并；分发同步串行，单个 hook 异常被捕获记日志后继续下一个。
`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/PromptHookRegistry.kt:236`

`SummaryHookRegistry` 只有总结生成一个阶段，分发逻辑与 prompt 钩子相同。
`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/SummaryHookRegistry.kt:50`

运行时事件钩子目前只有一个事件 `STATE_CHANGED`。
`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:15`

`dispatch` 同步逐个调用 hook，异常被捕获记日志后继续下一个。
`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:55`

`dispatchAsync` 把分发丢到独立协程作用域异步执行。
`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:72`

`buildActivePromptHookMetadata` 按优先级解析生效角色提示：聊天绑定的角色组 > 传入的 roleCardId > 聊天绑定的角色卡名 > 全局 active prompt，返回 `{type, id, name}` 结构的元数据。
`app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ActivePromptHookMetadata.kt:25`

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| `AIMessageManager` | 消息管理中枢（单例） | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:80` |
| `sendMessage` | 消息发送主入口，返回共享流 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:346` |
| `buildUserMessageContent` | 组装用户消息全文 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:126` |
| `summarizeMemory` | 生成对话总结 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:684` |
| `getMemoryFromMessages` | 历史转 PromptTurn 记忆 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1331` |
| `shouldGenerateSummary` | 总结触发判断 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1281` |
| `cancelOperation` | 取消单聊天的进行中操作 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:644` |
| `calculateStableContextWindow` | 估算请求窗口大小 | `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:536` |
| `PromptTurn` | 模型轮次结构 | `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/PromptTurn.kt:26` |
| `PromptTurnKind` | 轮次类型枚举（6 种） | `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/PromptTurn.kt:3` |
| `PromptHookRegistry` | 7 组 prompt 阶段钩子 | `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/PromptHookRegistry.kt:80` |
| `SummaryHookRegistry` | 总结生成钩子 | `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/SummaryHookRegistry.kt:36` |
| `ChatRuntimeHookRegistry` | 运行时事件钩子 | `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt:40` |
| `buildActivePromptHookMetadata` | 解析生效角色提示 | `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ActivePromptHookMetadata.kt:15` |
| `MessageProcessingPluginRegistry` | 消息处理插件注册表 | `app/src/main/java/com/ai/assistance/operit/core/chat/plugins/MessageProcessingPluginRegistry.kt:38` |
| `MessageProcessingPlugin` | 插件接口（匹配即接管） | `app/src/main/java/com/ai/assistance/operit/core/chat/plugins/MessageProcessingPluginRegistry.kt:30` |

## 调用链

1. **输入**：调用方先调 `buildUserMessageContent`（原始文本 + 附件 + 工作区路径 + 回复消息）得到标签化完整消息。
   `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:126`
2. **处理**：`getMemoryFromMessages` 把聊天历史转成记忆。
   `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:1335`
3. **处理**：`limitImageLinksInChatHistory` / `limitMediaLinksInChatHistory` 裁剪历史中的图片与音视频链接。
   `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:405`
4. **处理**：`MessageProcessingPluginRegistry.createExecutionIfMatched` 按序询问插件是否接管。
   `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:431`
5. **输出**：插件匹配则返回插件流；否则用 `EnhancedAIService.SendMessageOptions` 组装请求发起普通调用。
   `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:485`
6. **输出**：响应流经 `shareRevisable` 做多订阅者共享，完成后清理活跃 map。
   `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:511`

总结链：`summarizeMemory` 取上次 summary 之后的消息 → 清洗（去 memory 标签、thinking 内容、媒体链接）→ 生成总结 → 拼对话回顾与包预热块 → 返回 summary 消息。
`app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt:684`

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/chat/AIMessageManager.kt`（1454 行）：消息组装、发送、总结、取消、记忆提取
- `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ChatRuntimeHookRegistry.kt`：运行时事件钩子注册与分发
- `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/PromptHookRegistry.kt`：7 组 prompt 阶段钩子
- `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/SummaryHookRegistry.kt`：总结生成钩子
- `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/ActivePromptHookMetadata.kt`：生效角色提示解析
- `app/src/main/java/com/ai/assistance/operit/core/chat/hooks/PromptTurn.kt`：轮次结构与类型
- `app/src/main/java/com/ai/assistance/operit/core/chat/plugins/MessageProcessingPluginRegistry.kt`：消息处理插件注册表

源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）
