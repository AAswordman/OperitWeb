---
title: OpenAI 供应商
module: app
sources: [1]
date: 2026-10-01
---

## 概述

`OpenAIProvider` 是 Operit 里实现 OpenAI Chat Completions 接口的聊天供应商类，也是所有 OpenAI 兼容接口供应商的基类（`open class`）。它负责一件事：把内部统一的聊天历史（`PromptTurn` 列表）拼成 OpenAI 格式的 HTTP 请求发出去，再把服务端的 SSE（Server-Sent Events，服务端推送事件）流式响应或一次性 JSON 响应逐块吐给上层。

内部聊天用的是自家的 XML 工具调用格式（`<tool name="...">`），而 OpenAI 生态用的是 `tool_calls` JSON 格式。这个类在中间做双向翻译，所以上层代码不用改，就能对接 GPT、Claude、Qwen 等支持原生 Tool Call 的模型。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:88`

## AI 速览

核心符号清单：

- `OpenAIProvider` — OpenAI 接口聊天供应商，`AIService` 实现类
- `sendMessage` — 主入口：发消息并返回文本流 `Stream<String>`
- `createRequestBodyInternal` — 拼请求 JSON（model/stream/参数/tools/messages）
- `buildMessagesAndCountTokens` — 历史转 OpenAI messages 并计输入 token
- `processStreamingResponse` — SSE 流式响应处理（data: 行 / [DONE]）
- `processResponseChunk` — 单个响应块：delta（流式）/ message（非流式）两分支
- `parseXmlToolCalls` / `convertToolCallsToXml` — XML 工具调用与 OpenAI tool_calls 双向转换
- `processToolCallChunk` / `mergeCanonicalArgs` — 流式 tool_calls 增量累积与合并
- `handleRetryableError` — 可重试错误统一处理（退避延迟 + 原子回滚）
- `tokenCacheManager` — token 计数器
- `useResponsesApi` — 子类可覆盖，切换到 Responses API 协议

主入口：`sendMessage(context, chatHistory, modelParameters, enableThinking, stream, availableTools, …)`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3207`

数据流向一句话：内部 `PromptTurn` 历史 → 转 OpenAI messages（含 XML→tool_calls 转换）→ OkHttp 发请求 → SSE/JSON 响应逐块解析（含 tool_calls→XML 转回）→ 文本流 emit 给上层。

## 核心机制

### 请求组装

请求体由 `createRequestBodyInternal` 拼装：先写 `model` 和 `stream` 字段，再把启用的 `ModelParameter` 按 INT/FLOAT/STRING/BOOLEAN/OBJECT 类型写入；OBJECT 类型解析失败时记警告并按原字符串传递，避免崩溃。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:609`

`includeUsageInStream` 为 true 且是流式请求时，会加上 `stream_options.include_usage=true`，让服务端在流里回传用量。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:621`

`createRequestBody` 在拼完 JSON 后，还会经 `ThinkingConfigurationApplier.apply` 把思考配置（`thinkingConfigurations`/`thinkingOptionId`）应用进去，子类行为可被覆盖。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:577`

### Tool Call 双向转换

`enableToolCall` 默认为 false；只有它为 true 且确实传入了非空工具列表时，才真正启用（`effectiveEnableToolCall`）。启用后请求体带上 `tools` 数组和 `tool_choice: "auto"`，让模型自己决定用不用工具。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:671`

发送前：`parseXmlToolCalls` 用正则从历史里抠出 XML 工具调用，转成 OpenAI `tool_calls`（含确定性 call id），文本里去掉工具标签；工具名带冒号的（如 `pkg:tool`）会被 `wrapPackageToolCallsWithProxy` 包装成 `package_proxy` 调用。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1729`

接收后：`convertToolCallsToXml` 把返回的 tool_calls 转回 XML（参数值做 XML 转义），上层继续用老逻辑解析。流式增量里 name 和 arguments 可以分处不同 delta 到达，`processToolCallChunk` 按 index 累积，`mergeCanonicalArgs` 默认增量追加、遇到前缀扩展快照则整体替换。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1967`

历史里的 `TOOL_RESULT` 按名称与未完成的 tool_call 配对，生成带 `tool_call_id` 的 `role: "tool"` 消息；配不上的在边界处统一生成占位结果。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1145`

### 多模态输入

四个 `protected` 开关 `supportsVision`/`supportsAudio`/`supportsVideo`/`supportsFiles` 默认全 false，子类按需打开。`buildContentField` 把文本里的媒体链接转成 OpenAI 格式：音频→`input_audio`、视频→`video_url`、文件→`input_file`（带 filename 和 file_data）、图片→`image_url`（data URI）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:893`

当前 Provider 不支持的媒体类型会被移除并记警告；全部移除后按类型返回省略提示，彻底没内容时返回 `[Empty]`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:940`

### 流式响应处理

`processStreamingResponse` 逐行读，只处理 `data:` 开头的行。收到 `[DONE]` 时 flush 图片缓冲、关闭所有未闭合的工具调用、关闭思考标签；流结束时没确认完成就抛网络中断异常。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3107`

思考内容包在 `<think>` 标签里输出；一旦正文开始输出，后续再到的推理内容全部忽略（硬切策略）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:2908`

服务端返回的图片（`data` 数组的 `b64_json`/`url`，或 `image_generation.` 事件）会被下载/解码后存到 Download 目录的 `Operit/output images`，再以 Markdown 图片链接的形式 emit 进流里。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:454`

### 重试与取消

