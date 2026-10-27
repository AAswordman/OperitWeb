---
title: 主界面与导航骨架
module: UI / 主界面
sources: 27
date: 2026-10-01
issue: 110
---

# ui-main（主界面与导航骨架）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/main/`（17 个 Kotlin 文件）+ `ui/common/`（10 个 Kotlin 文件），共 27 文件、约 7,568 行 @ `dbf71916`

> 覆盖应用唯一 Activity 的启动编排、自研路由栈（原生路由 + toolpkg 插件路由合并）、返回守卫、路由级 ViewModelStore、抽屉/平板双布局与手势、侧边栏，以及顶栏/图标/波形/记住偏好等通用 UI 组件。

## 概述

Operit 的主界面是一套自研路由栈，没有用 Jetpack Navigation 的 NavController 做页面导航（`rememberNavController()` 只是创建出来传给各 Screen 的 Content 参数）。导航状态由 AppRouterState（一个可观察的 RouteEntry 列表）持有，MainActivity 负责系统级事件（Intent、返回键、插件加载、更新检查、显示设置），OperitApp 是 Compose 根组合，负责把路由栈渲染成屏幕，并处理抽屉/平板两种布局。

路由分两路来源：原生路由由 ScreenRouteRegistry 反射 Screen 的嵌套类注册（routeId 形如 native.ai_chat）；toolpkg 插件路由由 AppRouteCatalog 在 remember 里合并进来，统一排序后喂给侧边栏和工具箱。

## AI 速览

- **核心符号清单**：MainActivity、OperitApp、AppRouterState、AppRouterGateway、AppRouteDiscoveryGateway、AppRouteCatalog、ScreenRouteRegistry、Screen、RouteSpec、RouteEntry、NavigationEntrySpec、NavigationSurface、RouteBackGuardRegistry、ScreenRouteViewModelStoreOwnerManager、AppContent、DrawerContent、CollapsedDrawerContent、PhoneLayout、TabletLayout、NavItem、rememberLocal、WaveVisualizer、BrowserCallbackDialog、MaterialIconNameResolver、ProviderLogoLoader、RemoteLogoLoader、SharedFileHandler、PendingChatDraftHandler、GestureStateHolder。
- **主入口**：MainActivity.onCreate → setAppContent() → OperitApp → AppContent。
- **数据流向一句话**：系统 Intent/快捷方式/桌面小组件/脚本 → MainActivity.handleIntent 或 AppRouterGateway → AppRouterState 路由栈 → AppRouteCatalog.resolveScreen / ScreenRouteRegistry.screenFromEntry 解析出 Screen → AppContent 做转场渲染。

## 核心机制

### 1. MainActivity 的启动编排

MainActivity 是 ComponentActivity 子类，全应用唯一 Activity（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:67`）。

MainActivity 的 onCreate 先黑底防闪（`window.setBackgroundDrawableResource`），再调 `handleIntent` 与 `restoreRuntimeTaskViewVisibilityIfNeeded`（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:183`）。

接着依次执行 `(application as OperitApplication).initializeMainApplication()`、`initializeComponents()`、`anrMonitor.start()`、`configureDisplaySettings()`（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:191`）。

然后绑定 `pluginLoadingState`（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:198`）。

setAppContent 之后才 setupUpdateManager，避免遮挡首帧；performInitialChecks 只在 savedInstanceState == null 首次创建时执行（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:201`）。

Intent 分流在 handleIntent：ACTION_OPEN_SETTINGS_SHORTCUT 直跳 NavItem.Settings 并返回 true（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:246`）。

桌面小组件经 ToolPkgDesktopWidgetHost.EXTRA_OPEN_ROUTE_ID 与 EXTRA_OPEN_ROUTE_ARGS_JSON 传路由 id 和 JSON 参数（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:254`）。

parseRouteArgsJson 用 JSONObject 解析，值为 JSONObject.NULL 时转 null，失败返回空 Map（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:262`）。

ACTION_VIEW 的 http(s) 链接进 pendingSharedText，文件 URI 进 pendingSharedFileUris（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:268`）。

ACTION_SEND：单文件 URI 进 pendingSharedFileUris，纯文本进 pendingSharedText（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:280`）。

ACTION_SEND_MULTIPLE：多个文件 URI 列表进 pendingSharedFileUris（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:299`）。

processPendingSharedFiles 把待分享文件经 SharedFileHandler.setSharedFiles 桥给聊天界面（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:112`）。

