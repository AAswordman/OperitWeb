---
title: 供应商接入基础设施
module: 云端 Chat API
sources: AIService.kt, AIServiceFactory.kt, EndpointCompleter.kt, ModelListFetcher.kt, LocalGenerationEnd.kt, UnsafeModelSsl.kt
date: 2026-10-01
---

# 供应商接入基础设施

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 怎么把“几十家 AI 供应商”统一接到一套代码上。

不管背后是 OpenAI、Claude、Gemini，还是国产的 DeepSeek、通义千问、豆包，或者本地跑的 MNN、llama.cpp，上层业务只认一个接口 `AIService`。真正的差异（鉴权方式、URL 规则、返回格式）被收敛到三个地方：

1. **工厂** `AIServiceFactory`：根据配置里的供应商类型，new 出对应的 Provider 实现。
2. **端点补全** `EndpointCompleter`：用户只填了 `https://api.xxx.com` 也能自动拼出完整聊天地址。
3. **模型列表拉取** `ModelListFetcher`：从各家拉取可用模型，顺手把本地模型目录也扫了。

另外还有两个小构件：`LocalGenerationEnd` 给本地推理（Llama/MNN）定了一个“取消→失败→成功”的结束顺序契约；`UnsafeModelSsl` 则是一个**高危**的全局 TLS 关闭开关——所有模型请求的 HTTPS 证书校验和主机名校验都被它关掉了。

## AI 速览

- 核心符号：`AIService`（统一接口）、`AIServiceFactory`（工厂）、`SharedHttpClient`（共享 HTTP 客户端）、`EndpointCompleter`（端点补全）、`ModelListFetcher`（模型列表）、`LocalGenerationEnd`（本地生成结束契约）、`UnsafeModelSsl`（TLS 关闭开关）
- 主入口：`AIServiceFactory.createService(config, modelConfigManager, context)` → 返回被 `TokenTrackingAIService` 包裹的 `AIService`
- 数据流向一句话：配置（含供应商类型、Key、端点）→ 工厂按 `ApiProviderType` 分发 new 出 Provider → Provider 经 `SharedHttpClient` 发 HTTPS 请求 → `sendMessage` 返回 `Stream<String>`。

## 核心机制

### 1. 统一接口 AIService：上层只认这一张脸

`AIService` 是接口（interface），所有供应商实现都要实现它。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:10`

它管三件事：

- **token 计数**：`inputTokenCount` 只计新增部分，`cachedInputTokenCount` 计缓存命中部分，`outputTokenCount` 计输出。三者分开，账才算得清。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:15`
- **发消息**：`sendMessage` 的 `chatHistory` 必须已含本次最新输入；`stream` 为 true 是流式、false 是非流式，但返回值恒为 Stream<String>；`availableTools` 为 null 时用系统提示词里的工具描述（用于 Tool Call API）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:61`
- **用量上报双通道**：`onTokensUpdated` 是 UI 计数通道（可带估算值）；`onUsageReported` 是统计账本通道，只在拿到 provider 真实 usage 或本地实测计数时回调，估算值不上报，可被多次调用（attempt 从 1 开始递增）；`onUsageFinalized` 只在请求正常完成时回调最终成功的 attempt。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:72`

还有两个配套方法：`testConnection` 测连通性，`calculateInputTokens` 精确预估下次请求的输入 token。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:90`

`release()` 默认空实现——只有本地模型（MNN 那种）需要释放 native 内存。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:102`

### 2. 工厂 AIServiceFactory：按类型分发

`createService` 是统一入口。它先调 `buildService` 造出原始服务，再用 `TokenTrackingAIService` 包一层。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:272`

这层包裹是**统计记录边界**：只有正式 `sendMessage` 完成且提供了真实 usage，才写入统计账本；测试和探测调用显式跳过，不污染账本。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:271`

`buildService` 的分发逻辑分三步：

