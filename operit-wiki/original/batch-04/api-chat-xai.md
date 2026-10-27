---
title: xAI 供应商
module: api
sources: 2
date: 2026-10-01
---

# xAI 供应商

## 概述

`XaiProvider` 是 xAI Grok 模型的聊天接口适配器。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:12`

它本身不实现网络协议，而是继承 `OpenAIProvider`（OpenAI 兼容的 Chat Completions 实现），只做两处定制：供应商类型固定为 `XAI`、流式响应强制带 usage 统计。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:31`
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:36`

为什么这样设计：xAI 的接口与 OpenAI 兼容，复用父类即可；thinking（深度思考）参数的注入逻辑各家不同，统一走 `ThinkingConfigurationApplier` 处理。

## AI 速览

- 核心符号：`XaiProvider`、`ApiProviderType.XAI`、`ThinkingConfigurationApplier`、`createRequestBody`、`configuredApiEndpoint`
- 主入口：`createRequestBody(context, chatHistory, modelParameters, enableThinking, stream, availableTools, preserveThinkInHistory)`
- 数据流向一句话：聊天记录进 → 父类拼出标准 OpenAI 请求体 → 注入 xAI 的 thinking 配置 → 序列化为 JSON RequestBody 发出。

## 核心机制

- **供应商身份固定**：构造时把 `providerType = ApiProviderType.XAI` 写死传给父类，外部无法覆盖。thinking 配置的 `providerTypeId` 取 `ApiProviderType.XAI.name`，与身份一致。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:31`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:65`
- **流式 usage 强制开启**：`includeUsageInStream = true` 硬编码。父类在 `stream` 为真时向请求体写入 `stream_options.include_usage=true`，服务端会在流末尾返回 token 用量。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:36`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:620`
- **thinking 配置注入**：`createRequestBody` 先调父类 `createRequestBodyInternal` 拿到标准请求体字符串，用 `JSONObject` 包一层，再调 `ThinkingConfigurationApplier.apply` 按 xAI 规则写入 thinking 相关字段，最后 `createJsonRequestBody` 转成 UTF-8 的 JSON RequestBody。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:52`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:62`
- **能力开关默认全关**：视觉、音频、视频、工具调用四个开关缺省 `false`，`customHeaders` 缺省空 Map，按需在构造时打开。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:20`
- **endpoint 另存一份**：构造传入的 `apiEndpoint` 存到私有字段 `configuredApiEndpoint`，供 thinking 配置注入时使用。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:40`
- **Responses 端点说明（备注）**：xAI 官方支持 Responses 端点，但 Operit 当前只走了 Chat Completions——`XaiProvider` 类注释原文即 "xAI's OpenAI-compatible Chat Completions provider"，工厂注释也是 "xAI uses the OpenAI-compatible Chat Completions protocol"，且类内无任何 Responses 相关实现。如需对接官方 Responses 端点，需要自行扩展，当前版本不支持。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:12`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:319`

## 关键符号

| 符号 | 说明 |
|---|---|
| `XaiProvider` | xAI 供应商类，继承 `OpenAIProvider` |
| `ApiProviderType.XAI` | 写死的供应商类型标识 |
| `ThinkingConfigurationApplier` | thinking 参数注入器（`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:265` 的 internal object） |
| `createRequestBody` | 请求体构建主入口（override） |
| `createRequestBodyInternal` | 父类方法，生成标准 OpenAI 格式请求体字符串 |
| `configuredApiEndpoint` | 私有保存的 API endpoint |
| `includeUsageInStream` | 流式 usage 开关，本类硬编码为 true |

## 调用链

1. **输入**：调用方传入 `chatHistory`（`PromptTurn` 列表）、`modelParameters`、`enableThinking`、`stream` 等参数，调 `createRequestBody`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:42`
2. **处理**：`super.createRequestBodyInternal(...)` 生成标准 OpenAI 请求体字符串 → `JSONObject` 包裹 → `ThinkingConfigurationApplier.apply(..., providerTypeId = ApiProviderType.XAI.name, ...)` 注入 thinking 配置。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:52`
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:62`
3. **输出**：`createJsonRequestBody(requestJson.toString())` 返回 UTF-8 JSON 的 `RequestBody`，交给上层 OkHttp 发出。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:73`

## 来源

- 类定义与文档：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:12`
- 供应商类型与 usage 开关：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:31`、`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:36`
- 请求体构建：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/XaiProvider.kt:42`
- usage 写入逻辑（父类）：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:620`
