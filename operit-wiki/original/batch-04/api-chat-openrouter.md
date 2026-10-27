---
title: OpenRouter 供应商
module: api
sources: 1
date: 2026-10-01
---

# OpenRouter 供应商

## 概述

- 本页覆盖 `api/chat/llmprovider/OpenRouterProvider.kt`（129 行）：OpenRouter 聚合网关的供应商实现。OpenRouter 的 chat completions 接口与 OpenAI 基本兼容，所以它直接继承 `OpenAIProvider`，只改两件事：请求头默认值和 reasoning（推理）参数的下发方式。
- 一句话：请求体先按 OpenAI 规范拼好，再把"是否思考"翻译成 OpenRouter 特有的 `reasoning` 对象塞进去；请求头默认带 `HTTP-Referer` 与 `X-Title`（OpenRouter 的应用标识要求）。

## AI 速览

- **核心符号**：`OpenRouterProvider`（供应商，open 类可被继承）、`applyOpenRouterReasoning()`（reasoning 叠加）、`mergeOpenRouterHeaders()`（请求头合并）、`ThinkingConfigurationApplier`（thinking 规则应用器）、`sanitizeImageDataForLogging()`（日志脱敏）。
- **主入口**：`createRequestBody()`（请求体组装，override）。
- **数据流向一句话**：父类 `createRequestBodyInternal` 拼出 OpenAI 风格请求体 → `ThinkingConfigurationApplier` 按模型配置的 thinking 规则叠加 `reasoning` → 脱敏后打日志 → `createJsonRequestBody` 返回。

## 核心机制

- **继承复用**：`OpenRouterProvider` 继承 `OpenAIProvider`，构造时把 `customHeaders` 先过 `mergeOpenRouterHeaders()` 再传给父类；`providerType` 默认 `ApiProviderType.OPENROUTER`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:23`
- **reasoning 独立通道**：OpenRouter 不用 App 通用的 `enableThinking` 开关直写请求体。`createRequestBody()` 先调父类 `createRequestBodyInternal` 生成基础 JSON（注意：这一步不传 `enableThinking`），再由 `applyOpenRouterReasoning()` 调 `ThinkingConfigurationApplier.apply`，按模型配置里的可编辑 thinking 规则、`thinkingOptionId` 和 `enableThinking` 生成统一 `reasoning` 对象。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:61`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:94`
- **默认请求头**：`HTTP-Referer` 默认 `ai.assistance.operit`、`X-Title` 默认 `Assistance App`；只有自定义头里没有（不区分大小写）才补，自定义值优先。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:115`
- **日志脱敏**：打日志前把 `tools` 数组替换成 `[N tools omitted for brevity]`，再过 `sanitizeImageDataForLogging` 清掉图片数据，最后 `logLargeString` 输出完整 JSON。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:80`

## 关键符号

| 符号 | 说明 |
|---|---|
| `OpenRouterProvider` | OpenRouter 供应商，open 类 |
| `createRequestBody()` | 请求体组装入口（override） |
| `applyOpenRouterReasoning()` | 叠加 `reasoning` 对象的私有方法 |
| `ThinkingConfigurationApplier` | 按模型 thinking 规则生成 reasoning 参数 |
| `mergeOpenRouterHeaders()` | 默认请求头合并（自定义优先） |
| `sanitizeImageDataForLogging()` | 日志前清理图片数据 |

## 调用链

1. **输入**：`createRequestBody(context, chatHistory, modelParameters, enableThinking, stream, availableTools, preserveThinkInHistory)` 被调用。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:54`
2. **处理**：父类 `createRequestBodyInternal` 生成 OpenAI 风格基础请求体 → `applyOpenRouterReasoning` 按 thinking 规则叠加 `reasoning` → 拷贝一份做日志脱敏（tools 省略、图片清理）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:73`
3. **输出**：`createJsonRequestBody(jsonObject.toString())` 返回最终请求体，发往 OpenRouter 端点。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenRouterProvider.kt:91`

## 来源

- `OpenRouterProvider.kt` 全文件 129 行，关键行见上文引用。
- 父类 `OpenAIProvider`（`createRequestBodyInternal` / `createJsonRequestBody`）与 `ThinkingConfigurationApplier` 在同目录下，本页不展开。
