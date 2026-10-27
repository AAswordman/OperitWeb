---
title: 未覆盖 kt 扫尾·原生绑定/模板/示例
module: 附录
sources: 51
date: 2026-10-01
issue: 125
---

# appendix-uncovered-native（未覆盖 kt 扫尾·原生绑定/模板/示例）

> 种子：`llm/mnn`（10）+ `llm/llama`（3）+ `avator/dragonbones`（2）+ `avator/fbx`（3）+ `avator/mmd`（4）+ `quickjs` Compat（3）+ `showerclient`（6）+ `app/src/main/assets/templates`（7）+ `tools/shower`（6）+ 三方 vendor（7）@ `dbf71916`

## 概述

本页是 Day 7 覆盖率扫尾：把此前零 facts 引用的 51 个 Kotlin 文件全部读完收录。分三块：① 端侧/JNI 绑定（llm/mnn、llm/llama、avator/dragonbones、avator/fbx、avator/mmd、quickjs 兼容层）——这些是久未维护的 native 绑定层，用户早前决定不设独立页，此处仅为覆盖完整性收录；② 投屏客户端 `showerclient` 模块（6 文件）；③ 模板工程与三方 vendor 源码（20 文件）。模板/示例类文件均为骨架或占位代码，不含 Operit 自身业务逻辑，如实标注。

## AI 速览

核心符号清单：
- `MNNForwardType — MNN 推理硬件后端枚举（CPU/OpenCL/Auto/OpenGL/Vulkan，带 Int 取值）`
- `MNNLibraryLoader — 双重检查单例，只加载 MNN/MNNWrapper 两个 so 一次`
- `MNNImageProcess — 图像预处理工具（Config 归一化配置 + convertBuffer/convertBitmap 转 tensor）`
- `MNNLlmContextInfo — 最近一次 LLM 推理的快照（token 数/各阶段耗时/生成文本），fromJson 容错解析`
- `MNNLlmNative — MNN LLM 引擎的 JNI 声明集（external 方法 + GenerationCallback 流式回调）`
- `MNNLlmSession — MNN LLM 高级会话封装（三步创建/流式生成/withActiveCall 并发保护/带在途等待的 release）`
- `MNNModule — 动态形状模型的 MNN Module 封装（Config/Variable/forward 前向推理）`
- `MNNModuleNative — MNN Module 的 JNI 声明（创建/前向/变量读写）`
- `MNNNetInstance — MNN 通用网络实例封装（createFromFile/FromBuffer + Session/Tensor）`
- `MNNNetNative — MNN 通用推理的 JNI 声明（Net/Session/Tensor/图像转换）`
- `LlamaLibraryLoader — 双重检查单例加载 LlamaWrapper so（无异常捕获）`
- `LlamaNative — llama.cpp 的 JNI 声明（探活/采样参数/流式生成/工具调用语法）`
- `LlamaSession — llama.cpp 会话封装（Config 默认纯 CPU 2048 上下文，release 不等待在途调用）`
- `DragonBonesController — Compose 侧骨骼动画控制器（命令队列 + fetchAnimationNames）`
- `DragonBonesView — DragonBones 的 GLSurfaceView（单实例约束/GL 线程 JNI 调度/点击 slot 检测）`
- `FbxGlSurfaceView — FBX 模型预览的 GLSurfaceView（每帧向 native 索要动画帧顶点）`
- `FbxInspector — FBX 模型元信息检查器（动画名/时长/缺失外部文件）`
- `FbxLibraryLoader — 双重检查单例加载 FbxWrapper so`
- `MmdGlSurfaceView — MMD 模型的 GLSurfaceView（ES 3.0/native 渲染器句柄/120Hz 请求）`
- `MmdInspector — MMD/VMD 元信息检查器（PMD/PMX 格式识别 + 摘要计数）`
- `MmdLibraryLoader — 双重检查单例加载 MmdWrapper so`
- `MmdNative — MMD 的 JNI 声明（探活/模型动作摘要/native 渲染器句柄管理）`
- `QuickJsNativeCompatScriptBuilder — 生成 JS 兼容层脚本（globalThis 别名/NativeInterface Proxy/console 与定时器补齐）`
- `QuickJsNativeHostDispatcher — JS→宿主调用分流器（console 丢弃/定时器本地调度/其余转发）`
- `QuickJsNativeRuntime — QuickJS native 运行时封装（quickjsjni 句柄/兼容层装入/内存统计/只销毁一次）`
- `ShowerController — 投屏会话入口：维护 Binder 连接，为虚拟屏发建屏/输入注入/截屏命令并分发视频帧`
- `ShowerServerManager — 服务端进程生命周期：五步拉起 shower-server.jar（pkill→清场→拷 jar→app_process 启动→等 Binder）`
- `ShowerBinderRegistry — IShowerService 全局注册表：存活检查与广播交接点`
- `ShowerVideoRenderer — H.264 硬解码器：AVCC→AnnexB 转换、等 SPS/PPS 后初始化 MediaCodec 渲染到 Surface`
- `ShowerSurfaceView — 绑定 ShowerController 的 SurfaceView：等尺寸就绪后把视频帧路由给解码器`
- `ShowerEnvironment — 全局宿主注入点：ShellRunner / ShowerLogSink / emitToSystemLog`
- `MainActivity（templates/android）— 工程模板骨架：Compose Hello World（Greeting/MyApplicationTheme/Scaffold）`
- `ExampleInstrumentedTest（templates/android）— 模板骨架：断言包名 com.java.myapplication 的插桩测试占位`
- `Color.kt（templates/android）— 模板骨架：Purple80/40 等两套 Material3 配色定义`
- `MyApplicationTheme（templates/android Theme.kt）— 模板骨架：默认开 dynamicColor 的 Material3 主题函数`
- `Typography（templates/android Type.kt）— 模板骨架：只覆写 bodyLarge 的排版定义`
- `ExampleUnitTest（templates/android）— 模板骨架：2+2=4 占位本地单测`
- `MainActivity（templates/flutter）— 模板骨架：FlutterActivity 子类，Flutter 工程的 Android 壳入口`
- `checkPrecondition — compose 内部前置条件 vendor 拷贝：失败抛 IllegalStateException`
- `FeatureConfig — sherpa mnn 特征配置：默认 16kHz 采样 / 80 维特征`
- `OnlineRecognizer — sherpa mnn 流式语音识别 JNI 封装：createStream/decode/getResult 全走 sherpa-mnn-jni`
- `OnlineStream — sherpa mnn 识别流：acceptWaveform 喂音频，release()/use{} 释放 native 指针`
- `Vad — sherpa mnn Silero 语音端点检测封装：默认阈值 0.5 / 窗口 512，模型 silero_vad.onnx`
- `SherpaNcnn — sherpa ncnn 后端流式识别 JNI 封装：encoder/decoder/joiner param+bin 六文件配置，useGPU 默认开`
- `Uuid — java.util.UUID 薄包装：ExperimentalUuidApi 实验性 API（包名与文件路径不一致）`
- `MainActivity（tools/shower）— 示例工程壳：onCreate 调 Main.start(this) 拉起投屏服务端`
- `ExampleInstrumentedTest（tools/shower）— 示例代码：断言包名 com.ai.assistance.shower 的插桩测试占位`
- `ShowerTheme（tools/shower Theme.kt）— 示例代码：与模板同构的 Material3 主题函数`
- `Color.kt（tools/shower）— 示例代码：与模板同构的两套配色定义`
- `Type.kt（tools/shower）— 示例代码：与模板同构的排版定义`
- `ExampleUnitTest（tools/shower）— 示例代码：2+2=4 占位本地单测`

