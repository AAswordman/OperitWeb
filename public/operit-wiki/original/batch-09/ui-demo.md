---
title: 权限引导与演示界面
module: UI / 权限与演示
sources: 10
date: 2026-10-01
issue: 117
---

# ui-demo（权限引导与演示界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/demo/`（10 个 Kotlin 文件、约 3,864 行）@ `dbf71916`

> 覆盖应用的权限总览卡片、五档权限级别切换、四张分步设置向导卡（无障碍 / Root / Shizuku / 终端环境）、权限状态刷新管线与示例命令库。

## 概述

ui-demo 是 Operit 的"权限中控台"：一个界面把应用运行所需的全部权限与能力状态收拢展示。顶部的 PermissionLevelCard 让用户在标准（STANDARD）、无障碍（ACCESSIBILITY）、管理员（ADMIN）、调试（DEBUGGER）、Root（ROOT）五档权限级别之间浏览与切换；下方按当前浏览级别自动出现对应的设置向导卡，一步一步引导用户完成安装、启动、授权。状态由 DemoStateManager 统一持有，经 ShizukuDemoViewModel 暴露给界面；刷新管线一次检测 Shizuku、存储、悬浮窗、电池优化、位置、无障碍、Root、NodeJS/Python 环境共十余项状态。

## AI 速览

- **核心符号清单**：ShizukuDemoScreen、ShizukuDemoViewModel、DemoStateManager、DemoScreenState、refreshPermissionsAndStatus、refreshNodejsPythonEnvironment、PermissionLevelCard、PermissionLevelSelector、PermissionSectionContainer、PermissionStatusItem、FeatureGrid、isFeatureSupported、CommandResultDialog、SampleCommandsCard、FeatureErrorCard、ShizukuWizardCard、RootWizardCard、AccessibilityWizardCard、OperitTerminalWizardCard、getSampleAdbCommands、getOperitTerminalSampleCommands、getRootSampleCommands。
- **主入口**：ShizukuDemoScreen（Compose 可组合函数）→ LaunchedEffect 调 ShizukuDemoViewModel.initializeAsync → DemoStateManager.initializeAsync / refreshStatusAsync。
- **数据流向一句话**：界面启动收集 uiState → ViewModel 读 Root/Shizuku 授权器与系统 API → refreshPermissionsAndStatus 逐项检测 → DemoScreenState 更新 → PermissionLevelCard 与四张向导卡按状态渲染。

## 核心机制

### 1. 状态持有：DemoStateManager

DemoStateManager 继承 ViewModel，构造参数为 (context, coroutineScope)（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:39`）。

_uiState 是 MutableStateFlow(DemoScreenState())，对外只暴露只读的 uiState: StateFlow（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:41`）。

isPnpmInstalled、isPythonInstalled、isNodejsPythonEnvironmentReady 三个 MutableState 单独跟踪 NodeJS/Python 环境（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:45`）。

shizukuListener 与 rootListener 两个回调都指向 refreshStatus()（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:50`）。

init 块向 ShizukuAuthorizer 与 RootAuthorizer 注册状态监听，并在协程里跑一次 refreshAllStates()（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:55`）。

updateRootStatus 写入设备 Root 与应用 Root 授权两个状态；设备已 Root 但应用未获授权时自动把 showRootWizard 置 true（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:82`）。

updateOutputText 是空实现，仅为兼容旧调用保留（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:99`）。

showResultDialog / hideResultDialog 控制结果对话框的标题、内容与显隐（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:104`）。

四个向导开关 toggleShizukuWizard / toggleOperitTerminalWizard / toggleRootWizard / toggleAccessibilityWizard 翻转各自 show 标志（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:121`）。

toggleAdbCommandExecutor 与 toggleSampleCommands 控制命令执行器与示例命令区的显隐（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:151`）。

cleanup() 移除 Shizuku 与 Root 的两个状态监听（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:178`）。

refreshAllStates 目前只做 refreshNodejsPythonEnvironment；refreshAllStatesPublic 是它的协程包装（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:187`）。