processPendingSharedText 消费完把 pendingSharedText 置 null 防重复投递（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:122`）。

插件加载超时 30 秒由 pluginLoadingState.startTimeoutCheck(30000L, lifecycleScope) 设定（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:387`）。

显示加载界面后 delay(500) 让首帧先完成再初始化 MCP 服务（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:392`）。

插件加载界面 PluginLoadingScreenWithState 以 Modifier.zIndex(10f) 盖最上层（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:677`）。

返回键双击间隔 backPressedInterval 为 2000 毫秒，首次弹 press_back_again_to_exit 提示（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:438`）。

configureDisplaySettings 在 API 31+ 请求 window.setSustainedPerformanceMode(true)，失败捕获打日志（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:561`）。

API 30+ 按最高刷新率设置 window.attributes.preferredDisplayModeId（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:575`）。

API 23+ 设置 window.attributes.preferredRefreshRate（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:582`）。

强制设置 FLAG_HARDWARE_ACCELERATED 要求窗口硬件加速（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:589`）。

横竖屏切换弹 OrientationChangeDialog，用户确认后才 recreate()（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:687`）。

setupUpdateManager 只在 UpdateStatus.Available 与 UpdateStatus.PatchAvailable 时 Toast 提示（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:776`）。

界面显示 3 秒后 checkForUpdatesSilently(appVersion) 静默检查更新（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:784`）。

onDestroy 里 VirtualDisplayOverlay.hideAll() 隐藏所有虚拟显示覆盖层（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:463`）。

restoreRuntimeTaskViewVisibilityIfNeeded 在 AIForegroundService 未运行时恢复任务视图可见（`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:147`）。

### 2. 自研路由栈

路由原语在 AppNavigationModels.kt：RouteRuntime 只有 NATIVE 与 TOOLPKG_COMPOSE_DSL（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:12`）。

NavigationSurface 有 MAIN_SIDEBAR_AI、MAIN_SIDEBAR_TOOLS、MAIN_SIDEBAR_PLUGINS、MAIN_SIDEBAR_SYSTEM、TOOLBOX 五种（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:17`）。

NavigationEntryKind 区分 HOST 与 PLUGIN；RouteEntrySource 有 DEFAULT、DRAWER、SCRIPT（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:25`）。

RouteSpec 的 keepAlive 默认 false、reuseOnTop 默认 true（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:43`）。

RouteEntry 的 instanceId 默认 UUID.randomUUID().toString()（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:55`）。

AppRouterState.navigate 在 reuseOnTop 且同 routeId 同 args 时直接返回（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:99`）。

AppRouterState.resetTo 清空栈只留目标；pop 在栈剩一个时返回 null（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:119`）。

AppRouterGateway 的 handler 用 @Volatile 修饰，未安装时调用静默无操作（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:135`）。

AppRouterGateway.navigate 默认 source 为 RouteEntrySource.SCRIPT，供脚本调用（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:154`）。

AppRouteDiscoveryGateway.listRoutes 未安装时返回空列表（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppNavigationModels.kt:171`）。

OperitApp 定义三个 CompositionLocal：LocalTopBarActions、LocalTopBarTitleContent、LocalAppNavigationModel（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:66`）。

NavigationTransitionSource 只有 DEFAULT 与 DRAWER 两种（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:73`）。

OperitApp 用 AppRouteCatalog.build(context) 合并路由，navigationRevision 变化时重建（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:111`）。

requestRouteTransition 用 isRouteTransitionInProgress 串行化，忙时最多排队一次 queuedRouteTransition（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:144`）。

转场前调 routeBackGuardRegistry.canLeaveRoute(routeInstanceId)，被拦截静默丢弃（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:161`）。

navigateTo 同路由同参数直接返回；抽屉来源 resetTo 其余 navigate（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:244`）。

performGoBack 栈可弹 pop，否则 resetTo 回 Screen.AiChat（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:273`）。

navigateToNavigationEntry 对带 action 的插件项在 Dispatchers.IO 上执行并带事件载荷（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:289`）。

BackHandler 只在当前屏不是 Screen.AiChat 时启用（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:338`）。

平板判定 screenWidthDp >= 600；侧边栏 280dp、收起 64dp（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:346`）。

每 10 秒在 Dispatchers.IO 轮询 NetworkUtils 网络状态（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:396`）。

手机抽屉宽为屏宽 75%（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:435`）。

插件运行时变化时 navigationRevision 加一触发重建（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:441`）。

