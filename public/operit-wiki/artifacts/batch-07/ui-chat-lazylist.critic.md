# Critic 报告：ui-chat-lazylist（Issue #94）

- 复核对象：`review/batch-07/ui-chat-lazylist.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `~/workspace/Operit` HEAD 一致）
- 复核方法：114 条 facts 逐条拉取 `file:line ±5` 源码窗口做语义核对（非仅 token 命中）；quality 7 条 evidence 逐字比对源码；lint 隔离重跑；禁用词扫描；来源小节对照 batch-06 惯例；read-status 抽查 50 个 kt。
- 结论速览：**facts 114 条中 PASS 69 / WEAK 11 / FAIL 34（其中事实性错误 4 条、锚点漂移/窗口不支持 30 条）**；quality 7 条全部验真；lint 独立重跑 0/0；无批准类禁用词；来源小节缺 facts 计数行；read-status 形式完整。
- **最终 verdict：FAIL**（需修错后复验）

## 一、facts.json（114 条）：69 PASS，11 WEAK，34 FAIL

### 1.1 事实性错误（4 条，必须改写）

- **[16] FAIL（事实错误 + 锚点完全错误）**：断言"remember key 包含除 itemProviderLambda 外的全部参数"，ref 为 `LazyList.kt:156`（该行是 `LazyList` 函数体的闭合 `}`，窗口内根本没有 remember）。实测：`rememberLazyListMeasurePolicy` 的 13 个参数中，remember key（`:188-199`）排除了 **两个**参数——`itemProviderLambda` **和** `coroutineScope`。建议改写为"remember key 包含除 itemProviderLambda 与 coroutineScope 外的全部参数"，ref 改为 `LazyList.kt:188`。
- **[46] FAIL（事实错误）**：断言"在 lookahead pass 把结果记为 approachLayoutInfo，在普通 pass 更新 layoutInfoState"。实测 `LazyListState.kt:604-624`：`approachLayoutInfo = adjustedResult` 发生在 `if (!isLookingAhead && hasLookaheadOccurred)` 分支——即 **lookahead 之后的 approach pass**，不是 lookahead pass；且 lookahead pass 本身也会走 else 分支执行 `layoutInfoState.value = adjustedResult`（`:624`）。两句都错。建议拆成两条：(a)"applyMeasureResult 在 lookahead 发生后的 approach pass 把结果记为 approachLayoutInfo"（`:606`）；(b)"其余 pass（含 lookahead pass 与普通 pass）更新 layoutInfoState"（`:624`）。
- **[91] FAIL（事实错误）**：断言"getContentType …可被子类覆写"。实测 `LazyLayoutIntervalContent.kt:39` 为 `fun getContentType`，**没有 `open` 修饰**，子类不可覆写。建议删去"可被子类覆写"，保留"默认委托给 interval 的 type lambda"（`:39` 窗口支持）。
- **[95] FAIL（事实错误，张冠李戴）**：断言"findIndexByKey 按 key 查找索引，找不到返回 -1"。实测 `LazyLayoutItemProvider.kt:94-108`：找不到时回退 `return lastKnownIndex`，**从不返回 -1**；"找不到返回 -1"是它调用的 `getIndex(key)`（`:88`，另一个函数）的 KDoc 约定。建议改写为"findIndexByKey 按 key 查找索引，找不到回退到 lastKnownIndex"，ref 改为 `LazyLayoutItemProvider.kt:103`。

### 1.2 锚点漂移 / 窗口不支持断言（30 条，断言本身为真，需重锚或拆分）

- **[6]**：ref `:385` 窗口（380-390）只到参数名行，`Arrangement.Top/Bottom` 的默认值表达式在 `:390-391`。→ ref 改 `:390`。
- **[7]**：ref `:415` 窗口（410-420）只含第一个重载声明；"两个"中的第二个在 `:441`，转发体在 `:427-439`。→ 拆成两条：(a)"历史重载函数体只做参数转发"（`:427`）；(b)"第二个 @Deprecated(HIDDEN) 历史重载"（`:441`）。（已核实确为 2 个 RecyclerLazyColumn 重载 + 2 个 LazyRow 重载，计数无误。）
- **[17]**：ref `:273` 窗口是 `visualItemOffset` 计算，与 `beforeContentPadding` 无关。→ ref 改 `:232`（`when { isVertical && !reverseLayout -> topPadding … }` 四组合）。
- **[29]**：ref `:528` 只是函数签名。→ 拆成两条：(a)"有富余空间（hasSpareSpace）时用 density.arrange 按 Arrangement 排布"（`:556`）；(b)"无富余空间时顺序累加偏移"（else 分支，`:588` 起）。
- **[31]**：ref `:87` 窗口是字段声明。→ ref 改 `:97`（窗口 92-102 覆盖 `size = mainAxisSize` 累加与 `mainAxisSizeWithSpacings = (size + spacing)`）。
- **[32]**：复合断言跨两个文件。→ 拆成两条：(a)"粘性头条目被标记 nonScrollableItem = true"（`LazyLayoutStickyItems.kt:209`）；(b)"applyScrollDelta 遇 nonScrollableItem 直接返回，滚动 delta 不作用"（`LazyListMeasuredItem.kt:172`，现窗口支持 (b)）。
- **[38]**：ref `:544` 窗口只有结果分支。→ ref 改 `:512`（窗口 507-517 覆盖 `> 0.5f` 阈值与 `copyWithScrollDeltaWithoutRemeasure` 尝试）。
- **[40]**：ref `:410` 窗口（405-415）不含 `:416` 的 `snapToItemIndexInternal(..., forceRemeasure = false)` 调用。→ ref 改 `:416`（窗口 411-421 含"schedules a remeasure if false"KDoc）。
- **[43]**：ref `:583` 窗口只显示常量被传入，未显示传送行为。→ ref 改 `LazyLayoutScrollScope.kt:218`（`snapToItem(index = index - numOfItemsForTeleport, …)` 跳项逻辑）。
- **[47]**：ref `:28` 窗口（23-33）只有 `index`。→ ref 改 `:36`（窗口 31-41 覆盖 index、scrollOffset、lastKnownFirstItemKey）。
- **[52]**：断言涉及两处（`:100` 由 consumedScroll 构造 scrollOffset；`:162` 加到 rawOffset）。→ 拆成两条分别锚定 `:100` 与 `:162`。
- **[54]**：ref `:119` 窗口只有函数头，"目标为零"的证据在 `:137-145`（注释 "animate to zero"）。→ ref 改 `:140`。
- **[57]**：ref `:91` 窗口（86-96）不含 `:97` 的 fadeOutSpec 默认值。→ ref 改 `:93`（窗口 88-98 覆盖三个 spec 默认值）。
- **[60]**：ref `:116` 窗口只含 schedulePrecomposition。→ 拆成两条：(a) schedulePrecomposition（`:120`）；(b) schedulePrecompositionAndPremeasure"预组合+预测量"（`:167` KDoc："Schedules precomposition and premeasure … if you also want to premeasure"）。
- **[63]**：ref `:618` 是 `cleanUp()`，与四阶段推进完全无关。→ 按阶段拆：compose（`:666`，`return true` 等下一帧）、apply（`:673`）、嵌套预取（`:696`）、measure（`:717`）；或至少拆成两条（compose+apply / 嵌套+measure）。
- **[72]**：ref `:138` 是 private class，不是工厂函数。→ ref 改 `:128`（`fun LazyListPrefetchStrategy(nestedPrefetchItemCount: Int = 2)`）。
- **[73]**：ref `:28` 是 import 区。→ 拆成两条：(a)"向前预取窗口逐项调度"（`:289`，getItemSizeOrPrefetch 循环）；(b)"向后保留窗口（keepAroundWindow）"（`:156`，fillCacheWindowBackward）。
- **[74]**：ref `:69` 窗口只有 Dp 版本。→ 拆成两条：(a) Dp 绝对值（`:68`）；(b) viewport 比例（`:87`，"based off a fraction of the viewport"）。
- **[76]**：ref `:74` 只是对象声明。→ ref 改 `:131`（`if (stickyItems[index] <= firstVisible) { currentHeaderIndex = … }`）。
- **[80]**：ref `:188` 窗口无 collectionInfo（在 `:127-128`）。→ 拆成两条：(a) collectionInfo（`:127`）；(b) ScrollAxisRange/scrollToIndex（`:188` 现窗口）。
- **[85]**：ref `:34` 只有机制（CompletableDeferred），"scroll 等调用等待"的证据在调用方。→ ref 改 `LazyListState.kt:461`（`scroll()` 中 `awaitLayoutModifier.waitForFirstLayout()`）。
- **[88]**：ref `:252` 只是常量声明。→ ref 改 `:153`（注释 "Layout at most one viewport worth of items (times BeyondBoundsViewportFactor)" + 公式）。
- **[92]**：ref `:32` 只是属性声明。→ ref 改 `:67`（stickyHeader 覆写中 `headersIndexes.add(intervals.size)`）。
- **[98]**：ref `:34` 只有 measure 方法。→ ref 改 `:30`（窗口 25-35 同时覆盖 `fun interface` 声明与 measure 方法）。
- **[100]**：ref `:67` 只是函数签名。→ ref 改 `:75`（`stickingItems.toMutableList()` + positionedItems 合并排序体）。
- **[104]**：ref `:109` 只是 `pinsCount = 0` 声明。→ 拆成两条：(a) pin 时 `pinsCount++`（`:142`）；(b) release 时 `pinsCount--`、为零释放（`:148`）。
- **[108]**：ref `:37` 只是函数签名。→ ref 改 `:50`（pinned 列表与 beyondBoundsRange 合并体）。
- **[109]**：ref `:27` 只是工厂函数签名。→ 拆成两条：(a) scrollOffset 估算（`:36`）；(b) viewport（`:62`）。
- **[110]**：ref `:125` 只是类声明。→ ref 改 `:138`（`(it.value * fraction).fastRoundToInt()`）。
- **[111]**：ref `:72` 只是 animateItem 签名。→ ref 改 `:80`（`this then LazyLayoutAnimateItemElement(…)`）。

### 1.3 WEAK（可接受，记录在案；不断言失败）

- [0] 包名断言：ref 只展示单个文件的 package 行；"50 个 kt 均为该包名"已用目录扫描独立验真（50/50 一致），结论为真。
- [27][28] createItemsAfterList/BeforeList：窗口仅为函数签名，但函数名 + beyondBoundsItemCount/pinnedItems 参数与正文 body（`end = minOf(end + beyondBoundsItemCount, …)` + pinned 循环）一致，结论为真。
- [35] "条目尺寸变化时"用途：窗口内无直接证据，但调用方函数名 `maybeCompensateForItemResize`（`LazyListState.kt:647`）佐证，结论为真。
- [65] "通过 TraversableNode"：源码实际 API 为 `traverseDescendants(TraversablePrefetchStateNodeKey)`，属同一机制的简化表述，可接受。
- [66][67][82][86][93][99][101]：关键 token 均在窗口内，表述为合理转述；其中 [82] 的"7"字证据在 `:173`（窗口外），[67] 的 compose/apply/measure 字段在 `:370-380`（窗口外），不强制拆分。

### 1.4 PASS（69 条，窗口完整支撑，抽验证无误）

[1][2][3][4][5][8][9][10][11][12][13][14][15][18][19][20][21][22][23][24][25][26][30][33][34][36][37][39][41][42][44][45][48][49][50][51][53][55][56][58][59][61][62][64][68][69][70][71][75][77][78][79][81][83][84][87][89][90][94][96][97][102][103][105][106][107][112][113]

## 二、quality.json（7 条）：全部验真

- 条数与 severity：warn 2 / suggestion 5，与 writer 自报一致；severity 仅 warn/suggestion，合法。
- evidence 逐字性：7 条 evidence 经脚本比对**逐字节存在于源码**（含原始缩进），7/7 通过。
- 实质核验（抽查源码窗口）：
  - Q1（warn）：`LazyListScope.item/items` 接口默认实现 `error("The method is not implemented")`（`:52`），误调即运行时崩溃——实锤。
  - Q2（warn）：`LazyLayoutItemAnimator.kt:210-213` TODO（b/352482051）承认 keyToItemInfoMap 与 movingAwayKeys 可能失步，失步时 `?: return@forEach` 静默跳过——实锤。
  - Q3（suggestion）：`CacheWindowLogic.kt:337-341` 向后分支 debugLog 打印 `prefetchWindowEndLine + 1`，实际取的是 `prefetchWindowStartLine - 1`，与向前分支（`:303`）日志逐字相同——复制粘贴实锤。
  - Q4（suggestion）：`LazyLayoutPrefetchState.kt:972` 末尾 `ZeroConstraints` 全文件无引用——实锤。
  - Q5（suggestion）：三处 debugLog 用 println（CacheWindowLogic.kt:560 等），均被 `DebugEnabled = false` 门控——实锤，定级 suggestion 恰当。
  - Q6（suggestion）：`LazyLayoutScrollScope.kt:293` TODO "prevent temporarily scrolling *past* the item"——实锤。
  - Q7（suggestion）：`PrefetchScheduler.kt:33` 整体 @Deprecated——实锤，信息性记录恰当。
- 结论：quality 7 条全部 PASS，无虚构、无 severity 越级。

## 三、lint 独立重跑：0 硬失败 / 0 警告

- 命令：4 个交付文件复制到 `/tmp/lint-lazylist-critic` 隔离运行 `python3 scripts/lint.py --src ~/workspace/Operit --dir /tmp/lint-lazylist-critic`。
- 结果：硬失败 0 / 警告 0，与 writer 自报一致。
- 说明：lint 的 ±5 检查为 token 级，语义级锚点问题由本 critic 人工核出（见 §1.2），两者互补。

## 四、禁用词：干净

- `md/facts/quality/lint.md/status` 五文件扫描"通过/批准/LGTM"：仅命中 facts 中 3 处"通过"的**普通动词用法**（"通过 … 实现"），无任何批准语义表述。符合"Issue 留言禁用、内容中普通动词可用"的既有口径。

## 五、正文来源小节：FAIL（缺 facts 计数行）

- 现状：来源小节列出 50 个源文件（行数抽查 5 个：421/614/782/972/519 均与磁盘一致），末尾为"上游来源"行。
- 缺失（对照 batch-06 惯例，如 integrations-webchat.md:157）：没有 `- 机器可读事实：`ui-chat-lazylist.facts.json`（114 条，引用逐条验真）` 行，也没有 `- 代码走查：`ui-chat-lazylist.quality.json`` 行。
- 按任务要求"正文来源小节数量与 facts 条数一致（应为 114）"，**必须补上计数行**，且修错后若 facts 条数因拆分变化（预计 114 → 约 125），计数行与 `status.json` 的 `refs_valid` 须同步更新。

## 六、read-status 抽查：形式完整，阅读可信度高

- `tracking/read-status.json`：lazy/ 下 50 个条目，status 全部 complete，repo_commit = `dbf71916…`（与钉死 commit 一致），50 个 kt 与磁盘一一对应、无缺失；lines 数字与 md 来源小节一致。
- 注：evidence 字段 50 条均为同一 quality.json 路径，属通用占位写法，未做到单文件阅读注记——形式瑕疵，不影响本次结论。
- 实质判断：本次 facts 引用了约 40 个不同文件、含大量非公开符号细节（`UnspecifiedNestedPrefetchCount = -1`、`hasSpareSpace`、`DeltaThresholdForScrollAnimation = 1.dp`、KDoc 原文等），且经核验绝大多数断言为真——与 Day 4 旧 lazy 条目"只做 README 溯源"的走过场有本质区别，**阅读真实性可信**。

## 七、正文其他抽查

- "50 个 Kotlin 文件共 10029 行"：磁盘实测 `cat *.kt | wc -l` = 10029，准确。
- "Jetpack Compose Foundation 1.10.4 / 包名改名 / 平铺目录 / 无 grid 与 staggeredgrid / 未编译验证"：与 `lazy/README.md` 逐条一致。
- "24-bit float 精度与 16000 条目边界"：`LazyLayoutSemantics.kt:243-247` 注释原文一致。
- **覆盖缺口（建议，非 FAIL）**：lazy 包并非零调用——`ChatScrollExtensions.kt:5`、`ChatScrollNavigator.kt:69`、`ScrollToBottomButton.kt:26` 均 import 了 `components.lazy.LazyListState`（后两者 alias 为 ChatLazyListState）。正文"概述"未提及这三个外部使用者，建议补充一句调用关系说明。

## 八、需修清单（修错执行人用）

1. 改写 4 条事实性错误：[16]（coroutineScope 同被排除，ref→`:188`）、[46]（拆 2 条，`:606`/`:624`）、[91]（删"可被子类覆写"）、[95]（改"回退 lastKnownIndex"，ref→`:103`）。
2. 重锚/拆分 30 条（见 §1.2 逐条建议，含 [32][52][60][63][73][74][80][104][109] 的拆分）。
3. 正文来源小节补两行：机器可读事实（N 条）+ 代码走查；N 按拆分后的实际条数填写。
4. `status.json` 的 `refs_valid` 与 facts 实际条数同步（拆分后预计 114 → 约 125 条）。
5. 建议：正文概述补一句三个外部调用文件（§七）。
6. 修错后需第二轮独立 critic 复验（本次报告人不再复验自己列出的问题）。

## 九、最终 verdict

**FAIL** —— 4 条事实性错误 + 30 条锚点/窗口不支持 + 来源小节缺 facts 计数行。quality 与 lint 均干净，阅读真实性可信，问题集中在 facts 锚定精度。按流程打回修错，修错后须经独立复验（建议换 critic）方可进入评审。
