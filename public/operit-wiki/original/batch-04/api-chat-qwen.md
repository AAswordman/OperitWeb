---
title: 通义千问供应商
module: app
sources: 4
date: 2026-10-01
---

# 通义千问供应商

## 概述

- 本页覆盖 `QwenAIProvider`（125 行）：阿里巴巴通义千问（Qwen）模型的专用供应商实现。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:14`
- 一句话：它是 OpenAI 兼容协议的子类实现，复用父类九成逻辑，只在三个地方动了手脚——音频载荷的 data URI 改写（仅阿里云）、`enable_thinking` 推理参数注入、请求体日志脱敏。
- 「供应商」（Provider）指把某家模型厂商的 HTTP API 适配成 Operit 内部统一聊天接口的类；「推理配置」指控制模型是否输出思考过程的参数。

## AI 速览

- **核心符号**：`QwenAIProvider`（通义千问供应商）、`createRequestBody`（请求体重写）、`buildInputAudioPayload`（音频载荷改写）、`applyQwenReasoningSettings`（推理配置注入）、`ThinkingConfigurationApplier`（通用思考配置应用器）、`ApiProviderType.ALIYUN`（阿里云类型标识）。
- **主入口**：`AIServiceFactory` 按 `ApiProviderType.ALIYUN`（及 `SILICONFLOW`）分支构造 `QwenAIProvider`；运行时主入口是重写的 `createRequestBody`。
- **数据流向一句话**：工厂按供应商类型装配 QwenAIProvider → `createRequestBody` 先拿父类生成的标准 OpenAI JSON，再注入 Qwen 推理参数并记脱敏日志 → 父类 `sendMessage` 负责发送与流式接收。

## 核心机制

### 类型标识与装配

- `qwenProviderType` 构造参数默认 `ApiProviderType.ALIYUN`，并原样转发给父类的 providerType 参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:23`
- AIServiceFactory 遇到 `ApiProviderType.ALIYUN` 就构造 `QwenAIProvider`（代码注释：“阿里云（通义千问）使用QwenProvider”）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:493`
- `ApiProviderType.SILICONFLOW` 分支同样构造 `QwenAIProvider`，此时 `qwenProviderType` 为 SILICONFLOW，阿里云专属的音频改写不会触发。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:595`

### 音频载荷改写（仅阿里云）

- 重写 `buildInputAudioPayload`：先调 `super.buildInputAudioPayload(link)` 拿默认载荷。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:46`
- 只有 `qwenProviderType == ApiProviderType.ALIYUN` 时，才把 `data` 字段改写成 `data:{mimeType};base64,{base64Data}` 的 data URI 形式——这是阿里云 Qwen 音频接口要求的格式。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:48`
- 父类默认实现写的是 `data` = 原始 base64、`format` = 按 mime 推导的音频格式。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:799`

### 请求体组装与日志

- 重写 `createRequestBody`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:57`
- 先调 `super.createRequestBodyInternal(...)` 生成标准 OpenAI 格式请求体的 JSON 字符串。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:67`
- 再调 `applyQwenReasoningSettings` 把 Qwen 的 `enableThinking` 推理设置打到请求 JSON 上。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:70`
- 写最终请求体日志前，`tools` 数组被替换成 `[N tools omitted for brevity]`，避免日志过长。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:79`
- 先经 `sanitizeImageDataForLogging` 脱敏图片数据，再用 `logLargeString` 以标签 `QwenAIProvider` 输出 4 空格缩进的 JSON。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:81`
- 最后用 `createJsonRequestBody(jsonObject.toString())` 构造 `RequestBody` 返回。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:89`

### 推理配置注入

- `applyQwenReasoningSettings` 是私有方法，委托给 `ThinkingConfigurationApplier.apply`，传入的 `providerTypeId` 取自 `qwenProviderType.name`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:93`
- 同时传入 `modelName`、构造时保存的 `configuredApiEndpoint`、`thinkingConfigurations`、`enableThinking` 与 `thinkingOptionId`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:100`
- `configuredApiEndpoint` 在构造时用 `private val configuredApiEndpoint = apiEndpoint` 保存，供推理配置按端点选映射。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:45`

### 消息发送

- `sendMessage` 被重写，但只是把 13 个参数原样透传给 `super.sendMessage`——续写逻辑与流式参数处理全在父类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:123`

## 关键符号

| 符号 | 含义 |
| --- | --- |
| `QwenAIProvider` | 通义千问专用供应商，`OpenAIProvider` 子类 |
| `qwenProviderType` | 供应商类型标识，默认 `ApiProviderType.ALIYUN`；决定音频改写与推理映射走哪套 |
| `configuredApiEndpoint` | 构造时保存的 API 端点，供推理配置映射使用 |
| `applyQwenReasoningSettings` | 私有方法：把思考配置经 `ThinkingConfigurationApplier` 打到请求 JSON |
| `ThinkingConfigurationApplier` | 通用思考配置应用器，按供应商类型+模型名+端点解析映射 |

## 调用链

1. **装配**：`AIServiceFactory` 按 `ApiProviderType.ALIYUN`（或 `SILICONFLOW`）分支构造 `QwenAIProvider`，`qwenProviderType` 透传。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:493`
2. **组请求**：先调父类 `createRequestBodyInternal` 生成标准 OpenAI 格式 JSON，再经 `applyQwenReasoningSettings` 注入 Qwen 推理配置；`tools` 字段在日志中省略，图片数据脱敏后记日志。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:67`
3. **发送**：`sendMessage` 直接透传给父类实现，由父类负责 HTTP 发送、续写与流式接收。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt:123`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/QwenAIProvider.kt`（125 行，100% 已读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`（装配分支）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt`（父类默认行为）
- `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`（`ApiProviderType` 枚举）
