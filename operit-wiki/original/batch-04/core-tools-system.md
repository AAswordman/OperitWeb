---
title: 系统底层能力（Shell 执行器 / Action 监听器 / 终端 / 截屏投屏）
module: 工具系统
sources:
  - app/src/main/java/com/ai/assistance/operit/core/tools/system/
date: 2026-10-01
issue: 24
---

## 概述

`core/tools/system` 是 Operit 智能体的"手脚"：它让 AI 能执行 shell 命令、感知屏幕上的用户操作、开终端会话、截屏。这一层不做业务决策，只解决一件事——**按手机当前拿到的权限，把能力送到智能体手里**。

Android 的权限是分层的：普通应用、设备管理员、Shizuku 调试、Root，能力天差地别。这一层的核心设计就是**五级权限模型**：同一份调用，对每种权限级别各有一套实现，运行时按"从高到低"自动挑选最好的。

目录里 28 个文件、6145 行代码，覆盖五大块：

1. **Shell 执行器**（`shell/`）：5 个执行器 + 工厂，按权限级别执行命令。
2. **Action 监听器**（`action/`）：5 个监听器 + 管理器，感知点击/滑动/输入等用户操作。
3. **终端门面**（`Terminal.kt` + `OperitTerminalManager.kt`）：把独立终端 App 包装成会话式接口。
4. **截屏链**（`MediaProjection*` / `ScreenCapture*`）：MediaProjection 投屏截屏全套流程。
5. **授权与安装器**（`RootAuthorizer` / `ShizukuAuthorizer` / `ShizukuInstaller` / `AccessibilityProviderInstaller`）：检测、申请、安装各项权限。

## AI 速览

核心符号（每行一个，一句话职责）：

- `AndroidPermissionLevel` — 五级权限枚举：STANDARD < ACCESSIBILITY < DEBUGGER < ADMIN < ROOT。
- `ShellExecutor` — Shell 执行统一接口：`executeCommand` / `startProcess` / 权限四件套。
- `ShellExecutorFactory` — 执行器工厂：缓存实例，按权限级别从高到低选最优。
- `AndroidShellExecutor` — 向后兼容门面：按用户偏好级别执行，严格模式不降级。
- `ShellIdentity` — 命令身份：DEFAULT / APP / ROOT / SHELL。
- `RootShellExecutor` — Root 执行器：libsu + exec 双模式，支持降权到 SHELL 身份。
- `DebuggerShellExecutor` — Shizuku 执行器：经 `IShizukuService.newProcess` 起进程。
- `AdminShellExecutor` — 设备管理员执行器：只认 `lockscreen` / `wipe`。
- `AccessibilityShellExecutor` — 无障碍执行器：拒绝执行 shell 命令。
- `StandardShellExecutor` — 普通执行器：`Runtime.exec`，超时 30 秒。
- `RootAuthorizer` — Root 检测与授权单例，暴露 `isRooted` / `hasRootAccess`。
- `ShizukuAuthorizer` — Shizuku 连接管理，只认 uid 0 / 2000。
- `ActionListener` — 操作监听接口：`ActionEvent`（10 种 `ActionType`）。
- `ActionManager` — 监听管理器单例：`isListening` / `currentPermissionLevel` + 回调广播。
- `Terminal` — 终端门面：会话创建、命令执行、事件流。
- `MediaProjectionCaptureManager` — 投屏截屏：建 VirtualDisplay、取帧、落盘。
- `MediaProjectionHolder` — 全局单例，暂存投屏 token 与授权数据。
- `ScreenCaptureActivity` / `ScreenCaptureService` — 截屏授权 Activity + 保活前台服务。
- `OperitShowerShellRunner` — showerclient 到应用 Shell 执行的身份映射桥。

主入口：`AndroidShellExecutor.executeShellCommand(command, identity)`（shell）、`ActionManager.getInstance(ctx).startListeningWithHighestPermission {}`（监听）、`Terminal.getInstance(ctx)`（终端）。