registerStateChangeListeners 是空实现，实际监听注册在 init 块完成（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:200`）。

### 2. 刷新管线：refreshStatusAsync 与 refreshPermissionsAndStatus

refreshStatusAsync 先把 isRefreshing 置 true，然后调用 refreshPermissionsAndStatus 并传入 12 个状态更新 lambda（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:217`）。

Shizuku 已安装且运行中时，用 ShizukuAuthorizer.hasShizukuPermission() 查 API_V23 授权；缺授权就自动展开 Shizuku 向导卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:245`）。

Shizuku 未安装或未运行时，hasShizukuPermission 置 false 且同样展开向导（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:251`）。

刷新完成后 delay(300) 让 UI 有时间重绘，再把 isRefreshing 置 false；异常打日志并在 finally 复位（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:262`）。

refreshPermissionsAndStatus 检测 Shizuku 安装、运行、授权三态（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:344`）。

OperitTerminal 的"已安装"状态被替换为 NodeJS/Python 环境就绪度检查，写入 isOperitTerminalInstalled（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:359`）。

存储权限：Android 11+ 用 Environment.isExternalStorageManager()，低版本同时查读写权限（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:397`）。

位置权限取 ACCESS_FINE_LOCATION 与 ACCESS_COARSE_LOCATION 任一已授权即算通过（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:410`）。

悬浮窗权限用 Settings.canDrawOverlays(context) 判断（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:418`）。

电池优化豁免用 PowerManager.isIgnoringBatteryOptimizations(packageName) 判断（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:421`）。

无障碍提供者用 UIHierarchyManager.isProviderAppInstalled(context) 检测，装好后立即 bindToService（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:427`）。

### 3. NodeJS/Python 环境检测

refreshNodejsPythonEnvironment 先拿 MCPSharedSession.getOrCreateSharedSession(context)；拿不到 session 就三项全置 false（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:277`）。

pnpm 检测在终端里执行 `command -v pnpm`，输出含 "pnpm" 算已安装（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:287`）。

python 检测先执行 `command -v python`，不存在再查 `command -v python3`（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:290`）。

pip 只在 python 存在时检测：先 `command -v pip`，再 `command -v pip3`；isPythonInstalled = hasPython && hasPip（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:301`）。

isNodejsPythonEnvironmentReady = isPnpmInstalled && isPythonInstalled，两者缺一都不算就绪（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:316`）。

### 4. ViewModel 代理层

ShizukuDemoViewModel 继承 AndroidViewModel，内部直接 new 出 DemoStateManager(application, viewModelScope)（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:21`）。

toolHandler = AIToolHandler.getInstance(application)，供刷新工具时用（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:26`）。

uiState: StateFlow<DemoScreenState> 直接代理自 stateManager；pnpm/python/就绪三个属性同样代理（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:29`）。

initialize() 先 RootAuthorizer.initialize(context)，再调 stateManager.initialize()（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:41`）。

initializeAsync 在 Dispatchers.IO 上初始化 RootAuthorizer，读 isRooted/hasRootAccess 后切 Main 线程更新状态，最后关 loading（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:54`）。

refreshStatus 先 checkRootStatus 再调 stateManager.refreshStatus()（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:81`）。

checkRootStatus 用 RootAuthorizer.isDeviceRooted() 与 checkRootStatus(context) 刷新两个 Root 状态（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:88`）。

requestRootPermission：已有 Root 权限直接执行测试命令 `id`；否则 Toast 后经 RootAuthorizer.requestRootPermission 请求，授权成功再执行 `id`（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:101`）。

executeRootCommand 把 RootAuthorizer.executeRootCommand 的结果拼成文本写入 resultText，成功失败都 Toast（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:129`）。

refreshTools 先 toolHandler.reset() 清空工具执行状态，再 registerDefaultTools() 重注册全部默认工具并 Toast（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:182`）。

onCleared 调 stateManager.cleanup() 解注册监听；Factory 按 ViewModelProvider.Factory 模式构造（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:197`）。

