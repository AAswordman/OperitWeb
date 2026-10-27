---
title: 启动/恢复/性能界面
module: UI / 启动与恢复
sources: 8
date: 2026-10-01
issue: 120
---

# ui-startup（启动/恢复/性能界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/startup/`（3 个 Kotlin 文件）+ `app/src/main/java/com/ai/assistance/operit/ui/features/performance/`（2 个）+ `app/src/main/java/com/ai/assistance/operit/ui/recovery/`（2 个）+ `app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt`（1 个），共 8 文件、约 3,435 行 @ `dbf71916`
>
> 注：任务单原列出的 `ui/features/settings/screens/StartupScreen.kt` 与 `PerformanceScreen.kt` 在该 commit 下不存在（全仓 find 无同名文件），实际按 `tracking/shards/day-7.json` 的分片种子（startup / performance / recovery 三目录）阅读写作。

> 覆盖应用冷启动时的插件加载进度屏（MCP 插件逐个启动的可视化 + 超时跳过）、桌面任务管理器风格的性能监控页（CPU/内存/网络三 tab、按应用/插件/终端拆分），以及独立 `:repair` 进程的数据恢复 Activity（原始快照导出导入、手写 SQL 执行器、配置与数据库健康检查与修复）。

## 概述

Operit 把"启动"和"自救"做成了三块独立界面。启动时插件（MCP 本地服务）逐个拉起，PluginLoadingScreen 以悬浮窗形式展示进度：默认是右上角可拖动的圆形小指示器，点开变成 450dp 高的展开面板，列出每个插件的等待/加载中/成功/失败状态，失败项点开直接看完整启动日志。启动超时 30 秒后提示用户点右上角"跳过"。

性能监控页是给开发者/重度用户看的任务管理器：CPU、内存、网络三个 tab，每个 tab 顶部是设备级总览卡片，中间是多系列实时折线图（Canvas 自绘，带网格、时间轴、断线分段），下面按软件/插件/终端逐项列出占用。页面打开才开始采样，离开即停，右上角可暂停/继续。

数据恢复页跑在独立的 `:repair` 进程里，是数据库或配置损坏时的"急救室"：导出/导入原始数据快照（zip）、手写 SQL 直接查改正式库（内置三条查大消息/大变体/大聊天的只读安全查询）、一键检查 SharedPreferences 与 Room 数据库健康并尝试修复（修前先把原文件打包存档）。修完点"启动主应用"，杀掉当前进程拉起主程序。

崩溃上报页（`ui/error/CrashReportActivity.kt`，manifest 声明 exported=false、跑独立 `:crash` 进程）是崩溃后的"事故现场"：展示截断到 24_000 字符的堆栈，提供重启应用、复制堆栈到剪贴板、导出堆栈到公共 Downloads、导出 logcat 四个操作；重启走 AlarmManager 延迟 200ms 拉起 + 杀进程。注意：堆栈原文会原样进入剪贴板/公共目录/本地日志，其中常带有文件路径等敏感信息；导出前无脱敏、无二次确认（见代码走查）。

## AI 速览

