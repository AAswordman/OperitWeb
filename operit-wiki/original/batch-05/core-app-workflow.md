---
title: 应用生命周期、性能监控与工作流调度
module: 引擎其他
sources: app/src/main/java/com/ai/assistance/operit/core/application/, app/src/main/java/com/ai/assistance/operit/core/performance/, app/src/main/java/com/ai/assistance/operit/core/workflow/
date: 2026-10-01
---

# 应用生命周期、性能监控与工作流调度

## 概述

这一页覆盖 Operit 应用"活着"所依赖的三块基础设施：

1. **应用生命周期**：`OperitApplication` 负责进程级启动编排，`ActivityLifecycleManager` 负责 Activity 前后台跟踪与常亮屏幕控制，`ForegroundServiceCompat` 负责跨版本前台服务启动兼容。
2. **性能监控**：`PerformanceMonitorManager` 以 1 秒为周期采样主进程、插件容器、终端会话三类实体的 CPU/内存/网络，供给性能分析界面。
3. **工作流调度**：`WorkflowScheduler` 基于 WorkManager 实现 interval/specific_time/cron 三种定时调度，`WorkflowWorker` 在后台触发执行，`WorkflowExecutor` 做拓扑排序执行，`WorkflowSchedulerInitializer` 在启动时重排所有已启用的工作流。

## AI 速览

- **核心符号**：`OperitApplication`、`ActivityLifecycleManager`、`ForegroundServiceCompat`、`PerformanceMonitorManager`、`PerformanceEntityKind`、`PerformanceSnapshot`、`WorkflowExecutor`、`NodeExecutionState`、`WorkflowScheduler`、`WorkflowWorker`、`WorkflowSchedulerInitializer`
- **主入口**：`OperitApplication.initializeMainApplication()`（应用主初始化）、`PerformanceMonitorManager.start()`（开始采样）、`WorkflowScheduler.scheduleWorkflow()`（排期工作流）、`WorkflowExecutor.executeWorkflow()`（执行工作流）
- **数据流向一句话**：应用启动 → 编排初始化并重排工作流 → WorkManager 定时唤醒 `WorkflowWorker` → `WorkflowExecutor` 拓扑执行节点图；性能采样独立以 1s 周期从 `/proc` 读取三类实体指标并推送到 StateFlow 供界面消费。

## 核心机制

### 应用启动编排（OperitApplication）

`OperitApplication` 继承 `Application`，并同时实现 Coil 的 `ImageLoaderFactory` 与 WorkManager 的 `WorkConfiguration.Provider` 接口（`app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:73`）。

`onCreate()` 只做轻量初始化：记录启动时间戳 `appStartupTimeMs`（`:121`）、设置全局异常处理器 `GlobalExceptionHandler`（`:129`）、初始化全局 `Json`（`:131`）与默认图片加载器（`:139`）。重量级工作全部推迟到 `initializeMainApplication()`，该函数用 `synchronized(mainInitializationLock)` 加 `mainApplicationInitialized` 标志保证只执行一次（`:143`）。

主初始化流程（`initializeMainApplicationLocked`）按固定顺序编排：

1. 消费崩溃恢复标记并决定是否重置日志文件（`:158`）
2. 确保 WorkManager 初始化（`:163`）
3. 提交 cleanOnExit 临时目录清理任务（`:172`）
4. 初始化用户偏好管理器（`:175`）
5. 后台迁移旧版本 Token 统计（`:183`）
6. 应用语言设置（`:191`）
7. 注册 `ActivityLifecycleManager`（`:196`）
8. 初始化 `AIMessageManager`、注册内置插件、派发 `APPLICATION_CREATE` 插件钩子（`:200`）
9. 按需启动 `AIForegroundService`（`:214`）
10. 启动记忆自动保存轮询器 `MemoryAutoSaveScheduler`（`:224`）
11. 初始化 `AndroidShellExecutor`（`:236`）、Shower 环境（`:240`）、PDFBox（`:270`）、`LanguageFactory`（`:274`）、`WaifuMessageProcessor`（`:285`）
12. 预热分词器、预加载数据库、配置图片加载器与图片/媒体池（`:280`）
13. 延迟 800ms 后串行执行图片池预加载、媒体池预加载、默认工具注册，避免与首屏渲染抢资源（`:345`）
14. 异步初始化 `WorkflowSchedulerInitializer`（`:364`）
15. 按偏好决定 Room 数据库每日备份的排期或取消（`:370`）
16. 预绑定无障碍服务（`:386`）

