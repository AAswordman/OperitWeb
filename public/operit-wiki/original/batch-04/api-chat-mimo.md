---
title: 小米 Mimo 供应商
module: api
sources: 2
date: 2026-10-01
---

# 小米 Mimo 供应商

## 概述

`MimoProvider` 是小米 MiMo 模型的聊天接口适配器。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:8`

它不直接继承 `OpenAIProvider`，而是继承 `KimiProvider`，为的是复用 Kimi 的 `reasoning_content` 兼容行为——thinking（深度思考）内容可以在请求和响应之间往返，不用重复写适配逻辑。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:25`

全类唯一的定制是鉴权头：除父类的 `Authorization: Bearer` 外，再追加一个 `api-key` 头。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:39`

## AI 速览

- 核心符号：`MimoProvider`、`KimiProvider`、`ApiProviderType.MIMO`、`applyAuthenticationHeaders`
- 主入口：`applyAuthenticationHeaders(builder, currentApiKey)`（鉴权头定制）；请求体组装沿用 `KimiProvider`/`OpenAIProvider`
- 数据流向一句话：请求发出前 → 先按父类逻辑加 Bearer 头 → 再追加 `api-key` 头 → 发出。

## 核心机制

- **继承 Kimi 而非 OpenAI**：`MimoProvider` 的父类是 `KimiProvider`。Kimi 页处理了 `reasoning_content` 字段（thinking 内容的往返），MiMo 直接复用这套行为。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:25`
- **双鉴权头**：重写 `applyAuthenticationHeaders`，先调 `super`（父链在 key 非空时加 `Authorization: Bearer <key>`），再在 `currentApiKey` 非空时 `addHeader("api-key", currentApiKey)`。最终请求同时带两个头。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:43`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:235`
- **供应商类型可覆盖**：`providerType` 是构造参数，缺省 `ApiProviderType.MIMO`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:18`
- **能力开关默认全关**：视觉、音频、视频、工具调用四个开关缺省 `false`，`customHeaders` 缺省空 Map，thinking 配置缺省空字符串。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:20`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:23`

## 关键符号

| 符号 | 说明 |
|---|---|
| `MimoProvider` | 小米 MiMo 供应商类，继承 `KimiProvider` |
| `KimiProvider` | 父类，提供 `reasoning_content` 兼容行为 |
| `ApiProviderType.MIMO` | 缺省供应商类型（构造参数可覆盖） |
| `applyAuthenticationHeaders` | 鉴权头定制入口（override） |
| `api-key` | 追加的自定义鉴权请求头 |

## 调用链

1. **输入**：上层发起 HTTP 请求前，调 `applyAuthenticationHeaders(builder, currentApiKey)`，传入请求构造器和当前 API key。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:39`
2. **处理**：`super.applyAuthenticationHeaders(builder, currentApiKey)` 按父类逻辑加 `Authorization: Bearer` 头；随后判断 `currentApiKey.isNotEmpty()`，为真则 `builder.addHeader("api-key", currentApiKey)`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:43`
3. **输出**：请求构造器带上双鉴权头，继续由上层发出请求。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:45`

## 来源

- 类定义与文档：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:8`
- 继承关系：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:25`
- 鉴权头定制：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/MimoProvider.kt:39`
- 父类 Bearer 逻辑：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:235`