1. 先查 `ToolPkgAiProviderRegistry`：工具包注册的 JS 供应商优先命中，直接返回 `ToolPkgJsAiProviderService`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:294`
2. 解析 `ApiProviderType`：`fromProviderTypeId` 找不到就抛 `IllegalArgumentException`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:304`
3. 选 Key 策略：`useMultipleApiKeys` 为 true 用 `MultiApiKeyProvider` 轮询，否则 `SingleApiKeyProvider`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:311`

自定义请求头 JSON 字符串由 `parseCustomHeaders` 解析为 Map；解析失败打日志并返回空 Map。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:230`

llama 会话配置由 `buildAndroidLlamaSessionConfig` 生成，线程数钳制在 1 与 CPU 核心数之间。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:244`

然后是一个大 `when` 分发，覆盖约 30 种供应商类型：

- `XAI` → `XaiProvider`（OpenAI 兼容的 Chat Completions 协议）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:331`
- `OPENAI` → `OpenAIProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:340`
- `OPENAI` 场景下 `includeUsageInStream=true`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:352`
- `OPENAI_GENERIC` 与 `OPENAI_LOCAL` 同样走 `OpenAIProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:360`
- `OPENAI_RESPONSES` 与 `OPENAI_RESPONSES_GENERIC` 走 `OpenAIResponsesProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:375`
- `OPENAI_CODEX` → `CodexProvider`，鉴权用 `CodexAuthManager`，音视频支持固定关闭。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:389`
- `ANTHROPIC` 与 `ANTHROPIC_GENERIC` → `ClaudeProvider`（带 `enableClaude1hPromptCache`）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:407`
- `GOOGLE` 与 `GEMINI_GENERIC` → `GeminiProvider`（带 `enableGoogleSearch`）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:422`
- `MNN` → `MNNProvider`（传 `mnnForwardType`/`mnnThreadCount`，本地推理）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:468`
- `LLAMA_CPP` → `LlamaProvider`（本地推理）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:478`
- `ALIYUN` → `QwenAIProvider`（通义千问）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:488`
- `BAIDU`/`XUNFEI`/`ZHIPU`/`BAICHUAN`/`IFLOW`/`INFINIAI`/`ALIPAY_BAILING`/`PPINFRA`/`NOVITA`/`MINIMAX`/`OTHER` 统一走 `OpenAIProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:503`
- `MOONSHOT` → `KimiProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:528`
- `MIMO` → `MimoProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:542`
- `DEEPSEEK` 经 `DeepseekProvider.create` 创建。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:556`
- `MISTRAL` → `MistralProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:570`
- `SILICONFLOW` 也走 `QwenAIProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:585`
- `OPENCODE` 经 `OpenCodeProvider.create` 创建。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:598`
- `OPENROUTER` → `OpenRouterProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:612`
- `FOUR_ROUTER` → `FourRouterProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:626`
- `NOUS_PORTAL` → `NousPortalProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:640`
- `DOUBAO` → `DoubaoAIProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:654`
- `NVIDIA` → `NvidiaAIProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:668`
- `LMSTUDIO` → `OpenAIProvider`（OpenAI 兼容格式）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:437`
- `OLLAMA` → `OllamaProvider`（OpenAI 兼容格式）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:454`

四个能力开关（`supportsVision`/`supportsAudio`/`supportsVideo`/`enableToolCall`）直接取自 ModelConfigData，透传给每个 Provider。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:319`

### 3. 共享 HTTP 客户端：一个单例打天下

`SharedHttpClient.instance` 是全应用共享的 `OkHttpClient`，`by lazy` 初始化，连接复用省资源。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:196`

它的配置：连接超时 60 秒；读/写超时 1000 秒（流式长连接不断）；连接池 10 个空闲连接存活 5 分钟；协议优先 HTTP/2。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:202`

