# Critic 复核报告：api-chat-qwen（通义千问供应商）

- 复核对象：`review/batch-04/api-chat-qwen.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse HEAD` 一致）
- 复核方式：19 条 facts 逐条取 ref ±5 行窗口与源码比对；2 条 quality evidence 逐字 diff；正文结构与 status 人工检查
- **结论：退回修正（1 条 facts 引用错位 + 2 处 quality 行号微调 + 1 处数字事实错误）**

## 总览

| 项 | 结果 |
|---|---|
| facts 19 条 | 18 通过 / **1 条引用错位**（[18]，断言为真） |
| quality 2 条 | evidence 逐字一致，但 **2 处 line 字段偏 1–2 行**；另 **Q1 detail 与正文"14 个参数"实为 13 个** |
| 正文 .md | §9 结构完整，通过（1 处数字错误需同步改） |
| .status.json | 通过（id / issue 38 / review-pending / source_repo=operit / source_commit 正确） |
| lint | 0 硬失败 / 0 警告 |

## 必须修正

### 1. facts [18] 引用错位（断言为真）

- 现 ref：`AIServiceFactory.kt:592`，窗口 587–597
- 断言："`ApiProviderType.SILICONFLOW` 分支同样构造 `QwenAIProvider`，此时 `qwenProviderType` 为 SILICONFLOW，音频 data URI 改写不生效"
- 问题：窗口内能看到分支（592 行）与 `QwenAIProvider(`（594 行），但 `qwenProviderType = providerType` 在 **599 行**，落在窗口外。`providerType == SILICONFLOW` 的依据是 317 行 `when (providerType)`，同样在窗口外。
- 修正建议：ref 改为 **:597**（窗口 592–602，同时覆盖分支标签 592、构造调用 594、传参 599）；或拆成两条："SILICONFLOW 分支构造 QwenAIProvider"（ref :592）+"该分支传入 `qwenProviderType = providerType`"（ref :599）。
- 备注：正文 .md 同一断言引用的是 `:595`（窗口 590–600 已覆盖 599 行），正文引用正确，无需改。

### 2. quality 行号微调（evidence 内容逐字正确）

- Q0"完整请求体原文写入 logcat"：`line: 82` → 应为 **81**（evidence 首行 `val sanitizedLogJson = ...` 在 81 行，块为 81–86 行，已逐字 diff 确认一致）。
- Q1"sendMessage 重写为空壳透传"：`line: 123` → 应为 **121**（evidence 首行 `): Stream<String> {` 在 121 行，块为 121–124 行，已逐字 diff 确认一致）。

### 3. 数字事实错误："14 个参数"实为 13 个

- Q1 detail 写"把全部 **14 个参数**原样透传"；正文"消息发送"节同样写"把 **14 个参数**原样透传"。
- 实测 `QwenAIProvider.kt:107–121` 的 `sendMessage` 参数：context、chatHistory、modelParameters、enableThinking、stream、availableTools、preserveThinkInHistory、onTokensUpdated、onUsageReported、onNonFatalError、enableRetry、recordTokenUsage、onUsageFinalized——**共 13 个**（123 行的 super 调用同样传 13 个实参）。
- 修正：两处 "14 个参数" → "13 个参数"。

## 通过部分（抽查结论）

- facts [0]–[17] 逐条实测：ref 文件存在、行号有效、±5 窗口完全支撑断言，无虚构、无复合事实。含跨文件引用 `ModelConfigData.kt:19`（ALIYUN 注释）、`OpenAIProvider.kt:799`（父类音频载荷默认实现）、`AIServiceFactory.kt:493`（ALIYUN 分支）均有效。
- quality 2 条 severity/confidence 合理：Q0 warning（请求体原文进 logcat，仅 tools 字段被省略）属实；Q1 suggestion（空壳重写）属实。
- 正文 §9 结构完整：概述 / ## AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制（4 节）/ 关键符号表 / 调用链（三段编号，引用精确到行）/ 来源。术语首现给解释（"供应商""推理配置"），符号名英文原文。

## 给修错员的要求

1. 按上表修正 [18] 的 ref（或拆分），sed 复验新窗口。
2. quality Q0/Q1 的 `line` 改为 81 / 121。
3. Q1 detail 与正文"消息发送"节的 "14 个参数" → "13 个参数"。
4. 重跑 `scripts/lint.py` 保持 0/0。无需重走全文复核。

## 复检（2026-10-01T13:58 CST，修错后复验）

**结论：通过**。退回的 4 项全部修正并独立验真。

- **[18]**：ref 已改为 `AIServiceFactory.kt:597`，窗口 592–602 同时覆盖分支标签 `ApiProviderType.SILICONFLOW ->`（592）、`QwenAIProvider(` 构造（593）、`qwenProviderType = providerType`（599）——断言完全被支撑 ✓。
- **Q0**：`line` 已改为 81。实测 `val sanitizedLogJson = sanitizeImageDataForLogging(logJson)` 确在 81 行，evidence 块 81–86 行与源码逐字一致 ✓。
- **Q1**：`line` 已改为 121。实测 `): Stream<String> {` 确在 121 行，evidence 121–124 行逐字一致 ✓。
- **"14→13 个参数"**：我亲自数过 `QwenAIProvider.kt:107–121` 的 sendMessage 签名——context、chatHistory、modelParameters、enableThinking、stream、availableTools、preserveThinkInHistory、onTokensUpdated、onUsageReported、onNonFatalError、enableRetry、recordTokenUsage、onUsageFinalized——**共 13 个**，改述属实。Q1 detail 与正文"消息发送"节均已改为"13 个参数"，全文无"14 个参数"残留 ✓。

未通过条目：无。本页已达收货标准。
