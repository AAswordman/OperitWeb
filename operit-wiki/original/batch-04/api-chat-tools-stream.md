---
title: 工具调用与流式协议
module: app
sources: 2
date: 2026-10-01
---

# 工具调用与流式协议

> 本页讲两件事：一是 `StructuredToolCallBridge`——把各家大模型五花八门的工具调用格式统一成一套内部协议；二是 `ToolPkgJsAiProviderService`——允许用 JS 工具包自己实现一个 AI 供应商（含流式输出与 token 账本）。

## 概述

- 人话：大模型调工具时各家格式不统一——OpenAI、Gemini、Claude 各有一套工具调用格式。StructuredToolCallBridge 就是翻译官：不管模型吐哪种格式，都先归一化成内部统一格式，再走后面的执行流程。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:696`
- 人话：`ToolPkgJsAiProviderService` 回答"能不能不用内置供应商"——可以。写一个 JS 工具包，实现约定的几个 hook（发消息、列模型、测连通、算 token），App 就把它当成一个标准 `AIService` 来用，流式输出和用量统计都接得上。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:28`
- 术语：hook（钩子）——工具包向宿主暴露的命名 JS 函数，宿主在特定事件发生时调用它；payload——调用 hook 时传过去的 JSON 参数包。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:223`

## AI 速览

- `StructuredToolCallBridge` — 工具调用格式的归一化桥（多家协议 → 内部统一格式）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:14`
- `ToolPkgJsAiProviderService` — JS 工具包形态的 AI 供应商服务，实现 `AIService`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:28`
- `ProviderHookValue` — hook 返回值的密封类型：Null/Text/Boolean/Number/Object/Array 六态。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:32`
- `buildStructuredMessages` — 对话历史 → 结构化消息数组的核心函数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:259`
- `invokeProviderFunction` — 调包内 hook 的统一入口（中间结果 channel + 最终结果解码）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:223`
- `TokenUsage` — token 账本快照：input/cachedInput/output 可空，attempt 标记第几次尝试。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:685`
- 主入口：`sendMessage(...)`（发消息/流式）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:114`
- 数据流向（桥）：对话历史 → `buildStructuredMessages` 归一化成结构化消息 → 发给模型 → 工具调用归一化 → 执行 → 结果拼回历史。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:259`
- 数据流向（JS 包供应商）：`invokeProviderFunction` 调包内 hook，中间结果经 `Channel` 流式吐出、usage 按 attempt 记账。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:228`

## 核心机制

### 协议归一化：三家格式进，一种格式出

- `normalizeSingleToolCall` 做三件事：name 从 `function.name` / 顶层 `name` / `function_call.name` 里取（全空则丢弃）；arguments 归一化成 JSON 字符串（空则 `"{}"`）；id 取 `raw.id` / `raw.call_id`，缺省拼 `call_<清洗后工具名>_<序号>`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:661`
- 归一化输出固定为 `{id, type:"function", function:{name, arguments}}`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:696`
- 文本里的工具调用也能被识别：`parsePossibleToolCallsFromText` 先尝试全文解析。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:568`
- 再依次用 `extractJson` 提取对象、`extractJsonArray` 提取数组作为候选。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:579`
- 围栏代码块也加入候选，逐段 `extractToolCallsFromAny` 归一化。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:592`
- `extractToolCallsFromAny` 识别 `tool_calls` 数组与 `function_call` 对象两种形态。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:618`
- 另识别 `type` 为 `function_call` 的对象与 `output` 数组。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:632`

### 代理信封：包工具与 CLI 工具的解包

- 人话：工具包里的工具名带冒号（如"包名:工具名"），真正执行前要先包一层代理信封，执行完再拆开对应回调用的 call ID。`toolCallName` 就是拆信封的函数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:44`
- `wrapPackageToolCallsWithProxy` 遍历工具调用，逐条判断是否需要加代理信封。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:745`
- 工具名含冒号且不是 package_proxy 自身时改名 package_proxy，参数包成 `tool_name` + `params` 结构。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:767`
- `toolCallName` 遇到代理工具时调用 `proxyTargetToolName` 拆信封。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:48`
- `proxyTargetToolName` 按 `arguments`→`args`→`input` 顺序取参并解析 JSON 提取目标工具名。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:57`
- 代理参数不是合法 JSON 时记 warn 日志并返回空串，不抛异常。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:72`

### 历史编译：调用与结果必须配对

- 人话：模型调了 3 个工具，结果回来不保证按调用顺序返回（被拒绝的调用会被顶到前面）。`consumeMatchingToolCalls` 坚持按名字精确配对，不按位置硬配——位置配对会把结果安到错误的 call ID 上。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:80`
- 配对不上的 open 调用不会凭空消失：`flushOpenToolCallsAsUnmatched` 逐条补发"工具结果缺失"消息，保证历史在协议层面永远合法。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:310`
- 补发的消息带 `tool_call_id` 与缺失说明，并记日志（含数量与原因）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:320`
- 缺失说明的措辞是定死的：`"工具结果缺失：<工具名> <原因>。这不是用户取消。"`——特意声明不是用户取消，避免模型误判。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:120`
- 缺失原因码共 14 种，例如 `tool_result_partial_batch`（批量结果只回来一部分）、`typed_tool_call_without_payload`（调用没有可执行参数）、`tool_call_api_disabled`（工具调用协议已关闭）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:110`
- 边界类原因（`user_boundary` / `system_boundary` / `assistant_boundary` / `history_end` 等）映射为"后续对话历史已到达，但未返回执行结果"。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:115`
- `compileHistoryForProvider` 先把连续同类 turn 合并成块后再输出。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:177`
- 块归属：`ASSISTANT`/`TOOL_CALL` 进助手块，`TOOL_RESULT` 进结果块，`USER`/`SUMMARY` 进用户块，`SYSTEM` 直接透传。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:233`
- `useToolCall=false` 时结果块降级映射为 `USER`（给不支持 tool role 的 provider 用）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:199`
- `preserveThinkInHistory=false` 时助手 turn 先去掉思考过程内容再入库。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:335`
- 空白内容统一填 `"[Empty]"`，避免发空字符串破坏协议。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:466`

