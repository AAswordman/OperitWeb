---
title: 悬浮窗界面
module: UI / 悬浮窗
sources: 29
date: 2026-10-01
issue: 111
---

# ui-floating（悬浮窗界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/floating/`（28 个 Kotlin 文件、8,093 行）+ `ui/pet/AvatarEmotionManager.kt`（108 行，悬浮宠物表情推理，本轮补写，原按大纲排除）@ `dbf71916`

> 覆盖 Operit 悬浮窗的六种形态：窗口聊天（可拖动缩放）、聊天球、语音球、全屏语音对话、结果气泡、屏幕圈选 OCR；以及共享状态容器、语音识别/TTS 交互、独立主题。

## 概述

悬浮窗是 Operit 浮在其他应用之上的常驻入口，有六种形态：

- **窗口聊天**：一个可拖动、可缩放的小聊天窗口，有标题栏（历史/全屏/最小化/返回主应用/关闭）、消息列表和底部输入栏。
- **聊天球**：桌面上的小圆球，点一下展开成窗口聊天；AI 回复完会先弹结果气泡，3 秒后自动缩回球。
- **语音球**：点一下直接进全屏语音对话，同样走 Siri 风格的动感球体渲染。
- **全屏语音/对话**：全屏沉浸式界面，底部是带发光边框的输入条，支持按住说话、语音波形可视化、识别文本编辑。
- **结果气泡**：语音球场景下展示最后一条 AI 回复的轻量气泡，点一下回球。
- **屏幕圈选 OCR**：先截屏，在截图上圈选区域做 OCR 识别，识别文本作为附件带回聊天。

六种形态由 `FloatingChatWindow` 统一调度切换，切换时按方向播放不同的过渡动画（窗口↔全屏是 220ms 缩放淡入淡出，进出球模式是爆炸式缩放）。所有形态共享一个 `FloatContext` 状态容器，语音识别/TTS/音频焦点封装在 `SpeechInteractionManager` 里。

## AI 速览

- **核心符号清单**：FloatingMode、FloatingChatWindow、FloatContext、rememberFloatContext、FloatingChatBallMode、FloatingVoiceBallMode、FloatingResultDisplay、SiriBall、BallParticles、SpeechInteractionManager、FloatingFullscreenMode、FloatingFullscreenModeViewModel、XmlTextProcessor、BottomControlBar、MessageDisplay、EditPanel、WaveVisualizerSection、FloatingChatWindowMode、FloatingChatWindowModeViewModel、FloatingChatWindowInputControls、FloatingAttachmentPanel、ResizeEdge、FloatingScreenOcrScreen、FloatingWindowTheme、AvatarEmotionManager、analyzeEmotion、inferEmotionFromText、extractMoodTagValue、stripXmlLikeTags。
- **主入口**：FloatingChatWindow() → AnimatedContent 按 currentMode 分发 → 六种形态 composable。
- **数据流向一句话**：用户手势/语音输入 → 各形态 ViewModel 或 FloatContext 回调（onSendMessage/onModeChange）→ chatService 的 ChatCore 处理 → inputProcessingState/messages 回流 → Compose 重组刷新界面。

## 核心机制

### 1. 六种形态与总入口

`FloatingMode` 是悬浮窗形态枚举，定义 6 种值（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingMode.kt:4`）。

`WINDOW` 为窗口聊天，`BALL` 为聊天球，`VOICE_BALL` 为语音球，`FULLSCREEN` 为全屏语音/对话，`RESULT_DISPLAY` 为结果气泡，`SCREEN_OCR` 为屏幕圈选 OCR（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingMode.kt:4`）。

`FloatingChatWindow` 是悬浮窗总入口 composable（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:70`）。

入口参数 `currentMode`/`previousMode` 默认均为 `WINDOW`（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:79`）。

入口用 `AnimatedContent` 按 `currentMode` 切换六种界面，且只监听 `currentMode`，避免消息更新时误触发切换动画（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:157`）。

窗口↔全屏切换用 220ms 缩放（initialScale 0.92）+淡入淡出；其他形态→球时球延迟 150ms 从 scale 0 爆炸式出现；球→其他形态时新界面延迟 100ms 从 scale 0 展开；球与球之间用 250ms 交叉淡入淡出（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:175`）。

