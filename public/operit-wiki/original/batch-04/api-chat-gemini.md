---
title: Gemini 供应商
module: app
sources: 1
date: 2026-10-01
---

# Gemini 供应商

## 概述

`GeminiProvider` 是 Operit 里对接 Google Gemini 云端模型的供应商实现。它实现 `AIService` 接口：上层把聊天历史丢进来，它负责组装成 Gemini REST API 能懂的 JSON，发出去，再把流式回来的 SSE 一行行解析成文本、思考块、工具调用，吐回给上层。

一句话：它是"内部统一聊天协议"和"Gemini 私有 wire 协议"之间的翻译官。

它只做一件事的封装：把 `PromptTurn` 列表（系统/用户/助手/工具调用/工具结果）翻译成 Gemini 的 `contents` + `systemInstruction` + `generationConfig`，POST 到 `v1beta/models/<模型>:streamGenerateContent`，再把响应翻回来。

## AI 速览

- 核心符号：`GeminiProvider`（主类）、`sendMessage`（主入口）、`createRequestBody`（组装请求）、`createRequest`（组装 HTTP）、`processStreamingResponse` / `processNonStreamingResponse`（解析响应）、`extractContentFromJson`（抽内容）、`buildContentsAndCountTokens`（历史转 contents）、`GeminiThinkingConfig`（思考配置）、`HttpStatusException`（带状态码异常）。
- 主入口：`sendMessage(context, chatHistory, modelParameters, enableThinking, stream, availableTools, ...)`，返回 `Stream<String>`。
- 数据流向一句话：`List<PromptTurn>` → `contents`/`systemInstruction`/`generationConfig` JSON → POST `.../v1beta/models/<model>:streamGenerateContent?key=...` → SSE 行解析 → 文本/`</think>`/XML 工具调用 → `Stream<String>`。

## 核心机制

### 请求组装

`createRequestBody` 按固定顺序拼四个部分：`tools`、`systemInstruction`、`contents`、`generationConfig`。

- `tools`：`enableToolCall` 且有可用工具时，把 `ToolPrompt` 转成 `function_declarations`（名字+描述+JSON Schema）；`enableGoogleSearch` 为 true 时再加一个空的 `googleSearch` 工具。两个都不满足就不带 `tools` 字段。
- `systemInstruction`：系统消息单独拎出来，多个用双换行拼成 `{parts:[{text}]}`。这是 Gemini 协议的要求，系统提示不能混在 `contents` 里。
- `contents`：由 `buildContentsAndCountTokens` 生成，见下。
- `generationConfig`：`temperature`→`temperature`、`top_p`→`topP`、`top_k`→`topK`、`max_tokens`→`maxOutputTokens`。`ParameterCategory.OTHER` 的 OBJECT 参数直接挂请求根，其余进 `generationConfig`。

思考配置由 `applyGeminiThinkingConfiguration` 在最后应用：根据模型映射写 `thinkingConfig`，调用方关掉思考时强制 `includeThoughts=false`，但推理必需型模型仍保留其 level。

### 历史翻译（`buildContentsAndCountTokens`）

这是最复杂的一块。内部历史用 XML 标记写工具调用（`<随机标签名 name="工具名">`），而 Gemini 要原生 `functionCall`/`functionResponse` Part，所以要做双向翻译：

1. 先经 `StructuredToolCallBridge.compileHistoryForProvider` 编译历史。
2. 逐轮按 `PromptTurnKind` 分发：
   - ASSISTANT/TOOL_CALL 轮：用 `parseXmlToolCalls` 把 XML 转成 `{name, args}` 的 functionCall 对象，排队；文本部分另存。一次攒够后由 `emitQueuedFunctionCallsIfNeeded` 一次性拼成 `model` 角色消息，`thoughtSignature` 只挂第一个 Part。
   - TOOL_RESULT 轮：用 `parseXmlToolResults` 转成 `{name, response:{result}}`，按名字和之前排队的 open functionCall 配对消费，拼成 `user` 角色消息。
   - USER/SUMMARY 轮：直接拼成 `user` 角色消息。
3. 配对不上的 open call（比如助手连发两次调用、结果缺失）会被转成"未匹配"处理，名字填 `unmatched_function` 或原名，保证 wire 上不丢结构。
4. 图片/音视频链接由 `buildPartsArray` 转成 `inline_data` Part（`mime_type`+`data`），文本另起 Part。

token 计数是顺手算的：翻译前先剥掉 thought signature 元信息和思考内容，保证估算口径一致。

### 流式响应解析（`processStreamingResponse`）

SSE 一行行读：

1. `data: ` 开头的行即 JSON 块，`[DONE]` 为结束标记。
2. 非 `data:` 行若是被切断的 JSON，按花括号/方括号深度做分段收集，凑完整再解析——兼容代理或网关切块。
3. 每块 JSON 经 `extractContentFromJson` 抽取（见下），文本增量 `emit` 给下游；`receivedContent` 累积全量，用于重试回滚。
4. 流结束时若服务端没给终结确认（`streamCompletionConfirmed`），直接抛"网络中断"错误，不让半截内容蒙混过关。
5. 全程零内容则发一个空格占位，保证下游至少收到一次事件。

### 内容抽取（`extractContentFromJson`）

