---
title: 系统与媒体工具界面
module: 工具箱
sources: 15
date: 2026-10-01
---

# ui-toolbox-apps（系统与媒体工具界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/` 下 15 个 Kotlin 文件（`apppermissions/`、`autoglm/`、`defaultassistant/`、`ffmpegtoolbox/`、`htmlpackager/`、`processlimit/`、`speechtotext/`、`texttospeech/` 八个目录 + `ToolboxScreen.kt`、`ProcessLimitRemoverToolScreen.kt`），约 6,046 行 @ `dbf71916`

## 概述

这是 Operit **工具箱（Toolbox）** 的主页与其中八个小工具屏。工具箱是一个"系统工具抽屉"：主页是一个自适应网格，每个格子是一张工具卡片，点进去就是一个独立的小工具界面。

本页覆盖的八个小工具：应用权限管理（列出手机上所有应用并可直接改权限）、默认助手引导（三步图文向导）、AutoGLM（手机 UI 自动化 Agent，配一键配置向导）、HTML 打包（网页文件夹打包成 Android / Windows 应用）、进程限制解除（一键改幻象进程数上限）、FFmpeg 工具箱（本机执行 FFmpeg 命令）、语音识别（三引擎 STT）、文本转语音（TTS 播音）。

## AI 速览

**核心符号清单**：`ToolboxScreen`（主页）、`Tool`（卡片数据类）、`ToolCard`（卡片 UI）、`AppPermissionsScreen`（权限管理）、`AutoGlmViewModel.executeTask`（执行自动化任务）、`AutoGlmOneClickScreen`（一键配置）、`HtmlPackagerScreen`（打包）、`ProcessLimitRemoverScreen`（进程限制）、`FFmpegToolboxScreen`（FFmpeg）、`SpeechToTextScreen`（语音识别）、`TextToSpeechScreen`（TTS）。

**主入口**：`ToolboxScreen(navController, onNavigationEntrySelected)`，工具列表来自导航模型里 `surface == NavigationSurface.TOOLBOX` 的条目；各小工具另有 `*ToolScreen` 包装函数供路由挂载。

**数据流向一句话**：导航模型的 TOOLBOX 条目映射为 `Tool` 卡片经网格展示，点击回调跳转到各小工具屏；小工具屏各自经 shell 执行器、AI 工具处理器或语音服务单例与系统交互。

## 核心机制

### 1. 工具箱主页：从导航模型动态聚合

工具列表来自导航模型的 `navigationEntries`，按 `surface == NavigationSurface.TOOLBOX` 过滤（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:67`）。
过滤结果用 `remember` 缓存，再 `map` 为 `Tool`（`id` 取 `entryId`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:72`）。
新增工具屏只需要在导航模型里注册一个 TOOLBOX 条目，主页自动出现卡片。
主页用 `LazyVerticalGrid` 展示卡片，列为 `GridCells.Adaptive`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:87`）。
卡片按压缩放经 `animateFloatAsState` 驱动，`isPressed` 时 0.95f，`tween` 按下 100ms（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:114`）。
点击后在 `scope.launch` 内 `delay(100)` 再调 `onClick`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:125`）。
`FFmpegToolboxToolScreen` 用 `CustomScaffold` 包裹 `FFmpegToolboxScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:256`）。
`TerminalAutoConfigToolScreen` 目前只有 `TODO` 占位（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:221`）。

### 2. 应用权限管理：dumpsys 解析 + pm 命令改权限

应用列表与权限详情经 `AnimatedContent` 按 `selectedApp` 是否为空切换（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:217`）。
`loadInstalledApps` 用 `GET_META_DATA` 等 flag 拉取已装应用（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1102`）。
系统应用按 `FLAG_SYSTEM` 位判定为 `isSystemApp`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1110`）。
应用列表按搜索词过滤（`filteredApps`，`remember` 缓存）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:131`）。
权限解析先拿 dumpsys 全量输出（`packageInfoResult`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1144`）。
已授予权限单独用 grep 提取（`grantedPermsResult`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1149`）。
先取 requested 段（`extractSectionContent`），再提权限（`extractPermissionsFromSection`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1158`）。
三段都找不到时用正则 `permRegex` 全文兜底（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1185`）。
37 个关键权限经 `importantPermGroups` 映射到 12 个分组（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1225`）。
关键权限逐个转成 `PermissionInfo`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1345`）。
开关拨动直接拼出 pm 命令执行（`rawName`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:169`）。
重置按钮执行 pm reset-permissions（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:196`）。
点应用条目（`AppItem` 的 `onClick`）加载权限（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:399`）。

### 3. AutoGLM：手机 UI 自动化 Agent

`executeTask` 先取消 `executionJob` 再起新协程（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:45`）。
虚拟屏模式先调 `ensureServerStarted`（`ShowerServerManager`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:62`）。
用当前屏幕宽高 dpi 调 `ensureDisplay`（`ShowerController`）建虚拟屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:82`）。
模型走 `getAIServiceForFunction`（`EnhancedAIService`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:106`）。
`AgentConfig` 的 `maxSteps` 为 25（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:109`）。
UI 工具实现取自 `getUITools`（`ToolGetter`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:111`）。
Agent 构造时 `cleanupOnFinish` 为 false（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:126`）。
`cancelTask` 取消 `executionJob`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:193`）。
执行中按钮变 Cancel（`isLoading` 为真调 `onCancel`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmToolScreen.kt:84`）。
日志区自动滚动到底（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmToolScreen.kt:108`）。
一键配置默认 `endpoint` 为智谱地址（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmOneClickToolScreen.kt:96`）。
配置时自动应用推荐参数（`temperature` 0.0f 等）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmOneClickToolScreen.kt:147`）。
配置时禁用 base 包、启用 subagent 包（`disablePackage` / `enablePackage`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmOneClickToolScreen.kt:184`）。
恢复按钮做反向切换（`enablePackage` / `disablePackage`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmOneClickToolScreen.kt:213`）。
Key 输入框是 `OutlinedTextField`（`apiKeyInput`），无掩码（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmOneClickToolScreen.kt:326`）。

