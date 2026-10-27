---
title: Llama 端侧供应商（已停止维护）
module: api
sources: 1
date: 2026-10-01
---

# Llama 端侧供应商（已停止维护）

## 概述

- **本页供应商已停止维护。** v3 大纲决策：mnn / llama / mmd 等端侧推理引擎久未维护，不再演进；实现代码仍保留在仓内，可读不可依赖。
- 本页覆盖 `api/chat/llmprovider/LlamaProvider.kt`（410 行）：llama.cpp 本地推理的供应商实现。它不调任何云端 API，而是在手机上直接跑 GGUF 模型文件做推理。
- 一句话：用户把模型文件丢进 `Downloads/Operit/models/llama`，`LlamaProvider` 懒创建一个 `LlamaSession`（llama.cpp 的 JNI 封装），聊天记录拼成 prompt 后本地逐 token 生成，结果以流式字符串吐出来。

## AI 速览

- **核心符号**：`LlamaProvider`（供应商）、`LlamaSession`（llama.cpp 会话，`llm/llama` 模块）、`ensureSessionLocked()`（懒创建会话）、`shouldUseToolCall()`（tool-call 开关）、`buildPlainPromptMessages()`（角色归一化）、`StructuredToolCallBridge`（tool-call JSON↔XML 桥）、`LocalUsageReporter` / `LocalGenerationEnd`（用量收尾）。
- **主入口**：`sendMessage(...)` 返回 `Stream<String>`；`testConnection()` 做可用性自检；`getModelsList()` 扫描本地模型目录。
- **数据流向一句话**：聊天记录 → 拼 prompt（tool-call 走结构化模板，普通走 roles/contents）→ `LlamaSession.generateStream` 本地逐 token 生成 → 直接 emit 或攒 buffer 转 tool-call XML → `LocalGenerationEnd` 收尾上报用量。

## 核心机制

- **本地会话懒创建**：`session` 字段初始 null，第一次推理时 `ensureSessionLocked()` 在 `sessionLock` 里调 `LlamaSession.create(pathModel, sessionConfig)` 建好复用；`release()` 负责释放并置空。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:397`
- **双 prompt 路径**：`shouldUseToolCall()` 要求 `enableToolCall=true` 且工具列表非空。开 tool-call 时，历史与工具先转 JSON（`StructuredToolCallBridge.buildMessagesJson/buildToolsJson`），再调 `applyStructuredChatTemplate`；否则 `buildPlainPromptMessages` 把 `PromptTurn` 归一化成 roles/contents（SYSTEM→system，USER/SUMMARY/TOOL_RESULT→user，ASSISTANT/TOOL_CALL→assistant，并剥离思考内容与 Responses 协议标记），调 `applyChatTemplate`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:358`
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:365`
- **采样参数直通**：temperature / top_p / top_k / repetition_penalty / frequency_penalty / presence_penalty 从 `modelParameters` 按 id 取（各有默认值），经 `setSamplingParams` 下发给原生层，`penaltyLastN` 固定 64。非 tool-call 路径还会 `clearToolCallGrammar()` 清掉原生 tool-call 语法状态。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:256`
- **流式生成与取消**：`generateStream(prompt, requestedMaxNewTokens)` 逐 token 回调；`isCancelled` 为 true 返回 false 中断。普通路径每个 token 直接 `emit`，tool-call 路径先攒进 buffer，结束时 `parseToolCallResponse` 解析再转 XML 一次性 emit。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:297`
- **自检与模型发现**：`testConnection()` 在 IO 线程依次检查原生库可用、`modelName` 文件存在，并真实建一个测试会话再释放；`getModelsList()` 扫描本地模型目录返回可选模型。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:117`

## 关键符号

| 符号 | 说明 |
|---|---|
| `LlamaProvider` | llama.cpp 供应商，实现 `AIService`；`providerModel` 形如 `LLAMA_CPP:<modelName>` |
| `LlamaSession` | llama.cpp 的 JNI 会话封装（`llm/llama` 模块），推理、token 计数、模板渲染都经它 |
| `ensureSessionLocked()` | 加锁懒创建/复用会话 |
| `shouldUseToolCall()` | `enableToolCall && availableTools` 非空 |
| `buildPlainPromptMessages()` | `PromptTurn` → roles/contents，角色归一化 |
| `StructuredToolCallBridge` | tool-call 的 JSON 构建与 XML 转换桥 |
| `LocalUsageReporter` / `LocalGenerationEnd` | 本地推理的用量上报与生成收尾 |
| `getModelsDir()` / `getModelFile()` | 模型目录 `Downloads/Operit/models/llama` |

## 调用链

1. **输入**：`sendMessage(chatHistory, modelParameters, enableThinking, …)` 被调用；先 `isCancelled=false`，检查原生库可用与模型文件存在，经 `ensureSessionLocked()` 拿到会话。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:165`
2. **处理**：按 `shouldUseToolCall()` 二选一拼 prompt；下发采样参数；`s.countTokens` 统计输入 token；`generateStream` 逐 token 回调——普通路径直接 emit，tool-call 路径攒 buffer。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:297`
3. **输出**：`LocalGenerationEnd.end` 收尾（tool-call 结果解析转 XML 后 emit，失败走 `onNonFatalError` 并抛 `IOException`），最后 `onUsageFinalized?.invoke(1)`，返回 `Stream<String>`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlamaProvider.kt:322`

## 来源

- `LlamaProvider.kt` 全文件 410 行，关键行见上文引用。
- 工厂接线：`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/AIServiceFactory.kt:482`（`ApiProviderType.LLAMA_CPP` 分支仍保留）。
- llama.cpp JNI 层：`llm/llama/src/main/java/com/ai/assistance/llama/LlamaSession.kt`（本页不展开）。
