# Critic 复核报告：api-chat-runtime（对话编排运行时）

- 复核对象：`review/batch-04/api-chat-runtime.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对一致）
- 复核方式：94 条 facts 逐条取 ref ±5 行窗口与源码比对；10 条 quality evidence 逐行 diff；正文结构与 status 人工检查
- **结论：退回修正（13 条 facts 引用问题，无事实性错误）**

## 总览

| 项 | 结果 |
|---|---|
| facts 94 条 | 断言内容 94/94 属实，无虚构；**13 条引用问题**（8 弱引用/错位 + 5 复合事实需拆分） |
| quality 10 条 | 10/10 通过，evidence 全部真实；2 处 line 错位（Q5/Q7），多处首行缩进被剥离（非阻塞） |
| 正文 .md | §9 结构完整，通过；但正文引用了同样的错位 ref，需随 facts 同步修正 |
| .status.json | 通过（id/issue 55/review-pending/source_repo operit/source_commit 正确） |
| lint | 0 硬失败 / 0 警告（writer 自报，已见 .lint.md） |

## 必须修正：13 条引用问题

### A. 引用锚定错误（1 条，断言正确但 ref 指错了地方）

| # | 当前 ref | 问题 | 建议 |
|---|---|---|---|
| 57 | EnhancedAIService.kt:216 | ref 指向 `getCurrentOutputTokenCountForFunction`，与断言 `resetTokenCountersForFunction` 无关 | 改为 **:2562**（实例方法 `suspend fun resetTokenCountersForFunction(functionType: FunctionType? = null)`，窗口 2557–2567 完全支撑） |

### B. 弱引用（ref ±5 窗口看不到支撑代码，5 条）

| # | 当前 ref | 问题 | 建议 ref（均已 sed 实测窗口完全支撑） |
|---|---|---|---|
| 26 | :700 | 窗口只有 `estimatePreparedRequestWindow` 签名；`publishRequestWindowEstimate(windowSize)` 在 712 行 | **:712** |
| 29 | :464 | 窗口只有 `getModelExecutionSnapshot` 签名；`functionType == FunctionType.CHAT && overrideConfigId != null` 分支在 474 行 | **:474** |
| 30 | :1335 | 窗口只有函数签名；`val plugins = listOf(StreamXmlPlugin())` 在 1346 行 | **:1346** |
| 71 | :939 | 窗口 934–944 只看到前 3 个观察启动；`startWakeMonitoring()` 在 945、`startExternalHttpMonitoring()` 在 946 | **:944** |
| 92 | :446 | 窗口只有函数开头；关键判断 `if (!keepAliveEnabled && !isRunning.get()) return` 在 454–456 行 | **:455** |

### C. 复合事实需拆分（7 条，一个 ref 撑不起多个断言）

1. **[34]**（:1712）"processStreamCompletion：空内容仍做 finalizeAssistantResponse；检测到工具调用走 handleToolInvocation；否则直接收尾"——窗口只有签名。拆 3 条：
   - 空内容→finalize：ref **:1752**（窗口 1747–1757：`if (content.isEmpty())` + `finalizeAssistantResponse(` 调用）
   - 工具调用→handleToolInvocation：ref **:1953**（窗口 1948–1958：`if (extractedToolInvocations.isNotEmpty())` + `handleToolInvocation(extractedToolInvocations, ...)`）
   - 否则直接收尾：ref **:1984**（窗口 1979–1989：落到最后的 `finalizeAssistantResponse(` 调用）
2. **[35]**（:2011）"finalizeAssistantResponse 把 isConversationActive 置 false；记忆自动保存经 MemoryAutoSaveCandidateRepository.enqueue 入队；随后通知并 stopAiService"——窗口只有签名。拆 3 条：
   - 置 false：ref **:2024**（`context.isConversationActive.set(false)`）
   - 记忆入队：ref **:2044**（`MemoryAutoSaveCandidateRepository(...).enqueue(`）
   - 通知+stopAiService：ref **:2063**（`notifyReplyCompleted(...)` + `stopAiService(...)`）
3. **[36]**（:2072）"handleToolInvocation 逐个触发 onToolInvocation 回调；UI 状态置为 ExecutingTool；经 ToolExecutionManager.executeInvocations 执行工具"——窗口只有签名。拆 3 条：
   - 回调：ref **:2102**（`toolInvocations.forEach { onToolInvocation?.invoke(...) }`）
   - UI 状态：ref **:2107**（`_inputProcessingState.value = InputProcessingState.ExecutingTool(toolNames)`）
   - 执行工具：ref **:2116**（`ToolExecutionManager.executeInvocations(`）
4. **[37]**（:2192）"processToolResults 把工具结果转为 TOOL_RESULT 回合；token 用量超过阈值时触发 onTokenLimitExceeded 并结束对话"——窗口只有签名。拆 2 条：
   - TOOL_RESULT 消息：ref **:2214**（`ConversationMarkupManager.buildToolResultMessage(results)`）
   - 阈值→onTokenLimitExceeded：ref **:2316**（窗口 2311–2321：`if (usageRatio >= tokenUsageThreshold)` + `onTokenLimitExceeded?.invoke()` + `isConversationActive.set(false)`）
5. **[68]**（AIForegroundService.kt:155）"回复通知 tag 格式为 `ai_reply:` 加 chatId（空则用 default）"——窗口有 builder 逻辑但 `REPLY_NOTIFICATION_TAG_PREFIX = "ai_reply:"` 的定义在 119 行，窗口外。拆 2 条或重锚：
   - 前缀定义：ref **:119**
   - builder 逻辑：ref **:155**（保留）
6. **[84]**（AIForegroundService.kt:1947）"前台通知带三个操作按钮：语音悬浮窗、唤醒监听开关、退出应用"——窗口 1942–1952 只看到第 1 个 addAction。拆 3 条：
   - 语音悬浮窗：ref **:1947**（`R.string.service_voice_floating_window`）
   - 唤醒监听开关：ref **:1966**（`R.string.service_turn_off_wake` / `service_turn_on_wake`）
   - 退出应用：ref **:1990**（`R.string.service_exit`）
7. **[93]**（AIForegroundService.kt:1206）"ACTION_PREPARE_WAKE_HANDOFF 用 SpeechPrerollStore 捕获唤醒前的音频窗口并停止唤醒监听做交接"——窗口只看到捕获，看不到停止监听（1217 行）。拆 2 条：
   - 捕获音频窗口：ref **:1210**（`SpeechPrerollStore.capturePending(...)` + `armPending()`）
   - 停止唤醒监听：ref **:1217**（`stopWakeListening(releaseProvider = true)`）

## quality.json（10 条，全部通过，2 处 line 错位）

逐行 diff 验证，10 条 evidence 全部真实、定性准确，无虚构：

- Q0（warning/high）：ACTION_EXIT_APP 杀进程 `Process.killProcess`+`exitProcess(0)` — 属实。
- Q1（warning/high）：静态 `notifyReplyCompleted` 内 `runBlocking` 读 DataStore，主线程调用有 ANR 风险 — 属实。
- Q2（warning/high）：反射调用 `AudioRecordingConfiguration` 隐藏方法 `getClientUid` — 属实（证据逐字一致）。
- Q3（warning/high）：1×1 全透明 overlay 保活 — 属实。
- Q4（warning/high）：截断修复捏造 `truncated_tool_call` 默认工具名并真实执行 — 属实。
- Q5（warning/medium）：`handleToolInvocation` 中 `toolBatch.results` 为空且 `toolResultOverrideMessage` 为空时无任何分支处理，直接记时日志后返回，不收尾、不重置 UI 状态（UI 已置 `ExecutingTool`）— **已人工核实源码 2133–2178，属实**。
- Q6（warning/medium）：ROLLBACK 事件协程 `streamBuffer.clear()/append` 与主收集循环 `append` 并发无锁 — 属实。
- Q7（suggestion/high）：`processStreamCompletion` 中第二个 `if (content.isEmpty()) return` 是死代码（1747–1758 的前一分支已 return）— **已人工核实，属实**。
- Q8（suggestion/medium）：唤醒词 `Regex(phrase)` 直接编译用户输入，复杂正则有 ReDoS 风险 — 属实。
- Q9（suggestion/medium）：`loadBitmapFromUri` 全尺寸解码做通知大图标，无 inSampleSize — 属实。

**需顺手修正**：
- Q5：line **2143 → 2142**（evidence `} else if (!toolResultOverrideMessage.isNullOrEmpty()) {` 实际在 2142 行）。
- Q7：line **1765 → 1764**（evidence 含注释行 `// If content is empty, finish immediately`，实际在 1764 行）。
- 非阻塞建议：Q0/Q1/Q3/Q4/Q6/Q8/Q9 的 evidence 首行缩进被剥离，建议补回原始缩进做到逐字复制（与 batch-04 其他页 critic 口径一致）。

## 正文（通过，引用需同步）

- §9 结构完整：概述 / ## AI 速览（核心符号清单+主入口+数据流向一句话） / 核心机制 / 关键符号（符号表，英文原名） / 调用链（输入→处理→输出三段式编号） / 来源。
- 人话短句，术语首现有解释；无代码走查混入正文。
- 正文引用行号与 facts.json 同源，上述 13 条修正后**正文对应引用必须同步改**。

## status.json（通过）

`{id: api-chat-runtime, title: 对话编排运行时, issue: 55, status: review-pending, source_repo: operit, source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb}` — 全部正确。

## 给 writer 的修正要求

1. 按上表修正 13 条 facts（8 条改 ref / 5 条复合拆分，其中 [34][35][36][37][84][93][68] 拆分后 facts 总数会增加）。
2. 修正 quality.json Q5/Q7 的 line（2142 / 1764），可选补回各条 evidence 首行缩进。
3. 正文引用了同样行号的断言同步修正。
4. 改完重跑 `scripts/lint.py` 保持 0/0，并自查每个新 ref 的 ±5 窗口完全支撑断言，然后通知复检（只需复检本次列出的问题条目）。

---

## 复检（2026-10-01 13:57 CST，修错后复验）

- **结论：通过**。13 条退回项全部修正完毕，逐条亲自用 sed 核实 ±5 窗口，未发现未通过条目。
- facts 94 → **107 条**（拆分净增 13 条：[34]+2、[35]+2、[36]+2、[37]+1、[68]+1、[84]+2、[93]+1、[71]+2），拆分后的每条新 fact 断言原子化且窗口自足。
- **逐条复验结果**：
  - [57] → :2562：窗口 2557–2567 含 `suspend fun resetTokenCountersForFunction(functionType: FunctionType? = null)` 及 KDoc"重置指定功能类型或所有功能类型的token计数器" ✓
  - [26] → :712：窗口含 `if (publishEstimate)` + `publishRequestWindowEstimate(windowSize)` + `return windowSize`；`requestWindowEstimateFlow` 为 `_requestWindowEstimate.asStateFlow()`（:403）已确认连接 ✓
  - [29] → :474：窗口含 `if (functionType == FunctionType.CHAT && overrideConfigId != null)` 分支及 lease 持有 ✓
  - [30] → :1346：窗口含 `val plugins = listOf(StreamXmlPlugin())` 及"使用XML插件来拆分流"注释 ✓
  - [71] 拆 3 条：:722（`by lazy` 进程单例声明）、:930（onCreate 引用 `chatRuntimeHolder`）、:944（五组观察调用全部在窗内）✓——修错员按原子化铁律加拆，超出 critic 原建议但更合规，接受
  - [92] → :455：窗口含 `if (!keepAliveEnabled && !isRunning.get()) { return }` ✓
  - [34] → :1752（`if (content.isEmpty())` + `finalizeAssistantResponse(`）、:1953（`extractedToolInvocations.isNotEmpty()` + `handleToolInvocation(`）、:1984（落底 `finalizeAssistantResponse(`）✓
  - [35] → :2024（`context.isConversationActive.set(false)`）、:2044（`MemoryAutoSaveCandidateRepository(...).enqueue(`）、:2063（`notifyReplyCompleted` + `stopAiService`）✓
  - [36] → :2102（`onToolInvocation?.invoke`）、:2107（`ExecutingTool(toolNames)`）、:2116（`ToolExecutionManager.executeInvocations(`）✓
  - [37] → :2222（`ConversationMarkupManager.buildToolResultMessage(results)`）、:2316（`usageRatio >= tokenUsageThreshold` + `onTokenLimitExceeded?.invoke()` + `isConversationActive.set(false)`）✓
  - [68] → :119（`REPLY_NOTIFICATION_TAG_PREFIX = "ai_reply:"`）、:155（`buildReplyNotificationTag` builder 逻辑）✓
  - [84] → :1947（语音悬浮窗按钮）、:1966（唤醒监听开关按钮）、:1990（退出应用按钮）✓
  - [93] → :1210（`SpeechPrerollStore.capturePending` + `armPending`）、:1217（`stopWakeListening(releaseProvider = true)`）✓
- **[37] 行号争议最终结论：修错员是对的**。我亲自用 sed 核实：`ConversationMarkupManager.buildToolResultMessage(results)` 在 **2222 行**；critic 原建议的 :2214（窗口 2209–2219）是函数签名参数区，根本不含该符号——critic 建议错了 8 行。quality.json 与正文现用 :2222，正确，无需再改。
- **quality**：Q5 line :2142 evidence 单行与源码逐字节一致；Q7 line :1764 evidence 4 行与源码 1764–1767 逐字节一致（含缩进）✓
- **正文**：新引用 :1953/:2116/:2222/:2024/:2044/:2063/:1752/:1984/:2102/:2107/:1947/:1966/:1990 已到位；旧错位引用 :1712/:2072/:2192/:2011/:216/:700/:464/:1335/:939/:446/:1206 全部清除 ✓
- **lint**：单页隔离重跑，0 硬失败 / 0 警告 ✓
- **未通过条目：无**。本页达到收货标准，可进入发布队列。
- 复检过程未改动 facts/md/quality/status 文件，未动 review-queue.json。
