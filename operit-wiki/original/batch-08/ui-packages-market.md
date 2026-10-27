---
title: 扩展市场浏览界面
module: ui-features-packages / app
sources: 21
date: 2026-10-01
---

# 扩展市场浏览界面（ui-packages-market）

## 概述

这批代码是 Operit 扩展市场（Unified Market）的整套浏览与安装界面：21 个 Kotlin 文件、7627 行，全部在 `app/src/main/java/com/ai/assistance/operit/ui/features/packages/` 下。
覆盖四块：**浏览**（全部/分类/搜索/排序/分页）、**详情**（展示、评论、点赞、版本切换、安装）、**作者页与管理页**（我发布的条目、改版/撤回/发新版）、**安装状态机**（9 阶段进度 + 本地 `.operit/market.json` 标记）。

人话：它就是 App 里的"应用商店"前端——刷列表、看详情、点安装。
安装时会按条目类型（skill/mcp/script/package）走不同的安装路径，并用一个全局单例记录"正在装到哪一步"，用 `.operit/market.json` 标记文件记住"本地装了哪个版本"，从而算出"已安装/可更新"。

主入口是 `UnifiedMarketScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:177`）。
发布相关界面（`RepoMarketPublishViewModel`）不在本批种子范围内，归 `ui-packages-publish` 页。

## AI 速览

- **核心符号**：`MarketInstallStage`（9 阶段枚举）、`MarketInstallStateStore`（全局安装进度单例）、`MarketInstallMarker`（标记文件读写）、`MarketEntryInstallController`（按类型分发安装）、`MarketLocalInstallStateKind`（NOT_INSTALLED/INSTALLED/UPDATE_AVAILABLE）、`MarketReviewState`（5 审核态）、`MarketReviewReason`（10 审核原因）、`UnifiedMarketBrowseViewModel`（浏览/搜索/分页）、`MarketBrowseList`（懒加载列表）、`UnifiedMarketDetailScreen`（详情展示）、`UnifiedMarketDetailEntryScreen`（详情编排）、`MarketInteractionController`（评论/点赞/头像缓存）、`MarketSortOption`（UPDATED/DOWNLOADS/LIKES）。
- **主入口**：`UnifiedMarketScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:177`），三 tab（全部/分类/我的）+ 首次启动强制市场协议弹窗。
- **安装入口**：`MarketEntryInstallController.install`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:30`）。
- **数据流向一句话**：服务端分页拉取条目 → 本地做搜索过滤与排序 → 卡片按"安装进度 > 版本兼容 > 本地标记"三级算出动作状态；点安装 → `MarketInstallStateStore.start` 抢占 → 按类型分发安装 → 写 `.operit/market.json` 标记 → 刷新本地状态。

## 核心机制

### 1. 安装状态机：三层——阶段枚举、全局进度单例、本地标记

**阶段枚举** `MarketInstallStage` 共 9 阶段：CONNECTING → FETCHING_METADATA → CHECKING_LOCAL → DOWNLOADING → VERIFYING → IMPORTING_REPOSITORY → IMPORTING_CONFIG → INSTALLING → RECORDING（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:7`）。
注意并非每条安装路径都经过全部阶段（如 skill 安装只上报 CONNECTING 和 IMPORTING_REPOSITORY），枚举是"全集"，各路径按需上报。

**全局进度单例** `MarketInstallStateStore` 是 object 单例，内部 `MutableStateFlow` 按 entryId 存 `MarketInstallProgress`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:27`）。
`start(entryId)` 加 `@Synchronized`：先 trim entryId，为空或已存在返回 false（防同一 entry 重复安装）（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:32`）。
`update` 把 progress 钳在 0f..1f，`finish` 移除记录（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:45`）。

**本地标记**：安装成功后在安装根目录下建 `.operit` 目录并写 `market.json`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:153`）。
内容是 Gson 序列化的 `MarketInstallMarker(entryId, versionId)`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:38`）。
versionId 取 `entry.latestVersion?.id`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:29`）。
`resolveMarketLocalInstallStates` 扫描全部标记并为每个 entry 判定本地安装状态（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:42`）。
判定规则：marker 缺失→NOT_INSTALLED；marker.versionId 等于当前版本 id→INSTALLED；否则→UPDATE_AVAILABLE（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:52`）。
损坏的标记文件只记警告跳过，不中断整批扫描（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:133`）。

标记的扫描位置有四类：skill 目录、MCPLocalServer 插件元数据的 installedPath、mcp 纯配置标记目录（`filesDir/market_install_markers/mcp_config/<safeServerId>`，serverId 经正则清洗防路径穿越，`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:91`）、PackageManager 可发布包目录。

### 2. 安装分发：按 entry.type 走三条路径

`MarketEntryInstallController.install` 按 `entry.type.lowercase()` 分发（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:30`）。
未知类型抛 `IllegalArgumentException`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:40`）。

1. **skill** → `installSkillEntry`：校验 `source.url` 非空后上报 IMPORTING_REPOSITORY，再调 `skillRepository.importSkillFromGitHubRepoDetailed(repoUrl)` 做仓库导入并写 marker（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:49`）。
导入前会先调 `deleteInstalledMarkerRoot`，对匹配 entryId 的所有标记根执行 `deleteRecursively`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:193`）。
2. **mcp** → `installMcpEntry`：`installConfig` 非空且不需要物理安装时走纯配置路径（上报 IMPORTING_CONFIG、删旧标记、合并配置），否则走仓库安装路径（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:63`）。
纯配置路径调 `MCPLocalServer.mergeConfigFromJson` 合并远端 JSON，并为每个解析出的 serverId 写标记（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:77`）。
仓库路径用 entry 信息拼 `PluginMetadata`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:109`）。
再调 `installMCPServerWithObject` 执行安装（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:124`）。
3. **script/package** → `installArtifactEntry`：经 `marketStatsApiService.artifactProjectFromEntry` 取工程，安装工程的 `defaultVersion`（按 `defaultVersionId` 查找），再写 marker（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:176`）。