### 5. 屏幕组装：ShizukuDemoScreen

ShizukuDemoScreen 是顶层可组合函数，viewModel 参数默认用 ShizukuDemoViewModel.Factory 构造，navigateTo 回调可空（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:44`）。

uiState 经 viewModel.uiState.collectAsState() 收集；currentDisplayedPermissionLevel 初始为 STANDARD（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:60`）。

locationPermissionLauncher 一次请求精粗两个位置权限，任一 granted 就在 IO 线程刷新状态（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:68`）。

DisposableEffect(Unit) 额外注册一个 Shizuku 状态监听，onDispose 时移除（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:82`）。

LaunchedEffect(Unit) 置 loading，在 IO 线程跑完 initializeAsync 后把 isInitialized 置 true（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:96`）。

无障碍提供者的已安装/内置/需更新三元组用 remember(uiState.isRefreshing.value) 缓存，随刷新失效（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:129`）。

手动刷新时先清 AccessibilityProviderInstaller 与 ShizukuInstaller 的版本缓存再调 viewModel.refreshStatus（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:173`）。

存储权限点击：Android 11+ 跳 ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION，低版本跳应用详情页，双层 try/catch 失败弹 Toast（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:182`）。

悬浮窗、电池优化、无障碍点击分别跳对应的系统设置页（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:203`）。

安装无障碍提供者：在 IO 线程，未安装则调 UIHierarchyManager.launchProviderInstall（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:234`）。

Shizuku 未完全设置时点击状态项弹向导；终端状态项点击总是打开向导；Root 状态项只在当前浏览级别为 ROOT 时响应（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:255`）。

onPermissionLevelChange 更新当前浏览级别；onPermissionLevelSet 在用户设为当前级别后触发 refreshTools（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:279`）。

needOperitTerminalSetupGuide = !isNodejsPythonEnvironmentReady，环境没就绪就显示终端向导（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:270`）。

needShizukuSetupGuide 要求当前浏览级别为 DEBUGGER，且（Shizuku 未完全设置）或（完全设置但有更新可用）（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:285`）。

needRootSetupGuide 要求浏览级别为 ROOT 且应用未获 Root 授权（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:296`）。

needAccessibilitySetupGuide 要求浏览级别为 ACCESSIBILITY 且（提供者未安装 / 服务未启用 / 有更新）（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:300`）。

四者任一成立即显示"设置向导"标题区（Build 图标 + 分割线），随后按需堆叠各向导卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:307`）。

### 6. 四张向导卡的回调接线

AccessibilityWizardCard 的安装/更新回调都在 IO 线程调 UIHierarchyManager.launchProviderInstall；打开设置回调跳系统无障碍设置页（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:347`）。

RootWizardCard 的请求 Root 回调在 IO 线程调 viewModel.requestRootPermission；看教程回调打开 magiskmanager.com（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:380`）。

ShizukuWizardCard 的从商店安装回调打开 shizuku.rikka.app 中文下载页（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:407`）。

内置安装回调：在 IO 线程用 ShizukuInstaller.extractApkFromAssets(context) 从 assets 提取 APK，FileProvider 生成 URI 后用 ACTION_VIEW 拉起安装（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:424`）。

打开 Shizuku 回调用 getLaunchIntentForPackage("moe.shizuku.privileged.api") 拉起（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:509`）。

看教程回调打开 shizuku.rikka.app 官方配置指南页（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:528`）。

请求授权回调调 ShizukuAuthorizer.requestShizukuPermission，结果 Toast 后在 IO 线程刷新状态（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:537`）。

更新 Shizuku 回调走与安装相同的"提取 assets APK + 安装 intent"流程（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:573`）。

OperitTerminalWizardCard 的打开终端回调经 navigateTo?.invoke(Screen.TerminalSetup) 跳转（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:674`）。

### 7. 权限级别卡片

