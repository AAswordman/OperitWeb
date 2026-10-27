# Critic 复核报告：api-chat-enhance（对话增强管线）

- 复核人：独立 critic（与 writer 无关）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 `git rev-parse` 确认 HEAD 一致）
- 复核日期：2026-10-01
- **结论：退回修正**（见 §A，81 条 facts 引用错位/复合需修；quality 5 条结论全真但 4 处 evidence 行号/缩进小问题；正文 2 处小问题）

## 总览

| 项 | 结果 |
|---|---|
| facts 总数 | 126 |
| facts 通过 | 45（引用落在断言证据 ±5 窗口内） |
| facts 需修正 | 81（引用错位 54 + 复合事实需拆分 27，见对照表） |
| facts 虚构断言 | 0（逐条核过源码，所有断言本身为真，问题纯粹是引用锚点错位） |
| quality 通过 | 5/5 结论全真；high 级 deny_tool 实锤确认属实 |
| quality evidence 小问题 | 4 处（行号差 1/缩进不符/证据未覆盖放行段） |
| 正文 §9 结构 | 通过；2 处小问题（§8 擦边 1 处、符号表行号错 1 处） |
| lint | 0 硬失败 / 0 警告 |
| .status.json | 通过（id/issue=56/status=review-pending/source_commit/source_repo 均正确） |

**核心定性**：writer 的断言内容全部经得起源码验证，没有编造；但存在系统性引用错位——大量 ref 指向函数签名/KDoc/类声明行（甚至完全错误的函数），而断言描述的是函数体内的行为，落在 ±5 窗口之外。另有 27 处复合事实（一行 ref 撑不起两个以上断言）。修错是机械性重锚定 + 拆分，不需要重写断言。

---

## A. facts 核查（81 条需修正）

图例：`事实i 原ref → 建议ref`；"拆分"表示一个断言含多个证据点，需拆成多条单事实。

### ConversationMarkupManager.kt
- 事实4 `:48 → :55`：断言（splitImageLinksForModel→createBoundedToolResultXml→失败拼错误载荷）在函数体 55–75；`:48` 是 KDoc 行，窗口 43–53 不含证据。
- 事实5 `:83 → 拆分`：`:91`（无图片链接原样返回，窗口 86–96）；`:96`（图片 id 转 `<link type="image">` 行 + "Image attached as multimodal input." 提示在 95–99，窗口 91–101）。
- 事实6 `:101 → :110`：`buildToolResultMessage` 在 110，KDoc（限长说明 106–109）+ 空列表返回 111–112；`:101` 窗口 96–106 不含函数。
- 事实7 `:117 → :129`：`R.string.conversation_markup_multiple_tools_warning` 实际在 129。
- 事实8 `:128 → :141`：默认文案 `"The tool \`$toolName\` is not available."` 实际在 141。
- 事实9 `:137 → :147`：`createToolResultXml` 在 146，`generateRandomToolResultTagName()` 在 147。
- 事实10 `:142 → :162`：载荷预算 `(MAX… - emptyXml.length).coerceAtLeast(0)` 在 162–164，`truncatePayload` 在 165。
- 事实11 `:166 → :173`：`truncatePayload` 函数定义在 173（断言逐行对应 174–185）。
- 事实12 `:180 → :203`：`appendImageLinksWithinResultLimit` 在 188；剩余预算计算 196–199、单行超预算跳过（`return@forEach`）在 207–209；`:203` 窗口 198–208 覆盖。

