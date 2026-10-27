# Critic 复核报告：core-tools-system（标准工具·系统操作）

- 复核对象：`review/batch-04/core-tools-system.{facts,quality,md,status}.json`
- 源码钉：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已验证本地 HEAD 一致）
- 复核方式：127 条 facts 逐条抽 `ref ±5` 行窗口对照源码；quality 11 条 evidence 逐字 diff；md 按 §9 双受众结构检查。

## 结论：退回修正

facts 有 42 条引用问题（16 条严重错位/复合事实，26 条轻微行号漂移），md 正文有 2 处事实错误。
quality.json 11 条全部成立（含 high 级 wipe 项），status.json 完全正确。

---

## 一、facts.json：127 条中 85 条通过，42 条有问题

### 严重问题（16 条：引用指向错误目标或复合事实一个引用撑不起）

| # | 断言 | 当前 ref | 问题 | 正确 ref |
|---|------|----------|------|----------|
| 31 | startProcess 返回基于 Runtime.exec 的 StandardShellProcess | `:98`（空行） | ref 指向空行；"基于 Runtime.exec"证据在 StandardShellProcess 类内 | `:99`（函数）或 `:223`（类） |
| 38 | startProcess 无 Root 权限时抛 SecurityException | `:530` | 指向 ExecRootShellProcess 的 `isAlive` getter，完全无关 | `:477`（函数）/`:481`（throw） |
| 39 | LibSuShellProcess 用 CallbackList 把输出送入 256 容量 Channel | `:553` | 指向 ExecRootShellProcess 的类注释，张冠李戴 | `:495`（类）/`:496`（Channel） |
| 101 | ActionEvent 含 timestamp/actionType/… | `:40` | 指向 hasPermission 的 KDoc，ActionEvent 在 54 行 | `:54` |
| 103 | ElementInfo 含 resourceId/className/… | `:52` | 指向空行，ElementInfo 在 78 行 | `:78` |
| 112 | 把监听器事件广播给 eventCallbacks 所有回调 | `:105` | 指向 private startListeningWithListener 的 KDoc，广播逻辑在 123 行 | `:123` |
| 120 | handleDetectedTouchEvent DOWN/UP→CLICK、MOVE→SWIPE | `:275` | 指向函数结尾 `}`，映射在 283–287 行 | `:283` |
| 119 | 窗口焦点变化转为 SCREEN_CHANGE 事件 | `:225` | 只有 KDoc，事件构造在 237–238 行 | `:229` |
| 122 | 无障碍事件类型映射表 | `:123` | 指向 2048 过滤注释行，映射表在 129–136 行 | `:129` |
| 125 | handleScreenLockEvent 产生 SYSTEM_EVENT 锁屏事件 | `:157` | 指向 stopAdminEventMonitoring 的 KDoc | `:166` |
| 126 | isAvailable 恒 true，只能监听应用内触摸按键 | `:29` | 指向 initialize()，isAvailable 在 23 行；"应用内"见 84/92 行注释 | `:23` |
| 45 | 后台命令创建成功即返回成功 | `:353` | 只是 `isBackground` 判定行，返回成功逻辑在 373–389 行 | `:374` |
| 48 | 只支持 lockscreen 与 wipe 两种命令 | `:114` | ±5 窗口只覆盖 lockscreen 分支，wipe 分支在 123–124 行（一个引用撑两个断言） | `:123`（或拆两条） |
| 37 | checkExecSuAvailable 用 `su -c id` 输出含 uid=0 判断 | `:164` | 只是函数签名，`uid=0` 判定在 178 行 | `:178` |
| 94 | isInstalled/getInstalledVersion 检查安装及版本 | `:26` | 复合事实：getInstalledVersion 在 35 行，窗口不含 | 拆条或改 `:35` |
| 78 | 透明 Activity，用 REQUEST_CODE_CAPTURE=1001 | `:20` | 复合事实："透明"见 AndroidManifest 308–309 行（Theme.Translucent.NoTitleBar），ref 只支撑 REQUEST_CODE | 补 manifest 引用 |

### 轻微问题（26 条：断言属实但 ref 行号漂移，证据在 ±5 窗口之外）

