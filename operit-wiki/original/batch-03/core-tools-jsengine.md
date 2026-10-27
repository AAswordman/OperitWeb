---
title: JS 引擎与 Java 互操作桥
module: 工具系统
sources: JsEngine.kt, JsJavaBridge.kt, JsJavaBridgeDelegates.kt, JsComposeDslBridge.kt, JsComposeDslRuntimeScript.kt, JsEmbeddedLibraryLoader.kt, JsAssetLoader.kt, JsExternalJavaCodeLoader.kt, JsInitRuntimeScriptBuilder.kt, JsLibraries.kt, JsNativeInterfaceDelegates.kt, JsToolPkgApiRuntime.kt
date: 2026-10-01
---

# JS 引擎与 Java 互操作桥

## 概述

本页覆盖 Operit 工具系统里"跑 JS 代码并让 JS 调用 Java/调工具"的那一层：QuickJS 引擎的生命周期管理、JS 执行会话与超时取消、JS 全局对象 NativeInterface 背后的 Kotlin 方法集、JS↔Java 对象双向桥、18 个 JS bootstrap 模块、Compose DSL 运行时、外部 dex/jar 代码加载。门面类是 `JsEngine`（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:49`），所有 JS 执行都经它进出。

调用方之一是工具包主注册：`executeToolPkgMainRegistrationFunction`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1108`

注册脚本以 `timeoutSec = 12L` 超时执行。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1124`

另一大调用方是 JS 脚本内部，直接调 NativeInterface 上的工具/环境/Java 桥方法。

本页只讲引擎与互操作桥。JS 工具包的执行编排、超时配置、执行轨迹另见兄弟页；Web 会话与用户脚本另见相关页。

## AI 速览

**核心符号清单**

- `JsEngine` — QuickJS 引擎门面：执行脚本、管理会话、超时取消、销毁。
- `ExecutionSession` — 一次 JS 执行的会话对象，持有结果 `CompletableFuture`。
- `JsToolCallInterface` — 挂到 JS 全局 `NativeInterface` 的 `@JavascriptInterface` 方法集。
- `JsJavaBridgeDelegates` — Java 反射桥的 Kotlin 实现（单例）：类加载、方法选择、参数转换、JSON 信封。
- `JsInterfaceBinding` — JS 对象 ↔ Java 弱引用的绑定记录。
- `JsNativeInterfaceDelegates` — `NativeInterface` 上各能力方法的实现：调工具、解压、加解密、图片处理、环境变量等。
- `JsBootstrapModule` — bootstrap 模块描述（文件名/源码/导出全局变量名）。
- `buildComposeDslContextBridgeDefinition` / `OperitComposeDslRuntime` — Compose DSL 的 JS 运行时模板。
- `buildComposeDslRuntimeWrappedScript` — 把用户 DSL 脚本包成可执行模块。
- `JsExternalJavaCodeLoader` — 外部 dex/jar 的隔离加载器。
- `buildInitRuntimeModule` — 6 个基础 bootstrap 模块的生成器。
- `loadPakoJs` / `loadCryptoJs` / `loadJimpJs` — 内嵌第三方 JS 库的 assets 加载函数。
- `buildToolPkgApiRuntimeScript` — `__operitToolPkgApi` 运行时的模板入口。

**主入口**

- `executeScriptFunction(script, functionName, params, timeoutSec)` — 执行 JS 函数的主入口。
- `executeScriptCode(code, …)` — 直接执行一段 JS 代码。
- Compose DSL 三入口：渲染、派发用户动作、重渲染（三个都把超时设为 null，即无限等待）。
- `invokeJavaBridgeJsObjectCallbackSync(…)` — Java 侧同步回调 JS（工作线程等最多 30 秒）。

**数据流向一句话**

JS 脚本跑在独立的 QuickJS 线程里；凡是调 Java、调工具、读写环境的操作，都经过 JS 全局 `NativeInterface` 上的 `@JavascriptInterface` 方法落到 Kotlin 侧；结果按 JSON 信封（`success`/`data`/`message`）或注册表句柄回到 JS。

## 核心机制

### 1. 引擎生命周期：单例 QuickJS + 独立线程

- `ensureQuickJs()` 用 `synchronized(quickJsInitLock)` 双重检查：只有第一次真正建引擎。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:178`
- 引擎实例化后立刻 `bindNativeInterface(toolCallInterface)`，把工具调用接口挂到 JS 全局 `NativeInterface`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:190`
- `initJavaScriptEnvironment()` 同样用 `quickJsInitLock` 加锁，并用 `jsEnvironmentInitialized` 标记保证 18 个 bootstrap 模块只注入一次。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:759`
- `destroy()` 是统一收尾入口。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2701`
- 收尾先 `engine.interrupt()` 中断正在跑的 JS。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2719`
- 再 `engine.close()` 释放引擎。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2745`
- 然后 `quickJsDispatcher.close()` 关协程调度器，`quickJsExecutor.shutdownNow()` 停线程池。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2753`