安装按钮是否可点由 `MarketV2Entry.canInstallFromUnifiedMarket()` 决定：skill 要求 `source.url` 非空；mcp 要求 `source.url` 或 `installConfig` 任一非空；script/package 要求 `artifact` 非空且首个 asset 的 id 非空（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:222`）。
每次安装后 `trackEntryAssetDownload` 上报下载量，失败只记警告（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:205`）。

### 3. 浏览列表：scope、分页、本地搜索、排序、卡片状态

浏览范围由 `UnifiedMarketBrowseScope` 的 kind 区分：ALL/TYPE/CATEGORY/TYPE_CATEGORY（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:38`）。
`entries` 是 `combine(_entries, _searchQuery, _featuredOnly)` 的本地过滤结果（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:117`）。
搜索忽略大小写匹配 title、description、detail、categoryId、type、publisherLogin 六个字段（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:124`）。
服务端分页用 `currentPage`/`totalPages` 计数（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:140`）。
`featuredOnly` 默认 true（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:100`）。

排序 `MarketSortOption` 有 UPDATED/DOWNLOADS/LIKES 三种，各带 labelRes（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketStatsSupport.kt:9`）。
`toRankMetric()` 把三者映射为服务端 rank 参数 "updated"/"downloads"/"likes"（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketStatsSupport.kt:17`）。
本地再按 `updatedTimestamp`/`downloads`/`likeCount` 倒序排（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:352`）。

滑到倒数第 2 个条目且有更多页、未在加载时触发 `onLoadMore`，并用 `lastLoadMoreIndex` 防重复触发（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt:136`）。
搜索非空时禁用下拉刷新与加载更多（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt:129`）。
UPDATED 排序按日期分组头，空日期归入"更早"（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt:321`）。

卡片动作状态优先级：进行中安装（含进度条）> 版本不兼容警告 > 本地安装状态（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt:58`）。
本地状态映射：INSTALLED→Installed、UPDATE_AVAILABLE→Updatable、无记录→Available（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt:74`）。

`MarketBrowseSection` 是泛型组装函数（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseSection.kt:19`）。
它内部调用 `MarketBrowseList`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseSection.kt:44`）。
每条目经 `entryFactory` 产出后交 `MarketBrowseCard` 渲染（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseSection.kt:68`）。
滚动位置经 `initialFirstVisibleItemIndex`/`initialFirstVisibleItemScrollOffset` 传入、`onScrollPositionChanged` 回传（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseSection.kt:40`）。

### 4. 详情页：展示组件 + 编排入口 + 评论树

`UnifiedMarketDetailScreen` 是纯展示组件（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:232`）。
它用 `stickyHeader` 实现"关于/评论"粘性双 tab（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:264`）。
`UnifiedMarketDetailEntryScreen` 负责编排：取 entry、算预览模式、绑 ViewModel、处理版本切换与安装点击（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:96`）。

预览模式 `isPreviewMode = fromManage && entry.isOpen() && review.state != APPROVED`，即从管理页点进一个未过审条目时显示审核状态横幅（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:139`）。
版本不兼容时显示红色横幅，区分 BELOW_MINIMUM/ABOVE_MAXIMUM（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:267`）。
主按钮启用条件四合一：可安装 && 版本兼容 && 无进行中安装 && 本地非已安装（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:237`）。

版本历史对话框选版本后经 `withSelectedVersion` 刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:503`）。
`withSelectedVersion` 把选中版本移到 `versions` 首位并设为 `latestVersion`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:798`），后续的安装与标记都以这个"选中即最新"的版本为准。

评论树由 `sortMarketComments` 构建（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:177`）。
`parentId` 为空、自指或父评论不存在时都当作根评论处理；根按时间倒序、子按正序（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:186`）。
排序选项 `MarketCommentSortOption` 目前只有 NEWEST 一个（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:173`）。
评论卡片长按弹出菜单：回复始终可见，编辑仅作者可见，删除对作者或条目所有者可见（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:1306`）。
正文默认折叠 8 行（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:1426`）。