每个请求都挂 `LlmNetworkEventListenerFactory`：从请求 tag 里取出 `LlmRequestTraceContext`（含 requestId、provider、model、stream、attempt），全链路打 `AIHttpTrace` 日志——DNS、建连、TLS 握手（记版本和加密套件）、请求/响应头体、连接复用，失败时记异常类名。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:55`

**注意**：这个共享客户端被 `UnsafeModelSsl.apply` 包裹，证书链校验和主机名校验是关掉的（见下文“高危”一节）。

### 4. 端点补全：少填也能跑

用户配供应商时，端点经常只填个域名。`EndpointCompleter.completeEndpoint` 自动补：

- 空路径（`https://api.example.com`）→ 补 `/v1/chat/completions`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:35`
- 路径以 `/v1` 结尾 → 只补 `/chat/completions`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:40`
- URL 末尾加 `#` 可禁用补全（`#` 会被去掉）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:28`

按供应商类型还有特化：

- `OPENAI_RESPONSES` 与 `OPENAI_RESPONSES_GENERIC` 走 `completeResponsesEndpoint`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:82`
- `OPENAI_CODEX` 的端点原样返回，不做任何补全。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:87`
- Anthropic 系：空路径补 `/v1/messages`，`/anthropic` 结尾补 `/v1/messages`，`/v1` 结尾补 `/messages`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:99`
- `GOOGLE`、`GEMINI_GENERIC`、`OPENCODE`、`MNN` 的端点原样返回。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt:112`

### 5. 模型列表拉取：各家 URL 规则 + 鉴权头

`ModelListFetcher.getModelsListUrl` 按供应商拼模型列表地址：

- OpenAI 系与 Anthropic 系：baseUrl + `/v1/models`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:79`
- 智谱后缀为 `/v4/models`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:105`
- 豆包 `/v3/models`、InfiniAI `/maas/v1/models`、支付宝百灵 `/llm/v1/models`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:118`
- 未知类型默认按 OpenAI 兼容格式试 `/v1/models`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:123`
- Gemini 官方端点：已是 `/models` 结尾直接用；含 `/v1/` 用 v1，否则用 v1beta。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:87`
- Vertex AI：从 URL 正则提取 projects/locations 拼地址，失败回退 generativelanguage v1beta。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:97`

`getModelsList` 在 `Dispatchers.IO` 上执行，最多重试 2 次。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:208`

`SocketTimeoutException` 与 `IOException` 触发重试，延迟 1000L*retryCount 毫秒（指数退避）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:394`

`UnknownHostException`（域名解析失败）直接失败，不重试。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:408`

鉴权头按供应商区分：

- Google 把 Key 放进 URL 查询参数 `key`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:242`
- OpenRouter 请求头：`Authorization`:`Bearer`，外加 `HTTP-Referer` 与 `X-Title`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:249`
- NousPortal 沿用与 OpenRouter 相同的兼容请求头。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:255`
- MIMO 在 apiKey 非空时同时加 `Authorization`:`Bearer` 与 `api-key` 两个头。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:262`
- Anthropic 请求头：`x-api-key`（非空时）与 `anthropic-version`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:270`
- OpenCode 请求头：`Authorization`:`Bearer`（非空时）与 `User-Agent`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:278`

日志脱敏：`sanitizeUrlForLog` 把 apiKey 和 key、token、secret 等敏感查询参数值替换成 `API_KEY_HIDDEN`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:133`

OpenAI 系还有个兼容兜底：`/v1/models` 失败时，去掉 `/v1` 再试一次 `/models`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:306`

响应解析：

- OpenAI 格式要求 `data` 数组，缺了抛 `JSONException`；每项取 `id` 生成 `ModelOption`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:447`
- Anthropic 接受 `data` 或 `models` 数组。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:478`
- Google 取 `name` 按 `/` 取最后一段为 id，只保留支持 `generateContent` 的模型。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:528`
- Vertex AI 格式只保留 id 包含 `gemini` 的模型。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:561`

本地模型不走网络：

- MNN 扫公共下载目录 `Operit/models/mnn`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:583`
- 子文件夹含 `llm.mnn` 主文件才算一个模型。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:593`
- llama.cpp 扫 `Operit/models/llama` 下的 `.gguf` 文件。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:626`

