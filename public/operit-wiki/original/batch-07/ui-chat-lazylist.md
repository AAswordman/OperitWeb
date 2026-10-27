---
title: 聊天列表懒加载布局
module: ui-features-chat / app
sources: 50
date: 2026-10-01
---

# 聊天列表懒加载布局（ui-chat-lazylist）

## 概述

这批代码是 Jetpack Compose Foundation **1.10.4** 里 LazyColumn 相关源码的本地副本：包名从 `androidx.compose.foundation.lazy` 改为 `com.ai.assistance.operit.ui.features.chat.components.lazy`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:17`），50 个 Kotlin 文件共 10029 行，全部平铺在一个目录下，没有上游的多级目录结构。

人话：它就是"只渲染屏幕上能看到的那几条消息"的列表引擎。聊天消息动辄成千上万条，一次全画出来会卡死，所以这个引擎只组合（compose）当前视口附近的条目，滑出屏幕的就丢掉，滑进来的再现画。

入口叫 `RecyclerLazyColumn`——就是上游的 `LazyColumn` 改了个名（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:385`）。注意这批文件是**为后续魔改准备的本地副本**，只保留了 LazyColumn/LazyList 链路，没有带入 grid 和 staggeredgrid，也没有编译验证。

这批 lazy 包并非零调用：`ChatScrollExtensions.kt`（:5）、`ChatScrollNavigator.kt`（:69）、`ScrollToBottomButton.kt`（:26）三个聊天组件文件直接 import 了本包的 `LazyListState`（后两者 alias 为 `ChatLazyListState`），聊天页的滚动扩展、滚动导航器和"回到底部"按钮都跑在本引擎之上。

整套链路分四层：RecyclerLazyColumn（对外组合函数）→ LazyList（内部组合，组装 modifier 链）→ measureLazyList（测量函数，算出每个条目的位置）→ LazyListState（滚动状态，持有滚动位置、预取、动画器）。

## AI 速览

- **核心符号**：RecyclerLazyColumn（入口）、LazyList（内部组合）、LazyListState（滚动状态）、measureLazyList（测量）、LazyListMeasureResult（测量结果）、LazyListMeasuredItem（已测条目）、LazyLayout（SubcomposeLayout 底座）、LazyLayoutItemAnimator（条目动画）、LazyLayoutPrefetchState（预取）、DefaultLazyListPrefetchStrategy / CacheWindowLogic（预取策略）、LazyListScope（内容 DSL）、LazyItemScope（条目内 DSL）、StickyItemsPlacement（粘性头）、LazyLayoutKeyIndexMap（key-index 映射）、LazySaveableStateHolder（可见项状态保存）。
- **主入口**：`RecyclerLazyColumn`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:385`）。
- **内部转调**：`LazyList`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:57`）。
- **数据流向一句话**：手势滚动 → `onScroll` 把距离累进 `scrollToBeConsumed`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:494`），再经测量产出结果回写 state 并触发放置。

## 核心机制

### 1. 入口与内容 DSL：RecyclerLazyColumn / LazyListScope / LazyItemScope

`RecyclerLazyColumn` 参数与上游 LazyColumn 一致：`modifier`、`state`（默认 `rememberLazyListState()`）、`contentPadding`、`reverseLayout`、`verticalArrangement`（正向顶部、反向底部）、`horizontalAlignment`、`flingBehavior`、`userScrollEnabled`、`overscrollEffect`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:390`）。

另有两个 `Deprecated`（HIDDEN 级别）的历史重载，只做参数转发（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:415`）。

内容 DSL 由 `LazyListScope` 接口定义（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:31`）。

`item` 添加单条目（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:47`）。

`stickyHeader` 添加粘性头，内部转调另一个 stickyHeader 重载（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:116`）。

`items` 支持 List 集合：key 工厂按 index 取 items[index]（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:173`）。

注意：该接口里的 item/items 默认实现直接抛错（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:52`）——真正的实现是区间内容类基于区间列表给出的。