### ConversationRoundManager.kt
- 事实15 `:40 → 拆分`：`updateContent` 用 `:42`（窗口 37–47 覆盖 43–44 的 replace）；`appendChunk` 用 `:49`（窗口 44–54 覆盖 50–51 的 append）。
- 事实16 `:53 → :59`：`incrementAndGet()` 与 `roundContents[newRound] = SmartString()` 在 59–60。
- 事实17 `:62 → :72`：`appendContent` 函数在 72（`appendChunk("\n" + content.trim())` 在 73）。
- 事实18 `:71 → 拆分`：升序拼接用 `:86`（窗口 81–91 覆盖 86–89）；key -1 追加用 `:94`（窗口 89–99 覆盖 93–96）。
- 事实19 `:97 → :119`：`ROUND_SEPARATOR_FORMAT` 插入在 119。
- 事实20 `:92 → :99`：`getCurrentRoundContent` 在 99–100。
- 事实21 `:118 → :136`：`getCurrentRound` 在 136–137。
- 事实22 `:124 → :141`：`clearContent` 在 141–143。

### ConversationService.kt
- 事实29 `:134 → :126`：`buildSummarySystemPrompt(previousSummary, useEnglish, summaryConfig)` 调用在 126–130。
- 事实30 `:143 → :131`：两层清洗 `stripGeminiThoughtSignatureMetaTurns`→`stripOpenAiResponsesProtocolMarkupTurns` 在 131–133。
- 事实31 `:148 → :140`：`getModelParametersForFunction(SUMMARY)` 在 137，`getServiceForFunction(SUMMARY)` 在 140。
- 事实32 `:163 → :150`：`dispatchSummaryGenerateHooks` + `stage = "before_prepare_summary_prompt"` 在 150–152。
- 事实33 `:185 → :177`：`stage = "before_send_to_model"` 在 177。
- 事实34 `:302 → 拆分`：`after_generate_summary` 派发用 `:302`；`summaryResult` 覆盖（`summaryContent = afterGenerateContext.summaryResult ?: summaryContent` 在 320）用 `:320`。
- 事实35 `:215 → :209`：`ToolProgressBus.SUMMARY_PROGRESS_TOOL_NAME` + `0.05f` 在 209–210。
- 事实36 `:240 → 拆分`：6 个阶段值在 223–248（0.20/0.40/0.55/0.70/0.85/0.95），一行 ref 盖不住；建议拆 3 条：`:223`（0.20/0.40）、`:233`（0.55/0.70）、`:243`（0.85/0.95）。
- 事实37 `:292 → :286`：`ToolProgressBus.update(SUMMARY_PROGRESS_TOOL_NAME, 1f, …completed)` 在 285–289；`:292` 窗口 287–297 不含调用名，证据链不完整。
- 事实39 `:318 → :324`：固定文案 `return "Conversation Summary: Unable to generate valid summary."` 在 324。
- 事实40 `:324 → :330`：`catch (e: Exception) { AppLogger.e(…); throw e }` 在 330–334。
- 事实43 `:383 → 拆分`：首个非空行用 `:386`（386–389）；去 markdown 符号/控制字符/引号标点/截断 40 用 `:394`（窗口 389–399 覆盖 392–399）。
- 事实44 `:404 → :408`：三段 `listOf(SYSTEM)+chatHistory+USER` 在 408–413。
- 事实45 `:414 → 拆分`：12 个 map key 在 421–432；建议 `:421`（id/name/apiName/description/defaultValue/currentValue）与 `:427`（isEnabled/valueType/minValue/maxValue/category/isCustom）。
- 事实46 `:451 → :477`：`dispatchHistoryHooks(PromptHookContext(stage = "before_prepare_history"…))` 在 475–477，窗口 472–482 覆盖。
- 事实49 `:560 → :579`：`toolVisibility = roleCardToolAccess.effectiveBuiltinToolVisibility` 与 allowed 包/技能/MCP 列表在 579–582。
- 事实50 `:604 → 拆分`：前三段（avatarMoodRulesText/systemPrompt/assistant_role）用 `:605`；waifuRulesText + user_profile（612–617）用 `:612`。
- 事实51 `:1062 → :1069`：`replace("{{user}}",…)` 与 `replace("{{char}}",…)` 在 1069–1070。
- 事实56 `:691 → :700`：`toolName.equals(APPLY_FILE_TOOL_NAME)` 判断在 700，`extractApplyFileRequestContent(body)` 在 704–705。
- 事实59 `:753 → 拆分`：think/status 分支用 `:754`（窗口 749–759）；tool_result/tool 分支用 `:768`（窗口 763–773）；text（else→ASSISTANT，778–780）用 `:778`。
- 事实60 `:785 → 拆分`：连续同角色合并用 `:785`；`TOOL_CALL/TOOL_RESULT` 排除（`!in setOf(…)` 在 793–794）用 `:793`。
- 事实61 `:939 → :946`：`is Double` 分支（无小数转 Int）在 946–949。
- 事实63 `:843 → 拆分`：可点击视为原子单元用 `:851`；id/desc/class/bounds 收集用 `:868`（窗口 863–873）；不可点击只收文本 + `distinct()` 去重用 `:883`（窗口 878–888）。
- 事实66 `:1044 → :1047`：完整条件（VOICE 检查 1046–1048 + `isVoiceCallAvatarEnabled && currentAvatar != null` 在 1052）在窗口 1042–1052 内。
- 事实67 `:1084 → :1095`：`else -> …conversation_language_chinese`（默认中文）在 ~1097，窗口 1090–1100 覆盖。
- 事实68 `:1105 → :1116`：`getServiceForFunction(FunctionType.TRANSLATION)` 在 1116。
- 事实69 `:1145 → 拆分`：空列表返回空串用 `:1151`；生成结果空白返回空串（`return if (result.isBlank()) { "" }` 在 1194）用 `:1194`。
- 事实70 `:1212 → 拆分`：`ImagePoolManager.addImage` + `"Failed to load image"`（1222–1224）用 `:1222`；`removeImage` 清理（1248）用 `:1248`。
- 事实71 `:1257 → :1267`：mime 推断 + `?: "audio/*"` + `addMedia` 在 1266–1270。
- 事实72 `:1300 → 拆分`：mime 兜底 `video/*`（1309–1313）用 `:1310`；`removeMedia`（1335）用 `:1335`。

