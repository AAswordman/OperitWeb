---
title: 系统诊断、日志与平台服务
module: 工具层 / app
sources: 16
date: 2026-10-01
---

# 系统诊断、日志与平台服务（util-system）

> 覆盖源码：`app/src/main/java/com/ai/assistance/operit/util/` 下 AppLogger / AnrMonitor / CrashRecoveryState / GlobalExceptionHandler / ThrowableTextFormatter / HttpLogSanitizer / PortProcessKiller / NetworkUtils / GithubReleaseUtil / LocaleUtils / LocationUtils / SerializationSetup / IntRangeSerializer / LocalDateTimeSerializer / UriSerializer / exceptions（共 16 文件，2001 行，commit dbf71916）

## 概述

这一页是 Operit 的"系统杂物间"：应用级日志、ANR 监控、崩溃恢复、异常文本格式化、日志脱敏、端口清理、网络判断、GitHub 发版检查、多语言、地区判断、序列化配置，全部收拢在 `util` 包下。它们不属于某个业务模块，而是被各处调用的基础设施。

用人话说：App 想记日志、抓崩溃、查更新、切语言、判断用户在不在国内，调的就是这些工具类。

## AI 速览

- 核心符号：`AppLogger`、`AnrMonitor`、`CrashRecoveryState`、`GlobalExceptionHandler`、`ThrowableTextFormatter`、`HttpLogSanitizer`、`PortProcessKiller`、`NetworkUtils`、`GithubReleaseUtil`、`LocaleUtils`、`LocationUtils`、`SerializationSetup`、`IntRangeSerializer`、`LocalDateTimeSerializer`、`UriSerializer`、`UserCancellationException`
- 主入口：`AppLogger.d/i/w/e(...)`（全应用日志总线）；`AnrMonitor.start()`（ANR 监控）；`GlobalExceptionHandler`（未捕获异常兜底）；`LocaleUtils.setAppLanguage(...)`（语言切换）
- 数据流向一句话：各模块调用 `AppLogger` 写日志 → 后台单线程落盘到 `filesDir/logs/operit.log`，`ToolPkg` 相关日志额外镜像到 `packageLogs/`；崩溃时 `GlobalExceptionHandler` 标记状态并拉起上报页；ANR 监控独立采样主线程健康度并可落盘报告。

## 核心机制

### 1. AppLogger：双通道日志

`AppLogger` 是 object 单例，API 与 `android.util.Log` 同名（`v/d/i/w/e/wtf/println/isLoggable/getStackTraceString`，AppLogger.kt:166 起）。每条日志走两条通道：

1. 系统 Log（可经 `enableSystemLog=false` 关闭，供纯 JVM 单元测试避开 "not mocked" 异常，AppLogger.kt:75）；
2. 文件日志：经名叫 `OperitAppLogger` 的守护单线程 executor 异步写入（AppLogger.kt:85），路径为应用内部 `filesDir/logs/operit.log`（AppLogger.kt:33）。

文件日志有截断保护：单条消息最多 12_000 字符，堆栈最多 24_000 字符（AppLogger.kt:38）。行格式为 `yyyy-MM-dd HH:mm:ss.SSS 等级/Tag: 消息`（AppLogger.kt:42）。

另外有一套"插件包日志镜像"：tag 为 `ToolPkg`（忽略大小写）的日志会被复制一份到 `OperitPaths.operitRootDir()/packageLogs/` 下按启动时间命名的文件（`yyyyMMdd_HHmmss_SSS.log`，AppLogger.kt:134），最多保留 20 个，超量时按文件名排序删最旧的（AppLogger.kt:147）。镜像行会从消息里用正则提取 `[PKG:xxx]`、`[SCRIPT:xxx]`、`[PLUGIN:xxx]` 标记，方便按包/脚本/插件过滤（AppLogger.kt:45）。

`enableFileLogging=false` 可彻底关闭文件日志（AppLogger.kt:68）。`getLogFile()` 把日志文件暴露给导出功能（AppLogger.kt:269），`resetLogFile()` 删除日志并清空缓存引用（AppLogger.kt:272）。

### 2. AnrMonitor：主线程 watchdog

`AnrMonitor(context, coroutineScope, tag)` 用"心跳"法检测主线程阻塞：后台每 100ms 向主线程 Handler post 一个空任务并更新 `lastResponseTime`；若两次心跳间隔超过 500ms 记警告，超过 1000ms 记 ANR（AnrMonitor.kt:47）。阈值、采样间隔、最多保留 10 条堆栈历史都是 companion 常量（AnrMonitor.kt:47）。