条目内作用域提供三个尺寸修饰符：`fillParentMaxSize` / fillParentMaxWidth / fillParentMaxHeight，fraction 取值限定 0~1（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyItemScope.kt:44`）。

`animateItem` 的三个动画 spec（出现/位移/消失）默认都是 stiffness 为 StiffnessMediumLow 的 spring（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyItemScope.kt:91`）。

DSL 作用域隔离靠 DslMarker 注解 `LazyScopeMarker`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyScopeMarker.kt:20`）。

### 2. 内部组合：LazyList（modifier 链的组装）

LazyList 是真正的内部组合函数（internal），modifier 链的前半段为：`remeasurementModifier`（同步 remeasure）、`awaitLayoutModifier`（等首次布局）、`lazyLayoutSemantics`（无障碍）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:133`）。

链的后半段为：`beyondBoundsModifier`（焦点搜索用的界外布局）、`itemAnimator` 的 modifier（消失中条目的绘制）、`scrollableArea`（手势滚动）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:142`）。

beyond-bounds 修饰符只在 `userScrollEnabled` 为 true 时挂载（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:115`）。

测量策略由 `rememberLazyListMeasurePolicy` 记住（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:156`）。

策略内部先按竖直/水平与是否反向的组合解析出 `beforeContentPadding`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:232`）。

再调用 `measureLazyList`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:353`）。

最后把结果经 `applyMeasureResult` 回写到 state（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:386`）。

### 3. 测量：measureLazyList（锚点 + 双向填充）

`measureLazyList` 是纯测量函数（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:51`）。

空数据集时直接返回零尺寸结果（注释写明 empty data set 时 report zero size）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:82`）。

非空时以首可见项为锚点，先把待消费滚动作用到锚点偏移上；若 `currentFirstItemScrollOffset` 为负，向前逐个测量条目直到偏移归零（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:174`）。

再用 `getAndMeasure` 向后逐个测量条目直到填满视口，且至少保留一个条目（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:218`）。

若条目不够填满视口，用 `toScrollBack` 回滚补齐（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:245`）。

额外组合视口前后的 beyondBoundsItemCount 个条目与 pinned 条目（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:461`）。

`calculateItemsOffsets` 算出每个条目的主轴偏移：有富余空间时走 Arrangement 排布，否则顺序累加（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:528`）。

条目测量走 measured-item provider 的 getAndMeasure，子约束 `childConstraints` 在主轴上放开为 `Constraints.Infinity`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItemProvider.kt:33`）。

每个已测条目可包含多个 placeable（条目 lambda 里 emit 多个布局节点的情况），`size` 是各 placeable 主轴尺寸之和（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItem.kt:87`）。

`size` 再加上条目间距得到 `mainAxisSizeWithSpacings`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItem.kt:102`）。

### 4. 滚动：LazyListState.onScroll 与免 remeasure 快捷路径

滚动状态的 `onScroll` 把手势距离累进 `scrollToBeConsumed`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:494`）。

当累积超过 0.5px 时，先尝试 `copyWithScrollDeltaWithoutRemeasure`——直接给已测条目加 delta、只做重放置而不重新测量（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasureResult.kt:89`）。

走不通才触发 `remeasurement` 的 `forceRemeasure`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:544`）。

小数部分滚动保留在 `scrollToBeConsumed` 里到下次，避免抖动（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:549`）。

程序化滚动有三档：scrollToItem（挂起，直接 snap）、requestScrollToItem（请求下次 remeasure 时定位）、animateScrollToItem（平滑滚动）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:389`）。

`animateScrollToItem` 用"传送"策略：远距离时每次跳 NumberOfItemsToTeleport（= 100）个条目，避免逐个组合中间条目（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:583`）。

找到目标后再做精确 seek 并 snap 消除舍入误差（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutScrollScope.kt:110`）。

距离阈值：`TargetDistance` = 2500.dp、`BoundDistance` = 1500.dp、`MinimumDistance` = 50.dp（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutScrollScope.kt:35`）。

