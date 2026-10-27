# Critic 复核报告：core-chat-runtime（聊天运行时：消息管理/Hook/插件）

- 复核人：独立 critic（与 writer 无关）
- 复核日期：2026-10-01
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已 `git rev-parse HEAD` 核对一致）
- 核验方法：98 条 facts 全部逐条人工核对源码（脚本先筛 ±5 窗口/反引号符号，误报与命中逐条肉眼确认）；quality.json 5 条 evidence 逐字比对源码；正文结构与引用抽查；status.json 字段核对。

## 结论：退回修正

facts.json 中 **63 条通过，35 条需修正**（含 2 对完全重复条目、14 条复合事实、16 条引用行号错位、1 条表述撑不起）。所有被退回条目的**断言本身为真、无虚构**，问题是引用错位或一条 fact 塞了多个事实，违反引用铁律（±5 行、禁止复合事实）。quality.json 5/5 通过。正文通过（2 处次要问题）。status.json 正确。

修正后 facts 预计由 98 条变为 112 条（去重 −2，拆分 +16）。

---

## 一、facts.json（98 条）

### 1.1 通过（63 条）

以下条目断言为真且引用在 ±5 行内完整支撑：0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 20, 23, 24, 26, 28, 29, 30, 31, 32, 33, 34, 35, 37, 39, 41, 42, 43, 45, 47, 48, 49, 50, 54, 55, 56, 57, 58, 59, 60, 61, 62, 65, 69, 71, 76, 78, 80, 81, 82, 83, 87, 88, 91, 92, 94, 95, 96, 97。

其中脚本曾误报 14 条（多行函数签名、跨行链式调用等），人工确认实质支撑完整，按通过计。

### 1.2 退回修正（35 条）

#### A. 引用行号错位（16 条）：只改 ref 行号，断言不动

| # | 现 ref | 问题 | 建议 ref |
|---|---|---|---|
| 11 | `:49` | "记到日志"的 `AppLogger.d` 实际在 56 行，出窗口 | `:56` |
| 15 | `:168` | 窗口 163–173 未覆盖 replyToMessage 非空检查(167)、截断 100 字符(172)、`<reply_to>` 构造(174) | `:172`（窗口 167–177 全覆盖） |
| 18 | `:234` | 窗口 229–239 未覆盖 245 行的实际 `<attachment>` 标签 | `:240` |
| 25 | `:346` | `SharedStream<String>` 返回类型在 373 行 | `:373` |
| 27 | `:405` | 405 是调用点；"只保留最近 N 个用户轮次"逻辑在函数定义 616–618 行 | `:618` |
| 36 | `:588` | keepFromTurn 计数逻辑在 592–594 行 | `:594` |
| 38 | `:612` | 同 [27]，keepFromTurn 在 618 行 | `:618` |
| 44 | `:705` | 705 行只是 `memoryTagRegex` 定义；实际剥离 `.replace(memoryTagRegex, "")` 在 987 行 | `:987` |
| 46 | `:982` | "speaker: content" 拼接在 1011 行，单条用户消息 `Pair("user", …)` 在 1015 行 | `:1011` |
| 63 | `:19` | 工具调用计数字段（25–27 行）出窗口 14–24 | `:24`（窗口 19–29 覆盖全部字段） |
| 64 | `:44` | `unregisterHook` 的 `@Synchronized` 在 50 行，出窗口 39–49 | `:45`（窗口 40–50 覆盖注册/注销两侧） |
| 66 | `:55` | runCatching 捕获/记日志/继续在 59–67 行 | `:61` |
| 73 | `:236` | runCatching(245)/onFailure 日志(247)/`?: return@forEach`(250) 出窗口 231–241 | `:245` |
| 75 | `:8` | summaryPrompt(15)/summaryResult(16) 出窗口 3–13 | `:12`（窗口 7–17 覆盖全部字段） |
| 85 | `:3` | SUMMARY 枚举值在 9 行，出窗口 1–8 | `:6`（窗口 1–11 覆盖 6 个值） |
| 93 | `:9` | maxTokens(16)/tokenUsageThreshold(17) 出窗口 4–14 | `:13`（窗口 8–18 覆盖全部字段） |

#### B. 复合事实，必须拆分（14 条 → 30 条）