### XML 形态：内部文本协议

- 工具调用在内部文本里是 XML 形态：随机标签名 + `name` 属性 + 若干 `<param name="k">v</param>`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:536`
- `parseXmlToolCalls` 解析 XML 工具调用并生成稳定 ID。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:704`
- ID 格式为 `call_` 前缀接工具名、工具名:参数的哈希与序号，同一内容每次解析 ID 一致，方便调试追踪。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:727`
- 参数不可解析为 JSON 但非空时，用 `<param name="_raw_arguments">` 原样包裹。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:555`
- `convertToolCallPayloadToXml` 是反向：JSON 工具调用 → XML 文本（供文本通道使用）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:245`
- `sanitizeToolCallId` 只保留字母数字、`_`、`-`，其余换下划线，全空时返回 `"call"`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:831`

### JS 包供应商：hook 调用编排

- 人话：`ToolPkgJsAiProviderService` 把"调云端大模型"这件事外包给 JS 工具包：App 只负责把对话历史、模型参数、可用工具序列化成 JSON 发过去，包里的 JS 决定怎么调真正的模型 API。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:28`
- `invokeProviderFunction` 是 hook 调用的统一入口：有中间结果回调时建无界 `Channel`，`Dispatchers.IO` 上起协程消费、解码后转发。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:228`
- 生产走真实包管理器，测试可注入 `mainHookRunnerOverride`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:98`
- hook 的事件名是常量：发消息 `TOOLPKG_EVENT_AI_PROVIDER_SEND_MESSAGE`、列模型 `TOOLPKG_EVENT_AI_PROVIDER_LIST_MODELS`、测连通 `TOOLPKG_EVENT_AI_PROVIDER_TEST_CONNECTION`、算 token `TOOLPKG_EVENT_AI_PROVIDER_CALCULATE_INPUT_TOKENS`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:8`
- 每次 hook 调用带独立执行 ID `executionChatId`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:65`
- 该 ID 注入 payload 的 `chatId` 字段；取消流式即按此 ID 取消包执行。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:281`
- 运行时上下文键：`"toolpkg_provider:<包名>:<小写 providerId>"`，`runtimeKind="provider"`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:68`

### 流式输出：中间结果与最终结果

- `sendMessage` 用 `stream { }` 构建 `Stream<String>`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:114`
- 中间结果回调：先 `applyAndForwardUsage` 处理 usage。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:148`
- 再转非致命错误，最后把文本 chunk 逐个 `emit`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:159`
- 有中间文本块时，最终结果的文本不再重复发出（`hasIntermediateTextChunk` 门控）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:172`
- 文本块提取：先取 `chunk` 字段，再取 `chunks` 数组。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:646`
- 再依次取 `text`、`content` 字段。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:654`
- `testConnection` 里 `CancellationException` 直接重抛，不被当成普通失败吞掉。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:184`
- `release()` 就是 `cancelStreaming()`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:219`

### Token 账本：attempt 语义

- 人话：流式场景下 usage 会上报多次，到底哪次算数？答案是看 `attempt`（第几次尝试，从 1 开始）：同 attempt 的多次上报是"部分更新"，统计层只保留最终成功那个 attempt 的快照。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:546`
- 旧协议（不带 attempt）语义不同：它是整个逻辑请求的累计快照，固定按 attempt 1 记账，后报覆盖先报，绝不累加。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:551`
- 账本字段可空：缺省 = 未知，绝不用全局计数填充，避免跨 attempt 继承造成虚假累计；负值拒绝为未知。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:553`
- 设计铁律：最终结果的 usage 必须与明确的成功完成信号同属一个 attempt。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:164`
- UI 计数器与账本快照分离：`applyUsage` 缺省字段按 0 计，请求快照保持未知，由外层按 attempt 合并。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:631`
- 计数全程 `Long`：`longValueExact` 精确转换，负值钳到 0，绝不 Int 截断。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:480`
- `onUsageFinalized` 拿到的是最终 attempt 号；拿不到且是旧协议时按 1 处理。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:176`