两个网关的 install/clear 放在 DisposableEffect，离组时 clear（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:449`）。

remoteAnnouncement 非空时弹 RemoteAnnouncementDialog（`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:581`）。

### 3. 路由注册：原生反射 + 插件合并

原生路由 id 由 nativeRouteIdForTypeName 生成：native. 前缀加 camelToSnakeCase（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:63`）。

ScreenRouteRegistry 反射扫描 Screen 全部嵌套类并按类简单名排序（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:78`）。

hostEntryDefinitions 集中声明原生路由：main.* 9 个、toolbox.* 18 个、hidden.* 4 个无展示面（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:110`）。

toEntry 把 Screen 实例塞进 args 的 INTERNAL_NATIVE_SCREEN_KEY（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:422`）。

screenFromEntry 优先从 args 直接取 Screen，取不到走 buildScreen（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:432`）。

buildScreen 用主构造 callBy 重建，convertArg 支持枚举与基础类型转换（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:440`）。

defaultScreenForNavItem 找不到时 requireNotNull 抛异常（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/ScreenRouteRegistry.kt:408`）。

AppRouteCatalog.build 把 toolpkg 路由 runtime 固定为 TOOLPKG_COMPOSE_DSL（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppRouteCatalog.kt:16`）。

toolpkg 导航项只收 TOOLBOX 与 MAIN_SIDEBAR_PLUGINS 两种 surface（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppRouteCatalog.kt:35`）。

toolpkg entryId 形如 toolpkg 冒号包名冒号 entryId（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppRouteCatalog.kt:41`）。

图标经 MaterialIconNameResolver.resolveOrDefault 解析，失败回退 Icons.Default.Extension（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppRouteCatalog.kt:46`）。

最终按 surface.ordinal、order、title 三级排序（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppRouteCatalog.kt:69`）。

resolveScreen 对 TOOLPKG_COMPOSE_DSL 构造 Screen.ToolPkgComposeDsl（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/AppRouteCatalog.kt:74`）。

Screen 基类约 60 个子类，Content() 默认空实现（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:131`）。

Screen.screenKey 对 keepAlive 屏用 stableScreenKey() 否则用路由实例 id（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:126`）。

AssistantConfig 的 participatesInCrossfadeTransition 为 false，注释称实时渲染视图转场留残影（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:714`）。

TokenUsageStatistics 的 usesRouteViewModelStore 为 true（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:1123`）。

ToolPkgComposeDsl 与 ToolPkgPluginConfig 的 stableScreenKey 为 toolpkg_keepalive 冒号包名冒号模块（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:1182`）。

Market 的 initialTab 参数经路由 args 传递（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:223`）。

Packages 的新建插件回调先 PendingChatDraftHandler.setPendingDraft 再跳 AI 聊天页（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:206`）。

GestureStateHolder.isChatScreenGestureConsumed 是全局手势标志（`app/src/main/java/com/ai/assistance/operit/ui/main/screens/OperitScreens.kt:1557`）。

### 4. 返回守卫与路由级 ViewModel

RouteBackGuardRegistry.register 返回注销 lambda，token 配对、synchronized(lock)（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/RouteBackGuard.kt:18`）。

无守卫时 canLeaveRoute 直接返回 true（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/RouteBackGuard.kt:35`）。

RegisterRouteBackGuard 用 DisposableEffect 自动注销，rememberUpdatedState 保最新 handler（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/RouteBackGuard.kt:45`）。

ScreenRouteViewModelStoreOwner 每个实例持全新 ViewModelStore，约定主线程使用（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwner.kt:18`）。

ScreenRouteViewModelStoreOwnerManager 是 Activity 级 ViewModel，跨配置变化保留（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwner.kt:33`）。

remove 会 viewModelStore.clear() 触发该路由所有 ViewModel 的 onCleared（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwner.kt:42`）。

retainOnly 清掉不在存活集合中的路由 ViewModel（`app/src/main/java/com/ai/assistance/operit/ui/main/navigation/ScreenRouteViewModelStoreOwner.kt:50`）。

### 5. AppContent：转场状态机

AppContent 用 screenCache（mutableStateMapOf）缓存屏幕 composable，rememberSaveableStateHolder 保状态（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:220`）。

页面转场 280ms，禁用导航动画时 400ms，抽屉接力 320ms（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:169`）。

转场状态机由 lastObservedCurrentKey、transitionFromKey、pendingRemovalKey、isTransitioning 驱动（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:475`）。