| # | 现状 | 拆分方案 |
|---|---|---|
| 17 | 一条 fact 含"直连条件+入池"与"MediaLinkBuilder.image 生成 link"（233 行） | (a) ref `:217`：直连分支条件 + `ImagePoolManager.addImage` 入池；(b) ref `:233`：`MediaLinkBuilder.image` 生成 link |
| 19 | 同上，`MediaLinkBuilder.file` 在 255 行 | (a) ref `:251`：`MediaPoolManager.addMedia` 入池；(b) ref `:255`：`MediaLinkBuilder.file` 生成 link |
| 21 | `MediaLinkBuilder.audio`(262) 与失败回退标签(273) | (a) ref `:262`：音频附件直连用 `MediaLinkBuilder.audio`；(b) ref `:273`：失败回退普通 `<attachment>` 格式 |
| 22 | `MediaLinkBuilder.video`(281) 与失败回退标签(292) | (a) ref `:281`：视频附件直连用 `MediaLinkBuilder.video`；(b) ref `:292`：失败回退普通 `<attachment>` 格式 |
| 40 | "同时取消插件接管执行和 AI 对话"(652) 与"取消 ToolPkg JS 执行"(660) | (a) ref `:652`：同时取消插件接管执行和 AI 对话；(b) ref `:660`：取消该聊天的 ToolPkg JS 执行 |
| 51 | `extractTopPackageUsages` 取 Top 2(1111) 与 `packageManager.usePackage` 取工具提示(1137) | (a) ref `:1111`：统计窗口内工具使用 Top 2 的包；(b) ref `:1137`：调用 `usePackage` 取工具提示拼预热块 |
| 52 | 函数定义(1184) 与排序逻辑(1248–1252) | (a) ref `:1184`：`extractTopPackageUsages` 从 AI 消息的 tool 调用中提取包名；(b) ref `:1250`：按次数降序、先见顺序取前 N |
| 53 | package_proxy/proxy 按 tool_name 统计(1230–1239) 与 use_package 不统计(1241) | (a) ref `:1234`：package_proxy/proxy 工具按 tool_name 参数的真实工具名统计；(b) ref `:1241`：use_package 本身不统计 |
| 67 | `dispatchScope` 定义(42) 与 `dispatchAsync` 异步分发(72) | (a) ref `:42`：`dispatchScope` 定义；(b) ref `:72`：`dispatchAsync` 用 `dispatchScope.launch` 异步分发 |
| 68 | 字段列表横跨 9–22 行，单个 ref 覆盖不全 | (a) ref `:11`：携带 stage、chatId、functionType、rawInput/processedInput、chatHistory；(b) ref `:20`：携带 systemPrompt、toolPrompt、availableTools、metadata |
| 77 | "委托给私有 dispatch"(50) 与"串行 forEach + runCatching 异常隔离"(69) | (a) ref `:50`：委托给私有 dispatch；(b) ref `:69`：串行 forEach + runCatching 异常隔离 |
| 79 | 优先级链横跨 30–54 行（角色组 > roleCardId > 角色卡名 > 全局） | 拆 4 条：(a) ref `:32` 聊天绑定的角色组优先；(b) ref `:37` 其次用传入的 roleCardId；(c) ref `:43` 再按聊天绑定的角色卡名解析；(d) ref `:54` 都为空时用全局 active prompt |
| 84 | character_card 格式(78–82) 与 character_group 格式(91–95) | (a) ref `:79`：character_card 对应 `{type:"character_card", id, name}`；(b) ref `:92`：character_group 对应 `{type:"character_group", id, name}` |
| 90 | 合并规则与三类不合并(76) 与内容换行拼接(93) | (a) ref `:76`：合并规则与三类不合并；(b) ref `:93`：内容换行拼接 |

#### C. 完全重复条目（2 对，各删 1 条）

- **[72] / [74]**：两条一字不差（"`applyMutation` 用 mutation 的非空字段覆盖当前值，metadata 做合并"，ref 均为 `:256`）。删除一条；**保留的那条 ref 改为 `:267`**（?: 覆盖在 267–273 行，metadata 合并在 260–264 行；原 `:256` 窗口 251–261 覆盖不全）。
- **[86] / [89]**：两条一字不差（"`appendUserTurnIfMissing` 末尾不是相同用户消息时才追加"，ref 均为 `:64`）。删除一条。

#### D. 表述撑不起（1 条）

