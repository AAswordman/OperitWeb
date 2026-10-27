---
title: DeepSeek 供应商
module: app
sources: 2
date: 2026-10-01
---

# DeepSeek 供应商

## 概述

`DeepseekProvider` 是 Operit 里对接 DeepSeek 模型的 API 供应商（Provider：负责把内部聊天请求翻译成某家模型 API 能懂的格式、发出去、再把响应翻译回来的一层）。

它继承 `OpenAIProvider`，复用 OpenAI 兼容协议的大部分逻辑，只专心处理 DeepSeek 特有的 `reasoning_content` 参数（推理内容：模型在给出正式回答之前的那段思考过程）。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:25`

一个文件里装了两种协议：

- Chat Completions 协议（`/chat/completions` 风格，走 `DeepseekProvider`）。
- Responses 协议（`/responses` 风格，走 `DeepseekResponsesProvider`）。

用哪个由 endpoint 地址的尾缀自动路由，调用方不用操心。
`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:69`

## AI 速览

核心符号：`DeepseekProvider`、`DeepseekResponsesProvider`、`DeepseekRouting.protocolFor`、`DeepseekResponsesPayloadAdapter`、`buildMessagesWithReasoning`、`reasoning_content`。

主入口：伴生对象 `create()` 按 endpoint 路由出两个 Provider；请求体分别由各自的 `createRequestBody` 组装。

数据流向一句话：内部 `PromptTurn` 历史 → 提取 thinking 标签为 `reasoning_content`（或转成 responses 的 input 数组）→ 发 HTTP 请求 → responses 响应的 output 条目按类型解析回文本/推理/工具调用。

## 核心机制

### 端点选择（接入必读）

- 在 Operit 里接入 DeepSeek，必须选对端点：使用 DeepSeek 官方提供的两个端点之一，不能拿其它通用 OpenAI 兼容接口冒充——配置页给 `DEEPSEEK` 供应商只准备了这两个选项。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:76`
- 默认端点是 `https://api.deepseek.com/v1/chat/completions`，走 Chat Completions 协议。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:75`
- 另一个选项是 `https://api.deepseek.com/v1/responses`，走 Responses 协议（支持联网搜索等 responses 专属能力）。
  `app/src/main/java/com/ai/assistance/operit/data/collects/ApiProviderConfigCollect.kt:82`
- 选哪个端点，决定了代码走哪条路：`create()` 按 `DeepseekRouting.protocolFor(config.apiEndpoint)` 的结果实例化 `DeepseekProvider` 或 `DeepseekResponsesProvider`，不存在"通用接口自动适配"这回事。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:65`
- 判定规则只看 endpoint 尾缀：规范化（去空格、去 `#` 后缀、截掉 query/fragment、去尾部斜杠）后以 `/responses` 结尾（忽略大小写）走 Responses，否则一律走 Chat Completions。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:572`

### 双协议路由

- 工厂方法按 `DeepseekRouting.protocolFor` 的返回值选择协议分支。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:69`
- `CHAT_COMPLETIONS` 走 `DeepseekProvider`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:71`
- `RESPONSES` 走 `DeepseekResponsesProvider`，并把 `config.enableDeepSeekWebSearch` 传给它。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:90`
- `protocolFor` 先规范化 endpoint：trim、去 `#` 后缀、截掉 query 和 fragment、去尾部斜杠。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:568`
- 规范化后以 `/responses` 结尾（忽略大小写）走 `RESPONSES`，否则走 `CHAT_COMPLETIONS`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:574`
- 协议枚举 `DeepseekApiProtocol` 只有 `CHAT_COMPLETIONS` 和 `RESPONSES` 两个值。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:558`

### DSML 协议说明（备注）

- DSML 是 DeepSeek 官方的内部工具协议（其原生工具调用标签格式），本身就有标签泄漏进正文的风险。
- Operit 只认自己的内部 XML 协议：`ChatMarkupRegex.toolCallPattern` 只匹配 `<tool … name="…">…</tool …>` 形态的标签，DSML 标签不在匹配范围内。
  `app/src/main/java/com/ai/assistance/operit/util/ChatMarkupRegex.kt:27`
