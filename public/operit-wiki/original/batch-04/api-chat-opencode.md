---
title: OpenCode 供应商
module: app
sources: 1
date: 2026-10-01
---

## 概述

OpenCode 供应商是 Operit 接入 OpenCode Zen / Go 网关模型的适配层。它本身不实现任何模型协议：拿到配置后，先按模型名前缀判定协议（OpenAI chat、OpenAI Responses、Anthropic、Gemini 四种），再把请求委托给 Operit 已有的对应供应商实现去真正发送。

为什么这样设计：OpenCode 网关聚合了几十家模型，但协议只有四种。与其为每个模型写一套实现，不如做一次"协议路由"，复用 Operit 已验证的四条协议链路，新模型只需在前缀表里加一行。

## AI 速览

- `OpenCodeProvider` — 门面：做协议路由 + thinking 参数装配，把全部 `AIService` 接口委托给内部的协议供应商。
- `OpenCodeRouting` — 纯路由逻辑：`protocolFor` 判定协议，另含端点拼接与 Go 网关识别。
- `OpenCodeChatProvider` — OpenAI 兼容 chat 路由（默认兜底）。
- `OpenCodeResponsesProvider` — OpenAI Responses 路由。
- `OpenCodeClaudeProvider` — Anthropic 兼容路由。
- `OpenCodeGeminiProvider` — Google 兼容路由，自建请求 URL 与鉴权头。
- 主入口：`create(config, …)`（`companion object` 工厂方法）。
- 数据流向一句话：模型配置 → 前缀判定协议 → 拼出协议端点与请求头 → 委托给对应协议供应商发送。

## 核心机制

### 1. 协议路由：模型名前缀决定走哪条协议

`create` 先把配置里的模型名去掉 `opencode/` 或 `opencode-go/` 前缀。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:99`

然后 `OpenCodeRouting.protocolFor` 做判定：模型名转小写，取最后一个 `/` 之后的子串，按前缀匹配。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:140`

- `gemini-` 开头 → `GEMINI_GENERIC`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:146`
- `claude-`、`qwen3.` 开头 → `ANTHROPIC_GENERIC`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:147`
- Go 端点上的 `minimax-`，或非 Go 端点上 `minimax-` 且 `-free` 结尾 → `ANTHROPIC_GENERIC`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:150`
- `gpt-`、`grok-`、`muse-spark-` 开头 → `OPENAI_RESPONSES_GENERIC`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:152`
- 非 Go 端点的 `minimax-`（非 free）→ `OPENAI_GENERIC`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:156`
- `deepseek-`、`kimi-`、`glm-` 等约 17 个兼容前缀 → `OPENAI_GENERIC`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:157`
- 都不匹配直接抛 `IllegalArgumentException`，提示不支持的模型协议。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:173`

### 2. 端点拼接：同一网关按协议切出不同路径

`endpointFor` 在网关 base 后面按协议拼路径：Responses 走 `/responses`，Anthropic 走 `/messages`，Gemini 走 `/models/$modelName`，其余走 `/chat/completions`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:178`

`normalizedBase` 负责把用户填的端点规整成统一形态：去尾部斜杠，没有 `/v1` 结尾就补上。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:193`

### 3. 请求头：标识客户端，Go 网关多一个会话头

所有路由请求都带 `User-Agent: Operit/<版本号>`，让网关识别这是 Operit 客户端。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:105`

如果是 Go 端点（地址以 `/zen/go` 或 `/zen/go/v1` 结尾），再加 `x-opencode-session: operit-<配置id>`，用来稳定 prompt-cache 路由。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:106`

### 4. Thinking 参数装配：只在 Responses 协议真正打开

`sendMessage` 先调 `ThinkingConfigurationApplier.modelParameters`，按 OpenCode 的 thinking 配置算出映射关系和要追加的参数。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:60`

实际是否开启 thinking 取 `enableThinking || thinkingMapping.reasoningRequired`：用户开了，或者模型要求推理，都算开。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:69`

但传给下层供应商时，`enableThinking` 只在协议是 `OPENAI_RESPONSES_GENERIC` 时才为真；其他协议即使算出来要 thinking，也不往下传。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:74`

### 5. Chat 路由：强制回传 reasoning_content

OpenCode 的 OpenAI Chat 路由有个硬性要求：历史 assistant 消息里的 `<think>` 内容必须原样拆成 `reasoning_content` 字段回传，否则工具调用后的下一轮直接 400 报错。

