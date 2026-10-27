---
title: 统一参数模型与自定义参数
module: app
sources: 2
date: 2026-10-01
---

# 统一参数模型与自定义参数

## 概述

- 本页覆盖两块"发请求前的检查与试探"：`ChatConfigReadiness` 在发起聊天前判定一个模型配置是否就绪（缺渠道、缺模型、endpoint 非法、缺 Key 等 7 种问题逐项排查）；`ModelConfigConnectionTester` 在配置页点"测试连接"时，用真实请求把聊天、工具调用、图片/音频/视频五种能力各探一遍。
- 一句话：就绪检查是纯本地的规则判定（不联网），按"渠道→模型→端侧短路→endpoint→Key"顺序返回首个问题；连接测试是真实发请求的 5 种探针，`runCase` 把异常统一记为 FAILED，结果汇总成 `ModelConnectionTestReport`。
- 与 [[api-chat|云端 Chat API 接入（总览）]] 的关系：本页是请求发出前的两道闸门；thinking 参数的规则引擎见 [[api-chat-thinking|thinking 配置机制]]，Key 轮询见 [[api-chat-keypool|Key 池轮询]]。

## AI 速览

- **核心符号**：`ChatConfigReadinessIssue`（7 种就绪问题）、`ChatConfigReadinessResult`（issue 为 null 即就绪）、`ChatConfigReadiness.evaluate`（就绪判定入口）、`ModelConnectionTestType`（CHAT/TOOL_CALL/IMAGE/AUDIO/VIDEO）、`ModelConnectionTestOutcome`（PASSED/UNVERIFIED/FAILED）、`ModelConnectionTestReport`（测试报告）、`ModelConfigConnectionTester.run`（测试入口）、`buildToolCallProbeHistory`（工具调用探针话术）。
- **主入口**：`ChatConfigReadiness.evaluate(config, modelIndex, registeredPluginProviderIds, codexAuthenticated)`；`ModelConfigConnectionTester.run(...)`（suspend）。
- **数据流向一句话**：`evaluate` 按固定顺序逐项检查、首个失败即返回对应 issue；`run` 建真实服务后按能力开关依次跑探针，每个探针经 `runCase` 捕获异常记条目，最终组装 `ModelConnectionTestReport`（无 FAILED 即 success）。

## 核心机制

### 就绪判定（ChatConfigReadiness）

