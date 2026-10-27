---
title: JS 工具脚本执行与注册
module: core
sources: 9
date: 2026-10-01
---

# JS 工具脚本执行与注册

## 概述

- 本页覆盖 `core/tools/javascript/` 下的 9 个文件：JS 工具如何被注册为模型可调用工具、脚本执行上下文的组装方式、执行结果的判定协议、超时与追踪机制。
- 一句话：JS 工具包（toolpkg）的主模块脚本在**注册模式**下跑一遍，把要注册的工具、UI、钩子等写成规范化的 JSON 清单；调用时把参数、脚本、前奏函数拼进 `__operitExecuteScriptFunction` 这个 JS 入口，由 [[core-tools-jsengine|JS 引擎与桥接]] 执行，结果按 `{success, message, data}` 协议回传。
- 引擎与 Java 桥接层（NativeInterface、模块加载、会话管理）不在本页范围，见 [[core-tools-jsengine|JS 引擎与桥接]]；工具注册到模型提示词的全链路见 [[core-tools-registry|工具注册与执行框架]]。

## AI 速览

- **核心符号**：`JsToolManager`（调度单例）、`JsExecutionScriptBuilder`（执行脚本组装）、`buildToolPkgRegistrationBridgeScript()`（注册桥接脚本）、`TOOLPKG_EXECUTION_ENTRY_FUNCTION`（JS 入口函数名 `__operitExecuteScriptFunction`）、`JsExecutionResultProtocol`（结果判定）、`JsToolPkgRegistrationSession`（注册捕获会话）、`JsToolPkgExecutionContext`（日志上下文）、`ScriptExecutionReceiver`（广播触发执行）、`JsTimeoutConfig`（超时常量）。
- **主入口**：`JsToolManager.executeScript(script, tool)`（流式，冒号名 `packageName:toolName`）与 `executeScript(toolName, params)`（同步，点名 `packageName.functionName`）；注册入口是 `buildToolPkgRegistrationBridgeScript()` 在 JS 全局安装的 `ToolPkg` 对象。
- **数据流向一句话**：调用者给 `包名:工具名` 与参数 → `JsToolManager` 做参数类型转换与运行时参数注入 → `JsExecutionScriptBuilder` 把前奏+脚本拼成入口函数文本 → 引擎执行，`setCallResult/setCallError` 回传 → 结果协议判定 success → `ToolResult` 或错误字符串返回。

## 核心机制

### 超时配置（JsTimeoutConfig）