每一步都用 `AppLogger.d` 输出"【启动计时】…"打点，方便排查启动慢的原因。

全局异常处理调用 `Thread.setDefaultUncaughtExceptionHandler(GlobalExceptionHandler(this))` 安装（`:129`）。`configureOpenMpEnvironment()` 在 Android 5.0+ 上设置 `KMP_AFFINITY=disabled` 与 `OMP_PROC_BIND=false`，禁用 OpenMP 线程亲和（`:108`）。

图片加载器配置：OkHttp 连接 30s / 读取 60s / 写入 30s 并自动重试（`:302`）；磁盘缓存 `filesDir/image_cache` 上限 50MB（`:322`）；内存缓存上限为可用内存 15%（`:327`）；Android P+ 用 `ImageDecoderDecoder` 解 GIF，旧版本用 `GifDecoder`（`:310`）。

`onTerminate()` 按顺序清理：停止 `AIForegroundService`（`:607`）、销毁 `Terminal` 会话与 SSH 连接（`:619`）、停止 `LocalWebServer`（`:630`）、隐藏 `VirtualDisplayOverlay`（`:639`）、关闭 `ShowerController`（`:644`）。`onLowMemory()`/`onTrimMemory()` 把内存压力事件派发给插件生命周期钩子（`:650`）。

`startGlobalAIForegroundServiceIfNeeded()` 只有在常听唤醒词或外部 HTTP API 任一开启时才启动 `AIForegroundService`，避免无谓常驻（`:505`）。

### Activity 生命周期跟踪（ActivityLifecycleManager）

`ActivityLifecycleManager` 是实现 `Application.ActivityLifecycleCallbacks` 的单例对象（`app/src/main/java/com/ai/assistance/operit/core/application/ActivityLifecycleManager.kt:26`），用标准回调跟踪前台 Activity，当前 Activity 以 `WeakReference` 持有（`:165`），暂停或销毁时清空，避免泄漏。

前后台判定用 `startedActivityCount` 计数：从 0 变为大于 0 视为进入前台（`:150`），派发 `APPLICATION_FOREGROUND` 插件钩子并调用 `ExternalChatHttpAutoStarter.ensureRunningIfEnabled`（reason=`application_foreground`，`:152`）；回落到 0 视为进入后台（`:219`），派发 `APPLICATION_BACKGROUND`。

`onActivityResumed` 时节流（2500ms）调用 `AIForegroundService.ensureMicrophoneForeground` 保活麦克风前台服务（`:163`）。每个生命周期回调都会向 `AppLifecycleHookPluginRegistry` 派发对应钩子并附带 Activity 类名（`:121`）。

屏幕常亮分两类请求：`checkAndApplyKeepScreenOn` 遵循用户偏好开关，`forceKeepScreenOn` 强制加减（`:69`）。两类请求分别计数，总和大于 0 才给当前窗口加 `FLAG_KEEP_SCREEN_ON`（`:108`），否则清除——引用计数避免多个调用方互相覆盖。

最后一个 Activity 被销毁（`activityCount<=0`）时关闭 `VirtualDisplayOverlay`（`:253`）与 `ShowerController`（`:262`），回收虚拟屏幕资源。

### 前台服务兼容（ForegroundServiceCompat）