| # | 建议修正 |
|---|----------|
| 0 | "5 种权限级别"在 `:7`±5 无支撑 → 引 AndroidPermissionLevel 或弱化措辞 |
| 9 | `denied(reason)` 在 `:67`，窗口到 66 → 改 `:67` |
| 33 | `useExecMode` 控制双模式的用法在 113–117 行 → 改 `:113` |
| 40 | `:27` 是空行 → 改 `:28`/`:29` |
| 53 | isRooted/hasRootAccess StateFlow 在 30–35 行 → 改 `:31` |
| 54 | 4 种检测方法在 isDeviceRooted 函数体 191–230 行 → 改 `:191` |
| 56 | `su --version` 执行在 `:269` → 改 `:269` |
| 62 | `Shizuku.checkSelfPermission()` 调用在 `:240` → 改 `:240` |
| 65 | 复制到 cacheDir 见 `:38` → 改 `:38` |
| 67 | `ACTION_VIEW` 在 `:104` → 改 `:104` |
| 69 | 版本大小比较在 ~231 行 → 改 `:231` |
| 79 | "Android 14 上先起前台服务"是代码注释说法（:47），代码中无版本门检查 → 建议注明"按代码注释" |
| 84 | `getInstance` 在 `:37` → 改 `:37` |
| 87 | "先订阅再发命令"逻辑在 111–127 行 → 改 `:112` |
| 93 | `fetchLatestReleaseInfo` 在 44–46 行 → 改 `:44` |
| 105 | 五个监听器创建在 30–34 行 → 改 `:30` |
| 108 | `getInstance` 在 `:30` → 改 `:30` |
| 113 | `registerStateChangeCallback` 在 `:201` → 改 `:201` |
| 115 | getevent 重启逻辑在 166–168 行 → 改 `:166` |
| 116 | BTN_TOUCH 检查在 192–194 行 → 改 `:194` |
| 30 | 操作符 `\| & > < ;` 的检测在函数体下方 → 改 `:172` 附近 |
| 18 | `clearCache(null)` 签名在 `:116`（KDoc 说明 null=清全部）→ 当前 `:124` 窗口可接受，建议 `:116` |
| 121 | 2048 过滤在 123–124 行 → 改 `:123` |
| 35 | `setExecutable(true)` 在 `:287` → 当前 `:265` 窗口外，建议 `:287` |
| 36 | launcher 降权执行命令拼接在 ~385 行 → 建议 `:385` |
| 43 | retry 只重试 `InterruptedIOException`+`read interrupted` 的过滤在 187–190 行 → 改 `:187` |

其余 85 条：文件存在、行号有效、±5 窗口完全支撑断言，通过。

## 二、quality.json：11 条全部通过，0 问题

- 11 条 evidence 与源码逐字 diff 全部一致（无虚构）。
- **high 级 wipe 项属实**：`AdminShellExecutor.kt:123` `command.startsWith("wipe")` → `:124` `devicePolicyManager.wipeData(0)` 直接调用，无任何二次确认；前缀匹配意味着 `wipexxx` 误输入同样触发。severity=high、confidence=high 合理。
- 其余逐条已验真：
  - warning·死代码：`handleAccessibilityEvent` 为 private 且全仓库无调用点（grep 确认）；`startListening` 只置回调不注册，注释"直接启动监听，不需要注册回调"自证。
  - warning·Shizuku 监听器移除传新 lambda：`removeRequestPermissionResultListener { _, _ -> }` 按实例匹配，移除为空操作，属实。
  - warning·StandardShellExecutor 先 waitFor 再读流：管道缓冲耗尽时经典双向死锁，属实。
  - warning·AdminActionListener 空监控：`startAdminEventMonitoring` 只有日志，`startListening` 仍返回 success，属实。
  - warning·checkKernelSu：`return isKernelSu || exitCode == 0`，名不副实，属实。
  - warning·Terminal.executeCommand `deferred.await()` 无超时 vs executeHiddenCommand 120000ms，属实（confidence medium 合理）。
  - suggestion·executors 无同步、suggestion·`contains(">")` 朴素检测、suggestion·Channel 256 DROP_OLDEST、suggestion·getevent 紧循环重启：均属实，confidence medium 合理。