### 2. JS 执行会话：调用 ID → 会话 → future 等结果

- 每次调用先 `nextExecutionCallId()` 生成 `operit_call_` + UUID 的调用 ID。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:331`
- `createExecutionSession()` 创建会话对象。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:334`
- 会话内含 `CompletableFuture` 结果槽。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:346`
- 主入口是 `executeScriptFunction`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:788`
- 默认超时取 `JsTimeoutConfig.MAIN_TIMEOUT_SECONDS`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:795`
- 会话登记进 `activeExecutionSessions`，供回调与取消按 callId 找回。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:881`
- 超时前按 `PRE_TIMEOUT_LEAD_SECONDS` 提前量先发取消信号，给 JS 收尾机会。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:891`
- `cancelExecutionSessionInJs(callId, failureReason)` 往 JS 里注取消标记。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1018`
- 调用方在 `session.future.get(…)` 上等结果；超时或中断时先 `interruptQuickJs` 中断引擎再收尾。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:986`
- 直接执行代码走 `executeScriptCode`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1036`
- 它把代码包成 `DIRECT_SCRIPT_EXECUTION_FUNCTION` 指定的函数再调主入口。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1050`
- 该常量值是 "__operit_run_inline_code__"。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:55`

### 3. NativeInterface：JS 调 Kotlin 的方法门

- NativeInterface 全局对象背后是 `JsToolCallInterface` 的 `@JavascriptInterface` 方法集。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1566`
- `decompress(data, algorithm)` 转调 `JsNativeInterfaceDelegates.decompress`，支持 gzip/deflate/raw 三种算法。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1595`
- `javaClassExists(className)` 只做存在性探测，不加载类。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2126`
- `javaLoadDex(dexPath)` 把外部 dex 载入隔离的类加载器。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2134`
- `javaLoadJar(jarPath)` 同理加载外部 jar。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2143`
- `javaGetApplicationContext()` 把应用 Context 经 `exposeJavaObject` 包装成 Java 对象句柄交给 JS。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2157`
- `javaGetCurrentActivity()` 同理暴露当前 Activity。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2164`
- `javaNewInstance(className, argsJson)` 经 `JsJavaBridgeDelegates.newInstance` 做构造。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2178`
- `javaCallStatic(className, methodName, argsJson)` 经 `JsJavaBridgeDelegates.callStatic` 调静态方法。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2189`
- `javaCallInstance` 调实例方法（`JsJavaBridgeDelegates.callInstance`）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2201`
- `javaCallStaticSuspend` 调挂起静态方法（协程）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2213`
- `javaCallInstanceSuspend` 调挂起实例方法（协程）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2233`
- `javaGetStaticField` 读静态字段（另有 has/get 系列做字段/方法存在性探测）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2253`
- `javaPollPendingJsCallback()` / `javaResolvePendingJsCallback(…)` 配合做 Java→JS 同步回调。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2305`
- `invokeJavaBridgeJsObjectCallbackSync` 在工作线程用 `request.future.get(30, TimeUnit.SECONDS)` 等 JS 回调，最多 30 秒；主线程调用会被 `Looper` 检查直接拒绝。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:635`
- `callTool(toolType, toolName, paramsJson)` 经 `JsNativeInterfaceDelegates.callToolSync` 同步调工具。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2413`
- 工具解析与执行在 `parseToolCall` 之后由 `toolHandler.executeTool(parsed.aiTool)` 直接执行。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:690`
- `callToolAsync` 是异步版本。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2427`
- `callToolAsyncStreaming` 是流式版本。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2449`
- `sendCallIntermediateResult(callId, resultJson)` 给流式调用推送中间结果。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2395`
- `setCallResult(callId, result)` 由 JS 回填调用结果。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2524`
- `setCallError(callId, error)` 由 JS 回填调用错误。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2548`
- 内部 `completeCallFuture` 完成对应会话的 future。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2586`
- `reportErrorForCall(callId, errorJson)` 上报 JS 侧错误。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:2677`