滚动位置由滚动位置类持有：`index` + `scrollOffset` + `lastKnownFirstItemKey`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListScrollPosition.kt:36`）。

数据集在首可见项之前增删时，靠 key 把首可见项"钉"在原地（updateScrollPositionIfTheFirstItemWasMoved）。

key-index 映射用 NearestRangeKeyIndexMap：只维护首可见项附近滑动窗口内的映射，窗口 30、额外 100 项，超出范围线性回退（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListScrollPosition.kt:119`）。

### 5. 预取：LazyLayoutPrefetchState 与两种策略

预取总控对外暴露 `schedulePrecomposition`（只预组合）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:120`）。

以及 `schedulePrecompositionAndPremeasure`（预组合+预测量）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:159`），返回 PrefetchHandle（可 cancel / markAsUrgent）。

请求实际执行由 PrefetchScheduler 在帧空闲时驱动；Android 实现用 `Choreographer.getInstance()` 驱动帧回调（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/PrefetchScheduler.android.kt:109`）。

注意 PrefetchScheduler 接口本身已打 `Deprecated` 注解，注释说明不再支持自定义 scheduler（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/PrefetchScheduler.kt:33`）。

执行单元 `HandleAndRequestImpl` 分阶段推进请求（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:522`）。

每步先看 PrefetchMetrics 里按 contentType 统计的加权平均耗时，时间不够就等下一帧；urgent 请求在 `shouldExecute` 里 required 取 0，无视平均耗时（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:572`）。

嵌套预取用 `traverseDescendants` 遍历预组合的槽位找子 LazyLayout 的 prefetchState，递归执行（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:826`）。

默认策略在 `onScroll` 里滚动时预取滚动方向的下一个条目，`indexToPrefetch` 记录待预取索引（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListPrefetchStrategy.kt:160`）。

变向时取消旧请求；nestedPrefetchItemCount 默认 2（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListPrefetchStrategy.kt:137`）。

缓存窗口策略基于 `LazyLayoutCacheWindow` 的 ahead/behind 窗口，逻辑在 `CacheWindowLogic`：向前是"预取窗口"逐项调度，向后是"保留窗口"只复用已缓存尺寸，不调度新预取（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/CacheWindowLogic.kt:28`）。

窗口尺寸两种表达：Dp 绝对值与 viewport 比例（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutCacheWindow.kt:69`）。

### 6. 条目动画：LazyLayoutItemAnimator

`LazyLayoutItemAnimator.onMeasured` 在每次测量后被调用，职责是检测位置变化并启动动画（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimator.kt:70`）。

三类动画：新条目出现（animateAppearance，alpha 0→1）、被移除条目消失（animateDisappearance，alpha →0，画在独立的 DisplayingDisappearingItemsNode 图层上）、位置变化的位移动画（`animatePlacementDelta`，目标恒为 IntOffset.Zero 的增量动画）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimation.kt:119`）。

关键细节：滚动本身不触发位移动画——onMeasured 把 consumedScroll 作为 delta 直接加到 `rawOffset` 上扣除掉（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimator.kt:162`）；只有非滚动引起的位置变化才起动画。

lookahead pass 里只记录 `lookaheadOffset` 作为动画目标，真正动画在 approach pass 执行（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItem.kt:201`）。

被打断的 duration 动画切换为 `InterruptionSpec`（StiffnessMediumLow 的 spring）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimation.kt:276`）。

snapToItem 这类跳跃式滚动会调用 `itemAnimator` 的 `reset`，避免位移被误当成动画（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:435`）。

### 7. 粘性头与无障碍

粘性头由 `StickToTopPlacement` 实现：取"小于等于首可见项的最后一个 header"作为吸附项（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutStickyItems.kt:74`）。

