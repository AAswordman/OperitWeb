---
title: 豆包供应商
module: api
sources: 2
date: 2026-10-01
---

# 豆包供应商

## 概述

`DoubaoAIProvider` 是豆包（火山引擎模型）的聊天接口适配器。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:11`

同样继承 `OpenAIProvider` 复用 OpenAI 兼容逻辑，唯一特殊点是 thinking（深度思考）参数：按官方文档建议，对 thinking 始终显式传 `enabled`/`disabled`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:45`

## AI 速览

- 核心符号：`DoubaoAIProvider`、`ApiProviderType.DOUBAO`、`ThinkingConfigurationApplier`、`createRequestBody`、`configuredApiEndpoint`
- 主入口：`createRequestBody(context, chatHistory, modelParameters, enableThinking, stream, availableTools, preserveThinkInHistory)`
- 数据流向一句话：聊天记录进 → 父类拼出标准 OpenAI 请求体 → 注入豆包的 thinking 配置（显式 enabled/disabled）→ 序列化为 JSON RequestBody 发出。

## 核心机制

- **供应商类型可覆盖**：`providerType` 是构造参数（`private val`），缺省 `ApiProviderType.DOUBAO`。thinking 注入时 `providerTypeId` 取的是这个参数的 `.name`，不是写死的字符串。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:20`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:63`
- **thinking 显式开关**：注释写明按官方文档建议始终显式传入 `enabled`/`disabled`，具体写入逻辑在 `ThinkingConfigurationApplier.apply` 里。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:45`
- **不强制流式 usage**：构造参数列表中没有 `includeUsageInStream`（与 xAI 页硬编码 `true` 不同）；父类 OpenAIProvider 的该开关缺省 `false`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:33`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:100`
- **请求体组装**：`createRequestBody` 先调父类 `createRequestBodyInternal` 拿到标准 OpenAI 格式 JSON 字符串，包成 `JSONObject` 后调 `ThinkingConfigurationApplier.apply` 注入 thinking 配置，最后 `createJsonRequestBody` 转成 UTF-8 JSON RequestBody。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:57`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:60`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:71`
- **能力开关默认全关**：视觉、音频、视频、工具调用四个开关缺省 `false`，`customHeaders` 缺省空 Map。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:22`
- **endpoint 另存一份**：`configuredApiEndpoint` 私有保存构造传入的 `apiEndpoint`，供 thinking 配置注入使用。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:41`

## 关键符号

| 符号 | 说明 |
|---|---|
| `DoubaoAIProvider` | 豆包供应商类，继承 `OpenAIProvider` |
| `ApiProviderType.DOUBAO` | 缺省供应商类型（构造参数可覆盖） |
| `ThinkingConfigurationApplier` | thinking 参数注入器 |
| `createRequestBody` | 请求体构建主入口（override） |
| `createRequestBodyInternal` | 父类方法，生成标准 OpenAI 格式请求体字符串 |
| `configuredApiEndpoint` | 私有保存的 API endpoint |

## 调用链

1. **输入**：调用方传入 `chatHistory`（`PromptTurn` 列表）、`modelParameters`、`enableThinking`、`stream` 等参数，调 `createRequestBody`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:47`
2. **处理**：`super.createRequestBodyInternal(...)` 生成标准请求体字符串 → `JSONObject` 包裹 → `ThinkingConfigurationApplier.apply(..., providerTypeId = providerType.name, ...)` 按豆包规则显式写入 thinking 的 enabled/disabled。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:57`
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:60`
3. **输出**：`createJsonRequestBody(jsonObject.toString())` 返回 UTF-8 JSON 的 `RequestBody`，交给上层 OkHttp 发出。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:71`

## 来源

- 类定义与文档：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:11`
- 供应商类型参数：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:20`
- 请求体构建：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DoubaoAIProvider.kt:47`