### FileBindingService.kt
- 事实73 `:64 → :74`：拒绝覆写的 `if (originalContent.isNotEmpty() && !aiGeneratedCode.contains("[START-"))` 在 74–80。
- 事实74 `:78 → :86`：`applyFuzzyPatch` 调用（86）+ 成功后 `generateDiff`（90–91）在窗口 81–91 内。
- 事实75 `:99 → :103`：无结构块默认整文件替换（102–107）在窗口 98–108 内。
- 事实76 `:105 → 拆分`：空操作列表报错（115–117）用 `:115`；old/new blank 过滤（120–125）用 `:121`。
- 事实77 `:140 → 拆分`：`Changes: +N -M lines` 统计（~181）用 `:181`；hunk 行号前缀（`-行号|` 210、`+行号|` 216、空格 219）用 `:210`。
- 事实81 `:311 → :348`：`prefix`/`suffix` 保留（348–349）与中间替换（353–359）在窗口 343–353 内。
- 事实84 `:452 → 拆分`：3-gram Jaccard（`buildNgrams` 默认 n=3 在 686，`ngramSimilarity` 在 691–696）用 `:691`；窗口容差 `(numOldLines * 0.2).toInt() + 2`（494）用 `:494`；并行滑动窗口搜索部分需修错员定位后另给 ref。
- 事实87 `:704 → :711`：`indexOf` 计数循环 + `count > 1 → true`（711–716）在窗口 706–716 内。

### InputProcessor.kt
- 事实88 `:18 → 拆分`：`before_process` 派发用 `:30`；`after_process` 派发 + 三层回退（`beforeContext.processedInput ?: beforeContext.rawInput ?: input` 在 38，`afterContext.processedInput ?: processedInput` 在 46）用 `:42`（窗口 37–47 全覆盖）。