PermissionLevelCard 用 androidPermissionPreferences.preferredPermissionLevelFlow.collectAsState(STANDARD) 读当前激活级别（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:92`）。

displayedPermissionLevel 是独立于激活级别的"浏览级别"，变化经 LaunchedEffect 通知父组件（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:97`）。

权限描述区用 AnimatedContent 做横滑 + 淡入淡出过渡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:195`）。

浏览级别与激活级别不一致时显示"设为当前级别"按钮：保存偏好、清 AndroidShellExecutor 的级别缓存、Toast 提示、触发 onPermissionLevelSet（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:209`）。

已是激活级别时显示带 CheckCircle 的"当前正在使用"行（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:235`）。

刷新按钮带 360° 旋转动画，刷新进行中时禁用（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:258`）。

内容区按浏览级别切换 STANDARD / ACCESSIBILITY / ADMIN / DEBUGGER / ROOT 五个 Section（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:296`）。

PermissionLevelSelector 用 ScrollableTabRow 列出 AndroidPermissionLevel.values() 全部级别（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:443`）。

PermissionSectionContainer 给当前激活级别的 Section 加 primary 色实线边框，纯浏览的不加（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:506`）。

StandardPermissionSection 列出存储、悬浮窗、电池优化、位置、OperitTerminal 五项（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:574`）。

AccessibilityPermissionSection 在基础权限下追加无障碍服务项，四态为未安装 / 未授权 / 待更新 / 已授权，待更新显示橙色（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:657`）。

AdminPermissionSection 顶部有琥珀色"版本不支持"提示卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:825`）。

DebuggerPermissionSection 在基础权限下追加 Shizuku 服务项，五态为未安装 / 未运行 / 未授权 / 待更新 / 已授权（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:947`）。

RootPermissionSection 在基础权限下追加 Root 授权项，并按授权状态显示三段提示文本（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:1127`）。

PermissionLevelVisualDescription 渲染级别标题、级别描述与 FeatureGrid 功能九宫格（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:1286`）。

FeatureGrid 的功能支持矩阵：悬浮窗 / 文件操作 / Termux / 插件市场 MCP 全级别支持；Android/data 需 ADMIN 起；data/data 仅 ROOT；屏幕自动点击需无障碍起；系统权限修改需 DEBUGGER 起；运行 JS 仅 DEBUGGER 与 ROOT（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:1338`）。

isFeatureSupported(level, inStandard, inAccessibility, inAdmin, inDebugger, inRoot) 按级别查六个布尔参数（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:1389`）。

### 8. 对话框与示例命令

CommandResultDialog 是 AlertDialog：执行中标题下加 LinearProgressIndicator；内容区 150–350dp 高的 LazyColumn；allowCopy 时用 SelectionContainer 包等宽文本（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:21`）。

复制按钮走 ClipboardManager.setPrimaryClip 写剪贴板，失败弹 Toast；执行中时隐藏确认/复制按钮并禁止返回键与点击外部关闭（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:88`）。

FeatureErrorCard 用 errorContainer 底色显示权限缺失提示（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:130`）。

SampleCommandsCard 渲染"描述 + 命令"对列表，点击把命令文本回调用方（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:149`）。

getSampleAdbCommands 提供 8 条 adb 示例：查安卓版本、列包、电池、系统设置、打开网页、Activity 栈、服务列表、分辨率（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:491`）。

getOperitTerminalSampleCommands 提供 6 条终端示例：echo、ls、whoami、apt update、装 python3、ip addr（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:504`）。

getRootSampleCommands 提供 8 条 Root 示例：remount /system、内核版本、/data 列表、SELinux、进程、内存、特性、电源（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:515`）。

### 9. Shizuku 向导卡

ShizukuWizardCard 参数覆盖安装/运行/授权三态、展开标志、五个动作回调、更新与版本信息（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:21`）。

标题图标：完全设置且有更新时用 Update 图标，否则用 Edit 图标；标题文本同样二选一（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:54`）。

