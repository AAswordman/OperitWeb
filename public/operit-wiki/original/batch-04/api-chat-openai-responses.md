---
title: OpenAI Responses 供应商
module: api
sources: 1
date: 2026-10-01
---

# OpenAI Responses 供应商

## 概述

`OpenAIResponsesProvider` 是 OpenAI **Responses API** 的供应商实现。

先说背景。App 里跟大模型聊天有两种"方言"：一种是经典的 Chat Completions（`messages` 数组），另一种是较新的 Responses API（`input` 数组、结构化的输出项）。`OpenAIResponsesProvider` 继承自 `OpenAIProvider`，专门负责把 App 内部统一的聊天格式翻译成 Responses API 能懂的格式，再把 Responses API 的返回翻译回来。

它只做格式适配，不直接发网络请求。真正的 HTTP 发送在父类。

## AI 速览

- **核心符号**：`OpenAIResponsesProvider`（供应商类）、`OpenAIResponsesPayloadAdapter`（单例：请求/响应的格式转换器）、`UsageCounts`（token 计数）、`ParsedResponseOutput`（解析后的响应）
- **主入口**：`createRequestBody(...)`（组装请求体）、`OpenAIResponsesPayloadAdapter.toResponsesRequest(...)`（chat 风格转 Responses 风格）、`OpenAIResponsesPayloadAdapter.parseNonStreamingResponse(...)`（解析非流式响应）
- **数据流向一句话**：内部聊天历史 → `createRequestBody` 生成 chat 风格 JSON → `toResponsesRequest` 转为 Responses 风格（含 input/tools/reasoning）→ 发给 Responses API → `parseNonStreamingResponse` 把 output 数组拆成文本/推理/工具调用/用量。

## 核心机制

### 请求组装：先按老格式生成，再整体翻译

`createRequestBody` 不从零拼 JSON。它先调父类的 `createRequestBodyInternal` 按 Chat Completions 风格生成一份请求，再整体翻译成 Responses 风格。

翻译规则（`toResponsesRequest`）：
- `max_tokens` → `max_output_tokens`（`mapParameterNameForResponses` 只认这一个映射）
- `response_format` → 搬进 `text.format`
- 顶层 `reasoning_effort` → 搬进 `reasoning.effort`（已存在则不覆盖）
- `tools` 数组 → Responses 风格的扁平工具定义
- `messages` 数组 → `input` 数组，原字段删除

`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:247`

### 推理（thinking）开关

思考配置由 `ThinkingConfigurationApplier.apply` 统一应用，传入供应商类型 id、模型名、endpoint 等。

`enableThinking=false` 时，会先用 `ChatUtils.stripOpenAiResponsesReasoningMetaTurns` 把历史里的推理元回合剥掉，避免把上一轮的推理标记重复发给模型。

`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:114`

### prompt 缓存键：自己算一个稳定的指纹

Responses API 支持 `prompt_cache_key` 做提示词缓存。供应商在 `customizeFinalRequestObject` 里自动附加：

- 只有供应商类型是 `OPENAI_RESPONSES` 才附加，其他兼容供应商不加
- 请求里已有 `prompt_cache_key` 就跳过，不覆盖
- 键的算法：取 system/developer/首个 user 消息做"锚点"，拼上模型名、工具调用开关、工具定义，做 SHA-256，取前 48 位 hex，前缀 `operit_resp_`
- 消息为空且无工具定义时返回 null，不附加

`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:130`

### 推理回放：把加密内容藏进历史标记

Responses API 的多轮推理需要回放上一轮的 reasoning 项（含 `encrypted_content`，模型发的加密推理内容）。做法：

1. 解析响应时，`createReasoningMetadataTag` 把 `{reasoning_id, encrypted_content, summary}` 做 Base64，包成 App 内部的标记字符串，混在聊天历史里
2. 下一轮组装请求时，`appendReasoningItemsFromAssistantMessage` 从历史里提取这些标记，解码后还原成 `{type:"reasoning", id, encrypted_content, summary}` 放进 `input`
3. `web_search_call` 这类输出项同理，经 `createOutputItemMetadataTag` / `appendOutputItemsFromAssistantMessage` 回放

