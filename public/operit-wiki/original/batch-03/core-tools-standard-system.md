---
title: 标准工具·系统操作/多媒体/UI
module: core
sources: 13
date: 2026-10-01
---

# 标准工具·系统操作/多媒体/UI

## 概述

- 本页覆盖 Operit 标准工具集中"操作系统级能力"的一半：系统设置与应用管理、设备信息、Intent/广播、Shell/终端、蓝牙/BLE、音乐播放、FFmpeg 音视频、计算器、软件设置（模型配置/角色卡/沙盒包/语音服务/MCP 重启）、以及 UI 自动化。执行框架与注册机制见总览页 [[core-tools|工具系统总览]]。
- 另 9 个标准工具文件归兄弟页：[[core-tools-standard-filesystem|标准工具·文件系统]]（LinuxFileSystemTools / SafFileSystemTools / StandardFileSystemTools）、[[core-tools-standard-webchat|标准工具·浏览器/网络/聊天/工作流]]（StandardBrowserSessionTools / StandardChatManagerTool / StandardHttpTools / StandardWebVisitTool / StandardWorkflowTools / MemoryQueryToolExecutor）。
- 设计上分三层：**工具函数层**（`Standard*Tools` 类上的工具函数，负责参数解析与结果封装）→ **管理器单例层**（`BluetoothSessionManager`、`MusicPlaybackManager`、`Terminal` 等，持有会话与连接状态）→ **系统/第三方能力层**（Android 系统服务、Shizuku、FFmpegKit、ExoPlayer）。
- 一个关键的诚实结论：`StandardUITools` 类注释明示标准版不支持 UI 操作，点击等 7 个直接 UI 操作全部返回固定失败；标准版真正可用的 UI 相关能力只有 UI 子 agent 循环和截图。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:52`

## AI 速览

- **主入口**：`StandardSystemOperationTools`（系统/应用/蓝牙/定位）、`StandardTerminalCommandExecutor`（终端会话）、`StandardShellToolExecutor`（`execute_shell`）、`BluetoothSessionManager`（蓝牙会话单例）、`MusicPlaybackManager`（ExoPlayer 播放）、三个 FFmpeg 执行器、`StandardUITools`（UI）、`StandardSoftwareSettingsModifyTools`（软件设置）。
- **核心符号**：`StandardSystemOperationTools`、`StandardTerminalCommandExecutor.createOrGetSession`、`BluetoothSessionManager`、`MusicPlaybackManager`、`StandardFFmpegToolExecutor` / `StandardFFmpegConvertToolExecutor`、`StandardUITools.runUiSubAgent`、`StandardUITools.OPERATION_NOT_SUPPORTED`、`StandardSoftwareSettingsModifyTools.restartMcpWithLogs`。
- **数据流向一句话**：AI 工具调用 → 执行器解析参数 → 管理器单例维护会话/连接状态（终端 session、蓝牙 bt-/ble- 会话、播放器）→ 调用 Android 系统服务或 FFmpegKit/ExoPlayer → 封装为 `ToolResult`（`*ResultData`）返回。

## 核心机制

### 系统操作工具总入口

- 系统操作工具总入口是 `open class StandardSystemOperationTools`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:57`
- `toast` 在主线程弹出 `Toast.LENGTH_SHORT` 短提示。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:112`
- `sendNotification` 发高优先级通知。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:138`
- 通知通道为 `AI_REPLY_CHANNEL_ID`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:62`
- `sendNotification` 是 `open suspend fun`，用 `NotificationCompat.Builder` 构建通知。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:138`
- 通知正文截断 100 字（`setContentText(message.take(100))`），但 `BigTextStyle` 保留完整文本。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:182`
- 通知 id 取 `(System.currentTimeMillis() and 0x7FFFFFFF).toInt()`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:195`
- `modifySystemSetting` 的 `namespace` 参数默认 `system`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:220`
- `namespace` 限 `system`/`secure`/`global`，分别写入 `Settings.System`、`Settings.Secure`、`Settings.Global`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:270`
- 无 `WRITE_SETTINGS` 权限时自动打开 `ACTION_MANAGE_WRITE_SETTINGS` 授权页并返回失败。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:244`
- `getSystemSetting` 从三命名空间读取系统设置。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:295`
- `installApp` 校验 APK 路径存在。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:357`
- 内部路径 APK 先拷贝到 `OperitPaths.cleanOnExitDir()` 暂存（`install_<时间戳>_<原名>`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:79`
- 安装经 `FileProvider.getUriForFile` 取 content URI。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:383`
- 发 `ACTION_VIEW` 意图请求安装（用户确认）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:392`
- `uninstallApp` 先确认应用已安装。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:419`
- 再发 `ACTION_DELETE` 意图（用户确认卸载）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:443`
- `listInstalledApps` 默认排除系统应用，按应用名排序。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:467`
- `startApp` 按包名启动或指定 activity。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:514`
- 指定 activity 时构造 `ComponentName`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:533`
- `stopApp` 经 `ActivityManager.killBackgroundProcesses` 杀后台进程。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:568`
- `getNotifications` 读取系统通知。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:610`
- 检查 `enabled_notification_listeners` 是否含本包。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:616`
- 无通知权限则打开 `ACTION_NOTIFICATION_LISTENER_SETTINGS` 授权页。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:628`
- 通知数据来自 `OperitNotificationStore.snapshot(limit, includeOngoing)`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:645`
- `getAppUsageTime` 按天聚合应用前台时长，默认近 24 小时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:666`
- 经 `UsageStatsManager` 查询用量数据。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:723`
- `limit` 默认 10，`include_system_apps` 默认 false。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:679`
- `hasUsageStatsAccess()` 经 `AppOpsManager` 判定用量访问权限。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:91`

