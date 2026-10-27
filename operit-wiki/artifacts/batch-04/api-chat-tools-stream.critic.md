# Critic 复核报告：api-chat-tools-stream（工具调用与流式协议）

- 复核对象：`review/batch-04/api-chat-tools-stream.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 git rev-parse 核对一致）
- 复核方式：130 条 facts 逐条取 ref ±5 行窗口与源码 diff；5 条 quality evidence 逐字 diff；正文结构/引用抽查；status 人工检查
- **结论：退回修正（34 处引用窗口违规 + 正文 1 处事实错误 + status 2 处字段问题；断言本身全部为真，无虚构）**

## 总览

| 项 | 结果 |
|---|---|
| facts 130 条 | 断言内容 130/130 属实；**34 条引用行号错位**（ref ±5 窗口内看不到支撑代码） |
| quality 5 条 | 5/5 通过，evidence 均为真实源码且定位准确 |
| 正文 .md | §9 结构完整；**1 处事实错误**（`<invoke name=...>` 候选无源码支撑） |
| .status.json | **2 处问题**：缺 `id` 字段；`source_repo` 大小写错误 |
| lint | 0 硬失败 / 0 警告 |

## 必须修正：34 条引用错位（断言为真，ref 漂移）

修正方式：把 `ref` 改为建议行号（均为实测定位），或按标注拆分复合断言。修正后每条须用 sed 复验新 ref 的 ±5 窗口完全支撑断言。

### StructuredToolCallBridge.kt（12 条）

| # | 当前 ref | 问题 | 建议 ref |
|---|---|---|---|
| 23 | :170 | "恰好 2 个键"（`message.length() == 2` 在 163 行）在窗口外 | :166 |
| 27 | :245 | "从文本解析工具调用并转成 XML"（254–256 行）在窗口外 | :250 |
| 31 | :318 | role=tool 消息发出（324–326 行）在窗口外 | :323 |
| 36 | :362 | wrap/flush 细节（368–383 行）全在窗口外 | :374，或拆成两条 |
| 38 | :410 | role=tool 逐条发出（420–427 行）在窗口外 | :417，或拆分 |
| 54 | :614 | function_call/type=="function_call"/output 三种形态（622–636 行）在窗口外 | :628，或拆分 |
| 56 | :661 | name 三路回退后半段（667–673 行）在窗口外 | :667 |
| 61 | :704 | toolParamPattern/unescape（719–721 行）在窗口外 | 拆分：:704（toolCallPattern）+ :720（参数提取） |
| 65 | :763 | tool_name/params（769–770 行）在窗口外 | :767 |
| 66 | :783 | content 优先级/name 属性（794–801 行）在窗口外 | :794，或拆分 |
| 68 | :809 | 单引号实体（815 行）与 unescape（818–824 行）在窗口外 | 拆分：:812（escape）+ :820（unescape） |
| 70 | :844 | "不足补齐"（850–851 行）在窗口外 | :847 |

### ToolPkgJsAiProviderService.kt（22 条）

| # | 当前 ref | 问题 | 建议 ref |
|---|---|---|---|
| 81 | :100 | 事件名（106 行）、ensureNoFatalError/parseModelOptions（109–110 行）在窗口外 | :105 |
| 82 | :114 | `util.stream.stream {`（125 行）在窗口外 | :125 |
| 83 | :138 | enableThinking/stream/preserveThinkInHistory/enableRetry（144–147 行）在窗口外 | :142 |
| 84 | :146 | 回调体（152–160 行）在窗口外 | :155 |
| 89 | :179 | CancellationException 重抛（187–189 行）在窗口外 | :188 |
| 90 | :197 | functionSource（203 行）、payload（205–211 行）在窗口外 | :205，或拆分 |
| 92 | :223 | Channel 创建/Dispatchers.IO（230–240 行）在窗口外 | :232，或拆分 |
| 94 | :252 | "无 dispatchIntermediateOnMain 参数"是缺席断言，需完整调用面（252–267 行）支撑 | :260 |
| 101 | :313 | apiKey（319 行）在窗口外（308–318） | 删掉 fact 中的 apiKey，或 ref 移 :316（注：apiKey 另有 fact [102] 覆盖，不丢失） |
| 105 | :345 | category/enabled/custom（351–353 行）在窗口外 | :349 |
| 106 | :357 | parametersStructured 子字段（366–370 行）在窗口外 | :366，或拆分 |
| 109 | :401 | ArrayValue/单值分支（407–415 行）在窗口外 | :408，或拆分 |
| 110 | :420 | 对象分支 id/name 回退（426–437 行）在窗口外 | 拆分：:420（文本值）+ :431（对象） |
| 111 | :443 | 对象 success 分支（449–460 行）在窗口外 | :449，或拆分 |
| 112 | :466 | 对象形态（472–475 行）在窗口外 | :470，或拆分 |
| 115 | :518 | success=false 抛错（527–531 行）、else 放行（533 行）在窗口外 | :527 |
| 122 | :571 | 三空返 null（577–579 行）、attempt 缺省 1（581–582 行）在窗口外 | :578，或拆分 |
| 123 | :597 | 函数体（603–610 行）在窗口外 | :605 |
| 124 | :614 | completeSnapshot = !attemptPresent（625 行）在窗口外 | :621 |
| 126 | :637 | 对象 chunk/chunks/text/content 提取（642–656 行）在窗口外 | :645，或拆分 |
| 127 | :663 | String/Boolean/Number/Map/List 分支（669–674 行）在窗口外 | :670，或拆分 |
| 128 | :685 | attemptPresent=false（692 行）在窗口外（差 2 行） | :687 |

## quality.json（5 条，全过）

- Q0 警告：apiKey 原样进 JS hook payload（:319）— evidence 逐字一致，定性准确。
- Q1 建议：customHeaders 解析失败静默吞掉（:384）— evidence 逐字一致。
- Q2 建议：中间结果 Channel.UNLIMITED 无界（:234）— evidence 逐字一致。
- Q3 建议：未匹配 tool_result 只记 debug 日志后丢弃（:434）— evidence 逐字一致。
- Q4 建议：`longValueExact()` 小数 token 抛异常（:485）— evidence 逐字一致。
- 小瑕疵（非阻塞）：5 条 evidence 首行缩进被剥离（源码行首有缩进），建议保留原始缩进以做到逐字复制。

## 正文（§9 结构通过，1 处事实错误必须修）

- §9 结构完整：概述 / ## AI 速览（核心符号+主入口+两条数据流向） / 核心机制（8 个子节） / 关键符号（14 项，英文原名） / 调用链（3 条三段式） / 来源。
- 人话短句，术语首现有解释（hook、payload），符号名保留英文原文。
- **事实错误**："围栏代码块与 `<invoke name=...>` 片段也加入候选"——`parseXmlToolCallsFromText`（568–612 行）的候选只有全文、`extractJson`、`extractJsonArray`、```json 围栏块四种，全函数无任何 `<invoke name=...>` 处理。必须删除该半句（facts.json [53] 的表述是正确的，以 facts 为准）。
- 同步修正：正文"`calculateInputTokens` 的 payload 只有 `chatHistory` 与 `availableTools`"引用 :197，payload 实际在 205–211 行——与 fact [90] 同问题，改为 :205。
- 其余正文引用行号抽查（:8 事件常量 import 块、:310 flush 函数定义、:745 wrap 函数、:579/:600 候选提取、:120 缺失说明格式、:233 块归属）全部有效。

## .status.json（2 处问题）

当前内容：`{"critic":"","issue":52,"source_commit":"dbf71916...","source_repo":"Operit","status":"review-pending","title":"工具调用与流式协议"}`

1. **缺 `id` 字段**：其他 batch-04 页面 status 均有 `id: api-chat-tools-stream`，本页缺失，需补上。
2. **`source_repo` 大小写错误**：值为 `"Operit"`，但 `scripts/check_staleness.py` 只认小写 `"operit"`/`"wiki"`（batch-03 8 页均为小写），大写会导致过期检查判 UNKNOWN。需改为 `"operit"`。

issue 52 / review-pending / source_commit 均正确。

## 给 writer 的修正要求

1. 按上表修正 34 条 fact 的 ref（或拆分复合断言），逐条用 sed 复验新 ref ±5 窗口完全支撑断言。
2. 正文删除"`<invoke name=...>` 片段"半句；`calculateInputTokens` payload 引用 :197→:205。
3. status.json 补 `id` 字段；`source_repo` 改小写 `operit`。
4. quality evidence 首行补回原始缩进（非阻塞，建议顺手做）。
5. 改完重跑 `scripts/lint.py` 保持 0/0，通知 parent 复检（只需复检本次列出的问题条目，无需重走全文复核）。

## 复检（2026-10-01T14:00 CST，修错后复验）

**结论：未通过 — 1 条需修正**（其余全部通过）

### 验证范围与方法
- 142 条 facts 全量程序化校验：ref 文件存在、行号不越界、反引号符号落在 ±5 窗口内 — **0 失败**。
- 34 处退回项逐条人工 sed 核验 ±5 窗口（StructuredToolCallBridge 18 条、ToolPkgJsAiProviderService 28 条，含全部 12 处拆分的新条目）。
- 3 处偏离逐条实测裁决（见下）。
- 正文 2 处、status.json、quality 5 条 evidence 逐字 diff、lint。

### 未通过条目（1 条）
- **idx39** `StructuredToolCallBridge.kt:417`：断言"TOOL_RESULT turn **先 emitQueuedToolCallsIfNeeded**，再解析 XML 结果…" — `emitQueuedToolCallsIfNeeded()` 在 **411 行**，落在 :417 的 ±5 窗口（412–422）之外 1 行。修错员是按原 critic 建议 :417 执行的，但该建议本身差 1 行。**修正：ref 改为 :416**（窗口 411–421，同时覆盖 411 行的 `emitQueuedToolCallsIfNeeded()`、412 行的 `parseXmlToolResults`、416 行的 `consumeMatchingToolCalls` 与 417–421 的 role=tool 发出逻辑）。改后重跑 lint 即可，无需重走全文。

### 3 处偏离的最终结论
1. **[90] :206 vs :205**：**两者都对，接受 :206**。修错员的理由（":205 窗口漏掉 203 行 functionName"）算错了——:205 的窗口是 200–210，包含 203 行。但 :206 的窗口（201–211）同样完整覆盖 functionName(203)/functionSource(204)/chatHistory(208)/availableTools(210)，锚点有效，无需改动。
2. **[115] :528 vs :527**：**修错员是对的**。:527 的窗口（522–532）盖不住 533 行的 `else -> Unit`；:528 的窗口（523–533）同时覆盖 `if (!success)`(527)、`throw IllegalStateException(`(528) 与 `else -> Unit`(533)。原 critic 建议 :527 有误，:528 为正确锚点。
3. **6 处额外拆分**（[36]:370/:379、[38]:417/:423、[54]:618/:632、[66]:784/:797、[68]:812/:820、[92]:232/:239、[94]:254/:263、[106]:360/:368、[109]:406/:414、[110]:423/:431、[126]:644/:653，实际为 11 处拆分）：逐条 sed 核验，**全部合规**，拆分后的每条断言均被各自窗口完全支撑。
4. **[61] :705 vs :704**：:705 的窗口（700–710）覆盖 `ChatMarkupRegex.toolCallPattern.findAll(content)`（705 行），有效，接受。

### 其他验证结果（全部通过）
- **正文**：`<invoke name` 已删除（grep 0 命中）；`calculateInputTokens` 引用 :197→:205 已改。注：正文用 :205 而 facts 用 :206，两者窗口都有效，仅为一致性小瑕疵，不阻塞。
- **status.json**：`id: api-chat-tools-stream` 已补；`source_repo: operit` 小写正确；issue 52 / review-pending / source_commit 正确。
- **quality**：5 条 evidence 全部与源码逐字一致（含缩进已恢复），severity/confidence 合理。
- **lint**：单页 0 硬失败 / 0 警告（整批 lint 的失败项在 api-speech，属其他未完工页面，与本页无关）。

复检过程未改动 facts/md/quality/status 文件，未动 review-queue.json。
