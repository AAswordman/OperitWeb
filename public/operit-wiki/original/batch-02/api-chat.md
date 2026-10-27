---
title: 云端 Chat API 接入（总览）
module: app
sources: 4
date: 2026-09-30
---

# 云端 Chat API 接入（总览）

> v3 回炉重造版。本页是云端接入章的总览：只讲"配置长什么样、有哪些供应商、请求发往云端时配置如何被使用"。各供应商的协议细节、thinking 映射、限流重试等分别见本章细页。

## 概述

- 配置中枢是 `ModelConfigData`：`@Serializable` 的完整模型配置数据类，包含 API 设置和模型参数。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:95`
- 一条配置的身份部分：`apiKey`、`apiEndpoint`、`modelName` 默认都是空字符串。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:100`
- `apiProviderType` 声明这条配置走哪个供应商，默认 `DEEPSEEK`；`apiProviderTypeId` 默认取 `apiProviderType.name`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:103`
- 人话：可以把一条 `ModelConfigData` 理解成"一个大模型账号的完整档案"——连哪家云（`apiProviderType`）、用什么 key（`apiKey`）、走哪个地址（`apiEndpoint`）、调什么模型（`modelName`），以及采样参数、上下文策略、供应商特有开关，全记在这一条配置里。App 内可以存多条配置，对应多个供应商账号。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:100`
- `FunctionType` 枚举表示不同功能类型，用于指定不同功能使用的 AI 配置。`app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:4`
- 人话：`FunctionType` 回答"这个 AI 能力用哪套配置"——常规对话、对话总结、记忆库处理、翻译等功能可以各自绑定不同的模型配置，而不是全 App 共用一个。`app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:4`

## AI 速览

- `ModelConfigData` — 一条模型配置的完整档案（供应商身份 + 采样参数 + 上下文/总结 + 供应商特有开关）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:95`
- `ApiProviderType` — 38 个值的供应商类型枚举（云端 / 聚合中转 / 本地端侧）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:6`
- `FunctionType` — 11 种功能类型，决定各功能用哪套 AI 配置。`app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:4`
- `ModelConfigSummary` — 列表展示用的简化版配置。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:206`
- `AIService` — 统一的供应商接入抽象接口。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:12`
- `createService` — 装配总入口：读 `ModelConfigData`（`config`）→ 选 Provider → 返回统一的 `AIService`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:269`
- 数据流向一句话：用户保存一条 `ModelConfigData` → `createService`（`config`）装配 → 返回统一的 `AIService` 发起调用。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:269`

## 核心机制

### 供应商类型（ApiProviderType）

- `ApiProviderType` 是 `@Serializable` 枚举，共 38 个值。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:6`
- OpenAI 系：`OPENAI`、`OPENAI_RESPONSES`、`OPENAI_CODEX`，另有 `OPENAI_RESPONSES_GENERIC` / `OPENAI_GENERIC` 两个自定义端点变体。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:10`
- Anthropic / Google：`ANTHROPIC`、`ANTHROPIC_GENERIC`、`GOOGLE`、`GEMINI_GENERIC`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:15`
- 国产模型：`BAIDU`、`ALIYUN`、`XUNFEI`、`ZHIPU`、`BAICHUAN`、`MOONSHOT`、`MIMO`、`DEEPSEEK`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:21`
- `DOUBAO`（豆包）、`NVIDIA`（API Catalog / NIM）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:35`
- 聚合与中转：`SILICONFLOW`、`IFLOW`、`OPENROUTER`、`OPENCODE`、`FOUR_ROUTER`、`NOUS_PORTAL`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:29`
- 更多聚合：`INFINIAI`（无问芯穹）、`ALIPAY_BAILING`（支付宝百灵大模型）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:33`
- 云厂商与兜底：`PPINFRA`（派欧云）、`NOVITA`、`MINIMAX`，以及 `OTHER`（其他提供商，自定义端点）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:43`
- 本地与端侧：`LMSTUDIO`、`OLLAMA`（OpenAI 兼容）、`OPENAI_LOCAL`、`MNN`、`LLAMA_CPP`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:39`
- `fromProviderTypeId` 先对输入 trim，空串返回 null，否则按名称忽略大小写匹配枚举值。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:48`

### 功能类型（FunctionType）

- `CHAT` 常规对话、`SUMMARY` 对话总结、`TITLE_GENERATION` AI 总结标题、`MEMORY` 记忆库处理、`UI_CONTROLLER` UI 自动化控制。`app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:6`
- `TRANSLATION` 翻译功能、`GREP` 上下文检索/代码搜索规划、`ROLE_RESPONSE_PLANNER` 角色回答顺序规划、`IMAGE_RECOGNITION` 图像识别、`AUDIO_RECOGNITION` 音频识别、`VIDEO_RECOGNITION` 视频识别。`app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:12`