`BALL` 分支内按 `previousMode` 区分渲染聊天球还是语音球，保证返回时形态一致（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:208`）。

悬浮窗内容通过 `CompositionLocalProvider` 提供 `LocalThemePreferenceSnapshot` 主题快照（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:155`）。

### 2. FloatContext 共享状态容器

`rememberFloatContext` 是悬浮窗共享状态容器的构建入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:22`）。

构造参数含 `previousMode`（默认 WINDOW）、`onModeChange`、`saveWindowState` 等回调（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:36`）。

所有回调经 `rememberUpdatedState` 持有最新值，避免把回调作为 `remember` 的 key 导致实例重建（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:85`）。

`SideEffect` 把最新的回调写回 `floatContext.onModeChange` 等字段，保证闭包里永远拿到最新回调（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:105`）。

`FloatContext.previousMode` 用 `mutableStateOf` 保存上一个形态，供 OCR 等形态返回时使用（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:172`）。

`pendingScreenSelection` 标记圈选 OCR 返回后自动勾选"屏幕内容"附件（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:196`）。

### 3. 球模式：聊天球 / 语音球 / 结果气泡

`FloatingChatBallMode` 点击进入 `WINDOW` 窗口形态（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingChatBallMode.kt:19`）。

`FloatingVoiceBallMode` 点击直接进入 `FULLSCREEN` 全屏语音形态（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingVoiceBallMode.kt:19`）。

AI 回复完成后球切到 `RESULT_DISPLAY` 展示结果，3 秒后自动回 `BALL`，回切前检查当前仍是结果形态，避免用户已手动切换（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingVoiceBallMode.kt:27`）。

`SiriBall` 是聊天球/语音球共用的球体渲染 composable（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt:47`）。

球体用 Canvas 绘制 4 色光斑（主蓝 0xFF0A84FF、紫、粉红、青），带 15 秒慢旋转与 3 秒呼吸缩放动画，外圈有 3 层音波扩散圆环（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt:53`）。

球体渲染中内建 `SpeechInteractionManager`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt:67`）。

语音识别结果以 `PromptFunctionType.VOICE` 经 `onSendMessage` 发送（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt:72`）。

当球处于 Loading 态且 AI 处理完成（`InputProcessingState.Completed`）时触发 `onTriggerResult` 切结果气泡（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt:108`）。

`FloatingResultDisplay` 显示最后一条 AI 消息（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingResultDisplay.kt:25`）。

无消息时显示 `floating_hello` 文案（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingResultDisplay.kt:31`）。

点击气泡回到 `BALL`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingResultDisplay.kt:46`）。

球体粒子拖尾在 `LaunchedEffect(Unit)` 中用 `while(true)`+`withFrameNanos` 逐帧更新（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/BallParticles.kt:116`）。

### 4. 语音交互：SpeechInteractionManager

`SpeechInteractionManager.startListening` 是语音监听入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:121`）。

识别走 `SpeechServiceFactory`（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:58`）。

识别配置 `continuousMode` 与 `partialResults` 均为 true（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:166`）。

启动失败时在协程内重试，最多 12 次（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:160`）。

`handleRecognitionResult` 处理识别结果：新文本不是上次部分文本的前缀延续时，用"。"把 `latestPartialText` 拼入累积文本（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:219`）。

识别中静默 2000ms 自动发送累积文本（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:228`）。

停止监听后还有 3000ms 的 fallback 超时兜底发送（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:280`）。

`stripWakePhrasePrefixIfNeeded` 去除识别文本中的唤醒词前缀（支持正则配置）（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:243`）。

每次开始监听清空 `latestPartialText`，发送完成后也清空，避免跨轮次串话（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:134`）。

### 5. 全屏语音对话

ui 层的 `FloatingFullscreenMode` 只是转发到 screen 包的同名函数，实际实现在 `FloatingFullscreenScreen.kt`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/FloatingFullscreenMode.kt:20`）。

全屏语音 ViewModel 用 `isWaveActive` 标记是否处于语音态（波浪模式）（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:49`）。

`enterWaveMode` 进入语音态（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:330`）。

`exitWaveMode` 退出语音态（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:357`）。

AI 轮次开始前 `prepareVoiceCaptureForAiTurn` 暂停录音，避免把 AI 自己的声音录进去（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:144`）。