### 4. Bootstrap：6 个基础模块 + 12 个能力模块

- `buildInitRuntimeModule()` 生成 6 个基础模块：环境目录常量、调用注册表、错误上报，以及 toolCall 系列门面。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsInitRuntimeScriptBuilder.kt:5`
- `runtimeBootstrapModules()` 把各模块逐个 `evaluateBootstrapModule` 求值注入 JS 环境。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:767`
- 12 个能力模块逐个声明文件名与导出全局：
  - `execution-runtime.js` 提供执行期基础能力。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:21`
  - `toolpkg-bridge.js` 导出全局 `ToolPkg`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:25`
  - `tools.js` 导出全局 `Tools`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:30`
  - `compose-dsl-bridge.js` 导出 `OperitComposeDslRuntime`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:35`
  - `java-bridge.js` 导出 `Java` / `Kotlin`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:40`
  - `third-party-libs.js` 导出 `_`、`dataUtils`、`Icons` 等。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:45`
  - `CryptoJS.js` 导出 `CryptoJS`（内嵌库）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:50`
  - `Jimp.js` 导出 `Jimp`（内嵌库）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:55`
  - `UINode.js` 导出 `UINode`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:60`
  - `AndroidUtils.js` 导出 `Android`、`Intent`、`PackageManager`、`ContentProvider`、`SystemManager`、`DeviceController`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:70`
  - `OkHttp3.js` 导出 `OkHttpClientBuilder`、`OkHttpClient`、`RequestBuilder`、`OkHttp`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:80`
  - `pako.js` 提供 gzip 压缩能力。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:87`

### 5. JS↔Java 对象桥：代理 + 句柄 + JSON 信封

- `buildJavaBridgeJs()` 生成 JS 侧桥模板。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt:3`
- `invokeBridge(methodName, args)` 按方法名查 `NativeInterface` 并 `apply` 调用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt:482`
- `newJavaProxy(interfaceName, jsObjectId)` 为 JS 对象建 Java 动态代理。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt:50`
- `createJsInterfaceObject(jsObjectId)` 在内部映射表登记 JS 接口对象。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt:53`
- `createInstanceProxy(className, handle)` 给 Java 实例建带缓存方法表的 JS 代理。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt:772`
- Kotlin 侧 `JsJavaBridgeDelegates` 是单例对象。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:29`
- 对象句柄标记统一用 `__javaHandle` / `__javaClass` / `__javaJsInterface` / `__javaJsObjectId` / `__javaInterfaces` 五个 key。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:33`
- `JsInterfaceBinding` 记录 `jsObjectId` 与接口名表 `interfaceNames`，供建 Java 动态代理时回调 JS。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:70`
- 代理释放由 `jsInterfaceProxyReferenceQueue` 配合后台线程处理。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:615`
- 后台线程名为 "OperitJsInterfaceRelease"。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:627`
- 桥调用统一走 `runBridgeCall` 包 try/catch。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:718`
- 成功结果包成 `JSONObject` 信封（`success`=true、`data`=载荷）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:875`
- 失败信封是 `success`=false、`message`=错误描述。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:880`
- `loadClass(className)` 按名加载类。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:887`
- `decodeJsonValue` 把 JSON 值转成对应 Java 类型。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:964`
- `toJsonCompatibleValue` 把 Java 返回值转成 JSON 兼容结构。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:1038`
- `selectMethod` 做方法重载选择。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:1290`
- `selectConstructor` 做构造器重载选择。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:1231`
- `createJsInterfaceProxyFromMap` 按方法映射表建代理。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:1665`
- `findStaticFallbackInstance` 找不到静态方法时回退找 `Companion` / `INSTANCE`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:2022`
- 挂起调用用 `AtomicBoolean` 防重复恢复。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:832`
- 协程挂起标记是 `COROUTINE_SUSPENDED`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:852`

### 6. NativeInterface 能力 delegates

