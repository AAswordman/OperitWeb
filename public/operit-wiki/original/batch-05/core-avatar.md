---
title: 虚拟形象引擎
module: app
sources: AvatarType.kt, AvatarModel.kt, ISkeletalAvatarModel.kt, IFrameSequenceAvatarModel.kt, AvatarEmotion.kt, AvatarMoodType.kt, AvatarState.kt, AvatarController.kt, AvatarSettingKeys.kt, AvatarView.kt, AvatarModelFactoryImpl.kt, AvatarControllerFactoryImpl.kt, AvatarRendererFactoryImpl.kt, DragonBonesAvatarController.kt, DragonBonesAvatarModel.kt, DragonBonesRenderer.kt, WebPAvatarController.kt, WebPAvatarModel.kt, WebPRenderer.kt, Mp4AvatarController.kt, Mp4AvatarModel.kt, Mp4Renderer.kt, GltfAvatarController.kt, GltfAvatarModel.kt, GltfRenderer.kt, GltfSurfaceView.kt, FbxAvatarController.kt, FbxAvatarModel.kt, FbxRenderer.kt, MmdAvatarController.kt, MmdAvatarModel.kt, MmdRenderer.kt
date: 2026-10-01
---

# 虚拟形象引擎

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 助手那个"虚拟形象"是怎么动起来的。

整个引擎住在 `core/avatar`，共 35 个 Kotlin 文件、5150 行。它抽象了 6 种形象技术路线：DragonBones 骨骼动画、WebP 逐帧动画、MP4 视频、glTF 3D 模型、FBX 3D 模型、MMD 3D 模型（`avator/` 目录下是 DragonBones/MMD/FBX 的 native 渲染库）。

架构是经典的三层：**模型**（`AvatarModel`，描述形象是什么、资源在哪）→ **控制器**（`AvatarController`，管"播什么情绪、播哪个动画"）→ **渲染器**（Composable，把画面画出来）。上层业务（悬浮窗语音界面、助手配置页）只跟控制器对话，不碰渲染细节——换一种形象技术，业务代码不用改。

## AI 速览

- 核心符号：`AvatarType`（6 种形象类型枚举）、`AvatarModel`（模型接口：id/name/type）、`ISkeletalAvatarModel`（骨骼类三路径）、`IFrameSequenceAvatarModel`（逐帧类动画路径）、`AvatarController`（播放控制接口）、`AvatarState`（emotion/currentAnimation/isLooping/playbackNonce）、`AvatarEmotion`（7 种情绪）、`AvatarMoodTypes`（5 内置 mood + 键归一化）、`AvatarSettingKeys`（缩放/位移/相机参数键名）、`AvatarView`（统一分发 Composable）、`AvatarModelFactoryImpl`/`AvatarControllerFactoryImpl`/`AvatarRendererFactoryImpl`（三工厂 impl）
- 主入口：`AvatarView(model, controller, rendererFactory)` 按 `model.type` 分发渲染器；`AvatarControllerFactoryImpl.createController(model)` 按类型构造控制器；`AvatarRendererFactoryImpl.createRenderer(model)` 按类型构造渲染 Composable
- 数据流向一句话：模型数据（资源路径/动画清单）→ 三工厂造出模型+控制器+渲染器 → 控制器把"情绪或 `<mood>` 标签"解析成动画名、写入 `AvatarState` StateFlow → 渲染器订阅状态，用各技术栈原生播放器（DragonBones JNI / ImageDecoder / ExoPlayer / Filament / MMD native）渲染。

## 核心机制

### 1. 类型与模型抽象：6 种路线，一套接口

`AvatarType` 枚举列出 6 种形象：DRAGONBONES、WEBP、MP4、GLTF、FBX、MMD。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/model/AvatarType.kt:9`

`AvatarModel` 接口只定三件套：`id`、`name`、`type`。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/model/AvatarModel.kt:7`

骨骼类形象实现 `ISkeletalAvatarModel`，多三个路径：骨骼文件 `skeletonPath`、纹理图集 `textureAtlasPath`、纹理图 `texturePath`。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/model/ISkeletalAvatarModel.kt:11`

逐帧类形象实现 `IFrameSequenceAvatarModel`，有一个 `animationPath`，以及默认循环的 `shouldLoop`（默认 true）和 `repeatCount`（默认 0）。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/model/IFrameSequenceAvatarModel.kt:11`

### 2. 情绪与 mood：模型吐标签，引擎播动画