`awaitAiTurnAndResumeVoiceCapture` 每 120ms 轮询 AI 忙闲，轮次结束后自动恢复录音（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:158`）。

`startInactivityMonitor` 做无操作超时监控，超时自动退出全屏；AI 朗读或工具调用/生成期间不计入超时（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:481`）。

TTS 首句朗读时通过 `FULLSCREEN_TTS_CAPTURE_SUPPRESS_MS=1200L` 抑制麦克风 1200ms，防止回声误触发（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:30`）。

`maybeAutoAttachByKeyword` 按用户输入关键词自动附加附件，分隔符为 `|`、`,`、`，`、`;`、`；`、换行（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:609`）。

语音态下用 `AvatarEmotionManager.analyzeEmotion` 分析 AI 回复情绪、`extractMoodTagValue` 提取 mood 标签，驱动语音头像表情（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:679`）。

`XmlTextProcessor.processStreamToText` 把 AI 回复的字符串流转成字符流并去掉 XML 标签及内容，再送 TTS 朗读（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/XmlTextProcessor.kt:25`）。

### 6. 底部输入条 BottomControlBar

`BottomControlBar` 是全屏底部的胶囊输入条（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt:115`）。

输入框空时按住 450ms（`holdToSpeakTriggerMs`）进入按住说话模式（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt:163`）。

输入条边框是 `AnimatedGlowBorder`：9 秒流动光效叠加 1.8 秒呼吸凸起（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt:525`）。

`MicrophoneButton` 点按进入语音态、长按开始录音；录音中拖拽的取消/编辑阈值为 60px（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt:858`）。

附件 chips 含五个选项：朗读静音、屏幕内容、通知、位置、圈选识别（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt:224`）。

### 7. 消息展示 / 编辑 / 波浪可视化

全屏消息列表用 `LazyColumn(reverseLayout=true)` 倒序展示（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/MessageDisplay.kt:77`）。

并过滤掉 sender 为 think 的思考消息（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/MessageDisplay.kt:55`）。

消息列表顶部 96dp、底部 72dp 做渐隐，渐隐用 `BlendMode.DstIn` 实现（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/MessageDisplay.kt:83`）。

`EditPanel` 是语音识别文本的编辑面板，输入框高度 120dp，带取消/发送按钮（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/EditPanel.kt:52`）。

`WaveVisualizerSection` 是语音态波浪可视化（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/WaveVisualizerSection.kt:52`）。

默认语音态波浪 300dp、非语音态 120dp（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/WaveVisualizerSection.kt:61`）。

`AiLoadingWaveOverlay` 用双反向旋转圆弧加多轨道圆点表示 AI 加载中（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/WaveVisualizerSection.kt:154`）。

### 8. 窗口模式

`FloatingChatWindowMode` 是窗口模式界面入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:94`）。

窗口内容用自定义 `Layout` 实现整体缩放（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:171`）。

布局按 `windowState` 的宽高与缩放值测量（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:188`）。

标题栏高 48dp（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:445`）。

左侧是历史/全屏/最小化按钮，右侧是返回主应用/关闭按钮，中间区域可拖动（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:433`）。

标题栏全屏按钮切到 `FULLSCREEN`，最小化按钮切到 `BALL`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:479`）。

Home 按钮先同步当前会话 id 到全局，再用 `FLAG_ACTIVITY_NEW_TASK` 启动 `MainActivity`，然后关闭悬浮窗（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:531`）。

关闭按钮触发后先 200ms 淡出（`animatedAlpha` 动画到 0）再调用 `onClose`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:424`）。

会话选择器取按更新时间倒序的最近 20 条会话（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:234`）。

切换会话走 `chatCore.switchChatLocal`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:294`）。

`FloatingChatWindowModeViewModel.handleResize` 把窗口尺寸钳在 150dp–0.8×屏宽 / 200dp–0.8×屏高之间（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/viewmodel/FloatingChatWindowViewModel.kt:90`）。

`handleScaleChange` 把缩放钳在 0.3–1.0（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/viewmodel/FloatingChatWindowViewModel.kt:106`）。

`toggleScale` 在 0.3→0.5→0.7→1.0 四档间循环（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/viewmodel/FloatingChatWindowViewModel.kt:121`）。

窗口有三处缩放手柄：`RightEdgeScaleHandle` 调宽度（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:1103`）。

`CornerScaleHandle` 按拖动方向换算缩放增量（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:1185`）。

`BottomResizeHandle` 调整高度（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:1266`）。

