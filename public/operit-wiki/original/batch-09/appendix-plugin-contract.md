---
title: 插件开发契约手册
module: 附录
sources: 8
date: 2026-10-03
issue: 153
---

# appendix-plugin-contract（插件开发契约手册）

> 种子：`core/tools/packTool/PackageManager.kt`（包解析与注册）、`core/tools/ToolPackage.kt`（元数据模型）、`core/tools/javascript/JsExecutionScriptBuilder.kt`（执行入口）、`core/tools/javascript/JsLibraries.kt`（沙盒全局对象）、`core/tools/javascript/JsTimeoutConfig.kt`（超时）@ `dbf71916`

> 一句话：这页不讲"有哪些 API"，只讲"机器保证什么"——一个 JS 沙盒包从文件到被 AI 调用的全链路契约。违反契约的唯一下场：包加载失败、工具不出现、或调用直接报错，没有"差不多能用"。

## 概述

人话：给 Operit 写插件，本质是和解析器、注册器、执行器签三份合同。你负责按合同交货（文件格式、函数签名、返回约定），机器负责按合同履约（解析、注册、调用、超时、报错）。这页把每份合同的条款和违约后果列出来，照着写就不会出现"在我这能跑、装进去不认"的情况。

跟其他页的关系：`appendix-js-package-dev`（JS 沙盒包开发接口）是"有什么"（字段表、函数表）；**本页是"怎么 behave"**。`appendix-plugin-examples`（最小实例集）是照着抄的例子。

## AI 速览

- **核心符号清单**：`parseJsPackage`（包解析）、`extractMetadataFromJs`（METADATA 提取）、`validateToolFunctionExists`（函数存在性校验）、`registerPackageTools`（工具注册）、`selectToolPackageState`（state 选择）、`findTargetFunction`（目标函数查找）、`__operitExecuteScriptFunction`（执行入口）、`complete` / `emit`（结果回传）、`getEnv`（环境变量读取）、`JsTimeoutConfig`（超时）。
- **主入口**：`PackageManager.parseJsPackage(jsContent)`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2249`）；执行 `JsToolManager.executeScript` → `__operitExecuteScriptFunction(callId, params, scriptText, targetFunctionName, …)`（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:400`）。
- **数据流向一句话**：`.js` 文件 → 顶部 METADATA（Hjson）→ `ToolPackage` → 工具以 `包名:工具名` 注册 → AI 调用时脚本装入 CommonJS 壳，按名找到函数，以 `targetFunction(params)` 单对象参数调用 → return / `complete()` / 抛错决定结果。

## 契约 1：包文件

- **条款**：一个包就是一个 `.js` 文件（也接受 `.ts`、纯 `.hjson` 元数据文件）。元数据只认文件**顶部**第一个匹配 `/\*\s*METADATA\s*([\s\S]*?)\*/` 的注释块（`PackageManager.kt:2466-2467`）。
- **条款**：注释块内容按 **Hjson** 解析（`:2258`），注释、尾逗号、不加引号的 key 都合法；未知 key 直接忽略（`ignoreUnknownKeys`，`:2288`）。
- **违约**：找不到 METADATA 块 → 视为空 `{}`（`:2473`）；包名缺失 → 解析失败，包不会出现。
- **条款**：每个工具的 `script` 字段**不需要作者写**——解析器自动把**整个文件内容**填进去（`:2296`）。一个文件可放多个工具，互不干扰。

## 契约 2：工具注册