### 蓝牙与 BLE 工具组

- `requestBluetoothPermission` 按系统版本申请蓝牙或定位权限。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:890`
- Android 12+ 申请 `BLUETOOTH_CONNECT`+`BLUETOOTH_SCAN`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:848`
- `getBluetoothState` 在设备不支持蓝牙时返回 `supported=false`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:920`
- `requestEnableBluetooth` 请求开启蓝牙。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:967`
- 发 `ACTION_REQUEST_ENABLE` 意图让用户确认。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:993`
- `listBluetoothBondedDevices` 返回已配对设备，按名+地址排序。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1024`
- `scanBluetoothDevices` 的 `duration_ms` 默认 10000L。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1078`
- `scanBluetoothDevices` 的 `include_ble` 默认 true，同时扫经典蓝牙与 BLE。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1079`
- `connectBluetooth` 的 `address` 必填，`uuid` 可选（缺省 SPP）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1106`
- `listenBluetooth` 默认监听名 "Operit Bluetooth"。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1129`
- `acceptBluetooth` 的 timeout 默认 30000ms。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1149`
- `readBluetooth` 的 `max_bytes` 默认 4096。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1202`
- `sendAndReadBluetooth` 的 payload 支持 text 或 data_base64。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1224`
- `closeBluetooth` 关闭蓝牙会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1248`
- `connectBle` 的 `auto_connect` 默认 false。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1264`
- `discoverBleServices` 的 timeout 默认 10000L。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1285`
- `readBleCharacteristic` 的 timeout 为 5000L。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1309`
- `writeBleCharacteristic` 的 timeout 为 5000L。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1326`
- `writeAndReadBleCharacteristic` 允许写与读用不同的 service/characteristic uuid。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1342`
- `subscribeBleCharacteristic` 的 `enable` 默认 true。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1376`
- `readBleNotifications` 的 `limit` 默认 20，读后清空队列。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1393`
- `getDeviceLocation` 先检查定位权限。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1411`
- `high_accuracy` 默认 false。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1414`
- `include_address` 默认 true。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1416`
- 用 `Geocoder` 反查地址。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:1651`

### 蓝牙会话管理器

- `BluetoothSessionManager` 是 `object` 单例，集中管理蓝牙会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:44`
- 默认 SPP UUID 为 `00001101-0000-1000-8000-00805F9B34FB`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:45`
- 三个 `ConcurrentHashMap` 分存 `classicSessions`、`classicListeners`、`bleSessions`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:68`
- `newSessionId` 生成前缀 `bt-`/`bt-listen-`/`ble-` 加 UUID 的会话 id。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:72`
- `parseUuid` 在参数为空时回退默认 SPP UUID。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:78`
- `scan` 并行做经典蓝牙与 BLE 扫描，结果按名+地址排序并标记来源。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:110`
- 经典扫描用 `BroadcastReceiver` 收 `ACTION_FOUND`（含 RSSI）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:150`
- BLE 扫描用 `ScanCallback`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:195`
- `connectClassic` 建 RFCOMM 连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:232`
- 经 `createRfcommSocketToServiceRecord` 建 socket。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:240`
- `listenClassic` 创建蓝牙监听器。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:254`
- `acceptClassic` 接受传入连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:267`
- `readClassic` 读经典蓝牙数据。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:293`
- 轮询 `input.available()`，每 20ms 检查一次，超时返回空。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:301`
- `connectBle` 发起 BLE 连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:333`
- 经 `BluetoothDevice.TRANSPORT_LE` 建 Gatt 连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:405`
- TIRAMISU 版本分支在经典蓝牙广播接收器注册（`RECEIVER_NOT_EXPORTED`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:171`
- `getParcelableExtra` 取设备有 TIRAMISU 分支。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:223`
- BLE 写特征（`writeCharacteristic`）有 TIRAMISU 分支。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:484`
- `BluetoothGattCallback` 本身无版本分支。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:344`
- `discoverBleServices` 发现 BLE 服务。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:415`
- `subscribeBleCharacteristic` 开关 BLE 通知订阅。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:513`
- 向 0x2902 描述符写 `ENABLE_NOTIFICATION_VALUE`/`DISABLE_NOTIFICATION_VALUE`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:529`
- `readBleNotifications` 取出最多 limit 条后从队列清除。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:538`
- `closeBle`/`closeAny` 关闭会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:550`
- `decodePayload`：`dataBase64` 优先，否则 text 按 UTF-8。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:581`

### 设备信息、Intent、广播、计算器、Cookie

- 设备信息工具是 `open class StandardDeviceInfoToolExecutor`，实现 `ToolExecutor`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:21`
- 设备唯一标识取自 `Settings.Secure.ANDROID_ID`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:26`
- 内存经 `ActivityManager.MemoryInfo` 读取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:47`
- 存储经 `StatFs` 读取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:53`
- 电池经 `ACTION_BATTERY_CHANGED` 粘性广播读取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:66`
- CPU ABI 经 `getprop ro.product.cpu.abi` 读取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:84`
- 广播工具是 `class StandardSendBroadcastToolExecutor`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt:17`
- `invoke` 为 suspend 函数。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt:42`
- `applyComponentName`：类名以点开头时自动补包名前缀。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt:23`
- 广播的 `action` 参数必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt:53`
- 在主线程经 `sendBroadcast` 发出。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt:110`
- `validateParameters` 校验广播参数。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt:142`
- Intent 工具是 `class StandardIntentToolExecutor`，支持 activity/broadcast/service 三种类型。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardIntentToolExecutor.kt:22`
- `applyComponentName` 复用与广播工具相同的组件名解析逻辑。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardIntentToolExecutor.kt:33`
- `invoke` 处理 flags 按位或、extras 数组类型等 intent 构造细节。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardIntentToolExecutor.kt:52`
- `validateParameters` 要求 action 或 component 必填其一。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardIntentToolExecutor.kt:260`
- 计算器由 `class StandardCalculator` 包装底层 `Calculator`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:9`
- `evalExpression` 返回 `Double` 计算值。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:12`
- `calculateExpression` 返回结构化 `CalculationResultData`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:17`
- 常用变量只暴露 `ans`、`pi`、`e`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:33`
- `getVariable`/`setVariable` 读写变量。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:47`
- `clearVariables` 清空变量。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:57`
- `formatDate` 做日期格式化。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:62`
- `formatDateStructured` 返回 `DateResultData`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:67`
- `getSupportedUnits` 返回支持的单位换算类别。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:82`
- `getSupportedDateFunctions` 返回支持的日期函数清单。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:87`
- `getSupportedStatFunctions` 返回支持的统计函数清单。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:92`
- `getSupportedJsFeatures` 返回底层支持的 JS 特性清单。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:97`
- `CookiePrivacyManager` 是 `internal object` 单例。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/CookiePrivacyManager.kt:10`
- `clearAllCookies` 先清 `StandardHttpTools` 的共享 cookie。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/CookiePrivacyManager.kt:12`
- 再在主线程经 WebView `CookieManager.removeAllCookies()` 并 `flush()`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/CookiePrivacyManager.kt:16`