主入口：
- 投屏：`ShowerController`（会话）/`ShowerServerManager.ensureServerStarted`（拉起服务端）
- 端侧推理：`MNNLlmSession.create()` / `LlamaSession.create()`（三步建会话）
- 语音：sherpa `OnlineRecognizer.createStream()` → `decode()` → `getResult()`
- JS 运行时：`QuickJsNativeRuntime.create(hostBridge)` → `installCompatLayerOrThrow()`

数据流向一句话：
- 投屏：宿主注入 `ShellRunner` → `app_process` 拉起服务端 → Binder 广播交接 → `ShowerController` 发命令收 H.264 帧 → `ShowerVideoRenderer` 解码到 `ShowerSurfaceView`。
- 端侧 JNI：`LibraryLoader.loadLibraries()` → `*Native` object init → `nativeCreate*` 拿指针 → 推理/生成 → `release()` 释放指针（MNN 等在途调用归零，LLaMA 不等）。
- JS 兼容层：装入 compat 脚本 → JS 调用经 `Proxy` 转 `nativeBridge.__call` → `QuickJsNativeHostDispatcher` 分流（console 丢弃/定时器本地/其余转宿主）。

## 核心机制

### 端侧/JNI 绑定

> 备注：本节收录的是 Operit 里久未维护的 JNI/native 绑定层。用户早前已决定不为这些引擎（MNN / llama.cpp / DragonBones / FBX / MMD / QuickJS）设独立 wiki 页，此处仅为覆盖完整性收录它们的 Kotlin 侧绑定与会话封装。源码以 Operit @ dbf71916（v1.12.2）为准。

#### MNN

MNN 是阿里开源的端侧推理框架，本模块（`llm/mnn`）用 Kotlin 封装了它的两套 JNI 能力：通用网络推理（Net/Session/Tensor）和 LLM 推理引擎。

**推理后端选择**：`MNNForwardType` 是一个带 `type: Int` 字段的 Kotlin 枚举，把硬件后端映射成整数——`FORWARD_CPU(0)`、`FORWARD_OPENCL(3)`、`FORWARD_AUTO(4)`、`FORWARD_OPENGL(6)`、`FORWARD_VULKAN(7)`。注意这组取值与上游 MNN 官方 Java 绑定常用的枚举取值不完全一致（如官方 OpenCL 通常为 2），接入时以本仓库为准（`MNNForwardType.kt:7-31`）。

**库加载**：`MNNLibraryLoader`（internal 单例）用双重检查锁（`@Volatile loaded` + `synchronized(lock)`）保证 `MNN` 和 `MNNWrapper` 两个 so 只加载一次；`UnsatisfiedLinkError` 会打日志后原样 rethrow，`isLoaded()` 对外暴露加载状态（`MNNLibraryLoader.kt:16-51`）。

