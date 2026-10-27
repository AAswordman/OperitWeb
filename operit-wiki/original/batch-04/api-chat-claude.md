---
title: Claude 供应商
module: app
sources: 1
date: 2026-10-01
---

# Claude 供应商

## 概述

- `ClaudeProvider` 是云端 Chat API 里对接 Anthropic Claude 的供应商实现，实现 `AIService` 接口，类声明为 `open` 可被继承。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:43`
- 一句话：把内部 `PromptTurn` 历史转成 Anthropic Messages API 的 JSON，用 OkHttp 发 POST，再把 SSE/JSON 响应解析成文本流吐给上层。
- 为什么单独一页：Anthropic 的格式和 OpenAI 不一样——系统消息走顶层 `system` 参数而不是塞进 messages；图片是 base64 内嵌的 content block；流式是 SSE 事件（`message_start` / `content_block_delta` / `message_stop`）；usage 字段叫 `input_tokens` / `output_tokens`。这个类把这些差异全包了，还顺带兼容了 OpenAI 风格的第三方中转端点。

## AI 速览

- **核心符号**：`ClaudeProvider`（供应商实现）、`sendMessage`（主入口）、`createRequestBody`（请求组装）、`createRequest`（HTTP 发送）、`buildSerializedHistory`（历史序列化）、`buildMessagesAndCountTokens`（消息+token 估算）、`parseAnthropicUsage` / `applyAnthropicUsage`（用量解析与落账）、`applyStableCacheBreakpoints`（prompt cache 断点）、`cancelStreaming`（取消）、`testConnection`（连通性测试）。
- **主入口**：`sendMessage`（ClaudeProvider.kt:1299），传入聊天历史、模型参数、工具定义等，返回文本流。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1299`
- **数据流向一句话**：PromptTurn 历史 → 序列化为 Anthropic messages + system JSON → OkHttp POST → SSE/JSON 流式解析 → 文本流。

## 核心机制

### 历史序列化

- `buildSerializedHistory` 先经 `StructuredToolCallBridge.compileHistoryForProvider` 编译历史。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:716`
- system 类消息用 "\n\n" 连接后放入 `systemBlocks`，最终走顶层 `system` 参数而非 messages。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:725`
- 非 tool 模式下，ASSISTANT / TOOL_CALL 映射为 "assistant"，其余映射为 "user"。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:966`
- `preserveThinkInHistory=false` 时从 ASSISTANT 历史中移除 thinking 内容。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:848`
- 图片链接转为 type=image、source 为 base64 的 content block；音视频链接会被移除并打警告（Claude 格式当前仅支持图片）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:526`
- 空消息会被填充为 "[Empty]" 文本块，避免发空 content 数组。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:542`

### Tool Call（XML 桥接，`enableToolCall` 门控）

- 开关关闭时，`parseXmlToolCalls` 直接返回原文，不做任何转换。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:349`
- 历史中的 XML 工具调用转为 `tool_use`，id 形如 `toolu_<工具名>_<hash>_<序号>`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:377`
- 工具定义由 `buildToolDefinitionsForClaude` 生成，含 name、description、input_schema。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:435`
- 流式 `content_block_start` 的 tool_use 会生成随机标签名并发出 XML 起始标签。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1700`
- `content_block_start` 时创建 `StreamingJsonXmlConverter`，把工具参数 JSON 流式转成 XML 发出。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1708`
- 工具结果按名称匹配未完成的 tool_use，生成 `tool_result` 块；匹配不上的按占位内容处理。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:926`

### Prompt Cache 与 Token 计数