### Shell 与终端

- ADB shell 工具由 `open class StandardShellToolExecutor` 实现，依赖 Shizuku。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt:18`
- `DEFAULT_TIMEOUT`=15000L，但注释说明实际未使用、仅为 API 兼容保留。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt:20`
- `invoke` 经 `AndroidShellExecutor.executeShellCommand` 执行。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt:25`
- `validateParameters` 做参数校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt:84`
- 只拦截含 `rm -rf` 或 `format` 子串的命令。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt:91`
- 终端会话工具是 `class StandardTerminalCommandExecutor`（类注释：非流式版本）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:19`
- 超时中断后等待 `COMMAND_CANCEL_SETTLE_TIMEOUT_MS`=3000L 让命令安定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:26`
- `createOrGetSession` 按 `session_name` 复用或新建会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:31`
- `executeCommandInSession` 是命令执行入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:88`
- 默认 `timeout_ms`=1800000L（30 分钟）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:103`
- 输出经 `terminal.executeCommandFlow(sessionId, command)` 收集。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:124`
- 超时走 `withTimeout`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:134`
- 超时返回 `exitCode`=-1。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:151`
- 结果数据类的 `timedOut` 字段标记超时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:172`
- `executeCommandInSessionStream` 是 Flow 流式版。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:197`
- `executeHiddenCommand` 在隐藏终端执行命令。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:342`
- `executor_key` 参数默认 "default"。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:357`
- 隐藏执行默认超时 120000L。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:362`
- `inputInSession` 向会话写输入或控制键。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:419`
- `closeSession` 关闭会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:498`
- `getSessionScreen` 只渲染当前可见屏、不含历史滚动。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:539`
- `cancelTimedOutCommand` 发中断信号。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:605`
- 取消后用 `withTimeoutOrNull(COMMAND_CANCEL_SETTLE_TIMEOUT_MS)` 等待安定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:608`
- `normalizeControl` 做控制键别名映射（return→enter 等）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:642`
- `applyModifierControl` 处理 ctrl/alt/shift/meta 修饰键语义。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:691`
- `applyCtrlCombination` 把 ctrl+字母转控制码（A=1…Z=26）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:718`