### 错误语义：致命与非致命

- `ensureNoFatalError`：hook 返回对象里 `success=false` 抛 `IllegalStateException`；非对象返回值直接放行。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:523`
- `extractNonFatalError` 取 `nonFatalError` 字段。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:537`
- 非致命错误走 `onNonFatalError` 回调，不中断流程。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:125`
- `getModelsList` 调包内 hook 取模型列表。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:100`
- 三个只读接口（列模型、测连通、算 token）都先经过 `ensureNoFatalError` 再解析。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:109`
- `calculateInputTokens` 的 payload 只有 `chatHistory` 与 `availableTools`（context 传 null，不带 locale）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:205`

## 关键符号

- `StructuredToolCallBridge` — 工具调用结构化协议桥（单例）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:14`
- `toolCallName` — 代理信封解包，取可执行工具名。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:44`
- `consumeMatchingToolCalls` — 按名精确配对 open 调用与结果。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:80`
- `unmatchedToolResultContent` — 未匹配调用的缺失说明生成。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:105`
- `buildStructuredMessages` — 历史 → 结构化消息数组。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:259`
- `normalizeSingleToolCall` — 单条调用归一化。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:661`
- `wrapPackageToolCallsWithProxy` — 包工具调用加代理信封。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:745`
- `ToolPkgJsAiProviderService` — JS 工具包 AI 供应商服务。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:28`
- `ProviderHookValue` — hook 返回值密封类型。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:32`
- `sendMessage` — 发消息/流式主入口。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:114`
- `invokeProviderFunction` — hook 调用统一入口。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:223`
- `extractUsage` — usage 提取（含新旧协议分支）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:557`
- `TokenUsage` — token 账本快照数据类。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:685`
- `ToolPkgMainHookRunner` — 测试缝接口。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:700`

## 调用链

### 链路一：历史 → 发给模型的结构化消息

1. 输入：`List<PromptTurn>` 对话历史 + `preserveThinkInHistory` 开关；先经 `compileHistoryForProvider(useToolCall=true)` 合并。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:259`
2. 处理：逐 turn 生成消息；新工具调用分配 `generatedToolCallId` 并登记 `OpenToolCall`，结果 turn 按名精确匹配。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:286`
3. 输出：消息数组，元素为助手消息（含 `tool_calls`）或 tool 结果消息；未匹配的调用补"工具结果缺失"消息。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt:302`

### 链路二：JS 包供应商的一次 sendMessage

1. 输入：`chatHistory`、`modelParameters`、`availableTools`、`enableThinking`、`stream` 等参数。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:118`
2. 处理：`buildBasePayload` 组装 provider 身份与模型配置 → 调包内 hook 发消息；中间结果先处理 usage 再转错误，最后发出文本块。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:137`
3. 输出：`Stream<String>` 文本流；usage 按 attempt 记账后经 `onUsageFinalized` 结算。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:176`

### 链路三：usage 上报 → 账本

1. 输入：hook 返回的 `ProviderHookValue`（对象形态）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:557`
2. 处理：`applyAndForwardUsage` 解析 usage、更新 UI 计数并转发规范化快照。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:597`
3. 输出：usage 快照与上报回调。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt:614`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/StructuredToolCallBridge.kt`（860 行）：工具调用协议归一化、代理信封、历史编译。
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ToolPkgJsAiProviderService.kt`（712 行）：JS 工具包 AI 供应商、hook 编排、流式输出、token 账本。
- 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`），两文件已 100% 逐行读完。
