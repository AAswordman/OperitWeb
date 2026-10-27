# 复验报告：ui-chat-lazylist（Issue #94）— 第二名独立 critic

- 复验时间：2026-10-01
- 源码：Operit @ `dbf71916`（`git rev-parse` 实测一致，工作树干净）
- 交付物：`review/batch-07/ui-chat-lazylist.{md,facts.json,quality.json,lint.md,status.json}`
- 第一轮 critic：`ui-chat-lazylist.critic.md`（FAIL：4 条事实错误、30 条锚点漂移/拆分、来源小节缺计数行）
- 修错员声称：facts 114→131、4 条改写、30 条重锚/拆分、补 3 条覆盖缺口、lint 0/0

## 核验方式

- 131 条 facts 全部机械校验：ref 文件存在、行号界内、±5 窗口非空、反引号标识符全部落在窗口内（脚本全过，0 问题）。
- 第一轮 FAIL 清单**逐项实地拉源码窗口重核**（未沿用 critic1/修错员结论）：4 条改写事实、30 条漂移项（含修错员与 critic1 建议不同的 4 处）、3 条新增覆盖 facts、11 组拆分。
- quality 7 条 evidence 首行逐字命中源码窗口，severity 合规。
- lint 本人隔离重跑（/tmp 纯净目录）：0 硬失败 / 0 警告。
- 禁用词："批准/LGTM" 3 文件 0 命中；"通过"仅 3 处普通动词用法（"通过 X 实现"），无批准语义。
- 正文来源小节：`机器可读事实（131 条）` + `代码走查（7 条：警告 2 / 建议 5）`，与文件一致。
- status.json：refs_valid=131 = facts 数，status=review-pending，未擅自批准。

## 第一轮 FAIL 项落实情况（全部 PASS）

### A. 4 条事实性错误（改写验真）

1. **remember key**（fact 17，LazyList.kt:188）：`remember(state, contentPadding, reverseLayout, isVertical, beyondBoundsItemCount, horizontalAlignment, verticalAlignment, horizontalArrangement, verticalArrangement, graphicsContext, stickyItemsPlacement)`——11 个 key，确实不含 `itemProviderLambda` 与 `coroutineScope`。断言"除两者外的全部参数"为真 ✓
2. **approachLayoutInfo**（fact 50 :606 / fact 51 :624）：`:606` 为 `if (!isLookingAhead && hasLookaheadOccurred)` 分支内的 `approachLayoutInfo = adjustedResult`（注释 "record this result as approach result"）；`:624` 为 else 分支的 `layoutInfoState.value = adjustedResult`（覆盖 lookahead 与普通 pass）。拆分正确 ✓
3. **getContentType**（fact 103，LazyLayoutIntervalContent.kt:39）：`fun getContentType(index: Int): Any?` 无 `open` 修饰符，默认委托 `content.type.invoke(localIndex)`。断言已删"可被子类覆写" ✓
4. **findIndexByKey**（fact 107，LazyLayoutItemProvider.kt:103）：找不到时 `return lastKnownIndex`，从不返回 -1（-1 仅是 `getIndex` 的内部约定）。断言正确 ✓

### B. 30 条锚点漂移/拆分（逐项窗口验真，结论全部为真且锚点正确）