- `callToolSync(toolHandler, toolType, toolName, paramsJson, …)` 是同步工具调用的完整签名。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:674`
- 异步版本用裸 `Thread{}.start()` 起线程，没有线程池。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:731`
- 流式版本同样裸 `Thread` 起线程。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:784`
- `buildToolResultCallbackScript` 拼结果回调脚本（手工转义反斜杠、引号、换行、回车四字符）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:832`
- 字符串结果走 `buildStringResultCallbackScript`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:863`
- 回调脚本通过 window 上的全局函数把结果回传给 JS 调用方。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:832`
- 二进制工具结果超 `binaryDataThreshold` 时不进 JSON，改给 `@binary_handle:` 句柄。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:152`
- `decompress` 解 gzip/deflate/raw。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:627`
- 解压失败返回 `{"nativeError":…}` 字符串，调用方需自行识别（不是抛异常）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:670`
- `imageProcessing` 做图片变换。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:881`
- 它用裸 `Thread` 起线程。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:890`
- `crypto` 提供 AES 加解密。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:1043`
- 其中解密用 `AES/ECB/NoPadding` 变换。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:1066`
- `callToolPkgWasm` 调用 WASM 工具包。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:510`
- 文本测量用 `StaticLayout` 按 `maxWidth` / `maxLines` 排版。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:592`
- `setEnv` 经 `EnvPreferences` 持久化写环境变量（空值删除）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:227`

### 7. 外部 Java 代码加载：隔离 + 只读 + 校验

- `loadDex` / `loadJar` 加载外部 dex/jar。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:104`
- 用 `getEffectiveClassLoader()` 决定父加载器。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:99`
- `listLoadedArtifacts()` 列出已加载产物。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:114`
- 隔离用 `PrefixIsolatedDexClassLoader` 做前缀隔离。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:171`
- 加载后文件被设 `setReadOnly()`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:279`
- 可写文件直接拒绝加载（必须只读）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:294`
- `ensureJvmCompatibilitySystemProperties()` 设置 JVM 兼容系统属性。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:300`
- 校验 `os.name` 含 Linux。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:308`
- 产物做 SHA-256 校验。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:353`

### 8. Compose DSL：在 JS 里写声明式 UI

- 模板定义 `OperitComposeDslRuntime`（IIFE 立即执行函数）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:5`
- `createContext(runtimeOptions)` 建渲染上下文。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:186`
- `createNode(type, props, children)` 建节点。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:304`
- 节点统一打 `__composeNode` 标记。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:321`
- `useState(key, initialValue)` 做状态管理。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:334`
- `createWebViewController` 控制 WebView。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:409`
- `MaterialTheme` 提供主题令牌。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:624`
- `uiProxy` 是 UI 代理。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:635`
- `callTool` 供 DSL 脚本直接调工具。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:650`
- `navigate` 做页面导航。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:674`
- `buildComposeDslRuntimeWrappedScript(script)` 把用户脚本包成可执行模块。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:3`
- `__operitResolveComposeEntry` 解析入口（支持 `module.exports.default`）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:40`
- 渲染入口是 `__operit_render_compose_dsl`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:72`
- 重渲染入口是 `__operit_rerender_compose_dsl`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:104`
- 动作派发入口是 `__operit_dispatch_compose_dsl_action`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:132`
- 中间渲染走 `__operit_process_intermediate_queue` 防抖队列（一次只跑一个）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:226`
- 引擎侧渲染：调 `__operit_render_compose_dsl`，`timeoutSec = null` 无限等。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1139`
- 引擎侧动作：调 `__operit_dispatch_compose_dsl_action` 并传 `__action_payload`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1164`
- 动作 ID 经 `__action_id` 传。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1158`
- 引擎侧重渲染：调 `__operit_rerender_compose_dsl`，同样 `timeoutSec = null`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1178`

### 9. ToolPkg API 运行时

- `buildToolPkgApiRuntimeScript()` 是模板入口。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgApiRuntime.kt:3`
- 运行时挂到全局 `__operitToolPkgApi`（经 `expose` 注册）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgApiRuntime.kt:194`
- `since(apiVersion, invoke)` 做版本门控。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgApiRuntime.kt:162`

### 10. 内嵌库加载

