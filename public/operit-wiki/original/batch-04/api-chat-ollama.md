---
title: Ollama 供应商
module: app
sources: OllamaProvider.kt, AIServiceFactory.kt, ApiProviderConfigCollect.kt, ModelConfigData.kt, OpenAIProvider.kt
date: 2026-10-01
---

# Ollama 供应商

## 概述

Ollama 供应商负责把 Operit 的聊天请求发给 Ollama 服务。Ollama 是跑在本地或私有服务器上的大模型运行时，对外暴露 OpenAI 兼容的 HTTP 接口。Operit 没有为它另写一套协议：`OllamaProvider` 直接继承 `OpenAIProvider`，聊天、流式、工具调用、token 计数全部复用父类实现。

对用户来说，选 Ollama 意味着三件事：模型跑在自己机器上（默认连 `http://localhost:11434`），不用填 API Key，聊天内容不出内网。代价是模型名要自己填——必须是你本地已经用 `ollama pull` 拉取好的模型。

## AI 速览

**核心符号清单**

- `OllamaProvider` — Ollama 供应商类，`OpenAIProvider` 的空壳子类，无新增逻辑。
- `OpenAIProvider` — 父类：OpenAI 兼容协议的完整实现（请求组装、流式解析、工具调用、token 计数）。
- `ApiProviderType.OLLAMA` — 供应商枚举值，工厂分支的路由键。
- `AIServiceFactory` — 按 `ApiProviderType` 实例化各供应商的工厂。
- `providerModel` — 继承属性，返回 `OLLAMA:<模型名>` 格式的供应商标识。

**主入口**：`AIServiceFactory` 的 `ApiProviderType.OLLAMA` 分支。

**数据流向一句话**：用户选 Ollama 模型 → 工厂按枚举值构造 `OllamaProvider` → 父类 `OpenAIProvider` 把聊天记录组装成 OpenAI 格式 JSON 发往 Ollama 的 `/v1/chat/completions` → 流式回吐文本。

## 核心机制

- 薄子类设计：12 个构造参数逐一透传给父类，类体无新增成员，Ollama 与 OpenAI 的差异只在配置不在代码。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt:23`
- 类注释点名设计意图：使用 Ollama 暴露的 OpenAI 兼容接口（例如 `/v1/chat/completions`）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt:8`
- `providerType` 构造参数默认值为 `ApiProviderType.OLLAMA`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt:16`
- 前 6 个构造参数是连接三件套加类型：`apiEndpoint`、`apiKeyProvider`、`modelName`、`client`、`customHeaders`（默认空 Map）、`providerType`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt:13`
- 后 6 个是能力开关：`supportsVision`、`supportsAudio`、`supportsVideo`、`enableToolCall`、`thinkingConfigurations`、`thinkingOptionId`，默认值全部为 false 或空字符串。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt:19`
- 工厂在 `ApiProviderType.OLLAMA` 分支构造本类，注释写明“Ollama使用OpenAI兼容格式”。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:450`
- 默认配置：模型名留空（用户自填），endpoint 为 `http://localhost:11434/v1/chat/completions`，`requiresApiKey` 为 false。`app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:238`
- 枚举注释把 OLLAMA 定义为“ Ollama 本地/私有部署服务（OpenAI兼容）”。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:38`

## 关键符号

- `OllamaProvider` — 供应商类本体，空壳子类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt:10`
- `OpenAIProvider` — 父类，承载全部协议逻辑。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:88`
- `providerModel` — 继承属性，返回“供应商名:模型名”格式标识。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:141`
- `ApiProviderType.OLLAMA` — 路由枚举值。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:38`

## 调用链

1. **输入**：用户新增模型时选 Ollama 类型，endpoint 自动填 `http://localhost:11434/v1/chat/completions`，模型名填本地已拉取的模型 → 配置进入工厂。
   `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:238`
2. **处理**：工厂命中 `ApiProviderType.OLLAMA` 分支，构造 `OllamaProvider`（参数透传）；父类按 OpenAI 格式组装请求体，endpoint 自动补全（缺路径补 `/v1/chat/completions`，末尾 `#` 可禁用）后发出。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:450`
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:22`
3. **输出**：Ollama 返回 SSE 流式响应，父类逐块解析回吐文本或工具调用；日志与统计中的供应商标识记为 `OLLAMA:<模型名>`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:141`

## 来源

- seed：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OllamaProvider.kt`（36 行，已 100% 阅读）
- 工厂分支：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`
- 默认配置：`app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt`
- 枚举定义：`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`
- 父类实现：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt`
