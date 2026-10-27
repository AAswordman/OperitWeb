# 第二名独立 critic 复验报告：services-system（Issue #78）

- 复验对象：`review/batch-06/services-system.{md,facts.json,quality.json,lint.md,status.json}`（修错后）
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 HEAD 一致）
- 复验范围：第一名 critic 7 项清单逐项源码复核 + facts 随机 20 条（seed=78）±5 窗口核对 + quality 11 条 evidence 全部逐字比对 + status.json/禁用词合规

## 一、7 项修正复验（6 项到位，1 项仍有残留）

| # | 项目 | 复验结论 |
|---|------|---------|
| 1 | facts[57] 改写+锚 :514 | **残留**：窗口（509–519）只覆盖 when + FULLSCREEN/SCREEN_OCR（:510）+ BALL/VOICE_BALL（:519），WINDOW（:536）、RESULT_DISPLAY（:559）不在窗口内（见第二节） |
| 2 | facts[49] 锚 :157→:154 | PASS：`:154` 即 `fun getChatCore()` 定义行，窗口完整支撑 |
| 3 | facts[93] 改写+锚 :46 | PASS：窗口（41–51）覆盖 `isExpanded = mutableStateOf(false)` 与 "Floating ball position state" 注释 |
| 4 | quality[9] line 213→215 | PASS：`:215` 即 `(application as OperitApplication).initializeMainApplication()`，逐字命中 |
| 5 | quality[10] line 38→40 | PASS：`:40` 即 `return super.onGetSupportedVoiceActions(voiceActions)`，逐字命中 |
| 6 | quality[4] 删除"互相拉活" | PASS：已改为单向绑定表述（BIND_AUTO_CREATE），全文无"互相拉活"，evidence `:77` 逐字命中 |
| 7 | quality[1] 软化"几乎无法彻底关闭" | PASS：已改为"划掉任务会触发复活；彻底停止需经窗口内关闭按钮走 onClose→stopSelf()（:716）"，`:716` 即 `stopSelf()` 行，evidence `:556` 逐字命中 |

## 二、复验中新发现 3 处残留问题（断言均为真，均为机械修正）

### R1. facts[95]：ref 文件错误（必须修）

- fact："UIDebuggerWindowManager 的关闭回调会调用 UIDebuggerService.stopSelf()。"
- 当前 ref：`app/src/main/java/com/ai/assistance/operit/services/UIDebuggerService.kt:95`
- 该文件 `:95` 的 ±5 窗口是 `onDestroy()`（`super.onDestroy()` / `lifecycleOwner.handleLifecycleEvent(ON_DESTROY)` / `isServiceRunning.value = false`），**窗口内无任何 stopSelf 调用，完全不支持断言**。
- 真实代码在 **`app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:95`**：`(context as? UIDebuggerService)?.stopSelf()`。
- 佐证：本页正文第 146 行用的正是 `services/floating/UIDebuggerWindowManager.kt:95`，与 facts ref 自相矛盾。
- 修正：ref 文件改为 `services/floating/UIDebuggerWindowManager.kt:95`（断言文字不动）。

### R2. facts[85]：窗口支撑不全（必须修）

- fact："UIDebuggerService 是把 UI 调试器做成悬浮窗的前台服务。" ref `:28`。
- `:28` 的 ±5 窗口（23–33）只覆盖 docstring（"managing the UI Debugger floating window"）与 `class UIDebuggerService : Service()` —— 支撑"UI 调试器悬浮窗"，**不支持"前台服务"**（`startForeground` 在 `:84`，差 56 行）。
- 正文第 138 行用的 `:30` 同样够不着 `:84`。
- 修正：拆成两条原子事实 —— (a) "UIDebuggerService 是把 UI 调试器做成悬浮窗的服务"，锚 `:30`；(b) "UIDebuggerService 调用 startForeground 以前台服务方式运行"，锚 `:84`。

### R3. facts[57]：窗口支撑不全（必须修）

- fact："FloatingWindowManager.createLayoutParams 将 6 种 FloatingMode 按 4 组分支（FULLSCREEN/SCREEN_OCR 共用、BALL/VOICE_BALL 共用、WINDOW、RESULT_DISPLAY）生成窗口尺寸与 flag"，锚 `:514`。
- `:514` 的 ±5 窗口（509–519）覆盖 `when`（:509）、FULLSCREEN/SCREEN_OCR（:510）、BALL/VOICE_BALL（:519），但 **WINDOW（:536）、RESULT_DISPLAY（:559）不在窗口内**。枚举了 4 组分支却只给 2 组证据，违反"±5 完整支撑"铁律（无任何单锚能同时覆盖 :510–:559，共 49 行）。
- 修正：拆成 4 条原子事实 —— (a) FULLSCREEN/SCREEN_OCR 共用分支，锚 `:510`；(b) BALL/VOICE_BALL 共用分支，锚 `:519`；(c) WINDOW 分支，锚 `:536`；(d) RESULT_DISPLAY 分支，锚 `:559`。

拆分后 facts 127 → 132（R2 +1，R3 +3），`status.json` 的 `refs_valid` 需同步为 132。

## 三、抽查与合规（其余全部 PASS）

- **facts 随机 20 条**（104/24/12/38/118/85/93/111/32/95/54/115/4/83/18/113/51/98/84/89）：行号全部界内；除 R1/R2/R3 外，±5 窗口全部完整支撑断言（含数字断言：200 条通知上限、EXTRA_WAKE_LAUNCHED="WAKE_LAUNCHED"、dataSync 前台类型、200/250 宽高钳制、30/60/60 超时、0.3~1.0 缩放钳制、FOLLOW_GLOBAL 缺省、onTaskRemoved startService 自重启）。
- **quality 11 条**：evidence 11/11 源码逐字命中（首行全部落在 file:line ±5 窗口内）；5 warn（划掉任务复活、前台服务+WakeLock 耗电、系统级悬浮窗、崩溃后自动重启、通知滥用）全部实锤成立，severity 无夸大；6 suggestion 分级恰当。
- **status.json**：id=services-system、issue=78、source_repo=operit、source_commit=dbf71916…、status=review-pending、refs_valid=127（=当前数组长度，修错后需同步为 132）——字段全对。
- **禁用词**：5 个交付文件全文"通过/批准/LGTM" 0 命中。
- **格式**：facts/quality 顶层数组；severity 仅 warn/suggestion。
- **lint**：修错员报告 0 硬失败 / 0 警告（未独立重跑，交付文件无变化部分不影响）。

## 四、修错清单（给修错员）

1. facts[95]：ref 文件改为 `app/src/main/java/com/ai/assistance/operit/services/floating/UIDebuggerWindowManager.kt:95`（行号不变，断言不动）。
2. facts[85]：拆两条 —— (a) 锚 `:30`（UI 调试器悬浮窗服务）；(b) 锚 `:84`（startForeground 前台服务）。
3. facts[57]：拆四条 —— 锚 `:510` / `:519` / `:536` / `:559`，每条只讲本组分支。
4. `status.json` refs_valid 同步为拆分后的实际条数（127→132）。
5. 修正后隔离 lint 必须 0 硬失败 / 0 警告；全文禁"通过/批准/LGTM"。

## Verdict：FAIL（3 项机械修正，断言本身全部验真）

critic 只写了本报告，未修改任何交付文件。
