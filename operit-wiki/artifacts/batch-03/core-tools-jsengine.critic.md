# Critic 复核报告：core-tools-jsengine（JS 引擎与 Java 互操作桥）

- 复核人：独立 critic（与 writer 无关）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse`，一致）
- 复核方法：146 条 facts 全量脚本验证（引用文件存在 → 行号在文件总行数内 → ±5 行窗口内断言符号/依据命中）；脚本漏报的纯中文断言逐条人工核对源码；正文 139 个去重内联引用全量校验行号有效性；quality.json 10 条走查逐条核对源码证据；定量断言（18/6 模块、30 秒超时等）逐一实测。

## 结论

- **facts：140/146 通过，6 条引用行号不精确（事实本身为真，需退回修正引用）**
- **正文：结构完整，无超出 facts 的断言（抽查范围内）**
- **走查：10/10 证据属实**
- **总体：不通过直发，需修正 6 处引用行号后重新提交**

## 失败清单（退回修正）

以下 6 条事实内容为真，但引用行指向函数/builder 签名行，真实证据行超出 ±5 行窗口，违反引用铁律。修正建议一并给出：

1. **[75]** 事实："JS 资产加载失败记日志并返回空字符串"｜引用 `JsAssetLoader.kt:8`
   问题：`:8` 是 `readJavaScriptAsset(` 函数签名行；记日志（`AppLogger.e`）与返回 `""` 的证据在 `:15-17`，超出窗口 7 行。
   修正：引用改为 `JsAssetLoader.kt:15`。

2. **[78]** 事实："runtime-constants.js 暴露 OPERIT_DOWNLOAD_DIR 与 OPERIT_CLEAN_ON_EXIT_DIR 两个目录常量"｜引用 `JsInitRuntimeScriptBuilder.kt:56`
   问题：`:56` 是 `buildRuntimeConstantsScript(` 签名行；`expose('OPERIT_DOWNLOAD_DIR', …)` 证据在 `:68`（`OPERIT_CLEAN_ON_EXIT_DIR` 在 `:69`），超出窗口约 12 行。
   修正：引用改为 `JsInitRuntimeScriptBuilder.kt:68`。

3. **[79]** 事实："runtime-call-registry.js 维护 windowRef.__operitCallRegistry，暴露 __operitRegisterCallSession / __operitCancelCallSession"｜引用 `JsInitRuntimeScriptBuilder.kt:74`
   问题：`:74` 是 `buildRuntimeCallRegistryScript()` 签名行；`__operitCallRegistry` 维护证据在 `:94-97`，`expose('__operitRegisterCallSession'/'__operitCancelCallSession')` 在 `:200/:202`，远超窗口。
   修正：引用改为 `JsInitRuntimeScriptBuilder.kt:94`（或拆成两条事实分别引用 `:94` 与 `:200`）。

4. **[80]** 事实："runtime-errors.js 定义 __operitReportDetailedErrorForCall，经 NativeInterface.reportErrorForCall 把错误详情传回 Kotlin"｜引用 `JsInitRuntimeScriptBuilder.kt:220`
   问题：`:220` 是 `buildRuntimeErrorScript()` 签名行；定义证据在 `:298`，`reportErrorForCall` 引用在 `:276`，远超窗口。
   修正：引用改为 `JsInitRuntimeScriptBuilder.kt:298`。

5. **[119]** 事实："加载外部代码前设置 JVM 兼容系统属性：os.name=Linux、os.arch、user.home 等"｜引用 `JsExternalJavaCodeLoader.kt:300`
   问题：`:300` 是 `ensureJvmCompatibilitySystemProperties()` 签名行；`ensureSystemProperty("os.name","Linux")` 等证据在 `:307-311`，超出窗口 7–11 行（`user.home` 在 `:311` 已实测存在）。
   修正：引用改为 `JsExternalJavaCodeLoader.kt:307`。

6. **[145]** 事实："动作执行期间的状态变更经 sendIntermediateResult 推送中间渲染，防抖队列保证一次只跑一个中间渲染"｜引用 `JsComposeDslRuntimeScript.kt:230`
   问题：该事实捆绑两个断言。防抖断言证据在 `:227-235`（`__intermediateRenderInFlight` 守卫，窗口内，成立）；但 `sendIntermediateResult` 推送中间渲染的证据在 `:182-185`，距引用 45 行，窗口内无依据。
   修正：拆成两条事实——防抖断言保留引用 `:230`，sendIntermediateResult 断言引用改为 `:185`。

## 通过项摘要

- 其余 140 条 facts：引用文件存在、行号有效、±5 行内可见断言依据（含 [5]`BINARY_DATA_THRESHOLD`、[73] 嵌入式库吞异常返空串、[117] 产物只读校验，均为脚本漏报后人工核源码确认通过）。
- 正文 `core-tools-jsengine.md`：六段结构齐全（概述/AI 速览/核心机制/关键符号/调用链/来源+关联条目）；`## AI 速览` 含核心符号清单、主入口、数据流向一句话；139 个去重内联引用行号全部有效；抽查的定量断言全部实测成立（18 个 bootstrap 模块 = 6 个 init-runtime + 12 个 JsLibraries 列表项；Compose DSL 三入口 `timeoutSec = null`；`future.get(30, TimeUnit.SECONDS)`）。
- `quality.json` 10 条走查证据逐条核实成立：
  - [0] `loadClass` 仅非空校验后直调 `Class.forName`（`:887-900`）
  - [1] `callToolSync` 无权限检查直调 `toolHandler.executeTool`（`:674-690`）
  - [2] `setEnv` 经 `EnvPreferences` 持久化全局环境变量（`:227-231`）
  - [3] `Cipher.getInstance("AES/ECB/NoPadding")`（`:1066`）
  - [4] Compose DSL 三入口 `timeoutSec = null`（`:1142/:1168/:1181`）
  - [5] `invokeJavaBridgeJsObjectCallbackSync` 阻塞 30 秒等 QuickJS 回泵（`JsEngine.kt:675`）
  - [6] `buildToolResultCallbackScript` 只转义 4 个字符 vs `buildStringResultCallbackScript` 用 `JSONObject.quote`（`:832-862`）
  - [7] 失败返回 `{"nativeError":"..."}` 字符串（`:670/:1096`）
  - [8] `callToolAsync` 等裸 `Thread{}.start()`（5 处）
  - [9] `JsJavaBridgeDelegates` 2103 行（实测 `wc -l` = 2103）

## 给 writer 的退回指令

修正上述 6 条 facts 的 `ref` 行号（按"修正"列），`quality.json` 与正文无需改动；修正后通知 critic 复验（只需重跑引用校验脚本），不接受"行号差不多"的口头解释。

## 修正记录（2026-10-01）
- 6 处引用行号已修正（idx75→:15、idx78→:68、idx79→:94、idx80→:298、idx119→:307），修正前已用脚本逐条验真新行号。
- idx145 拆成两条：sendIntermediateResult 推送中间渲染→:185；防抖单飞守卫→:230（__intermediateRenderInFlight）。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