## 三、正文 core-tools-system.md

§9 双受众结构完整：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制 / 关键符号 / 调用链（4 条，均编号输入→处理→输出）/ 来源；术语首现基本有解释；符号名保留英文原文。**但有 2 处事实错误**：

1. 概述"目录里 27 个文件、6145 行代码"——实际 28 个 kt 文件（6145 行无误）。
2. 关键符号 `ActionListener.ActionEvent（:40）`——实际在 `:54`（与 facts #101 同一错位）。

另有 1 处轻微：`ActionListener（:8）`实际 interface 在 `:6`。

## 四、status.json：正确

`id=core-tools-system` / `issue=24` / `status=review-pending` / `source_repo="operit"`（小写✓）/ `source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（与本地仓库 HEAD 一致✓）。

---

**修错清单（给修错员）**：按上表把 42 条 facts 的 ref 改到正确行号（16 条严重错位的必须改，26 条轻微漂移建议改），md 正文改"28 个文件"与 ActionEvent `:54`。quality.json 与 status.json 不动。

---

## 复检（2026-10-01 14:00 CST，修错后复验）

**结论：退回修正 2 处（其余全部通过）**

### 复验方法
- 程序化全量校验：135 条 facts 的 ref 文件存在、行号不越界、反引号符号落在 ±5 窗口内 → **134/135 通过，1 失败**。
- 人工 sed 逐条核实 16 条严重错位项的窗口 + 6 处拆分（#31/#54/#78/#94/#126/#30）+ 正文 3 处。

### 通过项
- 16 条严重错位：#31（拆分为 idx34 :99 / idx35 :223，窗口均完全支撑）、#38（idx42 :481，`throw SecurityException` 在窗内）、#39（idx43 :495，LibSuShellProcess 类/256 Channel/CallbackList 全在窗内）、#101（idx108 :54）、#103（idx110 :78）、#112（idx119 :123，`eventCallbacks.values.forEach` 在窗内）、#120（idx127 :283，DOWN/UP→CLICK、MOVE→SWIPE 在 287–288 行，窗口 278–288 覆盖）、#122（idx129 :129，映射表在窗内）、#125（idx132 :166，handleScreenLockEvent + SYSTEM_EVENT 在窗内）、#126（拆分为 idx133 :23 / idx134 :88）、#45（idx49 :374，`if (isBackground)` + "进程创建成功即视为成功"注释在窗内）、#94（拆分为 idx100 :26 / idx101 :35）、#78（拆分为 idx83 manifest :309 / idx84 :20），全部通过。
- #48（idx52）：修错员用 `:118` 而非 critic 建议的 `:123`——窗口 113–123 同时覆盖 lockscreen（114–115）与 wipe（122–123）两分支，比 :123 更居中，**接受**。
- 26 条轻微漂移：程序化校验全部通过（符号均在窗口内）。
- 正文 3 处："28 个文件"✓、`ActionListener.ActionEvent`（:54）✓、`ActionListener`（:6，interface 实测在 6 行）✓。

### 未通过条目（2 处）
1. **idx41（critic #37）**：断言"用 `su -c id` 输出含 uid=0 判断 su 可用"，ref :178 的 ±5 窗口（173–183）含 `uid=0` 判定（178）与"exec su可用性检查"日志（179），但反引号符号 `` `su -c id` `` 字面不在窗口内——源码实际是 `buildSuExecCommand("id")`（166 行），`su -c id` 只是默认 su 命令下的等价描述。建议：去掉反引号改述，或拆成两条（:166 执行命令 / :178 输出判定）。
2. **idx126（critic #119）**：断言"把窗口焦点变化转为 SCREEN_CHANGE 事件"，ref :229 的 ±5 窗口（224–234）覆盖焦点检测（230–231），但 `SCREEN_CHANGE` 构造实际在 **239 行**，落在窗口外（注：原 critic 建议的 :229 本身也有 10 行偏差）。建议：ref 改为 `:235`，窗口 230–240 同时覆盖焦点检测与 SCREEN_CHANGE 构造。

两处断言语义均为真，属引用锚点微调。修完重跑 lint 到 0/0 即可，无需重走全文复核。