**通用推理**：`MNNNetNative` 是纯 JNI 声明的 object，`init` 块里先触发 `MNNLibraryLoader.loadLibraries()`。它覆盖 Net（`nativeCreateNetFromFile/FromBuffer`）、Session（`nativeCreateSession`、`nativeRunSession`、`nativeRunSessionWithCallback` 按名回调抓取中间 tensor）、Tensor（`nativeTensorGetData(tensorPtr, dest)` 中 `dest` 可传 null 先查尺寸）和图像预处理（`nativeConvertBitmapToTensor`/`nativeConvertBufferToTensor`）（`MNNNetNative.kt:11-94`）。`MNNNetInstance` 在其之上包了 `createFromFile`/`createFromBuffer`（native 返回 0 即失败）、`Session`（`reshape()`/`run()`/`runWithCallback()`）和 `Tensor`（`getData()` 采用"先传 null 查尺寸、再分配数组二次读取"的两阶段读数）；`release()` 释放 native 指针并置 0（`MNNNetInstance.kt:20-261`）。`MNNModule` 面向动态形状模型：`load(filePath, Config)` 经 `nativeCreateModuleFromFile` 建 module；`Config` 默认 CPU/4 线程/普通精度/普通内存；`forward()` 先校验输入变量数与 `inputNames` 一致；`DataType` 按 halide 编码 `(code shl 8) or bits` 定义 `FLOAT32` 等常量；`Variable.release()` 释放指针并置 0，`finalize()` 兜底（`MNNModule.kt:33-218`）。`MNNImageProcess` 是图像预处理工具：`Config` 默认 `mean=0/normal=1/source=RGBA/dest=BGR/filter=NEAREST/wrap=CLAMP_TO_EDGE`，并为 `FloatArray` 字段手写了 `equals/hashCode`；`convertBuffer` 把 `ByteArray` 图像经 3x3 `Matrix` 变换转成 tensor，`convertBitmap` 直接接受 `Bitmap`（`MNNImageProcess.kt:8-136`）。

**LLM 会话**：`MNNLlmNative` 同样在 `init` 里加载库，声明了约 20 个 external 方法，全部以 `Long` 指针（`llmPtr`）传递 native 对象。创建三步走：`nativeCreateLlm(configPath)`（失败返回 0）→ 必须先 `nativeSetConfig` → 再 `nativeLoadLlm`。回调 `GenerationCallback.onToken` 返回 Boolean，`false` 表示停止生成（`MNNLlmNative.kt:9-197`）。`MNNLlmSession.create()` 把这三步串起来，按官方 `llm_bench.cpp` 的顺序逐条下发配置（`tmp_path`/`async`/`precision`/`memory`/`backend_type`/`thread_num`），任何一步失败都 `nativeReleaseLlm` 释放指针。并发安全靠 `withActiveCall`：`synchronized(lock)` + `activeCalls` 计数，`checkValid()` 在已释放或指针为 0 时抛异常；`release()` 先 `nativeCancel`，再用 `wait/notifyAll` 等在途调用归零后才 `nativeReleaseLlm`（`MNNLlmSession.kt:29-406`）。`MNNLlmContextInfo` 是最近一次推理的快照 data class：token 数、各阶段耗时（`load_us/vision_us/audio_us/prefill_us/decode_us/sample_us`）、`pixels_mp`、`currentToken`、`status`、`generate_str` 文本、`history_tokens/output_tokens`；`fromJson` 用 `JSONObject.opt*` 容错解析，数组缺失时返回空数组（`MNNLlmContextInfo.kt:8-53`）。

#### LLaMA

`llm/llama` 是 llama.cpp 的轻量绑定，只有三文件。

`LlamaLibraryLoader` 也是双重检查单例，但只加载 `LlamaWrapper` 一个 so，且**不捕获** `UnsatisfiedLinkError`——加载失败时无日志直接上抛，诊断信息弱于 MNN 那边（`LlamaLibraryLoader.kt:8-15`）。

`LlamaNative` 在 `init` 里加载库，声明了约 10 个 external 方法。特色是先探活：`nativeIsAvailable()` / `nativeGetUnavailableReason()` 让 Java 层在建会话前确认后端可用；采样参数一次传七个（temperature/topP/topK/repetitionPenalty/frequencyPenalty/presencePenalty/penaltyLastN）；流式生成用 `GenerationCallback.onToken` 回调（`LlamaNative.kt:5-80`）。

`LlamaSession.Config` 默认 `nCtx=2048`、`nBatch=512`、`nUBatch=512`、`nGpuLayers=0`（纯 CPU）、`useMmap=false`、`kvUnified=true`；`isAvailable()`/`getUnavailableReason()` 用 `runCatching` 包裹 native 调用给默认值；`create()` 先探活再 `nativeCreateSession`，指针为 0 返回 null。注意它与 MNNLlmSession 的关键差异：`release()` 只在锁内取指针置 0、锁外调 `nativeReleaseSession`，**不等在途的 `generateStream` 结束**（`generateStream` 是把指针拷出锁后再调 native），存在释放与推理并发的竞态（详见走查）（`LlamaSession.kt:7-190`）。

#### DragonBones

`avator/dragonbones` 是 DragonBones 骨骼动画的 C++ JNI 渲染绑定。`JniBridge`（本节范围外，`com/dragonbones/JniBridge.kt`）在 `init` 里直接 `System.loadLibrary("dragonbones_native")`，无 try/catch；声明了 `init/loadDragonBones/onSurfaceCreated/onSurfaceChanged/onDrawFrame/getAnimationNames/fadeInAnimation/containsPoint/setWorldScale/setWorldTranslation/overrideBonePosition/resetBone/stopAnimation/onPause/onResume/onDestroy` 等 external 方法（`JniBridge.kt:3-34`）。

`DragonBonesView` 是 `GLSurfaceView` 子类：构造时检查 `activeInstance`（WeakReference），**同一时间只允许一个实例**，否则抛 `IllegalStateException`；EGL 取 8/8/8/8/16/0 透明配置、`setEGLContextClientVersion(2)`、`RENDERMODE_CONTINUOUSLY` 连续渲染；所有 JNI 调用都经 `queueEvent` 发到 GL 线程（`loadModel` 把骨骼 json/纹理 json/png 三份数据读成字节数组后在 GL 线程调 `JniBridge.loadDragonBones`；`fadeInAnimation`/`overrideBonePosition`/`resetBone` 同理）；点击检测在 GL 线程调 `JniBridge.containsPoint(x, y)`，命中 slot 名再 `post` 回 UI 线程回调；`destroy()` 在 GL 线程调 `onDestroy` 并清除 `activeInstance`（`DragonBonesView.kt:42-181`）。