| 项 | 当前锚点 | 验真 |
|---|---|---|
| [6] Arrangement 默认值 | RecyclerLazyColumn.kt:390 | `if (!reverseLayout) Arrangement.Top else Arrangement.Bottom` ✓ |
| [7a]/[7b] 历史重载拆分 | :427 / :441 | (a) 转发体 `RecyclerLazyColumn(...)`；(b) `@Deprecated(HIDDEN)` 重载 ✓ |
| [17→18] beforeContentPadding | LazyList.kt:232 | when 四组合 ✓ |
| [29] 拆分三条 | LazyListMeasure.kt:547/:563/:592 | hasSpareSpace 分支 / `density.arrange(...)` / else 顺序累加 ✓（修错员用 :547/:563/:592 而非 critic 建议 :556/:588，实地核对更贴切） |
| [31→34] | LazyListMeasuredItem.kt:97 | `size = mainAxisSize` 累加 ✓ |
| [32] 拆分 | :209 / :172 | nonScrollableItem=true / applyScrollDelta 直接返回 ✓ |
| [38→42] | LazyListState.kt:512 | `> 0.5f` 阈值 + copyWithScrollDeltaWithoutRemeasure + forceRemeasure ✓ |
| [40→44] | :416 | `snapToItemIndexInternal(index, scrollOffset, forceRemeasure = false)` ✓ |
| [43→47] | LazyLayoutScrollScope.kt:218 | `index - lastVisibleItemIndex > numOfItemsForTeleport` 传送逻辑 ✓ |
| [47→52] | LazyListScrollPosition.kt:36 | index / scrollOffset / lastKnownFirstItemKey ✓ |
| [52] 拆分 | LazyLayoutItemAnimator.kt:100/:162 | consumedScroll→scrollOffset / rawOffset+=scrollOffset ✓ |
| [54→60] | LazyLayoutItemAnimation.kt:140 | "animate to zero" 注释 + snapTo ✓ |
| [57→63] | LazyItemScope.kt:93 | fadeIn/placement/fadeOut 三 spec 均为 spring(StiffnessMediumLow) ✓ |
| [60] 拆分 | LazyLayoutPrefetchState.kt:120/:167 | schedulePrecomposition / "if you also want to premeasure" KDoc ✓ |
| [63] 拆分三条 | :666/:696/:716 | compose+apply / 嵌套预取 / measure，各有 `return true` 等下一帧 ✓ |
| [72→81] | LazyListPrefetchStrategy.kt:128 | `fun LazyListPrefetchStrategy(nestedPrefetchItemCount: Int = 2)` ✓ |
| [73] 拆分 | CacheWindowLogic.kt:307/:156 | getItemSizeOrPrefetch 循环 / keepAroundWindow ✓（修错员用 :307 而非 critic 建议 :289，实测 :307 才是循环体） |
| [74] 拆分 | LazyLayoutCacheWindow.kt:64/:92 | Dp 版 / fraction 版 ✓（修错员用 :64/:92 而非 :68/:87，窗口更准） |
| [76→87] | LazyLayoutStickyItems.kt:131 | 小于等于首可见项的最后一个 header 吸附 ✓ |
| [80] 拆分 | LazyLayoutSemantics.kt:127/:188 | collectionInfo / scrollAxisRange+scrollToIndex ✓ |
| [85→97] | LazyListState.kt:461 | `scroll()` 中 `awaitLayoutModifier.waitForFirstLayout()` ✓ |
| [88→100] | LazyLayoutBeyondBoundsModifierLocal.kt:153 | "Layout at most one viewport worth of items (times BeyondBoundsViewportFactor)" + 公式 ✓ |
| [92→104] | LazyListIntervalContent.kt:67 | `headersIndexes.add(intervals.size)` ✓ |
| [98→110] | LazyLayoutMeasurePolicy.kt:30 | `fun interface` + measure ✓ |
| [100→112] | LazyLayoutMeasuredItem.kt:75 | `stickingItems.toMutableList()` ✓ |
| [104] 拆分 | LazyLayoutPinnableItem.kt:142/:149 | pinsCount++ / pinsCount-- 为零释放 ✓（修错员用 :149 而非 critic 建议 :148，实测 release 体在 :149） |
| [108→121] | LazyLayoutBeyondBoundsState.kt:50 | pinned 列表与界外区间合并 ✓ |
| [109] 拆分 | LazyLayoutSemanticState.kt:36/:62 | estimatedLazyScrollOffset / viewportSize ✓ |
| [110→124] | LazyItemScopeImpl.kt:138 | `(it.value * fraction).fastRoundToInt()` ✓ |
| [111→125] | LazyItemScopeImpl.kt:80 | `this then LazyLayoutAnimateItemElement(...)` ✓ |

### C. 3 条新增覆盖 facts（验真）

- [128] ChatScrollExtensions.kt:5：import 本地 lazy 包 LazyListState ✓；:11 有 `suspend fun LazyListState.animateScrollToEnd()` 扩展 ✓
- [129] ChatScrollNavigator.kt:69：`import ...lazy.LazyListState as ChatLazyListState` ✓
- [130] ScrollToBottomButton.kt:26：同上 alias ✓

### D. 机械项

- 复合断言启发式扫描：4 个嫌疑（fact 15/16 modifier 链枚举、fact 52 三元组持有、fact 54 三个命名常量）均为单一主体的枚举，非独立断言，无需拆分。
- 131 条 ref 无重复、无非法；quality 7 条 severity 仅 warn/suggestion。
- 未改动任何交付文件。

## 最终 verdict：**PASS**

第一轮 FAIL 的全部 38 项修错均已落实且实地验真，无残留问题。可进入 build→deploy→公网验证同步链。