### 4. FFmpeg 工具箱：命令直达工具处理器

内置 5 个 `CommandTemplate`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ffmpegtoolbox/FFmpegToolboxScreen.kt:48`）。
执行时构造 `AITool`（`ToolParameter` 传命令）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ffmpegtoolbox/FFmpegToolboxScreen.kt:131`）。
帮助区执行 `ffmpeg_info`（`executeTool`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ffmpegtoolbox/FFmpegToolboxScreen.kt:246`）。
结果卡片按 `commandResult` 展示（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ffmpegtoolbox/FFmpegToolboxScreen.kt:282`）。

### 5. HTML 打包：SAF 选文件夹 → 临时目录 → 调导出

文件夹选择用 `OpenDocumentTree`（`folderPickerLauncher`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:64`）。
只列出 html 文件（`htmlFiles`），默认选中 index.html（`selectedIndexFile`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:70`）。
先复制目录树到临时文件夹（`copyDocumentTreeTo`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:193`）。
主文件重命名为 index.html（`renameTo`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:199`）。
Android 导出调 `exportAndroidApp`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:207`）。
`finally` 里 `deleteRecursively` 清临时文件夹（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:231`）。
完成对话框的 `onOpenFile` 用 open_file 工具打开产物（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:318`）。

### 6. 进程限制解除：两条 device_config 命令

进屏 `LaunchedEffect` 查当前值（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/processlimit/ProcessLimitRemoverScreen.kt:84`）。
解除走 `ProcessLimitAction.REMOVE` 分支（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/processlimit/ProcessLimitRemoverScreen.kt:112`）。
恢复走 `RESTORE` 分支（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/processlimit/ProcessLimitRemoverScreen.kt:116`）。
操作记 `ProcessLimitRecord` 插 `operationHistory` 头部（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/processlimit/ProcessLimitRemoverScreen.kt:133`）。
`OperationRecordCard` 展示单条记录（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/processlimit/ProcessLimitRemoverScreen.kt:604`）。

### 7. 语音识别：三引擎可切换

默认 `recognitionMode` 为 `SHERPA_NCNN`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:124`）。
无权限时只显示申请界面（`hasAudioPermission` 为假直接 return）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:65`）。
`recognitionMode` 变化时 `shutdown` 旧实例再 `createSpeechService`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:130`）。
离屏时 `DisposableEffect` 的 `onDispose` 关服务（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:138`）。
`startRecognition` 里 Sherpa 开 `continuousMode` 与 `partialResults`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:186`）。
`switchRecognitionMode` 在三引擎间轮换（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:207`）。
识别结果可 `copyToClipboard`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:228`）。

### 8. 文本转语音：读当前档案播音

先取 `currentTtsProfileOrNullFlow`，为空只显示 `CircularProgressIndicator`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/texttospeech/TextToSpeechScreen.kt:48`）。
语速滑杆 `Slider`（`valueRange` 0.5f..2.0f）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/texttospeech/TextToSpeechScreen.kt:283`）。
`saveSimpleTtsSelection` 保存后重建语音服务（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/texttospeech/TextToSpeechScreen.kt:141`）。
`handleTtsError` 把 `TtsException` 拼成可读错误（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/texttospeech/TextToSpeechScreen.kt:741`）。
未知异常附 300 字符堆栈（`stackTraceToString`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/texttospeech/TextToSpeechScreen.kt:762`）。

### 9. 默认助手引导：三步折叠卡片