`DragonBonesController` 是 `@Stable` 的 Compose 控制器（构造需传 `coroutineScope`）。播放动画不直接调 JNI，而是把 `FadeInAnimationCommand(name, layer, loop, fadeInTime)` 推进 `animationCommandQueue`（`mutableStateListOf`），由 `DragonBonesViewCompose` 的 `LaunchedEffect` 循环逐个消费——命令的 `id` 默认 `System.currentTimeMillis()`，保证同名动画在重组时也能再次触发；`fetchAnimationNames()` 用 `suspendCancellableCoroutine` 把回调转成挂起函数；`setView` 换 view 时先销毁旧 view 并清空动画队列防串台（`DragonBonesController.kt:27-147`）。`DragonBonesViewCompose` 把 view 与 controller 绑定，model 变更时先清空动画名与命令队列再 `loadModel`，加载完成回调里重新拉动画名（`DragonBonesView.kt:249-353`）。

#### FBX

`avator/fbx` 是 FBX 模型预览的 native 绑定（`FbxWrapper` so，经 `FbxLibraryLoader` 双重检查加载，失败无日志直接上抛；`FbxNative.kt` 声明 external 方法，不在本节 25 文件范围内）。

`FbxGlSurfaceView` 是 `GLSurfaceView`：EGL ES 2.0 透明悬浮、`RENDERMODE_CONTINUOUSLY`。`setModelPath`/`setAnimationState`/`setCameraPose` 都经 `queueEvent` 发到 GL 线程；`setAnimationState` 带 `playbackNonce`，同名/同循环/同 nonce 的重复调用会被去重。`FbxPreviewRenderer.onDrawFrame` 每帧按"动画时长取模（循环）或钳制（单次）"算出采样时间，调 `FbxNative.nativeBuildPreviewFrame(sessionHandle, animationName, sampleTimeSeconds)` 向 native 索要当前帧顶点；顶点步长 `STRIDE_FLOATS=8`（position3+normal3+uv2），顶点缓冲不足时重建 `FloatBuffer`；纹理分嵌入（`nativeReadEmbeddedTextureBytes`）与外链（`BitmapFactory.decodeFile`，缺失打 warn）两种加载；`onDetachedFromWindow` 在 GL 线程 `release()` 销毁 native 预览会话（`FbxGlSurfaceView.kt:26-90, 226, 327-406`）。

`FbxInspector.inspectModel(path)` 经 `FbxNative.nativeInspectModel` 拿 JSON，转成 `FbxModelInfo`（动画名、动画时长毫秒、所需/缺失的外部文件列表）；`modelName` 为空时从文件路径 basename 去扩展名兜底；`defaultAnimation` 取动画列表第一个（`FbxInspector.kt:13-43`）。

#### MMD

`avator/mmd` 是 MMD（PMD/PMX 模型 + VMD 动作）的 native 渲染绑定，`MmdWrapper` so 经 `MmdLibraryLoader` 双重检查加载。

`MmdNative` 在 `init` 里加载库，提供探活（`nativeIsAvailable`/`nativeGetUnavailableReason`/`nativeGetLastError`）、模型/动作摘要读取（`nativeReadModelSummary`/`nativeReadMotionSummary` 等）与渲染器句柄管理（`nativeCreateRenderer`/`nativeDestroyRenderer`/`nativeRender`/`nativePause`/`nativeResume`）；`nativeOnSurfaceCreated(handle, assetManager)` 把 `AssetManager` 传给 native 读资源（`MmdNative.kt:7-41`）。

`MmdInspector.inspectModel` 用 `nativeReadModelSummary` 返回的 `LongArray`（要求长度 ≥ `MODEL_SUMMARY_SIZE=8`，不足直接返回 null），`summary[0]` 为 1/2 时映射 `PMD/PMX`，否则 `UNKNOWN`，其余 7 项依次是顶点/面/材质/骨骼/表情/刚体/关节计数；`inspectMotion` 读 VMD 摘要（motion/morph/camera/light/shadow/ik 六项计数，要求长度 ≥ 6）（`MmdInspector.kt:32-71`）。

`MmdGlSurfaceView` 用 **OpenGL ES 3.0**（`setEGLContextClientVersion(3)`，EGL 8/8/8/8/24/8），`NEXT_INSTANCE_ID`（AtomicInteger）给每个实例编号便于日志；`onSurfaceCreated` 时若 `rendererHandle==0` 会重建 native renderer 并 `syncRequestedState()` 把待应用的模型路径/动画/旋转/相机状态一次性同步；`requestHighRefreshRateIfSupported()` 在 Android R+ 上用反射调 `Surface.setFrameRate(120f, 0)` 请求 120Hz（`MmdGlSurfaceView.kt:23-121`）。

#### QuickJS Compat

`quickjs` 模块的三文件是 QuickJS native 运行时（`quickjsjni` so）的 Kotlin 封装，负责给 JS 脚本补齐浏览器式环境。

`QuickJsNativeBridge`（`QuickJsNativeRuntime.kt` 顶部 internal object）在 `init` 里加载 `quickjsjni`，声明 `nativeCreate(hostBridge)`（把 `HostBridge` 回调对象传给 native）、`nativeDestroy`、`nativeEvaluate`、`nativeCallFunction`、`nativeExecutePendingJobs`、`nativeGetMemoryUsage`、`nativeResetMemoryPeak`、`nativeInterrupt`。`QuickJsNativeRuntime.create(hostBridge)` 要求 handle 非 0；`installCompatLayerOrThrow()` 把兼容层脚本装入运行时并执行 pending jobs，失败抛错；`close()`/`interrupt()` 用 `AtomicBoolean` + `synchronized(lifecycleLock)` 保证只销毁一次；`requireHandle()` 在已关闭时抛错（`QuickJsNativeRuntime.kt:7-156`）。