### 6. 本地生成结束契约：取消→失败→成功的顺序

`LocalGenerationEnd.end` 是 Llama/MNN 共用的结束顺序，顺序即契约：

1. `cancelled` 为 true → 直接抛 `UserCancellationException`，绝不 emit 半截工具 XML，也不上报 usage。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEnd.kt:76`
2. `success` 为 false → 调 `failWith()` 终止，同样不上报 usage、不处理工具缓冲。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEnd.kt:80`
3. 只有成功 → 先 `emitToolResult()` 处理工具缓冲，再 `usageReporter.report` 上报实测 token。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEnd.kt:83`

`LocalUsageReporter` 用 `AtomicBoolean.compareAndSet` 保证单次上报只执行一次。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEnd.kt:16`

`CancellationException` 会重新抛出，其他异常吞掉——usage 统计绝不能覆盖成功的生成结果。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEnd.kt:30`

背景：旧实现先转换工具缓冲再检查取消，取消时会向下游发出半截工具 XML，下游若按完整工具调用执行，会导致错误落账。

### 7. 高危：UnsafeModelSsl 关掉了 TLS 校验

自定义 `X509TrustManager` 的 `checkServerTrusted` 是空实现（接受任意证书）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/UnsafeModelSsl.kt:22`

`hostnameVerifier` 恒返回 true。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/UnsafeModelSsl.kt:36`

文件注释写得很直白：“为模型请求统一关闭 HTTPS 证书链与主机名校验”。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/UnsafeModelSsl.kt:10`

影响面：`SharedHttpClient.instance`（所有供应商的聊天请求）和 `ModelListFetcher` 的私有客户端都被它包裹——所有携带 API Key 的模型流量都暴露在中间人攻击下。详见代码走查。

## 关键符号

| 符号 | 说明 |
|---|---|
| `AIService` | 所有供应商实现的统一接口 |
| `AIServiceFactory` | 按 `ApiProviderType` 分发创建 Provider 的工厂 |
| `SharedHttpClient` | 全应用共享的 OkHttpClient 单例 |
| `TokenTrackingAIService` | 统计记录边界包装：只记正式调用的真实 usage |
| `EndpointCompleter` | 端点 URL 自动补全 |
| `ModelListFetcher` | 各家模型列表拉取 + 本地模型目录扫描 |
| `LocalGenerationEnd` | Llama/MNN 生成结束顺序契约 |
| `LocalUsageReporter` | 本地生成的一次性 usage 上报器 |
| `UnsafeModelSsl` | 全局关闭证书链与主机名校验（高危） |
| `LlmRequestTraceContext` | 请求追踪上下文（requestId/provider/model/attempt） |
| `ApiProviderType` | 供应商类型枚举（约 30 种） |

## 调用链

1. **输入**：`ModelConfigData`（供应商类型 id、API Key、端点、能力开关）+ `ModelConfigManager` + `Context` 进入 `AIServiceFactory.createService`，返回被 `TokenTrackingAIService` 包裹的 `AIService`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:272`
2. **处理**：`buildService` 按供应商类型分发 new 出对应 Provider；全部注入共享 HTTP 客户端与 Key 策略。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:280`
3. **输出**：返回 AIService 实例；调用方调 `sendMessage(...)` 得 Stream<String>，token 与 usage 经双通道回调上报。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt:59`

模型列表拉取链：`getModelsList` 先补全端点、拼列表 URL、按供应商加鉴权头，GET 后按格式解析为模型列表。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt:205`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIService.kt`（104 行）：统一接口定义
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt`（696 行）：工厂分发、共享 HTTP 客户端、网络追踪
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/EndpointCompleter.kt`（130 行）：端点自动补全
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelListFetcher.kt`（684 行）：模型列表拉取与解析
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LocalGenerationEnd.kt`（84 行）：本地生成结束契约
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/UnsafeModelSsl.kt`（38 行）：TLS 校验关闭（高危）

事实清单：facts.json（151 条）
代码走查：quality.json（5 条：高危 4 / 建议 1）
