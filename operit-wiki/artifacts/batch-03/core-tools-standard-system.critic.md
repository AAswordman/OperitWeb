# Critic 复核报告：core-tools-standard-system（标准工具·系统操作/多媒体/UI）

- 复核对象：`review/batch-03/core-tools-standard-system.{md,facts.json,quality.json}`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：脚本全量核验 130 条 facts（文件存在 / 行号合法 / symbol 主段 ±5 行命中）+ 字面量深度抽查 23 条可疑 → 逐条人工对照源码；quality.json 10 条逐条核证据；md 结构与引用交叉检查
- **结论：不通过，退回修正**（1 条事实错误 + 1 条走查证据失实 + 7 条引用错位）

## 通过/失败统计

| 项 | 通过 | 需修正 |
|---|---|---|
| facts.json（130 条） | 109 | 8（1 事实错误 + 7 引用错位） |
| quality.json（10 条） | 9 | 1（证据失实，结论成立） |
| md 正文 | 结构/引用基本合格 | 1 处同步事实错误（md:103） |

另有 13 条为同函数内引用距离偏远（证据在同一函数体内、距引用行 >5 行），事实内容经核对无误，md 正文已使用精确行号引用；建议 facts.json 引用向 md 的精确行号对齐，不列入强制退回（清单见文末）。

## 必须修正的问题

### F1（事实错误）：#77 Gatt 回调"TIRAMISU 双版 API"不成立

- 事实原文：`connectBle 经 device.connectGatt(..., TRANSPORT_LE) 连接，连接成功自动 discoverServices()；Gatt 回调同时实现 Android 13（TIRAMISU）前后两版 API`
- 引用：`BluetoothSessionManager.kt:333`，symbol `BluetoothSessionManager.connectBle`
- 问题：前半句属实（`connectGatt(..., TRANSPORT_LE)` 在 :405，`discoverServices()` 在 :347，均在 `connectBle` 函数体内 :333–412）。但后半句**不成立**：`BluetoothGattCallback`（:344–353）没有任何 `Build.VERSION_CODES.TIRAMISU` 分支。文件中三处 TIRAMISU 分支分别是：
  - :171 经典蓝牙广播接收器 `registerReceiver` 的 `RECEIVER_NOT_EXPORTED` 兼容；
  - :223 `getParcelableExtra` 取蓝牙设备对象的兼容；
  - :484 BLE `writeCharacteristic` 新旧 API 兼容。
  没有一处在 Gatt 回调里。writer 把文件内其他位置的版本兼容误安到了 Gatt 回调头上。
- 修正：删除或改写后半句（如实描述三处 TIRAMISU 兼容各自的位置与对象），并同步修正 **md:103**（正文同样写了"Gatt 回调同时实现 Android 13（TIRAMISU）前后两版 API"，引用 `:344`）。

### F2–F8（引用错位：事实内容属实，但引用行指向了错误的函数/类声明行，±5 行内看不到断言依据）

- **#65**（`StandardSystemOperationTools.kt:1262`）：事实捆绑了两个断言——`connectBle` 的 `auto_connect` 默认 false（依据在 :1264，引用有效）+ `discoverBleServices` 的 timeout 默认 `10000L`（依据在 :1287 `discoverBleServices` 函数内，距引用 25 行且跨函数）。修正：拆分事实或把第二断言的引用改为 `:1285`–`:1287`。
- **#67**（`StandardSystemOperationTools.kt:1376`）：`subscribeBleCharacteristic` 的 enable 默认 true（依据 :1378，有效）+ `readBleNotifications` 的 limit 默认 20（依据 :1393–1394 `readBleNotifications` 函数内，跨函数）。修正：同上，limit 断言引用改为 `:1393`。
- **#95**（`StandardUITools.kt:61`）：事实捆绑三断言——APP_PACKAGES 映射表（:62 起，有效）+ `addAppPackages` 可扩展（:253）+ `scanAndAddInstalledApps` 只跑一次（:259–262 双重 `appsScanned` 检查）。后两个依据距引用近 200 行。修正：拆分事实并分别引用 `:253`、`:259`。
- **#106**（`StandardSoftwareSettingsModifyTools.kt:324`）：source_path/source_code 二选一、params_json 默认 `"{}"`、wait_ms 默认 `15000L`（最小 `1000L`）的全部依据都在 `executeSandboxScriptDirectResult`（:334 起，见 :336–351）；而 :324 的 `executeSandboxScriptDirect` 只是透传 wrapper，窗口内无任何依据。修正：引用改为 `:334`（symbol 建议同步改为 `executeSandboxScriptDirectResult`）。
- **#81**（`StandardFFmpegTool.kt:17`）：`"Command cannot be empty"` 在 :30（`invoke` 内）；:17 是类声明行。修正：引用改为 `:22`–`:23`（`invoke` 声明行）。
- **#83**（`StandardFFmpegTool.kt:92`）：`getVersion()`/`getBuildDate()` 在 :97–103（`invoke` 内）；:92 是类声明行。修正：引用改为 `:97`。
- **#91**（`StandardMusicPlaybackTools.kt:334`）：状态机字符串断言中 `playbackState` 字段声明在 :334（有效），但 `requirePlayer` 抛 `IllegalStateException("No active music playback session")` 在 :549–551，距引用 215 行。修正：拆分事实，throw 断言引用改为 `:549`。