`AvatarEmotion` 定义 7 种情绪：IDLE、LISTENING、THINKING、HAPPY、SAD、CONFUSED、SURPRISED。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/state/AvatarEmotion.kt:9`

`AvatarMoodTypes` 内置 5 个 mood，每个带给模型看的 `promptHint`（写进提示词，教模型何时用）和播不出来时的 `fallbackEmotion`：angry→SAD、happy→HAPPY、shy→CONFUSED、aojiao→CONFUSED、cry→SAD。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/state/AvatarMoodType.kt:22`

`normalizeKey` 把用户自定义的 mood 键归一化（大小写/空白统一），`builtInFallbackEmotion` 查内置 mood 的兜底情绪。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/state/AvatarMoodType.kt:62`

`AvatarController.playTrigger` 专门吃模型回复里返回的 `<mood>` 标签值（文档原话如此），解析成功返回 true。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/control/AvatarController.kt:55`

### 3. 控制器状态机：StateFlow 是唯一的真相源

`AvatarState` 四字段：当前情绪 `emotion`（默认 IDLE）、当前动画名 `currentAnimation`、是否无限循环 `isLooping`、单调递增的 `playbackNonce`。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/state/AvatarState.kt:14`

`playbackNonce` 是个小巧思：每次 `playAnimation` 都 +1，渲染器靠它判断"同一个动画又被点了一次"，从而重播。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/state/AvatarState.kt:11`

`playAnimation` 的 `loop` 参数语义：0 表示无限循环（DragonBones 等实现里 `isLooping = loop == 0`）。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/control/AvatarController.kt:45`

`estimateEmotionDurationMillis` / `estimateTriggerDurationMillis` 让上层预估一段情绪动画播多久——语音对话里算"形象动多久、语音播多久"对齐用得上；算不出就返回 null。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/control/AvatarController.kt:51`

`lookAt(x, y)` 是高级特性：让形象看向屏幕某点。文档明确说不支持的类型直接空实现（DragonBones 的实现就是空的）。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/control/AvatarController.kt:74`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/dragonbones/control/DragonBonesAvatarController.kt:99`

`AvatarSettingKeys` 把各路可调参数收成字符串键：通用 `scale`/`translateX`/`translateY`，MMD 专属 `mmd.initialRotationX/Y/Z`、`mmd.cameraDistanceScale`、`mmd.cameraTargetHeight`，glTF/FBX 各有一套 `*.cameraPitch/Yaw/DistanceScale/TargetHeight`。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/control/AvatarSettingKeys.kt:4`

### 4. 三工厂：模型、控制器、渲染器各有一个

`AvatarModelFactoryImpl.createModel` 按 `AvatarType` 分发到 6 个私有构造方法；`createModelFromData` 能识别数据层的 `DragonBonesModel` 或 Map。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/factory/AvatarModelFactoryImpl.kt:25`

`createDefaultModel` 给每种类型造内置默认形象——唯独 FBX 返回 null，即 FBX 没有内置默认形象。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/factory/AvatarModelFactoryImpl.kt:97`

WebP/MP4 默认模型会按文件名别名推断情绪映射：文件名含 idle/default/normal/standby → IDLE，含 listening/talking/speak/speaking/chat → LISTENING，含 sad/cry/crying/angry/mad → SAD。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/factory/AvatarModelFactoryImpl.kt:356`

`AvatarControllerFactoryImpl.createController` 按类型构造控制器；DragonBones 要求模型实现 `ISkeletalAvatarModel`，否则造不出来。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/factory/AvatarControllerFactoryImpl.kt:27`

`AvatarView` 是统一入口 Composable：拿到渲染器就画，拿不到（类型不支持）就回调 `onError` 并显示一段错误文字兜底。
`app/src/main/java/com/ai/assistance/operit/core/avatar/common/view/AvatarView.kt:34`

### 5. 六条渲染路线

**DragonBones（骨骼动画）**：模型把数据层 `DragonBonesModel` 的相对文件名拼成绝对路径（`File(folderPath, file).absolutePath`）；控制器包装 `avator/dragonbones` 的 `DragonBonesController`（JNI），经 `JniBridge.getAnimationDuration` 估时长；情绪→动画的解析优先级是"情绪映射 → 情绪名小写（如 happy）→ IDLE 兜底"；`updateSettings` 把 scale 钳在 0.1–5.0、位移钳在 ±2000。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/dragonbones/model/DragonBonesAvatarModel.kt:29`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/dragonbones/control/DragonBonesAvatarController.kt:69`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/dragonbones/control/DragonBonesAvatarController.kt:155`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/dragonbones/control/DragonBonesAvatarController.kt:110`

**WebP（逐帧动画）**：`animationPathFor` 的兜底链是"指定文件 → 情绪对应文件 → IDLE 文件 → 首个可用动画"；非循环动画播完后 `onAnimationPlaybackCompleted` 自动切回 IDLE；渲染用 `ImageDecoder` 从字节解码（API 28+，能读 APK 压缩 assets 里的 webp），API 28 以下只显示首帧静态图；循环用 `REPEAT_INFINITE`，非循环注册 `Animatable2.AnimationCallback` 监听播完。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/webp/model/WebPAvatarModel.kt:37`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/webp/control/WebPAvatarController.kt:120`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/webp/view/WebPRenderer.kt:85`

