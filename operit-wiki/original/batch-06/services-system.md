---
title: 系统服务与悬浮窗
module: 系统层 / app
sources: 15
date: 2026-10-01
---

## 概述

`services/` 是 Operit 的系统级服务层：共 15 个种子文件，约 3728 行。它的核心职责是**把聊天能力装进 Android 系统服务里**——用户在任何 App 上都能呼出悬浮窗和 AI 对话。四个角色分工明确：`ChatServiceCore` 是纯业务核心（聚合 7 个委托，不管 UI），`FloatingChatService` 是前台服务（保活、崩溃熔断、自重启），`FloatingWindowManager` 管悬浮窗的渲染/拖拽/模式切换，`FloatingWindowState` 管窗口位置的持久化。

从用户视角看：悬浮窗有 6 种形态（窗口/小球/语音球/全屏/结果展示/屏幕 OCR），位置大小会被记住，下次打开还在原处；长按 Home 键或说唤醒词也能直接拉起全屏语音对话。从开发者视角看：悬浮窗和主界面共用同一套聊天业务逻辑（`ChatServiceCore`），区别只在"本地切换会话是否同步回全局"；系统助理入口（Assist/VoiceInteraction）本质上都是"拼好 intent 参数 → 启动 `FloatingChatService` → 自己 finish"。

相关页面：[[core-chat|聊天核心（总览）]]（`ChatServiceCore` 聚合的 7 个委托归属该页）。

## AI 速览

**核心符号清单**

- `ChatServiceCore` —— 聊天服务核心类，整合全部聊天业务逻辑 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:30`
- `ChatServiceUiBridge` —— UI 桥接接口（更新 Web 服务/重置附件面板/清除回复） `app/src/main/java/com/ai/assistance/operit/services/ChatServiceUiBridge.kt:7`
- `EmptyChatServiceUiBridge` —— 无操作桥接实现 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceUiBridge.kt:14`
- `ServiceLifecycleOwner` —— 给 Service 用的 LifecycleOwner（含 ViewModelStore） `app/src/main/java/com/ai/assistance/operit/services/ServiceLifecycleOwner.kt:14`
- `FloatingChatService` —— 悬浮聊天前台服务 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:57`
- `FloatingWindowManager` —— 悬浮窗窗口管理（添加/拖拽/模式切换） `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:97`
- `FloatingWindowCallback` —— 悬浮窗回调接口（12 个方法） `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:82`
- `FloatingWindowState` —— 窗口位置/尺寸/模式持久化 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:12`
- `FloatingMode` —— 悬浮窗形态枚举（6 值） `app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingMode.kt:6`
- `StatusIndicatorStyle` —— 状态指示器样式（全屏彩虹边框/顶部横条） `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:77`
- `UIDebuggerService` —— UI 调试器悬浮窗前台服务 `app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:28`
- `UIDebuggerWindowManager` —— UI 调试器悬浮窗窗口管理 `app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:38`
- `OperitAssistActivity` —— 系统 ASSIST intent 入口 Activity `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitAssistActivity.kt:18`
- `OperitVoiceInteractionService` —— 系统数字助理服务 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitVoiceInteractionService.kt:14`
- `OperitVoiceInteractionSessionService` —— 语音交互会话服务 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitVoiceInteractionSessionService.kt:21`
- `OperitNotificationStore` —— 通知缓存（最多 200 条） `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:14`
- `OperitNotificationListenerService` —— 系统通知监听服务 `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:112`
- `CloudEmbeddingService` —— 云端向量嵌入服务 `app/src/main/java/com/ai/assistance/operit/services/CloudEmbeddingService.kt:19`
- `TermuxCommandResultService` —— Termux 命令结果接收桥 `app/src/main/java/com/ai/assistance/operit/services/TermuxCommandResultService.kt:16`

**主入口**：悬浮窗从 `FloatingChatService` 的 `onStartCommand` 进（intent 参数定初始模式/自动退出），聊天业务从 `ChatServiceCore.sendUserMessage` 进，窗口渲染从 `FloatingWindowManager.show` 进，系统助理从 `OperitAssistActivity` / `OperitVoiceInteractionSession.onShow` 进。

