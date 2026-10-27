# Critic 复核报告：services-chatservice（聊天服务核心 Delegate 群）

- 复核对象：`review/batch-05/services-chatservice.{facts,quality,md,lint,status}.json/md`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：174 条 facts 全量机械校验（文件存在、行号不越界）+ 符号启发式 ±5 窗口检查 + 56 条 flagged 逐条人工读源码窗口核对；quality 15 条 evidence 逐字原文校验 + 6 条 warn 证据链复核；lint 独立复跑；正文结构与关键数字抽查

## 结论：打回修正

**facts：174 条中 118 条通过，53 条引用错位需重锚定，3 条为复合事实需拆分。**
**quality：15 条中 11 条通过；1 条硬问题（quality[11] 证据虚构）；2 条证据行轻微偏差（缺 `private` / 行号错位）。**
**正文 md：通过（结构齐全、符号英文原名、关键数字与源码一致、无禁用词）。status.json：正确。lint：独立复跑 0 硬失败 / 0 警告。**

---

## 一、硬问题（必须修）

### H1. quality[11] 证据虚构

- 位置：`services-chatservice.quality.json[11]`
- 现状：`evidence` 为 `private val DEFAULT_CHAT_KEY = "__DEFAULT_CHAT__"`，`file` 为 `TokenStatisticsDelegate.kt`，`line` 为 107。
- 实锤：全仓库 grep，`TokenStatisticsDelegate.kt` 中不存在该行；`DEFAULT_CHAT_KEY` 这个常量在该文件中根本不存在。
  该文件的真实代码是第 52 行：`private fun chatKey(chatId: String?): String = chatId ?: "__DEFAULT_CHAT__"`（函数默认值写法，非字段）。
- 影响：该条 finding 的 description（"setupCollectors 把全局服务流记在 __DEFAULT_CHAT__ 名下……可能重复记账"）建立在不存在的常量归因上，
  需按真实代码重写 evidence + description，或经核实后删除该条。confidence 0.55 的低置信不能作为虚构证据的借口。

---

## 二、轻微问题（引用错位：断言为真，anchor 不在 ±5 支撑窗口内）

说明：以下每条的断言内容经人工核对源码均为真，问题仅是 `ref` 行号锚点偏离。给出正确锚点（均为 `dbf71916` 下实测行号），修错时逐条重锚并自查 ±5 窗口。

### ApiConfigDelegate.kt
- [21] `:112` → `:266`（`effectiveContextLength = combine(…){ isMaxMode, normalLength, maxLength -> if (isMaxMode) maxLength else normalLength }`，263–269）
- [26] `:262` → `:316`（`functionalConfigManager.functionConfigMappingFlow.collect`，CHAT 映射变化更新 `_activeConfigId`）
- [27] `:287` → `:345`（`getModelConfigFlow(configId).collect` → `updateStateFromConfig(config)` + `_isInitialized=true`，343–351）
- [28] `:313` → `:377`（`updateStateFromConfig` 函数体，377–388）
- [29] `:330` → `:368`（`configScope.launch` 后台 `EnhancedAIService.getInstance`，`withContext(Dispatchers.Main){ onConfigChanged }`，365–372）
- [36] `:524` → `:585`（`persistApiSettings`：`updateModelConfig` 写库 → IO 建服务 → Main 回调 → `_isConfigured=true`，585–604）

### AttachmentDelegate.kt
- [50] `:290` → `:314`（`createTempFileFromUri`：`cleanOnExitDir()` 在 316，`.nomedia` 在 324）
- [51] `:340` → `:356`（标准包/技能包/MCP 包三集合检查，353–362）
- [55] `:560` → `:578`（`isPackageAttachmentError`，575–584）
- [63] `:765` → `:782`（`captureCurrentTime`：`time.txt` 在 787，`yyyy-MM-dd HH:mm:ss` 在 781）
- [64] `:795` → `:822`（`captureMemoryFolders`：`fileName = "memory_context.xml"` 在 825）
- [65] `:835` → `:858`（`buildMemoryContextXml` 内 `query_memory` + `folder_path` 英文指令，858–861）
- [67] `:255` → `:280`（`attachPastedText` 函数体，273–295）
- [59] `:600` → 复合，拆成两条：`capture_screenshot` 工具调用（`:618`）／`OCRUtils.recognizeText(quality = Quality.HIGH)`（`:642`）
- [53] `:370` → 复合，拆成三条：前缀常量 `PACKAGE_ATTACHMENT_PREFIX = "package_attach:"`（`:40`）／显示名 `"包: $packageName"`（`:456`）／`replaceAttachmentByPath`（`:97`）