`MarketInteractionController` 是评论/点赞/头像的统一后台（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt:35`）。
`loadEntryComments(entryId, perPage=50)` 按 entryId 缓存评论（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt:80`）。
`loadEntryReactions` 不请求服务端，按 `entryLikes` 本地合成一条 "+1" reaction（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt:218`）。
`addReactionToEntry` 调服务端追加真实 reaction（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt:234`）。
头像内存+SharedPreferences 双层缓存，超 500 条触发清理（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt:322`）。
评论发布先判 GitHub 登录（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketDetailViewModel.kt:100`），发布成功后从服务端重载（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketDetailViewModel.kt:110`）。

### 5. 审核状态映射

`MarketReviewState` 五态：PENDING、APPROVED、CHANGES_REQUESTED、REJECTED、WITHDRAWN（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:32`）。
`resolveMarketReviewSnapshot` 把服务端 `stateCode` 映射为五态：approved/open→APPROVED、changes_requested→CHANGES_REQUESTED、rejected/security_blocked→REJECTED、withdrawn/closed/removed→WITHDRAWN、其余→PENDING（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:129`）。
另有 `MarketV2PublisherEntrySummary` 版重载（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:146`）。
`MarketReviewReason` 十种原因，每种带 code 与 labelName，形如 reason:metadata-incomplete（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:39`）。

### 6. 主页、协议、通知、我的、管理、作者

`MarketHomeTab` 三 tab：ALL（全部）、CATEGORIES（分类）、MINE（我的）（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:109`）。
分类页 11 个固定分类（search_research、dev_code 等），各有名称资源与图标映射，未知分类 id 回退显示原文（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:128`）。

首次启动强制市场协议弹窗：`showMarketAgreementDialog` 初始值为 `!isAgreementAccepted()`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:191`）。
`MarketAgreementDialog` 有 `mandatory` 参数控制是否可关闭（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/MarketAgreementDialog.kt:28`）。
首次展示强制 5 秒倒计时：`repeat(5){delay(1000); remainingSeconds--}` 后才启用同意按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/MarketAgreementDialog.kt:37`）。
同意后调 `acceptCurrentAgreement()`（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:254`）。

通知页复用 `UnifiedMarketBrowseViewModel` 的独立实例（key="market-notifications"）（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:552`）。
发布入口提供制品、skill、mcp 三个选项（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:818`）。
我的页与管理页都有 GitHub 登录门控，未登录显示登录引导（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketManageScreen.kt:132`）。

管理页按 `UnifiedMarketManageKind` 五种（SCRIPT/PACKAGE/ARTIFACT/SKILL/MCP，其中 ARTIFACT 同时覆盖 script 与 package）分组自己发布的条目（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketManageViewModel.kt:24`），支持撤回（stateCode 置 "withdrawn"）、发新版。
管理界面四个类型 tab，条目按 relation 分 owner/contributor 两组（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketManageScreen.kt:68`）。
作者页按 authorId 拉取条目，同样分 owner/contributor 展示（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketAuthorScreen.kt:69`）。

顶栏搜索 `BindMarketSearchToTopBar` 把搜索框绑进顶栏标题区（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketTopBarSearchSupport.kt:45`）。
搜索框组合时自动请求焦点并弹键盘（`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketTopBarSearchSupport.kt:156`）。

## 关键符号

