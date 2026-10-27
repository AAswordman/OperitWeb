# Critic 复核报告：core-app-workflow（应用生命周期、性能监控与工作流调度）

- 复核对象：`review/batch-05/core-app-workflow.{md,facts.json,quality.json,lint.md,status.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：108 条 facts 全量结构校验（文件存在、行号不越界）+ 标识符/数字窗口启发式筛查（56 条 flagged 逐条人工核源码）+ 抽样复核；quality 7 条逐条验 evidence 逐字性与 severity；md 全文读 + 断言交叉核对；lint 单页隔离重跑

## 结论：打回

**facts：108 条中 88 条通过，20 条硬问题（引用错位/归因错误/复合未拆分）必须修正。**
**quality：7 条中 5 条通过；Q4 行号错误 + 描述含虚假断言，Q7 行号错误，必须修正。**
**正文 md：结构齐全、符号英文、与 facts 无矛盾，但有 2 处"通过"禁用词（零残留铁律）必须改写，另 1 处空引号笔误建议顺手修。**
**status.json：字段正确（issue=75 整数、review-pending、operit、dbf71916…），critic 留空待填。lint：单页隔离重跑 0 硬失败/0 警告。**

### 核心问题

writer 的断言内容本身基本属实（抽查的超时数值、状态机五态、cron 三种模式、15 分钟钳制、runBlocking 调用链等均与源码一致），但约 19% 的 fact 锚点不在 ±5 支撑窗口内，且有 1 条事实性归因错误（[20] 把 `initializeAppLanguage` 的版本分支写成 `attachBaseContext` 的行为）。按引用铁律必须打回，把错位 ref 重新锚定到正确行号（下方给出每个的正确锚点），把复合事实拆分。

---

## 硬问题一：facts 引用错位 / 断言错误（20 条）

### OperitApplication.kt
- [20] `:570` → **断言归因错误，必须拆分**。"Android 13+ 用 AppCompatDelegate，旧版本改 Configuration" 是 `initializeAppLanguage`（:547–551）的逻辑，不是 `attachBaseContext`（:570–592，后者用 N 分支 + createConfigurationContext）。拆成两条：attachBaseContext 部分保留 `:570`；版本分支部分 → `:547`。
- [40] `:137` → **拆分**。窗口 132–142 只有 `startedActivityCount += 1`，前台判定在 `:150`、后台判定在 `:219`。拆成两条：前台 `:150`、后台 `:219`。

### ActivityLifecycleManager.kt
- [42] `:150` → **拆分**。窗口 145–155 既不含 `APPLICATION_FOREGROUND` 派发（:157）也不含 `APPLICATION_BACKGROUND` 派发（:222）。拆成两条：前台 `:157`、后台 `:222`。

### ForegroundServiceCompat.kt
- [52] `:38` → `:51`。窗口 33–43 只有函数签名，`SecurityException` 降级逻辑在 51–58。

### PerformanceMonitorManager.kt
- [60] `:316` → `:322`。窗口 311–321 是 TERMINAL 的 CPU 计算，`memoryKb = rssPages * pageSizeBytes / 1024L` 在 `:325`。
- [65] `:333` → `:381`。窗口 328–338 是整机 CPU 代码，`lastIndexOf(')')` 解析在 `:381`。

### WorkflowExecutor.kt
- [72] `:153` → `:165`。窗口 148–158 只有 `prepareRuntime` 头，冒号预热 `actionNodes.any { it.actionType.contains(':')}` 在 `:166`。
- [73] `:555` → `:585`。窗口 550–560 是结果构造，`RUNTIME_INITIALIZATION` 在 `:588`。
- [74] `:560` → `:622`。窗口 555–565 是结果构造，`triggerType == "manual"` 过滤在 `:625`。
- [79] `:878` → `:895`。窗口 873–883 只有条件检查开头，`"error","failed","on_error"` / `"success","ok","on_success"` 映射在 897–898。
- [81] `:918` → `:940`。窗口 913–923 是条件求值 helper，`Skipped` 标记在 `:936`、入度递减在 `:943`。
- [82] `:992` → `:1005`。窗口 987–997 只有起始，`isErrorCondition && target Success → handled` 核心逻辑在 1002–1011。
- [84] `:1275` → **拆分**。`resolveParameters` 调用在 `:1258`，`executeTool` 在 `:1275`，17 行 apart，两个断言各需独立锚点。
- [85] `:178` → `:190`。窗口 173–183 是 `parseBooleanLike` 尾，`IllegalStateException` 在 192–193。
- [87] `:248` → `:278`。窗口 243–253 是 GTE 分支，IN 分支（JSON 数组/逗号分隔/类型不匹配抛异常）在 `:278`。

### WorkflowScheduler.kt
- [94] `:129` → `:121`。窗口 124–134 是函数尾，`enqueueUniquePeriodicWork` + `ExistingPeriodicWorkPolicy.REPLACE` 在 121–123。
- [96] `:420` → **拆分且原锚点完全错误**（:420 在 `calculateCronInterval` 函数内，与日期格式无关）。四种日期格式 → `:318`；"目标时间已过则拒绝排期"（`delay < 0 → return false` 在 147–150）→ `:147`。
- [98] `:260` → `:214`。窗口 255–265 是 helper 函数，`intervalMs >= 15 * 60 * 1000` 检查在 `:214`。
- [101] `:449` → `:462`。窗口 444–454 只有函数头，`when (scheduleType)` 三分支在 457–467。

### WorkflowSchedulerInitializer.kt
- [107] `:25` → `:35`。窗口 20–30 只有函数头，`enabled` 过滤 + `repository.scheduleWorkflow` 调用在 37–38。

---

## 硬问题二：quality.json（2 条）

- **Q4（suggestion）**：`line: 390` 错误，错误注释 `"0 2 * * * (every 2 hours)"` 实际在 **:346**。且 description 含虚假断言——"下方代码实际只实现了每日定时模式"不成立：`calculateNextCronTime` 实际支持每日定时、每 N 小时（`0 */N * * *`）、每 N 分钟（`*/N * * * *`）三种模式（:350–386）。注释的 `(every 2 hours)` 标注确实误导（标准 cron 里 `0 2 * * *` 是每日 02:00），但"只实现每日"必须删改。行号 → `:346`，描述修正。
- **Q7（suggestion）**：`line: 389` 错误，`readAccessibleProcessTree` 实际在 **:420**。evidence 内容与源码逐字一致，description 准确（终端会话为空时跳过扫描，:301），仅行号需修正。

其余 5 条验证通过：
- **Q1/Q2（warn）**：evidence 逐字一致；调用链已实锤——`MainActivity.onCreate`（主线程，:189）→ `initializeMainApplication` → `initializeAppLanguage`（:192，内含:525 `runBlocking`）与 `startGlobalAIForegroundServiceIfNeeded`（:214，内含:499/:502 `runBlocking`）。warn 分级合理，无夸大。
- **Q3（warn）**：16 个同步步骤经 `` 标记数实（18 标记减 2 异步 = 16），全跑在调用线程，warn 合理。
- **Q5（suggestion）**：裸 `CoroutineScope(Dispatchers.IO).launch`（:28）属实，suggestion 合理。
- **Q6（suggestion）**：`dfs` 递归（:768–774）属实，suggestion 合理。

---

## 硬问题三：正文 md 禁用词（2 处，按零残留铁律必须改写）

- md:53：”全局异常处理通过 `Thread.setDefaultUncaughtExceptionHandler(GlobalExceptionHandler(this))` 安装" → 改写"通过"（如"调用 … 安装"）。
- md:147：”`ExecuteNode`：通过 `AIToolHandler.executeTool` 执行工具" → 改写"通过"（如"调用 … 执行"）。

---

## 轻微问题（建议顺手修，不阻塞）

- [26] `:650`：`onLowMemory` 与 `onTrimMemory` 是两个函数（相距 11 行），建议拆成两条。
- [38] `:163` → `:169`：2500ms 节流（`now - lastMicEnsureAtMs >= 2500L`）在 169–171。
- [58] `:267` → `:261`：`memInfo.totalPss` 在 `:261`，差 1 行但移过去更精确。
- [63] `:91` → `:88`：5000ms 注释与 `MAX_VALID_INTERVAL_MS = 5_000L` 在 88–89。
- [69] `:90`：`setPaused` 调用在 `:106`（16 行外），建议拆分或补锚点。
- [71] `:534`：`WorkflowExecutionRecord` 字段（起止时间/日志/失败阶段）在 550–559，建议拆分。
- [80] `:912` → `:918`：正则匹配 `Regex(effectiveCondition).containsMatchIn(sourceResult)` 在 921–923。
- [86] `:199`：函数头锚点可接受（`compareValues` 总览事实），但 10 个算子枚举在 210–278，建议注明或拆分。
- [89] `:1189`：`RANDOM_INT`（:1198）、`RANDOM_STRING`（:1208）在窗口外，建议拆分或移锚点。
- [99] `:290`：`workflow_` 前缀常量在 `:26`，窗口内只有 `getWorkName` 调用，可接受，建议注明。
- md:51：”每一步都用 `AppLogger.d` 输出""打点"——空引号占位笔误，应为 `""`。

---

## 通过项

- **facts 结构**：108 条 ref 文件全部存在、行号无越界、无复合句（单句断言）。
- **facts 内容抽查**（断言为真）：[6]冷启动重置日志、[21]–[25] onTerminate 五项清理、[35] initialize 注册回调、[41]前台自动拉起、[61] UID 网络口径、[75]触发节点标记 Success、[83]五态机、[88] LogicNode 空输入 AND=false、[90] CancellationException 重抛、[92]/[93]/[95]/[97]/[100] 调度器各断言、[102]–[106] Worker 各断言、[108]重排计数，均与源码一致。
- **md 结构**：概述 / `## AI 速览` / 核心机制 / 关键符号 / 输入→处理→输出调用链 / 来源，六段齐全；符号名英文原文；术语首现均有解释；与 facts 无矛盾断言；16 步启动流程行号全部抽查属实；`initializeMainApplicationLocked`（:152）、链路3 的 `samplingLoop`/:181、`sampleOnce`/:211、`stateFlow`/:122 均存在。
- **status.json**：`issue: 75`（整数）、`status: review-pending`、`source_repo: operit`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，全部正确；`critic` 留空待填。
- **lint**：单页隔离重跑 `scripts/lint.py`（仅本页 md），0 硬失败 / 0 警告。（注：writer 的 `.lint.md` 是全目录报告，含其他页问题与对 `.lint.md` 自身的误报，不代表本页。）