- **条款**：工具注册名为 `包名:工具名`（`:3458`），AI 看到和调用的都是这个名字。改包名 = 所有工具改名。
- **条款**：`enabledByDefault` 缺省为 `false`（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:330`）；用户没手动启用，工具不会进 AI 的工具表。
- **条款**：`advice: true` 的工具**不注册为可执行工具**，只把它的 description 塞进 prompt 给 AI 当建议看（`:3452`、`:3554`）。想让 AI"知道但不调"，用它；想让 AI 调，别设它。
- **条款**：工具函数存在性校验（`:2444`）只认 5 种形态：`async function 名(`、`function 名(`、`exports.名 =`、`const/let/var 名 =`。不满足 → 只记 warning 日志，**不阻断**（工具注册了但调用时会找不到函数而报错）。

## 契约 3：函数查找与调用

- **条款**：脚本被包进 CommonJS 模块壳执行：`new Function('module','exports','require','__operit_call_runtime', prelude + source)`（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:298`）。包里可直接用 `module` / `exports` / `require`，`require` 解析顺序 `x` → `x.js` → `x.json` → `x/index.js`（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:234`）。
- **条款**：目标函数查找顺序（`findTargetFunction`，`:370`）：`module.exports[工具名]` → `globalThis[工具名]`。两处都找不到 → 调用失败，并把可用函数名列给 AI 看。
- **条款**：调用签名**固定**为 `targetFunction(params)`（`:1386`）——**单个对象参数**，AI 传的所有参数都在这一个对象里。不存在多参数、不存在回调参数。

## 契约 4：返回、流式与错误

- **条款**：`async` 函数自动 await（`handleAsync`，`:581`）；同步 `return` 任意可 JSON 序列化的值即为工具结果。
- **条款**：`complete(value)` / `done(value)` 主动结束并回传（`:566`），调完后再调无效。适合"拿到结果就提前结束"的长流程。
- **条款**：`emit(value)` / `delta(value)` / `log(value)` / `update(value)` / `sendIntermediateResult(value)` 是同一实现——把中间结果推给调用方，不结束调用（`:607` 前后）。
- **条款**：函数抛错或 Promise reject → 工具调用失败，错误信息（含 stack）回传给 AI。**不要吞异常**，吞了 AI 就不知道发生了什么。
- **条款**：`console.log/info/warn/error` 进本次调用的日志上下文，可在包管理界面查看。

## 契约 5：超时

- **条款**：单次工具调用主超时 **1800 秒（30 分钟）**（`JsTimeoutConfig.MAIN_TIMEOUT_SECONDS`），预超时提前 5 秒触发。长任务不用自己管心跳，但也别指望超过 30 分钟的调用能活下来。

## 契约 6：env（环境变量）

- **条款**：env 在 METADATA 里**声明**（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:303`）：`{name, description, required, defaultValue}`。`required: true` 的变量缺失时，`PackageManager` 在**激活包之前**校验并提示用户填写——密钥走这个通道，不要硬编码在脚本里。
- **条款**：读取用 `getEnv("变量名")`；未设置返回 `undefined`。实证防御写法（`app/src/main/assets/packages/github.js:285`）：`typeof getEnv === "function" ? getEnv(…) : void 0`。
- **违约**：`required` 的 env 没填 → 包无法激活，工具不会出现。不是调用时报错，是根本不让你用。

## 契约 7：states（条件工具集）

- **条款**：给"同一包在不同环境下暴露不同工具"用。每项 `{id, condition, inheritTools, excludeTools, tools}`（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:338`）。
- **条款**：激活时按顺序求值 `condition`，**首个命中的 state 生效**（`selectToolPackageState`，`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3468`）；都不命中 → 包按无 state 处理（基础工具集）。
- **条款**：`condition` 求值上下文是能力快照（`:3497`），可用 key：`platform.name`（`"android"`）、`platform.android/windows/linux/macos`、`android.permission_level`、`android.shizuku_available`、`ui.virtual_display`、`ui.shower_display`。写别的 key 永远为假。
- **条款**：工具合并规则（`mergeToolsForState`，`:3489`）：`inheritTools=true` 先继承基础工具 → `excludeTools` 剔除 → `state.tools` 覆盖/新增。

## 契约 8：沙盒全局对象

- **条款**：每次执行前由 `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:20` 注入，包作者直接用，无需 import：`OkHttp`（网络）、`Java`/`Kotlin`（JVM 桥）、`Android`/`Intent`/`SystemManager` 等（Android 能力）、`Tools`（Operit 内置工具）、`CryptoJS`（加解密）、`Jimp`（图片）、`UINode`（UI 节点）、`pako`（压缩）、`_`/`dataUtils`/`Icons`（工具函数）。
- **条款**：这些全局对象是**执行期注入**的，不要在模块顶层做 `typeof X === "undefined"` 之外的假设；换宿主版本时以 `JsLibraries.kt` 为准。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt`：`parseJsPackage`（:2249）、`extractMetadataFromJs`（:2466）、`validateToolFunctionExists`（:2444）、`normalizeJsPackageMetadata`（:2337）、`registerPackageTools`（:3449）、`selectToolPackageState`（:3468）、`mergeToolsForState`（:3489）
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt`：`ToolPackage`（:301）、`PackageTool`（:340）、`PackageToolParameter`（:352）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt`：`createFactory`（:307）、`findTargetFunction`（:370）、执行入口（:400）、`complete`（:566）、`handleAsync`（:581）、`targetFunction(params)`（:1386）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt`：沙盒全局对象清单（:20）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTimeoutConfig.kt`：`MAIN_TIMEOUT_SECONDS`
