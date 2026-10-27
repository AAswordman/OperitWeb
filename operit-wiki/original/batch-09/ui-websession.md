---
title: 内置浏览器界面
module: app
sources: 12
date: 2026-10-01
issue: 115
batch: batch-09
---

# 内置浏览器界面

## 概述

内置浏览器（WebSession）是 Operit 内嵌的完整网页浏览界面：多标签页、地址栏、书签、历史、下载管理、用户脚本（油猴类脚本），全部跑在一个悬浮窗（overlay window）里。它不是系统浏览器，而是一套纯 Compose 写的浏览器"铬"（chrome：地址栏、工具栏、弹窗），真正的网页渲染由 `WebSessionWebViewHost` 挂载的原生 WebView 负责。

为什么放在悬浮窗里？因为 WebSession 是 AI 工具链的一部分——助手可以在对话中途打开网页、用户也可以手动浏览，两者共享同一套标签页状态。悬浮窗意味着它可以盖在任何界面上、最小化成一个悬浮球继续"活着"，而不是像普通 Activity 那样一切换就销毁。

## AI 速览

核心符号（一行一个）：

- `WebSessionBrowserScreen` — 浏览器全屏根组件，组装地址栏、网页区、工具栏与底部弹窗
- `WebSessionBrowserHostState` — UI 侧状态（编辑态、弹窗路由、chrome 高度等），通过 `onHostStateChange` 用 `copy` 更新
- `WebSessionBrowserState` — 浏览器内核状态（标签页、当前 URL、下载计数等，来自 core 层）
- `WebSessionTopUrlBar` — 顶部地址栏（编辑/展示两态、书签星标、刷新/停止、最小化）
- `WebSessionBottomToolbar` — 底部工具栏（前进、后退、新建、标签计数、菜单）
- `WebSessionBrowserSheetRoute` — 底部弹窗路由：TABS / MENU / DOWNLOADS / HISTORY / BOOKMARKS / USERSCRIPTS / NONE
- `WebSessionWebViewHost.attachContainer` — 把 WebView 挂到 Compose 的 `AndroidView` 容器上
- `WebSessionMinimizedIndicator` — 最小化后的悬浮球（可拖拽、带下载徽标）
- `WebSessionFloatingTheme` — 跟随悬浮窗主题（优先活的 `FloatingChatService`，否则读 SharedPreferences 快照）
- `normalizeNavigationUrl` / `normalizeLookupUrl` — 地址栏输入归一化 / 书签比对用 URL 归一化

主入口：`WebSessionBrowserScreen(hostState, …, webViewHost, onNavigate, …)`（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:54`）。

数据流向一句话：用户操作地址栏/工具栏/弹窗 → 回调进 core 层的浏览器状态机 → `WebSessionBrowserState` 变化 → Compose 重组刷新地址栏、网页区与弹窗。

## 核心机制

### 1. 浏览器"铬"与网页区的分层

WebSessionBrowserScreen 纵向三段：顶部 WebSessionTopUrlBar、中间网页区、底部 WebSessionBottomToolbar（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:54`）。中间网页区有两种形态：`activeSessionId == null` 时显示无标签页空态（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:249`）；有激活会话时用 AndroidView 嵌入一个白色背景的 FrameLayout，并调用 `webViewHost.attachContainer(this)` 把 core 层持有的 WebView 挂进去（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:294`），重组时 update 块重新挂载（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:298`）。Compose 只负责"铬"，网页渲染与导航状态机在 core 层。

### 2. chrome 高度测量回写

浏览器需要知道地址栏+工具栏占了多高（用来调整网页可视区）。做法：`LaunchedEffect` 监听总高度与浏览器区高度，`chromeHeightPx = (totalHeightPx - browserAreaHeightPx).coerceAtLeast(0)`（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:102`），变化时通过 `onHostStateChange { current.copy(...) }` 写回 WebSessionBrowserHostState（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:104`）。纯派生值、单向回写，避免循环重组。

### 3. 地址栏两态与 URL 归一化

WebSessionTopUrlBar 有展示态和编辑态。展示态整条可点击进入编辑（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:181`）；编辑态是 BasicTextField，键盘动作为 `ImeAction.Go`，按 Go 或点箭头按钮即提交（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:152`）。提交时先 normalizeNavigationUrl：空输入→`about:blank`；`http/https/about:` 原样保留；无空格含点的裸域名自动补 `https://`（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:736`）。图标按协议切换：https 显示锁形，否则显示地球（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:189`）。加载中时刷新按钮变为停止（Close 图标），下方出现 2.dp 进度条（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:255`、`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:292`）。

