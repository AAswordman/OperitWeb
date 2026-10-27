---
title: NVIDIA AI 供应商
module: app
sources: 5
date: 2026-10-01
---

# NVIDIA AI 供应商

## 概述

- 本页覆盖 `NvidiaAIProvider`（81 行）：NVIDIA API Catalog / NIM 的专用供应商实现。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:15`
- 一句话：它是 OpenAI 兼容协议的子类，全部特殊逻辑只有一处——按模型名和端点查表，把该模型官方公布的推理控制参数（如 GPT-OSS 的 `reasoning_effort`）打到请求体上。
- 「NIM」是 NVIDIA Inference Microservices 的缩写，即英伟达的模型推理服务；「请求映射器」指把通用请求转换成某模型专属控制参数的那段代码。

## AI 速览

- **核心符号**：`NvidiaAIProvider`（NVIDIA 供应商）、`createRequestBody`（唯一重写的方法）、`ThinkingConfigurationApplier`（思考配置应用器）、`ApiProviderType.NVIDIA`（类型标识）。
- **主入口**：`AIServiceFactory` 按 `ApiProviderType.NVIDIA` 分支构造 `NvidiaAIProvider`；运行时主入口是重写的 `createRequestBody`。
- **数据流向一句话**：工厂按 NVIDIA 类型装配 → `createRequestBody` 先拿父类生成的标准 OpenAI JSON，再按模型+端点查表注入官方公布的推理控制参数 → 父类负责发送。

## 核心机制

### 类型标识与装配

- 构造函数 `providerType` 参数默认 `ApiProviderType.NVIDIA`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:26`
- `ApiProviderType.NVIDIA` 的枚举注释为“NVIDIA API Catalog / NIM”。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:36`
- AIServiceFactory 遇到 `ApiProviderType.NVIDIA` 就构造 `NvidiaAIProvider`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:680`

### 模型专属推理控制

- 类注释说明：官方文档为 GPT-OSS 暴露了 model-specific 的 `reasoning_effort` 取值，为 Nemotron 3 Super/Ultra 端点暴露了当前取值。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:14`
- 设计原则写在注释里：请求映射器只写所选模型已发布的控制参数，不臆测未公布的参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:17`

### 请求体组装

- 类中重写了 `createRequestBody`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:49`
- 先调 `super.createRequestBodyInternal(...)` 生成标准 OpenAI 格式请求体的 JSON 字符串。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:58`
- 再调 `ThinkingConfigurationApplier.apply` 的 `context` 重载，把推理配置应用到请求 JSON。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:68`
- 存在带 `context` 参数的重载。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:266`
- 该重载内部直接委托给无 context 的另一个 `apply` 重载，行为完全一致。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt:280`
- 传入的 `providerTypeId` 硬编码为 `ApiProviderType.NVIDIA.name`，而不是构造参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:71`
- 同时传入 `modelName`、构造时保存的 `configuredApiEndpoint`、`thinkingConfigurations`、`enableThinking` 与 `thinkingOptionId`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:73`
- `configuredApiEndpoint` 在构造时用 `private val configuredApiEndpoint = apiEndpoint` 保存。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:47`
- 最终用 `createJsonRequestBody(jsonObject.toString())` 返回；与 Qwen 实现不同，这里不记请求体日志。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:79`

## 关键符号

| 符号 | 含义 |
| --- | --- |
| `NvidiaAIProvider` | NVIDIA 专用供应商，`OpenAIProvider` 子类，全文件只重写 `createRequestBody` |
| `ThinkingConfigurationApplier` | 通用思考配置应用器：按供应商类型+模型名+端点解析映射，只应用已发布的控制参数 |
| `configuredApiEndpoint` | 构造时保存的 API 端点，供推理配置按端点选映射 |
| `ApiProviderType.NVIDIA` | 类型标识，注释为 NVIDIA API Catalog / NIM |

## 调用链

1. **装配**：`AIServiceFactory` 按 `ApiProviderType.NVIDIA` 分支构造 `NvidiaAIProvider`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:680`
2. **组请求**：先调父类 `createRequestBodyInternal` 生成标准 OpenAI 格式 JSON，再经 `ThinkingConfigurationApplier.apply`（`context` 重载）按 NVIDIA 类型+模型名+端点注入该模型已发布的推理控制参数。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt:63`
3. **发送**：未重写 `sendMessage`，走父类标准发送与流式接收流程。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:3207`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/NvidiaAIProvider.kt`（81 行，100% 已读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`（装配分支）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ThinkingQualityMapping.kt`（`ThinkingConfigurationApplier`）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt`（父类发送流程）
- `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`（`ApiProviderType` 枚举）