- `ChatConfigReadinessIssue` 枚举 7 种问题：PROVIDER_MISSING、PROVIDER_UNAVAILABLE、ENDPOINT_INVALID、MODEL_MISSING、CODEX_LOGIN_REQUIRED、API_KEY_MISSING、API_KEY_INVALID。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:11`
- `ChatConfigReadinessResult.issue` 为 null 即就绪。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:21`
- `evaluate` 接收模型配置、模型下标、已注册插件渠道 id 集合、codex 登录态（默认 false）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:35`
- providerTypeId 为空 → PROVIDER_MISSING。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:45`
- 插件渠道 id（去空白转小写后比对）命中则直接就绪。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:51`
- `ApiProviderType.fromProviderTypeId` 解析不出 → PROVIDER_UNAVAILABLE。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:56`
- OPENAI_CODEX 未登录（`codexAuthenticated=false`）→ CODEX_LOGIN_REQUIRED。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:58`
- 解析出的模型名为空 → MODEL_MISSING。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:62`
- MNN / LLAMA_CPP 端侧渠道直接就绪，不检查 endpoint 与 Key。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:65`
- endpoint 经 `EndpointCompleter.completeEndpoint` 补全后必须 http/https 且有 host，否则 ENDPOINT_INVALID。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:70`
- 已登录的 OPENAI_CODEX 跳过 Key 检查直接就绪。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:74`
- `credentialOptionalProviders` 含 6 种可免 Key 的渠道：OPENAI_RESPONSES_GENERIC、OPENAI_CODEX、OPENAI_GENERIC、ANTHROPIC_GENERIC、GEMINI_GENERIC、OTHER。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:27`
- hasConfiguredKey：单 Key 非空，或池中有启用且非空的 Key。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:80`
- keyIsRequired：渠道不在免 Key 集合，且 `ApiProviderConfigs.requiresApiKey` 为 true。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:83`
- hasUsableKey 经 `ApiKeyFormatValidator.hasUsableKey(config)` 判定。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:84`
- 多 Key 模式下无可用 Key：配过 Key 报 API_KEY_INVALID，没配过报 API_KEY_MISSING。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:89`
- Key 必填但没配 → API_KEY_MISSING；Key 必填或已配但格式不可用 → API_KEY_INVALID。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:96`
- 全部通过返回空 issue（就绪）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:101`
- `isHttpEndpoint` 解析抛异常直接返回 false。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:104`

### 连接测试（ModelConfigConnectionTester）

- `ModelConnectionTestType` 有 CHAT、TOOL_CALL、IMAGE、AUDIO、VIDEO 五种探针。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:19`
- `ModelConnectionTestOutcome` 有 PASSED、UNVERIFIED、FAILED 三种结论。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:27`
- `ModelConnectionTestItem.success` 仅 PASSED 为 true。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:39`
- `ModelConnectionTestReport` 携带 configId、configName、providerType、请求/实际模型索引、实测模型名与探针条目；success 要求无 FAILED，verified 要求条目非空且全 PASSED。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:42`
- `buildToolCallProbeHistory(toolName)` 构造 4 轮探针：system、user 要求调工具、assistant 发起 tool 调用（ping）、tool_result 回 pong。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:69`
- 探针必须以 user 轮开头（Poe 转 Anthropic 等网关拒绝 assistant 开头），应答必须是 TOOL_RESULT 轮。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:63`
- 用 `getValidModelIndex` 解析实际模型索引并取实测模型名。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:89`
- 经 `AIServiceFactory.createService` 建服务，并回调 `onActiveServiceChanged(service)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:95`
- 探针请求统一 stream=false、enableRetry=false、recordTokenUsage=false。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:111`
- 单探针执行由 `runCase` 承担，CancellationException 重抛。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:122`
- 其他异常记为 FAILED 并带 e.message。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:130`
- CHAT 探针只发一句 "Hi"，不抛异常即 PASSED。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:138`
- TOOL_CALL 探针仅在 `enableToolCall` 时运行，注册 echo 工具（text 参数）跑完整调用闭环。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:142`
- IMAGE 探针仅在 `enableDirectImageProcessing` 时运行。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:177`
- assets 拷缓存 → `ImagePoolManager.addImage` 注册（返回 "error" 则抛错）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:181`
- prompt 为图片链接拼接；`matchesImage` 命中为 PASSED 否则 UNVERIFIED。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:196`
- finally 移除图片并删缓存文件。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:202`
- AUDIO 探针以 "audio/mpeg"、VIDEO 探针以 "video/mp4" 注册到 MediaPoolManager。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:212`
- 取消时 `runCatching { service.cancelStreaming() }` 再重抛。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:269`
- run 体抛异常且尚无 CHAT 条目时，补一条 FAILED 的 CHAT 条目。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:274`
- finally 中 `onActiveServiceChanged(null)` 并 `service.release()`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:283`
- 报告用测试配置的 id、name、apiProviderTypeId 与实测模型名组装。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:286`

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| `ChatConfigReadinessIssue` | 7 种就绪问题枚举 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:11` |
| `ChatConfigReadinessResult` | 就绪判定结果（null issue 即就绪） | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:21` |
| `ChatConfigReadiness.evaluate` | 就绪判定入口 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:35` |
| `credentialOptionalProviders` | 可免 Key 的 6 种渠道集合 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:27` |
| `ModelConnectionTestType` | 5 种探针类型 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:19` |
| `ModelConnectionTestOutcome` | PASSED/UNVERIFIED/FAILED | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:27` |
| `ModelConnectionTestReport` | 测试报告 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:42` |
| `ModelConfigConnectionTester.run` | 测试入口（suspend） | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:82` |
| `buildToolCallProbeHistory` | 工具调用探针话术构造 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:69` |
| `runCase` | 单探针执行与异常归一 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:118` |

## 调用链

1. **输入**：发起聊天前调 `ChatConfigReadiness.evaluate(config, modelIndex, registeredPluginProviderIds, codexAuthenticated)`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:35`
2. **处理**：按"渠道存在→插件短路→渠道可用→codex 登录→模型→端侧短路→endpoint→Key"顺序逐项检查，首个失败返回对应 issue。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:44`
3. **输出**：`ChatConfigReadinessResult(issue)`；issue 为 null 表示就绪，可以发起请求。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt:101`
4. **输入**：配置页"测试连接"调 `ModelConfigConnectionTester.run(...)`（suspend）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:82`
5. **处理**：解析模型索引 → 建真实服务 → 按能力开关依次跑 CHAT/TOOL_CALL/IMAGE/AUDIO/VIDEO 探针（`runCase` 归一异常）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:89`
6. **输出**：`ModelConnectionTestReport`（无 FAILED 即 success）；finally 释放服务并置空回调。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt:286`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ChatConfigReadiness.kt`（114 行，已全读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ModelConfigConnectionTester.kt`（297 行，已全读）