- **核心符号清单**：PluginLoadingScreen、PluginLoadingScreenWithState、PluginLoadingState、PluginInfo、PluginStatus、SkipLoadingCallback、DraggableCollapsedIndicator、CollapsedLoadingIndicator、ExpandedLoadingView、PluginStatusItem、SmoothLinearProgressIndicator、generateSteps、easeInOutCubic、LocalPluginLoadingState、PluginLoadingStateRegistry、PerformanceMonitorScreen、PerformanceTab、PerformanceLiveChart、PerformanceChartSeries、PerformanceChartCanvas、dynamicNiceMax、formatMb、formatRate、CpuPage、MemoryPage、NetworkPage、EntityRow、DeviceHeaderCard、NetworkHeaderCard、DataRecoveryActivity、DataRecoveryScreen、DataRecoveryViewModel、QueryResult、StatusPanel、RecoverySection、QueryResultPanel、restartMainApp、CrashReportActivity、CrashReportScreen、EXTRA_STACK_TRACE、restartApp、exportToFile、copyToClipboard。
- **主入口**：MainActivity 绑定 `pluginLoadingState` → `PluginLoadingScreenWithState(loadingState)`；性能页 `PerformanceMonitorScreen()`；恢复页 `DataRecoveryActivity.onCreate → DataRecoveryScreen()`；崩溃上报 `CrashReportActivity.onCreate → CrashReportScreen()`。
- **数据流向一句话**：启动：MCPStarter 插件启动回调 → PluginLoadingState 的 StateFlow（progress/message/plugins）→ PluginLoadingScreen 渲染，超时/跳过走 skip()；性能：PerformanceMonitorManager.stateFlow 采样快照 → CpuPage/MemoryPage/NetworkPage 按实体种类聚合绘图；恢复：用户操作 → DataRecoveryViewModel（StateFlow State）→ RawSnapshotBackupManager / AppDatabase / PreferencesHealthManager / RoomDatabaseHealthManager 执行，修完 restartMainApp 杀进程重启；崩溃：CrashRecoveryState 消费待处理标记 → intent 传堆栈 → 展示/复制/导出/重启（AlarmManager 延迟 200ms 拉起 + killProcess）。

## 核心机制

### 1. 插件加载进度屏

PluginLoadingScreen 是启动期的全屏悬浮界面，参数包括 isVisible、progress、message、pluginsStarted、pluginsTotal、pluginsList、isExpanded、onToggleExpansion、onSkip（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:102`）。

显隐用 AnimatedVisibility：进入 fadeIn 500ms，退出 fadeOut 800ms（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:118`）。

展开/折叠用 AnimatedContent 切换：展开态贴底部（Alignment.BottomCenter），折叠态贴右上（Alignment.TopEnd）（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:138`）。

折叠态是 DraggableCollapsedIndicator：48dp 圆形 Surface，可用 detectDragGestures 任意拖动（change.consume 后 offset += dragAmount），圆环内显示 "已启动/总数"（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:154`）。

展开态 ExpandedLoadingView 高度上限 450dp：顶部左为折叠箭头、右上为"跳过"文字按钮；中部是 SmoothLinearProgressIndicator（中间步数 20、每步 50ms）、状态消息、"x/y" 统计；下部 LazyColumn（上限 200dp）列出各插件状态；只有 FAILED 的插件可点击，点击弹出该插件的完整启动日志对话框（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:217`）。

PluginStatus 只有四态：WAITING、LOADING、SUCCESS、FAILED（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:77`）。

PluginInfo.shortName 取 id 按 "/" 分割的最后一段（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:89`）。

### 2. PluginLoadingState（启动状态机）

PluginLoadingState 用 9 个 MutableStateFlow 对外暴露只读 StateFlow：progress、message、pluginsStarted、pluginsTotal、isVisible、isExpanded、plugins、pluginLogs、hasTimedOut（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:461`）。

并发保护：插件列表/统计/日志的所有更新都包在 synchronized(pluginStateLock) 里，防止多个启动回调互相覆盖（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:512`）。

initializeMCPServer 用 AtomicBoolean.compareAndSet 做"只初始化一次"守卫，重复调用直接打日志返回（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:729`）。

启动分阶段推进进度条：0.05 初始化 → 0.1 启动服务 → 0.15 配置 → 0.2 服务就绪 → 0.25 初始化中 → 0.28 拉插件列表并 refreshPluginList → 0.32 准备 → 0.35 环境检查 → 0.38 开始逐个启动（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:731`）。

无已安装插件时直接 progress=1.0 并 hide()，不展示加载屏（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:756`）。

待启动插件 = 已启用（isServerEnabled）的插件；remote 类型与本地类型当前都返回 true，即全部纳入（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:769`）。

插件显示名优先取 MCPLocalServer.getPluginMetadata(id).name，取不到回退为 id 尾段（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:545`）。