数据流向一句话：智能体发命令 → 门面按权限级别选执行器 → 对应实现跑命令回结果；用户操作 → 监听器按权限级别采集 → `ActionEvent` 广播给回调；截屏授权 → token 存全局单例 → VirtualDisplay 出帧。

## 核心机制

### 1. 五级权限模型

`AndroidPermissionLevel` 定义 5 个级别：STANDARD（普通应用）、ACCESSIBILITY（无障碍）、DEBUGGER（Shizuku）、ADMIN（设备管理员）、ROOT。`ShellExecutorFactory` 和 `ActionListenerFactory` 都按这 5 级各做一套实现，实例按级别缓存。

选型规则：`getHighestAvailableExecutor()` 从 ROOT 到 STANDARD 逐级试，第一个"可用且有权限"的胜出；全军覆没回退 STANDARD。`ActionListenerFactory.getHighestAvailableListener()` 同构。

### 2. Shell 执行流水线

统一接口 `ShellExecutor` 规定：`executeCommand`（一次命令）、`startProcess`（长期交互进程）、`getPermissionLevel/isAvailable/requestPermission/hasPermission/initialize`（权限四件套）。结果统一为 `CommandResult(success, stdout, stderr, exitCode)`。

各执行器分工：

- **STANDARD**（`StandardShellExecutor`）：`Runtime.exec` 直接跑；命令含 `| & > < ;` 等 shell 操作符（引号内豁免）时改走 `sh -c`；30 秒超时；grep 退出码 1（无匹配）也算成功；恒可用。
- **ACCESSIBILITY**（`AccessibilityShellExecutor`）：拒绝执行，返回"无障碍服务不能直接执行 shell 命令"——这个级别只贡献监听能力。
- **DEBUGGER**（`DebuggerShellExecutor`）：经 Shizuku 的 `IShizukuService.newProcess` 起进程；`IShizukuService` 按 uid 缓存，`pingBinder` 验活；失败只对"read interrupted"重试（最多 3 次、间隔 500ms）；管道里的 grep 换成 `/system/bin/grep` 绝对路径；末尾单个 `&` 视为后台命令只启动不等待；shell 模式用 `sh -e -c`。
- **ADMIN**（`AdminShellExecutor`）：只支持两个"命令"——`lockscreen` 调 `lockNow()` 锁屏，`wipe` 调 `wipeData(0)` 清数据；其他一律拒绝。
- **ROOT**（`RootShellExecutor`）：libsu 模式（`FLAG_MOUNT_MASTER`、超时 10 秒）与 `su -c` 的 exec 模式双轨，可按偏好强制；`run-as` 包装的命令会被正则剥出真实命令；`ShellIdentity.SHELL` 时经私有目录的 `operit_shell_exec` 二进制降权执行。

门面 `AndroidShellExecutor.executeShellCommand` 读用户偏好的权限级别（默认 STANDARD），**严格模式**：首选执行器不可用或无权限时直接返回失败，不自动降级。

`ShellIdentity`（DEFAULT/APP/ROOT/SHELL）决定命令以什么身份跑，定义在 `AndroidShellExecutor.kt`。

### 3. Action 监听：把用户操作变成事件

统一接口 `ActionListener`：`startListening(actionCallback)` 开始监听并回传 `ActionEvent`，`stopListening()` 停止。`ActionEvent` 含时间戳、`ActionType`（CLICK、LONG_CLICK、SWIPE、TEXT_INPUT、KEY_PRESS、SCROLL、GESTURE、APP_SWITCH、SCREEN_CHANGE、SYSTEM_EVENT 共 10 种）、坐标、`ElementInfo`（resourceId、className、text、contentDescription、bounds、packageName）、输入文本、附加数据。

各监听器采集手段不同：