`ForegroundServiceCompat` 是纯工具对象（`app/src/main/java/com/ai/assistance/operit/core/application/ForegroundServiceCompat.kt:9`）：`buildTypes` 按 `dataSync`/`microphone`/`specialUse` 参数拼装前台服务类型位掩码，Android Q 以下直接返回 0（`:15`），`specialUse` 仅 Android 14+ 拼入（`:25`）。

`startForeground` 在 Q+ 且类型非 0 时用三参数重载（`app/src/main/java/com/ai/assistance/operit/core/application/ForegroundServiceCompat.kt:30`）。

`startForegroundWithFallback` 先用主类型启动前台服务（`app/src/main/java/com/ai/assistance/operit/core/application/ForegroundServiceCompat.kt:38`），失败时降级到备用类型或无类型。

主类型启动抛 `SecurityException` 时记警告日志并走降级分支（`app/src/main/java/com/ai/assistance/operit/core/application/ForegroundServiceCompat.kt:51`）——防止因缺少类型声明权限导致服务起不来。

### 性能采样（PerformanceMonitorManager）

`PerformanceMonitorManager` 是性能分析界面的采样引擎单例（`app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:76`）。采样实体分三类：主进程、插件容器、终端会话。

三类实体对应枚举值 `APP`、`PLUGIN`、`TERMINAL`（`:33`）。

采样周期固定 1000ms（`:84`），历史窗口上限 180 条快照（`:85`）。`start()` 在界面打开时被调用（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:90`），界面关闭时 `onDispose` 回调里调 `stop()`（`:91`），暂停按钮调 `setPaused()`（`:106`）。

指标口径：

- **CPU**：占整机全部核心的百分比（与 Windows 任务管理器一致），上限 100（`:37`）。主进程读 `/proc/self/stat` 的 `utime/stime` 差分（`:241`），按 100Hz 时钟滴答换算（`:87`）。
- **内存**：APP 用 PSS（`Debug.MemoryInfo.totalPss`，`:267`）；PLUGIN 用 QuickJS JS 堆已用字节数（`:291`）；TERMINAL 用进程树 RSS 页数之和（`:322`）。
- **网络**：只有软件（UID）与整机有值；插件与终端和主进程共享同一 UID，Linux 没有按进程网络计量，流量天然计入软件（`:40`）。

差分有效性：采样间隔超过 5000ms（暂停恢复、进程被冻结）时差分失去"当前值"意义，只重置基数（`:91`）。stat 解析从最后一个右括号之后取字段，进程名含空格也能正确定位（`:381`）。注释特别提醒 `/proc` 路径必须用绝对路径——相对路径会被解析到应用工作目录导致读取失败（`:238`）。

插件采样按引擎线程 tid 读取 `/proc/self/task/<tid>/stat`，差分基数按 tid 记录，线程销毁重建不会把旧线程的累计量带进差分（`:274`）。终端采样先枚举本 UID 可读的进程树，再按 PTY 会话 pid 收集后代进程（`:300`）。所有状态经由 `MutableStateFlow` 发布，历史用 `ArrayDeque` 维护（`:116`）。

### 工作流调度（WorkflowScheduler / WorkflowWorker / WorkflowSchedulerInitializer）

`WorkflowScheduler` 基于 WorkManager 管理工作流定时（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowScheduler.kt:22`），支持三种调度类型（`:30`）：

- `interval`：固定间隔，用 `PeriodicWorkRequestBuilder`；最小间隔钳制为 15 分钟（WorkManager 限制，`:97`）
- `specific_time`：一次性定时，用 `OneTimeWorkRequestBuilder` 加初始延迟；支持 4 种日期格式（`:318`），目标时间已过则拒绝排期（`:147`）
- `cron`：简化实现，只支持每日定时、每 N 小时、每 N 分钟三种模式（`:396`），其他模式返回 null 并记警告；周期模式下间隔小于 15 分钟降级为一次性任务（`:214`）