吸附项偏移钳制在 `-beforeContentPadding`，并被下一个接近顶部的 header 顶上去（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutStickyItems.kt:98`）。

吸附项标记 `nonScrollableItem` = true，滚动 delta 不作用于它（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItem.kt:172`）。

无障碍语义提供 collectionInfo、ScrollAxisRange、scrollToIndex 等（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutSemantics.kt:190`）。

由于懒列表不知道视口外条目的真实尺寸，滚动偏移只能估算：estimatedLazyScrollOffset = firstVisibleItemScrollOffset + firstVisibleItemIndex * 500（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutSemantics.kt:252`），500 这个常数是经验折中（注释解释了 24-bit float 精度与 16000 条目的边界）。

### 8. 状态保存、复用与杂项

`LazySaveableStateHolder` 只保存当前可见条目的 savable 状态，避免 TransactionTooLargeException（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazySaveableStateHolder.kt:35`）。

`LazyListState` 的 Saver 用 listSaver 只存首可见 index 与 offset（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:706`）。

复用策略按 contentType 计，同类型最多保留 7 个槽位（5 个 RecyclerView scrap + 2 个 cache，与 RecyclerView 的 DEFAULT_MAX_SCRAP / DEFAULT_CACHE_SIZE 对齐）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayout.kt:152`）。

底层 `LazyLayout` 基于 `SubcomposeLayout`，测量与放置都走同一套 subcompose 槽位（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayout.kt:135`）。

`AwaitFirstLayoutModifier` 用 `CompletableDeferred` 让 scroll 等调用等待首次布局完成（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/AwaitFirstLayoutModifier.kt:34`）。

`ObservableScopeInvalidator` 是 neverEqualPolicy 的 MutableState 包装，用于手动触发重测量/重放置（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/ObservableScopeInvalidator.kt:29`）。

滚动差值跟踪器处理 lookahead 与 approach 两 pass 之间的滚动差值，小于 1.dp 的差值直接忽略（阈值 `DeltaThresholdForScrollAnimation`）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutScrollDeltaBetweenPasses.kt:61`）。

beyond-bounds 布局一次最多布局"视口条目数 × 2"个（`BeyondBoundsViewportFactor` = 2）（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutBeyondBoundsModifierLocal.kt:252`）。

## 关键符号

| 符号 | 角色（人话） |
|---|---|
| `RecyclerLazyColumn` | 对外入口，原名 LazyColumn（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:385`） |
| `LazyRow` | 横向版本，同文件（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:325`） |
| `LazyList` | 内部组合函数，组装 modifier 链与测量策略（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt:57`） |
| `LazyListState` | 滚动状态持有者：位置、手势、预取、动画器（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:154`） |
| `measureLazyList` | 纯测量函数，锚点双向填充（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:51`） |
| `LazyListMeasureResult` | 测量结果，含免 remeasure 快捷路径（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasureResult.kt:89`） |
| `LazyListMeasuredItem` | 已测条目，可含多个 placeable（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItem.kt:36`） |
| `LazyLayout` | SubcomposeLayout 底座（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayout.kt:64`） |
| `LazyLayoutItemAnimator` | 条目出现/消失/位移动画编排（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimator.kt:46`） |
| `LazyLayoutPrefetchState` | 预取总控（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:50`） |
| `DefaultLazyListPrefetchStrategy` | 默认预取策略，滚动方向预取下一条（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListPrefetchStrategy.kt:137`） |
| `CacheWindowLogic` | 缓存窗口策略逻辑（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/CacheWindowLogic.kt:28`） |
| `LazyListScope` | 内容 DSL：item/items/stickyHeader（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt:31`） |
| `LazyItemScope` | 条目内 DSL：fillParentMax* 与 animateItem（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyItemScope.kt:28`） |
| `StickyItemsPlacement` | 粘性头放置策略（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutStickyItems.kt:26`） |
| `LazyLayoutKeyIndexMap` | key→index 映射接口（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutKeyIndexMap.kt:28`） |
| `LazySaveableStateHolder` | 只存可见项状态（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazySaveableStateHolder.kt:35`） |
| `LazyListScrollPosition` | 滚动位置三元组持有者（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListScrollPosition.kt:32`） |
| `LazyListIntervalContent` | 区间内容实现，含 headerIndexes（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListIntervalContent.kt:28`） |
| `LazyLayoutItemContentFactory` | 内容缓存工厂（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemContentFactory.kt:33`） |
| `LazyLayoutBeyondBoundsInfo` | 界外布局区间登记（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutBeyondBoundsInfo.kt:30`） |
| `LazyListLayoutInfo` | 对外布局信息接口（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListLayoutInfo.kt:30`） |
| `IntervalList` | 区间列表，二分查找定位条目（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/IntervalList.kt:30`） |

## 输入→处理→输出调用链

1. **输入**：用户手势进入滚动状态累积距离；或程序化调用三档滚动（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:389`）。
2. **处理**：测量策略闭包解析 padding 与约束 → `measureLazyList` 以锚点为中心双向组合测量条目 → 算偏移定位置（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt:51`）。

`onMeasured` 检测位移起动画（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimator.kt:70`）。

