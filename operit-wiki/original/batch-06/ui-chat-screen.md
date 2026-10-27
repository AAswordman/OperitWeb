---
title: 聊天主界面与状态管理
module: ui/chat-screen
sources: app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/ConfigurationScreen.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/UiStateDelegate.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStore.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/FloatingWindowDelegate.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ChatHistorySelector.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MentionTokenUtils.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MessageImageGenerator.kt, app/src/main/java/com/ai/assistance/operit/ui/features/chat/attachments/AttachmentUtils.kt
date: 2026-10-01
---

# 聊天主界面与状态管理

## 概述

聊天主界面是 Operit Android 应用的核心交互面：用户在这里发消息、看 AI 回复、管理会话、切换角色卡、开悬浮窗、绑定工作区。技术上它由两层组成：界面层负责"长什么样、点哪里"，状态层负责"数据从哪来、动作发给谁"。两者之间用 Kotlin StateFlow 单向流动：状态层暴露只读状态流，界面收集后渲染；用户操作则调用状态层的公开函数。

关键设计是会话隔离：App 允许多个会话同时有后台流式输出，加载态与输入处理态都按"当前会话 id"做过滤，保证界面只响应当前会话的状态变化，别的会话在后台跑也不会干扰当前页面。

## AI 速览

- 核心符号清单：`AIChatScreen`、`ChatInputBottomBar`、`ChatViewModel`、`ChatHistorySelector`、`PendingMessageQueueStore`、`UiStateDelegate`、`FloatingWindowDelegate`、`MentionTokenUtils`、`MessageImageGenerator`、`AttachmentUtils`、`ChatInputHookRegistry`、`ChatViewHookPluginRegistry`、`ChatHistoryDisplayMode`。
- 主入口：
  - `AIChatScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:120`）
  - `ChatViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:103`）
- 数据流向一句话：用户输入经底栏输入组件的插件钩子校验后进入状态层的发送函数，转交消息协调 delegate 执行，流式结果经状态流回到界面渲染。

## 核心机制

### 界面组装

`AIChatScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:120`）是聊天页的入口 composable。

它标注了 `@RequiresApi`、`@Composable` 与 `@Preview`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:115`）。

ViewModel 取外部传入或内部创建的 `ChatViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:143`）。

`chatViewId`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:286`）用 `rememberSaveable` 存放随机 UUID。

界面打开时经 `ChatViewHookPluginRegistry` 派发 `VIEW_OPENED`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:315`）。

关闭时在 `DisposableEffect` 中派发 `VIEW_CLOSED`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:321`）。

外部应用分享的内容经 `SharedIncomingContentHandler` 转交 `handleSharedFiles` 与 `handleSharedText`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:380`）。

聊天风格由主题快照决定：`CHAT_STYLE_BUBBLE` 对应 `ChatStyle` 的 `BUBBLE`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:197`）。

顶栏动作经 `LocalTopBarActions` 注入（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:774`）。

界面收集 `scrollToBottomEvent`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:328`）驱动自动滚动。

收集处满足条件时调用 `animateScrollTo` 滚到 `maxValue`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:675`）。

### 底栏输入

`ChatInputBottomBar`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1481`）是底栏私有 composable。

它用 `isMessageProcessing` 判定是否正在处理消息（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1547`）。

`isQueueBlocked` 再并入两种总结状态（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1556`）。

发送前先调 `dispatchSubmitRequested`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1717`）做插件钩子校验。

`BLOCK` 时把队列项恢复回待发送队列并提示（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1729`）。

`CONSUME` 时仅提示不发送（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1734`）。

`sendQueuedItemNow`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1713`）支持取消当前对话后发送队列项。

`enqueueDraftToPendingQueue`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1784`）把草稿入队并清空输入框。

长粘贴转附件只在插入超阈值时读 `primaryClip`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1618`），避免每次按键触发系统的已读剪贴板提示。

模型名命中特定 id 时弹出 `showModelSuggestionDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:342`）。

### 状态中枢

`ChatViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:103`）是聊天状态的中枢。

它持有 `ChatRuntimeHolder` 实例（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:166`）。

各 delegate 取自 `getCore`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:454`）。