进度监听器四回调：onPluginStarting（置 LOADING、进度 0.4+0.1×index/total、日志记 "START"）、onPluginRegistered（只更新 serviceName 与消息，不改主状态；注册失败则置 FAILED 并强制展开）、onPluginStarted（成功/失败置态、进度 0.5+0.5×index/total）、onPluginLog（追加日志 + 取首行 160 字做行内摘要）（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:831`）。

全部完成后：NODEJS_MISSING / BRIDGE_FAILED / OTHER_ERROR 三种环境失败各有专属提示；成功率 = successCount×100/totalCount；有失败或状态非 SUCCESS 强制展开面板，否则 delay(100ms) 后自动隐藏（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:887`）。

startTimeoutCheck 默认 30 秒：超时只置 hasTimedOut=true 并提示"可点右上角跳过"，不自动关闭（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:681`）。

skip() 取消超时计时、隐藏界面、触发 onSkipCallback（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:675`）。

单插件日志上限 200 万字符，超了只保留末尾（takeLast），防爆内存（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:602`）。

LocalPluginLoadingState 是 staticCompositionLocalOf，未提供直接 error 抛错；PluginLoadingStateRegistry 用 @Volatile 存全局唯一的 state/scope，供 MainActivity 等外部绑定（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/LocalPluginLoadingState.kt:5`）。

### 3. 超平滑进度条

SmoothLinearProgressIndicator 解决"进度跳变"的观感问题：progress 先 clamp 到 0~1；首帧直接 snapTo；之后变化量小于 0.05（minProgressDelta）用 FastOutSlowInEasing 的短 tween（2×stepDuration），大变化则在 Dispatchers.Default 上预计算 8 步 easeInOutCubic 插值点再逐段 LinearEasing 推进（默认每步 80ms）（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/components/AnimatedProgressBar.kt:45`）。

插值点生成：t=(i+1)/steps 经 easeInOutCubic（t<0.5 时 4t³，否则 1+0.5(2t-2)³）映射，保证首尾速度为零的平滑过渡（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/components/AnimatedProgressBar.kt:117`）。

最终渲染仍是 Material3 LinearProgressIndicator，只是 progress 参数喂的是 Animatable 的动画值，圆头（StrokeCap.Round）（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/components/AnimatedProgressBar.kt:116`）。

### 4. 性能监控页

PerformanceMonitorScreen 是"桌面任务管理器"风格：DisposableEffect 里页面存活即 PerformanceMonitorManager.start(context)，离开 onDispose 即 stop()，采样只在页面打开时跑（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:88`）。

顶部三 tab：CPU / 内存 / 网络（PerformanceTab 枚举，标题取 perf_tab_* 字符串），选中态用 rememberSaveable 保留（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:68`）。

顶栏只申请一个暂停/继续按钮（setPaused(!paused)，图标 PlayArrow/Pause 切换）；标题和返回由应用级 AppBar 统一管理（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:97`）。

无采样数据时显示 perf_sampling_hint 占位（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:141`）。

CPU 页四条系列：设备总 CPU、应用自身、全部插件求和、全部终端求和；设备卡片显示 "x.x%" + 核心数，曲线固定量程 100（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:160`）。

内存页三条系列（应用/插件/终端，单位 KB 转 double）；设备卡片显示 "已用/总量"（usedMb = (总量-可用) 下限 0），附 perf_memory_metric_note 口径说明（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:226`）。

网络页四条系列：应用上行/下行 + 设备上行/下行（设备系列透明度 0.5 以区分）；若历史里从无网络数据则显示 perf_network_unavailable 而非曲线（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:302`）。

实体明细行按当前 tab 指标降序排（网络 tab 排序键恒 0，即保持原序）；每行图标按种类区分：应用=Speed、插件=Extension、终端=Terminal（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:375`）。

formatMb：≥1GB 显示 x.xxGB，≥1MB 显示 x.xMB，否则 xKB；formatRate：B/s、KB/s、MB/s 自适应（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:612`）。

