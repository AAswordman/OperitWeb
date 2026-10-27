---
title: 开发调试工具界面（ui-toolbox-dev）
module: 工具箱（toolbox）
sources: 19
date: 2026-10-01
---

# 开发调试工具界面（ui-toolbox-dev）

> 种子范围：`ui/features/toolbox/screens/` 下 shellexecutor（2）/ sqlviewer（4）/ logcat（6）/ uidebugger（5）/ tooltester（1）/ StreamMarkdownDemo.kt（1），共 20 个文件约 5035 行 @ `dbf71916`。
> 走查：代码走查发现 12 条（高 1 / 警告 3 / 建议 8），见 `ui-toolbox-dev.quality.json`。

## 概述

这是 Operit App 里「工具箱」标签页的开发调试工具集合：6 组界面，各自独立。

| 工具 | 入口文件 | 一句话 |
|---|---|---|
| Shell 执行器 | `ShellExecutorScreen.kt` | 输入命令、点运行，在设备上执行 shell |
| SQL 查看器 | `SqlViewerScreen.kt` | 手写 SQL，查 App 的正式数据库 |
| 日志导出 | `LogcatScreen.kt` | 一键把 App 日志存成 txt |
| UI 调试器 | `UIDebuggerScreen.kt` | 悬浮窗圈选界面元素、点击、监听 Activity |
| 工具测试 | `ToolTesterScreen.kt` | 批量跑一遍 AI 工具，看成功还是失败 |
| 流式渲染演示 | `StreamMarkdownDemo.kt` | 演示 Markdown 逐字流式渲染 |

它们有个共同点：都是「开发者给自己造的瑞士军刀」，界面朴素、功能直接。其中 SQL 查看器直接操作正式库、UI 调试器常驻悬浮窗，这两个是全 App 里权限最「重」的调试界面。

## AI 速览

- **核心符号**：`ShellCommandManager`（命令管理）、`SqlTableView`（原生缩放表格）、`SqlViewerViewModel`（SQL 执行）、`UIDebuggerViewModel`（单例，悬浮窗共用）、`UIDebuggerOverlay`（悬浮窗）、`LogcatExportHelper`（日志落盘）、`runTest`（工具测试执行）、`StreamMarkdownDemoScreen`（流式演示）
- **主入口**：6 个 Screen 各自是独立入口，均挂在工具箱导航下；`SqlViewerToolScreen` 只是给 `SqlViewerScreen` 套了个 `CustomScaffold` 的壳（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerToolScreen.kt:11`）
- **数据流向一句话**：用户输入（命令/SQL/点击）→ 各自的 Manager/ViewModel 在 IO 线程干活 → 结果回填到 Compose 界面展示

## 核心机制

### 1. Shell 执行器：命令输入框 + 16 条预设 + 结果卡

`ShellExecutorScreen` 是最简单的结构：顶部命令输入框、中间预设区、底部结果列表（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:83`）。

- **16 条预设命令**分 5 类（系统/文件/网络/硬件/包管理），名称和命令文本都取自 string 资源（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellCommandManager.kt:30`）
- 输入框边输边给建议：`LaunchedEffect(commandInput)` 实时刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:107`），但建议源 `getSuggestedCommands` 读的是永远为空的历史（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellCommandManager.kt:230`）——历史持久化根本没实现（见走查第 4 条）
- 空命令直接返回不执行（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:122`）；执行按钮的启用条件就是输入框非空（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:266`）
- 结果卡用绿/红圆点表示成功失败（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:610`），分三段展示 stdout、stderr、exitCode，非零 exitCode 标红（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:697`）
- 每条结果卡带「重新执行」按钮，直接重跑同一条命令（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:707`）

### 2. SQL 查看器：手写 SQL 查正式库 + 原生手绘表格

这是权限最重的一个：执行的数据库是 `AppDatabase.getDatabase(context).openHelper.writableDatabase`——App 自己的正式库（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:39`）。

- 默认候选表 `chats`/`messages`，输入框预填 `SELECT * FROM chats`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerScreen.kt:51`）
- 两个快捷芯片：一键填「查所有表名」的 `sqlite_master` 语句，一键填 `PRAGMA table_info(chats)` 查表结构（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerScreen.kt:166`）
- **查询/写入两条路**：`select/with/pragma` 开头走查询（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:158`）；其他的一律 `database.execSQL` 直接执行，然后用 `SELECT changes()` 告诉你影响了几行（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:150`）。高危点：DROP/DELETE 点一下就真执行了，没有任何确认框（见走查第 1 条）
- 分页靠字符串拼接 `LIMIT n OFFSET m`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:163`）；「加载更多」用 `append=true` 把新行拼到旧行后面（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:103`）
- BLOB 字段显示成 `BLOB(字节数)`，NULL 显示成字符串 `NULL`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:140`）
- 表格不是 Compose 画的，是原生 `SqlTableView`（View 子类），经 `AndroidView` 嵌入（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerScreen.kt:328`）
- 支持双指缩放（0.6x–2.2x，以手势焦点为锚点）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlTableView.kt:42`）、甩动惯性、只绘制视口内的行列、超宽文本末尾省略
- 触摸时 `requestDisallowInterceptTouchEvent(true)` 防止父容器抢手势（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerScreen.kt:343`）
- 遗留问题：文件里还有一套没人用的纯 Compose 表格手势/绘制代码（`clampOffset` 等，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerScreen.kt:269`），疑似从自绘方案迁到原生 View 后没删干净