**数据流向一句话**：系统 intent → `FloatingChatService`（前台保活）→ `ChatServiceCore`（业务，7 委托）→ `FloatingWindowManager`（6 种形态渲染）→ `FloatingWindowState`（位置落盘 `floating_chat_prefs`）；通知与 Termux 结果走各自的监听/回调桥流入。

## 核心机制

### ChatServiceCore：与 UI 解耦的聊天业务核心

- `ChatServiceCore` 的设计目标是"生命周期独立于 ViewModel，绑定到传入的 CoroutineScope"，可被 `FloatingChatService` 或 `ChatViewModel` 复用 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:32`
- 构造参数只有三个：`context`、`coroutineScope`、`selectionMode`（缺省 `FOLLOW_GLOBAL`） `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:36`
- 内部聚合 7 个委托：`MessageProcessingDelegate`、`ChatHistoryDelegate`、`ApiConfigDelegate`、`TokenStatisticsDelegate`、`AttachmentDelegate`、`UiStateDelegate`、`MessageCoordinationDelegate`，对外以 `get*` 暴露 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:50`
- `sendUserMessage` 只是把发送逻辑转发给 `messageCoordinationDelegate`（含总结逻辑） `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:263`
- `switchChatLocal` 切换本地 `chatId` 但 `syncToGlobal=false`——悬浮窗内切会话不影响主界面 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:334`
- `syncCurrentChatIdToGlobal` 则把本地 `chatId` 写回全局，供"返回主应用"时同步 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:341`
- `setUiBridge` 替换桥接实现并透传给 `messageCoordinationDelegate` `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:522`
- `setAdditionalOnTurnComplete` 注册回合完成回调（`chatId`、输入/输出 token、窗口大小），悬浮窗通知等场景用 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceCore.kt:518`
- `ChatServiceUiBridge` 只定义 4 个方法（更新 Web 服务/重置附件面板/清除与获取回复消息），`EmptyChatServiceUiBridge` 是全空实现 `app/src/main/java/com/ai/assistance/operit/services/ChatServiceUiBridge.kt:7`
- `ServiceLifecycleOwner` 让 Service 也能当 `LifecycleOwner` 用（同时实现 `ViewModelStoreOwner` 与 `SavedStateRegistryOwner`），事件封送到主线程处理 `app/src/main/java/com/ai/assistance/operit/services/ServiceLifecycleOwner.kt:14`

### FloatingChatService：前台保活与崩溃熔断

- 通知 ID 1001、渠道 `floating_chat_channel` `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:64`
- 以 `dataSync` 类型经 `ForegroundServiceCompat.startForeground` 启动为前台服务 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:301`
- `chatCore` 取自 `ChatRuntimeHolder.getInstance(...).getCore(ChatRuntimeSlot.FLOATING)`——悬浮窗有独立的运行时槽位 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:239`
- `onBind` 在服务未就绪时返回 null，防止调用方拿到未初始化的 `chatCore` `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:171`
- 申请 10 分钟 `PARTIAL_WAKE_LOCK` 保活 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:324`
- 崩溃处理中用 `commit()` 同步持久化崩溃计数与时间戳 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:190`
- 60 秒内崩溃超过 3 次标记停用并 `stopSelf` `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:196`
- 发现 `service_disabled_due_to_crashes` 为 true 直接 `stopSelf`，不再初始化 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:229`
- 正常路径 `onStartCommand` 返回 `START_STICKY` `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:546`
- `onTaskRemoved` 重新 `startService` 实现任务被划掉后的自重启 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:556`
- 唤醒启动经 `EXTRA_WAKE_LAUNCHED` 参数识别 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:428`
- 当前会话无用户消息（`hasAnyUserMessage` 为 false）时跳过唤醒自动建新会话 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:451`
- `EXTRA_AUTO_EXIT_AFTER_MS` 指定毫秒数后经 `scheduleAutoExit` 自动退出 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:469`
- onDestroy 把 `chatCore` 的 uiBridge 重置为 `EmptyChatServiceUiBridge` 并取消当前消息 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:617`
- onDestroy 销毁 `windowManager` `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:656`
- onDestroy 发送 `FLOATING_CHAT_SERVICE_STOPPED` 生命周期广播 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:671`
- 进入全屏模式时挂起 `AIForegroundService` 的唤醒词监听，避免自己和自己抢麦 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:417`
- 对外广播 4 个生命周期 Action（`STARTED`/`STOPPED`/`WINDOW_SHOWN`/`WINDOW_SHOW_FAILED`），`LocalBinder.getChatCore` 暴露业务核心给绑定方 `app/src/main/java/com/ai/assistance/operit/services/FloatingChatService.kt:102`

### FloatingWindowManager：6 种形态与动画同步的窗口切换

- `FloatingMode` 共 6 值：`WINDOW`（窗口）、`BALL`（悬浮球）、`VOICE_BALL`（语音球）、`FULLSCREEN`（全屏）、`RESULT_DISPLAY`（结果展示）、`SCREEN_OCR`（屏幕 OCR） `app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingMode.kt:6`
- `show` 把悬浮窗视图加到窗口，已添加时直接返回 true `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:163`
- `destroy` 移除悬浮窗视图、焦点遮罩视图并隐藏状态指示器 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:197`
- `createLayoutParams` 按当前模式生成窗口参数 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:490`
- 全屏与 OCR 用 `MATCH_PARENT` 铺满屏幕 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:511`
- 球模式按 `ballSize` 生成正方形窗口 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:521`
- 窗口模式按 `windowWidth`×缩放算像素尺寸 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:539`
- 模式切换的物理尺寸变更延迟与 Compose 动画同步：切到球模式延迟 150ms（等旧内容淡出），从球切出延迟 100ms（等球淡出） `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:908`
- 全屏跨窗口模糊半径 48dp，API 31 以下跳过 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:149`
- 输入法弹出首次延迟 200ms、最多重试 4 次 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:150`
- `onMove` 在全屏模式下直接返回，禁用拖动 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:998`
- 状态指示器两种样式：`FULLSCREEN_RAINBOW`（全屏彩虹边框）与 `TOP_BAR`（顶部横条） `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:77`
- `showStatusIndicator` 按样式渲染指示器 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:397`
- 状态指示器窗口带 `FLAG_NOT_FOCUSABLE` 与 `FLAG_NOT_TOUCHABLE`，不拦截触摸 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:420`
- `setStatusIndicatorAlpha` 在非主线程调用时用 `CountDownLatch` 最多等 200ms，保证跨线程可见性 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:466`
- 焦点遮罩只在 `WINDOW` 模式且窗口可见时显示，点击遮罩让窗口失焦 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowManager.kt:258`

### FloatingWindowState：位置持久化与脏数据防御

- 状态落盘在 `floating_chat_prefs` `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:12`
- 默认位置 (200,200)、尺寸 300dp×400dp、缩放 0.8、模式 `WINDOW`、球 60dp `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:29`
- `saveState` 用 `require` 拒绝把非有限数值（NaN/Inf）写入，否则下次启动布局测量会炸 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:63`
- 持久化时钳制：宽 200~屏幕最大宽、高 250~屏幕最大高、缩放 0.3~1.0 `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:72`
- 读到非法模式名回退为 `WINDOW` `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:109`
- 读到 NaN 直接抛异常（调用方捕获后停服务，见走查） `app/src/main/java/com/ai/assistance/operit/services/floating/FloatingWindowState.kt:98`