### 音乐播放与 FFmpeg

- `play` 的 `source` 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:28`
- `source_type` 限 path/url/uri。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:34`
- `playQueue` 的 items 为 JSON 数组。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:84`
- pause/resume/stop/status/seek/setVolume 统一走 `execute` 包装。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:135`
- 队列项的 `source_type` 逐项校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:274`
- `MusicPlaybackManager` 是私有构造的单例。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:328`
- 状态机含 `playing` 等字符串状态。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:390`
- 暂停时状态置为 `paused`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:455`
- 停止时状态置为 `stopped`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:475`
- `ensurePlayer` 懒创建 `ExoPlayer`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:503`
- 状态变更经 `Player.Listener` 回调。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:516`
- url 类型要求 http/https，uri 要求有 scheme。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:566`
- `getInstance` 双重检查获取单例。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:632`
- `StandardFFmpegToolExecutor` 实现 `ToolExecutor`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:17`
- `invoke` 校验 command 非空。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:23`
- 经 `FFmpegKit.execute(command)` 执行。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:38`
- 按 `ReturnCode` 区分成功/取消/失败。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:42`
- 成功结果为 `FFmpegResultData`（含执行耗时）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:45`
- `StandardFFmpegInfoToolExecutor` 返回版本与构建信息。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:92`
- 版本经 `FFmpegKitConfig.getVersion()` 获取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:103`
- 执行 `-codecs` 列出支持的编解码器。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:107`
- `StandardFFmpegConvertToolExecutor` 的输入输出路径必填且输入须存在。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:142`
- 转码成功后 `FFprobeKit.getMediaInformation` 取媒体信息。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:211`

### UI 工具

- `StandardUITools` 实现 `ToolImplementations`，类注释明示标准版不支持 UI 操作。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:52`
- `OPERATION_NOT_SUPPORTED` 是统一返回的不支持文案。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:58`
- `APP_PACKAGES` 是中文应用名→包名映射表。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:61`
- `addAppPackages` 可扩展映射表。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:253`
- `scanAndAddInstalledApps` 扫描已装应用补全映射（只跑一次）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:259`
- `getPageInfo` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:306`
- `tap` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:343`
- `longPress` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:353`
- `clickElement` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:363`
- `setInputText` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:373`
- `pressKey` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:383`
- `swipe` 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:393`
- `runUiSubAgent` 是 UI 自动化子 agent 循环（标准版真正可用的 UI 能力）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:407`
- `max_steps` 默认 20。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:409`
- 要求 `UI_CONTROLLER` 功能模型启用识图。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:422`
- 经 `EnhancedAIService.getAIServiceForFunction` 取模型服务。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:434`
- 用 `ActionHandler` 处理动作。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:442`
- 用 `PhoneAgent` 跑多步循环。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:450`
- 成功判定看 `finalMessage` 是否含失败标记。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:474`
- `captureScreenshotToFile` 经 MediaProjection 截图到文件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:612`
- `captureScreenshotBitmap` 返回 `Bitmap`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:656`