- `MAIN_TIMEOUT_SECONDS = 1800L`：单个脚本最长执行 30 分钟。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTimeoutConfig.kt:4`
- `PRE_TIMEOUT_LEAD_SECONDS = 5L`：正式超时前 5 秒先触发预警定时器。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTimeoutConfig.kt:5`
- `SCRIPT_TIMEOUT_MS` 与 `TOOL_CALL_TIMEOUT_MS` 都等于主超时换算的毫秒值：单次工具调用最长也可占引擎 30 分钟。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTimeoutConfig.kt:6`

### 结果协议（JsExecutionResultProtocol）

- 失败载荷统一形如 `{"success": false, "message": ...}`，由 `buildJsExecutionErrorPayload(message)` 生成。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionResultProtocol.kt:11`
- `extractJsExecutionFailure(raw)` 判定脚本执行是否失败：空串、非 JSON 对象、没有 `success` 键、`success=true` 都返回 null（表示成功）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionResultProtocol.kt:17`
- 判定为失败时提取 `message`（trim 后）与 `data`（转字符串），装入 `JsExecutionFailure(message, dataText)`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionResultProtocol.kt:6`
- `decodeJsExecutionResultValue(raw)`：非字符串原样返回；空串转为 `JSONObject.NULL`（对应 JS 的空返回变 JSON null）；其余用 `JSONTokener` 解析。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionResultProtocol.kt:49`

### 执行调度（JsToolManager）

- `JsToolManager` 是私有构造的单例，`getInstance(context, packageManager)` 用双重检查保证唯一。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:18`
- `MAX_CONCURRENT_ENGINES = 4`：引擎池固定 4 个引擎实例。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:29`
- 4 个 `JsEngine` 实例放入 `Channel`；`withEngine` 借出执行，finally 中归还。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:46`
- 同步入口 `executeScript(toolName, params)` 用点名形式 `packageName.functionName`（按最后一个 `.` 切分）；流式入口 `executeScript(script, tool)` 用冒号形式 `packageName:toolName`（按第一个 `:` 切分）。两个入口的切分规则不对称，分隔符在首尾时返回 null。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:65`
- `buildRuntimeParams` 组装运行时参数：写入包状态、清理空白调用者键、注入包名。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:81`
- `__operit_package_state` 注入包状态 id。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:87`
- `__operit_package_name` 注入包名，并强制 `__operit_toolpkg_runtime_kind = "sandbox"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:104`
- 调用者三键（`__operit_package_caller_name` / `__operit_package_chat_id` / `__operit_package_caller_card_id`）只保留非空值，空值直接移除。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:95`
- 子包运行时额外注入：`__operit_execution_context_key = "toolpkg_main:<容器包名>"`、`__operit_toolpkg_subpackage_id`、`containerPackageName`、`toolPkgId`、`__operit_ui_package_name`、`__operit_script_screen`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:110`
- 子包的执行引擎按 `contextKey` 隔离（`packageManager.getToolPkgExecutionEngine("toolpkg_main:<容器包名>")`），普通包走共享池。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:131`
- 参数类型严格转换：`convertToolParameters` 缺必填参数抛 `ToolParameterConversionException("Missing required parameters: ...")`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:151`
- `convertToolParameterValue` 按 manifest 类型严格转换单个参数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:188`
- 转换规则：`number`（无小数点/无 e 转 Long，否则 Double）、`integer` 转 Long、`boolean`（`"true"/"1"`→true，`"false"/"0"`→false）、`array`/`object` 走 JSON 解析；未知类型原样透传字符串。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:200`
- 流式入口用 `withTimeout(SCRIPT_TIMEOUT_MS)` 包裹引擎调用（Kotlin 侧超时）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:393`
- 超时捕获 `TimeoutCancellationException`，返回 `"Script execution timed out after ...ms"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:409`
- 同步入口 `executeScript(toolName, params)` 的错误以字符串返回：名格式错是 `"Invalid tool name format ... Expected format: packageName.functionName"`，包缺失是 `"Package not found: ..."`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:320`
- 异常时返回 `buildJsExecutionErrorPayload` 的载荷。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:346`
- 流式入口挂 `JsExecutionListener`：`onCallLog` 转成 kind=log 的追踪数据实时发出。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:369`
- `onIntermediateResult` 转成 kind=intermediate 的追踪数据，经 `trySend` 实时发出。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:381`
- 结果先经结果协议判失败：命中则返回携带 `dataText` 的失败 `StringResultData`，否则成功返回值的字符串形式（空则为 "null"）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:295`
- `executeComposeDsl` 组装 `runtimeOptions`（包名/ui 模块 id/工具包 id/状态/备忘/模块规格）后走共享引擎池。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:428`
- `destroy()` 关闭引擎 Channel 并逐个销毁引擎。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:473`

### 执行脚本组装（JsExecutionScriptBuilder）

- `TOOLPKG_EXECUTION_ENTRY_FUNCTION = "__operitExecuteScriptFunction"`：JS 侧执行入口的全局函数名。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:5`
- `buildExecutionPreludeSource()` 生成执行前奏源码：一批调用运行时的前奏函数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:6`
- 前奏函数：`sendIntermediateResult`、`emit`、`delta`、`log`、`update`、`done`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:38`
- 前奏函数：`getEnv`、`getPluginConfigDir`、`getState`、`getLang`、`getCallerName`、`getChatId`、`getCallerCardId`、`__handleAsync`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:48`
- 前奏还定义 `console` 对象、`reportDetailedError` 错误上报函数与 `ToolPkg` 引用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:57`
- 前奏把 `Java`、`Android`、`Intent`、`PackageManager`、`ContentProvider`、`SystemManager` 引入脚本作用域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:66`
- 前奏把 `DeviceController`、`OperitComposeDslRuntime`、`CryptoJS`、`Jimp`、`UINode` 引入脚本作用域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:72`
- 前奏把 OkHttp 系列、`pako`、`_`、`dataUtils`、`toolCall` 引入脚本作用域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:77`
- `buildExecutionRuntimeBridgeScript()` 安装入口时先判重：root 上已存在同名函数直接返回，避免重复安装。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:91`
- 入口签名：`__operitExecuteScriptFunction(callId, params, scriptText, targetFunctionName, timeoutSec, preTimeoutMs, toolPkgApi)`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:400`
- 入口先要求 `__operitRegisterCallSession` 存在，否则经 `NativeInterface.setCallError` 返回 `"JS execution runtime bridge is unavailable"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:410`
- JS 侧双层超时：`safeTimeoutSec = max(1, timeoutSec||1)`，`preTimeoutMs` 到时先设最终安全定时器，5 秒后再真正 `emitError("Script execution timed out after X seconds")`——与 Kotlin 侧 withTimeout 形成双保险。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:424`
- `finalizeCall`：清掉两个安全定时器，恢复上一个调用的 call id 与 call runtime。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:473`
- 最后调 `__operitCleanupCallSession(callId)` 清理调用会话。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:493`
- 结果上报：成功经 `NativeInterface.setCallResult(callId, resultText)`，失败经 `NativeInterface.setCallError(callId, {"success": false, message})`，上报后标记 completed 防重复。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:505`
- `complete(value)` 对返回值做 `serializeOrThrow(normalizeComposeResult(value))`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:567`
- 序列化失败上报 `"Result serialization failed: ..."`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:578`
- `handleAsync(value)`：值不是 Promise 时返回 false；是 Promise 时挂 then/catch，成功走 complete，失败走带详细报告的错误上报。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:582`
- then 成功分支调 `complete(result)`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:589`
- 中间结果：`emit`、`delta`、`log`、`update`、`sendIntermediateResult` 统一映射到同一个中间结果发送函数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:612`
- `emitIntermediate` 经 `NativeInterface.sendCallIntermediateResult(callId, safeSerialize(value))` 发出。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:562`
- 前奏提供 `getEnv`、`getState`、`getLang` 三个取值函数（环境变量、包状态、语言，语言缺省 "en"）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:46`
- `getEnv` 的实现经 `NativeInterface.getEnvForCall(callId, key)` 取环境变量。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:619`
- `getState` 的实现读 `__operit_package_state` 调用参数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:641`
- console 的 log/info/warn/error 被重定向为 `NativeInterface.logInfoForCall` 等调用日志接口。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:649`
- 防爆序列化 `normalizeSerializableValue`：循环引用、bigint、function 与 Java 对象分别做安全转换。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:130`
- 带 `__javaHandle`/`__javaClass` 标记的 Java 对象只透传句柄与类名。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:120`
- 模块解析候选路径：原路径、+`.js`、+`.json`、+`/index.js`、+`/index.json`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:255`
- `require('lodash')`→`root._`、`require('uuid')`→v4 垫片。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1266`
- `require('axios')`→经 `toolCall('http_request')` 的垫片；非相对路径返回空对象。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1283`
- 工厂缓存键为 `kind:identity:源码长度:hash`，模块实例有独立缓存键；脚本工厂用 `new Function('module','exports','require','__operit_call_runtime', 前奏源码 + 脚本源码)` 创建，注入 CommonJS 风格参数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:287`
- `ToolPkg.ipc.call` 的 `targetRuntime` 只能是 main/ui/sandbox/provider 之一；同上下文 main→main 走本地直调，否则经 `NativeInterface.invokeToolPkgIpcAsync` 异步跨运行时调用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:843`
- `ToolPkg.wasm.call(moduleId, exportName, args)`：参数类型只允许 i32/i64/f32/f64（i64 超大数必须传字符串），经 `NativeInterface.callToolPkgWasm` 调用，结果解码处理 NaN/Infinity 字符串。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1152`
- 主流程阶段打点：`compile_main_script` → `execute_main_script`，复用时记 reuse_main_script。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1327`
- 目标函数按 `exports` → `module.exports` → 全局顺序查找。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1364`
- 目标函数找不到时上报 `"Function '<name>' not found in script. Available functions: ..."` 并列出可用函数名。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1369`
- 内联钩子：`__operit_inline_function_name` + `__operit_inline_function_source` 经 `eval('(' + source + ')')` 求值，必须是函数否则抛错，结果写入 `rootExports` 与 `module.exports`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1356`
- 注册模式（`__operit_registration_mode=true`）下模块缓存每次 fresh。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:671`
- `.ui.js` 模块 require 时返回占位函数而非真实执行。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:1297`
- 运行时种类判定：显式参数优先；`executionContextKey` 以 `toolpkg_provider:` 开头→provider；有子包 id→sandbox；否则 main。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:715`
- `composeDsl.screen` 必须是带模块路径标记的函数，传字符串路径直接抛 `"composeDsl.screen must be a compose_dsl screen function, not a string path"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:361`

