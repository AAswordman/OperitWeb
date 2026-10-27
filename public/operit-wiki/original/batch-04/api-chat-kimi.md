---
title: Kimi 供应商
module: app
sources: [1]
date: 2026-10-01
---

## 概述

- `KimiProvider` 是 Operit 对接 Moonshot（Kimi K2.5 API）的聊天供应商类。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:19`
- 它继承自 `OpenAIProvider`，走 OpenAI Chat Completions 兼容协议；发送、流式解析、重试等逻辑全部在父类，本类只负责请求体的拼装。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:35`
- 类文档声明：thinking 开启时 `reasoning_content` 的处理镜像 [[api-chat-deepseek|DeepSeek 供应商]] 的行为。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:20`
- 默认配置：`providerType` 为 `ApiProviderType.MOONSHOT`，`supportsVision`/`supportsAudio`/`supportsVideo` 与 `enableToolCall` 默认全关。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:28`

## AI 速览

核心符号清单：

- `KimiProvider` — Kimi K2.5（Moonshot）聊天供应商，`OpenAIProvider` 的 `open` 子类
- `createRequestBody` — 重写：按 thinking 开关分两支拼请求 JSON
- `applyThinkingParams` — 局部函数：经 `ThinkingConfigurationApplier` 注入思考参数
- `buildMessagesWithReasoning` — 私有：历史转 messages 数组，处理 reasoning_content 与 tool_calls 配对
- `queueToolCalls` — 工具调用攒队：文本/推理拼接，分配本地顺序 id
- `emitQueuedToolCallsIfNeeded` — 把攒下的 assistant 消息一次性落盘
- `flushOpenToolCallsAsUnmatched` — 未匹配的 tool_calls 转占位 tool 消息
- `sendMessage` — 重写后直接委托父类，不改发送逻辑

主入口：`sendMessage(context, chatHistory, …)`（实际发送在父类）；请求体入口是 createRequestBody（见核心机制）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:481`

数据流向一句话：内部 `PromptTurn` 历史 → thinking 双分支拼 JSON（model/stream/参数/tools/思考配置）→ buildMessagesWithReasoning 转 messages 数组（XML→tool_calls、reasoning_content 注入、未匹配冲刷）→ 父类发送。

## 核心机制

### 请求体双分支（createRequestBody）

- `createRequestBody` 被重写，内部按 `enableThinking` 分两支。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:51`
- 关闭分支：直接拿父类 `createRequestBodyInternal` 的结果；流式时补 `stream_options`（`include_usage=true`），再走一遍思考参数注入后返回。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:75`
- 开启分支：手写 `model` 与 `stream` 字段，流式同样补 `stream_options`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:85`
- 只写 `isEnabled` 的模型参数：`INT`/`FLOAT`/`STRING`/`BOOLEAN` 按类型强转。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:98`
- `OBJECT` 类型按首字符 `{`/`[` 解析为 JSON 对象/数组；失败记 `AppLogger.w` 警告并回退为原始字符串。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:107`
- `effectiveEnableToolCall` 要求 `enableToolCall` 为真且工具列表非空。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:125`
- 工具启用时写入 `tools` 数组和 `tool_choice`（`auto`）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:131`

### 思考参数注入

- 局部函数 `applyThinkingParams` 调 `ThinkingConfigurationApplier.apply`，传入 providerType 名、模型名、构造时保存的 `configuredApiEndpoint`、思考配置与开关。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:61`

### 消息数组与 reasoning_content（buildMessagesWithReasoning）

- 遍历历史前用 `comparableContentForTurn(turn, preserveThinkInHistory=true)` 取可比内容；token 统计同样固定 `preserveThinkInHistory=true`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:265`
- ASSISTANT 回合：`ChatUtils.extractThinkingContent` 拆 thinking 标签内容，`parseXmlToolCalls` 从正文抠 XML 工具调用，包工具调用经 `wrapPackageToolCallsWithProxy` 包装。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:290`
- 有工具调用时先攒起来：文本与推理内容按换行拼接，每个 toolCall 深拷贝后分配 `generatedToolCallId` 生成的本地顺序 id。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:202`
- 同时登记 `StructuredToolCallBridge.OpenToolCall`（callId + 工具名），供后续工具结果按名配对。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:206`
- 攒发的 assistant 消息固定带 `reasoning_content` 字段；文本为空时 `content` 置 null。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:220`
- TOOL_RESULT 回合：先落盘攒发的 assistant 消息，再用 `parseXmlToolResults` 解析工具结果。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:354`
- 结果经 `StructuredToolCallBridge.consumeMatchingToolCalls` 与未完成的调用按名称配对。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:360`
- 命中的结果以 `role: tool` 消息发出，带对上号的 `tool_call_id`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:368`
- 边界冲刷：SYSTEM/USER 到来、新 toolCalls 到来但旧调用还没结果、历史遍历结束时，未匹配的调用由 `flushOpenToolCallsAsUnmatched` 先落盘攒发队列，再转成占位 tool 消息（原因如 system_boundary、history_end）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:237`
- 占位消息的内容来自 `StructuredToolCallBridge.unmatchedToolResultContent`，冲刷前记一条带未匹配数量的警告日志。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:250`
- 不开工具调用时历史直接转 role 消息；ASSISTANT 回合仍拆 thinking 并带 `reasoning_content`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:444`

### 请求日志与脱敏

- thinking 分支返回前打完整请求体日志：先把 `tools` 数组替换成 `[N tools omitted for brevity]` 占位。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:152`
- 再过 `sanitizeImageDataForLogging` 脱敏图片数据，最后 `logLargeString` 分块输出，tag 为 `KimiProvider`，前缀 `Final Kimi K2.5 request body:`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:156`

## 关键符号

| 符号 | 职责 |
|---|---|
| `KimiProvider` | Kimi K2.5（Moonshot）聊天供应商，`OpenAIProvider` 的 `open` 子类 |
| `createRequestBody` | 重写：thinking 双分支拼请求 JSON |
| `applyThinkingParams` | 局部函数：经 `ThinkingConfigurationApplier` 注入思考参数 |
| `buildMessagesWithReasoning` | 私有：历史转 messages，reasoning_content 与 tool_calls 配对 |
| `queueToolCalls` | 工具调用攒队：文本/推理拼接，分配本地顺序 id 并登记 OpenToolCall |
| `emitQueuedToolCallsIfNeeded` | 把攒下的 assistant 消息一次性落盘 |
| `flushOpenToolCallsAsUnmatched` | 未匹配的 tool_calls 转占位 tool 消息 |
| `sendMessage` | 重写后直接委托 `super.sendMessage`，不改发送逻辑 |
| `configuredApiEndpoint` | 构造时保存的 endpoint，供思考参数注入使用 |

## 调用链

1. **输入**：`sendMessage` 收到内部 `PromptTurn` 历史与模型参数，直接委托父类 `super.sendMessage`（本类不改发送逻辑）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:481`
2. **处理**：`createRequestBody` 按 thinking 开关分两支拼请求 JSON（见核心机制：双分支/思考注入/工具开关），历史经预处理后转成 messages 数组：XML 工具调用译成 tool_calls、推理内容注入 reasoning_content、配不上的调用在边界处转占位消息。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:51`
3. **输出**：请求体经 `createJsonRequestBody` 转成 RequestBody 交父类发出；thinking 分支在返回前把脱敏后的完整请求打一条分块日志。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt:159`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/KimiProvider.kt`（512 行，100% 已读）