`sendMessage` 用 `LlmRetryPolicy.MAX_RETRY_ATTEMPTS` 做上限的重试循环。每次重试前通过 `emitter.emitRollback(requestSavepointId)` 把本轮已接收的内容原子回滚，用户看不到重复文本；重试间隔取 `LlmRetryPolicy.nextDelayMs` 的退避延迟。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3238`

用户取消和协程取消直接抛出不重试；`enableRetry=false` 时可重试错误也直接抛。HTTP 4xx 会抛带状态码的 `HttpStatusException`，其余失败是普通 `IOException`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3319`

`cancelStreaming` 把 `isManuallyCancelled` 置 true、关闭活跃 Response、对没取消的 Call 调 `cancel()`，正在跑的流会转为 `UserCancellationException`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:244`

### 鉴权与端点

`createRequest` 用 `EndpointCompleter.completeEndpoint(apiEndpoint, providerType)` 补全端点 URL；`applyAuthenticationHeaders` 在 apiKey 非空时加 `Authorization: Bearer <key>`；`customHeaders` 逐个追加。请求打上 `LlmRequestTraceContext` tag，日志里能按 requestId 追踪。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1816`

请求头日志经过 `HttpLogSanitizer.headersForLog` 脱敏；请求体日志里 tools 字段替换成 `[N tools omitted for brevity]`，图片 base64 被 `sanitizeImageDataForLogging` 换成占位符。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1851`

### Token 计数与用量

`tokenCacheManager` 是公开的计数器。`inputTokenCount`/`outputTokenCount`/`cachedInputTokenCount` 三个属性直接读它；`sendMessage` 开始时先把输出计数清零。usage 回来后 `applyUsageToCounters` 更新实际输入/缓存输入/输出 token。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:127`

`providerModel` 返回 `供应商名:模型名` 格式的标识符（如 `OPENAI:gpt-4o`）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:140`

### 连通性测试

`testConnection` 用一条 SYSTEM 提示词加一句 "Hi" 发起一次不重试的流式请求，成功就返回成功文案；`CancellationException` 原样传播，不包成失败结果。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:265`

模型列表走 `ModelListFetcher.getModelsList`，传 apiKey、端点和供应商类型。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:256`

### Responses API（子类扩展点）

`useResponsesApi` 默认 false。切到 true 后，参数名经 `OpenAIResponsesPayloadAdapter.mapParameterNameForResponses` 映射，请求体经 `convertChatRequestToResponsesRequest` 转换，流式事件走 `processResponsesStreamingEvent`（处理 `response.output_text.delta`、`response.reasoning_text.delta`、`response.function_call_arguments.delta`、`response.completed` 等事件）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:2579`

## 关键符号

| 符号 | 职责 |
|---|---|
| `OpenAIProvider` | OpenAI 接口聊天供应商，`AIService` 实现，`open` 可被继承 |
| `sendMessage` | 主入口：构建请求→发送→处理响应→返回文本流，带重试 |
| `createRequestBodyInternal` | 拼请求 JSON：model/stream/参数/tools/messages |
| `buildMessagesAndCountTokens` | 历史转 OpenAI messages + 输入 token 计数 |
| `buildToolDefinitions` | `ToolPrompt` 列表转 OpenAI function tool 定义 |
| `parseXmlToolCalls` | XML 工具调用 → OpenAI tool_calls |
| `convertToolCallsToXml` | OpenAI tool_calls → XML（回给上层） |
| `processStreamingResponse` | SSE 行循环：data: 解析 / [DONE] 收尾 |
| `processResponseChunk` | 单响应块：delta 与 message 两分支 |
| `processResponsesStreamingEvent` | Responses 协议流式事件分发 |
| `processToolCallChunk` | 流式 tool_calls 按 index 增量累积 |
| `mergeCanonicalArgs` | 参数增量合并：追加或快照替换 |
| `handleRetryableError` | 可重试错误：退避延迟 + 原子回滚 + 重试计数 |
| `cancelStreaming` | 用户取消：关 Response、取消 Call |
| `testConnection` | 连通性探测：SYSTEM + "Hi" 走一次流式 |
| `getModelsList` | 经 ModelListFetcher 拉模型列表 |
| `tokenCacheManager` | TokenCacheManager：输入/输出/缓存 token 计数 |
| `HttpStatusException` | 带 HTTP 状态码的 API 异常 |
| `StreamEmitter` | 流 emit 器：内容/思考/标签/savepoint/rollback |
| `StreamingState` | 流处理状态：工具累积器、图片缓冲、思考标记 |

## 调用链

1. **输入**：`sendMessage(context, chatHistory, …)` 收到内部 `PromptTurn` 历史 → `createRequestBody` 拼请求 JSON → `createRequest` 补全端点、加 `Bearer` 鉴权头和自定义头 → OkHttp `Call` 发起（`Dispatchers.IO`）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3207`
2. **处理**：流式走 `processStreamingResponse` 逐行解析 `data:`（tool_calls 增量累积、思考/正文分流、图片落盘），非流式取 `choices[0].message`；tool_calls 转回 XML；失败按 `handleRetryableError` 退避重试，重试前原子回滚已收内容。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3107`
3. **输出**：`StreamEmitter` 把文本/思考/工具 XML 逐块 emit 给上层，`Stream<String>` 经 `withEventChannel` 附带事件通道返回；成功后调 `onUsageFinalized`，usage 经 `applyUsageToCounters` 更新 token 计数。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3507`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt`（3509 行，100% 已读）