书签判定用另一套归一化 normalizeLookupUrl：空、`about:`/`blob:`/`data:`、非 http(s) 直接返回 null 不参与比对；同时去掉 http 80 / https 443 默认端口、保留查询串（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:765`），比对结果缓存为 isBookmarked（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:127`）。地址栏星标实心/描边即反映该值（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:215`）。

### 4. 底部弹窗路由（不用 ModalBottomSheet）

所有二级界面（标签、菜单、下载、历史、书签、用户脚本）都是底部弹窗，由 WebSessionBrowserSheetRoute 枚举路由（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:489`）。打开时先铺一层 0.42 透明度 scrim，点击关闭（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:343`）。注意这里**故意不用** ModalBottomSheet，注释写明了原因：WebSession 跑在 overlay 窗口里，dialog 式窗口拿不到有效的 activity token（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:351`）。弹窗容器是普通 Surface，顶部圆角 18.dp，带 navigationBarsPadding + imePadding（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:361`）。

### 5. 标签页、历史、书签、下载

- **标签**（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTabSheet.kt:32`）：LazyColumn 以 sessionId 为 key（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTabSheet.kt:55`），当前标签高亮并标注"当前标签页"（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTabSheet.kt:72`）；底部工具栏的数字按钮显示 currentTabNumber（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBottomToolbar.kt:234`），currentTabNumber 取自 `tabs.indexOfFirst { it.isActive } + 1`（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:122`）。
- **历史**（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionHistorySheet.kt:32`）：分"当前会话"与"最近浏览"两节；时间用 `DateFormat.SHORT`（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionHistorySheet.kt:40`）；全局条目以 `url-visitedAt` 为 key（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionHistorySheet.kt:160`）；非空时可一键清除（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionHistorySheet.kt:143`）。
- **书签**（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBookmarkSheet.kt:31`）：以 url 为 key，点击打开、右侧按钮删除（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBookmarkSheet.kt:53`、`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBookmarkSheet.kt:100`）。
- **下载**（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionDownloadSheet.kt:35`）：过滤器三档——进行中（含 queued/connecting/downloading/paused/canceled）、已完成、失败（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionDownloadSheet.kt:53`）；任务卡片按 `canPause/canResume/canCancel/canRetry/canOpenFile/canOpenLocation/canDelete` 条件展示操作按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionDownloadSheet.kt:182`）；删除分"仅删记录"与"连文件一起删"（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionDownloadSheet.kt:212`）；进行中时主界面顶部还有一条汇总条，点击跳下载弹窗（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:210`）。

### 6. 用户脚本（油猴）管理

WebSessionUserscriptSheet（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:51`）分四块：从 URL 安装（输入框默认占位 `https://example.com/script.user.js`，`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:96`）、安装预览、页面脚本菜单、已安装库。不支持的设备整页显示原因（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:78`）。安装预览卡展示脚本名、版本、grants、connects 等元信息，未知权限用红色警告（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:296`），blockedReasons 会过滤掉 `Unknown grants:` 前缀条目（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:211`）。已安装脚本可开关（Switch → onSetScriptEnabled，`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:400`）、检查更新、删除（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:521`）。每条脚本在当前页面的运行状态有七种：DISABLED / UNSUPPORTED / NOT_MATCHED / QUEUED / RUNNING / SUCCESS / ERROR（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:549`），无状态时按"未启用→DISABLED，有阻塞原因→UNSUPPORTED，否则→NOT_MATCHED"兜底（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:599`）。

### 7. 最小化悬浮球与主题跟随

点最小化后浏览器缩成一个悬浮球 WebSessionMinimizedIndicator（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:56`）：可拖拽（detectDragGestures 取整回调 onDragBy，`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:69`），点击恢复全屏（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:199`），带三种无限动画（上下浮动/摇摆/呼吸缩放，`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:143`）。有下载进行中图标变为下载箭头，徽标显示数量（上限 9），有失败时显示感叹号并变红（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:238`、`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:246`）。有外部打开待确认时悬浮球直接展开为确认卡（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:74`）。

主题上浏览器跟随悬浮窗：优先取活的 FloatingChatService 的主题，否则读 floating_chat_prefs 里存的配色/字体 JSON 快照，并监听其变化实时刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionFloatingTheme.kt:51`、`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionFloatingTheme.kt:41`）。

### 8. 网页对话框与外部打开确认

网页的 `alert/confirm/prompt` 由 core 层转成 pendingDialog 状态，UI 叠加 PendingDialogOverlay：按类型小写匹配三种标题（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:451`），prompt 型带输入框（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:462`），alert 型不显示取消按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:474`）。网页想调起外部 App 时，先弹确认条（ExternalOpenPromptBar，`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:653`），用户点"仅允许一次"才放行。

## 关键符号