### 工具包注册（JsToolPkgRegistration）

- `ToolPkgMainRegistrationCapture` 是包主模块注册的最终产物：23 个注册桶列表。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:10`
- 另带 `marketOrigin` 字段记录包市场来源。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:34`
- 另带 `marketOrigin`（市场来源标记）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:34`
- `RegistrationBucket` 枚举定义 23 个注册桶：UI 工具箱、UI 路由、导航入口、桌面小组件、应用生命周期、消息处理、XML 渲染、输入菜单、聊天输入/视图/消息、聊天消息菜单项、聊天运行时钩子、工具生命周期、6 种 prompt 钩子、摘要生成、AI 供应商。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:37`
- `JsToolPkgRegistrationSession.begin()` 在锁内重置捕获表与 `marketOrigin`；`isActive()` 判捕获表非空；`end()` 清空两者。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:69`
- `normalizeRegistrationSpec` 要求注册载荷非空且为 JSON 对象，否则抛异常；存储前用 `parsed.toString()` 做规范化。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:199`
- `finish(executionResult)` 先用 `extractJsExecutionErrorMessage` 检查脚本错误，有错直接抛 `IllegalStateException`（已捕获的注册项随 `end()` 丢弃——整包注册是原子性的）；无错则按桶组装 `ToolPkgMainRegistrationCapture`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:144`
- `captureMarketOrigin`：会话未激活时直接返回（注册后重复求值无害）；激活时用 `ToolPkgMarketOriginCodec.parse` 解析来源标记。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:133`
- `buildToolPkgRegistrationBridgeScript()` 生成桥接脚本，在 JS 全局安装 `ToolPkg` 对象（经 `__operitToolPkgApi.namespace('ToolPkg', ...)`）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:208`
- 桥接脚本的 `requireNative(name)`：`NativeInterface` 上缺该函数时抛 `'NativeInterface.<name> is unavailable'`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:225`
- 市场来源标记是 XOR 混淆的字节数组：JS 侧 `captureMarketOrigin` 校验 key 与每个字节均为 0–255 整数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:252`
- 逐字节异或还原 JSON 后调 `captureToolPkgMarketOrigin`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:264`
- 注册的函数引用必须是可持久化的：已导出函数按导出名引用；未导出的要求函数带 `__operit_toolpkg_module_path` + `__operit_toolpkg_export_name` 标记，否则抛错。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:360`
- 未导出函数生成 `__operit_module_ref_hook_<id>_<序号>` 形式的延迟引用名。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:303`
- `function_source` 源码在调用时才 require 对应模块并取导出函数。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:388`
- `registerChatMessageMenuItem` 与 `registerChatRuntimeHook` 用 `toolPkgApi.method().since('1.0.1')` 做版本门控，旧版 API 运行时不可用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:629`
- AI 供应商的四个嵌套函数字段 `listModels`、`sendMessage`、`testConnection`、`calculateInputTokens` 逐一规范化为可持久化引用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:420`
- `registerAiProvider` 负责上述规范化。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:661`
- 16 种钩子注册（应用生命周期、消息处理、XML 渲染、输入菜单、聊天输入/视图/消息、工具生命周期、6 种 prompt、摘要生成）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:643`
- 统一经 `registerWithNative` 做 JSON 规范化后注册。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:527`