LaunchedEffect(currentScreenKey) 等动画结束再 retainOnly(aliveRouteKeys()) 清出栈路由 ViewModel（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:557`）。

renderKeys 只含 keepAlive 缓存键、过渡上一页键、当前页键（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:561`）。

每屏包 SaveableStateProvider 并注入 LocalIsCurrentScreen 与 LocalRouteInstanceId（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:573`）。

usesRouteViewModelStore 为 true 的屏幕经 LocalViewModelStoreOwner 拿路由专属 owner（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:459`）。

顶栏标题优先级：自定义聊天标题 > Screen.getTitle() > NavItem.titleResId（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:312`）。

返回键：可返回显示 ArrowBack；平板切换侧边栏；手机打开抽屉（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:340`）。

ImeWakeListeningEffect 在键盘弹出时挂起 AIForegroundService 的语音唤醒（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:117`）。

currentScreenUsesImePadding 为 true 的屏幕加 imePadding() 避让键盘（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:378`）。

FPS 计数器 FpsCounter 在 showFpsCounter 开启时悬浮右上（`app/src/main/java/com/ai/assistance/operit/ui/main/components/AppContent.kt:732`）。

### 6. 抽屉与平板布局

DrawerContent 分展开态与 CollapsedDrawerContent 平板收起态（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:123`）。

品牌名按 softwareIdentity 显示 Operit 或灵枢（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:146`）。

底部固定 Settings、Help、About 三个入口（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:156`）。

resolveSidebarPermissionStatus 按 `AndroidPermissionLevel` 五档（STANDARD、DEBUGGER、ACCESSIBILITY、ADMIN、ROOT，`app/src/main/java/com/ai/assistance/operit/core/tools/system/AndroidPermissionLevel.kt:11`）分支解析徽标文案（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:77`）。

DEBUGGER 档按 Shizuku 安装/服务运行/授权三步给徽标（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:90`）。

produceState 在 IO 线程查已启用包数、工作流数与权限徽标（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:167`）。

Packages/Workflow 快捷卡片带数字徽标（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:481`）。

点击导航项先 drawerState.close() 再执行导航（`app/src/main/java/com/ai/assistance/operit/ui/main/components/DrawerContent.kt:205`）。

PhoneLayout 用 updateTransition(drawerState.targetValue) 驱动，开 LowBouncy 关 NoBouncy（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/PhoneLayout.kt:94`）。

spring 刚度 1000f（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/PhoneLayout.kt:96`）。

内容位移 0.82 倍抽屉宽、下沉 12dp、缩放 0.92、Y 轴旋转 -7°、圆角 24dp、阴影 18dp（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/PhoneLayout.kt:114`）。

遮罩 Color.Transparent，点击关闭抽屉（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/PhoneLayout.kt:139`）。

全局横向 draggable 阈值 40px，聊天屏手势被消费时不抢（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/PhoneLayout.kt:144`）。

抽屉位移 -drawerWidth * (1 - progress)，缩放 0.92→1、透明度 0.72→1（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/PhoneLayout.kt:129`）。

TabletLayout 侧边栏宽动画 280ms、内容 Crossfade 160ms（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/TabletLayout.kt:72`）。

内容宽 = 屏宽 - 侧栏宽 + 1dp，注释写明解决右侧白线（`app/src/main/java/com/ai/assistance/operit/ui/main/layout/TabletLayout.kt:109`）。

### 7. 通用组件

rememberLocal 基于 ui_preferences DataStore，Boolean/Int/Long/Float/String 走原生键（`app/src/main/java/com/ai/assistance/operit/ui/common/RememberLocal.kt:28`）。

LaunchedEffect(key) 异步读初始值，失败回退默认值（`app/src/main/java/com/ai/assistance/operit/ui/common/RememberLocal.kt:42`）。

setter 值不变不写盘，变化时协程异步写（`app/src/main/java/com/ai/assistance/operit/ui/common/RememberLocal.kt:80`）。

WaveVisualizer 活跃 200dp、非活跃 120dp（`app/src/main/java/com/ai/assistance/operit/ui/common/WaveVisualizer.kt:115`）。

音量经 100ms tween 平滑（`app/src/main/java/com/ai/assistance/operit/ui/common/WaveVisualizer.kt:62`）。

rememberInfiniteTransition 常驻 4 路动画（`app/src/main/java/com/ai/assistance/operit/ui/common/WaveVisualizer.kt:56`）。

