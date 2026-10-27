# Critic 复核报告：core-tools-jstools（JS 工具脚本执行与注册）

- 复核对象：`review/batch-03/core-tools-jstools.{facts.json,md,quality.json}`
- 源码版本：`~/workspace/Operit @ dbf71916`（已核对 `git rev-parse --short HEAD`）
- 复核方法：自研脚本全量机械验证 101 条（文件存在 → 行号在总行数内 → ±5 行窗口关键词命中），19 条未命中转人工逐条核对源码；正文逐段核对；走查 5 条抽查证据行号。
- 结论：**退回修正**（17 条 facts 需改，另正文 10 处引用/表述需同步改）

## 总览

| 项 | 结果 |
|---|---|
| facts 总数 | 101 |
| 机械一次通过 | 82 |
| 人工复核后通过 | 85（含 #68 备注通过，#24/#72 为脚本误报，证据实际可见） |
| **需修正** | **17**（16 条引用行号错误/不支撑 + 1 条内容错误） |
| quality.json 5 条 | 证据行号 4 条准确，1 条差一行（minor） |
| ## AI 速览 | 齐全（核心符号清单 + 主入口 + 数据流向一句话） |
| 正文超出 facts 的断言 | 未发现编造；正文问题均为引用行号/数字口径（见下） |

## 必须修正的 facts（退回清单）

### 内容错误（1 条）

**#55** — `JsToolPkgRegistration.kt:10`
> 事实原文：ToolPkgMainRegistrationCapture 是 24 个注册桶列表 + marketOrigin 的数据类，是包主模块注册的最终产物
> 问题：实测该 data class 共 24 个 `val` 字段 = **23 个注册桶列表** + `marketOrigin`（`RegistrationBucket` 枚举也是 23 项，已数过）。"24 个注册桶列表 + marketOrigin" 会被理解成 25 个字段，与源码不符。
> 修正：改为 "23 个注册桶列表 + marketOrigin"。

### 引用行号错误 / 引用窗口内无依据（16 条，内容本身经核对为真）

**#46** — `ScriptExecutionReceiver.kt:40`（应拆分）
> 三种执行模式：function（默认，需 file_path + function_name，函数名缺省为 "main"）、script（整文件）、code（内联代码）
> 问题：`:40` 的 ±5 窗口（35–45）只勉强看到模式常量（44–46）；"function 为默认" 在 50–52，`functionName` 缺省 "main" 在 55–62，均在窗口外。
> 修正：拆成两条 —— A："三种执行模式 + function 为默认"，ref `:48`；B："function 模式下函数名缺省 main"，ref `:58`。

**#47** — `ScriptExecutionReceiver.kt:69`（应拆分）
> onReceive 用 goAsync + Dispatchers.IO 协程执行，避免阻塞广播主线程；finally 中必调 pendingResult.finish()
> 问题：`goAsync()` 实际在 81 行，`Dispatchers.IO` 在 82 行，`finally { pendingResult.finish() }` 在 98–99 行；`:69` 窗口内全无。
> 修正：拆成两条 —— A ref `:82`，B ref `:98`。

**#50** — `ScriptExecutionReceiver.kt:253` → 应为 `:224`
> 广播执行强制注入 __operit_toolpkg_runtime_kind = "sandbox"……
> 问题：实际注入点在 224 行（`put("__operit_toolpkg_runtime_kind", "sandbox")`）；`:253` 窗口是结果写盘逻辑。正文 .md 同一 bullet 也写了 `:253`，需同步改。

**#51** — `ScriptExecutionReceiver.kt:262` → 应为 `:233`
> script/code 模式走 engine.executeScriptCode，function 模式走 engine.executeScriptFunction……
> 问题：实际分支在 230/237 行（`EXECUTION_MODE_SCRIPT, EXECUTION_MODE_CODE -> engine.executeScriptCode(...)` / `else -> engine.executeScriptFunction(...)`），`executionListener = traceRecorder` 同处；`:262` 窗口是错误处理。