### 系统助理入口：Assist 与 VoiceInteraction 三件套

- `OperitAssistActivity` 收到系统 ASSIST intent 后启动悬浮窗入口 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitAssistActivity.kt:14`
- 启动参数指定 `FULLSCREEN` 模式并自动进入语音聊天 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitAssistActivity.kt:37`
- API 26 及以上用 `startForegroundService`，低版本用 `startService` `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitAssistActivity.kt:41`
- `OperitVoiceInteractionService` 继承 `VoiceInteractionService`，是系统把 Operit 识别为数字助理的核心 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitVoiceInteractionService.kt:14`
- `onGetSupportedVoiceActions` 仅调 super，无实质定制 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitVoiceInteractionService.kt:38`
- `onShow` 启动悬浮窗服务后立即 `finish`，不用系统覆盖层 `app/src/main/java/com/ai/assistance/operit/services/assistant/OperitVoiceInteractionSessionService.kt:45`

### 通知监听：200 条内存缓存

- `OperitNotificationStore` 用 `LinkedHashMap` 按 key 缓存通知，最多 200 条，超限删最旧 `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:14`
- `extractText` 合并 title/text/bigText/textLines，去重后按换行拼接 `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:81`
- 合并结果为空时兜底返回 `tickerText` `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:103`
- `snapshot` 按时间戳倒序取前 N 条，可选是否含常驻通知 `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:61`
- 连接成功时全量 `upsert` 当前活跃通知 `app/src/main/java/com/ai/assistance/operit/services/notification/OperitNotificationListenerService.kt:112`