- `parseXmlToolCalls` 的逻辑是：正则命中才转成 tool_calls 并从正文中剔除标签；未命中则原样返回，raw 标签直接留在正文里。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1729`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/OpenAIProvider.kt:1733`
- `DeepseekProvider` 在拼装 ASSISTANT 回合（`:348`）和 TOOL_CALL 历史（`:379`）时都会走 `parseXmlToolCalls`，因此模型一旦吐出 DSML 标签，就会泄漏进回复正文并污染多轮历史；污染后后续工具调用持续解析异常，只能回滚、重新生成或开新对话重置。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:348`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:379`

### 请求体组装（Chat Completions）

- `createRequestBody` 被重写，专为 `reasoning_content` 服务。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:105`
- 请求体固定带 `model`、`stream`；流式时加 `stream_options.include_usage=true`（让服务端回传 token 用量）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:133`
- Thinking 相关参数由 `ThinkingConfigurationApplier.apply` 注入请求体。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:139`
- 注释写明 Thinking Mode 默认开启，关闭时也必须显式发送 thinking.type=disabled。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:136`
- 只有 `isEnabled` 的模型参数才写入请求体。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:144`
- `INT`/`FLOAT`/`STRING`/`BOOLEAN` 按 `valueType` 强转写入；`OBJECT` 先尝试解析为 `JSONObject`/`JSONArray`，失败回退为原始字符串并记警告。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:162`
- 工具调用实际生效要求 `enableToolCall` 为真且工具列表非空（`effectiveEnableToolCall`）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:179`
- 启用后写入 `tools` 数组和 `tool_choice=auto`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:186`
- 聊天历史先经 `prepareHistoryForProvider` 预处理。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:192`
- `calculateAndStoreInputTokens` 统计输入 token 时固定 `preserveThinkInHistory=true`（历史里的思考内容也计入）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:195`
- 消息数组由私有的 `buildMessagesWithReasoning` 组装。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:219`
- 请求日志里把 `tools` 数组替换为占位文本，避免刷屏。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:205`
- 日志前调用 `sanitizeImageDataForLogging` 脱敏图片数据。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:208`

### 推理内容与工具调用编排

- `ASSISTANT` 回合的 thinking 标签内容经 `ChatUtils.extractThinkingContent` 拆出来单独发送。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:347`
- 空的 assistant 内容用 `[Empty]` 占位。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:367`
- tool call 的 id 由 `generatedToolCallId` 按序号本地生成。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:259`
- `emitQueuedToolCallsIfNeeded` 把攒下的 assistant 文本、推理内容和 tool_calls 一次性发出。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:271`
- 攒发的消息始终带 `reasoning_content` 字段。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:275`
- 边界处未匹配的 tool_calls 由 `flushOpenToolCallsAsUnmatched` 转成占位消息，避免请求里出现"有调用无结果"的断裂。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:294`
- 遍历结束时以 `history_end` 为原因做最后一次冲刷。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:534`
- `TOOL_RESULT` 经 `StructuredToolCallBridge.consumeMatchingToolCalls` 与未完成的调用匹配。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:417`
- 匹配上的结果以 `tool_call_id` 对应发出。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:425`
- 未匹配的结果只记一条警告日志，内容被丢弃。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:432`
- `sendMessage` 直接委托 `super.sendMessage`，不做改写。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:554`

### Responses 协议适配