窗口模式消息用 `CursorStyleChatMessage` 渲染（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/ChatMessages.kt:32`）。

渲染时 `enableDialogs=false`，避免悬浮窗内弹对话框导致闪退（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/ChatMessages.kt:45`）。

`ProcessingStatusIndicator` 按 `InputProcessingState` 在输入区上方显示处理中/工具调用/错误状态条（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:1348`）。

`FloatingChatWindowInputControls` 是窗口模式输入区入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt:74`）。

底部输入框 `maxLines=2`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt:153`）。

AI 处理中时发送按钮变为取消按钮，点击调用 `onCancelMessage` 且不清空当前输入（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt:161`）。

附件面板（`FloatingAttachmentPanel`）提供屏幕内容/通知/位置/圈选 OCR/应用包名五个选项（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/AttachmentPanel.kt:57`）。

附件请求发出后延迟 500ms 关闭面板（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt:276`）。

圈选 OCR 直接切到 `SCREEN_OCR` 形态（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt:295`）。

`ReportFloatingChatViewEffect` 上报悬浮窗聊天视图的打开/更新/关闭事件（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:110`）。

事件经 `ChatViewHookPluginRegistry` 分发，供聊天视图插件钩子使用（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:145`）。

### 9. 屏幕圈选 OCR

`FloatingScreenOcrMode` 转发到 `FloatingScreenOcrScreen`（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/FloatingScreenOcrMode.kt:8`）。

进入圈选模式后调用 `capture_screenshot` 工具截屏，解码失败或路径为空时显示错误（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:336`）。

截图上拖动圈选：`hitTestHandle` 识别选区 8 个方向手柄与内部移动（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:124`）。

`clampSelectionRect` 把选区钳在屏幕内并保证最小尺寸（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:150`）。

遮罩层用 `graphicsLayer { alpha = 0.99f }` 开离屏缓冲，配合 `BlendMode.Clear` 在选区"挖洞"露出截图（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:418`）。

确认后 `computeCropBounds` 把 UI 选区矩形映射回原图裁剪像素边界（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:95`）。

裁剪图用 `OCRUtils.recognizeText`（质量 `HIGH`）识别（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:772`）。

识别文本拼成 `text/plain` 的 `AttachmentInfo`（screen_ocr.txt）加入附件（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:797`）。

完成后置 `pendingScreenSelection=true` 并返回 `previousMode`，全屏侧据此自动勾选"屏幕内容"附件（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:812`）。

### 10. 独立主题

`FloatingWindowTheme` 是悬浮窗的独立主题：用静态颜色，不依赖 Activity 上下文（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingWindowTheme.kt:14`）。

主色为 Purple40 `0xFF6650a4`，与主应用默认主色匹配；Typography 默认比主应用小一号（如 bodyLarge 14sp）（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingWindowTheme.kt:27`）。

### 11. 悬浮宠物的表情推理