任务以 `workflow_<workflowId>` 为唯一名入队，冲突策略 `REPLACE`（`:121`），重试退避为指数退避、基准 1 分钟（`:27`）。`cancelWorkflow` 按唯一名取消（`:290`），`isWorkflowScheduled` 查 `ENQUEUED`/`RUNNING` 状态（`:298`），`getNextExecutionTime` 按类型计算下次执行时间（`:462`）。

`WorkflowWorker` 是 `CoroutineWorker` 子类（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:17`）。

它从 `inputData` 读取 `workflow_id` 与 `trigger_node_id`（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:22`）。

`workflowId` 为空时直接返回 `Result.failure()`（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:30`）。

执行抛 `WorkflowExecutionRetryableException` 时返回 `Result.retry()`（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:46`），其他失败返回 `Result.failure()`（`:49`）。

`WorkflowSchedulerInitializer.initialize` 在 IO 协程中读取全部工作流（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowSchedulerInitializer.kt:25`）。

为每个 `enabled` 的工作流调用 `scheduleWorkflow` 并统计成功重排数量（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowSchedulerInitializer.kt:38`）——应用被强杀或升级后定时任务不丢失。

### 工作流执行（WorkflowExecutor）

`WorkflowExecutor.executeWorkflow` 是 `suspend` 函数，整个执行跑在 `Dispatchers.IO`（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:527`）。

每次运行生成唯一 `runId`（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:534`）。