### ChatDisplayWindowPaging.kt
- [9] `:78` → `:85`（反向扫描主循环 `while (cursor >= 0)`，85 起）
- [10] `:103` → `:95`（`senderOf(message) == "summary"` 即关页，94–97）
- [11] `:110` → `:102`（`triggerCountInCurrentPage >= safeTriggerMessagesPerPage` 关页，101–105）

### CurrentChatWindowController.kt
- [16] `:63` → `:69`（`messages.isEmpty()` 时四标志置 false，68–73）

### ChatHistoryDelegate.kt
- [72] `:150` → `:157`（`collectNewestDisplayPages`，`limit = DISPLAY_WINDOW_QUERY_BATCH_SIZE`，80 定义在 44）
- [77] `:492` → `:505`（`showLatestMessagesForCurrentChat`：无更新历史且内存非空直接 `return false`，503–507）
- [80] `:515` → `:552`（聊天不在数据库则清 `_currentChatId` + `clearCurrentChatHistoryInMemory()`，550–554；另见 566–570）
- [81] `:640` → 复合，拆成两条：开场白同步主逻辑（`:665` 起）／`provider = ""`、`modelName = ""` 留空标记（`:749`–`:750`）
- [82] `:655` → 复合，拆成两条：群组绑定跳过（`:669`–`:672`）／开场白清空删除旧消息（`:735`–`:738`）
- [86] `:1020` → `:1040`（`moveCurrentChatAwayBeforeDeletion`：先找接替聊天切换，找不到才建新，1039–1049）
- [87] `:960` → `:940`（`resolveDeletionReplacementTarget`：群组 ID > 角色卡名 > 活跃 prompt，938–955）
- [92] `:1240` → `:1253`（`bindChatToWorkspace`：先写库 `updateChatWorkspace` 再更新内存 `_chatHistories`，1252–1258）
- [94] `:1400` → `:1409`（`addMessageToChat`：`historyUpdateMutex.withLock` + 变体预览只更新内存，1408–1416）

### MessageCoordinationDelegate.kt
- [100] `:140` → `:130`（非致命错误收集器：`nonFatalErrorEvent.collect { showToast }`，130–135）
- [101] `:135` → `:122`（`pendingAutoContinuationByChatId = ConcurrentHashMap<…>()`，122–123）
- [103] `:380` → `:394`（`regenerateSingleAiMessage` 四重校验，394–400）
- [104] `:395` → `:443`（`regenerateAiMessageVariant` 变体预览→变体落库两步）
- [114] `:800` → `:1036`（`planResponseOrder` 经 `ROLE_RESPONSE_PLANNER` 取模型参数，1036–1047）
- [115] `:940` → 复合，拆成两条：首轮首成员用用户原文、其余空消息（`:955`–`:960`）／`awaitTurnComplete` 等回合计数器（`:992`）
- [116] `:1030` → `:1036`（`planResponseOrder` 函数签名；当前锚点落在 `PlannedRounds` 数据类上）
- [124] `:1790` → `:1798`（聊天已切换则跳过总结插入只打日志：`if (currentChatId != originalChatId) { … "Async summary skipped: chat switched …"; return@launch }`，1797–1802）
- [126] `:1930` → `:1985`（上一轮仍在跑则 `queuePendingAutoContinuation`，否则 `sendMessageInternal(isAutoContinuation=true)`，1975–1995）
- [132] `:230` → `:222`（`resolveRoleCardId`：显式覆盖 > 活跃卡（可选）> 会话绑定卡 > 全局活跃卡，217–232）

### MessageProcessingDelegate.kt
- [138] `:265` → `:182`（`reportNonFatalError`：空白丢弃、非空发 `_nonFatalErrorEvent`，180–186）
- [139] `:280` → `:266`（`isLoading` 为 true 时拒绝 Idle/Completed 终端态，266–276）
- [140] `:295` → `:278`（非 ExecutingTool/Summarizing 时 `ToolProgressBus.clear()`，278–282）
- [142] `:695` → `:711`（空消息直接忽略，711–716）
- [143] `:707` → `:719`（`chatRuntime.isLoading` 为 true 时忽略并打日志，719–724）
- [145] `:855` → 复合，拆成两条：绑定工作区时挂载 tool hook（`:852`–`:853`）／finally 中 `removeToolHook` 卸载（`:1549`–`:1551`）
- [146] `:755` → `:322`（`apiProviderType == OPENAI_CODEX && enableDirectImageProcessing`，321–323）
- [148] `:1039` → 复合，拆成两条：群组轮次 `"[From user]\n"` 前缀（`MessageProcessingDelegate.kt:1037`）／编排预建消息从历史末尾剥离防重复（`MessageCoordinationDelegate.kt:977`–`:979`，注释实锤）
- [150] `:1130` → `:1231`（`TextStreamRevisionTracker()` 处理修订事件）
- [153] `:1400` → `:1428`（`getCurrentInputTokenCount/getCurrentOutputTokenCount/getCurrentCachedInputTokenCount`，1428–1430）
- [154] `:1412` → `:411`（`waitDurationMs = firstResponseElapsed - requestStartElapsed` 首包等待；`outputDurationMs` 输出耗时，411–420）
- [156] `:1840` → `:1868`（`notifyTurnComplete`：`_turnCompleteCounterByChatId` 加一 + `calculateNextWindowSize`，1862–1873）