进度条 0 / 0.33 / 0.66 / 1 对应未安装 / 未运行 / 未授权 / 完成三阶段（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:119`）。

状态文本四态：step1 安装 / step2 启动 / step3 授权 / 完成（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:136`）。

详情区用 AnimatedVisibility(visible = showWizard) 控制展开（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:169`）。

步骤一：安装说明 + "安装内置" ElevatedButton，回调 onInstallBundled（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:175`）。

步骤二：两种启动方式的说明卡片，底部"查看教程" OutlinedButton 与"打开 Shizuku" FilledTonalButton（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:292`）。

步骤三：授权说明 + errorContainer 警告块 + 授权 Button（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:314`）。

完成态显示成功提示；有更新时追加更新区，展示已安装与内置版本号并提供更新按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:403`）。

### 10. Root 向导卡

RootWizardCard 参数为 isDeviceRooted、hasRootAccess、展开标志与三个回调（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt:47`）。

进度 0 / 0.5 / 1 对应未 Root / 已 Root 未授权 / 已授权，状态文本 step1 / step2 / 完成（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt:103`）。

已授权态显示成功提示，"测试命令"按钮复用 onRequestRoot 执行示例命令（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt:246`）。

已 Root 未授权态：设备已 Root 说明 + 获取指引卡 + "请求权限" Button + "查看教程" OutlinedButton（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt:271`）。

未 Root 态：未 Root 说明 + errorContainer 风险提示 + "查看教程" ElevatedButton（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt:354`）。

### 11. 无障碍向导卡

AccessibilityWizardCard 参数覆盖提供者安装、服务启用、展开标志、安装/设置/更新回调与版本信息（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:36`）。

进度 0 / 0.5 / 1 对应未安装提供者 / 未启用服务 / 完成两阶段（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:99`）。

步骤一：安装说明，安装按钮先弹风险警告对话框，不直接安装（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:208`）。

步骤二：启用说明 + 注意事项卡 + "打开设置" Button 跳系统无障碍设置（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:235`）。

完成态显示成功提示；需更新时显示 UpdateAvailableInfo 组件（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:289`）。

风险警告对话框要求用户输入确认文本：中文句取自 a11y_wizard_risk_acknowledgment 字符串，英文句硬编码在代码里；任一忽略大小写匹配才执行 onInstallProvider()，不匹配标 isError（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:276`）。

UpdateAvailableInfo 显示"检测到新版本"、已安装/内置版本号与"立即更新"按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:363`）。

### 12. 终端环境向导卡

OperitTerminalWizardCard 参数为 pnpm/pip 安装态、环境就绪态、展开标志与打开终端回调，另带一批旧版兼容参数（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt:33`）。

状态文本四态：环境就绪 / 有 pnpm 缺 pip / 有 pip 缺 pnpm / 均需配置（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt:101`）。

状态颜色：就绪用 tertiary，部分安装用 primary，都没有用 onSurfaceVariant（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt:109`）。

未就绪时逐项显示 pnpm 与 pip 的安装状态行（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt:119`）。

未就绪态：配置说明 + "前往终端配置" Button；就绪态：已配置说明 + "打开终端" OutlinedButton（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt:172`）。

## 关键符号