`buildQuickJsCompatScript()` 返回的 JS 兼容层做了四件事：① 补齐 `globalThis/window/self/global` 别名；② 用 `Proxy` 包裹 `NativeInterface`——JS 侧任意方法调用都被转成 `nativeBridge.__call(method, JSON.stringify(args))`；③ 缺失的 `console.log/info/warn/error/debug`、`queueMicrotask`（用 Promise 实现）、`localStorage/sessionStorage`（内存实现）、`performance.now` 全部补上；④ `setTimeout/setInterval/clearTimeout/clearInterval` 重写为经 `NativeInterface.scheduleTimer/cancelTimer` 桥接到宿主，其中字符串回调经 `eval(callback)` 执行（`QuickJsNativeCompatScriptBuilder.kt:3-154`）。

`QuickJsNativeHostDispatcher` 实现 `HostBridge.onCall` 做分流：`console.*` 直接丢弃（返回 null）、`scheduleTimer`/`cancelTimer` 本地处理、其余方法经 `forwardCall` 转发给宿主。定时器跑在名为 `QuickJsNativeTimer` 的守护线程单线程 `ScheduledExecutor` 上，`scheduleAtFixedRate` 用 `max(1L, delayMs)` 保证周期至少 1ms；`close()` 取消全部任务并 `shutdownNow()`（`QuickJsNativeHostDispatcher.kt:13-91`）。

### 投屏客户端 showerclient

`showerclient` 是一个独立的投屏客户端库模块（包名 `com.ai.assistance.showerclient`），宿主 App 用它与本机运行的 Shower 投屏服务端通信：创建虚拟显示屏、接收 H.264 视频流、注入触摸与按键、截屏。整个模块按宿主无关（host-agnostic）设计：执行 shell 的能力与日志输出都由宿主在启动时注入，模块自身不硬编码宿主实现。

#### ShellEnvironment.kt — 全局环境与日志门面

`ShellIdentity` 枚举定义执行 shell 命令的三种身份：`DEFAULT`、`SHELL`、`ROOT`，用来区分"普通命令"和"拉起服务端"这类需要更高权限的操作。`ShellRunner` 是一个 `fun interface`（函数式接口），宿主必须在应用启动时把自己的实现赋给 `ShowerEnvironment.shellRunner`，否则服务端根本拉不起来。`ShowerLog` 是日志门面：默认继续写 Android 系统 logcat（`emitToSystemLog` 默认为 true，保持老行为），宿主也可以注入一个 `ShowerLogSink` 把日志镜像到自己的日志管线；注入的 sink 抛异常会被吞掉，保证宿主日志故障绝不影响投屏流程。

#### ShowerBinderRegistry.kt — Binder 全局注册表

一个全局单例，保存当前可用的 `IShowerService`。服务端进程发布新的 Binder 后，宿主的广播接收器负责调 `setService` 更新注册表；`hasAliveService()` 用 `IBinder.isBinderAlive` 判断服务端是否还活着。也就是说，客户端与服务端的"牵手"完全依赖宿主正确转发广播。

#### ShowerController.kt — 会话控制器

这是客户端的会话入口：维护一条到 Shower 服务的 Binder 连接，为某一个虚拟屏发送命令（`ensureDisplay`、`launchApp`、`tap`、`swipe`、`touch`、`key`、`requestScreenshot` 等），并跟踪该会话的虚拟屏 id 与视频尺寸。

- 视频宽高按 16 字节对齐（`CODEC_SIZE_ALIGNMENT = 16`），这是 H.264 编码块尺寸的要求。
- `ensureDisplay` 有复用逻辑：同尺寸的旧屏直接复用 displayId 并重新绑定视频 sink；尺寸变了才先 `destroyDisplay` 再重建。
- `prepareMainDisplay` 不创建虚拟屏，直接在物理主屏（displayId=0）上注入输入；正式注入前会先发一次 `injectKey(0, 0)`（KEYCODE_UNKNOWN）探活输入通路。
- Binder 断连自愈：`getBinder` 发现 binder 死亡时，会调 `ShowerServerManager.ensureServerStarted` 重启服务端、等 200ms 再重试；`prepareMainDisplay` 与 `ensureDisplay` 里是同样的"断连→重启→重试"路径。
- `requestScreenshot` 默认 3000ms 超时，超时返回 null。
- 视频帧走 `IShowerVideoSink` 回调进入二进制通道：在 `setBinaryHandler` 注册回调之前到达的帧会先缓存在 `earlyBinaryFrames`（上限 120 帧，超了丢最老的），回调注册后再回放补上，避免 Surface 还没准备好时丢关键帧。

#### ShowerServerManager.kt — 服务端进程生命周期

`ensureServerStarted` 按五步拉起服务端：① 注册表里已有活 Binder 就直接复用；② `pkill -f com.ai.assistance.shower.Main` 杀掉旧进程；③ 清理 `/data/local/tmp` 下的旧 jar 与日志；④ 把 assets 里的 `shower-server.jar` 先拷到 `/sdcard/Download/Operit` 中转，再用 SHELL 身份 `cp` 到 `/data/local/tmp/shower-server.jar`（让文件属主变成 shell 用户）；⑤ 用 `CLASSPATH=<jar> app_process / com.ai.assistance.shower.Main <宿主包名> &` 后台启动，然后最多轮询 10 秒（50 次 × 200ms）等 Binder 交接广播到来。`additionalTargetPackages` 是预留的多目标包名扩展点；`stopServer` 同样用 pkill 停服；jar 中转目录复用了截图目录 `/sdcard/Download/Operit`。