1. 先看 `error` 字段，有就抛 `IOException`。
2. 先提取 `usageMetadata`（`promptTokenCount`/`cachedContentTokenCount`/`candidatesTokenCount`），再处理 `candidates`。顺序是故意的：prompt 被拦截时没有 candidates，但用量不能漏记。
3. 无 candidates 但有 `promptFeedback` → 抛 `PromptBlockedException`（不重试）。
4. `finishReason` 落在 20 个终结集合里 → 本轮完成确认。
5. 逐 Part 处理：
   - `thought: true` 的文本包 `<think>`/`</think>` 标签，是否输出看 `includeThoughtsInOutput`。
   - `functionCall` 转回 XML：随机标签名（防和正文标签冲突）+ 参数经 `StreamingJsonXmlConverter` 流式转 XML。Part 级 `thoughtSignature` 收集起来，统一追加为 base64 元信息标签，供下一轮历史带回。
   - `inline_data` 图片：解码落盘到 `Downloads/Operit/output images`，正文插入 markdown 图片标记，alt 为 `gemini_image_序号`，地址为落盘文件的 uri。
6. 开了 Google Search 时，把 `groundingMetadata` 的搜索词和来源 URL 拼成 `<search>` 块，放在内容最前面。

### 重试与取消

`sendMessage` 主循环：

- 上限 `LlmRetryPolicy.MAX_RETRY_ATTEMPTS`，间隔 `LlmRetryPolicy.nextDelayMs` 指数退避。
- 每次请求前发 SAVEPOINT 事件；重试前发 ROLLBACK 并清空已收内容，下游看到回滚会撤回已显示的文本——"原子重试"，不会把两次半截内容拼在一起。
- 取消、用户取消异常、prompt 被拦截：直接抛，不重试。
- HTTP 4xx 抛带状态码的 `HttpStatusException`（供统一重试日志区分），5xx/网络错走普通 `IOException`。
- `cancelStreaming`：关 response、cancel call、置手动取消标志，三连。

### 日志与脱敏

`DEBUG` 硬编码 true，请求体打 logcat。打之前做两件事：`tools` 数组替换成 `[N tools omitted for brevity]`，图片 base64 替换成长度占位。API Key 拼在 URL 的 `?key=` 查询参数里，请求头日志经 `HttpLogSanitizer` 脱敏。

## 关键符号

| 符号 | 说明 |
|---|---|
| `GeminiProvider` | 主类，实现 `AIService`，构造函数默认 `providerType=GOOGLE` |
| `sendMessage` | 主入口，返回 `Stream<String>`，含重试循环 |
| `createRequestBody` | 组装 tools/systemInstruction/contents/generationConfig |
| `createRequest` | 组装 OkHttp 请求，URL 形如 `.../v1beta/models/<model>:streamGenerateContent?key=...` |
| `buildContentsAndCountTokens` | 历史翻译 + token 估算 |
| `processStreamingResponse` | SSE 逐行解析 |
| `processNonStreamingResponse` | 整包 JSON 解析 |
| `extractContentFromJson` | 单块 JSON 抽文本/思考/工具调用/图片/用量 |
| `GeminiThinkingConfig` | 思考配置（`includeThoughts`/`thinkingLevel`/`thinkingBudget`） |
| `applyGeminiThinkingConfiguration` | 应用思考契约的顶层函数 |
| `buildGeminiFunctionCallPart` | 构造带 `thoughtSignature` 的 functionCall Part |
| `parseXmlToolCalls` / `parseXmlToolResults` | XML 工具调用/结果与 Gemini 格式互转 |
| `buildToolDefinitionsForGemini` | `ToolPrompt` 转 `function_declarations` |
| `HttpStatusException` | 带 `statusCode` 的 API 异常 |
| `PromptBlockedException` | prompt 被拦截，不重试 |
| `terminalFinishReasons` | 20 个终结原因集合 |
| `determineBaseUrl` | 从端点解析 base URL，失败回退官方地址 |

## 调用链

1. **输入**：`sendMessage(context, chatHistory: List<PromptTurn>, modelParameters, enableThinking, stream, availableTools, ...)` 被调用；重置取消标志与输出 token 计数，发 SAVEPOINT 事件。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiProvider.kt:1164`
2. **处理**：
   - `createRequestBody` 把历史翻成 `contents`、系统消息抽成 `systemInstruction`、参数映射进 `generationConfig`、应用思考配置，产出 JSON 请求体。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiProvider.kt:1349`
   - `createRequest` 拼出 `$baseUrl/v1beta/models/$modelName:streamGenerateContent?key=...`，OkHttp 同步执行。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiProvider.kt:1476`
   - `processStreamingResponse` 逐行解析 SSE：`extractContentFromJson` 抽文本/`<think>`/XML 工具调用/图片，增量 `emit`；失败走 `handleRetryableError` 重试，重试前 ROLLBACK 清空已收内容。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiProvider.kt:1528`
3. **输出**：`Stream<String>` 逐块吐出文本；成功后调 `onUsageFinalized`，用量经 `onUsageReported` 按 attempt 上报。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiProvider.kt:1315`

## 来源

- 主文件：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/GeminiProvider.kt`（2252 行，已 100% 阅读）
- 类声明：`:134`；思考配置：`:49`、`:94`；请求组装：`:1349`；HTTP 组装：`:1476`；流式解析：`:1528`；内容抽取：`:1904`
- 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）
