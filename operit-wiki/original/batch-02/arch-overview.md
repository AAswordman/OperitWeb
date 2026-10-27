---
title: 整体架构（总览）
module: app
sources: 5
date: 2026-09-30
---

# 整体架构（总览）

## 概述

- Operit 是一代 Android 原生 AI Agent 应用：Gradle 多模块工程，`app` 为主模块并依赖其余 8 个模块；applicationId 为 `com.ai.assistance.operit`，当前版本 1.12.2（versionCode 51）。`app/build.gradle.kts:397`
- 人话：整个工程可以理解成"一个主 App + 八个零件库"。主 App 装界面、聊天、工具、数据；八个零件库各自封装一块能独立演进的能力——骨骼动画、FBX 预览、端侧推理、终端、投屏客户端、JS 引擎等。
- Kotlin 与 Native 之间只用"JNI 声明对象"桥接：Kotlin 侧写 `external fun` 声明签名，`init` 块里加载 `.so`，真正的实现全在 Native 侧。本页三个 JNI 种子（`JniBridge`、`FbxNative`、`NativeRipgrep`）都是这个模式。
- 本页是全站地图：下文给出大纲 v3 的 11 章 123 页一览与各章一句话定位，细节由各细页展开。

## AI 速览

核心符号清单（一行一个：符号 — 职责）：

- `settings.gradle.kts` — 模块清单：声明 9 个模块、仓库策略与目录重定向
- `app/build.gradle.kts` — 主模块构建配置：变体、签名、依赖、资产同步任务
- `JniBridge` — DragonBones 骨骼动画的 JNI 声明层（17 个 external 函数）
- `FbxNative` — FBX 模型预览的 JNI 声明层（句柄式预览会话）
- `NativeRipgrep` — ripgrep 代码搜索的 JNI 声明层（单 JSON 出入口）
- `signApkWithRotation` — APK 签名轮换（V2 旧签名者 + V3 新签名者）
- `syncSttModelAssets` — 端侧 STT 模型资产下载与 SHA-256 校验
- `verifyExternallyBuiltNativeLibraries` — 打包前置：校验外部构建的 `.so`

主入口：构建入口是 `settings.gradle.kts`（模块装配的起点）；应用运行时入口不在本页种子范围内。

数据流向一句话：settings 声明模块 → `app/build.gradle.kts` 聚合依赖并执行资产同步、原生库校验、签名轮换 → 输出 arm64-v8a 单 ABI 的 APK；运行时 Kotlin 经 JNI 声明对象调用 Native 能力。

## 核心机制

### 模块划分：一个主模块，八个零件库

- 工程根名 `rootProject.name` 为 `Operit`。`settings.gradle.kts:20`
- 仓库策略 `FAIL_ON_PROJECT_REPOS`：禁止子模块私自声明仓库，所有仓库收敛到根配置。`settings.gradle.kts:9`
- 依赖仓库共 6 个：`google`、`mavenCentral`、`jitpack`（jitpack.io）、`bintray`（Shizuku 的 dl.bintray.com 镜像）、`xposed`（api.xposed.info）、`sonatype`（oss.sonatype.org snapshots）。`settings.gradle.kts:11`
- 人话：`FAIL_ON_PROJECT_REPOS` 等于"仓库只许在总部登记"，防止某个模块偷偷从野路子拉依赖，保证构建可复现。
- 主模块 `:app`。`settings.gradle.kts:21`
- `:dragonbones` 重定向到目录 `avator/dragonbones`（注意拼写 avator）。`settings.gradle.kts:23`
- `:terminal` 使用默认目录。`settings.gradle.kts:24`
- `:mnn` 重定向到 `llm/mnn`、`:llama` 重定向到 `llm/llama`：两个端侧推理封装（均已停止维护）。`settings.gradle.kts:26`
- `:mmd` 重定向到 `avator/mmd`（已停止维护）、`:fbx` 重定向到 `avator/fbx`。`settings.gradle.kts:30`
- `:showerclient`、`:quickjs` 使用默认目录。`settings.gradle.kts:33`
- 依赖方向以 app 为汇点：`implementation` 引入全部 8 个兄弟模块，支撑模块之间在 Gradle 层没有相互依赖。`app/build.gradle.kts:580`
- 人话：八个零件库互相不认识，只认主 App。想加新能力就加一个新模块、让 app 依赖它，不用动别人的线。