- **ROOT**（`RootActionListener`）：起 `getevent -l` 常驻进程读内核输入事件，BTN_TOUCH 抬起解析为 CLICK；进程退出且仍在监听时自动重启。
- **DEBUGGER**（`DebuggerActionListener`）：每秒轮询 `dumpsys window windows`（窗口焦点）与 `dumpsys activity activities`（Activity 栈），变化时发 SCREEN_CHANGE / APP_SWITCH；还内置了触摸事件解析（DOWN/UP→CLICK、MOVE→SWIPE）。
- **ACCESSIBILITY**（`AccessibilityActionListener`）：过滤高频噪音（eventType 2048），把 TYPE_VIEW_CLICKED、TEXT_CHANGED、SCROLLED、WINDOW_STATE_CHANGED 等映射为对应 `ActionType`。
- **ADMIN**（`AdminActionListener`）：框架已搭好（锁屏事件转 SYSTEM_EVENT），监控启动目前是空实现。
- **STANDARD**（`StandardActionListener`）：只监听应用内触摸与按键。

`ActionManager` 是单例总控：`isListening` / `currentPermissionLevel` 两个 StateFlow 对外广播状态；`startListeningWithHighestPermission` 一键用最优权限启动；事件通过 `registerEventCallback` 注册的回调 map 广播出去。

### 4. 终端：独立 App 的会话式包装

`Terminal` 是对独立终端模块（包 `com.ai.assistance.operit.terminal`）的门面，要求 Android 8.0+。用法是会话制的：`createSession()` 拿会话 id → `executeCommand(sessionId, command)` 执行 → `sendInput` / `sendInterruptSignal`（Ctrl+C）交互 → `closeSession()` 关闭。`executeCommand` 先订阅命令事件流再发命令，用 commandId 配对，避免快命令的输出在订阅前丢失；还有 `executeCommandFlow` 返回全过程事件流、`executeHiddenCommand`（默认 120 秒超时）供后台执行。

`OperitTerminalManager` 管终端 App 本体：包名 `com.ai.assistance.operit.terminal`，查是否安装、读已装版本、从 GitHub 仓库 `AAswordman/OperitTerminal` 的 Release 查最新版。

### 5. 截屏链：授权 → 保活 → 出帧

一次截屏走四步：

1. `ScreenCaptureActivity`（透明 Activity）：调系统 `createScreenCaptureIntent()` 请用户授权（REQUEST_CODE_CAPTURE=1001）。
2. 用户同意后，Android 14+ 要求**先起前台服务再取投屏 token**：`ScreenCaptureService.start()` 启动带 `FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION` 类型的前台服务（通知 ID 2001），Activity 以 30ms 间隔轮询 `isMediaProjectionForegroundReady`，最长等 1500ms。
3. 就绪后调 `getMediaProjection()` 拿 token，连同授权数据一起存进全局单例 `MediaProjectionHolder`。
4. `MediaProjectionCaptureManager.setupDisplay()` 用 token 建名叫 `OperitScreenCapture` 的 VirtualDisplay（`VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR`），画面进 `ImageReader(RGBA_8888, 最多 2 帧)`；`captureToBitmap()` 取最新帧（处理行填充裁剪），`captureToFile()` 以 PNG 质量 100 落盘。投屏被系统停止时回调里清掉 Holder 并停服务。

### 6. 授权器与安装器

- `RootAuthorizer`（单例）：四种手段查是否 Root——libsu 的 `isAppGrantedRoot()`、KernelSU（`su --version` 输出）、常见 su 路径（/system/bin/su 等）、`which su`；结果进 `isRooted` / `hasRootAccess` 两个 StateFlow；`requestRootPermission` 触发授权弹窗。
- `ShizukuAuthorizer`：认包名 `moe.shizuku.privileged.api`，兼容 Sui 后端；只接受 uid 0 / 2000 的连接；`requestShizukuPermission` 用 requestCode 100 走授权；给得出 adb 启动脚本指引。
- `ShizukuInstaller`：assets 里自带 `shizuku.apk`，解到 cacheDir 后用系统安装界面装；按主版本号比对决定是否提示更新；版本信息缓存 60 秒。
- `AccessibilityProviderInstaller`：同构，管 `com.ai.assistance.operit.provider` 包，版本号存在 `accessibility_version.txt`，安装动作委托 `UIHierarchyManager.launchProviderInstall`。
- `OperitShowerShellRunner`：showerclient 库的 `ShellRunner` 桥实现，把库的 `ShellIdentity`（DEFAULT/SHELL/ROOT）映射到应用的同名枚举，再调 `AndroidShellExecutor.executeShellCommand`。