非活跃态 3 圈波环（0.2/0.6/1.0）+ 径向光晕 + 线框圆（`app/src/main/java/com/ai/assistance/operit/ui/common/WaveVisualizer.kt:98`）。

活跃态两条 120° 圆弧相隔 180° 旋转，线宽随音量 2~14dp（`app/src/main/java/com/ai/assistance/operit/ui/common/WaveVisualizer.kt:130`）。

SimpleAnimatedVisibility 只做 alpha 淡入淡出，归零后移除内容（`app/src/main/java/com/ai/assistance/operit/ui/common/animations/SimpleAnimation.kt:18`）。

BrowserCallbackDialog 的 WebView 禁多窗口 setSupportMultipleWindows(false)（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:58`）。

scheme/host/port/path 四元组匹配回调地址（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:66`）。

shouldOverrideUrlLoading 里捕获回调 URL（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:80`）。

onPageStarted 二次捕获，命中即 stopLoading（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:89`）。

captureCompletion 用 completionHandled 保证只触发一次（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:70`）。

超 expiresAt 未回调则 onFailure("Browser callback timed out")（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:113`）。

禁止点外部关闭，完成中禁用关闭与重载按钮（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:137`）。

销毁按 stopLoading → about:blank → clearHistory → destroy 释放 WebView（`app/src/main/java/com/ai/assistance/operit/ui/common/browser/BrowserCallbackDialog.kt:150`）。

MaterialIconNameResolver 用 ConcurrentHashMap 缓存，图标名转 PascalCase（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/MaterialIconNameResolver.kt:8`）。

反射 filled 图标包的 Kt 类取图标（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/MaterialIconNameResolver.kt:31`）。

resolveOrDefault 失败回退默认图标（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/MaterialIconNameResolver.kt:40`）。

ProviderLogoLoader 从 assets/model_logos/{type}/ 取首个 svg/png（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/ProviderLogoLoader.kt:38`）。

load 要求 sizePx > 0 否则 require 抛异常（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/ProviderLogoLoader.kt:97`）。

AndroidSVG 渲染为 ARGB_8888 Bitmap 并等比缩放居中（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/ProviderLogoLoader.kt:131`）。

缩放后 source.recycle() 回收原图（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/ProviderLogoLoader.kt:157`）。

深色背景（亮度 < 0.5）时 providerLogoColorFilter 加 onSurface 着色（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/ProviderLogoLoader.kt:215`）。

RemoteLogoLoader 只允许 https，非 https 返回 null（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/RemoteLogoLoader.kt:52`）。

单张上限 512KB（MAX_LOGO_BYTES），内存缓存 4MB（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/RemoteLogoLoader.kt:31`）。

连接超时 15 秒、读取 20 秒，followSslRedirects(false)（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/RemoteLogoLoader.kt:43`）。

先查 contentLength，流式累计超限即中断（`app/src/main/java/com/ai/assistance/operit/ui/common/icons/RemoteLogoLoader.kt:81`）。

ImeBringIntoView.bringIntoViewOnImeFocus() 聚焦后等一帧再 bringIntoView（`app/src/main/java/com/ai/assistance/operit/ui/common/input/ImeBringIntoView.kt:25`）。

NavItem 共 15 个导航对象（`app/src/main/java/com/ai/assistance/operit/ui/common/NavItem.kt:24`）。

AiChat 图标是 Icons.Default.Email（`app/src/main/java/com/ai/assistance/operit/ui/common/NavItem.kt:24`）。

Help 用 Icons.AutoMirrored.Filled.Help 做 RTL 适配（`app/src/main/java/com/ai/assistance/operit/ui/common/NavItem.kt:46`）。

OperitUtilityTheme 跟随系统深浅色切换（`app/src/main/java/com/ai/assistance/operit/ui/common/OperitUtilityTheme.kt:12`）。

PendingChatDraftHandler 是 MutableStateFlow<String?> 单例（`app/src/main/java/com/ai/assistance/operit/ui/main/PendingChatDraftHandler.kt:7`）。

SharedFileHandler 有 sharedFiles、sharedFileText、sharedText 三路 StateFlow（`app/src/main/java/com/ai/assistance/operit/ui/main/SharedFileHandler.kt:12`）。

clearSharedFiles 同时清空三路（`app/src/main/java/com/ai/assistance/operit/ui/main/SharedFileHandler.kt:34`）。