### MultiServiceManager.kt
- 事实92 `:137 → :129`：`serviceInstances[functionType]?.let { return it }` 缓存命中在 129–131。
- 事实93 `:153 → :143`：`if (functionType == FunctionType.CHAT) { defaultService = managedService }` 在 143–145（原 ref 指向了另一个函数的身体）。
- 事实94 `:142 → :152`：`coerceAtLeast(0)` + `cacheKey = "$configId#$normalizedIndex"` 在 152–153。
- 事实95 `:90 → 拆分`：`activeLeases += 1`（100）用 `:100`；`releaseLease` 内减一（261–263）用 `:262`。
- 事实96 `:216 → :225`：`serviceInstances.remove(functionType)?.let { retireManagedServiceLocked(it) }` 在 225。
- 事实97 `:232 → :250`：`refreshAllServices` 的清空缓存 + `closeManagedServiceLocked(service, cancelStreaming = true)`（250–255）在窗口 245–255 内（原 ref 指向了 `refreshServiceForFunction` 的身体）。
- 事实98 `:254 → :274`：`closeRetiredServiceLocked`（`if (retired && activeLeases == 0)`）在 274–276（原 ref 指向了 `refreshAllServices` 的身体）。
- 事实101 `:324 → 拆分`：两项为 0 返回裸服务用 `:325`；`RateLimiterRegistry.getOrCreate(key = config.id)` 用 `:331`；`RequestConcurrencyRegistry` + `RateLimitedAIService` 包装用 `:340`。
- 事实103 `:176 → 拆分`：遍历 serviceInstances/customServiceInstances/retiredServices/defaultService（179–185）用 `:181`；单个失败 catch 记日志（188–190）用 `:188`。

### ReferenceManager.kt
- 事实108 `:12 → :18`：Markdown 链接正则（18）+ `AiReference(title, url)`（21–23）在窗口 13–23 内。

### ToolExecutionManager.kt（本文件引用错位最严重，多处 ref 指向了完全错误的函数）
- 事实109 `:57 → :63`：`ensureOwnLine` 函数体（前后补 `"\n"` 在 64–65）在窗口 58–68 内；KDoc（57–62）本身也支持"独占一行"，但"前后补换行"是函数体证据。
- 事实110 `:63 → :68`：`resolveToolTarget` 在 67，`package_proxy`/`PROXY_TOOL_NAME` 判断 + `tool_name` 参数解析在 68–76。
- 事实111 `:83 → :94`：`isJsPackageTool` 在 94–99（`split(':')` + `jsPackageNames.contains(packageName)`）。
- 事实112 `:108 → :119`：`injectPackageCallContext` 在 119，三个 `addPackageContextParamIfMissing`（callerName/chatId/cardId）在 131–133；"已有的不覆盖"由 `addPackageContextParamIfMissing` 内的 `params.any { it.name == name }`（113）保证——建议拆成两条或 ref 取 `:119` 并复验窗口。
- 事实113 `:125 → :149`：`isInvocationAllowedForRoleCard` 在 149；搜索工具恒允许（156）、proxy 按解析目标（158–160）、use_package 查包来源（162–168）、package_proxy（170+）、包名:工具名查外部来源、其余查内置工具——多分支复合，建议按分支拆分，首锚 `:149`。
- 事实114 `:170 → 拆分`：CLI 模式非公开工具被拒（219–224）用 `:219`；FULL 模式 CLI 公开工具提示不可用（227–230）用 `:227`（或合并取 `:224`，窗口 219–229 覆盖两处 `when` 分支入口）。
- 事实115 `:232 → :287`：`resolveProxyParameters` 的 params JSON 逐键转 `ToolParameter`（null→"null" 字符串）在 287–296（原 ref 在 `buildToolExposureDeniedResult` 尾部，完全错位；注意事实117 的原窗口恰好是这段代码，两处 ref 疑似写串）。
- 事实116 `:261 → :310`：`extractToolInvocations` 的 `StreamXmlPlugin` 切分（310–311）+ `toolCallPattern`（321）+ `toolParamPattern`（325）在窗口 305–315/321–325 内；建议 `:310` 并复验（或拆两条）。
- 事实117 `:292 → :357`：`unescapeXml` 在 357–370（CDATA 剥离 + 转义还原）。
- 事实118 `:308 → :388`：`executeToolSafely` 在 388；参数校验失败返回（394–403）+ `catch` 转 ToolResult 并 `notifyToolExecutionError`（406–409）在窗口 383–393/406–409 内，建议 `:388` 并复验（或拆两条）。
- 事实119 `:429 → 拆分`：CLI 公开工具（SEARCH/PROXY_TOOL_NAME）自动放行（445–454）用 `:448`；`deny_tool` 跳过权限检查直接放行（`granted = true, reason = "Permission check bypassed by deny_tool tag."` 在 486–492）用 `:490`。复合事实必须拆。
- 事实120 `:384 → 重写`：原 ref 指向 `executeToolSafely` 的 KDoc，完全错误。`executeInvocations` 在 504；总装配各阶段：暴露模式拦截（542–549）、角色卡拦截（551+）、Hook/权限、并行串行分组（620+）、执行聚合——建议按阶段拆 4–5 条单事实，首锚 `:542`。
- 事实123 `:668 → :678`：`withContext(toolRuntimeContextThreadLocal.asContextElement(runtimeContext))` 在 678；取不到执行器 → `buildToolNotAvailableErrorMessage` 在 680–684。
- 事实124 `:710 → 拆分`：空结果集固定错误（717–723）用 `:717`；换行拼接 + `success = lastResult.success`（725–731）用 `:726`。
- 事实125 `:739 → 拆分`：点号写法分支（746–748）用 `:746`；冒号分支（包不存在/建议型工具/包未激活）与裸包名分支（`use_package` 提示）需修错员定位后分别给 ref。