## 关键符号

**Shell 执行**

- `ShellExecutor`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/shell/ShellExecutor.kt:7`）— 执行器统一接口
- `ShellExecutor.executeCommand`（`:13`）— 执行单条命令
- `ShellExecutor.startProcess`（`:50`）— 启动交互式进程
- `ShellExecutor.CommandResult`（`:53`）— success/stdout/stderr/exitCode
- `ShellProcess`（`:75`）— stdout/stderr Flow、destroy、waitFor、isAlive
- `ShellExecutorFactory.getExecutor`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/shell/ShellExecutorFactory.kt:22`）— 按级别取执行器
- `ShellExecutorFactory.getHighestAvailableExecutor`（`:55`）— 从高到低选最优
- `AndroidPermissionLevel`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/AndroidPermissionLevel.kt:12`）— 五级枚举
- `AndroidShellExecutor.executeShellCommand`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/AndroidShellExecutor.kt:82`）— 门面入口
- `ShellIdentity`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/AndroidShellExecutor.kt:139`）— DEFAULT/APP/ROOT/SHELL
- `RootShellExecutor`（`shell/RootShellExecutor.kt`）— libsu + exec 双模式
- `DebuggerShellExecutor`（`shell/DebuggerShellExecutor.kt`）— Shizuku 执行
- `AdminShellExecutor`（`shell/AdminShellExecutor.kt`）— lockscreen / wipe
- `AccessibilityShellExecutor`（`shell/AccessibilityShellExecutor.kt`）— 拒绝执行
- `StandardShellExecutor`（`shell/StandardShellExecutor.kt`）— Runtime.exec，30 秒超时

**授权与安装**

- `RootAuthorizer`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/RootAuthorizer.kt:20`）— Root 检测授权单例
- `RootAuthorizer.isDeviceRooted`（`:188`）— 四种检测手段
- `ShizukuAuthorizer`（`ShizukuAuthorizer.kt`）— Shizuku 连接管理
- `ShizukuInstaller`（`ShizukuInstaller.kt`）— 内置 APK 安装
- `AccessibilityProviderInstaller`（`AccessibilityProviderInstaller.kt`）— 无障碍提供者安装

**Action 监听**