### 构建变体与签名体系

- `compileSdk` = 36。`app/build.gradle.kts:361`
- `minSdk` 26、`targetSdk` 34、`versionCode` 51、`versionName` 1.12.2。`app/build.gradle.kts:398`
- NDK `abiFilters` 只保留 `arm64-v8a`：唯一的原生 ABI，不打 32 位包。`app/build.gradle.kts:410`
- Native 构建走 CMake，脚本在 `src/main/cpp/CMakeLists.txt`。`app/build.gradle.kts:392`
- C++ 标准 `cppFlags` 为 -std=c++17。`app/build.gradle.kts:415`
- `release`：`isMinifyEnabled` false 且 `isShrinkResources` false——未启用代码混淆与资源压缩。`app/build.gradle.kts:425`
- `debug`：applicationIdSuffix `.debug`，app 名 "Operit Debug"。`app/build.gradle.kts:436`
- `clone`：initWith(debug)，后缀 `.clone`，app 名 "Operit Clone"，release 签名配置存在时改用 release 签名（与正式版同签名、可并存安装）。`app/build.gradle.kts:440`
- `nightly`：`isMinifyEnabled` false，matchingFallbacks 为 release。`app/build.gradle.kts:449`
- 注意：`nightly` 的 `signingConfig` 最终被覆盖为 debug 签名（块内先按 release 条件赋值、随后被 debug 签名覆盖）。`app/build.gradle.kts:460`
- 产物名固定：nightly 为 `app-nightly.apk`，clone 为 `app-clone.apk`。`app/build.gradle.kts:467`
- `assembleRelease` 完成后自动 finalizedBy `signRotatedReleaseApk`；nightly 同理。`app/build.gradle.kts:556`
- `signApkWithRotation(apkFile)` 是签名轮换的顶层函数。`app/build.gradle.kts:97`
- 签名参数：`v1` 关闭、`v2` 开启、`v3` 开启、`v4` 关闭。`app/build.gradle.kts:112`
- `rotation-min-sdk-version` 为 28：API 28 以下设备从 V2 块取旧签名者，API 28+ 理解 proof-of-rotation（密钥轮换证明）。`app/build.gradle.kts:117`
- 人话：签名轮换是"换钥匙不断亲"——APK 改用新密钥签名，但老系统仍认旧钥匙，升级不断档。
- 密钥口令经 `env` 环境变量传入 apksigner，不进命令行明文。`app/build.gradle.kts:121`
- 签名后对产物执行 `verify --verbose --print-certs`，校验通过才替换原 APK。`app/build.gradle.kts:140`

### 构建前置：资产同步与原生库校验

- 打包前置任务 `verifyExternallyBuiltNativeLibraries`。`app/build.gradle.kts:170`
- 它要求 `src/main/jniLibs/arm64-v8a/liboperit_ripgrep.so` 存在且非空：ripgrep 的 `.so` 在 Gradle 之外单独构建，缺失则构建直接失败。`app/build.gradle.kts:152`
- FFmpeg 能力来自本地 `libs/ffmpeg-kit-local.aar`，任务校验其内含 10 个 arm64 `.so`（libavcodec/libavformat/libavutil/libswscale 等）。`app/build.gradle.kts:155`
- `preBuild` 强制依赖 `syncMainAssets` 与 `verifyExternallyBuiltNativeLibraries`：资产同步和原生库校验是构建的前置门。`app/build.gradle.kts:563`
- `syncSttModelAssets` 按 `config/stt-model-assets.properties` 清单下载端侧 STT 模型资产。`app/build.gradle.kts:289`
- 清单每行要求 6 个字段；`verifySttModelAsset` 做"字节数 + SHA-256"双重校验。`app/build.gradle.kts:247`
- 下载请求头 `User-Agent` 为 `Operit Android build STT asset sync`。`app/build.gradle.kts:268`
- 人话：模型文件不进 Git，打包时现下载、验指纹，保证每个包里的模型都和清单锁定的版本一致。

### 关键三方依赖（能力矩阵）