### 软件设置：环境变量、沙盒包与脚本

- `StandardSoftwareSettingsModifyTools` 是软件设置修改工具（含 MCP 重启与日志收集）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:90`
- `readEnvironmentVariable` 读环境变量。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:92`
- 经 `EnvPreferences.getInstance` 存取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:104`
- `writeEnvironmentVariable` 写空值=删除（返回 cleared=true）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:120`
- `listSandboxPackages` 强制刷新列出沙盒包。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:177`
- `setSandboxPackageEnabled` 开关沙盒包，返回变更前后状态。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:241`
- `executeSandboxScriptDirect` 直跑沙盒脚本。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:324`
- 要求 `source_path` 与 `source_code` 恰好二选一。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:336`
- 脚本经 `JsEngine.executeScriptCode` 执行。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:411`
- `JsExecutionTraceRecorder` 记录执行轨迹。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:357`
- `parseEnvFile` 解析 env 文件（跳过注释与空行、去包裹引号）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2454`

### 软件设置：语音服务

- `getSpeechServicesConfig` 返回 TTS/STT 配置，apiKey 只给脱敏预览。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:438`
- `setSpeechServicesConfig` 只更新传入字段，更新后重置语音服务工厂。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:502`
- `VoiceServiceFactory.resetInstance()` 使新配置生效。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:787`
- `testTtsPlayback` 的 text 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:820`
- `interrupt` 参数默认 true。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:846`
- `maskSecret`：≤4 位全掩码，否则前 3 位 + `***` + 后 2 位。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2358`
- `formatTtsPlaybackError` 按异常类型分级格式化错误（网络异常给中文提示）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2396`

