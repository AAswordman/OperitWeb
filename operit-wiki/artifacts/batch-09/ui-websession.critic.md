# Critic 评审报告：ui-websession（Issue #115）

- 评审时间：2026-10-01
- 评审人：独立 critic（只评审不改文件）
- 源码钉住：Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb（已实地确认 `git rev-parse` 一致）

## 一、facts 抽查（35 条，命中 31 / 错位 4）

抽样：seed 42 随机取 35 条（index 0,3,4,11,13,14,17,20,25,27,28,29,31,35,53,54,57,64,69,71,75,77,81,83,86,92,94,95,96,97,101,103,105,106,107），用 sed/grep 逐条实地核对文件存在、行号处代码与断言一致。

命中的 31 条（含）：

- fact[0] `:54` WebSessionBrowserScreen 根组件签名与参数齐 ✓
- fact[3] `:122` currentTabNumber = indexOfFirst{isActive}+1、无则0 ✓
- fact[4] `:127` isBookmarked remember(browserState.currentUrl, bookmarks)+normalizeLookupUrl ✓
- fact[11] `:294` factory 块 webViewHost.attachContainer ✓
- fact[13] `:343` scrim 0.42 ✓；fact[14] `:351` overlay 窗口拿不到 activity token 注释 ✓
- fact[17] `:406` pendingDialog→PendingDialogOverlay ✓；fact[20] `:474` alert 型无取消按钮 ✓
- fact[31] `:215` Star/StarOutline ✓；fact[35] `:292` isLoading→2.dp 进度条 ✓
- fact[53] `:122` 关闭当前/全部标签、danger 红色 ✓
- fact[54] `:52` items(key={it.url}) ✓；fact[57] `:40` 书签空态 WebSessionEmptyState ✓
- fact[64] `:47` activeCount 三态计数 ✓；fact[69] `:158` LinearProgressIndicator ✓；fact[71] `:241` statusColor 映射 ✓
- fact[77] `:78` 不支持整页空态+原因 ✓；fact[81] `:144` onInvokeMenuCommand(command.commandId) ✓
- fact[83] `:211` filterNot "Unknown grants:" ✓；fact[86] `:323` onConfirmInstall ✓；fact[92] `:599` fallbackStatusFor 三规则 ✓
- fact[94] `:76` WebSessionSectionLabel ✓；fact[95]/[96] `:90` WebSessionItemCard ✓；fact[97] `:139` WebSessionEmptyState ✓
- fact[101] `:51` 优先 FloatingChatService 主题 ✓；fact[103] `:56` / [105] `:74` / [106] `:143` / [107] `:199` 悬浮球 ✓
- fact[29] `:164`→onSubmitUrl 在 :168，±5 内合格（可选收紧到 :168）

**错位 4 条（内容为真、锚点错，必须修复）：**

1. **fact[27]**：原 ref `WebSessionTopUrlBar.kt:138` → 该行在 BasicTextField 起始行附近，实际 `KeyboardOptions(imeAction = ImeAction.Go)` 在 **:152**，`KeyboardActions(onGo = { onSubmitUrl() })` 在 **:153–157**。建议 ref 改为 `:152`。
2. **fact[28]**：原 ref `WebSessionTopUrlBar.kt:138` → 非编辑态整条可点击 `clickable(onClick = onStartEditing)` 实际在 **:181**。建议 ref 改为 `:181`。
3. **fact[30]**：原 ref `WebSessionTopUrlBar.kt:138` → https→Lock/否则Language 的展示态分支实际在 **:189–191**（编辑态版本在 :114）。建议 ref 改为 `:189`。
4. **fact[75]**：原 ref `WebSessionDownloadSheet.kt:120` → 卡片高亮逻辑 `highlighted = item.status == "downloading" || item.status == "connecting"` 实际在 **:131**。建议 ref 改为 `:131`。

**锚点偏松（内容真、§9 ±5 要求下建议收紧，非阻塞）：**

- fact[24]/[25]（normalizeLookupUrl 相关）：原 ref `:758` 仅为函数声明行；null 返回规则实际在 :761–769（`about:/blob:/data:/非http(s)→null`），去默认端口/保留查询串在 :775–789。建议分别重锚到 `:765` 与 `:777`。
- quality.json[2]（地址栏未指定 Uri 键盘类型）：原 line `138`，实际 `KeyboardOptions(imeAction = ImeAction.Go)` 在 `:152`，建议 line 改为 `152`。

## 二、quality.json 核查（5 条）

全部真实、evidence 与源码一致、severity 合理：

1. warn / performance / MinimizedIndicator.kt:143：三个 infiniteRepeatable 动画无条件运行 ✓（证据的 tween(900/1200) 与源码一致）
2. suggestion / correctness / TopUrlBar.kt:138：keyboardOptions 只有 imeAction=Go、无 keyboardType=Uri ✓（实际在 :152；finding 本身为真，见上文锚点建议）
3. suggestion / correctness / DownloadSheet.kt:217：onDeleteDownload(id, true) 直接执行无二次确认 ✓（实际 :218，±5 内）
4. suggestion / correctness / HistorySheet.kt:40：DateFormat.getDateTimeInstance 写在 composable 体内未 remember ✓
5. suggestion / correctness / BrowserScreen.kt:751：normalizeNavigationUrl 无搜索兜底、非 URL 原样喂 WebView ✓（:750–754 else 分支）

无高危；字段名用 `detail`（batch-09 已修），符合 `scripts/build_quality.py` 读取。

## 三、md 结构与幻觉核查

- §9 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源 ✓
- 人话到位：术语首现有解释（chrome、悬浮球等）、调用链用编号"输入→处理→输出" ✓
- 正文本节引用抽验（:361 18.dp 圆角+navigationBarsPadding/imePadding、:451 dialog.type.lowercase、:281 Remove 图标 onMinimize、:246–258 下载徽标 coerceAtMost(9)）全部与源码一致，无编造 ✓
- lint 报告禁用词扫描通过 ✓

## 四、status.json 核查

- refs_valid=110 = facts 实际 110 条 ✓
- status=review-pending ✓
- issue=115 ✓
- source_repo/source_commit 正确（dbf71916fae9750cfdc9f9a774f5a0fee56633fb）✓

## 五、lint

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`：ui-websession 相关报错 **0**；自带 `ui-websession.lint.md` 记录硬失败 0 / 警告 0 ✓。

## 评审结论：**FAIL**（需修改）

**必须修复清单（修复后复检通过即闭环）：**

1. fact[27] ref `:138` → `:152`（ImeAction.Go / onGo→onSubmitUrl）
2. fact[28] ref `:138` → `:181`（非编辑态 clickable(onClick=onStartEditing)）
3. fact[30] ref `:138` → `:189`（https→Lock 展示态图标切换）
4. fact[75] ref `:120` → `:131`（下载卡片 highlighted 高亮逻辑）

**非阻塞建议（修复时顺手处理，不阻闭环）：**

- fact[24]/[25] normalizeLookupUrl 引用分别收紧到 `:765`/`:777`
- fact[29] 收紧到 `:168`；quality.json[2] line `138` → `152`