### 执行上下文与日志装饰（JsToolPkgExecutionContext）

- `LogSnapshot(pluginTag, functionName, codeSnippet)` 为一次执行抓取日志快照；`capture(script, functionName, params)` 解析插件标签、trim 函数名、截取代码片段。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:5`
- `withPluginTag` 给日志消息加 `[tag]` 前缀，已带前缀则去重不重复加。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:28`
- `withCodeContext` 在消息后追加 `"Execution Function"` 与 `"Code Context"` 代码上下文。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:33`
- `withTemporaryTextResourceResolver(resolver, block)` 在 `synchronized` 块内临时替换文本资源解析器，finally 中恢复旧值。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:50`
- `resolveTemporaryTextResource`：无解析器直接返回 null；解析器抛异常时回调 `onResolverFailure` 并返回 null。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:65`
- 标签解析优先级：`params` 的 `__operit_plugin_id` → `pluginId` → `hookId`，取不到则回退 `函数名:包名`；函数名为空时用 `"runtime"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:81`
- 代码片段截取用 6 种正则定位函数定义行（`function` 声明、对象方法、箭头/赋值函数、`exports`/`module.exports`），输出 `anchorLine=` 行号加前后各 6 行，上限 2200 字符。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:119`
- `compactTag` 压缩标签：取路径最后一段，去掉 `_bundle` 与 `.toolpkg` 后缀，空白则回退 `"runtime"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt:143`