粘性头放置由 `StickToTopPlacement` 完成（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutStickyItems.kt:74`），最终产出测量结果。
3. **输出**：`applyMeasureResult` 回写布局信息、滚动位置与可滚状态，并通知预取策略（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt:588`）。

预取旁路：预取策略调度 → 预取总控经调度器在帧空闲执行组合与测量（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt:522`）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/AwaitFirstLayoutModifier.kt`（87 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/CacheWindowLogic.kt`（566 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/IntervalList.kt`（203 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyItemScope.kt`（99 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyItemScopeImpl.kt`（162 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayout.kt`（173 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutBeyondBoundsInfo.kt`（109 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutBeyondBoundsModifierLocal.kt`（252 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutBeyondBoundsState.kt`（62 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutCacheWindow.kt`（118 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutIntervalContent.kt`（71 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimation.kt`（280 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemAnimator.kt`（579 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemContentFactory.kt`（129 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutItemProvider.kt`（120 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutKeyIndexMap.kt`（95 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutMeasurePolicy.kt`（35 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutMeasureScope.kt`（132 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutMeasuredItem.kt`（91 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutNearestRangeState.kt`（65 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPinnableItem.kt`（160 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPlatform.android.kt`（45 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutPrefetchState.kt`（972 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutScrollDeltaBetweenPasses.kt`（94 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutScrollScope.kt`（296 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutSemanticState.kt`（72 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutSemantics.kt`（268 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyLayoutStickyItems.kt`（217 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyList.kt`（421 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListBeyondBoundsModifier.kt`（59 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListCacheWindowStrategy.kt`（149 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListIntervalContent.kt`（79 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListItemInfo.kt`（47 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListItemProvider.kt`（107 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListLayoutInfo.kt`（112 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasure.kt`（614 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasureResult.kt`（179 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItem.kt`（267 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListMeasuredItemProvider.kt`（78 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListPrefetchStrategy.kt`（277 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListScrollPosition.kt`（122 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListScrollScope.kt`（66 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListSemantics.kt`（31 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyListState.kt`（782 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazySaveableStateHolder.kt`（96 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/LazyScopeMarker.kt`（20 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/ObservableScopeInvalidator.kt`（39 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/PrefetchScheduler.android.kt`（301 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/PrefetchScheduler.kt`（112 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/lazy/RecyclerLazyColumn.kt`（519 行）

上游来源：Jetpack Compose Foundation 1.10.4 的 foundation/lazy 相关源码，本地化改名后未编译验证。

- 机器可读事实：`ui-chat-lazylist.facts.json`（131 条，引用逐条验真）
- 代码走查：`ui-chat-lazylist.quality.json`（7 条：警告 2 / 建议 5）