对外暴露的派生状态用 `by lazy` 延迟求值（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:199`）。

`ChatHistoryDisplayMode`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:97`）有 `BY_CHARACTER_CARD`、`BY_FOLDER`、`CURRENT_CHARACTER_ONLY` 三个值。

缺省显示模式为 `CURRENT_CHARACTER_ONLY`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:345`）。

`currentChatIsLoading`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:267`）用 `combine` 做会话级隔离。

`currentChatInputProcessingState`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:279`）同样按会话隔离。

`sendUserMessage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1460`）先收起 mention 面板再委托发送。

`shareMessages`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1004`）负责把选中消息渲染成图片分享。

`rollbackToMessage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1309`）回滚到指定消息。

`dismissErrorDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1659`）同时把当前会话输入状态置为 `InputProcessingState` 的 `Idle`。

`onCleared`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2441`）取消监听 job 并清理悬浮窗与语音服务。

### mention 提及

`updateUserMessage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1363`）在文本变化时处理 mention token 删除。

`normalizeMentionDeletion`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1364`）负责该归一化。

`findActiveMentionTrigger`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1959`）从光标向前扫描触发符。

`selectMentionPackage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1431`）把 token 替换为文本并挂载附件。

### 外部分享

`handleSharedText`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2052`）处理外部传入的文字。

`handleSharedFiles`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2079`）处理外部传入的文件。

`resolveTargetChatIdForSharedContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2004`）确定目标会话。

分享文件逐个处理且间隔 `delay`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2110`）。

### 工作区与语音

`toggleWebView`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2187`）开关工作区预览。

`prepareWorkspaceServer`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2255`）用 `LocalWebServer` 启动本地服务。

`bindChatToWorkspace`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2486`）管理会话与工作区的绑定。

`unbindChatFromWorkspace`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2511`）解除绑定。

`executeCommandInWorkspace`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2566`）先切换到工作区目录再执行命令。

`speakMessage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2999`）分段播报消息。

`toggleAutoRead`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:3146`）控制自动朗读开关。

`handleAttachment`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1728`）处理文件附件。

`captureScreenContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1799`）采集屏幕内容。

### 会话列表

`ChatHistorySelector`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ChatHistorySelector.kt:426`）是会话列表面板。

内容搜索带防抖，经 `searchChatIdsByContent` 做全文检索（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ChatHistorySelector.kt:589`）。

拖拽排序回调重算 `displayOrder`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ChatHistorySelector.kt:818`）。

删除走 `promptDeleteChat` 确认（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ChatHistorySelector.kt:483`）。

设置对话框在 `showSettingsDialog` 为真时展示（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/ChatHistorySelector.kt:1617`）。

### 支撑组件

`UiStateDelegate`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/UiStateDelegate.kt:17`）管理错误、弹窗与 Toast。

Toast 用 `ArrayDeque` 队列保序（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/UiStateDelegate.kt:26`）。

主权限等级缺省为 `ASK`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/UiStateDelegate.kt:31`）。

`PendingMessageQueueStore`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStore.kt:16`）是 internal 类，按会话存待发送队列。

消息 id 用 `AtomicLong` 生成（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStore.kt:18`）。

`consumeAutoDequeueSignal`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStore.kt:71`）四条件全满足才放行自动出队。

`removeChat`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/PendingMessageQueueStore.kt:89`）在删会话时清队列。

`toggleFloatingMode`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/FloatingWindowDelegate.kt:162`）是悬浮窗模式切换入口。

悬浮窗服务经 `startForegroundService` 启动（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/FloatingWindowDelegate.kt:180`）。

`INITIAL_MODE`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/FloatingWindowDelegate.kt:219`）经 intent extra 透传初始模式。

`findMentionTokens`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MentionTokenUtils.kt:47`）查找 mention token 范围。

`findCommittedMentionTokens`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MentionTokenUtils.kt:86`）只取已提交的 token。

`generateMessageImage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MessageImageGenerator.kt:81`）把选中消息渲染为分享长图。

空消息列表抛 `IllegalArgumentException`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MessageImageGenerator.kt:110`）。

截图前固定等待 `delay`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MessageImageGenerator.kt:350`）。