#### ShowerVideoRenderer.kt — H.264 解码渲染

每个实例负责一个虚拟屏的视频流，用 `MediaCodec` 硬解 `video/avc` 并渲染到 Surface。`onFrame` 收到每个 H.264 包先做 AVCC→Annex B 转换（`maybeAvccToAnnexb`）；解码器要等凑齐 SPS（NAL type 7，作为 csd-0）与 PPS（NAL type 8，作为 csd-1）才初始化，在此之前到达的帧暂存在 `pendingFrames` 里，初始化成功后依次喂入解码器；解码出错时释放解码器并清空缓冲。`captureCurrentFramePng` 用 `PixelCopy` 从 Surface 抓当前帧压成 PNG（质量 100），API 26 以下直接返回 null。

#### ui/ShowerSurfaceView.kt — 渲染视图

`SurfaceView` 子类，`bindController` 把某个 `ShowerController` 绑到视图上。`surfaceCreated` 后最多等 5 秒（50 次 × 100ms）拿视频尺寸，`setFixedSize` 后把 renderer 挂到 Surface，再把控制器的二进制帧路由给 `renderer.onFrame`——这个顺序保证了 SPS/PPS 缓冲帧能被解码器正确消费，修的是 Surface 与尺寸就绪的竞态。`surfaceDestroyed` 时清掉 binaryHandler 并 `renderer.detach()`。对外暴露 `captureCurrentFramePng()` 抓当前帧。

##### AI 速览（投屏客户端）

- `ShowerController` — 会话入口：建屏 / 输入注入 / 截屏 / 视频帧分发
- `ShowerServerManager.ensureServerStarted` — 五步拉起服务端进程（pkill→清场→拷 jar→app_process 启动→等 Binder）
- `ShowerBinderRegistry` — `IShowerService` 全局注册与存活检查
- `ShowerVideoRenderer` — H.264 硬解码渲染到 Surface
- `ShowerSurfaceView` — 绑定 controller 的渲染视图
- `ShowerEnvironment` / `ShowerLog` — 宿主注入点（`ShellRunner`/`ShowerLogSink`）与日志门面

数据流向一句话：宿主注入 `ShellRunner` → `ShowerServerManager` 用 `app_process` 拉起服务端进程 → 服务端发布 `IShowerService` Binder，经广播交接进 `ShowerBinderRegistry` → `ShowerController` 发命令、收 H.264 帧 → `ShowerVideoRenderer` 解码到 `ShowerSurfaceView`。

### 模板工程与三方源码

这 20 个文件分三类：① App 内置的"新建工程模板"（`app/src/main/assets/templates/` 下，供用户在 Operit 里一键生成 Android/Flutter 工程骨架）；② `tools/shower` 示例工程（投屏服务端的最小可运行壳）；③ 直接 vendor 进仓库的三方源码（sherpa 语音识别 JNI 封装、compose 内部前置条件、UUID 包装）。模板/示例类文件均为骨架或占位代码，不含 Operit 自身业务逻辑。

#### 工程模板（app/src/main/assets/templates/，模板工程骨架）

- **android 模板（6 文件）**：标准 Android Studio 新工程骨架。`MainActivity.kt` 用 Compose 写了个 `Greeting("Android")` 的 Hello World（`MyApplicationTheme` + `Scaffold`）；`ui/theme/Color.kt` 定义 `Purple80`/`PurpleGrey80`/`Pink80` 与 `Purple40`/`PurpleGrey40`/`Pink40` 两套 Material3 配色；`ui/theme/Theme.kt` 的 `MyApplicationTheme` 默认开 `dynamicColor`（Android 12+ 取系统动态色）；`ui/theme/Type.kt` 只覆写了 `bodyLarge`（16.sp 字号 / 24.sp 行高）；`ExampleInstrumentedTest` 断言包名为 `com.java.myapplication`，`ExampleUnitTest` 是 `2+2=4` 的占位单测。
- **flutter 模板 `MainActivity.kt`**：仅 5 行，`class MainActivity : FlutterActivity()`，包名 `com.example.operit_flutter_project`，是 Flutter 工程的 Android 壳入口。

#### 投屏示例工程（tools/shower/，示例代码）

6 个文件，与 android 模板同构的最小示例工程，包名 `com.ai.assistance.shower`。关键差别在 `MainActivity.onCreate` 里调了 `Main.start(this)`——把投屏服务端（`com.ai.assistance.shower.Main`）在 Activity 启动时拉起来；主题函数叫 `ShowerTheme`。两个 `Example*Test` 同样是包名断言与 `2+2` 占位。这是示例/壳工程，不是产品代码。

#### 三方源码 vendor