---

## 复检要求

writer 按上表修正 20 条 facts（拆分 [20]/[42]/[40]/[84]/[96]，重锚其余 15 条）+ quality Q4/Q7 + md 2 处"通过"改写后，critic 需对修正条目复检窗口支撑，确认后方可关闭。

---

## 复验（第二轮）——独立复验 critic，2026-10-01

- 复验对象：修错后的 `core-app-workflow.{md,facts.json(113条),quality.json(7条),lint.md,status.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 已确认一致）
- 复验方式：修错报告声称的全部修正逐项独立核源码（未采信修错员自报）；113 条 facts 全量程序化校验（文件存在/行号不越界）；7 条 quality evidence 逐字比对；md 全文 grep 禁用词；lint 单页隔离独立重跑

### 结论：仍需再修

**facts / quality 本体：修错全部合格。** 但正文 md 有 **16 处行内引用**未随 facts 重锚同步更新（其中 15 处是修错引入的引用漂移，1 处是旧有错位），按引用铁律必须同步修正。修完这 16 处后无需再做全量复验，parent 可自行核对行号后放行（或派第三人抽查）。

### 通过项（已逐项验真）

1. **[20] 归因错误已修正**：拆为 facts[19]（`attachBaseContext` `:570`，断言"经 createConfigurationContext 创建新的语言上下文"）与 facts[20]（`initializeAppLanguage` `:547`，Android 13+ 用 `AppCompatDelegate.setApplicationLocales`、旧版本改 Configuration）——源码 542–592 行逐行确认，原归因错误已消除。
2. **4 处拆分全部成立**：[40]→`:150`/`:219`（前台/后台判定，`startedActivityCount` 条件逐行确认）；[42]→`:157`/`:222`（FORE/BACKGROUND 派发）；[84]→`:1258`（`resolveParameters`）/`:1275`（`executeTool`）；[96]→`:318`（四种日期格式）/`:147`（`delay < 0 → return false`）。
3. **14 处重锚抽验 12 条全部 ±5 窗口支撑**：FSC:51（SecurityException）、PMM:322（`memoryKb = rssPages * pageSizeBytes / 1024L`）、PMM:381（`lastIndexOf(')')`）、WE:165（冒号预热）、WE:585（RUNTIME_INITIALIZATION）、WE:622（manual 过滤）、WE:895（error/success 映射）、WE:940（Skipped+入度递减）、WE:1005（isErrorCondition）、WE:190（IllegalStateException）、WE:278（IN 分支）、WSI:35（enabled+scheduleWorkflow）；另 [121]/[214]/[462] 三处按一审精确锚点已程序化确认存在。
4. **Q4**：line `:346`（误导注释 `"0 2 * * * (every 2 hours)"` 实际行）；description 已删掉虚假断言，重写为支持每日定时/每 N 小时/每 N 分钟三种模式——已亲手核 `calculateNextCronTime`（368–387 行）三种分支为真。
5. **Q7**：line `:420`（`readAccessibleProcessTree` 定义行），evidence 逐字命中。
6. **正文禁用词**：5 文件全文 grep"通过/批准/LGTM"零命中；md:53/md:147/md:99 的"通过"已改"经由/调用"；md:51 空引号已修为 `…`。
7. **全量**：113/113 ref 行号存在且不越界；7/7 quality evidence 逐字真实（2 处为脚本窗口假阳性，已人工确认）；status.json 字段全对（issue 75 整数、review-pending、operit、commit 一字不差）；lint 单页隔离独立重跑 **0 硬失败 / 0 警告**。

### 仍需再修：16 处 md 行内引用与 facts 新锚点脱节

修错员按"只改 critic 指出的项目"未同步正文行内引用，导致以下 md 行内 `` `:行号` `` 仍指向旧（错）位置。判定标准：同一断言在 facts.json 已有新锚点并经本轮验真，正文必须使用同一锚点。

| # | 位置 | 现状 | 应改为 | 对应事实 |
|---|---|---|---|---|
| 1 | md:65 | `:137` | **`:150`** | 前台判定（facts[40]） |
| 2 | md:65 | `:206` | **`:219`** | 后台判定（facts[41]；旧有错位，:206 窗口是 `onActivityStopped` 头、不含判定） |
| 3 | md:94 | `:316` | **`:322`** | TERMINAL 进程树 RSS（facts[62]） |
| 4 | md:97 | `:333` | **`:381`** | stat 右括号解析（facts[67]） |
| 5 | md:106 | `:420` | **`:318` + `:147`** | "支持 4 种日期格式（`:318`），目标时间已过则拒绝排期（`:147`）"（facts[99]/[100]，需拆成两个引用） |
| 6 | md:107 | `:260` | **`:214`** | 15 分钟降级一次性任务（facts[102]） |
| 7 | md:109 | `:129` | **`:121`** | 冲突策略 REPLACE（facts[97]；注意 md:30/md:53 的 `:129` 是 OperitApplication 的 GlobalExceptionHandler，正确，**不要动**） |
| 8 | md:109 | `:449` | **`:462`** | getNextExecutionTime（facts[105]） |
| 9 | md:133 | `:153` | **`:165`** | 冒号预热（facts[74]） |
| 10 | md:133 | `:555` | **`:585`** | RUNTIME_INITIALIZATION（facts[75]） |
| 11 | md:134 | `:560` | **`:622`** | manual 触发过滤（facts[76]） |
| 12 | md:141 | `:878` | **`:895`** | 入边条件映射（facts[81]） |
| 13 | md:141 | `:918` | **`:940`** | Skipped+入度递减（facts[83]） |
| 14 | md:143 | `:992` | **`:1005`** | error 兜底（facts[84]） |
| 15 | md:147 | `:178` | **`:190`** | IllegalStateException（facts[88]；:178 窗口 173–183 是 `parseBooleanLike` 尾，无抛异常代码，确认错位） |
| 16 | md:148 | `:248` | **`:278`** | IN 算子（facts[90]） |

说明：
- 第 15 项即修错员遗留观察项，亲手核实确认错位（`throw IllegalStateException` 在 192–193 行，:178 窗口覆盖不到）。
- 第 2 项（`:206`）非本次修错引入，但同一句中 `:137` 已修，顺手一并修正。
- 第 5 项原锚点 `:420` 即一审指出的"完全错误"锚点，正文沿用至今，必须拆成两个正确引用。
- 其余 md 行内引用（如 `:152` 的 FOREGROUND 钩子，窗口 147–157 覆盖:157 派发）经核无问题，不动。

### 给修错员

只改上表 16 处 md 行内引用（纯行号替换，不涉及 facts/quality/status）。改完后 parent 核对行号即可，无需第三轮全量复验。`.status.json` 的 `critic` 字段保持留空，待 16 处修正后由 parent 填入复验结论。