监控协程跑在 `Dispatchers.Default`（AnrMonitor.kt:103）；若协程启动失败，降级为 `ScheduledExecutorService` 单线程（线程名 `AnrMonitor-Watchdog`、最高优先级、守护线程，AnrMonitor.kt:122）。

检测到 ANR 时抓取完整线程转储：`analyzeStackTrace` 只保留 `com.ai.assistance.operit` 包的堆栈行（AnrMonitor.kt:347）；连续两次分析结果相同则去重跳过输出（`lastAnrAnalysis`，AnrMonitor.kt:305）。`addCallerInfo(key, info)` 允许业务方登记调用者信息，辅助定位 ANR 来源（AnrMonitor.kt:186）；`reportSlowResponse(responseTime)` 允许外部上报慢响应（AnrMonitor.kt:166）。

`stop()` 时若发生过 ANR 或警告，会把报告写到外部文件 `anr_reports/anr_report_yyyyMMdd_HHmmss.txt`，内容含 ANR/警告次数、最长阻塞、系统信息（SDK、厂商机型、内存）与堆栈历史（AnrMonitor.kt:380）。

### 3. 崩溃恢复：CrashRecoveryState + GlobalExceptionHandler

`CrashRecoveryState` 用 SharedPreferences（名 `crash_recovery_state`）存一个布尔标记 `preserve_logs_for_crash_report`：崩溃时置位，下次启动读取后清除并返回（CrashRecoveryState.kt:6），用于告诉启动流程"保留日志以供崩溃上报"。

`GlobalExceptionHandler` 实现 `Thread.UncaughtExceptionHandler`（GlobalExceptionHandler.kt:8）：捕获未处理异常后，先标记待上报，格式化堆栈，再以 `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TASK` 拉起 `ui.error.CrashReportActivity` 展示崩溃信息，最后 `exitProcess(1)` 结束进程（GlobalExceptionHandler.kt:22）。注意它没有链式调用系统默认 handler。

### 4. 异常文本与日志脱敏

`ThrowableTextFormatter.format(throwable, maxChars)` 把异常转成纯文本：默认上限 24_000 字符、下限 512（ThrowableTextFormatter.kt:8）；每个异常最多 64 帧、cause 链最多 8 层（ThrowableTextFormatter.kt:10）；用 `IdentityHashMap` 检测循环 cause（ThrowableTextFormatter.kt:24）；格式化本身 OOM 时降级输出类名+message（`buildMinimalText`，ThrowableTextFormatter.kt:44）。

`HttpLogSanitizer` 专门给 HTTP 日志脱敏：`urlForLog` 保留 scheme/host/port，路径只记"几个段"不记内容，query 只留参数名、值统一 `[omitted]`，fragment 省略（HttpLogSanitizer.kt:7）；`headersForLog` 只留头名、值统一 `[omitted]`，空头返回 `[empty]`（HttpLogSanitizer.kt:38）。

### 5. 平台服务小件

- `PortProcessKiller.killListeners(port)`：拼 shell 脚本，用 `ss`/`netstat`/`lsof` 查占用端口的 PID 并 `kill -9`，返回被杀 PID 列表，失败返回空列表（PortProcessKiller.kt:9）。
- `NetworkUtils.isNetworkAvailable`：要求有活动网络、具备 INTERNET 能力、传输层为 WiFi/蜂窝/以太网之一（NetworkUtils.kt:12）；`getNetworkType` 返回本地化的连接类型字符串（NetworkUtils.kt:26）。
- `GithubReleaseUtil`：内置 34 个 GitHub 镜像站（GithubReleaseUtil.kt:40）；`getMirroredUrls` 只对含 `github.com` 且路径含 `/releases/download/` 的 URL 生成镜像地址（GithubReleaseUtil.kt:80）；`probeMirrorUrls` 并发对各镜像做 256KB Range 请求测速，返回延迟与带宽（GithubReleaseUtil.kt:90）；`fetchLatestReleaseInfo` 取最新 release，优先找 `.apk` 资产，否则回退 release 页面，版本号去掉 tag 的 `v` 前缀（GithubReleaseUtil.kt:178）。
- `LocaleUtils`：支持 10 种语言（含跟随系统，LocaleUtils.kt:53）；日语未翻译项回退英文而非中文（`createCompatLocaleList`，LocaleUtils.kt:97）；`setAppLanguage` 在 Android 13+ 用 `AppCompatDelegate.setApplicationLocales`，低版本走 `updateConfiguration`（LocaleUtils.kt:170）；语言偏好持久化在 `UserPreferencesManager`，读取失败回退系统语言（LocaleUtils.kt:146）；兼容旧别名 `pt`→`pt-BR`、`in`→`id`（LocaleUtils.kt:50）。
- `LocationUtils.isDeviceInMainlandChina`：不依赖 Google Play Services（LocationUtils.kt:35）。先走免权限启发式：运营商国家码、时区是否为 Asia/Shanghai 或 Asia/Urumqi（LocationUtils.kt:37）；无定位权限且启发式未命中时直接返回 false（LocationUtils.kt:42）；有权限则取定位 → Geocoder 反查国家码 → 失败时用经纬度矩形框（纬度 18–54、经度 73–135，并排除台港澳小矩形）判定（LocationUtils.kt:160）。