### 云端嵌入与 Termux 结果桥

- `CloudEmbeddingService.generateEmbedding` 配置未就绪或文本为空返回 null，异常一律吞掉记日志（调用方无法区分失败原因） `app/src/main/java/com/ai/assistance/operit/services/CloudEmbeddingService.kt:37`
- 请求为 `{model, input}` JSON，`Authorization: Bearer` 头；超时连接 30s、读写各 60s `app/src/main/java/com/ai/assistance/operit/services/CloudEmbeddingService.kt:72`
- `completeEmbeddingsEndpoint` 自动补全路径：末尾 `#` 直接去掉，空路径补 `/v1/embeddings`，以 `/v1` 结尾补 `/embeddings` `app/src/main/java/com/ai/assistance/operit/services/CloudEmbeddingService.kt:172`
- 向量解析为 `FloatArray`；`truncate` 默认转单行截断 200 字符 `app/src/main/java/com/ai/assistance/operit/services/CloudEmbeddingService.kt:120`
- `TermuxCommandResultService` 继承已废弃的 `IntentService` `app/src/main/java/com/ai/assistance/operit/services/TermuxCommandResultService.kt:16`
- `callbackMap` 以 executionId 为键保存命令结果回调 `app/src/main/java/com/ai/assistance/operit/services/TermuxCommandResultService.kt:22`
- `onHandleIntent` 按 executionId 取回调并解析结果 `app/src/main/java/com/ai/assistance/operit/services/TermuxCommandResultService.kt:46`
- 从 `result` Bundle 解析 stdout/stderr/exitCode/errmsg，`exitCode==0` 判成功，回调执行后移除 `app/src/main/java/com/ai/assistance/operit/services/TermuxCommandResultService.kt:66`

### UIDebugger：调试器的悬浮窗化

- `UIDebuggerService` 是把 UI 调试器做成悬浮窗的前台服务 `app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:30`
- 通知 ID 1337、渠道 `UIDebuggerChannel` `app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:59`
- `onStartCommand` 返回 `START_NOT_STICKY` `app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:84`
- 以 `BIND_AUTO_CREATE` 绑定 `FloatingChatService` `app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:77`
- 用 `viewModel` 的 `setWindowInteractionController` 控制其悬浮窗可见性 `app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:46`
- `UIDebuggerWindowManager` 管调试器悬浮窗 `app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:38`
- 初始为悬浮球，点击后展开为全屏分析模式 `app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:122`
- API 26 及以上用 `TYPE_APPLICATION_OVERLAY`，低版本用 `TYPE_PHONE` `app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:56`
- 关闭回调调用 `stopSelf` 停止服务 `app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:95`

## 关键符号（英文原名）

