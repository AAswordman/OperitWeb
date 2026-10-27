---
title: FourRouter 供应商
module: app
sources: FourRouterProvider.kt, AIServiceFactory.kt, ApiProviderConfigCollect.kt, ModelConfigData.kt, OpenAIProvider.kt
date: 2026-10-01
---

# FourRouter 供应商

## 概述

FourRouter 供应商负责把 Operit 的聊天请求发给 4Router 聚合 API（`https://4router.net`）。4Router 是 OpenAI 兼容的模型聚合网关，一次接入即可调用其上架的多种模型。和 Ollama 页一样，`FourRouterProvider` 是 `OpenAIProvider` 的空壳子类：协议逻辑全部复用父类，本类只负责“挂名”——让工厂能按 `ApiProviderType.FOUR_ROUTER` 路由到它。

对用户来说，选 4Router 意味着用一个 Key 和一个 endpoint 走聚合网关，模型名填网关侧的模型标识（如默认的 `gpt-5.4-mini`）。

## AI 速览

**核心符号清单**

- `FourRouterProvider` — 4Router 供应商类，`OpenAIProvider` 的空壳子类。
- `OpenAIProvider` — 父类：OpenAI 兼容协议的完整实现。
- `ApiProviderType.FOUR_ROUTER` — 供应商枚举值，工厂分支的路由键。
- `AIServiceFactory` — 按 `ApiProviderType` 实例化各供应商的工厂。
- `providerModel` — 继承属性，返回 `FOUR_ROUTER:<模型名>` 格式的供应商标识。

**主入口**：`AIServiceFactory` 的 `ApiProviderType.FOUR_ROUTER` 分支。

**数据流向一句话**：用户选 4Router 模型 → 工厂按枚举值构造 `FourRouterProvider` → 父类 `OpenAIProvider` 组装 OpenAI 格式 JSON 发往 `https://4router.net/v1/chat/completions` → 流式回吐。

## 核心机制

- 薄子类设计：12 个构造参数逐一透传给父类，类体无新增成员。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/FourRouterProvider.kt:19`
- `providerType` 构造参数默认值为 `ApiProviderType.FOUR_ROUTER`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/FourRouterProvider.kt:12`
- 前 6 个构造参数是连接三件套加类型：`apiEndpoint`、`apiKeyProvider`、`modelName`、`client`、`customHeaders`（默认空 Map）、`providerType`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/FourRouterProvider.kt:9`
- 后 6 个是能力开关：`supportsVision`、`supportsAudio`、`supportsVideo`、`enableToolCall`、`thinkingConfigurations`、`thinkingOptionId`，默认值全部为 false 或空字符串。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/FourRouterProvider.kt:15`
- 工厂在 `ApiProviderType.FOUR_ROUTER` 分支构造本类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:635`
- 默认配置：模型名为 `gpt-5.4-mini`，endpoint 为 `https://4router.net/v1/chat/completions`。`app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:192`
- 枚举注释把 FOUR_ROUTER 定义为“4Router”。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:31`
- 与 Ollama 不同，4Router 是云端聚合网关，需要 API Key，走公网 HTTPS；计费与模型可用性由网关侧决定。

## 关键符号

- `FourRouterProvider` — 供应商类本体，空壳子类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/FourRouterProvider.kt:6`
- `OpenAIProvider` — 父类，承载全部协议逻辑。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:88`
- `providerModel` — 继承属性，返回“供应商名:模型名”格式标识。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:141`
- `ApiProviderType.FOUR_ROUTER` — 路由枚举值。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:31`

## 调用链

1. **输入**：用户新增模型时选 4Router 类型，填网关 API Key，模型名默认 `gpt-5.4-mini`，endpoint 默认 `https://4router.net/v1/chat/completions` → 配置进入工厂。
   `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:192`
2. **处理**：工厂命中 `ApiProviderType.FOUR_ROUTER` 分支，构造 `FourRouterProvider`（参数透传）；父类按 OpenAI 格式组装请求体后经 HTTPS 发出。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:635`
3. **输出**：网关返回流式响应，父类逐块解析回吐；日志与统计中的供应商标识记为 `FOUR_ROUTER:<模型名>`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:141`

## 来源

- seed：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/FourRouterProvider.kt`（32 行，已 100% 阅读）
- 工厂分支：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`
- 默认配置：`app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt`
- 枚举定义：`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`
- 父类实现：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt`