- glTF 运行时渲染：`filament-android` 三件（filament/gltfio/filament-utils），版本 1.69.2。`app/build.gradle.kts:590`
- Root 能力：`libsu` core/service/nio，版本 6.0.0。`app/build.gradle.kts:637`
- Shizuku：`shizuku.api` + `shizuku.provider`。`app/build.gradle.kts:736`
- Tasker 自动化：`taskerpluginlibrary` 0.4.10。`app/build.gradle.kts:740`
- 本地 HTTP 服务：`NanoHTTPD`（WebChat 本地聊天桥接的底层）。`app/build.gradle.kts:781`
- MCP：`mcp.sdk.client` + ktor-client-okhttp。`app/build.gradle.kts:818`
- 桌面小组件：`glance.appwidget` + material3（Compose for Widgets）。`app/build.gradle.kts:843`
- 持久化双引擎：`libs.room.runtime`（Room）与 ObjectBox 并存，均走 kapt 生成代码。`app/build.gradle.kts:710`
- OCR：`libs.mlkit.text.recognition` + 中/日/韩/天城文四个语言包。`app/build.gradle.kts:608`
- 中文分词 `jieba`、向量检索 `hnswlib`。`app/build.gradle.kts:696`
- 端侧 embedding：`onnxruntime-android` 1.17.1。`app/build.gradle.kts:707`
- HTTP：`libs.okhttp`（含 SSE 流式）+ `jsoup`。`app/build.gradle.kts:746`
- API 客户端：`retrofit` 2.9.0 + converter-moshi。`app/build.gradle.kts:833`
- 安全：`security-crypto` 1.1.0-alpha06；BouncyCastle 固定 `bcprov-jdk18on` 1.78（排除旧包防类重复）。`app/build.gradle.kts:827`

### Native 桥接：三种 JNI 声明对象

人话：Kotlin 调 Native 有固定三步——声明（external fun 写签名）、装载（init 块 loadLibrary）、调用。下面三组都是这个套路，区别只在"装载谁"和"一次调多少"。