### 配置维度：连接与 Key

- 多 Key 模式：`useMultipleApiKeys` 默认 false；`apiKeyPool` 是 `List<ApiKeyInfo>` 类型的 Key 池；`currentKeyIndex` 默认 0；`keyRotationMode` 默认 `"ROUND_ROBIN"`，取值为 `ROUND_ROBIN` / `RANDOM`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:108`
- 人话：一个配置可以带一池子 key（`apiKeyPool`），轮换策略由 `keyRotationMode` 这个字符串字段决定：轮询（`ROUND_ROBIN`）或随机（`RANDOM`）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:108`
- `hasCustomParameters` 默认 false，标记是否包含自定义参数。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:113`

### 配置维度：采样参数

- 7 个采样参数各配一个 enabled 开关：`maxTokensEnabled`、`temperatureEnabled`、`topPEnabled`、`topKEnabled`、`presencePenaltyEnabled`、`frequencyPenaltyEnabled`、`repetitionPenaltyEnabled`，默认值全部为 false。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:119`
- 参数值默认值：`maxTokens` 4096、`temperature` 1.0f、`topP` 1.0f、`topK` 0、`presencePenalty` 0.0f、`frequencyPenalty` 0.0f、`repetitionPenalty` 1.0f。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:128`
- 人话：开关与值分开存——界面上用户逐个打开高级参数才生效，值本身另存默认值。"没动过"和"显式设为默认值"能区分开。
- `customParameters` 是自定义参数 JSON 字符串，默认 `"[]"`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:134`
- `customHeaders` 是自定义请求头 JSON 字符串，默认 `"{}"`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:143`

### 配置维度：thinking

- `thinkingConfigurations` 是当前模型配置的思考规则，默认 `"[]"`；内置适配规则由 `data.collects` 集中维护，在配置创建或供应商切换时写入。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:137`
- `thinkingOptionId` 是当前选中的思考档位，默认空字符串。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:140`
- 人话：各家模型的"思考/推理"参数叫法不同，App 用一套 `thinkingConfigurations` JSON 存适配规则（哪家供应商把思考强度写进哪个请求字段），`thinkingOptionId` 记住用户选了哪档。跨供应商映射细节见细页。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:137`

### 配置维度：上下文与总结

- `contextLength` 默认 64.0f（`DEFAULT_CONTEXT_LENGTH`），`maxContextLength` 默认 200.0f，`enableMaxContextMode` 默认 false，`summaryTokenThreshold` 默认 0.70f。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:147`
- `enableSummary` 与 `enableSummaryByMessageCount` 默认 true，`summaryMessageCountThreshold` 默认 16 条消息。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:151`
- 人话：上下文用完了怎么办，由这组字段决定——上下文长度默认 64，token 占比到 0.70 或攒够 16 条消息就触发自动总结，把旧对话压缩后继续聊。
- `summaryCustomRules` 默认空字符串，`summarySectionOverrides` 默认空列表，`enableSummaryDialogueReview` 默认 true。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:157`
- 总结分段结构：`SummarySectionConfig` 含 `id`、`enabled`（默认 true）、`title`、`instruction`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:73`
- `SummarySectionOverride` 是可序列化的覆盖配置，`enabled`、`title`、`instruction` 均为可空。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:81`
- `ConversationSummaryConfig` 含 `globalRules`、`sectionOverrides`、`dialogueReviewEnabled`（默认 true）、`dialogueReviewTitle`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:88`

### 配置维度：端侧引擎参数

- MNN：`mnnForwardType` 默认 0（前向计算类型，CPU/GPU 等），`mnnThreadCount` 默认 4；MNN 模型路径根据 `modelName` 自动构建，不单独存储。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:163`
- llama.cpp：`llamaThreadCount` 4、`llamaContextSize` 2048（n_ctx）、`llamaBatchSize` 与 `llamaUBatchSize` 512、`llamaGpuLayers` 0。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:169`
- `llamaUseMmap` 默认 false（Android 上默认关闭，减少 mmap 兼容性问题），`llamaFlashAttention` 默认 false（Android 上默认关闭，更接近 PocketPal 安全值）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:172`
- `llamaKvUnified` 默认 true（单并发聊天默认开启统一 KV 缓存），`llamaOffloadKqv` 默认 false（仅在启用 GPU 层时有意义）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:174`

### 配置维度：多模态与供应商特有开关