悬浮宠物（小助手形象）会根据 AI 回复的内容"变脸"，管这事的是 `AvatarEmotionManager`（单例，逻辑从 PetOverlayService 迁过来）（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:11`）。
它先看 AI 回复里有没有 `<mood>` 标签——AI 可以主动写 `<mood>开心</mood>` 来指定表情，有就按标签来：取最后一个标签，经 `AvatarMoodTypes.normalizeKey` 规范化再转表情（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:40`）。
没有就退到关键词匹配：`inferEmotionFromText` 把文本转小写后做子串匹配，"开心""太好了"😊 之类判开心，"生气""讨厌"😡 之类判生气，"难过""哭"😭 判难过，"害羞""///" 判害羞，都没命中就是默认表情（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:17`）。

注意一个设计局限：`AvatarEmotion` 枚举里根本没有"愤怒"这一档，所以"生气"被近似成"难过"（`SAD`）显示（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:29`）。
另外它还有个 `stripXmlLikeTags` 工具函数，负责在把 AI 回复展示给用户之前，把 `<mood>` 这类标记标签清掉：成对标签循环替换最多 5 轮、自闭合、残余三步清理（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:84`）。

## 关键符号

- `FloatingMode` —— 悬浮窗六种形态枚举（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingMode.kt:4`）
- `FloatingChatWindow` —— 悬浮窗总入口，按 currentMode 分发六种界面（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt:70`）
- `FloatContext` —— 悬浮窗共享状态容器（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:132`）
- `rememberFloatContext` —— 状态容器构建入口，回调经 rememberUpdatedState 持有（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt:22`）
- `FloatingChatBallMode` —— 聊天球，点击进窗口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingChatBallMode.kt:15`）
- `FloatingVoiceBallMode` —— 语音球，点击进全屏（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingVoiceBallMode.kt:15`）
- `FloatingResultDisplay` —— 结果气泡，展示最后一条 AI 消息（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingResultDisplay.kt:25`）
- `SiriBall` —— 球体渲染：4 色光斑/15s 旋转/3s 呼吸/3 层音波（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt:47`）
- `rememberParticleSystem` —— 球体粒子拖尾系统构建入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/BallParticles.kt:47`）
- `SpeechInteractionManager` —— 语音识别+TTS+音频焦点封装（`app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt:31`）
- `FloatingFullscreenMode` —— 全屏模式转发入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/FloatingFullscreenMode.kt:20`）
- `FloatingFullscreenModeViewModel` —— 全屏语音态 ViewModel：录音暂停/恢复/空闲超时/关键词附件（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt:39`）
- `XmlTextProcessor` —— 流式去掉 AI 回复 XML 标签再送 TTS（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/XmlTextProcessor.kt:16`）
- `BottomControlBar` —— 全屏底部胶囊输入条：附件 chips/按住说话/发光边框（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt:115`）
- `MessageDisplay` —— 全屏消息列表：倒序/think 过滤/渐隐（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/MessageDisplay.kt:39`）
- `EditPanel` —— 识别文本编辑面板（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/EditPanel.kt:52`）
- `WaveVisualizerSection` —— 语音波浪可视化（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/WaveVisualizerSection.kt:52`）
- `FloatingChatWindowMode` —— 窗口模式界面入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt:94`）
- `FloatingChatWindowModeViewModel` —— 窗口拖动/缩放/附件面板状态（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/viewmodel/FloatingChatWindowViewModel.kt:17`）
- `FloatingChatWindowInputControls` —— 窗口模式输入区入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt:74`）
- `FloatingAttachmentPanel` —— 窗口模式附件面板：五个附件选项（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/AttachmentPanel.kt:59`）
- `ResizeEdge` —— 窗口边缘调整方向枚举（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/models/ChatModels.kt:4`）
- `FloatingScreenOcrMode` —— 圈选 OCR 转发入口（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/FloatingScreenOcrMode.kt:8`）
- `FloatingScreenOcrScreen` —— 圈选 OCR 实现：截屏/圈选/识别/回填附件（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt:278`）
- `FloatingWindowTheme` —— 悬浮窗独立静态主题（`app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingWindowTheme.kt:18`）
- `AvatarEmotionManager` —— 悬浮宠物表情推理单例：mood 标签优先、关键词匹配回退（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:11`）
- `analyzeEmotion` —— 综合分析文本返回表情：先解析 `<mood>` 标签，失败回退关键词推理（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:61`）
- `inferEmotionFromText` —— 中文关键词+emoji 子串匹配：开心→HAPPY、生气/难过→SAD、害羞→CONFUSED（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:17`）
- `extractMoodTagValue` —— 取最后一个 `<mood>` 标签并经 normalizeKey 规范化（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:40`）
- `stripXmlLikeTags` —— 展示前清理 XML 标记标签：成对/自闭合/残余三步，最多 5 层嵌套（`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt:84`）

## 调用链