### 软件设置：模型配置与功能绑定

- `listModelConfigs` 返回配置列表与功能-模型映射。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:954`
- `createModelConfig` 默认名 "New Model Config"。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1007`
- `updateModelConfig` 的 `config_id` 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1053`
- 更新后经 `EnhancedAIService.refreshServiceForFunction` 刷新运行时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1093`
- `deleteModelConfig` 拒绝删除默认配置。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1124`
- `listFunctionModelConfigs` 列出各功能的模型绑定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1185`
- `getFunctionModelConfig` 的 `function_type` 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1224`
- `setFunctionModelConfig` 绑定功能到指定配置与模型索引。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1290`
- `testModelConfigConnection` 测试模型连通性。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1369`
- 经 `ModelConfigConnectionTester.run` 执行测试。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1395`
- `parseFunctionType` 忽略大小写匹配 `FunctionType` 枚举。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2123`
- `applyModelConfigUpdates` 支持数十个模型参数字段的更新。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2131`
- `modelConfigToResultItem` 中 apiKey 只暴露是否设置与脱敏预览。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2298`

### 软件设置：角色卡与 MCP

- `listCharacterCards` 列出全部角色卡。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1450`
- `getCharacterCard` 的 `character_card_id` 必填。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1479`
- `createCharacterCard` 要求 `name` 非空。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1519`
- `updateCharacterCard` 至少需要一个更新字段。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1558`
- `deleteCharacterCard` 拒绝删除默认角色卡。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1611`
- `setActiveCharacterCard` 切换当前激活角色卡。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1662`
- `clearActiveCharacterCard` 清空激活角色卡。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1702`
- `importCharacterCardFromTavernJson` 导入 Tavern JSON。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1721`
- `exportCharacterCardToTavernJson` 导出 Tavern JSON。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1773`
- `restartMcpWithLogs` 的 `timeout_ms` 默认 120000L。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1823`
- 重启后返回各插件的启动状态、日志与未归属的 extraLogs。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1823`
- `applyCharacterCardUpdates` 处理角色卡字段更新（含工具准入配置）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1937`
- 聊天模型绑定模式限 `FOLLOW_GLOBAL`/`FIXED_CONFIG`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2044`
- 记忆画像绑定模式限 `FOLLOW_GLOBAL`/`FIXED_PROFILE`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2054`
- `parseBooleanParameter` 接受 1/true/yes/y/on 与 0/false/no/n/off。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2438`
- `parseJsonObjectToMap` 要求输入为 JSON 对象。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:2446`

## 关键符号

| 符号 | 角色 | 位置 |
|---|---|---|
| `StandardSystemOperationTools` | 系统操作工具总入口（通知/设置/应用/蓝牙/定位） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:57` |
| `StandardTerminalCommandExecutor` | 终端会话工具（会话复用/超时中断/流式/隐藏执行） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:19` |
| `StandardShellToolExecutor` | execute_shell（Shizuku 提权 shell，弱黑名单） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt:18` |
| `BluetoothSessionManager` | 蓝牙/BLE 会话单例（bt-/bt-listen-/ble- 会话 id） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:44` |
| `MusicPlaybackManager` | ExoPlayer 播放单例 | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:328` |
| `StandardFFmpegToolExecutor` | FFmpeg 任意命令执行 | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:17` |
| `StandardFFmpegConvertToolExecutor` | FFmpeg 转码 | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:142` |
| `StandardUITools` | UI 工具（标准版直接操作不可用） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:53` |
| `StandardUITools.runUiSubAgent` | UI 自动化子 agent 循环（标准版真正可用的 UI 能力） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:407` |
| `StandardSoftwareSettingsModifyTools` | 软件设置（模型/角色卡/沙盒/语音/MCP） | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:90` |
| `StandardSoftwareSettingsModifyTools.restartMcpWithLogs` | MCP 重启与日志收集 | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1823` |
| `StandardDeviceInfoToolExecutor` | 设备信息采集 | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt:21` |
| `StandardCalculator` | 计算器 | `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt:9` |

## 调用链

1. **系统操作**：AI 工具调用 → `StandardSystemOperationTools` 的工具函数解析参数。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:57`
   - 缺权限则打开系统授权页引导用户，如 `ACTION_MANAGE_WRITE_SETTINGS`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:244`
   - 调用 Android 系统服务后封装 `ToolResult` 返回。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt:112`