### 通过的 45 条（引用有效，无需改动）
0, 1, 2, 3, 13, 14, 23, 24, 25, 26, 27, 28, 38, 41, 42, 47, 48, 52, 53, 54, 55, 57, 58, 62, 64, 65, 78, 79, 80, 82, 83, 85, 86, 89, 90, 91, 99, 100, 102, 104, 105, 106, 107, 121, 122。

---

## B. quality.json 核查（5 条）

**结论：5 条发现全部属实，无虚构；severity/置信度合理。但 evidence 有 4 处行号/文本小问题需随修错一起修正。**

### B-0 [high] "调用原文含 deny_tool 即跳过权限弹窗" —— 实锤确认
- 证据链（已逐行验证）：`ToolExecutionManager.kt:457–458` 注释写着"检查是否强制拒绝权限（deny_tool标记）"，但代码实际是 `val hasPromptForPermission = !invocation.rawText.contains("deny_tool")`；当原文含 `deny_tool` 时跳过整个权限弹窗段，落到 486–492 直接 `notifyToolPermissionChecked(permissionTool, granted = true, reason = "Permission check bypassed by deny_tool tag.")` 并 `return Pair(true, null)`。**注释声称"强制拒绝"，行为却是"跳过检查直接放行"，名实相反**；且 `deny_tool` 来自 AI 生成的调用原文（`invocation.rawText`），模型可自行决定是否弹窗。high 评级成立，与 Day 1 core-tools 的发现相互印证。
- evidence 小问题：当前 evidence 只覆盖到 457–466（条件与检查入口），**未包含 486–492 的放行段**；建议 evidence 追加放行段原文，或 line 改为 486 并附对应 evidence。

### B-1 [warning] "字符串参数回退只处理三种工具类型" —— 属实
- `ConversationService.kt:958–964` 的 `is String` 分支 `when (type)` 只有 press_key/set_input_text/start_app 三个分支，其余类型静默得零参数。warning 合理。
- evidence 小问题：`line` 标 959，实际 `is String -> {` 在 **958**；evidence 文本本身与 958–964 逐字一致。把 line 改为 958 即可。