- **`androidx/compose/foundation/internal/Preconditions.kt`**：从 compose-foundation 抄来的内部前置条件工具，`internal` 可见；`checkPrecondition` 失败抛 `IllegalStateException`，`requirePrecondition`/`requirePreconditionNotNull` 抛 `IllegalArgumentException`，另有 `throwIndexOutOfBoundsException`。vendor 进来是为了不引入整个 compose-foundation 依赖。
- **`kotlin/uuid/Uuid.kt`**：对 `java.util.UUID` 的薄包装，提供跨平台一致的 API；注意文件路径是 `kotlin/uuid/Uuid.kt`，包名却是 `org.jetbrains.kotlinx.mcp.shared.util.uuid`（与目录结构不一致）；`ExperimentalUuidApi` 注解把 API 标记为实验性（`RequiresOptIn` Level.ERROR）；`Uuid.random()` 生成随机 UUID。
- **`com/k2fsa/sherpa/mnn`（4 文件）**：sherpa-onnx MNN 后端的流式语音识别 JNI 封装，native 库为 `sherpa-mnn-jni`。`FeatureConfig` 默认 16kHz 采样 / 80 维特征；`OnlineStream` 是识别流，`acceptWaveform` 喂音频、`inputFinished` 标记输入结束，`release()` 直接调 `finalize()` 释放 native 指针，`use {}` 块自动释放；`OnlineRecognizer` 持有 native 指针 `ptr`，`createStream`/`decode`/`isEndpoint`/`isReady`/`getResult` 全部走 JNI，`getResult` 返回 `OnlineRecognizerResult(text/tokens/timestamps)`；配置类覆盖 transducer / paraformer / zipformer2-ctc / neMo-ctc 四种模型结构、端点检测三规则（rule1 要求 2.4 秒尾部静音等）、解码方法默认 `greedy_search`；`getModelConfig(type)` 内置 0–14 号预训练模型路径（如 0=中英双语 zipformer、5=中英双语 paraformer）；`Vad` 是 Silero VAD 封装，默认阈值 0.5、窗口 512，`getVadModelConfig(0)` 指向 `silero_vad.onnx`，`SpeechSegment` 携带语音段起始帧与采样。
- **`com/k2fsa/sherpa/ncnn/SherpaNcnn.kt`**：ncnn 后端的流式识别封装，native 库为 `sherpa-ncnn-jni`；`ModelConfig` 含 encoder/decoder/joiner 的 param+bin 共六个文件加 tokens，`useGPU` 默认 true；`DecoderConfig` 默认 `modified_beam_search`；`SherpaNcnn.release()` 用 `@Synchronized` 保证线程安全；`getModelConfig(type, useGPU)` 内置 0–6 号模型（如 0=纯中文 `sherpa-ncnn-2022-09-30`）。

##### AI 速览（模板工程与三方源码）

- `templates/android MainActivity` — 新工程模板的 Compose Hello World 骨架
- `tools/shower MainActivity` — 示例工程壳，`onCreate` 调 `Main.start(this)` 拉起投屏服务端
- sherpa/mnn `OnlineRecognizer` — 流式语音识别 JNI 封装（`sherpa-mnn-jni`）
- sherpa/mnn `Vad` — Silero 语音端点检测封装
- sherpa/ncnn `SherpaNcnn` — ncnn 后端流式识别封装（`sherpa-ncnn-jni`）
- `Preconditions` — compose 内部前置条件工具的 vendor 拷贝
- `Uuid` — `java.util.UUID` 薄包装（包名与文件路径不一致）

## 关键符号

