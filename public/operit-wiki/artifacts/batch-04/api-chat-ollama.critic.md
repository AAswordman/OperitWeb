# Critic 复核报告：api-chat-ollama（Ollama 供应商）

- 复核对象：`review/batch-04/api-chat-ollama.{md,facts.json,quality.json,lint.md,status.json}`
- 源码基准：~/workspace/Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 `git rev-parse HEAD` 核对一致）
- 复核人：独立 critic（与 writer 无关）
- 结论：**通过**（附 1 处正文引用顺手修正）

## facts.json：12/12 通过

逐条用 sed 导出 ±5 窗口核对，断言全部被窗口内源码完全支撑，无虚构、无复合事实、无符号笔误：

| # | ref | 核对结果 |
|---|---|---|
| 1 | OllamaProvider.kt:8 | ✓ 窗口 3–13 含类注释 "Uses OpenAI-compatible API surface exposed by Ollama (e.g. /v1/chat/completions)" |
| 2 | :23 | ✓ `: OpenAIProvider(` 继承行；11–22 共 12 参数、24–35 逐一透传、类体空，36 行小文件以类声明行锚定可接受 |
| 3 | :16 | ✓ `providerType: ApiProviderType = ApiProviderType.OLLAMA` 逐字命中 |
| 4 | :13 | ✓ 窗口 8–18 含前 6 参数（apiEndpoint…providerType），customHeaders 默认 emptyMap() 可见 |
| 5 | :19 | ✓ 窗口 14–24 含后 6 参数，默认值 false/"" 全部可见 |
| 6 | AIServiceFactory.kt:450 | ✓ 窗口 445–455 含注释"// Ollama使用OpenAI兼容格式"(:451)、`ApiProviderType.OLLAMA ->`(:452)、`OllamaProvider(`(:453) |
| 7 | :454 | ✓ 窗口 449–459 含 apiEndpoint/apiKeyProvider/modelName/client=httpClient/customHeaders/providerType 显式传入 |
| 8 | ApiProviderConfigCollect.kt:237 | ✓ `defaultModelName = ""` |
| 9 | :238 | ✓ `defaultApiEndpoint = "http://localhost:11434/v1/chat/completions"` |
| 10 | :239 | ✓ `requiresApiKey = false` |
| 11 | ModelConfigData.kt:38 | ✓ `OLLAMA, // Ollama 本地/私有部署服务（OpenAI兼容）` |
| 12 | OpenAIProvider.kt:141 | ✓ `get() = "${providerType.name}:$modelName"`，注释"// 供应商:模型标识符"在 :139 |

## quality.json：1/1 通过

- evidence `    providerType: ApiProviderType = ApiProviderType.OLLAMA,` 与 OllamaProvider.kt:16 逐字一致 ✓
- detail 引用的 AIServiceFactory.kt:459（`providerType = providerType,` 显式传入）行号正确 ✓
- "唯一构造点"断言已用全仓 `grep -rn "OllamaProvider("` 验证：除类定义外仅 AIServiceFactory.kt:453 一处 ✓
- severity suggestion / confidence medium 合理（冗余参数，非功能缺陷）✓

## 正文 md：§9 结构通过，1 处引用需修正

- 概述 / AI 速览（5 符号 + 主入口 + 数据流向一句话）/ 核心机制 / 关键符号 / 调用链（输入→处理→输出三段式编号）/ 来源，结构完整 ✓
- 术语首现均有解释（Ollama、OpenAI 兼容接口），符号名英文原文 ✓
- 需修正 1 处：调用链步骤 2 "endpoint 自动补全（缺路径补 `/v1/chat/completions`，末尾 `#` 可禁用）"所引 `AIServiceFactory.kt:450` 窗口内无此逻辑。断言本身为真——已实测 `EndpointCompleter.kt:22`（`endsWith("#")` 则去后缀禁用补全）、`:36`（基础 URL 自动附加 `/v1/chat/completions`），调用点在 `OpenAIProvider.kt:1823`。建议把该分句的引用改为 `EndpointCompleter.kt:22`（或 `:36`），或删去括号细节。

## status.json：正确

id=api-chat-ollama / issue=44 / status=review-pending / source_repo=operit / source_commit=dbf71916… 全对，critic 留空待填。

## lint：0 硬失败 / 0 警告（writer 自报，已抽查 facts.json 为合法 JSON）

---

**待办**：writer 顺手修正正文 1 处引用（改引 EndpointCompleter.kt:22/:36），无需二次全文复核。