- **[70]**："7 种接口"单个 ref（`:41`）撑不起计数。改述为以 `PromptInputHook` 为例（ref `:41` 不动），去掉"7 种"计数；或逐一枚举 7 种接口并各给引用。

---

## 二、quality.json（5 条全部通过）

5 条 evidence 全部经脚本验证与源码**逐字一致**（2026-10-01），问题描述属实，severity / confidence 评级合理：

- **Q0**（processAiMessage 非角色隔离分支丢弃 cleanedContent）：属实。次要备注：detail 中"角色隔离分支则正确使用了清理后的内容"不精确——只有 other-role 子分支用了 cleanedContent（:1419），current-role 子分支同样返回原始 `message.content`（:1412–1414）。建议修正措辞，不影响结论。
- **Q1**（shouldGenerateSummary 只数 user 消息但日志写"新消息"）：属实（:1312 `count { it.sender == "user" }` vs :1315 日志"新消息数量"）。
- **Q2**（proxySenderName 只转义双引号）：属实。
- **Q3**（插件流 replay=Int.MAX_VALUE 无界缓冲）：属实（:513）。
- **Q4**（dispatch 串行无超时）：属实。

---

## 三、正文 core-chat-runtime.md（通过，2 处次要问题）

- §9 双受众结构完整：frontmatter / 概述 / `## AI 速览`（核心符号清单 + 主入口 + 数据流向一句话）/ 核心机制 / 关键符号 / 调用链（输入→处理→输出编号）/ 来源（精确到行）。
- 次要问题（不 blocking，建议修错时顺手改）：
  1. AI 速览中"返回 `SharedStream<String>`"引用的是 `:346`，返回类型实际在 `:373`（同 fact[25]）。
  2. 概述"刻意保持无状态"是对 KDoc 原文（74–76 行）的转述，fact[1] 有据，通过；无问题，仅备注。

## 四、status.json（正确）

id=`core-chat-runtime`、issue=26、`review-pending`、`source_repo`=Operit、`source_commit`=`dbf71916…`、`critic` 留空——全部正确，未动 review-queue.json。

---

## 五、给修错员的执行清单

1. 按 §1.2 表格逐条修正 facts.json（16 条改 ref、14 条拆成 30 条、删 2 条重复、1 条改述），修正后 112 条。
2. 重新跑 `scripts/lint.py`，确认 0 硬失败 / 0 警告。
3. 顺手改 quality.json Q0 detail 措辞（"角色隔离分支"→"other-role 子分支"）与正文 AI 速览的 `:346`→`:373`。
4. 修正后通知 critic 复检（只需复检 §1.2 条目）。

## 复检（2026-10-01 14:05 CST，修错后复验）

- 复检人：独立 critic（与修错员无关）
- 方法：只复检修错项。113 条 facts 全部程序化校验（ref 文件存在、行号不越界、反引号符号 ±5 窗口）；26 条脚本告警逐条人工 sed 核验；35 项退回清单抽查 20+ 条；7 处偏离逐条实测；拆分条目抽查 10+ 处；quality Q0、正文同步核对。

### 结论：未通过 —— 退回小修（5 项）

修错员的 35 项主体修得扎实，但复检发现 1 处引用铁律违反 + 4 组重复（其中 3 组由本次拆分引入）。均为机械小修：

1. **[73] 引用错位**：`ChatRuntimeHook` 接口要求 `id` 和 suspend 的 `onEvent(event, context)`，ref 为 `ChatRuntimeHookRegistry.kt:45`，但接口实际在 **31–37 行**（`interface ChatRuntimeHook` :31、`val id` :32、`suspend fun onEvent` :34–36），:45 的窗口（40–50）完全看不到接口。改为 **:34**（窗口 29–39 全覆盖）。
2. **[94] 与 [90] 重复**：两者都是"聊天绑定角色组 → `ActivePrompt.CharacterGroup(boundGroupId)`"（ref :31 vs :32）。删除 [94]，保留 [90]（"优先"含优先级语义）。
3. **[95] 与 [91] 重复**：两者都是"roleCardId → `ActivePrompt.CharacterCard(resolvedRoleCardId)`"（ref 均为 :37）。删除 [95]，保留 [91]（"其次"含优先级语义）。
4. **[96] 与 [92] 重复**：两者都是"角色卡名经 `CharacterCardManager.findCharacterCardByName` 解析为 id"（ref 均为 :43）。删除 [96]，保留 [92]（"再按"含优先级语义）。
5. **[32] 与 [43] 软重复**：两者都是"`limitImageLinksInChatHistory` 只保留最近 N 个用户轮次的图片链接"（ref 均为 :617）；且 [32] 的符号参数名 `memory`/`maxImageHistoryUserTurns` 与源码实际参数 `history`/`keepLastUserImageTurns` 不符。删除 [32]，保留 [43]。