2. **终端命令**：`createOrGetSession` 按 `session_name` 复用或新建会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:31`
   - `executeCommandInSession` 是命令执行入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:88`
   - 输出经 `terminal.executeCommandFlow` 收集。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:124`
   - 超时走 `withTimeout`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:134`
   - `cancelTimedOutCommand` 发中断信号并等待 `COMMAND_CANCEL_SETTLE_TIMEOUT_MS` 让命令安定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:605`
   - 超时返回 `exitCode`=-1。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:151`
   - 结果数据类的 `timedOut` 字段标记超时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt:172`
3. **蓝牙**：`BluetoothSessionManager` 是单例会话中心。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:44`
   - 三张 `ConcurrentHashMap` 分存经典会话、监听器、BLE 会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:68`
   - `newSessionId` 生成带前缀的会话 id。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:72`
   - `connectClassic` 建 RFCOMM 连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:232`
   - `connectBle` 发起 BLE 连接。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt:333`
4. **音乐**：`MusicPlaybackManager` 是播放器单例。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:328`
   - `ensurePlayer` 懒创建 ExoPlayer。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:503`
   - 状态变更经 `Player.Listener` 回调。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:516`
   - 结果封装为 `MusicPlaybackResultData`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt:451`
5. **FFmpeg**：`FFmpegKit.execute` 执行命令。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:38`
   - 按 `ReturnCode` 判定成功/取消/失败。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:42`
   - 结果为 `FFmpegResultData`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:45`
   - 转码成功后 `FFprobeKit.getMediaInformation` 补媒体元信息。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt:211`
6. **UI 自动化**：`runUiSubAgent` 是 UI 自动化子 agent 循环。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:407`
   - 要求 `UI_CONTROLLER` 功能模型启用识图。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:422`
   - 经 `EnhancedAIService.getAIServiceForFunction` 取模型服务。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:434`
   - 用 `ActionHandler` 处理动作。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:442`
   - 用 `PhoneAgent` 跑多步循环。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:450`
   - 成功判定看 `finalMessage` 是否含失败标记。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:474`
   - 结果为 `AutomationExecutionResult`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt:10`
7. **软件设置**：`StandardSoftwareSettingsModifyTools` 是配置修改入口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:90`
   - 模型配置变更后经 `EnhancedAIService.refreshServiceForFunction` 刷新运行时。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:1093`
   - 语音配置变更后 `VoiceServiceFactory.resetInstance`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt:787`

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/BluetoothSessionManager.kt`（661 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/CookiePrivacyManager.kt`（26 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardCalculator.kt`（101 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardDeviceInfoToolExecutor.kt`（178 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFFmpegTool.kt`（365 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardIntentToolExecutor.kt`（294 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardMusicPlaybackTools.kt`（638 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSendBroadcastToolExecutor.kt`（149 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardShellToolExecutor.kt`（102 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSoftwareSettingsModifyTools.kt`（2517 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardSystemOperationTools.kt`（2517 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardTerminalCommandExecutor.kt`（770 行）
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardUITools.kt`（680 行）