### ChatServiceCore.kt
- [170] `:224` → `:238`（`setBeforeDestructiveHistoryMutation` 取消总结+发送／`setAfterDestructiveHistoryMutation` 刷新稳定窗口，237–243）
- [172] `:161` → `:186`（`onTurnComplete`：`updateCumulativeStatistics` 记账 + `turnOptions.persistTurn` 决定 `saveCurrentChat`，186–198）
- [173] `:287` → `:277`（`cancelCurrentMessage`：先 `cancelSummary()` 再 `cancelMessage(chatId)`；注意 `:287` 是另一个函数 `cancelMessage(chatId)`，两者别混）

### quality 轻微
- quality[12]：`evidence` 应为 `private data class ChatRuntime(`（缺 `private`），`line` 200 → 203；且 evidence 与 description 主张（707 行"加载中忽略"）不匹配，建议换成 719 行附近的相关行或改写 description。
- quality[14]：`evidence` 应为 `private fun launchAsyncSummaryForSend(`（缺 `private`），`line` 1740 → 1754。

### 其他轻微
- `services-chatservice.lint.md` 第 9 行自指出现"通过/批准/LGTM"字样（在"无……"否定句中）。watcher 只扫描 Issue 评论正文，文件内无实际误触发风险；但为与 data-prefs-app 页口径一致，建议改写为"评审触发词"。

---

## 三、通过项（抽样说明）

- 118 条 facts：机械校验（文件存在、行号不越界）+ 符号启发式 ±5 窗口命中，全部通过；其中 [48]（`PACKAGE_ATTACHMENT_PREFIX` 前缀剥离）、[73]（`beforeTimestampExclusive` 收集循环）、[112]（手动发送清空附件三件套）为启发式漏报、人工复核窗口支撑有效，记为通过。
- quality 11 条通过：6 条 warn 证据链全部复核为真且分级无夸大——
  - [0] `chatRuntimes` 全文件无 `remove()`/`clear()`，只增不减属实；
  - [1] `handleTokenLimitExceeded` 在 1625 直接覆盖 `summaryJob`，之前无 cancel，旧 Job 引用丢失属实；
  - [2] 618 等 6 处协程内 `runBlocking` 属实；
  - [3] 10×100ms 等待、超时丢弃本次发送属实（有通用错误 toast，writer 已修正初版"无提示"误判）；
  - [4] `awaitTurnComplete` 默认 `180_000L`，992 处超时仅打日志跳过剩余成员属实；
  - [5] `_isConfigured` 默认 true（70 行），全文件只在 576/604 处置 true，无处置 false 路径，死开关属实。
  9 条 suggestion（含修正后的 [11] 除外）证据均为逐字原文。
- 正文：`#` 概述、`## AI 速览`、`## 核心机制`（7 节）、`## 关键符号`、`## 输入→处理→输出调用链`、`## 来源` 结构齐全；
  符号名均为英文原名；关键数字（80 条一批、10×100ms、180 秒超时）与源码一致；与 facts 无矛盾断言；禁用词 0（除 lint.md 自指一处）。