### 3. 日志导出：只剩「保存」和「清空」两个按钮

`LogcatScreen` 现在是个极简页面：导出日志文件、清空日志，两个按钮加一个保存中的转圈（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatScreen.kt:24`）。

- 导出在 `Dispatchers.IO` 上跑，文件名带时间戳 `operit_log_yyyyMMdd_HHmmss.txt`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatExportHelper.kt:45`）
- Android Q 及以上走 MediaStore 写进 `Downloads/operit`，以下版本直接写文件系统（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatExportHelper.kt:46`）；文件头带标题、日期、总行数（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatExportHelper.kt:74`）
- 保存按钮用 `_isSaving` 防重复点击，提示 3 秒后自动消失（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatViewModel.kt:33`）
- **注意**：日志列表项 `LogRecordItem`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatComponents.kt:44`）没人用了
- 搜索框 `CompactSearchField`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatComponents.kt:142`）同样零调用
- `LogcatManager` 的日志解析（正则拆时间/级别/tag/消息，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatManager.kt:20`）也是死代码——日志查看列表功能疑似被砍掉，只剩导出

### 4. UI 调试器：悬浮窗圈选元素 + Activity 监听

这是最复杂的一组，4 个文件配合一个悬浮窗服务。

- **启动**：右下角 FAB；有悬浮窗权限就启动 `UIDebuggerService`，没有就跳到系统 overlay 权限设置页（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerScreen.kt:45`）
- **单例 ViewModel**：`UIDebuggerViewModel.getInstance()` 双重检查锁，主界面、悬浮窗、服务三处共用同一份状态（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:48`）
- **抓取界面**：点「分析」→ 先隐藏悬浮窗、等 300ms → 调 get_page_info 工具拿整棵 UI 树（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:148`）
- 树转元素列表经 `convertToUIElements` 递归（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:194`）
- 每个元素用 `UUID` 生成 id，边界从 `[l,t][r,b]` 字符串解析并减去状态栏高度（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:237`）
- **圈选**：悬浮窗上的 `ElementHighlightOverlay` 全屏透明层（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerComponents.kt:427`），点一下就找出包含点击点的最小面积元素
- 选中元素画红色 2dp 矩形框（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerComponents.kt:469`），并弹出信息面板展示类名/文本/资源 id/包名，可复制（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerComponents.kt:483`）
- **点元素**：点选元素后构造 click_element 工具调用，用 `ByResourceId`/`ByText` 选择器定位（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:97`）
- **Activity 监听**：经 `ActionListenerFactory.getHighestAvailableListener()` 取当前设备上权限最高的监听器（无障碍/UsageStats 二选一），权限不足直接返回并提示原因（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:275`）；收到的事件过滤掉本应用自己包名的，只保留最近 100 条（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:413`）
- **输入法技巧**：用一个 1dp 高的隐藏输入框抢占焦点，从而弹出输入法（因为悬浮窗自己拿不到输入焦点）（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/components/ActivityMonitorPanel.kt:117`）；事件列表倒序展示，点击事件用主题色高亮（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/components/ActivityMonitorPanel.kt:312`）

### 5. 工具测试：批量跑 AI 工具的「体检表」

工具测试屏把全 App 的 AI 工具列成网格，一个个跑一遍看是绿是红（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:60`）。

- `runTest` 在 IO 线程调 `aiToolHandler.executeTool(AITool(id, parameters))`，`set_input_text` 这类特殊测试先关弹窗、等 300ms 再请求输入框焦点（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:62`）
- 「一键测试」：`sequential` 组串行跑，其余组并发跑完 join（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:114`）
- 测试文件都写在 `OperitPaths.testPathSdcard()` 目录下；大文件写测试内容是固定字符串重复 12000 遍（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:300`）
- 含外网用例：下载 `picsum.photos/100` 图片、请求 `httpbin.org` 的 get/post（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:305`）——没网的设备上这几项会红
- 详情弹窗里参数超 200 字符截断、结果超 1000 字符截断（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:261`）

### 6. 流式 Markdown 演示：逐字喂字符的渲染 demo

`StreamMarkdownDemoScreen` 是个纯演示页，展示 Markdown 逐字流式渲染效果（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/StreamMarkdownDemo.kt:63`）。