### 执行追踪（JsExecutionTrace）

- `JsExecutionListener` 是 internal 接口，`onCallLog`/`onIntermediateResult`/`onCompleted`/`onFailed` 四个回调全部有默认空实现。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:16`
- `JsExecutionTraceRecorder(scriptPath, functionName, paramsJson, envFilePath)` 记录开始时间戳，用 `@Synchronized` 保护事件列表。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:23`
- `onCallLog` 记录 `"LEVEL: message"`：级别转大写、消息做空白折叠，空消息丢弃。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:33`
- `onIntermediateResult` 记录 `"intermediate: <摘要>"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:47`
- `onCompleted` 记录 `"completed: <摘要>"`；`onFailed` 记录 `"failed: <错误>"`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:59`
- `buildResultData` 组装追踪结果数据。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:84`
- 结果为 `SandboxScriptExecutionResultData`：`durationMs = finishedAtMs - startedAtMs`，error 仅非空保留。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:98`
- `writeTo(file, payload)` 自动创建父目录，以 UTF-8 写入 pretty-print 的 JSON 追踪文件。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:111`
- 防爆摘要 `summarizeValue`：字符串折叠空白后截断 240 字符；容器递归深度上限 2；数组取前 3 项加 `"+N more"`；Map 取前 4 个键值对。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:158`

### 广播触发的脚本执行（ScriptExecutionReceiver）