**MP4（视频）**：控制器用 `MediaMetadataRetriever.METADATA_KEY_DURATION` 读视频时长来估算；渲染用 ExoPlayer，音量强制 0（`volume = 0f`）、`playWhenReady = true`，循环用 `REPEAT_MODE_ONE` 否则 `REPEAT_MODE_OFF`；画面是 `StyledPlayerView`，关掉播放器控件、无缝缩放（`RESIZE_MODE_ZOOM`）、透明背景；资源定位 `resolveMediaUri`：绝对路径走 `Uri.fromFile`，否则拼 `asset:///` scheme 读 assets。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mp4/control/Mp4AvatarController.kt:93`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mp4/view/Mp4Renderer.kt:56`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mp4/view/Mp4Renderer.kt:80`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mp4/view/Mp4Renderer.kt:133`

**glTF（3D，Filament）**：`GltfSurfaceView` 基于 Filament `ModelViewer` + `Choreographer.FrameCallback` 逐帧渲染，Surface 透明；灯光写死三点光源（key 175000、fill 52000、rim 16000）+ IBL 16000，`skybox = null`；data-URI 内嵌的 buffer/贴图先规范化到 `context.cacheDir/gltf_prepared/<hash>` 工作区，按魔数嗅探真实 mime；对没有纹理绑定的材质，按文件名（diffuse/basecolor/albedo）自动补 `baseColorTexture`，并强制 `KHR_materials_unlit`、metallic 归 0、roughness 不低于 0.82、baseColor 按 MMD 风格提亮 1.22 倍（上限 1.6）；加载完经 `onAnimationsDiscoveredListener` 把动画名和时长回传给控制器 `updateAnimationMetadata`；相机轨道优先用反射拿 `ModelViewer` 的 Manipulator，拿不到就用"模型空间绕转"兜底。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/gltf/view/GltfSurfaceView.kt:87`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/gltf/view/GltfSurfaceView.kt:1243`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/gltf/view/GltfSurfaceView.kt:624`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/gltf/view/GltfSurfaceView.kt:707`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/gltf/view/GltfSurfaceView.kt:1121`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/gltf/control/GltfAvatarController.kt:55`

