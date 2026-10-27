---
title: NousPortal 供应商
module: app
sources: NousPortalProvider.kt, OpenRouterProvider.kt, AIServiceFactory.kt, ApiProviderConfigCollect.kt, ModelConfigData.kt
date: 2026-10-01
---

# NousPortal 供应商

## 概述

NousPortal 供应商负责把 Operit 的聊天请求发给 NousResearch 的推理 API（Nous Portal）。它不直连 OpenAI 协议基类，而是继承 `OpenRouterProvider`，复用其请求头与 reasoning 机制。

和 Ollama 页的薄子类一样，`NousPortalProvider` 自身也是空壳：12 个构造参数透传，真正的差异化行为（默认请求头、reasoning 对象组装）全部来自父类 `OpenRouterProvider`。

## AI 速览

**核心符号清单**

- `NousPortalProvider` — NousPortal 供应商类，`OpenRouterProvider` 的空壳子类。
- `OpenRouterProvider` — 父类：在 OpenAI 兼容基础上叠加 OpenRouter 请求头与 reasoning 规范。
- `ApiProviderType.NOUS_PORTAL` — 供应商枚举值，工厂分支的路由键。
- `AIServiceFactory` — 按 `ApiProviderType` 实例化各供应商的工厂。
- `ThinkingConfigurationApplier` — 按模型配置的 thinking 规则生成统一 `reasoning` 对象的工具。

**主入口**：`AIServiceFactory` 的 `ApiProviderType.NOUS_PORTAL` 分支。

**数据流向一句话**：用户选 NousPortal 模型 → 工厂按枚举值构造 `NousPortalProvider` → 父类先按 OpenAI 格式组装请求体，再把 thinking 规则转成 `reasoning` 对象塞入 → 发往 `https://inference-api.nousresearch.com/v1/chat/completions`。

## 核心机制

- 薄子类设计：12 个构造参数逐一透传给父类，类体无新增成员。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NousPortalProvider.kt:19`
- `providerType` 构造参数默认值为 `ApiProviderType.NOUS_PORTAL`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NousPortalProvider.kt:12`
- 前 6 个构造参数是连接三件套加类型：`apiEndpoint`、`apiKeyProvider`、`modelName`、`client`、`customHeaders`（默认空 Map）、`providerType`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NousPortalProvider.kt:9`
- 后 6 个是能力开关：`supportsVision`、`supportsAudio`、`supportsVideo`、`enableToolCall`、`thinkingConfigurations`、`thinkingOptionId`，默认值全部为 false 或空字符串。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NousPortalProvider.kt:15`
- 工厂在 `ApiProviderType.NOUS_PORTAL` 分支构造本类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:650`
- 默认配置：模型名留空（用户自填），endpoint 为 `https://inference-api.nousresearch.com/v1/chat/completions`。`app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:197`
- 枚举注释把 NOUS_PORTAL 定义为“Nous Portal / Inference API”。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:32`
- 继承的默认请求头：用户没自定义时，父类自动补 `HTTP-Referer`（`DEFAULT_HTTP_REFERER`，值为 ai.assistance.operit）与 `X-Title`（`DEFAULT_X_TITLE`，值为 Assistance App）；用户写了同名头则以用户的为准。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:112`
- 继承的 reasoning 机制：父类用 `ThinkingConfigurationApplier` 生成统一 reasoning 对象。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:99`
- 父类不走通用 `enableThinking` 开关，reasoning 来自模型配置的可编辑 thinking 规则。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:16`

## 关键符号

- `NousPortalProvider` — 供应商类本体，空壳子类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NousPortalProvider.kt:6`
- `OpenRouterProvider` — 父类，叠加 OpenRouter 请求头与 reasoning 规范。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:23`
- `mergeOpenRouterHeaders` — 父类伴生对象的头合并函数，用户自定义头优先。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:115`
- `ApiProviderType.NOUS_PORTAL` — 路由枚举值。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:32`

## 调用链

1. **输入**：用户新增模型时选 NousPortal 类型，填 API Key 与模型名，endpoint 默认 `https://inference-api.nousresearch.com/v1/chat/completions` → 配置进入工厂。
   `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:197`
2. **处理**：工厂命中 `ApiProviderType.NOUS_PORTAL` 分支，构造 `NousPortalProvider`（参数透传）；父类先按 OpenAI 格式组装请求体，再把 thinking 规则转成 `reasoning` 对象塞入，同时合并默认请求头。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:650`
3. **输出**：请求发往 NousPortal 推理 API，返回流式响应；日志中的请求体会在打印前把 tools 数组与图片数据脱敏。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:80`

## 来源

- seed：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NousPortalProvider.kt`（32 行，已 100% 阅读）
- 父类实现：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt`（129 行，已 100% 阅读）
- 工厂分支：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`
- 默认配置：`app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt`
- 枚举定义：`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`