步骤 1 用 `Intent` 打开 Settings.ACTION_VOICE_INPUT_SETTINGS（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/defaultassistant/DefaultAssistantGuideScreen.kt:97`）。
步骤 2 用 `Intent` 打开手势导航设置（`gestureIntent`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/defaultassistant/DefaultAssistantGuideScreen.kt:156`）。

## 关键符号

| 符号 | 说明 |
|---|---|
| `ToolboxScreen` | 主页可组合函数（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:56`） |
| `Tool` | 卡片数据类（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:44`） |
| `ToolCard` | 卡片 UI（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:106`） |
| `AppPermissionsScreen` | 权限管理屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:63`） |
| `AutoGlmViewModel` | AutoGLM 任务 VM（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:36`） |
| `AutoGlmOneClickScreen` | 一键配置向导（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmOneClickToolScreen.kt:49`） |
| `HtmlPackagerScreen` | 打包屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:43`） |
| `ProcessLimitRemoverScreen` | 进程限制屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/processlimit/ProcessLimitRemoverScreen.kt:60`） |
| `FFmpegToolboxScreen` | FFmpeg 屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ffmpegtoolbox/FFmpegToolboxScreen.kt:36`） |
| `SpeechToTextScreen` | 语音识别屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:37`） |
| `TextToSpeechScreen` | TTS 屏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/texttospeech/TextToSpeechScreen.kt:43`） |

## 调用链

**链路 1：打开工具箱点进小工具**
1. 输入：用户打开工具箱页。
2. 处理：取 `navigationEntries` 按 `surface == NavigationSurface.TOOLBOX` 过滤（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:67`）。
   再 `map` 为 `Tool`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:72`）。
   经 `LazyVerticalGrid` 展示（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:87`）。
3. 输出：点击卡片 `delay(100)` 后调 `onClick`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:125`）。
   路由挂载对应的 `*ToolScreen` 包装函数（`FFmpegToolboxToolScreen`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/ToolboxScreen.kt:256`）。

**链路 2：改某个应用的权限**
1. 输入：点应用条目（`AppItem` 的 `onClick`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:399`）。
2. 处理：拿 dumpsys 全量输出（`packageInfoResult`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1144`）。
   grep 提已授予（`grantedPermsResult`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1149`）。
   分段解析（`extractSectionContent`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1158`）。
   分组为 `PermissionInfo`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:1345`）。
3. 输出：拨开关拼 pm 命令执行（`rawName`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/apppermissions/AppPermissionsScreen.kt:169`）。

**链路 3：AutoGLM 执行自动化任务**
1. 输入：任务屏输入任务点执行（`isLoading` 为假调 `onExecute`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmToolScreen.kt:84`）。
2. 处理：`executeTask` 取消旧 `executionJob`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:45`）。
   虚拟屏模式建 Shower 显示（`ensureDisplay`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:82`）。
   自动化 Agent 25 步循环（`AgentConfig`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:109`），工具取自 `getUITools`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:111`）。
3. 输出：日志区自动滚动（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmToolScreen.kt:108`）。
   点 Cancel 调 `cancelTask`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/autoglm/AutoGlmViewModel.kt:193`）。

**链路 4：HTML 打包成应用**
1. 输入：`OpenDocumentTree` 选文件夹（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:64`）。
   选主文件（`selectedIndexFile`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:70`）。
2. 处理：`copyDocumentTreeTo` 复制到临时目录（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:193`）。
   `renameTo` 改名 index.html（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:199`）。
   `exportAndroidApp` 导出（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:207`）。
3. 输出：完成对话框 `onOpenFile` 打开产物（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:318`）。
   `finally` 清临时目录（`deleteRecursively`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/htmlpackager/HtmlPackagerScreen.kt:231`）。

**链路 5：语音识别**
1. 输入：点"开始识别"（`startRecognition`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:186`）。
2. 处理：`recognitionMode` 变化重建服务（`createSpeechService`）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:130`）。
   离屏 `onDispose` 关服务（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:138`）。
3. 输出：识别文本可 `copyToClipboard`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/speechtotext/SpeechToTextScreen.kt:228`）。

## 来源

- 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/` 下 15 个 Kotlin 文件（`apppermissions/` 1 个、`autoglm/` 4 个、`defaultassistant/` 1 个、`ffmpegtoolbox/` 1 个、`htmlpackager/` 1 个、`processlimit/` 1 个、`speechtotext/` 2 个、`texttospeech/` 2 个 + `ToolboxScreen.kt`、`ProcessLimitRemoverToolScreen.kt`），约 6,046 行，源码 commit `dbf71916`。
- 原子事实见 `ui-toolbox-apps.facts.json`（160 条），代码走查见 `ui-toolbox-apps.quality.json`（12 条：0 高 / 5 警告 / 7 建议），lint 报告见 `ui-toolbox-apps.lint.md`。