图片写到 `shared_images` 目录（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/util/MessageImageGenerator.kt:403`）。

`formatFileSize`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/attachments/AttachmentUtils.kt:8`）按 B/KB/MB/GB 格式化。

`getDisplayName`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/attachments/AttachmentUtils.kt:18`）缺省 20 字符截断保留扩展名。

`ConfigurationScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/ConfigurationScreen.kt:28`）是 API Key 首次配置页。

输入经 `normalize` 归一化（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/ConfigurationScreen.kt:38`）。

主按钮按输入状态在保存与弹 `TokenInfoDialog` 间切换（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/ConfigurationScreen.kt:155`）。

`ApiKeyFormatValidator`（`app/src/main/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidator.kt:4`）的 `normalize` 去除首尾空白。

## 关键符号（英文原名）

界面层：`AIChatScreen`、`ChatInputBottomBar`、`ChatScreenContent`、`ClassicChatSettingsBar`、`AgentChatInputSection`、`ClassicChatInputSection`、`ChatHistorySelector`、`MentionSuggestionOverlay`、`ConfigurationScreen`、`TokenInfoDialog`。

状态层：`ChatViewModel`、`UiStateDelegate`、`PendingMessageQueueStore`、`PendingMessageQueueState`、`FloatingWindowDelegate`、`ChatHistoryDisplayMode`、`InputProcessingState`、`ActiveMentionTrigger`。

工具：`MentionTokenUtils`、`MentionTokenRange`、`MessageImageGenerator`、`AttachmentUtils`、`ApiKeyFormatValidator`、`ChatInputHookRegistry`、`ChatViewHookPluginRegistry`、`SharedIncomingContentHandler`、`LocalWebServer`。

## 输入→处理→输出调用链

### 链路 1：用户发送一条消息

1. 输入：用户在 `ChatInputBottomBar`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1481`）输入文本点发送。
2. 处理：先走 `dispatchSubmitRequested`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1717`）做插件钩子校验。
3. 处理：`BLOCK` 时把队列项恢复回待发送队列并提示（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:1729`）。
4. 处理：无异议则调 `sendUserMessage`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:1460`），先收起 `hideMentionSuggestionPanel` 再委托发送。
5. 输出：流式结果经状态流回到界面，`animateScrollTo` 滚到 `maxValue`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:675`）。

### 链路 2：AI 回复中用户切走再回来

1. 输入：用户切换到另一个会话，原会话继续后台流式输出。
2. 处理：`currentChatIsLoading`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:267`）用 `combine` 只反映当前会话的加载态。
3. 输出：切回原会话时界面从状态流拿到最新消息列表渲染，无状态错乱。

### 链路 3：外部应用分享内容进来

1. 输入：外部应用分享文件或文字到 Operit。
2. 处理：`SharedIncomingContentHandler`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/screens/AIChatScreen.kt:380`）接住并转交状态层。
3. 处理：`resolveTargetChatIdForSharedContent`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2004`）确定目标会话。
4. 处理：分享文件逐个处理且间隔 `delay`（`app/src/main/java/com/ai/assistance/operit/ui/features/chat/viewmodel/ChatViewModel.kt:2110`）。
5. 输出：内容出现在目标会话的输入区等待用户确认发送。

## 来源

- 源码仓库：Operit（AAswordman/Operit），commit dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 10 个种子文件：ui/features/chat/screens/AIChatScreen.kt（2087 行）、screens/ConfigurationScreen.kt（234 行）、viewmodel/ChatViewModel.kt（3199 行）、viewmodel/UiStateDelegate.kt（95 行）、viewmodel/PendingMessageQueueStore.kt（105 行）、viewmodel/FloatingWindowDelegate.kt（282 行）、components/ChatHistorySelector.kt（2509 行）、util/MentionTokenUtils.kt（95 行）、util/MessageImageGenerator.kt（439 行）、attachments/AttachmentUtils.kt（36 行），已 100% 全文阅读并登记于 tracking/read-status.json
- 事实清单：ui-chat-screen.facts.json（81 条）；代码走查：ui-chat-screen.quality.json（9 条）