LocalAppBarContentColor 默认 Color.Unspecified（`app/src/main/java/com/ai/assistance/operit/ui/main/components/LocalAppBarContentColor.kt:5`）。

## 关键符号

| 符号 | 一句话 |
|---|---|
| MainActivity | 唯一 Activity：Intent 分流、插件加载、更新、显示设置、双击退出 |
| OperitApp | Compose 根：驱动路由栈、抽屉/平板布局、网关安装、顶栏状态 |
| AppRouterState | 可观察 RouteEntry 列表：navigate/resetTo/pop |
| AppRouterGateway | 全局导航单例网关，脚本用 source=SCRIPT 调导航 |
| AppRouteCatalog | 合并原生 + toolpkg 路由并排序，resolveScreen 解析 Screen |
| ScreenRouteRegistry | 反射注册原生路由，toEntry/screenFromEntry/buildScreen |
| Screen | 密封类，约 60 子类，5 个 open 属性控制转场/保活/ViewModel |
| RouteBackGuardRegistry | 返回守卫注册表，token 配对 |
| ScreenRouteViewModelStoreOwnerManager | Activity 级 ViewModel，按路由 key 持有独立 ViewModelStore |
| AppContent | 顶栏 + 转场状态机 + screenCache + 路由 ViewModel 清理 |
| DrawerContent / CollapsedDrawerContent | 展开/收起两态侧边栏 |
| PhoneLayout / TabletLayout | 手机抽屉 3D 转场 / 平板常驻侧边栏 |
| NavItem | 15 个导航对象（route + titleResId + icon） |
| rememberLocal | DataStore 读写穿透的 compose 偏好 |
| WaveVisualizer | 语音波形动画 |
| BrowserCallbackDialog | OAuth 回调 WebView 对话框 |
| MaterialIconNameResolver / ProviderLogoLoader / RemoteLogoLoader | 图标名反射 / assets logo / 远程 logo |
| SharedFileHandler / PendingChatDraftHandler | 系统分享桥接 / 待发送草稿单例 |

## 调用链

1. **冷启动**：输入=点击图标 → 处理=MainActivity.onCreate（黑底→handleIntent→初始化→anrMonitor→显示设置→setAppContent→更新管理）→ 输出=OperitApp 渲染首屏 Screen.AiChat。
2. **快捷方式/小组件导航**：输入=带 routeId 与 JSON args 的 Intent → 处理=handleIntent 解析 → OperitApp 去重 → AppRouteCatalog.resolveScreen（原生走 ScreenRouteRegistry.screenFromEntry，插件走 ToolPkgComposeDsl）→ requestRouteTransition 先过 canLeaveRoute → 输出=AppRouterState.navigate 入栈。
3. **抽屉导航**：输入=点击导航项 → 处理=drawerState.close() → navigateTo(fromDrawer=true) → resetTo 清栈 → 输出=AppContent 跑抽屉接力转场（320ms），动画结束 retainOnly 清旧路由 ViewModel。
4. **返回**：输入=系统返回键 → 处理=BackHandler（非聊天页）→ requestGoBack() → canLeaveRoute 拦截则丢弃 → 输出=performGoBack（可弹 pop 否则 resetTo(AiChat)）；聊天页走 Activity 双击退出。
5. **系统分享进聊天**：输入=ACTION_SEND → 处理=pendingSharedFileUris/pendingSharedText → onResume 时 SharedFileHandler.setSharedFiles/setSharedText → 输出=AI 聊天屏消费。
6. **OAuth 回调**：输入=授权 URL → 处理=BrowserCallbackDialog 加载 → shouldOverrideUrlLoading/onPageStarted 任一命中四元组 → captureCompletion（completionHandled 防重）→ stopLoading → 输出=onCompletion(uri)；超时输出 onFailure。
7. **记住偏好**：输入=rememberLocal(key, default) → 处理=LaunchedEffect 读 DataStore → 输出=State；setter 变化时协程写盘。

## 来源

- 原子事实 173 条（`ui-main.facts.json`），引用全部实地验真：文件存在、行号在界、断言符号落在引用行 ±5 行内。
- 代码走查 14 条（`ui-main.quality.json`）：警告 7（高刷属性未 setAttributes、硬件加速标志无效、buildScreen 静默失败、screenCache 正向堆积、anrMonitor lateinit、rememberLocal 读写竞态、回调端口精确匹配）、建议 7（网关并发、主线程反射图标、守卫无反馈、logo 重定向、波形空转、assets.list 公开 API、抽屉徽标刷新 key）。