### 6. 序列化与异常类型

`SerializationSetup.module` 注册 `IntRangeSerializer` 为 contextual 序列化器（SerializationSetup.kt:13）。`IntRangeSerializer` 把 `IntRange` 存为 `{start, endInclusive}`（IntRangeSerializer.kt:10）；`LocalDateTimeSerializer` 用 `ISO_LOCAL_DATE_TIME` 字符串（LocalDateTimeSerializer.kt:14）；`UriSerializer` 把 `android.net.Uri?` 存为字符串，空字符串反序列化为 null（UriSerializer.kt:19）。`exceptions/UserCancellationException` 继承 `CancellationException`，用于区分"用户主动取消"和普通错误（UserCancellationException.kt:11）。

## 关键符号

| 符号 | 位置 | 一句话 |
|---|---|---|
| `AppLogger` | util/AppLogger.kt:22 | 全应用日志总线：系统 Log + 文件双通道 |
| `AnrMonitor` | util/AnrMonitor.kt:38 | 主线程 watchdog，阈值 1000/500ms |
| `CrashRecoveryState` | util/CrashRecoveryState.kt:5 | SharedPreferences 存崩溃上报标记 |
| `GlobalExceptionHandler` | util/GlobalExceptionHandler.kt:8 | 未捕获异常：标记→拉起上报页→杀进程 |
| `ThrowableTextFormatter` | util/ThrowableTextFormatter.kt:6 | 异常转文本，64 帧/8 层上限 |
| `HttpLogSanitizer` | util/HttpLogSanitizer.kt:6 | URL/请求头脱敏 |
| `PortProcessKiller` | util/PortProcessKiller.kt:7 | 按端口查 PID 并 kill -9 |
| `NetworkUtils` | util/NetworkUtils.kt:9 | 网络可用性/类型判断 |
| `GithubReleaseUtil` | util/GithubReleaseUtil.kt:20 | 发版检查 + 34 镜像测速 |
| `LocaleUtils` | util/LocaleUtils.kt:11 | 10 语言管理与切换 |
| `LocationUtils` | util/LocationUtils.kt:24 | 是否在中国大陆（无 GMS 依赖） |
| `SerializationSetup` | util/SerializationSetup.kt:9 | 注册 contextual 序列化器 |
| `UserCancellationException` | util/exceptions/UserCancellationException.kt:11 | 用户取消 vs 普通错误的区分 |

## 输入 → 处理 → 输出调用链

1. **输入**：业务代码调用 `AppLogger.e(tag, msg, tr)` / `AnrMonitor.start()` / `LocaleUtils.setAppLanguage(ctx, "zh")` 等入口。
2. **处理**：日志经 `writeToFile` 投递到 `OperitAppLogger` 单线程（AppLogger.kt:289），格式化截断后追加写文件；`ToolPkg` 日志额外提取标记镜像到 `packageLogs/`（AppLogger.kt:405）；ANR 监控循环比对主线程心跳，超阈值抓转储、去重、记数；崩溃时 handler 标记 SharedPreferences 并拉起上报 Activity。
3. **输出**：`filesDir/logs/operit.log` 与 `packageLogs/<启动时间>.log` 落盘；`getLogFile()` 供设置页导出；ANR 报告落盘到 `anr_reports/`；语言/地区判断结果回传调用方。

## 来源

- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 种子文件 16 个（util/AppLogger.kt、AnrMonitor.kt、CrashRecoveryState.kt、GlobalExceptionHandler.kt、ThrowableTextFormatter.kt、HttpLogSanitizer.kt、PortProcessKiller.kt、NetworkUtils.kt、GithubReleaseUtil.kt、LocaleUtils.kt、LocationUtils.kt、SerializationSetup.kt、IntRangeSerializer.kt、LocalDateTimeSerializer.kt、UriSerializer.kt、exceptions/UserCancellationException.kt），已 100% 全文阅读并登记。
- 机器可读事实见 `util-system.facts.json`；代码走查见 `util-system.quality.json`。