### 7 处偏离的最终结论（修错员 7 处全对）

逐条 sed 实测，修错员的锚点全部优于 critic 原建议：

| 偏离 | 修错员 | critic 原建议 | 结论 |
|---|---|---|---|
| audio(a) | :260 | :262 | 修错员对。窗口 255–265 同时覆盖直连条件（256）、`addMedia`（258）、`MediaLinkBuilder.audio`（262）；:262 的窗口（257–267）漏掉条件行 256，而断言含条件 |
| video(a) | :279 | :281 | 修错员对。窗口 274–284 覆盖条件（275）、`addMedia`（277）、`MediaLinkBuilder.video`（281）；:281 窗口漏掉条件行 275 |
| sendMessage | 拆 :345/:373 | — | 对。`suspend fun sendMessage(` 在 345，`): SharedStream<String>` 在 373，两条各自窗口完全支撑 |
| limitMediaLinks | :593 | :594 | 修错员对。窗口 588–598 覆盖函数定义（588）+ keepFromTurn（594）；:594 窗口（589–599）漏掉定义行 588 |
| limitImageLinks（两处） | :617 | — | 对。窗口 612–622 覆盖定义（612）+ keepFromTurn（618） |
| dispatch | :58 | :61 | 修错员对。窗口 53–63 覆盖 `dispatch` 定义（55）+ forEach（60）+ try（61）；:61 窗口（56–66）漏掉定义行 55 |

### 其他复检点（全部通过）

- **16 条重锚**：抽查 [11]:56、[15]:172、[18]:240、[44]→:987、[46]→:1011、[63]:24、[64]→[74]:45、[66]→:61、[73]原→现[84]:245、[75]:12、[85]:6、[93]:13 等，窗口全部完全支撑断言。
- **14 处拆分**：抽查图片/PDF/音频/视频直连与回退（[17]/[18]、[20]/[21]、[23]/[24]、[25]/[26]）、cancelOperation（[45]:652/[46]:660）、包预热（[57]:1111/[58]:1137）、排序（[60]:1250）、统计（[61]:1234/[62]:1241）、dispatchScope/dispatchAsync（[76]:42/[77]:72）、优先级链 4 条（[90]–[93]）、元数据格式（[98]:79/[99]:92）、合并规则（[104]:76/[105]:93）——拆分后无复合残留，窗口各自完全支撑。
- **[70] 改述**：已去掉"7 种"计数，改为以 `PromptInputHook` 为例（现 [81]:38），准确。
- **[73] 文件归位**：原 runCatching 退回项现为 [84] `PromptHookRegistry.kt:245`，窗口 240–250 覆盖 runCatching(245)/onFailure(247)/return@forEach(250) 全链路，归位正确。
- **quality Q0**：detail 已改为"只有 other-role 子分支用了清理后的内容，current-role 子分支同样返回原始 `message.content`"，与源码 :1412–1419 一致。
- **正文**：AI 速览 `SharedStream<String>` 引用已 :346→:373；关键符号表 `sendMessage` 行保留 :346 正确（其窗口含 345 行定义，:373 窗口不含 `sendMessage` 符号）。
- **去重**：原 2 对完全重复已删除；程序化确认无一字不差的重复条目。
- **lint**：单页隔离 `scripts/lint.py`，0 硬失败 / 0 警告。

### 非阻塞观察（修错范围外，原 critic 已通过，本次不计入退回）

- [97]（`resolveBoundChat`）:57 的窗口（52–62）差 1 行够到 63 行的 `.firstOrNull { it.id == normalizedChatId }`（"匹配 chatId"）；建议改 :58。
- [110]（`MessageProcessingPlugin`）:30 的窗口（25–35）差 1 行够到 36 行的可空返回类型（"返回 null 表示不接管"）；建议改 :31。

### 未动项

未改动 facts/md/quality/status 文件，未动 review-queue.json。status.json 保持 review-pending / issue 26 / source_repo operit。