- `services-chatservice.status.json`：`issue` 为整数 77，`status` 为 `review-pending`，`source_repo` 为 `operit`，
  `source_commit` 为 `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，`refs_valid` 格式正确（数值待修错后更新）。
- `services-chatservice.lint.md`：lint.py 独立复跑确认 0 硬失败 / 0 警告。

---

## 四、修错要求

1. 先修 H1（quality[11]）：按 `TokenStatisticsDelegate.kt:52` 的真实代码重写 evidence + description，或删除该条并重编号。
2. 按"二"节逐条重锚定引用行号（均为实测行号），复合事实拆分后 facts 总数会增加，`refs_valid` 按实际填写。
3. 修 quality[12][14] 的 evidence 与行号。
4. 修完重跑 `scripts/lint.py`（单页隔离），更新 `.lint.md`，确认 0/0；5 文件 grep 确认无"通过/批准/LGTM"（含 lint.md 自指）。
5. `critic` 字段仍留空，待独立复验。

**结论：打回**（1 硬 + 53 引用错位 + 3 复合拆分 + 2 quality 轻微 + 1 lint.md 自指）。

---

## 复验（第二轮）——2026-10-01，结论：**通过** ✅

复验人：与首轮 critic、修错员完全独立的第二位 critic。源码 Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（git rev-parse 确认一致），未采信修错员自报，逐项亲自核源码。

### 1. quality[11] 删除成立 ✅
- `TokenStatisticsDelegate.kt` 全文件 grep：`DEFAULT_CHAT_KEY` **零命中**；真实代码第 52 行 `private fun chatKey(chatId: String?): String = chatId ?: "__DEFAULT_CHAT__"`（函数默认值，非字段）。
- `ChatServiceCore.kt:136` 链路：`bindChatService(chatId, EnhancedAIService.getChatInstance(context, chatId))`；`EnhancedAIService.getChatInstance` 取自 `CHAT_INSTANCES`（ConcurrentHashMap<String, EnhancedAIService>，按 chatId 一键一实例），与全局 `getInstance()` 是不同对象——原 finding 的"同一服务被多聊天共享致重复记账"机制在当前调用链下不成立，属无依据推测。删除正确。正文 md 中 `chatKey(chatId ?: "__DEFAULT_CHAT__")` 的两处表述均为真，无残留。

### 2. 53 条重锚 + 7 处拆分 ✅
- 60 个 critic 建议锚点在现 facts 中**全部存在**（脚本比对 60/60）。
- 7 处拆分逐个确认 ±5 窗口：[53]→:40/:456/:97（前缀常量/显示名/replaceAttachmentByPath）、[59]→:618/:642（capture_screenshot/OCR HIGH）、[81]→:665/:749（开场白同步/provider-modelName 留空）、[82]→:669/:735（群组跳过/开场白清空删旧）、[115]→:955/:992（首轮首成员原文/awaitTurnComplete）、[145]→:849/:1549（挂载 hook/finally 卸载）、[148]→:1037/:977（[From user] 前缀/历史剥离防重复）。:849 的 ±5 窗口（844–854）覆盖 `createWorkspaceToolHookSession`(846) 与 `toolHandler.addToolHook(session)`(853)。
- 简单重锚抽样 15 条（[21]:266、[26]:316、[27]:345、[50]:314、[72]系、[80]:505、[100]系、[138]系等）全部支撑原文。

### 3. 修错员自加扫 17 条重锚 ✅（抽样 8 条全部验真）
:54（takeLast.flatten）、:383（locator 预览算页区间）、:441（2 页保留最旧 1 页）、:842（withTimeoutOrNull(500) 等 DB Flow）、:1240（条件 updateChatTokenCounts）、:352（10×100ms 等待建对话）、:1334（awaitTurnComplete 超时取消）、:111（全局服务流记 `chatKey(null)`）。均有 ±5 窗口支撑。

### 4. quality 14 条 evidence ✅
- 14/14 evidence 首行在标注行号**精确逐字命中**（脚本 14/14）；[11]/[13] 多行块去缩进后逐字一致。
- [11]（was[12]）：evidence `private data class ChatRuntime(` :203；description 称 719 行"加载中忽略"——719–721 行为 `if (chatRuntime.isLoading.value) { AppLogger.w(… "sendUserMessage忽略: chat正在处理中" …) return }`，属实。
- [13]（was[14]）：evidence `private fun launchAsyncSummaryForSend(` :1754；description 称 1790 行跳过总结——1797–1803 `if (currentChatId != originalChatId) { AppLogger.d("Async summary skipped…"); return@launch }` 属实；716 行 `tokenUsageThresholdForSend += 0.5` 阈值放宽在先、跳过后不回滚，属实。
- 另 5 处行号漂移修正（[3]:349、[7]:464、[8]:694、[9]:12、[12]:186）均已逐字验真。6 warn / 8 suggestion / 高危 0，分级无夸大。

### 5. 复验发现并当场合并的 1 处重复（已处理）
- facts[38] 与 facts[53] 为同一断言重复（均为 `PACKAGE_ATTACHMENT_PREFIX = "package_attach:"`，AttachmentDelegate.kt:40）——修错员拆分 [53] 时与原有 [38] 撞车。已删除 [38]（保留措辞更优的 [53]），facts **182→181 条**；正文 md 不引用 fact 索引，无需同步。合并后重跑：181/181 引用行号在界、0 坏引用、0 精确重复；status.json `refs_valid` 已同步为 181/181；lint.md 已追加合并记录。

### 6. 全量复查 ✅
- facts 181/181 程序化校验（文件存在/行号不越界/仅 fact+ref 双键）；随机抽样 15 条未修复 facts 全部窗口支撑。
- 5 文件全文 grep"通过/批准/LGTM"**零命中**；正文结构六段齐全、符号英文原名、无模糊词。
- status.json：`issue: 77`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916…` 全部正确。
- lint 单页隔离独立重跑：**硬失败 0 / 警告 0**。

**结论：通过。修错合格，可随整批上评审站。**