- `MarketInstallStage`（安装阶段枚举，9 阶段）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:7`
- `MarketInstallStateStore`（全局安装进度单例）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:27`
- `MarketInstallProgress`（stage + 可空 progress）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt:23`
- `MarketLocalInstallStateKind`（NOT_INSTALLED/INSTALLED/UPDATE_AVAILABLE）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:17`
- `writeMarketInstallMarker`（写标记）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:28`
- `resolveMarketLocalInstallStates`（扫描标记判三态）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:42`
- `findInstalledMarketMarkerRoots`（按 entryId 找标记根）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt:66`
- `MarketEntryInstallController.install`（按类型分发）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:30`
- `MarketV2Entry.canInstallFromUnifiedMarket()`（按钮可点判定）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt:220`
- `MarketReviewState`（审核五态）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:32`
- `MarketReviewReason`（十种审核原因）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:39`
- `resolveMarketReviewSnapshot`（stateCode 映射）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt:129`
- `UnifiedMarketScreen`（市场主页）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:177`
- `MarketHomeTab`（主页三 tab）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt:109`
- `MarketAgreementDialog`（5 秒强制协议弹窗）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/MarketAgreementDialog.kt:28`
- `UnifiedMarketBrowseScope`（浏览范围）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:38`
- `UnifiedMarketBrowseViewModel`（浏览/搜索/分页）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt:70`
- `MarketBrowseList`（懒加载列表）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt:96`
- `MarketBrowseSection`（列表+卡片泛型组装器）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseSection.kt:19`
- `MarketBrowseControls`（排序 chip + 精选开关）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseControls.kt:30`
- `MarketStatsSummary`（下载量展示）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseControls.kt:79`
- `MarketStatsType`（四种 wireValue）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketStatsSupport.kt:5`
- `MarketSortOption`（三种排序）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketStatsSupport.kt:9`
- `toRankMetric()`（排序→rank 参数）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketStatsSupport.kt:17`
- `UnifiedMarketDetailScreen`（详情纯展示，粘性双 tab）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt:232`
- `UnifiedMarketDetailEntryScreen`（详情编排，预览模式/版本切换/安装按钮）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt:96`
- `UnifiedMarketDetailViewModel`（详情 VM，安装/评论门控）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketDetailViewModel.kt:31`
- `MarketInteractionController`（评论/点赞/头像缓存）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt:35`
- `BindMarketSearchToTopBar`（顶栏搜索绑定）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketTopBarSearchSupport.kt:45`
- `UnifiedMarketManageKind`（管理页五种分组）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketManageViewModel.kt:24`
- `UnifiedMarketManageViewModel`（管理 VM）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketManageViewModel.kt:32`
- `UnifiedMarketAuthorViewModel`（作者 VM，按 authorId 拉取）：`app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketAuthorViewModel.kt:19`

## 输入→处理→输出调用链

1. **安装链路**：输入 = 用户点击安装 → 处理 = `ViewModel.installEntry` 调 `MarketInstallStateStore.start(entryId)` 抢占（失败静默返回）→ `MarketEntryInstallController.install` 按 type 分发（skill 仓库导入 / mcp 配置合并或仓库安装 / script-package 制品安装），期间 `update` 上报阶段与进度 → 输出 = 写 `.operit/market.json` 标记、`finish` 清理进度、`refreshLocalInstallStates` 刷新卡片状态。
2. **浏览加载链路**：输入 = 切 tab/分类/排序 → 处理 = `UnifiedMarketBrowseViewModel.loadEntries` 按 scope+sort 调服务端分页（rank metric），`combine` 做本地搜索过滤与精选过滤 → 输出 = `MarketBrowseList` 渲染卡片，滑到底部倒数第 2 个触发 `loadMoreEntries`。
3. **卡片状态链路**：输入 = entry + 全局安装进度 + 本地标记 → 处理 = 三级优先级（进行中安装 > 版本不兼容 > 本地标记三态）→ 输出 = `MarketBrowseActionState`（Installing/Available/Updatable/Installed/Unavailable）。
4. **评论链路**：输入 = 详情页打开 → 处理 = `loadEntryComments` 按 entryId 缓存（perPage=50），`sortMarketComments` 按 parentId 建树 → 输出 = 根倒序/子正序的评论列表；发布评论需 GitHub 登录，成功后从服务端重载。
5. **点赞链路**：输入 = entryLikes → 处理 = `loadEntryReactions` 本地合成 "+1" 条目，`addReactionToEntry` 调服务端追加 → 输出 = 反应 chip 列表（合成与真实混排）。

## 来源

种子文件（Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，21 文件共 7627 行）：

- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketScreen.kt`（1109 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketDetailEntryScreen.kt`（861 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketManageScreen.kt`（628 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/UnifiedMarketAuthorScreen.kt`（357 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/MarketAgreementDialog.kt`（101 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseList.kt`（644 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseControls.kt`（105 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseSection.kt`（77 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketBrowseEntryMappers.kt`（104 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketTopBarSearchSupport.kt`（230 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/UnifiedMarketDetailScreen.kt`（1460 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInteractionController.kt`（365 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketEntryInstallController.kt`（234 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallMarker.kt`（154 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketInstallStateStore.kt`（54 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketReviewStatus.kt`（160 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/market/MarketStatsSupport.kt`（34 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketBrowseViewModel.kt`（374 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketDetailViewModel.kt`（202 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketManageViewModel.kt`（262 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/packages/screens/market/viewmodel/UnifiedMarketAuthorViewModel.kt`（112 行）

- 机器可读事实：`ui-packages-market.facts.json`（118 条，引用逐条验真）
- 代码走查：`ui-packages-market.quality.json`（12 条：高危 3 / 警告 5 / 建议 4）