1. 打开悬浮窗：输入——系统服务创建悬浮窗 → 处理——`FloatingChatWindow` 按 `currentMode` 经 `AnimatedContent` 分发 → 输出——对应形态界面，窗口↔全屏播 220ms 缩放淡入淡出。
2. 聊天球点一下：输入——点击球体 → 处理——`FloatingChatBallMode` 的 onClick 调 `onModeChange(WINDOW)` → 输出——爆炸式展开为窗口聊天。
3. 语音球说一句话：输入——点击语音球进全屏 → 处理——`SiriBall` 内建 `SpeechInteractionManager` 识别，结果以 `PromptFunctionType.VOICE` 经 `onSendMessage` 发送 → 输出——AI 回复完成后 `onTriggerResult` 切结果气泡，3 秒后自动回球。
4. 全屏语音对话：输入——`enterWaveMode` 进入语音态 → 处理——AI 轮次前 `prepareVoiceCaptureForAiTurn` 暂停录音，结束后 `awaitAiTurnAndResumeVoiceCapture` 每 120ms 轮询恢复；无操作超时 `startInactivityMonitor` 自动退出 → 输出——波浪可视化 + TTS 朗读（首句 1200ms 麦克风抑制）。
5. 按住说话：输入——输入框空时按住 450ms → 处理——`BottomControlBar` 进入按住说话模式，拖出胶囊高度之外取消 → 输出——识别文本进 `EditPanel` 编辑后以 VOICE 发送。
6. 窗口聊天发消息：输入——底部输入框输入 → 处理——`FloatingChatWindowInputControls` 调 `onSendMessage(userMessage, CHAT)`；AI 处理中按钮变取消 → 输出——`ChatMessagesView` 倒序刷新，`ProcessingStatusIndicator` 显示处理状态。
7. 圈选 OCR：输入——附件面板选圈选 OCR → 处理——切 `SCREEN_OCR`，调 `capture_screenshot` 截屏，拖动圈选后 `computeCropBounds` 映射裁剪，`OCRUtils.recognizeText(HIGH)` 识别 → 输出——识别文本拼成 `screen_ocr.txt` 附件，置 `pendingScreenSelection` 返回原形态。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingMode.kt`（10 行）：六种形态枚举
- `app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingChatWindow.kt`（233 行）：总入口、AnimatedContent 形态切换与过渡动画
- `app/src/main/java/com/ai/assistance/operit/ui/floating/FloatContext.kt`（197 行）：共享状态容器、rememberUpdatedState 回调持有
- `app/src/main/java/com/ai/assistance/operit/ui/floating/FloatingWindowTheme.kt`（129 行）：悬浮窗独立静态主题
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/SiriBall.kt`（529 行）：球体 Canvas 渲染、语音交互内建
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/BallParticles.kt`（233 行）：球体粒子拖尾系统
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingChatBallMode.kt`（35 行）：聊天球，点击进窗口
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingVoiceBallMode.kt`（35 行）：语音球，点击进全屏，3 秒自动回球
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/ball/FloatingResultDisplay.kt`（56 行）：结果气泡
- `app/src/main/java/com/ai/assistance/operit/ui/floating/voice/SpeechInteractionManager.kt`（322 行）：语音识别+TTS+焦点、增量累积、静默发送
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/FloatingFullscreenMode.kt`（23 行）：全屏转发入口
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/screen/FloatingFullscreenScreen.kt`（650 行）：全屏语音界面实现
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/viewmodel/FloatingFullscreenModeViewModel.kt`（754 行）：语音态、录音暂停/恢复、空闲超时、关键词附件
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/XmlTextProcessor.kt`（64 行）：流式去 XML 标签送 TTS
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/BottomControlBar.kt`（1,003 行）：底部胶囊输入条、附件 chips、按住说话、发光边框
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/MessageDisplay.kt`（167 行）：倒序消息列表、渐隐
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/EditPanel.kt`（167 行）：识别文本编辑面板
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/WaveVisualizerSection.kt`（269 行）：波浪可视化、AI 加载动画
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/components/GlassyChip.kt`（88 行）：玻璃拟态 chip 组件
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/screen/FloatingChatWindowScreen.kt`（1,402 行）：窗口模式界面、标题栏、缩放手柄、会话选择器
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/viewmodel/FloatingChatWindowViewModel.kt`（172 行）：窗口拖动/缩放/附件面板
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/FloatingChatWindowInputControls.kt`（304 行）：窗口输入栏、附件面板覆盖层
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/AttachmentPanel.kt`（229 行）：五个附件选项面板
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/ChatMessages.kt`（48 行）：消息条目、禁用弹窗防闪退
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/components/ChatIndicators.kt`（62 行）：加载圆点指示器
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/window/models/ChatModels.kt`（19 行）：ResizeEdge 枚举
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/FloatingScreenOcrMode.kt`（10 行）：圈选 OCR 转发入口
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/screenocr/screen/FloatingScreenOcrScreen.kt`（883 行）：截屏、圈选、OCR 识别、附件回填
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/pet/AvatarEmotionManager.kt`（108 行）：悬浮宠物表情推理、mood 标签解析、XML 标签清理