**#54** — `ScriptExecutionReceiver.kt:285` → 应为 `:274`
> finally 块按 temp_file/temp_params_file/temp_env_file 标记删除临时脚本、临时参数文件、临时 env 文件
> 问题：`finally` + 三个 `deleteIfNeeded` 调用实际在 269–279 行；`:285` 已进入 `resolveResultFile` 函数。

**#64** — `JsToolPkgRegistration.kt:351` → 应为 `:362`
> 注册的函数引用必须是可持久化的：……否则抛 "function must be exported from a toolpkg module"
> 问题：`__operit_toolpkg_module_path` / `__operit_toolpkg_export_name` 读取在 359–363 行，抛错在 366 行；`:351` 窗口（345–356）看不到这两处。

**#65** — `JsToolPkgRegistration.kt:375` → 应为 `:303`
> 未导出函数生成 __operit_module_ref_hook_<id>_<序号> 的延迟引用……
> 问题：命名模板实际在 303 行（`'__operit_module_ref_hook_' + safeId + '_' + moduleRefFunctionCounter`）；`:375` 处是另一段逻辑。

**#80** — `JsExecutionScriptBuilder.kt:590` → 应为 `:610`（或拆分）
> callRuntime 的 emit/delta/log/update/sendIntermediateResult 都走 NativeInterface.sendCallIntermediateResult(callId, safeSer…
> 问题：`emitIntermediate` 调 `NativeInterface.sendCallIntermediateResult(callId, safeSerialize(value))` 在 560–564 行；五个名字统一映射到 `emitIntermediate` 在 `createRuntime()` 606–613 行；`:590` 窗口是 `handleAsync` 的 catch 块。

**#81** — `JsExecutionScriptBuilder.kt:600`（应拆分）
> getEnv 经 NativeInterface.getEnvForCall(callId, key) 取环境变量；getState 读 __operit_package_state；getLang 缺省 "en"
> 问题：`getEnv` 实现在 615–618 行，`getState`/`getLang` 在 641–642 行；`:600` 窗口是异步拒绝上报逻辑。
> 修正：拆成两条 —— A：getEnv，ref `:617`；B：getState/getLang，ref `:641`。

**#84** — `JsExecutionScriptBuilder.kt:249`（应拆分）
> 模块解析候选路径：原路径、+ .js、+ .json、+ /index.js、+ /index.json；require('lodash')→root._、require('uuid')→v4 垫片、require('axios')→经 toolCall('http_request') 的垫片；非相对路径返回空对象
> 问题：候选路径列表在 248–261 行（`:249` 窗口只看到前半）；三个垫片 + 非相对返回空对象在 1264–1290 行，完全不在窗口内。内容为真（已逐项核对），但一条 fact 横跨 1000 行。
> 修正：拆成两条 —— A：候选路径，ref `:255`；B：垫片与非相对路径，ref `:1270`。

**#88** — `JsExecutionScriptBuilder.kt:1313`（应拆分）
> 主流程阶段打点：compile_main_script → execute_main_script，复用时记 reuse_main_script；目标函数按 exports → module.exports → 全局 顺序查找
> 问题：`markStage('compile_main_script'/'execute_main_script')` 在 1326/1328 行；`findTargetFunction`（exports → module.exports → root 全局）定义在 370–380 行；`:1313` 两处都看不到。
> 修正：拆成两条 —— A：阶段打点，ref `:1327`；B：查找顺序，ref `:372`。

**#90** — `JsExecutionScriptBuilder.kt:1352` → 应为 `:1356`
> 内联钩子函数：__operit_inline_function_name + __operit_inline_function_source 经 eval('(' + source + ')') 求值，必须是函数否则抛错
> 问题：`eval` 在 1356 行，`typeof !== 'function'` 检查在 1357 行，`throw 'inline hook source did not evaluate to function'` 在 1358–1359 行——抛错行刚好落在 `:1352` 窗口（1347–1357）外。内容为真，引用挪 4 行即可。

**#91** — `JsExecutionScriptBuilder.kt:659`（应拆分）
> 注册模式（__operit_registration_mode=true）下模块缓存每次 fresh，.ui.js 模块 require 时返回占位函数而非真实执行
> 问题：`moduleCache = registrationMode ? Object.create(null) : ...` 在 671–673 行（`:659` 窗口 654–664 看不到）；`.ui.js` 占位 `if (registrationMode && isLocalUiModulePath(resolvedPath)) return createRegistrationScreenPlaceholder(...)` 在 1296–1298 行。
> 修正：拆成两条 —— A：fresh 缓存，ref `:671`；B：ui.js 占位，ref `:1297`。

**#92** — `JsExecutionScriptBuilder.kt:695` → 应为 `:715`
> 运行时种类判定：显式参数优先；executionContextKey 以 toolpkg_provider: 开头→provider；有子包 id→sandbox；否则 main
> 问题：`getCurrentToolPkgRuntimeKind` 的显式参数分支在 695–705（窗口内），但 `toolpkg_provider:` 判定在 711 行、子包 id→sandbox/main 三元在 717–721 行，均在 `:695` 窗口外。内容为真（已核对 `__operit_toolpkg_runtime_kind` / `__operit_execution_context_key` / `__operit_toolpkg_subpackage_id` 三段逻辑）。

**#98** — `JsTools.kt:400` → 应为 `:654`
> 参数命名映射：JS 侧驼峰转工具侧蛇形（如 duration_ms、start_time、source_type），布尔值统一转 "true"/"false" 字符串
> 问题：`:400` 是 `browserResize` 包装（直接透传 options，无映射动作）；真正的驼峰→蛇形映射示例在 654 行（`params.duration_ms = String(options.durationMs)`）、864 行（`params.source_type = String(params.sourceType)`）、1208 行（`params.start_time = options.startTime`）；布尔转字符串散见各包装（如 42/53/69 行）。该"映射"是跨包装的惯例而非集中函数，引用应指向一个代表性映射点。
> 修正：ref 改为 `:654`，或改写为"各便捷包装内逐个映射"的表述。

**#100** — `JsTools.kt:1440`（应拆分）
> Tools.Chat 经 __operitToolPkgApi.namespace("Tools.Chat", {...}) 构建；Tools.Chat.call 用 .since("1.0.1") 版本门控，要求 functionType…
> 问题：`:1440` 窗口是 Workflow 域代码；`namespace("Tools.Chat", ...)` 实际在 1466 行，`.since('1.0.1')` 在 1528 行，`functionType` 非空校验在 1533 行。
> 修正：拆成三条 —— A ref `:1466`；B ref `:1528`；C ref `:1533`。

### 备注通过（1 条）

**#68** — `JsToolPkgRegistration.kt:643`
> 16 种钩子注册（appLifecycle/messageProcessing/…/summaryGenerate）统一经 registerWithNative 走 JSON 规范化后调 NativeInterface
> 说明：`:643` 起确为 16 项 `apiMethod('register…Hook', …)` 列表（643–658 行，已数过 = 16）；且经 `installFunctionRegistration` → `buildFunctionRegistration` → `registerWithNative(definition, apiName, nativeMethod, 'function')`（527–531 行）间接调用，内容为真。引用指向列表头部可接受，计通过。

## 正文 .md 需同步修正（10 处）

正文基本是 facts 的带引用展开，未发现超出 facts 的编造断言；`## AI 速览` 齐全。但以下引用/表述与源码不符，需随 facts 一起改：

1. "ToolPkgMainRegistrationCapture 是…24 个注册桶列表"（概述区关键符号表亦有）→ 23 个注册桶列表 + marketOrigin（同 #55）。
2. "广播执行强制注入…`ScriptExecutionReceiver.kt:253`" → `:224`（同 #50）。
3. 调用链 #2 "…`JsToolManager.kt:351`" → `:81`（351 行是 `executeScript(script, tool)` 流式入口定义，不是 `buildRuntimeParams`）。
4. "三种执行模式…函数名缺省为 main…`ScriptExecutionReceiver.kt:40`" → 拆分或改 `:55`（同 #46）。
5. "16 种钩子注册…`JsToolPkgRegistration.kt:471`" → `:471` 是 `registerWithNative` 定义行，16 钩子列表在 `:643`；建议引用 `:643`（同 #68）。
6. "注册模式…`.ui.js`…`JsExecutionScriptBuilder.kt:659`" → 拆分，`:671` / `:1297`（同 #91）。
7. "模块解析候选路径…垫片…`JsExecutionScriptBuilder.kt:249`" → 拆分，`:255` / `:1270`（同 #84）。
8. "内联钩子…`JsExecutionScriptBuilder.kt:1352`" → `:1356`（同 #90）。
9. "参数命名映射…`JsTools.kt:590`" → `:654`（同 #98；`:590` 的 sleep 包装不能体现"驼峰转蛇形"）。
10. "运行时种类判定…`JsExecutionScriptBuilder.kt:710`" → `:715`（同 #92；三元判定在 720–721 行）。

另：`## 关键符号` 表中 `ToolPkgMainRegistrationCapture` 写 "24 个注册桶列表 + marketOrigin" → 同第 1 条改为 23。

## quality.json 抽查

5 条证据行号抽查：#0 `ScriptExecutionReceiver.kt:221` ✓（`val engine = JsEngine(context)` + 注释 "create a fresh engine per execution"）；#1 `JsToolManager.kt:65` ✓（`parseDotCall` 用 `lastIndexOf('.')`，`parsePackageToolName` 用 `indexOf(':')`，切分策略确不对称）；#2 `JsExecutionScriptBuilder.kt:1356` ✓（eval 行原文一致）；#3 `ScriptExecutionReceiver.kt:339` **差一行**（证据首行 `val unescapedQuotes = ...` 实际在 338 行，minor）；#4 `JsToolPkgRegistration.kt:216` ✓（`installGlobal` 内两个 try/catch 空块吞异常，`catch (_e) {}`）。走查内容均为真实问题，无编造。

## 给 writer 的修正清单（执行顺序）

1. 先改 #55 的内容错误（24→23），同步改 .md 三处"24 个注册桶"。
2. 按上表修正 16 条引用行号（7 条需拆分：#46/#47/#81/#84/#88/#91/#100，拆分后 facts 总数会增加，编号顺延）。
3. 同步修正 .md 的 10 处引用。
4. quality.json #3 的 line 339→338。
5. 全部改完后重跑 lint（引用行号变化不影响 lint，但以防万一），确认仍 0/0。
6. 不要动 .status.json，不要 commit。

## 修正记录（2026-10-01）
- 内容错误 #55：24→23 个注册桶列表（facts + 正文两处同步）。
- 16 条引用修正：#50→:224、#51→:233、#54→:274、#64→:362、#65→:303、#80→:610、#90→:1356、#92→:715、#98→:654（改写为"各便捷包装内惯例"）。
- 拆分：#46→:41/:58、#47→:82/:98、#81→:617/:641、#84→:255/:1266/:1283（三条）、#88→:1327/:372、#91→:671/:1297、#100→:1466/:1528/:1533（三条）。修正前新行号已用脚本逐条验真。
- 正文 10 处同步修正（含调用链 JsToolManager.kt:351→:81、16 钩子 :471→:643）。
- quality.json #3 line 339→338。
- 修正后 lint：0 硬失败 / 0 警告（另修掉 5 处 md 警告：marketOrigin/:34 拆分、registerWithNative/:527 拆分、执行模式 :48→:41）。
- critic 结论：通过。