- `ScriptExecutionReceiver` 是 `BroadcastReceiver`，监听 `ACTION_EXECUTE_JS = "com.ai.assistance.operit.EXECUTE_JS"` 广播。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:27`
- 三种执行模式：`function`（默认）、`script`（整文件执行）、`code`（内联代码执行）。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:41`
- `function` 模式需文件路径与函数名，函数名缺省为 "main"。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:58`
- `onReceive` 是广播入口。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:45`
- 用 `goAsync()` + `Dispatchers.IO` 协程执行，避免阻塞广播主线程。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:81`
- finally 中必调 `pendingResult.finish()`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:98`
- 参数 JSON 来自 `EXTRA_PARAMS` 或参数文件；去 BOM；空转 `"{}"`；转义引号的传输载荷会被尝试恢复并记 warning。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:32`
- env 文件按 `KEY=VALUE` 解析：跳过空行与 `#` 注释行，值去掉首尾包裹引号；文件不存在记 warning 返回空。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:368`
- 广播执行强制注入 `__operit_toolpkg_runtime_kind = "sandbox"`，即外部触发的脚本一律按沙盒运行时执行。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:224`
- script/code 模式走 `engine.executeScriptCode`，function 模式走 `engine.executeScriptFunction`，两者都以追踪记录器为 `executionListener`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:234`
- 追踪记录器是 `JsExecutionTraceRecorder`。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:158`
- 每次广播执行新建一个 `JsEngine(context)`，不走 JsToolManager 的 4 引擎共享池。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:221`
- 可用 `EXTRA_RESULT_FILE_PATH` 指定结果文件路径。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:38`
- 默认落到测试目录的 js_results 下，文件名由脚本名、函数名与时间戳组成。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:301`
- 按 `EXTRA_TEMP_FILE`、`EXTRA_TEMP_PARAMS_FILE`、`EXTRA_TEMP_ENV_FILE` 三个标记删除临时脚本、临时参数文件、临时 env 文件。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:35`
- 删除发生在 finally 块中。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt:270`

### JS 侧 Tools 门面（JsTools）

- `getJsToolsDefinition()` 返回的 JS 源码定义全局 `var Tools`，是 JS 脚本调用 Android 工具的便捷门面。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:4`
- `Tools` 是按域分组的对象字面量，`Files` 为文件域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:9`
- `Net` 为网络/浏览器域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:168`
- `System` 为系统/蓝牙/终端/音乐域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:589`
- `SoftwareSettings` 域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:953`
- `Tasker`、`UI` 域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1107`
- `Memory` 域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1185`
- `calc` 域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1372`
- `FFmpeg` 域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1375`
- `Workflow` 域。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1394`
- `Chat` 域经 `__operitToolPkgApi.namespace("Tools.Chat", ...)` 构建。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1466`
- 每个便捷方法最终都调 `toolCall("<工具名>", params)`，把 JS 友好的参数组装成工具调用。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:13`
- 参数命名映射：JS 侧驼峰转工具侧蛇形（如 `duration_ms`），布尔值统一转 "true"/"false" 字符串。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:654`
- `browserClick` 只接受单个 options 对象。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:209`
- `browserClick` 要求 `ref` 或 `selector`，不满足直接抛错，不走到 toolCall。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:224`
- `browserFillForm` 要求非空 `fields` 数组。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:339`
- `Tools.Chat` 经 `__operitToolPkgApi.namespace("Tools.Chat", ...)` 构建。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1466`
- `Tools.Chat.call` 用 `.since("1.0.1")` 版本门控。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1528`
- 要求 `functionType` 非空字符串且 `turns` 为数组。`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt:1535`

## 关键符号