- 用 `Channel<Char>(Channel.UNLIMITED)` 做字符管道，转成渲染器要的流（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/StreamMarkdownDemo.kt:81`）
- 每发一个字符停 `(10/speedFactor)` 毫秒，速度滑杆 0.5x–80x 共 18 档（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/StreamMarkdownDemo.kt:115`）
- 换演示文本（`streamKey` 变化）时重建通道，`DisposableEffect` 关旧通道防泄漏（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/StreamMarkdownDemo.kt:91`）
- 已知 bug：暂停后点「恢复」实际续不上——暂停触发的取消会走进 `finally` 把通道关了，而通道不会重建（见走查第 2 条）

## 关键符号

| 符号 | 位置 | 作用 |
|---|---|---|
| ShellCommandManager | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellCommandManager.kt:17` | Shell 屏的命令管理器：16 条预设、执行、历史（历史实际未落盘） |
| CommandRecord | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:49` | 命令执行记录 |
| PresetCommand | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellExecutorScreen.kt:70` | 预设命令：名称/命令/描述/分类/图标 |
| SqlTableView | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlTableView.kt:17` | 原生手绘表格：缩放 0.6–2.2x、甩动、视口裁剪 |
| SqlViewerViewModel | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:17` | SQL 执行：查询走 query()，写入走 execSQL |
| SqlViewerToolScreen | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerToolScreen.kt:11` | 套壳：给 SQL 屏包一层 CustomScaffold |
| LogcatExportHelper | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatExportHelper.kt:26` | 日志导出：MediaStore/文件系统双路径 |
| LogRecord / LogLevel | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogModels.kt:9` | 日志模型：8 级别，tag 按 hash 生成 hsl 颜色 |
| UIDebuggerViewModel | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:48` | 单例：抓 UI 树、转元素列表、Activity 监听 |
| UIElement | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerState.kt:25` | 调试元素：id/类名/文本/bounds/包名 |
| UIDebuggerOverlay | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerComponents.kt:71` | 悬浮窗：高亮层 + 信息面板 + 控制条 |
| ActivityMonitorPanel | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/components/ActivityMonitorPanel.kt:64` | Activity 事件监听面板，1dp 隐藏框抢输入法焦点 |
| runTest | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:60` | 单个 AI 工具测试执行入口 |
| StreamMarkdownDemoScreen | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/StreamMarkdownDemo.kt:63` | 流式 Markdown 渲染演示 |

## 调用链

1. **Shell 执行**：输入框输入命令 → `executeCommand`（IO 线程）→ AndroidShellExecutor 执行 → 结果回填 → 结果卡展示 stdout/stderr/exitCode（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/shellexecutor/ShellCommandManager.kt:171`）
2. **SQL 查询**：输入 SQL 点运行 → `runQuery` 判语句类型 → 查询走游标转行，写入走 execSQL + changes() 计数 → 表格重绘（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/sqlviewer/SqlViewerViewModel.kt:41`）
3. **日志导出**：点保存 → `saveLogsToFile`（`_isSaving` 防重入）→ 导出助手读日志文件 → Q+ 走 MediaStore，以下走文件系统 → 提示 3 秒消失（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/logcat/LogcatViewModel.kt:33`）
4. **UI 元素抓取**：悬浮窗点「分析」→ `refreshUI` 隐藏悬浮窗 → 300ms 后调 get_page_info 工具拿整棵 UI 树 → 递归转成元素列表（每个元素分配 UUID 做 id）→ 高亮层可点选（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:148`）
5. **元素点击**：点选元素后构造 click_element 工具调用，用 `ByResourceId`/`ByText` 选择器定位，经工具处理器执行（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:97`）
6. **Activity 监听**：点开始监听 → `getHighestAvailableListener` 取监听器 → 事件回调过滤本包名 → 保留最近 100 条 → 面板倒序展示（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/uidebugger/UIDebuggerViewModel.kt:275`）
7. **工具测试**：点测试卡片 → runTest 在 IO 线程调 `executeTool` → 结果按成功/失败着色 → 详情弹窗看截断后的参数与输出（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/tooltester/ToolTesterScreen.kt:80`）
8. **流式演示**：点开始 → 协程逐字 `channel.send`（间隔随速度变化）→ 渲染器消费流展示 → 播完或取消时 finally 关通道（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/StreamMarkdownDemo.kt:105`）

## 来源

- 种子文件 20 个：shellexecutor（`ShellCommandManager.kt`、`ShellExecutorScreen.kt`）、sqlviewer（`SqlTableView.kt`、`SqlViewerScreen.kt`、`SqlViewerToolScreen.kt`、`SqlViewerViewModel.kt`）、logcat（`LogModels.kt`、`LogcatComponents.kt`、`LogcatExportHelper.kt`、`LogcatManager.kt`、`LogcatScreen.kt`、`LogcatViewModel.kt`）、uidebugger（`UIDebuggerState.kt`、`UIDebuggerScreen.kt`、`UIDebuggerViewModel.kt`、`UIDebuggerComponents.kt`、`components/ActivityMonitorPanel.kt`）、tooltester（`ToolTesterScreen.kt`）、`StreamMarkdownDemo.kt`
- 事实清单：`ui-toolbox-dev.facts.json`（137 条，每条精确到行）
- 代码走查：`ui-toolbox-dev.quality.json`（12 条：高 1 / 警告 3 / 建议 8）
- 源码版本：Operit @ `dbf71916`（2026-10-01 核对，HEAD 一致）