- `JniBridge`（包 `com.dragonbones`）：`init` 块加载 `dragonbones_native`。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:5`
- 共 17 个 `external fun`，以 `init` 起头。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:8`
- `loadDragonBones` 一次传入骨骼数据、纹理 JSON、纹理 PNG 三个 ByteArray 完成装载。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:11`
- 动画查询与播放：`getAnimationNames`、`getAnimationDuration`、`fadeInAnimation(name, layer, loop, fadeInTime)`。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:29`
- `stopAnimation(name)` 停止指定动画。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:45`
- 骨骼级操控：`overrideBonePosition(boneName, x, y)` 直接改写骨骼位置，`resetBone(boneName)` 复位。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:41`
- 点击命中测试 `containsPoint(x, y)` 返回命中的骨骼/插槽名（可空）。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:35`
- 生命周期与渲染回调：`onPause`、`onResume`、`onDestroy`、`onSurfaceCreated`、`onSurfaceChanged`、`onDrawFrame`。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:22`
- 世界变换：`setWorldScale(scale)` 缩放、`setWorldTranslation(x, y)` 平移。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:37`
- `FbxNative`（包 `com.ai.assistance.fbx`）：`init` 经 `FbxLibraryLoader.loadLibraries()` 装载（非直接 System.loadLibrary）。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:6`
- 可用性探针三件：`nativeIsAvailable`、`nativeGetUnavailableReason`、`nativeGetLastError`——调用前可先问 Native 行不行。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:9`
- `nativeInspectModel(pathModel)` 检查模型文件并返回 JSON 描述（可空）。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:15`
- 预览会话是句柄模式：`nativeCreatePreviewSession` 返回 Long 句柄，`nativeDestroyPreviewSession` 释放。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:17`
- `nativeBuildPreviewFrame(sessionHandle, animationName, timeSeconds)` 按动画名 + 时间戳构建一帧骨骼数据，返回 FloatArray。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:23`
- `nativeReadEmbeddedTextureBytes(sessionHandle, textureIndex)` 读取模型内嵌纹理字节。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:29`
- `NativeRipgrep`（internal object，模块内可见）：`init` 加载 `operit_ripgrep`（与构建脚本校验的 jniLibs `.so` 同名）。`app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt:5`
- 唯一入口 `searchJson(path, patterns, filePattern, caseInsensitive, literal, contextLines, maxResults)`：参数进、JSON 字符串出。`app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt:9`
- 人话：代码搜索这种重活下沉到 Rust 写的 ripgrep，Kotlin 侧只剩一个"传 JSON、收 JSON"的薄皮。

### 全站地图：11 章 123 页

地图数据来自仓库内 outline/outline-v3.yaml（v3 大纲，git tag outline-v3）。每章一句话定位，页 id 即文件名（细页内容待各页展开）：

- 架构总览（1 页）：本页——模块划分、构建体系、Native 桥接与全站索引。
  - [arch-overview](wiki.html?id=arch-overview) 整体架构（总览）
- 工具系统（13 页）：AI 工具的定义、注册、执行、权限与各类内置工具实现。
  - [core-tools](wiki.html?id=core-tools) 工具系统（总览） / [core-tools-registry](wiki.html?id=core-tools-registry) 工具注册与执行框架 / [core-tools-standard-filesystem](wiki.html?id=core-tools-standard-filesystem) 标准工具·文件系统 / [core-tools-standard-webchat](wiki.html?id=core-tools-standard-webchat) 标准工具·浏览器/网络/聊天/工作流 / [core-tools-standard-system](wiki.html?id=core-tools-standard-system) 标准工具·系统操作/多媒体/UI / [core-tools-websession-browser](wiki.html?id=core-tools-websession-browser) 网页会话·浏览器宿主 / [core-tools-websession-userscript](wiki.html?id=core-tools-websession-userscript) 网页会话·用户脚本引擎 / [core-tools-execmodes](wiki.html?id=core-tools-execmodes) 工具执行模式（Debugger/Root/无障碍/Admin） / [core-tools-jsengine](wiki.html?id=core-tools-jsengine) JS 引擎与 Java 互操作桥 / [core-tools-jstools](wiki.html?id=core-tools-jstools) JS 工具脚本执行与注册 / [core-tools-packtool](wiki.html?id=core-tools-packtool) 插件包（ToolPkg）管理与解析 / [core-tools-system](wiki.html?id=core-tools-system) 系统底层能力（Shell 执行器/Action 监听器/终端/截屏投屏） / [core-tools-misc](wiki.html?id=core-tools-misc) 专项工具（PhoneAgent/计算器/MCP/Skill/CLI 模式/条件）
- 聊天与消息（2 页）：一条消息从进入到回复的完整处理链。
  - [core-chat](wiki.html?id=core-chat) 聊天与消息处理（总览） / [core-chat-runtime](wiki.html?id=core-chat-runtime) 聊天运行时（消息管理/Hook/插件）
- 云端 Chat API（32 页）：20 个供应商封装 + 接入基础设施 + 对话编排与增强。
  - [api-chat](wiki.html?id=api-chat) 云端 Chat API 接入（总览） / [api-chat-openai](wiki.html?id=api-chat-openai) OpenAI 供应商 / [api-chat-gemini](wiki.html?id=api-chat-gemini) Gemini 供应商 / [api-chat-claude](wiki.html?id=api-chat-claude) Claude 供应商 / [api-chat-deepseek](wiki.html?id=api-chat-deepseek) DeepSeek 供应商 / [api-chat-mnn](wiki.html?id=api-chat-mnn) MNN 端侧供应商（已停止维护） / [api-chat-openai-responses](wiki.html?id=api-chat-openai-responses) OpenAI Responses 供应商 / [api-chat-kimi](wiki.html?id=api-chat-kimi) Kimi 供应商 / [api-chat-opencode](wiki.html?id=api-chat-opencode) OpenCode 供应商 / [api-chat-llama](wiki.html?id=api-chat-llama) Llama 端侧供应商（已停止维护） / [api-chat-codex](wiki.html?id=api-chat-codex) Codex 供应商 / [api-chat-openrouter](wiki.html?id=api-chat-openrouter) OpenRouter 供应商 / [api-chat-qwen](wiki.html?id=api-chat-qwen) 通义千问供应商 / [api-chat-mistral](wiki.html?id=api-chat-mistral) Mistral 供应商 / [api-chat-nvidia](wiki.html?id=api-chat-nvidia) NVIDIA AI 供应商 / [api-chat-xai](wiki.html?id=api-chat-xai) xAI 供应商 / [api-chat-doubao](wiki.html?id=api-chat-doubao) 豆包供应商 / [api-chat-mimo](wiki.html?id=api-chat-mimo) 小米 Mimo 供应商 / [api-chat-ollama](wiki.html?id=api-chat-ollama) Ollama 供应商 / [api-chat-nousportal](wiki.html?id=api-chat-nousportal) NousPortal 供应商 / [api-chat-fourrouter](wiki.html?id=api-chat-fourrouter) FourRouter 供应商 / [api-chat-keypool](wiki.html?id=api-chat-keypool) Key 池轮询（ApiKeyProvider） / [api-chat-providers-base](wiki.html?id=api-chat-providers-base) 供应商接入基础设施 / [api-chat-thinking](wiki.html?id=api-chat-thinking) thinking 配置机制 / [api-chat-params](wiki.html?id=api-chat-params) 统一参数模型与自定义参数 / [api-chat-errors](wiki.html?id=api-chat-errors) 错误/限流/重试 / [api-chat-tools-stream](wiki.html?id=api-chat-tools-stream) 工具调用与流式协议 / [api-chat-tokens](wiki.html?id=api-chat-tokens) Token 统计与 usage 上报 / [api-chat-media](wiki.html?id=api-chat-media) 多模态媒体链接与能力探测 / [api-chat-runtime](wiki.html?id=api-chat-runtime) 对话编排运行时 / [api-chat-enhance](wiki.html?id=api-chat-enhance) 对话增强管线 / [api-chat-memory](wiki.html?id=api-chat-memory) 会话记忆与上下文总结
- 语音服务（2 页）：语音识别与语音合成两条流水线。
  - [api-speech](wiki.html?id=api-speech) 语音识别流水线 / [api-voice](wiki.html?id=api-voice) 语音合成（TTS）服务
- 数据层（14 页）：Room + ObjectBox 双持久化、记忆/聊天仓库、偏好设置、备份与更新。
  - [data-model](wiki.html?id=data-model) 数据模型（总览） / [data-room-db](wiki.html?id=data-room-db) Room 数据库与 DAO / [data-models](wiki.html?id=data-models) 数据模型与实体类 / [data-repo-memory](wiki.html?id=data-repo-memory) 记忆仓库 / [data-repo-chat](wiki.html?id=data-repo-chat) 聊天历史仓库 / [data-repo-misc](wiki.html?id=data-repo-misc) 扩展仓库（Avatar/表情/工作流/Skill/插件黑名单/UI 层级） / [data-prefs-model](wiki.html?id=data-prefs-model) 模型与 API 配置（偏好设置） / [data-prefs-character](wiki.html?id=data-prefs-character) 角色卡与人格配置 / [data-prefs-app](wiki.html?id=data-prefs-app) 应用基础/主题/语音/记忆搜索配置 / [data-stats-pricing](wiki.html?id=data-stats-pricing) Token 用量统计与模型定价数据 / [data-backup-export](wiki.html?id=data-backup-export) 数据备份、恢复与导入导出 / [data-mcp](wiki.html?id=data-mcp) MCP 服务与插件桥接 / [data-api-oauth](wiki.html?id=data-api-oauth) OAuth 与外部 API 客户端 / [data-update-announce](wiki.html?id=data-update-announce) 应用更新与公告
- 引擎其他（4 页）：虚拟形象、提示词、应用生命周期/性能/工作流、安装包编辑。
  - [core-avatar](wiki.html?id=core-avatar) 虚拟形象引擎 / [core-config-prompts](wiki.html?id=core-config-prompts) 系统提示词与功能提示配置 / [core-app-workflow](wiki.html?id=core-app-workflow) 应用生命周期、性能监控与工作流调度 / [core-subpack](wiki.html?id=core-subpack) 安装包编辑与逆向（APK/EXE）
- 系统服务与集成（6 页）：前台服务、悬浮窗、插件机制、WebChat 与外部入口。
  - [services-chatservice](wiki.html?id=services-chatservice) 聊天服务核心 Delegate 群 / [services-system](wiki.html?id=services-system) 系统服务与悬浮窗 / [plugins](wiki.html?id=plugins) 插件机制与工具包桥接 / [integrations-webchat](wiki.html?id=integrations-webchat) WebChat 本地 HTTP 服务 / [integrations-external](wiki.html?id=integrations-external) 外部聊天入口与自动化集成 / [widget-provider](wiki.html?id=widget-provider) 桌面小组件与文档提供器
- 工具函数库（6 页）：文件/文本/流/系统/检索等基础能力。
  - [util-file-media](wiki.html?id=util-file-media) 文件、媒体与文档处理工具 / [util-text-chat](wiki.html?id=util-text-chat) 消息渲染与文本处理 / [util-stream-core](wiki.html?id=util-stream-core) 响应式流框架 / [util-stream-parse](wiki.html?id=util-stream-parse) 流式内容解析插件与原生实现 / [util-system](wiki.html?id=util-system) 系统诊断、日志与平台服务 / [util-search](wiki.html?id=util-search) 向量索引与本地检索
- 用户界面（32 页）：聊天主界面、设置、扩展包管理、工具箱、通用渲染与各类功能屏。
  - [ui-chat-screen](wiki.html?id=ui-chat-screen) 聊天主界面与状态管理 / [ui-chat-components](wiki.html?id=ui-chat-components) 聊天消息内容区与交互组件 / [ui-chat-input](wiki.html?id=ui-chat-input) 聊天输入区 / [ui-chat-styles](wiki.html?id=ui-chat-styles) 消息气泡与样式 / [ui-chat-parts](wiki.html?id=ui-chat-parts) 消息体渲染（XML/工具调用/文件差异） / [ui-chat-lazylist](wiki.html?id=ui-chat-lazylist) 本地化 LazyColumn 聊天列表 / [ui-chat-workspace](wiki.html?id=ui-chat-workspace) 工作区与 WebView 基础设施 / [ui-chat-editor](wiki.html?id=ui-chat-editor) 内置代码编辑器 / [ui-settings-model](wiki.html?id=ui-settings-model) 模型与提示词配置界面 / [ui-settings-theme](wiki.html?id=ui-settings-theme) 主题与显示设置界面 / [ui-settings-chat](wiki.html?id=ui-settings-chat) 聊天/备份/历史设置界面 / [ui-settings-misc](wiki.html?id=ui-settings-misc) 偏好与其他设置界面 / [ui-packages-manager](wiki.html?id=ui-packages-manager) 扩展包管理界面 / [ui-packages-market](wiki.html?id=ui-packages-market) 扩展市场浏览界面 / [ui-packages-publish](wiki.html?id=ui-packages-publish) 扩展发布界面 / [ui-packages-mcp](wiki.html?id=ui-packages-mcp) MCP 配置与部署界面 / [ui-toolbox-filemanager](wiki.html?id=ui-toolbox-filemanager) 文件管理器界面 / [ui-toolbox-dev](wiki.html?id=ui-toolbox-dev) 开发调试工具界面 / [ui-toolbox-apps](wiki.html?id=ui-toolbox-apps) 系统与媒体工具界面 / [ui-common-dsl](wiki.html?id=ui-common-dsl) 工具包 Compose DSL 渲染 / [ui-common-markdown](wiki.html?id=ui-common-markdown) Markdown 与富文本渲染 / [ui-main](wiki.html?id=ui-main) 主界面框架与导航 / [ui-floating](wiki.html?id=ui-floating) 悬浮窗界面 / [ui-memory](wiki.html?id=ui-memory) 记忆/知识库界面 / [ui-tokenstats](wiki.html?id=ui-tokenstats) Token 用量统计界面 / [ui-workflow](wiki.html?id=ui-workflow) 工作流界面 / [ui-websession](wiki.html?id=ui-websession) 内置浏览器界面 / [ui-assistant](wiki.html?id=ui-assistant) 助手配置界面 / [ui-demo](wiki.html?id=ui-demo) 权限引导与演示界面 / [ui-permission](wiki.html?id=ui-permission) 权限与 Token 配置界面 / [ui-about](wiki.html?id=ui-about) 关于/更新/登录/帮助界面 / [ui-startup](wiki.html?id=ui-startup) 启动/恢复/性能界面
- 附录（11 页）：测试存档与插件开发系列。
  - [appendix-tests-unit-api-core](wiki.html?id=appendix-tests-unit-api-core) 单元测试·api/core / [appendix-tests-unit-data](wiki.html?id=appendix-tests-unit-data) 单元测试·data / [appendix-tests-unit-ui-util](wiki.html?id=appendix-tests-unit-ui-util) 单元测试·ui/util / [appendix-tests-android](wiki.html?id=appendix-tests-android) 插桩测试、模板与本地化三方源码 / [appendix-plugin-capabilities](wiki.html?id=appendix-plugin-capabilities) 插件能力目录 / [appendix-js-package-dev](wiki.html?id=appendix-js-package-dev) JS 沙盒包开发接口 / [appendix-plugin-contract](wiki.html?id=appendix-plugin-contract) 插件开发契约手册 / [appendix-plugin-examples](wiki.html?id=appendix-plugin-examples) 插件最小实例集 / [appendix-plugin-dev-guide](wiki.html?id=appendix-plugin-dev-guide) 插件开发指南（Top50 实证） / [appendix-toolpkg-contract](wiki.html?id=appendix-toolpkg-contract) ToolPkg 容器契约 / [appendix-uncovered-native](wiki.html?id=appendix-uncovered-native) 未覆盖 kt 扫尾

## 关键符号

- `settings.gradle.kts`：模块清单与仓库策略（9 模块、FAIL_ON_PROJECT_REPOS）。`settings.gradle.kts:20`
- `app/build.gradle.kts`：主模块构建配置（变体/签名/依赖/资产任务）。`app/build.gradle.kts:397`
- `JniBridge`：DragonBones JNI 声明层。`avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt:3`
- `FbxNative`：FBX 预览 JNI 声明层。`avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt:3`
- `NativeRipgrep`：ripgrep JNI 声明层。`app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt:3`
- `signApkWithRotation`：APK 签名轮换。`app/build.gradle.kts:97`
- `syncSttModelAssets`：STT 模型资产同步。`app/build.gradle.kts:293`
- `verifyExternallyBuiltNativeLibraries`：原生库打包前置校验。`app/build.gradle.kts:170`

## 调用链

1. 构建链路（输入 → 处理 → 输出）：
   - 输入：`settings.gradle.kts` 的模块清单（9 模块）。
   - 处理：`app/build.gradle.kts` 聚合 8 个兄弟模块依赖；`preBuild` 先跑 `syncMainAssets`（下载并 SHA-256 校验 STT 模型资产）与 `verifyExternallyBuiltNativeLibraries`（校验 `liboperit_ripgrep.so` 与 ffmpeg-kit aar 非空）。
   - 输出：arm64-v8a 单 ABI 的 APK；release/nightly 再经 `signApkWithRotation` 做 V2+V3 签名轮换后交付。
2. 签名轮换链（输入 → 处理 → 输出）：
   - 输入：`assembleRelease`/`assembleNightly` 产出的未轮换 APK。
   - 处理：`signApkWithRotation` 调 apksigner，以旧密钥做 V2 签名、新密钥做 V3 签名（rotation-min-sdk 28），口令经环境变量传入。
   - 输出：`verify --verbose --print-certs` 校验通过后替换原 APK。
3. JNI 调用链（输入 → 处理 → 输出）：
   - 输入：Kotlin 侧 `external fun` 声明的方法签名与参数。
   - 处理：`init` 块 `System.loadLibrary`（或 `FbxLibraryLoader.loadLibraries()`）装载 `.so`，调用时陷入 Native 实现。
   - 输出：`JniBridge` 驱动骨骼动画渲染，`FbxNative` 返回预览帧 FloatArray/纹理字节，`NativeRipgrep` 返回 JSON 字符串搜索结果。

## 关联条目

- [工具注册与执行框架](wiki.html?id=core-tools-registry)：工具系统章的注册与执行细页
- [工具系统（总览）](wiki.html?id=core-tools)：工具章总览
- [聊天与消息处理（总览）](wiki.html?id=core-chat)：消息处理链总览
- [云端 Chat API 接入（总览）](wiki.html?id=api-chat)：供应商接入总览
- [数据模型（总览）](wiki.html?id=data-model)：持久化与偏好设置总览
- [虚拟形象引擎](wiki.html?id=core-avatar)：JniBridge 与 FbxNative 的上层使用者

## 来源

- `settings.gradle.kts`
- `app/build.gradle.kts`
- `avator/dragonbones/src/main/java/com/dragonbones/JniBridge.kt`
- `avator/fbx/src/main/java/com/ai/assistance/fbx/FbxNative.kt`
- `app/src/main/java/com/ai/assistance/operit/util/ripgrep/NativeRipgrep.kt`
