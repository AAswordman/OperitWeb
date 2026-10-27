# Critic 复核报告：api-chat-mistral（Mistral 供应商）

- 复核对象：`review/batch-04/api-chat-mistral.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse HEAD` 一致）
- 复核方式：19 条 facts 逐条取 ref ±5 行窗口与源码比对；2 条 quality evidence 逐字 diff；正文结构与 status 人工检查
- **结论：退回修正（4 条 facts 引用错位，无事实性错误）**

## 总览

| 项 | 结果 |
|---|---|
| facts 19 条 | 15 通过 / **4 条引用错位**（[1][2][3][8]，断言全部为真） |
| quality 2 条 | **2/2 通过**，evidence 逐字一致、行号准确，severity/confidence 合理 |
| 正文 .md | §9 结构完整，通过（正文引用行号全部正确，无需改） |
| .status.json | 通过（id / issue 39 / review-pending / source_repo=operit / source_commit 正确） |
| lint | 0 硬失败 / 0 警告 |

## 必须修正（断言为真，只是 ref 漂移；writer 曾自曝首轮行号系统性少算，本次 4 处是漏网的）

| # | 现 ref | 断言摘要 | 问题 | 建议 ref |
|---|---|---|---|---|
| 1 | `MistralProvider.kt:15` | "providerType 默认 MISTRAL，**并转发给父类 OpenAIProvider**" | 复合事实：默认值在 15 行 ✓，但转发 `providerType = providerType` 在 **28 行**，窗口 10–20 盖不住 | 拆两条：(a)"默认值为 ApiProviderType.MISTRAL" ref :15；(b)"转发给父类构造" ref :28（窗口 23–33 覆盖 `: OpenAIProvider(` 与传参） |
| 2 | `MistralProvider.kt:49` | "重写 parseXmlToolCalls：用 `ChatMarkupRegex.toolCallPattern.findAll(content)` 找出 XML 工具调用块" | `findAll` 在 **38 行**、`override fun` 在 37 行，窗口 44–54 内两者皆无 | **:38**（窗口 33–43 覆盖 37–38） |
| 3 | `MistralProvider.kt:49` | "没有任何匹配时直接返回 `Pair(content, null)`" | `if (!matches.any()) { return Pair(content, null) }` 在 **40–42 行**，窗口 44–54 盖不住 | **:41** |
| 8 | `MistralProvider.kt:80` | "处理完一个匹配后，用 `textContent.replace(match.value, "")` 删除 XML 片段" | 该行在 **71 行**，窗口 75–85 盖不住 | **:71** |

## 次要（不阻塞，建议顺手）

- [0]（ref :9）"MistralProvider 是 Mistral AI 模型的专用供应商实现"：窗口 4–14 仅含类声明 `class MistralProvider(`，属弱引用但可接受（标识性事实）。不强制改。

## 通过部分

- 其余 15 条 facts（含 [4][5][6][7][9]–[18]）逐条实测通过：`ChatMarkupRegex.kt:28`（toolCallPattern 结构/IGNORE_CASE/DOT_MATCHES_ALL）、`:91`（toolParamPattern 分组语义）、`OpenAIProvider.kt:1729`（`open fun parseXmlToolCalls`）、`AIServiceFactory.kt:578`（MISTRAL 分支，窗口 573–583 覆盖 577–578）全部有效。
- quality 2 条：Q0 warning（`textContent.replace` 全量删除非按区间删）evidence 逐字一致、line 71 准确；Q1 suggestion（32 位哈希截断 9 位有碰撞可能）evidence 为 77–86 行整函数逐字一致。定性准确，无夸大。
- 正文 §9 结构完整：概述 / ## AI 速览 / 核心机制（4 节）/ 关键符号表 / 调用链三段式 / 来源。且**正文引用全部正确**（:37/:41/:71 等），修 facts.json 时无需动正文。
- status.json 全对。

## 给修错员的要求

1. 按上表修正 4 条 ref（[1] 拆成两条），每条用 sed 复验 ±5 窗口完全支撑。
2. 重跑 `scripts/lint.py` 保持 0/0。无需重走全文复核。

## 复检（2026-10-01T13:58 CST，修错后复验）

**结论：通过**。退回的 4 项全部修正并独立验真。

- **[1] 拆分**：(a)"providerType 默认值为 ApiProviderType.MISTRAL" ref :15，窗口 10–20 覆盖 15 行赋值 ✓；(b)"providerType 参数被转发给父类 OpenAIProvider 的构造函数" ref :27，窗口 22–32 同时覆盖 `) : OpenAIProvider(`（22 行）与 `providerType = providerType,`（27 行）✓。
- **[1](b) :27 vs :28 争议最终结论**：**修错员是对的**。我亲眼核实：`:28` 的窗口（23–33）不含 22 行，`OpenAIProvider` 父类名落在窗口外，无法支撑"转发给父类 OpenAIProvider"断言；`:27` 的窗口（22–32）同时覆盖父类名与转发参数。原 critic 建议的 :28 有误，:27 为正确锚点。
- **[2]**：ref :38，窗口 33–43 覆盖 `override fun parseXmlToolCalls`（37）与 `toolCallPattern.findAll(content)`（38）✓。
- **[3]**：ref :41，窗口 36–46 覆盖 `if (!matches.any())`（40）与 `return Pair(content, null)`（41）✓。
- **[8]**：ref :71，窗口 66–76 覆盖 `textContent.replace(match.value, "")`（71）✓。

未通过条目：无。本页已达收货标准。