| 符号 | 职责 | 位置 |
|---|---|---|
| `WebSessionBrowserScreen` | 浏览器根组件，组装三段式布局与弹窗路由 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:54` |
| `normalizeNavigationUrl` | 地址栏输入归一化（补 https://、空→about:blank） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:736` |
| `normalizeLookupUrl` | 书签比对用 URL 归一化（去默认端口、过滤特殊 scheme） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:758` |
| `WebSessionTopUrlBar` | 顶部地址栏（两态、书签星标、刷新/停止、最小化） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:49` |
| `WebSessionBottomToolbar` | 底部工具栏（前进/后退/新建/标签计数/菜单） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBottomToolbar.kt:35` |
| `WebSessionBrowserSheetRoute` | 底部弹窗路由枚举（TABS/MENU/DOWNLOADS/HISTORY/BOOKMARKS/USERSCRIPTS/NONE） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:489` |
| `WebSessionOverlaySheetContent` | 按路由分发六个底部弹窗 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:489` |
| `WebSessionTabSheet` | 标签页管理弹窗 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTabSheet.kt:32` |
| `WebSessionMenuSheet` | 主菜单弹窗（历史/书签/下载/脚本/桌面模式/关标签） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMenuSheet.kt:32` |
| `WebSessionDownloadSheet` | 下载管理弹窗（三档过滤+任务卡片） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionDownloadSheet.kt:35` |
| `WebSessionHistorySheet` | 历史记录弹窗（会话历史+全局历史） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionHistorySheet.kt:32` |
| `WebSessionBookmarkSheet` | 书签弹窗 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBookmarkSheet.kt:31` |
| `WebSessionUserscriptSheet` | 用户脚本管理弹窗 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:51` |
| `PendingInstallCard` | 脚本安装预览卡（元信息+权限警告+确认） | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:206` |
| `RuntimeStatusLine` | 脚本七态运行状态行 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:543` |
| `WebSessionSheetScaffold` | 底部弹窗统一脚手架 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionSheetDecor.kt:29` |
| `WebSessionMinimizedIndicator` | 最小化悬浮球 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:56` |
| `WebSessionFloatingTheme` | 跟随悬浮窗主题 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionFloatingTheme.kt:32` |
| `WebSessionWebViewHost.attachContainer` | 把 core 层 WebView 挂到 Compose 容器 | `app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:294` |

## 调用链

**打开网址**：输入→用户在地址栏输入并提交 → 处理→`normalizeNavigationUrl` 归一化 → `onNavigate(target)` 进 core 状态机 → 输出→WebView 加载，地址栏退出编辑态（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionBrowserScreen.kt:175`）。

**切换标签**：输入→点底部数字按钮 → 处理→`sheetRoute = TABS` 打开标签弹窗 → 点某标签 `onSelectTab(sessionId)` → 输出→WebSessionBrowserState 切换激活会话并关闭弹窗（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTabSheet.kt:57`）。

**安装用户脚本**：输入→在脚本弹窗输入 URL 点安装 → 处理→`onInstallFromUrl(installUrl)` 解析出 pendingInstall 预览 → 用户确认 onConfirmInstall → 输出→脚本进入已安装库（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:108`、`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionUserscriptSheet.kt:323`）。

**最小化与恢复**：输入→点地址栏最小化按钮 → 处理→浏览器缩为 WebSessionMinimizedIndicator 悬浮球（可拖拽） → 输出→点击悬浮球 onToggleFullscreen 恢复全屏（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionTopUrlBar.kt:281`、`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/WebSessionMinimizedIndicator.kt:199`）。

## 来源

12 个种子文件（`app/src/main/java/com/ai/assistance/operit/ui/features/websession/browser/`，共 3531 行，100% 已读）：

- `WebSessionBrowserScreen.kt`（796 行）：根组件、弹窗路由、URL 归一化、下载汇总条、外部打开确认、网页对话框
- `WebSessionTopUrlBar.kt`（316 行）：地址栏两态、书签星标、刷新/停止、最小化
- `WebSessionBottomToolbar.kt`（241 行）：底部五操作位
- `WebSessionTabSheet.kt`（172 行）：标签页管理弹窗
- `WebSessionMenuSheet.kt`（207 行）：主菜单弹窗
- `WebSessionBookmarkSheet.kt`（112 行）：书签弹窗
- `WebSessionHistorySheet.kt`（223 行）：历史记录弹窗
- `WebSessionDownloadSheet.kt`（264 行）：下载管理弹窗
- `WebSessionUserscriptSheet.kt`（636 行）：用户脚本管理弹窗
- `WebSessionSheetDecor.kt`（197 行）：弹窗脚手架/分节标题/卡片/空态
- `WebSessionFloatingTheme.kt`（87 行）：主题跟随
- `WebSessionMinimizedIndicator.kt`（280 行）：最小化悬浮球

源码钉住 `Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`。