### B-2 [warning] "仅多个完美匹配会中止，近似多匹配静默打到最早行" —— 属实
- `FileBindingService.kt:280–283` 只在 `hasMultiplePerfectMatches`（去空白后子串出现 >1 次）时中止；模糊匹配只取 `bestMatchScore > 0.9` 的最佳者（666），两个 0.95 的近似匹配不会触发中止。medium 置信度恰当。evidence 与源码逐字一致。

### B-3 [suggestion] "roundSeparatorPattern 声明后未使用" —— 属实
- 全文件 `grep` 仅 26 行一处（声明），确属死代码。high 置信度恰当。
- evidence 小问题：`line` 标 26 但 evidence 包含了 25 行的注释 `// Pattern used to remove round separators from displayed content`；改为 line: 25 或 evidence 去掉注释行。

### B-4 [suggestion] "EDIT_BLOCK_REGEX 与 PARALLEL_MIN_ITERATIONS 声明后未使用" —— 属实
- 全文件 `grep` 仅声明处（15/19 行）有引用，`parseEditOperations` 确为手写逐行解析（392+）。high 置信度恰当。
- evidence 小问题：evidence 首行缩进为 4 空格（`    companion object {`），源码实际为 8 空格（`        private val EDIT_BLOCK_REGEX`）；evidence 须与源码逐字一致，请按实际缩进修正（或以 15 行为准重截）。

---

## C. 正文 api-chat-enhance.md 核查

**§9 双受众结构：通过。** 概述（第 8–10 行）/ AI 速览（12–18：核心符号清单 + 主入口 + 数据流向一句话）/ 核心机制（20–72，7 节）/ 关键符号（74–92，符号表）/ 调用链（94–112，三条"输入→处理→输出"三段式）/ 来源（114–118）齐全；术语首现基本有解释（如"保序发布""模糊补丁"结合上下文可理解）；符号名均为英文原文；来源精确到文件与行。

**2 处问题：**
1. **§8 擦边**：第 40 行"调用原文含 `deny_tool` 时跳过权限检查直接放行**（见代码走查 high 项）**"——quality 内容进了正文，违反 SCHEMA §8（quality 只进 `.quality.json` 与「代码走查」页）。建议删去括号内半句，保留事实本身（deny_tool 放行是事实，facts 119 已覆盖）。
2. **符号表行号错**：关键符号表中 `executeInvocations | ToolExecutionManager.kt:384` 应为 **:504**（:384 是 `executeToolSafely` 的 KDoc）。`checkToolPermission | ToolExecutionManager.kt:429` 为函数签名行，作为位置指针可接受（建议与 facts 拆分后的 ref 对齐）。

**已核对为真的正文数据点**：9 个文件 / 3763 行（`wc -l` 求和 3763，✓）；12 个并行白名单工具（与 621–625 一致，✓）；6 个总结进度阶段值（223–248，✓）。

---

## D. .status.json 核查