- `applyStableCacheBreakpoints` 给 tools 最后一项、system 最后一个块、最后一条消息的内容块打缓存断点，返回断点数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:636`
- 断点对象 type 为 ephemeral；启用 1 小时缓存时加 `ttl=1h`；已有 `cache_control` 的块不会被覆盖。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:605`
- `parseAnthropicUsage` 按字段是否存在判定 usage 有效——显式全零的 payload 也算已观察到，不按 ">0" 过滤。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:176`
- 缓存输入 token 取值优先级：`cache_read_input_tokens` > `input_tokens_details.cached_tokens` > `cached_tokens`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:187`
- `applyAnthropicUsage` 把解析结果写入 `TokenCacheManager`（`updateActualTokens`）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:260`
- `applyAnthropicUsage` 回调 `onTokensUpdated` 上报 token 计数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:275`
- `calculateInputTokens` 用 `updateState=false` 做预估，不污染实际计数状态。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1062`

### 请求组装与发送

- `createRequestBody` 写入 `model` 与 `stream` 字段。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1073`
- `max_tokens` 优先级：模型参数 > 请求体已有值 > 按模型名解析的官方值。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1084`
- 官方值按模型名前缀查表：opus-4 系列 32000，sonnet-4 / 3-7-sonnet 64000，3-5 系列 8192，3-haiku 4096，兜底 4096。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1144`
- `addParameters` 映射 temperature、top_p、top_k、max_tokens 等常用参数。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1163`
- 请求头固定带 `x-api-key`、`anthropic-version: 2023-06-01`、`Content-Type: application/json`，另加用户自定义头。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1231`
- 端点经 `EndpointCompleter.completeEndpoint` 补全；URL 与请求头在打日志前经 `HttpLogSanitizer` 脱敏。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1223`

### 响应解析与兼容

- 先用 `peekBody(4096)` 预读，判断响应是 JSON 还是 SSE。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1468`
- 4xx 响应抛 `HttpStatusException`，把状态码带进统一重试循环。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1451`
- stream 下收到纯 JSON（非 SSE）且为多行 JSONL 时，走 OpenAI 兼容解析。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1471`
- SSE 事件：`message_start` 应用 usage（不覆盖输出 token）；`content_block_delta` 处理文本/思考/工具参数增量；`message_stop` 确认完成。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1691`
- thinking 内容块只在启用 thinking 时转为 `<think>` 标记发出。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1352`
- `redacted_thinking` 块直接丢弃。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1358`
- 非 SSE 的 JSON 行缓冲上限 200 万字符，超限不再追加。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1621`

### 重试、取消与测试

- 重试前调 `onRetryAccepted`（触发 ROLLBACK 回滚已收文本），按 `LlmRetryPolicy.nextDelayMs` 退避等待。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1286`
- 取消异常直接抛出不重试；手动取消标志为 true 时停止重试。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1263`
- `cancelStreaming` 先置手动取消标志，再关闭 `activeResponse` 中断流读取，最后取消 `activeCall`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:124`
- 流式未确认完成时抛网络中断错误；最终失败抛连接超时错误并携带最后一次异常。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1993`
- `testConnection` 发一条 "Hi" 短消息验证完整的连接与认证；其中的取消异常原样传播。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:2057`
- `getModelsList` 委托 `ModelListFetcher.getModelsList`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:2040`

## 关键符号

| 符号 | 说明 |
|---|---|
| `ClaudeProvider` | Anthropic Claude 供应商实现（`AIService`，`open` 类） |
| `sendMessage` | 主入口：发消息并返回文本流，含重试/取消/用量回调 |
| `createRequestBody` | 组装 Anthropic Messages 请求 JSON |
| `createRequest` | 补全端点、加认证头，发起 OkHttp POST |
| `buildSerializedHistory` | PromptTurn 历史 → messages + systemBlocks |
| `buildMessagesAndCountTokens` | 序列化 + 缓存断点 + 输入 token 估算 |
| `parseAnthropicUsage` / `applyAnthropicUsage` | usage 解析与 token 落账 |
| `applyStableCacheBreakpoints` | 三处稳定 prompt cache 断点 |
| `parseXmlToolCalls` / `parseXmlToolResults` | XML ↔ Claude tool 格式桥接 |
| `buildToolDefinitionsForClaude` | 工具定义（含 input_schema）生成 |
| `cancelStreaming` | 中断当前流式传输 |
| `HttpStatusException` | 带状态码的 API 异常 |
| `testConnection` / `getModelsList` | 连通性测试 / 模型列表 |

## 调用链

1. **输入**：调用 `sendMessage`，传入聊天历史、模型参数、工具定义等回调。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1299`
2. **处理**：
   - 每次发送先重置手动取消标志与输出 token 计数。
     `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1316`
   - `createRequestBody` 组装请求 JSON（含 thinking 配置、tools 定义、max_tokens 解析）。
     `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1073`
   - `createRequest` 补全端点、加 `x-api-key` 等请求头，`client.newCall` 发起请求。
     `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1223`
   - 响应按 SSE 事件流式解析（或按 JSON / OpenAI 兼容格式回退解析），usage 实时落账。
     `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1468`
   - 异常走 `handleRetryableError` 判定重试/取消/终止，重试前回滚已收文本。
     `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1286`
3. **输出**：文本增量实时 emit 组成文本流返回；成功后回调 `onUsageFinalized` 并记录最终输出。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt:1995`

## 来源

- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（v1.12.2）
- 单文件：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ClaudeProvider.kt`（2080 行，100% 已读）
- 类与构造：`:43` / `:49` / `:59`；取消：`:124`；用量解析：`:176` / `:260` / `:275`
- 历史序列化：`:716` / `:725`；缓存断点：`:636`；请求组装：`:1073` / `:1223`
- 响应解析：`:1468` / `:1691`；重试：`:1286`；主入口：`:1299`
- 事实清单：`api-chat-claude.facts.json`（126 条）；代码走查：`api-chat-claude.quality.json`（5 条）
