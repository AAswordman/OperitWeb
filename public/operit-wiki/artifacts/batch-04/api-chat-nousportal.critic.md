# Critic 复核报告：api-chat-nousportal（NousPortal 供应商）

- 复核对象：`review/batch-04/api-chat-nousportal.{md,facts.json,quality.json,lint.md,status.json}`
- 源码基准：~/workspace/Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 `git rev-parse HEAD` 核对一致）
- 复核人：独立 critic（与 writer 无关）
- 结论：**退回修正（3 处：2 处 facts 引用问题 + 1 处 quality 行号笔误，无事实性错误）**

## facts.json：10/12 通过，2 条需修

| # | ref | 核对结果 |
|---|---|---|
| 1 | NousPortalProvider.kt:6 | ✓ 类声明行，32 行文件，"LLM 供应商类"由类名+继承关系支撑 |
| 2 | :19 | ✓ `: OpenRouterProvider(` 继承行；12 参数透传、类体空（同 ollama 页的锚定方式） |
| 3 | :12 | ✓ `providerType: ApiProviderType = ApiProviderType.NOUS_PORTAL` 逐字命中 |
| 4 | :9 | ✓ 窗口 4–14 含前 6 参数 |
| 5 | :15 | ✓ 窗口 10–20 含后 6 参数及默认值 |
| 6 | AIServiceFactory.kt:650 | ✓ 窗口 645–655 含 `ApiProviderType.NOUS_PORTAL ->`(:649)、`NousPortalProvider(`(:650) |
| 7 | :654 | ✓ 窗口 649–659 含 6 个显式传入参数 |
| 8 | ApiProviderConfigCollect.kt:196 | ✓ `defaultModelName = ""` |
| 9 | :197 | ✓ `defaultApiEndpoint = "https://inference-api.nousresearch.com/v1/chat/completions"` |
| 10 | ModelConfigData.kt:32 | ✓ `NOUS_PORTAL, // Nous Portal / Inference API` |
| 11 | OpenRouterProvider.kt:112 | **需修正**：见下 |
| 12 | OpenRouterProvider.kt:99 | **需修正**：见下 |

### [11] 引用窗口差一行（机械改引即可）

断言："继承的 OpenRouterProvider 在自定义头缺省时补默认头：HTTP-Referer 取 DEFAULT_HTTP_REFERER（ai.assistance.operit），X-Title 取 DEFAULT_X_TITLE（Assistance App）"，ref `:112`。

实测：`:112–113` 确为两个 const 声明（值无误）；但"自定义头缺省时才补"的条件逻辑在 `:118`（`if (customHeaders.keys.none { it.equals("HTTP-Referer", ignoreCase = true) })`），落在 `:112` 的 ±5 窗口（107–117）之外 1 行。

修正：ref 改为 `:115`（`private fun mergeOpenRouterHeaders`），窗口 110–120 同时覆盖两个 const（112–113）与缺省判断（118）。断言文字不用动。

### [12] 复合事实，后半句引用撑不起（需拆分）

断言："继承的 OpenRouterProvider 用 ThinkingConfigurationApplier 按模型配置的可编辑 thinking 规则生成统一 reasoning 对象，而不走通用 enableThinking 开关"，ref `:99`。

实测：前半句由 `:99` 窗口（94–104，`ThinkingConfigurationApplier.apply(` 调用及 thinkingConfigurations 参数）完全支撑 ✓。但后半句"而不走通用 enableThinking 开关"的依据是 `OpenRouterProvider.kt:16` 的 KDoc 原文（"the unified `reasoning` object instead of the app's generic `enableThinking` toggle"），不在 `:99` 窗口内。注意 `:106` 处 `enableThinking = enableThinking` 仍作为参数传入 Applier，因此"不走开关"的准确含义必须锚定 KDoc 的 instead-of 表述，不能靠 :99 窗口推导。

修正：拆成两条——
1. "OpenRouterProvider 用 ThinkingConfigurationApplier 按模型配置的 thinking 规则生成统一 reasoning 对象"，ref `:99`；
2. "按类 KDoc，该 reasoning 对象机制替代 app 通用的 enableThinking 开关"，ref `:16`（窗口 11–21 含 KDoc 原文，已实测）。

## quality.json：2/2 证据验真，1 处行号笔误

- item 1（providerType 默认值冗余）：evidence 与 NousPortalProvider.kt:12 逐字一致 ✓；"唯一构造点"已用全仓 grep 验证为真（仅 AIServiceFactory.kt:650）✓。**笔误**：detail 写的行号 `AIServiceFactory.kt:657` 应为 **:656**（`providerType = providerType,` 实际在 656 行，657 行是 supportsVision）。须修正。
- item 2（默认请求头标识）：evidence 两行与 OpenRouterProvider.kt:112–113 逐字一致（含 8 空格缩进，已用 `cat -A` 核对）✓；severity warning / confidence medium 合理 ✓。

## 正文 md：§9 结构完整，1 处需同步拆分

- 概述 / AI 速览 / 核心机制 / 关键符号 / 调用链三段式 / 来源齐全 ✓；术语首现有解释；符号英文原文 ✓。
- "继承的 reasoning 机制"条目（核心机制）复述了 fact [12] 的复合断言并引用 `:99`，需按上述拆分同步处理（拆成两条各引 :99 / :16）。
- 调用链步骤 3 "日志中的请求体会在打印前把 tools 数组与图片数据脱敏"引 `:80`：已实测窗口 75–85 含 `if (logJson.has("tools"))`(:80)、tools 省略替换(:82)、`sanitizeImageDataForLogging`(:84)，引用有效 ✓。
- 次要建议（不阻塞）：概述首段"因为 NousPortal 的接口形态与 OpenRouter 一致"是 writer 的推断，源码无此表述；建议改为"NousPortalProvider 选择继承 OpenRouterProvider（而非 OpenAIProvider），复用其请求头与 reasoning 规范"这类纯事实表述。

## status.json：正确

id=api-chat-nousportal / issue=45 / status=review-pending / source_repo=operit / source_commit=dbf71916… 全对。

## lint：0 硬失败 / 0 警告（writer 自报）

---

**待办**：① fact [11] ref :112→:115；② fact [12] 按上述拆成两条（:99 / :16），正文"继承的 reasoning 机制"条目同步拆分；③ quality item 1 detail 行号 :657→:656。修完重跑 lint 到 0/0 并自查新 ref 窗口，无需二次全文复核。

---

## 修错后复验（2026-10-01T14:10 CST）——**通过**

critic 退回的 3 项全部落地，逐条实测复验：

1. **fact[11]** ref `:112`→`:115`：`:115` 的 ±5 窗口（110–120）同时覆盖 `DEFAULT_HTTP_REFERER`/:112、`DEFAULT_X_TITLE`/:113 与 `customHeaders.keys.none { it.equals("HTTP-Referer", ignoreCase = true) }`/:118，断言"自定义头缺省时才补"被完全支撑 ✓
2. **fact[12] 拆分**：现 [11]（:99）窗口 94–104 含 `ThinkingConfigurationApplier.apply(` 调用 ✓；现 [12]（:16）窗口 11–21 含 KDoc 原文 "the unified `reasoning` object instead of the app's generic `enableThinking` toggle" ✓
3. **quality item 1**：detail 行号已为 `AIServiceFactory.kt:656`（`providerType = providerType,` 实测在 656 行）✓
4. **正文**：「继承的 reasoning 机制」条目已同步拆成两条，分别引用 :99 / :16 ✓

**结论：通过。本页已达收货标准，可进入发布队列。**