| 符号 | 含义 |
| --- | --- |
| `JsToolManager` | JS 工具执行的调度单例：引擎池、参数转换、运行时参数注入、两种 `executeScript` 入口 |
| `JsExecutionScriptBuilder` | 执行脚本组装：前奏源码、运行时桥接脚本（`__operitExecuteScriptFunction`） |
| `TOOLPKG_EXECUTION_ENTRY_FUNCTION` | JS 侧执行入口的全局函数名常量，值为 `__operitExecuteScriptFunction` |
| `buildToolPkgRegistrationBridgeScript()` | 生成注册桥接脚本，在 JS 全局安装 `ToolPkg` 对象 |
| `JsToolPkgRegistrationSession` | 注册捕获会话：`begin`/`append`/`captureMarketOrigin`/`finish`/`end` |
| `ToolPkgMainRegistrationCapture` | 23 个注册桶列表的注册最终产物（另有 marketOrigin 字段） |
| `RegistrationBucket` | 23 个注册桶的枚举（UI/钩子/prompt/AI 供应商等） |
| `JsExecutionResultProtocol` | 结果判定协议：`buildJsExecutionErrorPayload` / `extractJsExecutionFailure` / `decodeJsExecutionResultValue` |
| `JsExecutionFailure` | 失败数据类：`message` + `dataText` |
| `JsTimeoutConfig` | 超时常量：主超时 30 分钟，预警提前 5 秒 |
| `JsExecutionListener` / `JsExecutionTraceRecorder` | 执行事件监听接口与追踪记录器，落盘为 JSON 追踪文件 |
| `JsToolPkgExecutionContext` | 日志上下文装饰：插件标签、代码片段、临时文本资源解析器 |
| `ScriptExecutionReceiver` | `EXECUTE_JS` 广播接收器：function/script/code 三模式执行 |
| `getJsToolsDefinition()` | 生成全局 `Tools` 对象的 JS 源码（Files/Net/System 等 11 个域） |

## 调用链

1. **注册**：工具包主模块脚本在注册模式下执行 → `ToolPkg.registerTool` 等 API 把注册项写成规范化 JSON → `JsToolPkgRegistrationSession` 按 `RegistrationBucket` 收集 → `finish()` 无错时产出 `ToolPkgMainRegistrationCapture`（有错则抛 `IllegalStateException`，整包丢弃）。
   `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt:144`
2. **调度**：`JsToolManager.executeScript(script, tool)`（冒号名流式）或 `executeScript(toolName, params)`（点名同步）→ 切分包名/工具名 → `convertToolParameters` 按清单严格转换参数类型 → `buildRuntimeParams` 注入包状态与 `__operit_toolpkg_runtime_kind="sandbox"`。
   `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:81`
3. **组装**：`JsExecutionScriptBuilder` 把前奏（`emit`/`complete`/`getEnv`/`console` 等）+ 脚本拼成 `__operitExecuteScriptFunction(callId, params, scriptText, targetFunctionName, timeoutSec, preTimeoutMs, toolPkgApi)` 文本；模块按 `kind:identity:长度:hash` 缓存复用。
   `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:400`
4. **执行与上报**：引擎执行入口；目标函数按 `exports` → `module.exports` → 全局查找；成功经 `setCallResult`，失败经 `setCallError({"success": false, message})`；中间结果经 `sendCallIntermediateResult` 实时发出。
   `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:505`
5. **判定与返回**：`extractJsExecutionFailure` 判失败 → 失败走 `StringResultData(dataText)` + 错误消息，成功走 `StringResultData(value)`；Kotlin 侧 `withTimeout(1800s)` 与 JS 侧安全定时器双保险超时。
   `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt:393`
6. **追踪**：`JsExecutionListener` 把日志与中间结果转为 `ScriptExecutionTraceData` 实时发出；`JsExecutionTraceRecorder.buildResultData`/`writeTo` 生成带 `durationMs` 与事件列表的 JSON 追踪文件。
   `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt:84`

## 关联条目

- [[core-tools-jsengine|JS 引擎与桥接]]：本页的兄弟页，覆盖引擎、Java 桥接与模块加载。
- [[core-tools-registry|工具注册与执行框架]]：工具注册到模型提示词的全链路。
- [[core-tools|工具系统总览]]：v2 条目，本页是其细粒度展开。
- [[data-model|数据模型]]：`AITool`、`ToolResult` 的定义。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTimeoutConfig.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionResultProtocol.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgExecutionContext.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolManager.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionTrace.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/ScriptExecutionReceiver.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTools.kt`