产出 `WorkflowExecutionRecord` 记录起止时间、日志条目与失败阶段（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:548`）。

执行流程：

1. `prepareRuntime`：注册默认工具；当 `ExecuteNode.actionType` 含冒号（包工具）时预热包管理器可用包列表（`:165`）。失败返回 `shouldRetry=true`、失败阶段 `RUNTIME_INITIALIZATION`（`:585`）。
2. 确定触发节点：指定 `triggerNodeId` 则只执行该节点（定时触发），否则只执行 `triggerType=manual` 的节点（手动触发）（`:622`）。触发节点本身不执行，直接标记 `Success`，结果为 `triggerExtras` 的 JSON（`:669`）。
3. `buildDependencyGraph` 把显式连接与参数引用依赖合并建边，过滤自环与重复边（`:726`）。
4. `detectCycle` 用 DFS 三色标记检测有向环，有环拒绝执行（`:760`）。
5. `executeTopologicalOrder`：先算触发节点可达子图，再用 Kahn 算法按入度逐个执行（`:801`）。

节点状态机 `NodeExecutionState` 五态：`Pending` / `Running` / `Success` / `Skipped` / `Failed`（`:44`）。

入边条件语义：`success`/`ok`/`on_success` 要求源成功；`error`/`failed`/`on_error` 要求源失败；`true`/`false` 按布尔匹配；空白默认要求源成功（`:895`）；也支持正则表达式直接作用于源节点结果字符串（`:912`）。条件不满足的节点标记 `Skipped`，后继入度照常递减（`:940`）。

失败处理：失败节点若存在 `error` 条件边且目标节点最终执行成功，该失败视为已处理，不再导致整体失败（`:1005`）——支持"错误分支"兜底流程。

节点类型：

- `ExecuteNode`：经由 `AIToolHandler.executeTool` 执行工具，参数由 `resolveParameters` 解析静态值与节点引用（`:1275`）。引用已失败或未完成的节点直接抛 `IllegalStateException`（`:190`）。
- `ConditionNode`：支持 `EQ/NE/GT/GTE/LT/LTE/CONTAINS/NOT_CONTAINS/IN/NOT_IN`，数值可解析时优先按数字比较（`:199`）；`IN` 支持 JSON 数组或逗号分隔列表，数字与字符串混用抛类型不匹配（`:278`）。
- `LogicNode`：对入边成功节点结果做 `AND`/`OR` 布尔聚合（`:1147`）。
- `ExtractNode`：`REGEX` / `JSON` 路径 / `SUB` 子串 / `CONCAT` 拼接 / `RANDOM_INT` / `RANDOM_STRING` 六种模式（`:1189`）。

`CancellationException` 在各分支被重新抛出，保证协程取消向上传播（`:87`）。`WorkflowExecutionRetryableException` 是标记可重试的异常类型，供 `WorkflowWorker` 映射为 WorkManager 重试（`:73`）。

### 工作流执行结果的触达：引擎无内置推送（边界）

人话：工作流跑完，结果只进"账本"（执行记录+统计），不会自己跳到通知栏，也不会写回聊天。要让用户看到结果，得在工作流里自己拼一个发通知的节点。

- **执行完成后只做两件事**：`saveExecutionRecord` 存执行记录、`updateExecutionStatistics` 更新统计（`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:639`）。没有第三件事，更没有向通知栏或聊天推送结果的代码。
- **`notifyWorkflowsChanged` 不是给用户发通知**：它只是 `workflowUpdateEvents.tryEmit(Unit)`，用来刷新工作流列表 UI（`app/src/main/java/com/ai/assistance/operit/data/repository/WorkflowRepository.kt:82`）。名字里有 notify，但它是界面刷新事件。
- 后台 Worker 把执行结果映射成 `Result.success()` / `Result.retry()` / `Result.failure()` 返回给 WorkManager，不发通知（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:46`）。
- **阴性结论**：core/workflow/ 下四个文件经 grep 确认无 Notification / NotificationManager / notify( 引用；节点类型只有 TriggerNode / ExecuteNode / ConditionNode / LogicNode / ExtractNode 五种（`app/src/main/java/com/ai/assistance/operit/data/model/Workflow.kt:55`），无通知/消息节点类型。
- **拼装路径（非内置）**：执行节点把 `actionType` 原样装进 `AITool`（name = actionType），交由 toolHandler 执行任意已注册工具（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:1261`）。
- `send_notification` 系统工具真实存在（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:2282`）。
- 其实现经 `NotificationManager` 以高优先级通道发通知（`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:153`）。
- 因此"定时打招呼"想让用户看到：在工作流末尾加一个执行节点，actionType 填 send_notification，参数里引用前面节点生成的打招呼文本即可——这是拼装用法，不是引擎"执行完自动触达"；工作流编辑器里能否直接选到该工具，本次未查证。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `OperitApplication` | `app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:73` | 应用类，启动编排中枢 |
| `initializeMainApplication` | `app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:142` | 主初始化入口，只执行一次 |
| `ActivityLifecycleManager` | `app/src/main/java/com/ai/assistance/operit/core/application/ActivityLifecycleManager.kt:26` | Activity 生命周期跟踪单例 |
| `ForegroundServiceCompat` | `app/src/main/java/com/ai/assistance/operit/core/application/ForegroundServiceCompat.kt:10` | 前台服务跨版本兼容工具 |
| `PerformanceMonitorManager` | `app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:76` | 性能采样引擎单例 |
| `PerformanceEntityKind` | `app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:33` | 采样实体类别枚举 |
| `PerformanceSnapshot` | `app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:49` | 单次完整采样快照 |
| `WorkflowExecutor` | `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:79` | 工作流执行器 |
| `NodeExecutionState` | `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:44` | 节点执行状态五态机 |
| `WorkflowScheduler` | `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowScheduler.kt:22` | 基于 WorkManager 的调度器 |
| `WorkflowWorker` | `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:17` | 后台执行的 CoroutineWorker |
| `WorkflowSchedulerInitializer` | `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowSchedulerInitializer.kt:17` | 启动时重排调度的初始化器 |
| `WorkflowExecutionRetryableException` | `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:73` | 可重试异常标记 |

## 输入→处理→输出调用链

### 链路 1：应用启动编排

1. **输入**：系统创建进程，调用 `OperitApplication.onCreate()`（`app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:118`）
2. **处理**：`onCreate` 做轻量初始化 → 首个 Activity 或入口触发 `initializeMainApplication()` → `synchronized` 单次守卫（`:143`）→ `initializeMainApplicationLocked` 按 16 步顺序编排（偏好/WorkManager/日志/生命周期/插件/服务/记忆轮询/Shell/Shower/PDFBox/语言/图片池/工具注册/工作流调度器/备份排期/无障碍预绑定）
3. **输出**：各子系统就绪；`AppLogger` 输出全套""打点；应用进入可交互状态

### 链路 2：前后台跟踪

1. **输入**：Activity 的 `onActivityCreated` 等生命周期回调进入管理器（`app/src/main/java/com/ai/assistance/operit/core/application/ActivityLifecycleManager.kt:121`）
2. **处理**：`startedActivityCount` 计数判定前后台切换 → 派发插件钩子 → 前台时启动外部 HTTP 自动拉起；`onActivityResumed` 更新 `WeakReference` 当前 Activity 并节流保活麦克风前台服务
3. **输出**：`getCurrentActivity()` 随时返回前台 Activity；插件收到 `APPLICATION_FOREGROUND`/`BACKGROUND` 钩子

### 链路 3：性能采样

1. **输入**：用户打开性能分析界面，界面层调用 `PerformanceMonitorManager.start()`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:90`）
2. **处理**：
   - 1s 周期的 `samplingLoop` 循环采样（`app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:181`）
   - `sampleOnce` 分别读取主进程、插件引擎线程、终端 PTY 进程树三类指标（`app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:211`）
   - 差分计算 CPU/内存/网络后，用 `ArrayDeque` 保留最近 180 条快照（`app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:120`）
3. **输出**：
   - `stateFlow` 发布 `PerformanceMonitorState`，界面三个分析页从同一份快照序列取数（`app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt:122`）
   - 界面关闭时 `onDispose` 回调调用 `stop()`（`app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt:91`）

### 链路 4：工作流定时调度与执行

1. **输入**：
   - 应用启动 → `WorkflowSchedulerInitializer.initialize` 重排所有启用的工作流（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowSchedulerInitializer.kt:25`）
   - 用户新建/修改工作流 → `WorkflowScheduler.scheduleWorkflow`（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowScheduler.kt:54`）
2. **处理**：
   - 按 `interval`/`specific_time`/`cron` 三种类型生成 WorkManager 请求（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowScheduler.kt:30`）
   - 以 `workflow_<id>` 为唯一名入队（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowScheduler.kt:129`）
   - 到时 `WorkflowWorker.doWork` 被唤醒，经数据层仓库触发执行（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt:26`）
   - `WorkflowExecutor.executeWorkflow` 构建依赖图、做环检测、按 Kahn 拓扑顺序执行节点（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:527`）
   - `executeTool` 经 `toolHandler` 调用具体工具执行节点（`app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt:1275`）
3. **输出**：`WorkflowExecutionResult`（成功/失败/是否重试）与 `WorkflowExecutionRecord`（完整日志）；可重试失败经 `WorkflowExecutionRetryableException` → `Result.retry()` 由 WorkManager 指数退避重试

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt`（678 行）：应用启动编排、图片加载器配置、终止清理
- `app/src/main/java/com/ai/assistance/operit/core/application/ActivityLifecycleManager.kt`（269 行）：Activity 生命周期跟踪、常亮控制
- `app/src/main/java/com/ai/assistance/operit/core/application/ForegroundServiceCompat.kt`（64 行）：前台服务跨版本兼容
- `app/src/main/java/com/ai/assistance/operit/core/performance/PerformanceMonitorManager.kt`（502 行）：性能采样引擎
- `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowExecutor.kt`（1320 行）：工作流拓扑执行器
- `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowScheduler.kt`（473 行）：WorkManager 定时调度
- `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowSchedulerInitializer.kt`（56 行）：启动时重排调度
- `app/src/main/java/com/ai/assistance/operit/core/workflow/WorkflowWorker.kt`（59 行）：后台执行 Worker
- `app/src/main/java/com/ai/assistance/operit/ui/features/performance/PerformanceMonitorScreen.kt`（部分阅读）：采样启停调用方