**通过**：`id=api-chat-enhance`、`issue=56`、`status=review-pending`、`source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（与钉死版本一致）、`source_repo=Operit` 全部正确。`critic` 字段为空，符合"critic 不直接改源文件"的约束（本报告为独立 `.critic.md`）。

---

## 修错指引（给修错员）

1. 按 §A 对照表逐条改 `ref`；标"拆分"的先拆成多条单事实再各自锚定，拆分后 facts 总数会增加（属正常）。
2. 每个新 ref 用 `sed -n` 复验 ±5 窗口完全支撑断言；重点复验 §A 中标注"需复验"的条目（46、84、112、113、116、118、125）。
3. quality.json：B-0 evidence 追加 486–492 放行段；B-1 line→958；B-3 line→25（或去注释行）；B-4 按 8 空格实际缩进重截 evidence。
4. 正文：删第 40 行"（见代码走查 high 项）"；符号表 `executeInvocations` 改为 `:504`。
5. 全部改完后重跑 `lint.py`，确认 0 硬失败 / 0 警告，然后交回 critic 复验。
6. 不动 `.status.json` 与 `review-queue.json`。

## 复检（2026-10-01 14:05 CST，修错后复验）

**结论：退回修正**——修错员完成了 54 条重锚 + 27 处拆分中的绝大部分，程序化全量校验 168/168 通过（文件存在/行号不越界/反引号符号落 ±5 窗口），但人工逐条核验发现 **3 条事实引用仍违反引用铁律**（断言的证据点落在 ±5 窗口外）+ quality B-4 有 1 处行号字段残留问题。修错员在几处直接采用了 critic 的"单 ref"建议而未做"（或拆两条）"的复验，导致复合断言的后半部分无窗口支撑。

### 未通过条目（必须修正）

1. **Fact 148（`ToolExecutionManager.kt:310`）**：断言"extractToolInvocations 用 StreamXmlPlugin 切分字符流，再按 toolCallPattern 与 toolParamPattern 提取工具名、参数与原文位置"。窗口 305–315 只含 StreamXmlPlugin（310–311）；`toolCallPattern` 在 321 行、`toolParamPattern` 在 326 行，均在窗口外。读者按 ref 无法验证"按哪两个 pattern 提取"的断言。**必须拆成两条**：(a) StreamXmlPlugin 切分 → `:310`；(b) 按 toolCallPattern/toolParamPattern 提取 → `:321`（窗口 316–326 同时覆盖 321 与 326）。

2. **Fact 150（`ToolExecutionManager.kt:388`）**：断言"executeToolSafely：参数校验失败直接返回失败结果；执行异常被 catch 转为 ToolResult 并通知 toolHandler"。窗口 383–393 只覆盖到 `validateParameters`（393）；`if (!valid)` 返回在 394–405（部分出窗），`catch`（407）与 `notifyToolExecutionError`（409）完全在窗口外。**必须拆成两条**：(a) 参数校验失败返回 → `:394`；（b) catch 转 ToolResult 并通知 → `:407`。

3. **Fact 149（`ToolExecutionManager.kt:357`，轻微）**：断言"unescapeXml 剥离 CDATA 包裹并还原 XML 转义字符"。窗口 352–362 覆盖 CDATA 剥离（360–362），但"还原 XML 转义字符"的 `.replace("&lt;")…` 链在 374–378，窗口外。建议拆成两条或后半条重锚 `:374`。

4. **Quality B-4**：修错员"未改"的判断**基本正确**——我用 diff 逐字比对，evidence 文本与源码 13–20 行**完全一致**（4 空格 `companion object {` 对应 13 行，8 空格成员对应 14–19 行），critic 原注记（"首行应为 8 空格"）有误。但仍有 1 处残留：`line` 字段为 15，而 evidence 实际起始于 13 行。请把 `line` 改为 13。

### 通过的抽查项（31 条）

- 重灾区：[115]:287（params 逐键转 ToolParameter，null→"null" 在 291）✓；[117]:357（CDATA 部分）✓；[112] 拆分（:131 三个 addPackageContextParamIfMissing / :113 不覆盖逻辑）✓；[113] 拆分（:156 搜索恒允许 / :159 proxy 按解析目标 / :163 use_package 查包来源）✓；[120] 五阶段拆分（:542/:551/:570/:620/:632，各阶段注释与代码均在窗内）✓；[125] 五分支拆分（:746/:752/:768/:777/:785 全对）✓；[84] 拆分（:691 3-gram / :502 并行滑动窗口 / :494 容差公式）✓。
- 抽查重锚：事实4（:55）、10（:147）、11（:162）、46（:330 catch/throw）、51（:408 三段结构）、54（:477）、114（:129 缓存命中）、119（:225）、120（:250）、151（:448 CLI 放行）、152（:490 deny_tool 放行段）全部窗口完全支撑 ✓。
- Quality：B-0 evidence 已追加 486–492 放行段（含 `granted = true, reason = "Permission check bypassed by deny_tool tag."`）✓；B-1 line→958 ✓；B-3 line→25 ✓。
- 正文 2 处：已删"（见代码走查 high 项）"✓；符号表 executeInvocations→:504 ✓。
- lint：0 硬失败 / 0 警告（修错员报告，我未重跑全批）。

### 边界注记（非阻塞，供修错员酌情）

- Fact 143（:170）："按解析目标名判定"（179 行）在窗口 165–175 外 4 行，属轻微。
- Fact 156（:620）：`.partition`（626 行）在窗口外 1 行，但"按并行/串行分组"注释（620）与白名单（621–625）在窗内，可接受。
- Fact 157（:632）："串行工具顺序执行"（647–648）在窗口外；并行 async 部分（634–635）在窗内。可接受，或拆分更严。

### 给修错员的修正清单

1. Fact 148 按上述拆成两条（:310 / :321）。
2. Fact 150 按上述拆成两条（:394 / :407）。
3. Fact 149 拆分或后半重锚 :374。
4. Quality B-4 的 `line: 15` → `13`（evidence 文本不动）。
5. 修正后重跑单页 lint，通知 critic 做二次复检（只需复检这 4 项）。

## 复检2（2026-10-01 14:05 CST，针对复检退回 4 项的二次复检）——**通过**

复检人：独立 critic（与修错员无关）。只复检这 4 项，未重走全文；未改动 facts/md/quality/status 文件，未动 review-queue.json。

### 1. fact 148 拆分 ✓
- 现 idx148 `ToolExecutionManager.kt:310`：「extractToolInvocations 用 StreamXmlPlugin 把字符流按 XML 块切分（splitBy(plugins) 收集）」。sed 核实窗口 305–315 含 `val plugins = listOf(StreamXmlPlugin())`（311）与 `charStream.splitBy(plugins).collect`（313）——完全支撑。
- 现 idx149 `:321`：「切分出的 XML 块按 ChatMarkupRegex.toolCallPattern 提取工具名与原文位置，参数体按 MessageContentParser.toolParamPattern 提取参数名与参数值」。窗口 316–326 同时覆盖 `ChatMarkupRegex.toolCallPattern.findAll`（321）与 `MessageContentParser.toolParamPattern.findAll`（326）——完全支撑。

### 2. fact 150 拆分 ✓
- 现 idx152 `:394`：「executeToolSafely：参数校验失败（!validationResult.valid）直接返回失败的 ToolResult（含 Invalid parameters 错误信息）」。窗口 389–399 含 `validateParameters`（393）、`if (!validationResult.valid)`（394）及失败 ToolResult 发射——完全支撑。
- 现 idx153 `:407`：「executeToolSafely：执行异常被 .catch 捕获，转为失败的 ToolResult，并调用 toolHandler.notifyToolExecutionError 通知」。窗口 402–412 含 `.catch { e ->`（407）、`toolHandler?.notifyToolExecutionError(invocation.tool, e)`（409）、`ToolResult(`（411）——完全支撑。

### 3. fact 149 拆分 ✓
- 现 idx150 `:360`：「unescapeXml 剥离 CDATA 包裹标记（首尾 <![CDATA[ 与 ]]>）」。窗口 355–365 含 `unescapeXml` 定义（358）、CDATA 注释（360）、startsWith/endsWith 判断（361–362）——完全支撑。
- 现 idx151 `:374`：「unescapeXml 用 .replace 链还原 &lt;/&gt;/&amp;/&quot;/&apos; 五种 XML 转义字符」。窗口 369–379 含 374–378 的五连 `.replace` 链——完全支撑。

### 4. quality B-4 ✓
- `line` 字段已改为 **13**（evidence 起始行正确）；evidence 8 行与源码 `FileBindingService.kt` 13–20 行逐行字节一致（唯一差异为末尾换行符缺失，不影响逐字一致性判定）。

### 结论
**未通过条目：无。4 项全部闭环，facts 171 条，本页已达收货标准，可进入发布队列。**