解码失败只记一条 warning 日志，不抛异常。

`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:645`

### 响应解析：按 output 项类型分发

`parseNonStreamingResponse` 遍历响应的 `output` 数组：

| output 项 type | 处理 |
|---|---|
| `message` | 普通文本进 `textChunks`；`phase` 为 `commentary`（忽略大小写）时进 `reasoningChunks` 并置 `reasoningObserved=true` |
| `reasoning` | 置 `reasoningObserved=true`，生成元数据标记，`summary` 文本进 `reasoningChunks` |
| `function_call` | 转为 chat 风格 tool_call（`convertFunctionCallItemToChatToolCall`） |
| `web_search_call` | 生成输出项元数据标记 |

用量（`usage`）由 `parseUsageCounts` 解析，兼容 `prompt_tokens`/`input_tokens` 两套字段名；按字段"存在"而非"大于 0"判断有效，全零 payload 也算已观察到（代码里有评审 P1-5 注释说明）。

`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:302`

### 消息转换细节

- `tool` 角色消息（带 `tool_call_id`）→ `{type:"function_call_output", call_id, output}`
- `assistant` 消息里的 `tool_calls` → `{type:"function_call", name, arguments, call_id?}`
- `system` 角色 → 映射为 `developer`（Responses API 的叫法）
- 文本段统一转为 `input_text`，并剥离 App 内部的协议控制标记
- 图片/音频/文件/视频段分别转为 `input_image` / `input_audio` / `input_file` / `input_video`；`input_file` 要求 `file_data` 和 `filename` 都非空

`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:423`

## 关键符号

| 符号 | 说明 |
|---|---|
| `OpenAIResponsesProvider` | 供应商类，继承 `OpenAIProvider`，`useResponsesApi=true` |
| `OpenAIResponsesPayloadAdapter` | 单例对象，请求/响应的格式转换器 |
| `UsageCounts` | token 计数：`totalInputTokens`、`actualInputTokens`、`cachedInputTokens`、`outputTokens`（`actualInputTokens = total - cached`，下限 0） |
| `ParsedResponseOutput` | 解析结果：`textChunks`、`reasoningChunks`、两种元数据标记列表、`reasoningObserved`、`toolCalls`、`usage` |
| `createRequestBody` | 主入口：组装 Responses 风格请求体 |
| `toResponsesRequest` | chat 风格 JSON → Responses 风格 JSON |
| `parseNonStreamingResponse` | 解析非流式响应 |
| `mapParameterNameForResponses` | 参数名映射（目前只有 `max_tokens`→`max_output_tokens`） |
| `buildPromptCacheKey` | 生成 `prompt_cache_key` 指纹 |
| `ThinkingConfigurationApplier` | 思考配置应用器（外部类） |

## 调用链

1. **输入**：`createRequestBody(context, chatHistory, modelParameters, enableThinking, stream, availableTools, preserveThinkInHistory)` 收到内部聊天历史。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:49`
2. **处理**：父类先按 chat 风格生成请求 JSON；`toResponsesRequest` 翻译成 Responses 风格（`input`/`tools`/`reasoning`/`text.format`）；`ThinkingConfigurationApplier` 应用思考配置；`customizeFinalRequestObject` 附加 `prompt_cache_key`；请求体打日志（tools 省略、图片数据清理）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:64`
3. **输出**：返回 `RequestBody` 发给 Responses API；非流式响应经 `parseNonStreamingResponse` 拆成文本块、推理块、工具调用、用量计数，交回上层。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt:302`

## 来源

- 主文件：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIResponsesProvider.kt`（791 行，已 100% 阅读）
- 类定义与继承：`:18`；`useResponsesApi`：`:47`
- 请求组装：`:49`–`:94`；思考配置：`:109`–`:124`；缓存键：`:126`–`:193`
- 格式转换器：`:195`–`:791`；用量解析：`:221`–`:245`；请求翻译：`:247`–`:300`；响应解析：`:302`–`:385`
- 源码版本：Operit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（v1.12.2）