### 5. 自绘性能曲线

PerformanceLiveChart = 图例 + Canvas：历史少于 2 个点时画空盒；图例是可横滑的一行"色点+标签"（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:53`）。

PerformanceChartSeries 的 value 返回 null 表示该时刻无数据，画线时自动断开成多段（只保留 ≥2 点的段），形成"断线"效果（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:42`）。

坐标系：x 按时间索引均分全宽（左旧右新），y 上限取 fixedMax 或 dynamicNiceMax；横向网格在 1/4、1/2、3/4，纵向网格在左/中/右，透明度 0.6（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:93`）。

时间轴取首/中/末三个快照的 timestampMs，按 "HH:mm:ss" 格式左/中/右对齐绘制；y 轴取 max、max/2、0 三档标签（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:117`）。

每段曲线：4px 宽折线 + 12% 透明度面积填充 + 末端 5px 圆点（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:177`）。

dynamicNiceMax：取全部系列最大值，向上取整到 2/5/10×10^k 档，保证曲线不贴顶；全零时返回 1.0（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:233`）。

### 6. 数据恢复 Activity

DataRecoveryActivity 跑在独立 `:repair` 进程（manifest 声明 `android:process=":repair"`，exported=true），attachBaseContext 套 LocaleUtils 做语言本地化，内容区用 OperitUtilityTheme 包裹 DataRecoveryScreen（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:79`）。

页面分五块：状态面板、原始快照、文件管理说明、SQL 执行器、数据库健康；查询结果出现时追加第六块结果表（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:93`）。