- `ActionListener`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/action/ActionListener.kt:6`）— 监听统一接口
- `ActionListener.ActionEvent`（`:54`）— timestamp/actionType/coordinates/elementInfo/inputText
- `ActionListener.ActionType`（`:64`）— 10 种操作类型
- `ActionListenerFactory.getHighestAvailableListener`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/action/ActionListenerFactory.kt:52`）
- `ActionManager`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/action/ActionManager.kt:22`）— 单例总控
- `ActionManager.startListeningWithHighestPermission`（`:62`）
- `RootActionListener`（`action/RootActionListener.kt`）— `getevent -l`
- `DebuggerActionListener`（`action/DebuggerActionListener.kt`）— dumpsys 轮询
- `AccessibilityActionListener`（`action/AccessibilityActionListener.kt`）— 无障碍事件映射
- `AdminActionListener`（`action/AdminActionListener.kt`）— 空架子
- `StandardActionListener`（`action/StandardActionListener.kt`）— 应用内

**终端与截屏**

- `Terminal.getInstance`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/Terminal.kt:37`）— 终端门面单例
- `Terminal.executeCommand`（`:101`）— 先订阅后发送防丢输出
- `OperitTerminalManager`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/OperitTerminalManager.kt:14`）— 终端 App 安装与版本
- `MediaProjectionCaptureManager.setupDisplay`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/MediaProjectionCaptureManager.kt:38`）
- `MediaProjectionCaptureManager.captureToBitmap`（`:107`）/ `captureToFile`（`:152`）
- `MediaProjectionHolder`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/MediaProjectionHolder.kt:11`）— token 全局单例
- `ScreenCaptureActivity`（`ScreenCaptureActivity.kt`）— 授权 Activity
- `ScreenCaptureService`（`ScreenCaptureService.kt`）— 保活前台服务
- `OperitShowerShellRunner`（`app/src/main/java/com/ai/assistance/operit/core/tools/system/shower/OperitShowerShellRunner.kt:13`）— 身份映射桥

## 调用链

### 链 1：执行一条 shell 命令

1. **输入**：智能体调 `AndroidShellExecutor.executeShellCommand("ls /sdcard", ShellIdentity.DEFAULT)`。
2. **选型**：门面读用户偏好的权限级别（如 ROOT），`ShellExecutorFactory.getExecutor(ROOT)` 取缓存或新建 `RootShellExecutor` 并 `initialize()`。
3. **检查**：严格模式下若该执行器 `isAvailable()==false` 或 `hasPermission()` 未授权，直接返回失败（不降级）。
4. **执行**：`RootShellExecutor.executeCommand` 按模式走 libsu 或 `su -c`，身份 SHELL 时经 `operit_shell_exec` 降权。
5. **输出**：`CommandResult(success=true, stdout="...", stderr="", exitCode=0)` 回到智能体。

### 链 2：监听用户操作

1. **输入**：`ActionManager.getInstance(ctx).startListeningWithHighestPermission { event -> ... }`。
2. **选型**：`ActionListenerFactory.getHighestAvailableListener()` 从 ROOT 往下试，假设拿到 `DebuggerActionListener`。
3. **采集**：监听器起协程，每秒跑 `dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'`，焦点变化时构造 `ActionEvent(ActionType.SCREEN_CHANGE, ...)`。
4. **输出**：`ActionManager` 把事件广播给所有 `registerEventCallback` 注册的回调；`isListening` / `currentPermissionLevel` 同步更新。

### 链 3：截一张屏

1. **输入**：`ScreenCaptureActivity` 启动，`createScreenCaptureIntent()` 弹出系统授权框。
2. **保活**：用户同意 → `ScreenCaptureService.start()` 起前台服务 → 轮询 `isMediaProjectionForegroundReady`（30ms 间隔，1500ms 上限）。
3. **取 token**：`getMediaProjection(resultCode, data)`，token 与授权数据存 `MediaProjectionHolder`。
4. **出帧**：`MediaProjectionCaptureManager.setupDisplay()` 建 VirtualDisplay → `captureToBitmap()` 取最新帧（裁行填充）→ 返回 Bitmap；或 `captureToFile()` 写 PNG。

### 链 4：开一个终端会话跑命令

1. **输入**：`Terminal.getInstance(ctx).createSession("build")` 得会话 id。
2. **执行**：`executeCommand(sessionId, "gradle build")` 先订阅 `commandEvents`（按 sessionId+commandId 过滤）再发命令。
3. **输出**：命令完成事件到达 → 拼接输出返回字符串；中途可用 `executeCommandFlow` 看实时输出，`sendInterruptSignal` 发 Ctrl+C。

## 来源

- 源码：`app/src/main/java/com/ai/assistance/operit/core/tools/system/`（27 文件，6145 行），Operit v1.12.2（commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）
- 原子事实：`review/batch-04/core-tools-system.facts.json`（127 条）
- 代码走查：`review/batch-04/core-tools-system.quality.json`（11 条，评审站「代码走查」tab）
- 终端底层实现不在本目录：`com.ai.assistance.operit.terminal.TerminalManager`（独立模块）
