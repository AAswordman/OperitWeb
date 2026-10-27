---
title: Codex 供应商
module: api
sources: 1
date: 2026-10-01
---

# Codex 供应商

## 概述

- 本页覆盖 `api/chat/llmprovider/CodexProvider.kt`（303 行）：OpenAI Codex 账号体系的供应商实现。它不用 API Key，而是用 OAuth 登录态（access token）调 Codex 专用的 Responses 端点。
- 一句话：`CodexProvider` 继承自 `OpenAIResponsesProvider`（Responses API 的通用实现），只改三件事——鉴权头（Codex 账号 ID 等）、请求体微调（关 store、关并行工具调用、模型名映射）、模型白名单与目录解析。

## AI 速览

- **核心符号**：`CodexProvider`（供应商）、`CodexAccessTokenProvider`（OAuth token 供给）、`CodexModelPolicy`（模型白名单）、`CodexModelVariant`（`-fast` 后缀映射）、`CodexModelListFetcher`（模型目录拉取/解析）、`CodexOAuthProtocol`（端点常量）、`CodexAuthManager`（登录态）。
- **主入口**：`customizeFinalRequestObject()`（请求体定制）、`applyAuthenticationHeaders()`（鉴权头）、`getModelsList()`（模型列表）。
- **数据流向一句话**：OAuth access token 作 API Key → 请求头追加 Codex 账号 ID 等 → 请求体加 Codex 特有字段 → Responses 端点 → web_search 结果转 `<search provider="codex">` XML 展示。

## 核心机制

- **OAuth 鉴权**：`CodexAccessTokenProvider.getApiKey()` 直接返回 `authManager.getValidAccessToken()`；`getCandidateKeyCount()` 按登录态返回 0 或 1（给密钥轮换逻辑用）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:17`
- **Codex 专属请求头**：在父类鉴权头基础上追加 `ChatGPT-Account-ID`（取不到抛 `IllegalStateException`）、`originator: operit`、`User-Agent: Operit/<版本>`、随机 `session-id`，以及可选的 `x-openai-internal-codex-residency`（数据驻留）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:54`
- **请求体定制**：`store=false`（服务端不存档）、`parallel_tool_calls=false`（禁用并行工具调用）；`include` 数组恒加 `reasoning.encrypted_content`，开联网搜索时再加 `web_search_call.action.sources`。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:67`
- **联网搜索工具注入**：`enableWebSearch=true` 时 `appendWebSearchTool()` 往 tools 追加 `{"type":"web_search"}` 并置 `tool_choice=auto`；已存在则不重复加。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:124`
- **搜索结果展示**：`formatResponsesWebSearchDisplayXml()` 只处理 `web_search_call` 条目，把查询词与来源拼成 `<search provider="codex" action status>` XML 给 UI 渲染；query 和 source 都空返回 null。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:90`
- **模型白名单**：`CodexModelPolicy.allows()` 显式放行 gpt-5.5 / gpt-5.3-codex-spark / gpt-5.4 / gpt-5.4-mini，显式拉黑 gpt-5.5-pro 与 gpt-5.6，pro 推理模式一律拒绝，其余 `gpt-x.y` 只放行版本 > 5.4 的。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:201`
- **-fast 变体映射**：`CodexModelVariant` 把 `xxx-fast` 映射为 `xxx`，映射成功时请求改写 `model` 并加 `service_tier=priority`（优先服务层级）。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:223`
- **模型目录**：`CodexModelListFetcher.getModelsList()` GET 拉 `MODEL_CATALOG_ENDPOINT`（OpenCode 模型目录格式），`parseModels()` 要求根下有 `openai.models`，过滤白名单后把 `experimental.modes` 的每个 mode 展开成 `$id-$mode` 变体。
  `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:237`

## 关键符号

| 符号 | 说明 |
|---|---|
| `CodexProvider` | Codex 供应商，`ApiProviderType.OPENAI_CODEX` |
| `CodexAccessTokenProvider` | OAuth access token 供给器 |
| `CodexModelPolicy` | 模型白名单/版本门控 |
| `CodexModelVariant` | `-fast` 后缀 → 真实模型 id + priority 层级 |
| `CodexModelListFetcher` | 模型目录拉取与解析 |
| `CodexOAuthProtocol` | `CODEX_RESPONSES_ENDPOINT` / `MODEL_CATALOG_ENDPOINT` |
| `appendWebSearchTool()` | 注入 web_search 工具 |

## 调用链

1. **输入**：`customizeFinalRequestObject(requestObject, messagesArray, toolsJson)` 在父类拼好 Responses 请求体后被调用；`applyAuthenticationHeaders()` 在发请求前组装鉴权头。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:67`
2. **处理**：请求体依次经过白名单无关的通用定制 → web_search 注入 → `CodexModelVariant` 模型名改写 → `store`/`parallel_tool_calls`/`include` 硬编码；请求头带上 Codex 账号 ID 与随机 session-id。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:76`
3. **输出**：Responses 端点返回；`web_search_call` 条目被转成 `<search>` XML 供 UI 展示；模型列表走目录端点解析。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/CodexProvider.kt:90`

## 来源

- `CodexProvider.kt` 全文件 303 行，关键行见上文引用。
- 父类 `OpenAIResponsesProvider` 与 `CodexOAuthProtocol`、`CodexAuthManager` 在 `api/chat/llmprovider/` 与 `data/api/` 下，本页不展开。