- `ShizukuDemoScreen` — 顶层可组合函数，权限中控台的唯一入口（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:44`）
- `ShizukuDemoViewModel` — AndroidViewModel，状态代理与 Root/工具操作入口（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:21`）
- `DemoStateManager` — 实际的状态持有者，刷新管线的执行者（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:39`）
- `DemoScreenState` — data class，全部 UI 状态的容器（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:455`）
- `refreshStatusAsync` — 私有刷新主流程（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:217`）
- `refreshPermissionsAndStatus` — 顶层挂起函数，逐项检测系统权限（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:333`）
- `refreshNodejsPythonEnvironment` — 终端里查 pnpm/python/pip 的环境检测（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:275`）
- `PermissionLevelCard` — 五档权限级别卡片（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:59`）
- `PermissionLevelSelector` — 级别选项卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:443`）
- `PermissionSectionContainer` — Section 容器，激活级别加边框（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:506`）
- `PermissionStatusItem` — 单项权限行（PermissionLevelCard.kt 内版本，圆点 + 已授权/未授权）（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:534`）
- `PermissionStatusItem` — components 独立版本，带 isHighlighted 高亮（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionStatusItem.kt:17`）
- `FeatureGrid` — 功能支持矩阵九宫格（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:1338`）
- `isFeatureSupported` — 按级别查六个布尔参数的判定函数（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:1389`）
- `CommandResultDialog` — 命令结果对话框（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:21`）
- `SampleCommandsCard` — 示例命令卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:149`）
- `FeatureErrorCard` — 权限缺失错误卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt:130`）
- `ShizukuWizardCard` — Shizuku 三步向导（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt:21`）
- `RootWizardCard` — Root 两步向导（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt:47`）
- `AccessibilityWizardCard` — 无障碍两步向导，安装前弹风险确认框（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:36`）
- `OperitTerminalWizardCard` — NodeJS/Python 环境向导（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt:33`）
- `getSampleAdbCommands` — adb 示例命令库（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:491`）
- `getOperitTerminalSampleCommands` — 终端示例命令库（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:504`）
- `getRootSampleCommands` — Root 示例命令库（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt:515`）

## 调用链

1. 输入：用户打开演示界面 → ShizukuDemoScreen 组合，viewModel 默认用 Factory 构造（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:44`）。
2. 处理：LaunchedEffect 置 loading，在 IO 线程调 viewModel.initializeAsync → RootAuthorizer 初始化并读取 Root 状态 → stateManager.initializeAsync → refreshStatusAsync 逐项检测（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:96`）。
3. 输出：uiState 更新 → PermissionLevelCard 渲染五档级别与各权限项 → 未达标的级别自动出现对应向导卡（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:138`）。
4. 输入：用户在级别选项卡点选另一级别 → displayedPermissionLevel 变化 → AnimatedContent 切换 Section（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:296`）。
5. 处理：浏览级别 ≠ 激活级别时点"设为当前级别" → 保存偏好 + 清 AndroidShellExecutor 级别缓存 → onPermissionLevelSet（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt:209`）。
6. 输出：屏幕侧 refreshTools → toolHandler.reset() + registerDefaultTools() 重注册工具（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:182`）。
7. 输入：用户在 Shizuku 向导点"安装内置" → Screen 侧 onInstallBundled 在 IO 线程提取 assets APK → FileProvider URI → ACTION_VIEW 安装 intent（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt:424`）。
8. 处理：用户在无障碍向导点安装 → 先弹风险警告对话框 → 输入确认文本匹配才执行 launchProviderInstall（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt:276`）。
9. 输出：Root 向导"请求权限" → viewModel.requestRootPermission → RootAuthorizer 授权 → 成功执行 `id` 测试命令，结果写回 resultText（`app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt:101`）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/state/DemoStateManager.kt` — 状态持有、刷新管线、环境检测、示例命令库
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/viewmodel/ShizukuDemoViewModel.kt` — ViewModel 代理、Root 操作、工具重注册
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/screens/ShizukuDemoScreen.kt` — 屏幕组装、向导显隐规则、回调接线
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/DialogComponents.kt` — 命令结果对话框、示例命令卡、错误卡
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionLevelCard.kt` — 五档权限卡片、级别切换、功能矩阵
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/components/PermissionStatusItem.kt` — 独立权限状态项（高亮版）
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/ShizukuWizardCard.kt` — Shizuku 三步向导
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/RootWizardCard.kt` — Root 两步向导
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/AccessibilityWizardCard.kt` — 无障碍两步向导与风险确认框
- `app/src/main/java/com/ai/assistance/operit/ui/features/demo/wizards/OperitTerminalWizardCard.kt` — 终端环境向导