所以 `OpenCodeChatProvider.createRequestBody` 强制 `preserveThinkInHistory = true`，让父类先保留历史里的 think 内容。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:257`

然后 `customizeFinalRequestObject` 在 messages 组装完后做后处理：只挑 `role=assistant` 的消息，把 `<think>` 拆出来写进 `reasoning_content`，清理后的正文写回 `content`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:261`

注意两点：`reasoning_content` 即使为空也照写不误（上游认为"写空"和"没写"是两回事）；多模态的 JSONArray 形态 content 直接跳过不碰。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:285`

### 6. Responses 路由：没开 thinking 就剥掉推理元回合

`OpenCodeResponsesProvider` 设 `useResponsesApi = true`，走 Responses 协议。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:319`

没开 thinking 时，先用 `ChatUtils.stripOpenAiResponsesReasoningMetaTurns` 把历史里的 reasoning 元回合剥掉再发；开了就原样发。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:321`

### 7. Claude 路由：只放行三个具名参数

`OpenCodeClaudeProvider` 继承 `ClaudeProvider`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:347`

`thinkingConfigurations` 固定 `"[]"`，不用父类的 thinking 配置体系。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:362`

`addParameters` 只放行启用的、名字是 `thinking` / `budget_tokens` / `output_config` 的参数，其他一律不写进请求。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:364`

### 8. Gemini 路由：自建 URL 与鉴权头

`OpenCodeGeminiProvider` 继承 `GeminiProvider`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:398`

`thinkingConfigurations` 同样固定 `"[]"`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:413`

它自己拼请求 URL：`apiBase + /models/<模型名>:<方法>`，流式用 `streamGenerateContent` 加 `?alt=sse`，非流式用 `generateContent`。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:421`

API key 走 `x-goog-api-key` 请求头，外加路由阶段拼好的自定义头。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:429`

### 9. 门面委托：身份透传与模型列表

`OpenCodeProvider` 用 Kotlin 委托（`AIService by delegate`）把接口全部转给内部的协议供应商，自己只做路由和参数装配。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:23`

`providerModel` 直接透传 delegate 的值，让共享的响应处理逻辑能识别 Responses / Gemini 流。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:33`

`getModelsList` 走 `ModelListFetcher`，按 `OPENCODE` 类型拉取，用的就是路由前的原始端点。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:35`

相关页面：[[api-chat|云端 Chat API 接入（总览）]]。

## 关键符号

| 符号 | 职责 |
|---|---|
| `OpenCodeProvider` | 门面：路由 + thinking 装配，委托给协议供应商 |
| `OpenCodeProvider.create` | 工厂入口：去前缀 → 判定协议 → 拼端点/请求头 → 选供应商 |
| `OpenCodeRouting` | 路由逻辑容器（object） |
| `OpenCodeRouting.protocolFor` | 模型名前缀 → 协议类型判定 |
| `OpenCodeRouting.endpointFor` | 网关 base + 协议 → 完整请求端点 |
| `OpenCodeRouting.isGo` | 识别 OpenCode Go 网关 |
| `OpenCodeChatProvider` | OpenAI 兼容 chat 路由，处理 reasoning_content 回传 |
| `OpenCodeResponsesProvider` | OpenAI Responses 路由 |
| `OpenCodeClaudeProvider` | Anthropic 兼容路由，参数白名单 |
| `OpenCodeGeminiProvider` | Google 兼容路由，自建 URL 与鉴权 |

## 调用链

1. **输入**：`create(config, …)` 收到模型配置。模型名去 `opencode/` / `opencode-go/` 前缀；`protocolFor` 按前缀判定协议；`endpointFor` 拼出协议端点；拼好 User-Agent 请求头（Go 网关再加 x-opencode-session 会话头）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:99`
2. **处理**：按协议实例化四个供应商之一，包进 OpenCodeProvider 门面。`sendMessage` 时先经 `ThinkingConfigurationApplier` 算出 thinking 映射与追加参数，thinking 开关只在 Responses 协议下真正往下传。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:60`
3. **输出**：门面把调用委托给协议供应商。各路由做自己的收尾：Chat 路由回填 reasoning_content，Responses 路由剥掉推理元回合，Claude 路由过滤参数，Gemini 路由自建 URL 和鉴权头。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt:23`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenCodeProvider.kt`（434 行，100% 已读）：`OpenCodeProvider`（23–137 行）、`OpenCodeRouting`（139–204 行）、`OpenCodeChatProvider`（206–294 行）、`OpenCodeResponsesProvider`（296–344 行）、`OpenCodeClaudeProvider`（346–395 行）、`OpenCodeGeminiProvider`（397–434 行）。