| 符号 | 一句话 |
|---|---|
| `ChatServiceCore` | 聊天业务核心，聚合 7 委托，生命周期独立于 ViewModel |
| `ChatServiceUiBridge` | UI 桥接接口（4 方法），悬浮窗销毁时切为空实现 |
| `ServiceLifecycleOwner` | 给 Service 用的 LifecycleOwner + ViewModelStore |
| `FloatingChatService` | 悬浮聊天前台服务（通知 1001，START_STICKY，自重启） |
| `FloatingWindowManager` | 悬浮窗窗口管理：6 模式布局/拖拽/IME/状态指示器 |
| `FloatingWindowCallback` | 悬浮窗回调接口，12 个方法 |
| `FloatingWindowState` | 窗口位置/尺寸/模式持久化（`floating_chat_prefs`） |
| `FloatingMode` | 6 种形态：WINDOW/BALL/VOICE_BALL/FULLSCREEN/RESULT_DISPLAY/SCREEN_OCR |
| `StatusIndicatorStyle` | 状态指示器样式：全屏彩虹边框 / 顶部横条 |
| `UIDebuggerService` | UI 调试器悬浮窗前台服务（通知 1337） |
| `UIDebuggerWindowManager` | 调试器悬浮球→全屏分析窗口管理 |
| `OperitAssistActivity` | 系统 ASSIST 入口，启动悬浮窗后自 finish |
| `OperitVoiceInteractionService` | 系统数字助理服务（VoiceInteractionService 子类） |
| `OperitVoiceInteractionSessionService` | 语音会话服务，onShow 拉起全屏悬浮窗 |
| `OperitNotificationStore` | 通知内存缓存（LinkedHashMap，上限 200） |
| `OperitNotificationListenerService` | 系统通知监听，连接时全量同步 |
| `CloudEmbeddingService` | 云端向量嵌入（Bearer 鉴权，endpoint 自动补全） |
| `TermuxCommandResultService` | Termux 命令结果桥（executionId→回调） |

## 调用链（输入→处理→输出）

1. 输入：用户点悬浮窗图标/系统 ASSIST/唤醒词 → 处理：`FloatingChatService.onStartCommand` 解析 intent（初始模式/自动进语音/自动退出毫秒数），建 `ChatServiceCore`（FLOATING 槽位）、起前台通知、持 WakeLock → 输出：悬浮窗显示 + 生命周期广播。
2. 输入：用户在悬浮窗输入消息 → 处理：`FloatingWindowCallback.onSendMessage` → `ChatServiceCore.sendUserMessage` 转发 `messageCoordinationDelegate`（含总结）→ 输出：`chatCore.chatHistory` 更新，`FloatingChatService` 订阅后同步到本地 `chatMessages`。
3. 输入：用户拖悬浮球/点全屏 → 处理：`FloatingWindowManager.switchMode` 算目标布局参数，延迟 150ms/100ms 与 Compose 淡入淡出动画同步后改物理尺寸 → 输出：窗口形态切换完成。
4. 输入：窗口移动/缩放 → 处理：`FloatingWindowState` 钳制范围并 `saveState` 写 `floating_chat_prefs`（拒绝 NaN）→ 输出：下次启动 `restoreState` 恢复位置。
5. 输入：系统通知到达 → 处理：`OperitNotificationListenerService.onNotificationPosted` → `OperitNotificationStore.upsert`（200 上限，`extractText` 合并文本）→ 输出：AI 可查的通知快照（倒序）。
6. 输入：Termux 命令执行完成 → 处理：`TermuxCommandResultService.onHandleIntent` 按 executionId 取回调、解析 `result` Bundle（exitCode==0 判成功）→ 输出：回调被调用一次后移除。
7. 输入：记忆模块要向量 → 处理：`CloudEmbeddingService.generateEmbedding` 补全 endpoint、Bearer 请求、解析 `FloatArray`（异常吞掉返 null）→ 输出：`Embedding?`。

## 来源

- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- `services/` 15 文件已全文阅读：`ChatServiceCore.kt`、`ChatServiceUiBridge.kt`、`ServiceLifecycleOwner.kt`、`FloatingChatService.kt`、`UIDebuggerService.kt`、`CloudEmbeddingService.kt`、`TermuxCommandResultService.kt`、`assistant/` 下 3 个、`floating/` 下 3 个、`notification/OperitNotificationListenerService.kt`；相邻 `ui/floating/FloatingMode.kt` 一并阅读
- 原子事实：`services-system.facts.json`（131 条），代码走查：`services-system.quality.json`（11 条：警告 5 / 建议 6）