- 多模态：`enableDirectImageProcessing`、`enableDirectAudioProcessing`、`enableDirectVideoProcessing` 默认全 false。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:180`
- `enableGoogleSearch`（Google Search Grounding，仅 Gemini）、`enableDeepSeekWebSearch`（DeepSeek Responses 服务端搜索）、`enableCodexWebSearch`（Codex 认证登录下的服务端网络搜索），默认全 false。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:188`
- `enableClaude1hPromptCache` 默认 false：是否启用 1 小时提示缓存 TTL，仅 Claude 支持。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:194`
- `enableToolCall` 默认 true：启用 Tool Call 接口调用工具（使用模型原生工具调用而非 XML 格式）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:197`
- 人话：同一份配置要服务 38 种供应商，各家独有的能力只能做成按供应商生效的独立开关——Gemini 的搜索打底、Claude 的 1 小时缓存、DeepSeek/Codex 的服务端搜索互不干扰。

### 配置维度：限流

- `requestLimitPerMinute` 默认 0，表示每分钟最大请求次数不限流；`maxConcurrentRequests` 默认 0，表示最大并发请求数不限制。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:200`

### 列表展示与多模型

- `ModelConfigSummary` 是简化版模型配置数据类，用于列表显示，含 `id`、`name`、`modelName`、`apiEndpoint`、`apiProviderType`。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:210`
- `modelIndex` 默认 0：当 `modelName` 含多个模型（逗号分隔）时选择第几个模型（从 0 开始）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:215`
- `getModelByIndex`：`modelName` 为空返回空字符串；逗号分隔 trim 后按索引取，越界时回落到第一个模型。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:219`
- `getModelList`：把逗号分隔的模型名称字符串拆成列表，trim 并过滤空项；空串返回空列表。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:226`
- `getValidModelIndex`：索引合法则原样返回，越界时返回 0（第一个模型）。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:238`
- 人话：一条配置的 `modelName` 可以写多个模型（逗号分隔），`modelIndex` 决定用第几个，切换模型不用建新配置。`app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:215`

## 关键符号

| 符号 | 一句话职责 | 引用 |
|---|---|---|
| `ModelConfigData` | 一条模型配置的完整档案 | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:95` |
| `ApiProviderType` | 38 个值的供应商类型枚举 | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:6` |
| `ModelConfigDefaults` | 上下文/总结/工具调用的默认值常量 | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:60` |
| `FunctionType` | 11 种功能类型，指定各功能用的 AI 配置 | `app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt:4` |
| `ModelConfigSummary` | 列表展示用的简化版配置 | `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt:206` |
| `AIService` | 统一的供应商接入抽象接口 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:12` |
| `createService` | 供应商装配总入口 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:269` |

## 调用链：配置如何变成发往云端的请求

输入 → 处理 → 输出三段：

**输入**：用户在设置里保存一条模型配置（供应商身份 + key + 采样参数 + 上下文/总结策略）。

**处理**（装配）：

1. 装配入口是 `createService`，接收 `ModelConfigData`（`config`）并返回 `AIService`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:269`
2. 装配入口把构建出的服务包进 `TokenTrackingAIService`（`delegate` 为原始服务，`configId` 取 `config.id`）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:275`
3. 按注释：正式 `sendMessage` 调用完成且提供真实 usage 时才写入统计账本，测试和探测调用显式跳过记录。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:261`
4. `buildService` 先查 `ToolPkgAiProviderRegistry`，命中直接返回 `ToolPkgJsAiProviderService`；否则读 `config.apiProviderTypeId` 做 trim 转换。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:286`
5. 转换走 `ApiProviderType.fromProviderTypeId`（trim + 忽略大小写匹配），找不到就抛 `IllegalArgumentException`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:297`
6. 多 Key 选择：`config.useMultipleApiKeys` 为 true 用 `MultiApiKeyProvider`（Key 池轮询），否则用 `SingleApiKeyProvider`（单个 Key）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:303`
7. 从配置读取 `enableDirectImageProcessing`、`enableDirectAudioProcessing`、`enableDirectVideoProcessing`、`enableToolCall` 作为各 Provider 的能力开关传入。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:312`
8. `when`（`providerType`）把类型映射到具体 Provider 实现，`ApiProviderType.XAI` 走 OpenAI 兼容 Chat Completions 协议。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:320`
9. 部分供应商收敛到同一分支：`BAIDU`、`XUNFEI`、`ZHIPU`、`BAICHUAN`、`IFLOW`、`INFINIAI`、`ALIPAY_BAILING`、`PPINFRA`、`NOVITA` 共用一个 when 分支。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:513`