原始快照：导出按钮调 viewModel.exportRawSnapshot()（经 RawSnapshotBackupManager.exportToBackupDir 写备份目录，路径回显等宽字体可复制）；导入用 OpenDocument 选 zip（mime 限定 application/zip、application/octet-stream、*/*），选完先弹确认对话框，确认后 restoreRawSnapshot(uri)；恢复完成后出现"启动主应用"按钮（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:141`）。

文件管理区只展示说明文字，给出 documents provider 的 authority（包名 + ".documents.data"）（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:200`）。

SQL 执行器：三个 AssistChip 一键填入内置安全查询（查消息/消息变体/聊天三张表按内容体积倒序的前 50 条）；文本框 4~8 行等宽字体；执行按钮调 viewModel.runSql()（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:216`）。

数据库健康：先点"检查"跑 PreferencesHealthManager.inspect + RoomDatabaseHealthManager.inspect；报告面板按状态着色（需人工恢复=红色、需修复=三色、健康=主色），显示通过 x/y 项并优先展示第一个失败/警告的详情，可点开展开逐项明细；修复按钮仅当任一报告 canRepair 时可用，点后二次确认对话框再执行 repairStorage()（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:279`）。

修复计划区列出将要做的动作：配置文件重置 N 个文件、重建索引（REBUILD_INDEXES）、跑 Room 迁移（RUN_ROOM_MIGRATIONS）；修复前后原文件打包存档，路径回显（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:334`）。

所有耗时操作期间按钮禁用（enabled = !state.isRunning），状态面板显示进度或错误（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:552`）。

restartMainApp：取包的 launch intent，找不到弹 toast；加 NEW_TASK|CLEAR_TASK 拉起，finishAffinity 后 Process.killProcess(Process.myPid()) 杀掉当前进程（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:717`）。

### 7. DataRecoveryViewModel

State 一共 13 个字段：isRunning、status、error、sqlText（默认 SAFE_MESSAGES_QUERY）、queryResult、affectedRows、lastSnapshotPath、restoreCompleted、两份健康报告、两份修复存档路径、healthRepairCompleted（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:28`）。

runSql：先 sanitizeSql（trim + 去掉末尾一个分号）；空语句直接报错；SELECT/WITH/PRAGMA 开头走 executeQuery（游标转 QueryResult，BLOB 显示为 BLOB(字节数)、NULL 显示 "NULL"），其余走 writableDatabase().execSQL 写库并用 SELECT changes() 取影响行数；异常记 AppLogger.e（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:53`）。

exportRawSnapshot 经 RawSnapshotBackupManager.exportToBackupDir，进度回调映射为 PREPARING→SCANNING→ZIPPING（文件/外部文件/shared_prefs/datastore/databases）→FINALIZING 的中文阶段文本 + 百分比（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:99`）。

restoreRawSnapshot 经 restoreFromBackupUri，阶段为 PREPARING→READING_ZIP→EXTRACTING→REPLACING（文件/外部文件/shared_prefs/datastore/databases）→FINALIZING（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:124`）。

repairStorage：先修数据库再修配置；修前各自把源文件打包为 sourceArchive（路径存 state）；修后重查两份报告，全 HEALTHY 显示"修复完成"否则"仍有剩余问题"；RepairFailedException 时把存档路径带进错误文案（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:184`）。

三条内置安全查询都是"按体积倒序取前 50"的只读排查语句：messages 查 messageId/chatId/timestamp/sender/bytes；message_variants 查 variantId 等；chats 查标题与工作区字段的体积（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:396`）。

Factory 用 applicationContext 再套本地化 context 防泄漏；传错 ViewModel 类型抛 IllegalArgumentException（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:382`）。

### 8. 崩溃上报 Activity

CrashReportActivity（manifest 声明 `android:exported="false"`，跑独立 `:crash` 进程）。堆栈经 intent extra `extra_stack_trace`（常量 `EXTRA_STACK_TRACE`）传入。
`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:58`

onCreate 先调 `CrashRecoveryState.consumePendingCrashReportLaunch(this)` 消费待处理的崩溃上报启动标记。
`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:64`

堆栈经 `ThrowableTextFormatter.truncateText` 截到 24_000 字符（缺省 `No stack trace available.`），全文打两行 `AppLogger.e` 日志后进 Compose 界面。
`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:65`

界面四个操作：红色"重启应用"主按钮调 restartApp；复制按钮把堆栈经 `ClipData.newPlainText("error_stack_trace", …)` 写系统剪贴板；导出按钮把堆栈 UTF-8 写进公共 Downloads/`Operit/error/error-report-<yyyy-MM-dd_HH-mm-ss>.log`（失败弹 Toast 并记日志）；logcat 按钮在协程内调 `LogcatExportHelper.exportLogs(context)`，导出中禁用并转圈，结果卡片按成功/失败着色（`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:112`）。

restartApp：取包 launch intent（取不到回退 MainActivity），加 NEW_TASK|CLEAR_TASK；PendingIntent 用 FLAG_CANCEL_CURRENT（API≥M 叠加 FLAG_IMMUTABLE）；`AlarmManager.set(RTC, now+200ms)` 延迟拉起；再 finishAffinity + `Process.killProcess(myPid())` + `exitProcess(0)`（`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:282`）。

注意：堆栈原文会原样进入剪贴板/公共目录/本地日志，其中常带有文件路径等敏感信息；导出前无脱敏、无二次确认（见代码走查）。

## 关键符号

- `PluginLoadingScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:102`）：插件加载悬浮屏，折叠/展开两态
- `PluginLoadingScreenWithState`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:982`）：绑定 PluginLoadingState 的 StateFlow 并处理失败日志弹窗
- `PluginLoadingState`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:461`）：启动状态机，9 个 StateFlow + synchronized 更新
- `PluginStatus`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:77`）：WAITING/LOADING/SUCCESS/FAILED 四态枚举
- `PluginInfo`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:85`）：单个插件的 id/显示名/状态/消息
- `initializeMCPServer`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:729`）：MCP 服务与插件的启动编排，AtomicBoolean 防重入
- `startTimeoutCheck`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt:681`）：30 秒超时提示（默认 30000L）
- `SmoothLinearProgressIndicator`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/components/AnimatedProgressBar.kt:45`）：插值平滑进度条
- `LocalPluginLoadingState` / `PluginLoadingStateRegistry`（`app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/LocalPluginLoadingState.kt:5`）：CompositionLocal 与全局绑定表
- `PerformanceMonitorScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:80`）：性能监控页，存活期采样
- `PerformanceTab`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:68`）：CPU/MEMORY/NETWORK 三 tab
- `PerformanceLiveChart`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:53`）：多系列实时折线图
- `PerformanceChartSeries`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:42`）：单数据系列，value=null 表断线
- `dynamicNiceMax`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt:233`）：自适应 y 轴上限
- `formatMb`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:611`）：容量格式化
- `formatRate`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:621`）：速率格式化
- `DataRecoveryActivity`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:79`）：数据恢复 Activity（`:repair` 进程）
- `DataRecoveryViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:21`）：恢复逻辑，StateFlow State
- `runSql`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:53`）：手写 SQL 执行（查/写分流）
- `exportRawSnapshot`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:107`）：原始快照导出
- `restoreRawSnapshot`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:137`）：原始快照导入
- `inspectStorage`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:165`）：健康检查
- `repairStorage`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:201`）：健康修复
- `restartMainApp`（`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt:717`）：杀进程重启主应用
- `CrashReportActivity`（`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:55`）：崩溃上报 Activity（`:crash` 进程，exported=false）
- `CrashReportScreen`（`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:78`）：崩溃上报 Compose 界面（重启/复制/导出/导出日志四操作）
- `restartApp`（`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:282`）：AlarmManager 延迟拉起 + 杀进程重启
- `exportToFile`（`app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt:258`）：堆栈写公共 Downloads（`getExternalStoragePublicDirectory` 已废弃）

## 调用链

### 启动插件加载

1. 输入：MainActivity 绑定 pluginLoadingState，调 `initializeMCPServer(context, lifecycleScope)`。
2. 处理：compareAndSet 防重入 → Dispatchers.IO 协程按 0.05→0.38 分阶段更新 progress/message → refreshPluginList 取已安装插件 → 过滤已启用 → setPlugins 建 PluginInfo 列表 → MCPStarter.startAllDeployedPlugins(progressListener) 逐个启动。
3. 输出：四回调更新各插件 WAITING→LOADING→SUCCESS/FAILED 与总进度 0.4→1.0；失败强制展开面板；全成功 100ms 后自动隐藏；30 秒无完成则提示跳过。

### 超时跳过

1. 输入：startTimeoutCheck(30000L) 计时结束，或用户点右上"跳过"。
2. 处理：置 hasTimedOut=true 并提示；skip() 取消计时器、hide() 界面。
3. 输出：触发 onSkipCallback，主界面继续（插件后台继续起）。

### 性能页采样渲染

1. 输入：进入 PerformanceMonitorScreen。
2. 处理：DisposableEffect 启动 PerformanceMonitorManager.start → stateFlow 持续推送 PerformanceSnapshot → 按 tab 取 deviceCpuPercent / memoryKb / rx-tx 等字段，插件与终端按 kind 求和聚合。
3. 输出：设备总览卡片 + Canvas 多系列折线（断线分段、末端圆点）+ 实体明细行；离页 stop() 停止采样。

### 数据恢复

1. 输入：用户在 DataRecoveryActivity 点导出/导入/执行 SQL/检查/修复。
2. 处理：DataRecoveryViewModel 置 isRunning=true，经 RawSnapshotBackupManager（快照）、AppDatabase.openHelper.writableDatabase（SQL）、PreferencesHealthManager/RoomDatabaseHealthManager（检查修复）执行，进度与错误写回 StateFlow。
3. 输出：状态面板展示结果；修复前原文件打包存档；完成后"启动主应用"杀进程（killProcess）拉起主程序。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/startup/components/AnimatedProgressBar.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/LocalPluginLoadingState.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/startup/screens/PluginLoadingScreen.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorCharts.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/error/CrashReportActivity.kt`