- `MNNForwardType — MNN 推理硬件后端枚举（CPU/OpenCL/Auto/OpenGL/Vulkan，带 Int 取值）`
- `MNNLibraryLoader — 双重检查单例，只加载 MNN/MNNWrapper 两个 so 一次`
- `MNNImageProcess — 图像预处理工具（Config 归一化配置 + convertBuffer/convertBitmap 转 tensor）`
- `MNNLlmContextInfo — 最近一次 LLM 推理的快照（token 数/各阶段耗时/生成文本），fromJson 容错解析`
- `MNNLlmNative — MNN LLM 引擎的 JNI 声明集（external 方法 + GenerationCallback 流式回调）`
- `MNNLlmSession — MNN LLM 高级会话封装（三步创建/流式生成/withActiveCall 并发保护/带在途等待的 release）`
- `MNNModule — 动态形状模型的 MNN Module 封装（Config/Variable/forward 前向推理）`
- `MNNModuleNative — MNN Module 的 JNI 声明（创建/前向/变量读写）`
- `MNNNetInstance — MNN 通用网络实例封装（createFromFile/FromBuffer + Session/Tensor）`
- `MNNNetNative — MNN 通用推理的 JNI 声明（Net/Session/Tensor/图像转换）`
- `LlamaLibraryLoader — 双重检查单例加载 LlamaWrapper so（无异常捕获）`
- `LlamaNative — llama.cpp 的 JNI 声明（探活/采样参数/流式生成/工具调用语法）`
- `LlamaSession — llama.cpp 会话封装（Config 默认纯 CPU 2048 上下文，release 不等待在途调用）`
- `DragonBonesController — Compose 侧骨骼动画控制器（命令队列 + fetchAnimationNames）`
- `DragonBonesView — DragonBones 的 GLSurfaceView（单实例约束/GL 线程 JNI 调度/点击 slot 检测）`
- `FbxGlSurfaceView — FBX 模型预览的 GLSurfaceView（每帧向 native 索要动画帧顶点）`
- `FbxInspector — FBX 模型元信息检查器（动画名/时长/缺失外部文件）`
- `FbxLibraryLoader — 双重检查单例加载 FbxWrapper so`
- `MmdGlSurfaceView — MMD 模型的 GLSurfaceView（ES 3.0/native 渲染器句柄/120Hz 请求）`
- `MmdInspector — MMD/VMD 元信息检查器（PMD/PMX 格式识别 + 摘要计数）`
- `MmdLibraryLoader — 双重检查单例加载 MmdWrapper so`
- `MmdNative — MMD 的 JNI 声明（探活/模型动作摘要/native 渲染器句柄管理）`
- `QuickJsNativeCompatScriptBuilder — 生成 JS 兼容层脚本（globalThis 别名/NativeInterface Proxy/console 与定时器补齐）`
- `QuickJsNativeHostDispatcher — JS→宿主调用分流器（console 丢弃/定时器本地调度/其余转发）`
- `QuickJsNativeRuntime — QuickJS native 运行时封装（quickjsjni 句柄/兼容层装入/内存统计/只销毁一次）`
- `ShowerController — 投屏会话入口：维护 Binder 连接，为虚拟屏发建屏/输入注入/截屏命令并分发视频帧`
- `ShowerServerManager — 服务端进程生命周期：五步拉起 shower-server.jar（pkill→清场→拷 jar→app_process 启动→等 Binder）`
- `ShowerBinderRegistry — IShowerService 全局注册表：存活检查与广播交接点`
- `ShowerVideoRenderer — H.264 硬解码器：AVCC→AnnexB 转换、等 SPS/PPS 后初始化 MediaCodec 渲染到 Surface`
- `ShowerSurfaceView — 绑定 ShowerController 的 SurfaceView：等尺寸就绪后把视频帧路由给解码器`
- `ShowerEnvironment — 全局宿主注入点：ShellRunner / ShowerLogSink / emitToSystemLog`
- `MainActivity（templates/android）— 工程模板骨架：Compose Hello World（Greeting/MyApplicationTheme/Scaffold）`
- `ExampleInstrumentedTest（templates/android）— 模板骨架：断言包名 com.java.myapplication 的插桩测试占位`
- `Color.kt（templates/android）— 模板骨架：Purple80/40 等两套 Material3 配色定义`
- `MyApplicationTheme（templates/android Theme.kt）— 模板骨架：默认开 dynamicColor 的 Material3 主题函数`
- `Typography（templates/android Type.kt）— 模板骨架：只覆写 bodyLarge 的排版定义`
- `ExampleUnitTest（templates/android）— 模板骨架：2+2=4 占位本地单测`
- `MainActivity（templates/flutter）— 模板骨架：FlutterActivity 子类，Flutter 工程的 Android 壳入口`
- `checkPrecondition — compose 内部前置条件 vendor 拷贝：失败抛 IllegalStateException`
- `FeatureConfig — sherpa mnn 特征配置：默认 16kHz 采样 / 80 维特征`
- `OnlineRecognizer — sherpa mnn 流式语音识别 JNI 封装：createStream/decode/getResult 全走 sherpa-mnn-jni`
- `OnlineStream — sherpa mnn 识别流：acceptWaveform 喂音频，release()/use{} 释放 native 指针`
- `Vad — sherpa mnn Silero 语音端点检测封装：默认阈值 0.5 / 窗口 512，模型 silero_vad.onnx`
- `SherpaNcnn — sherpa ncnn 后端流式识别 JNI 封装：encoder/decoder/joiner param+bin 六文件配置，useGPU 默认开`
- `Uuid — java.util.UUID 薄包装：ExperimentalUuidApi 实验性 API（包名与文件路径不一致）`
- `MainActivity（tools/shower）— 示例工程壳：onCreate 调 Main.start(this) 拉起投屏服务端`
- `ExampleInstrumentedTest（tools/shower）— 示例代码：断言包名 com.ai.assistance.shower 的插桩测试占位`
- `ShowerTheme（tools/shower Theme.kt）— 示例代码：与模板同构的 Material3 主题函数`
- `Color.kt（tools/shower）— 示例代码：与模板同构的两套配色定义`
- `Type.kt（tools/shower）— 示例代码：与模板同构的排版定义`
- `ExampleUnitTest（tools/shower）— 示例代码：2+2=4 占位本地单测`

## 调用链

1. **投屏服务端拉起**：`ShowerServerManager.ensureServerStarted`：注册表有活 Binder 直接复用 → `pkill -f com.ai.assistance.shower.Main` 杀旧进程 → 清 `/data/local/tmp` 旧 jar → assets jar 经 `/sdcard/Download/Operit` 中转拷到 `/data/local/tmp`（属主变 shell）→ `CLASSPATH=<jar> app_process / com.ai.assistance.shower.Main` 后台启动 → 轮询 10 秒等 Binder 交接广播。
2. **投屏会话**：`ShowerController.ensureDisplay`（同尺寸复用 displayId，否则重建）→ 二进制帧经 `IShowerVideoSink` 回调 → `ShowerVideoRenderer.onFrame`（AVCC→AnnexB，凑齐 SPS/PPS 后初始化 MediaCodec）→ 渲染到 `ShowerSurfaceView`。
3. **MNN LLM 推理**：`MNNLibraryLoader.loadLibraries()` → `MNNLlmNative` init → `nativeCreateLlm` → `nativeSetConfig`（按 llm_bench.cpp 顺序下发 tmp_path/async/precision/memory/backend_type/thread_num）→ `nativeLoadLlm` → `generate` 流式回调 `onToken`（返回 false 停）→ `release()` 先 `nativeCancel` 再等 `activeCalls` 归零。
4. **新建工程模板**：用户在 Operit 里选模板 → 拷贝 `app/src/main/assets/templates/android|flutter` → 得到 Compose Hello World 骨架工程（含主题/配色/占位测试）。

## 来源

- `llm/mnn/`（10 文件）、`llm/llama/`（3 文件）、`avator/dragonbones/`（2 文件）、`avator/fbx/`（3 文件）、`avator/mmd/`（4 文件）、`quickjs/.../javascript/QuickJsNative*`（3 文件）
- `showerclient/`（6 文件）
- `app/src/main/assets/templates/`（7 文件）、`tools/shower/`（6 文件）
- `app/src/main/java/androidx/compose/foundation/internal/Preconditions.kt`、`app/src/main/java/kotlin/uuid/Uuid.kt`、`app/src/main/java/com/k2fsa/sherpa/`（5 文件）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（v1.12.2）