### Q3（走查证据失实）：quality.json #3

- 标题：FFmpeg 转码命令直接拼接输入路径，引号可注入额外参数（warning/medium）
- `file`/`line`：`StandardFFmpegTool.kt:142`
- 问题：`evidence` 字段引用了 `val command = buildFFmpegCommand(inputPath, outputPath, videoCodec, audioCodec, resolution, bitrate)`——**该符号在全仓源码中不存在**（`grep -rn buildFFmpegCommand` 零命中），证据为虚构或来自错误版本。
- 结论本身成立：真实代码为 `val commandBuilder = StringBuilder("-i \"$inputPath\"")`（约 :171）逐项 `append` 参数（含 `commandBuilder.append(" \"$outputPath\"")` 约 :190），最终 `FFmpegKit.execute(command)`，用户可控路径仅被双引号包裹、可注入额外参数。
- 修正：用真实代码行替换 `evidence`，`line` 改为实际拼接行（:171 附近）。

## 走查其余 9 条核验结果

- #0（shell 危险命令子串匹配）：证据真实，`command.contains("rm -rf") || command.contains("format")` 实际在 :91（记录为 :89，差 2 行，窗口内可见，可接受）。
- #1（终端会话命令无危险过滤）：结论成立（全文件无 `validateParameters`/危险串匹配）；但 `evidence` 引的是 timeout 解析代码，与"无过滤"的断言关联弱，建议换为命令直达 `terminal.executeCommandFlow` 的证据行或注明"经全文件 grep 确认无过滤"。
- #2（广播任意 action）：证据真实（仅判空 `action.isBlank()`）。
- #4（GlobalScope.launch 超时）：真实（:1554 起）。
- #5（invokeOnCancellation 内 runBlocking(Dispatchers.Main)）：真实（:1571 起）。
- #6（通知 id 时间戳低 31 位）：真实（:195）。
- #7（"Build configuration" 标签实际取 build date）：真实（:103，`getBuildDate()`）。
- #8（MCP 重启 delay(250) 忙轮询）：真实；`line` 记为函数声明行 :1823，证据为循环体，建议 `line` 改为 :1858（`while (true)` 行）。
- #9（扫描失败仍标记已扫描）：真实（:259 起，`finally { appsScanned = true }`）。

## md 正文核验

- 六节齐全（概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源）；`## AI 速览` 含主入口清单、核心符号清单、数据流向一句话，齐全。
- md 共 226 个去重 `file:line` 引用，普遍比 facts.json 更精确（如 take(100) 直接引 :182、通知 id 引 :195），抽查未发现超出 facts 的断言；调用链 7 条均为"输入 → 处理 → 输出"结构，引用有效。
- 唯一问题：md:103 重复 F1 事实错误，需随 facts #77 同步修正。

## 次要建议（不强制退回）

以下 13 条事实内容经人工核对无误，证据在同一函数体内但距引用行超过 ±5 行；md 正文已用精确行号引用，建议 facts.json 引用向 md 对齐：#12（:84→:91）、#22、#35（:88→:108）、#37（:197，chunk emit 在 :284）、#38（:342→:367）、#40（:691，控制码语义在 :717–730）、#44（:138→:182）、#55（:666→:678）、#99（:407→:474）、#100（:612；20×500ms 在 helper :562–572 内，结论属实）、#104（:177→:200）、#107（:334→:411）、#127（:1823；0.999 轮询在 :1861，结论属实）。

## 退回修正清单（writer 必做）

1. 修正 facts.json #77（删除/改写 TIRAMISU 后半句）并同步修正 md:103。
2. 修正 facts.json #65、#67、#95、#106、#81、#83、#91 的引用行号（或拆分事实），使每条断言的依据落在引用 ±5 行内。
3. 修正 quality.json #3 的 `evidence` 为真实代码行（`StringBuilder("-i \"$inputPath\"")` 及 `append(" \"$outputPath\"")`），`line` 指向实际行。
4. 建议同步修正 quality.json #1、#8 的证据/行号（不强求）。
5. 修正后重新跑 lint（引用行号变化可能影响 lint），保持 0 硬失败 / 0 警告。

## 修正记录（2026-10-01）
- F1 事实错误已纠正：idx77 拆成两条——connectBle 经 TRANSPORT_LE 连接+自动 discoverServices（:333）；TIRAMISU 分支在广播接收器注册/getParcelableExtra/BLE 写特征三处，BluetoothGattCallback 无版本分支（:171）。正文 :344 虚假行同步修正，拆成四行独立引用（:171/:223/:484/:344），lint 0 警告。
- F2–F8 引用错位已修正：idx65 拆 :1262/:1287；idx67 拆 :1376/:1393；idx95 拆 :61/:253；idx106→:334；idx81→:30；idx83→:102；idx91→:549。修正前已用脚本逐条验真新行号。
- Q3 证据失实已替换：虚构的 buildFFmpegCommand(...) 改为真实代码 `val commandBuilder = StringBuilder("-i \"$inputPath\"")`（:176）。
- 顺手：Q1 证据换成 executeCommandInSession 函数头（:88）；Q8 line 改为 while(true) 实际行 :1859。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