- `loadPakoJs` / `loadCryptoJs` / `loadJimpJs` 从 assets 读内嵌第三方库。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEmbeddedLibraryLoader.kt:5`
- 底层 `loadEmbeddedLibrary(context, assetPath)` 读 assets 文件。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEmbeddedLibraryLoader.kt:11`

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `JsEngine` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:49` | QuickJS 引擎门面类 |
| `ExecutionSession` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:86` | JS 执行会话（持有结果 future） |
| `JsToolCallInterface` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1566` | NativeInterface 背后的 `@JavascriptInterface` 方法集 |
| `JsJavaBridgeDelegates` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:29` | Java 反射桥单例 |
| `JsInterfaceBinding` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:70` | JS 对象弱引用绑定 |
| `JsNativeInterfaceDelegates` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt:50` | NativeInterface 能力 delegates 单例 |
| `JsBootstrapModule` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:5` | bootstrap 模块描述 |
| `OperitComposeDslRuntime` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:5` | Compose DSL 的 JS 运行时 |
| `buildComposeDslRuntimeWrappedScript` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:3` | DSL 脚本打包函数 |
| `loadEmbeddedLibrary` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEmbeddedLibraryLoader.kt:11` | 内嵌库 assets 加载函数 |
| `JsExternalJavaCodeLoader` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt:59` | 外部 dex/jar 隔离加载器 |
| `buildInitRuntimeModule` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsInitRuntimeScriptBuilder.kt:5` | 6 个基础模块生成器 |
| `buildToolPkgApiRuntimeScript` | `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgApiRuntime.kt:3` | ToolPkg API 运行时模板入口 |

## 调用链

### 链路 1：执行一段 JS 脚本

1. 输入：调用 `executeScriptFunction(script, functionName, params, timeoutSec)`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:788`
2. 处理：`nextExecutionCallId()` 生成调用 ID。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:331`

   `createExecutionSession()` 建会话。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:334`

   会话登记进 `activeExecutionSessions`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:881`

   `launchQuickJsFunctionCall` 把调用抛到 QuickJS 线程执行。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:300`
3. 输出：调用方在 `session.future.get(…)` 上等结果；超时先 `interruptQuickJs` 中断引擎。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:986`

   再 `cancelExecutionSessionInJs` 取消 JS 侧。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1018`

入口函数名字符串是 "__operitExecuteScriptFunction"（定义在兄弟页种子 `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:5`）。

### 链路 2：JS 调 Java 静态方法

1. 输入：JS 侧 `invokeBridge` 按名找到 NativeInterface 的对应方法并调用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt:482`
2. 处理：`JsToolCallInterface.javaCallStatic` → `JsJavaBridgeDelegates.callStatic` → `runBridgeCall` 包 try/catch 执行。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:718`

   `loadClass` 按名加载类。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:887`

   `selectMethod` 做方法重载选择。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:1290`
3. 输出：成功回 `success`/`data` 信封。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:875`

   失败回 `success`/`message` 信封；JS 侧解析信封后返回或抛错。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt:880`

### 链路 3：Compose DSL 渲染

1. 输入：调用 `executeComposeDslScript(script, …)`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1132`
2. 处理：`buildComposeDslRuntimeWrappedScript` 包裹脚本。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:3`

   调 `__operit_render_compose_dsl`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1139`

   模板内 `__operitResolveComposeEntry` 找入口。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt:40`

   `createContext` 建渲染上下文。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt:186`
3. 输出：返回渲染结果给 Kotlin 侧转成 Compose 树。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1139`

   用户点击触发 `executeComposeDslAction`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1146`

   动作经 `__operit_dispatch_compose_dsl_action` 派发。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt:1164`

## 关联条目

- [[core-tools-jstools|JS 工具执行与超时]] — JS 工具包的执行编排、超时配置与执行轨迹。
- [[core-tools-websession-userscript|Web 会话与用户脚本]] — WebView 会话与用户脚本注入。
- [[core-tools|工具系统总览]] — 工具系统的整体结构。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEngine.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridge.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsJavaBridgeDelegates.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslBridge.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsComposeDslRuntimeScript.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsEmbeddedLibraryLoader.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsAssetLoader.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExternalJavaCodeLoader.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsInitRuntimeScriptBuilder.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsNativeInterfaceDelegates.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgApiRuntime.kt`