**输出**：调用方拿到统一的服务接口，调 `sendMessage`（`chatHistory` 必须已包含本次最新输入，另有 `modelParameters`、`enableThinking` 等参数）发往云端；各 Provider 内部把配置翻译成自家协议。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:62`

- 该接口还暴露 `inputTokenCount`、`cachedInputTokenCount`、`outputTokenCount` 三个 token 计数和 `providerModel` 供应商标识。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:18`
- `getModelsList` 用于拉取供应商的模型列表。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:37`

## 本章地图（细页索引）

跨供应商机制页：

- [供应商接入基础设施](entry.html?id=batch-04/api-chat-providers-base)：AIService 接口契约、工厂装配、端点补全、模型列表拉取
- [thinking 配置机制](entry.html?id=batch-04/api-chat-thinking)：思考档位规则匹配与跨供应商请求体写入
- [统一参数模型与自定义参数](entry.html?id=batch-04/api-chat-params)：配置就绪检查与连接测试
- [错误/限流/重试](entry.html?id=batch-04/api-chat-errors)：状态码封装、滑动窗口限流、重试与并发控制
- [工具调用与流式协议](entry.html?id=batch-04/api-chat-tools-stream)：结构化工具调用桥接、SSE/分块流式处理
- [Token 统计与 usage 上报](entry.html?id=batch-04/api-chat-tokens)：用量提取与统计账本
- [多模态媒体链接与能力探测](entry.html?id=batch-04/api-chat-media)：媒体链接构造解析、供应商多模态能力探测
- [Key 池轮询（ApiKeyProvider）](entry.html?id=batch-04/api-chat-keypool)：多 Key 池数据结构、轮询策略、可用性探测

供应商页（主流）：

- [OpenAI 供应商](entry.html?id=batch-04/api-chat-openai)、[OpenAI Responses 供应商](entry.html?id=batch-04/api-chat-openai-responses)、[Codex 供应商](entry.html?id=batch-04/api-chat-codex)
- [Gemini 供应商](entry.html?id=batch-04/api-chat-gemini)、[Claude 供应商](entry.html?id=batch-04/api-chat-claude)、[DeepSeek 供应商](entry.html?id=batch-04/api-chat-deepseek)
- [xAI 供应商](entry.html?id=batch-04/api-chat-xai)、[Mistral 供应商](entry.html?id=batch-04/api-chat-mistral)、[NVIDIA AI 供应商](entry.html?id=batch-04/api-chat-nvidia)

供应商页（国产）：

- [Kimi 供应商](entry.html?id=batch-04/api-chat-kimi)、[通义千问供应商](entry.html?id=batch-04/api-chat-qwen)、[豆包供应商](entry.html?id=batch-04/api-chat-doubao)、[小米 Mimo 供应商](entry.html?id=batch-04/api-chat-mimo)

供应商页（聚合/中转与本地）：

- [OpenRouter 供应商](entry.html?id=batch-04/api-chat-openrouter)、[FourRouter 供应商](entry.html?id=batch-04/api-chat-fourrouter)、[NousPortal 供应商](entry.html?id=batch-04/api-chat-nousportal)、[OpenCode 供应商](entry.html?id=batch-04/api-chat-opencode)
- [Ollama 供应商](entry.html?id=batch-04/api-chat-ollama)、[MNN 端侧供应商（已停止维护）](entry.html?id=batch-04/api-chat-mnn)、[Llama 端侧供应商（已停止维护）](entry.html?id=batch-04/api-chat-llama)

对话编排与记忆：

- [对话编排运行时](entry.html?id=batch-04/api-chat-runtime)、[对话增强管线](entry.html?id=batch-04/api-chat-enhance)、[会话记忆与上下文总结](entry.html?id=batch-04/api-chat-memory)

## 关联条目

- [供应商接入基础设施](entry.html?id=batch-04/api-chat-providers-base)：本页"调用链"中装配逻辑的细粒度展开。
- [thinking 配置机制](entry.html?id=batch-04/api-chat-thinking)：thinkingConfigurations / thinkingOptionId 如何写入各供应商请求体。
- [Key 池轮询（ApiKeyProvider）](entry.html?id=batch-04/api-chat-keypool)：useMultipleApiKeys / apiKeyPool / keyRotationMode 的运行时实现。
- [错误/限流/重试](entry.html?id=batch-04/api-chat-errors)：requestLimitPerMinute / maxConcurrentRequests 的运行时实现。
- [工具注册与执行框架](entry.html?id=batch-02/core-tools-registry)：enableToolCall 打开后，模型原生工具调用的执行侧。

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/model/ModelConfigData.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/FunctionType.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt`（仅读结构：统一抽象接口，未登记为种子）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`（仅读结构：装配逻辑，未登记为种子）