- `DeepseekResponsesProvider` 的 `useResponsesApi` 固定为 true。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1290`
- `bufferResponsesOutputTextUntilItemDone` 固定为 true（输出文本按条目攒批）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1291`
- `toResponsesRequest` 把 `max_tokens` 改写为 `max_output_tokens`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:585`
- `response_format` 搬到 `text.format` 下面。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:591`
- `reasoning_effort` 搬到 `reasoning.effort`，已有值时不覆盖。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:789`
- chat 风格的 `messages` 数组被转成 responses 的 `input` 数组。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:607`
- `role=tool` 的消息转成 `function_call_output` 条目。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:851`
- `system` 角色映射为 `developer`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:922`
- 文本内容块统一转成 `input_text`，图片块转成 `input_image`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:960`
- 非流式 responses 响应的 output 数组按条目 `type` 分发处理。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:628`
- `phase` 为 `commentary` 的 `message` 被转成元数据标签，不当作第二段思考块。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:632`
- `reasoning` 类型条目收集 `reasoning_text` 文本块。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:669`
- `function_call` 条目经 `convertFunctionCallItemToChatToolCall` 转回 chat 风格。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:682`
- `createReasoningMetadataTag` 要求条目有非空 id 且内容含 `reasoning_text`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:719`
- 推理元数据 payload 经 `Base64` 编码后生成可回放的标签。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:733`
- commentary 重放为 `reasoning_text` 而非 `output_text`，否则 DeepSeek 返回 400。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1189`
- `isResponsesCommentaryMessage` 以 `phase` 等于 `commentary`（忽略大小写）为准。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1294`
- 关闭 thinking 时先用 `ChatUtils.stripOpenAiResponsesReasoningMetaTurns` 清理历史中的推理元数据回合。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1328`

### 联网搜索

- `customizeFinalRequestObject` 在 `enableWebSearch` 为真时调用 `appendWebSearchTool`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1359`
- `appendWebSearchTool` 已存在该工具时只设 `tool_choice` 为 auto，不重复添加。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1400`
- `formatResponsesWebSearchDisplayXml` 只处理 `web_search_call` 类型。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1369`
- 搜索结果渲染为 `<search provider="deepseek">` 开头的 XML，含 query 和 source 子节点。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1416`
- `escapeXmlAttribute` 转义 `&`、`<`、`>`、`"`、`'` 五个字符。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1447`

## 关键符号

| 符号 | 说明 |
|---|---|
| `DeepseekProvider` | Chat Completions 协议的 DeepSeek 供应商，继承 `OpenAIProvider` |
| `DeepseekResponsesProvider` | Responses 协议的 DeepSeek 供应商，`useResponsesApi=true` |
| `DeepseekRouting.protocolFor` | 按 endpoint 尾缀判定协议的路由函数 |
| `DeepseekApiProtocol` | `CHAT_COMPLETIONS` / `RESPONSES` 二值枚举 |
| `DeepseekResponsesPayloadAdapter` | chat 风格请求/响应与 responses 协议互转的适配器 |
| `buildMessagesWithReasoning` | 组装带 `reasoning_content` 的消息数组的私有方法 |
| `createRequestBody` | 两处重写：chat 路径组装请求体，responses 路径先转协议再组装 |
| `ThinkingConfigurationApplier.apply` | 注入 thinking 相关参数的公共工具 |

## 调用链

1. **输入**：`create(config, client, …)` 按 `DeepseekRouting.protocolFor(config.apiEndpoint)` 选出 `DeepseekProvider` 或 `DeepseekResponsesProvider`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:69`
2. **处理**：`createRequestBody` 组装 JSON——写 `model`/`stream`、注入 thinking 参数、写入启用的模型参数、条件写入 `tools`；`buildMessagesWithReasoning` 把历史转成带 `reasoning_content` 的消息数组，tool call 攒发、结果按 `tool_call_id` 匹配；responses 路径再经 `DeepseekResponsesPayloadAdapter.toResponsesRequest` 转成 `input` 数组。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:105`
3. **输出**：`createJsonRequestBody` 生成请求体发 HTTP；responses 响应的 output 条目由 `parseNonStreamingResponse` 按 `type` 解析回文本、推理文本、工具调用；commentary 内容以元数据标签形式回放，保证多轮连续。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:212`

## 来源

- 类定义与构造：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:25`
- 协议路由：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:563`
- 请求体组装：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:105`
- 消息构建：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:219`
- 协议适配器：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:580`
- Responses 供应商：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/DeepseekProvider.kt:1263`