**FBX（3D）**：渲染器用 `com.ai.assistance.fbx.FbxGlSurfaceView`（`avator/fbx` 模块），同样靠动画发现回调回填元数据；相机参数钳制：pitch ±89°、yaw ±180°、距离倍数 0.02–12、目标高度 -2..2；渲染器顶部有 `@Suppress("DEPRECATION")`。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/fbx/view/FbxRenderer.kt:88`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/fbx/control/FbxAvatarController.kt:156`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/fbx/view/FbxRenderer.kt:33`

**MMD（3D，MikuMikuDance）**：模型含 basePath/modelFile/motionFile(s)；控制器用 `MmdNative.nativeReadMotionMaxFrame` 读动作最大帧数、按 30fps 换算毫秒估时长；渲染用 `com.ai.assistance.mmd.MmdGlSurfaceView`（`avator/mmd` 模块），跟随 Lifecycle onResume/onPause，渲染出错在底部弹红色提示条。MMD 渲染代码现存且完整可用，未见弃用标记。
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mmd/control/MmdAvatarController.kt:81`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mmd/view/MmdRenderer.kt:27`
`app/src/main/java/com/ai/assistance/operit/core/avatar/impl/mmd/view/MmdRenderer.kt:65`

### 6. 谁在用它

`ConversationService` 用 `AvatarModelFactoryImpl` 初始化 `AvatarRepository`（形象数据的仓库层）。
`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt:84`

助手配置页的 `AvatarPreviewSection` 用 `AvatarView` + `AvatarRendererFactoryImpl` 做形象预览。
`app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt:119`

悬浮窗全屏语音界面 `FloatingFullscreenScreen` 是最重的调用方：下发情绪→动画映射（`updateEmotionAnimationMapping`）、mood→动画映射（`updateTriggerAnimationMapping`）、缩放/相机设置（`updateSettings`），再调 `playTrigger(triggerName)` 播模型吐出的 mood 标签动画、`playEmotion(emotion, loop = 1)` 播情绪动画。
`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/screen/FloatingFullscreenScreen.kt:271`
`app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/screen/FloatingFullscreenScreen.kt:293`

## 关键符号

| 符号 | 说明 |
|---|---|
| `AvatarType` | 形象技术路线枚举：DRAGONBONES / WEBP / MP4 / GLTF / FBX / MMD |
| `AvatarModel` | 模型接口：`id`、`name`、`type` 三件套 |
| `ISkeletalAvatarModel` | 骨骼类模型：骨骼/纹理图集/纹理图三路径 |
| `IFrameSequenceAvatarModel` | 逐帧类模型：`animationPath` + 循环开关 |
| `AvatarController` | 播放控制接口：情绪/动画/trigger/预估时长/lookAt/设置/映射 |
| `AvatarState` | 状态四字段：emotion、currentAnimation、isLooping、playbackNonce |
| `AvatarEmotion` | 7 种情绪：IDLE/LISTENING/THINKING/HAPPY/SAD/CONFUSED/SURPRISED |
| `AvatarMoodTypes` | 5 内置 mood（angry/happy/shy/aojiao/cry）+ promptHint + fallbackEmotion + 键归一化 |
| `AvatarSettingKeys` | 设置键：scale/translateX/Y、mmd.*、gltf.*、fbx.* 相机参数 |
| `AvatarView` | 统一 Composable 入口，按类型分发渲染器，失败显示错误文字 |
| `AvatarModelFactoryImpl` | 模型工厂：按类型构造、识别数据层模型、文件名别名推断情绪 |
| `AvatarControllerFactoryImpl` | 控制器工厂：按类型构造控制器 |
| `AvatarRendererFactoryImpl` | 渲染器工厂：按类型返回渲染 Composable |
| `DragonBonesAvatarController` | DragonBones 控制器：JNI 桥、情绪解析三级优先级、参数钳制 |
| `WebPAvatarController` | WebP 控制器：动画路径兜底链、播完回 IDLE |
| `Mp4AvatarController` | MP4 控制器：MediaMetadataRetriever 估时长 |
| `GltfAvatarController` | glTF 控制器：合并渲染器发现的动画元数据 |
| `FbxAvatarController` | FBX 控制器：相机参数钳制、声明动画归一化 |
| `MmdAvatarController` | MMD 控制器：native 读最大帧数按 30fps 估时长 |
| `GltfSurfaceView` | glTF 渲染视图：Filament、灯光写死、data-URI 预处理、材质自动修复 |

## 调用链

1. **输入**：上层（如 `FloatingFullscreenScreen`）拿到 `AvatarModel`（含资源路径与动画清单），经 `AvatarControllerFactoryImpl.createController(model)` 得到控制器、经 `AvatarRendererFactoryImpl.createRenderer(model)` 得到渲染 Composable，一起交给 `AvatarView` 显示。
2. **处理**：业务调 `controller.playTrigger("<mood>标签值")` 或 `playEmotion(情绪)`；控制器用情绪→动画映射/mood→动画映射/`normalizeKey` 解析出动画名，把 `currentAnimation`、`isLooping`、`playbackNonce+1` 写入 `AvatarState` StateFlow；glTF/FBX 渲染器加载完模型后经动画发现回调把真实动画名与时长回填 `updateAnimationMetadata`。
3. **输出**：各渲染器订阅 `controller.state`，驱动原生播放器渲染——DragonBones 走 JNI 骨骼库、WebP 走 ImageDecoder（API 28+）/首帧静态（API 28-）、MP4 走 ExoPlayer 静音循环、glTF/FBX/MMD 走各自 GLSurfaceView；播完非循环动画后 WebP 自动回 IDLE，渲染失败时底部提示条或错误文字兜底。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/avatar/`（common + impl/dragonbones + impl/fbx + impl/gltf + impl/mmd + impl/mp4 + impl/webp + impl/factory，共 35 个 Kotlin 文件）
- `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/ConversationService.kt`（AvatarRepository 初始化）
- `app/src/main/java/com/ai/assistance/operit/ui/features/assistant/components/AvatarPreviewSection.kt`（配置页预览）
- `app/src/main/java/com/ai/assistance/operit/ui/floating/ui/fullscreen/screen/FloatingFullscreenScreen.kt`（语音界面调用）
- `avator/dragonbones/`、`avator/mmd/`、`avator/fbx/`（native 渲染库模块）
- 源码版本：Operit v1.12.2，commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
