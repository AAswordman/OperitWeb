# Critic 复核报告：core-tools-websession-browser（网页会话·浏览器宿主）

- 复核人：独立 critic（与 writer 无关）
- 复核时间：2026-10-01
- 源码钉死：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 git rev-parse 确认）
- 复核对象：`review/batch-03/core-tools-websession-browser.{facts.json,md,quality.json}`

## 核验方法

1. 自写脚本全量跑 60 条 facts：引用文件存在、行号在文件总行数内、±5 行窗口内可见断言符号 → **60/60 机械通过**。
2. 对高风险断言逐条人工语义核对源码（回调计数、SSL 放行、bridge 注册、248x86、FileProvider 位置、桌面 UA、下载重启恢复、aria-ref、sanitizeFileName 兜底等）。
3. quality.json 4 条走查证据行号逐条核对源码原文。
4. md 正文逐段检查：断言是否超出 facts、## AI 速览（主入口/核心符号/数据流向一句话）是否齐全、关联条目与调用链引用是否真实。

## 结论：**不通过，需退回修正** —— 2 处真实事实错误

### 失败 1：Callbacks 回调数量 36 → 实为 35

- 事实原文（facts.json #22，index 20）：「WebSessionBrowserHost.Callbacks 接口暴露 36 个回调，是宿主与会话管理层之间的事件总线」
- 引用：`WebSessionBrowserHost.kt:54`，symbol `Callbacks`
- 问题：用正则提取 `interface Callbacks { ... }` 函数体逐个计数，实际 **35 个**方法（onNavigate、onBack、onForward、onRefreshOrStop、onSelectTab、onCloseTab、onNewTab、onMinimize、onCloseCurrentTab、onCloseAllTabs、onToggleBookmark、onRemoveBookmark、onSelectSessionHistory、onOpenUrl、onClearHistory、onToggleDesktopMode、onOpenUserscripts、onImportUserscript、onInstallUserscriptFromUrl、onConfirmUserscriptInstall、onCancelUserscriptInstall、onSetUserscriptEnabled、onDeleteUserscript、onCheckUserscriptUpdate、onInvokeUserscriptMenu、onPauseDownload、onResumeDownload、onCancelDownload、onRetryDownload、onDeleteDownload、onOpenDownloadedFile、onOpenDownloadLocation、onConfirmExternalOpen、onCancelExternalOpen、onHandlePendingDialog）。writer 自检声称把「40+ 修正为 36」，但正确值是 35，依然错。
- 连带：正文 `.md`「悬浮窗宿主」节「宿主与会话管理层之间用 `Callbacks` 接口通信，共 36 个回调方法」同样错误，需同步改为 35。

### 失败 2：FileProvider 断言的引用行号错位（窗口内无依据）

- 事实原文（facts.json #56，index 55）：「打开已下载文件经 FileProvider 授权，避免 file:// URI 暴露」
- 引用：`BrowserDownloadSupport.kt:1077`，symbol `startBrowserManagedDownload`
- 问题：`:1077` 是 `startBrowserManagedDownload`（负责携带 UA/Cookie/Referer 发起下载），±5 行内没有任何 FileProvider 相关代码。`FileProvider.getUriForFile` 实际在 `openDownloadedFile` 函数内，**行号 :1227**。该条属于引用窗口违规：断言依据在引用窗口外不可见。
- 修正：ref 改为 `BrowserDownloadSupport.kt:1227`，symbol 改为 `openDownloadedFile`。正文 `.md` 此处引用的是 `:1227`，正确，无需动。

## 通过项（59/60 facts，全部语义抽查通过）

抽查通过的关键断言（均已对源码原文确认）：
- 22 个 `browser_*` 工具注册（ToolRegistration 去重计数 22，与正文/事实列出的名单一致）
- `onReceivedSslError` 直接 `handler.proceed()`（:380，quality 高危证据原文逐行吻合）
- 3 个 JS bridge 经 `addJavascriptInterface` 在 configureWebView 内注册（:136-138，quality 警告证据吻合）
- `browser_download_tasks.json` 明文落盘（含 Cookie 的 headers，quality 警告证据吻合；:37）
- 快照 aria-ref 写入 DOM（`ref = "e" + nextRef++`，:742，quality 建议证据吻合；:740）
- 桌面 UA：`DESKTOP_CHROME_MAJOR_VERSION = "124"`、视口 1280x720、brand Chromium/Google Chrome
- 最小化窗口：`params.width = 1; params.height = 1`（:378-379），子视图按全屏测量（setMinimizedMeasure）；外部打开确认时指示器 248x86（dp(248)/dp(86)）
- 下载重启恢复：非 HTTP 未完成 → FAILED（normalizeRestoredTasks），HTTP 活跃/挂起 → PAUSED；500ms 持久化节流
- `download_file` 携带 UA/Cookie/Referer（:1086-1093）
- `REQUEST_TIMEOUT_MS = 30_000L`、超时按拒绝处理、onDestroy 取消挂起请求
- `page.goto/goBack/setViewportSize` 在 run_code 沙箱内显式禁用并抛错指引
- `sanitizeFileName` 空名用时间戳兜底（正文新增断言，有源码依据）
- `buildSettledBrowserResponse` :1973、`isUserscriptInstallUri` :1093（正文 :1094，差 1 行可接受）、`PendingDialog` :51（正文 :50，可接受）

## 正文检查

- `## AI 速览` 齐全：主入口（browser_* → StandardBrowserSessionTools.invoke）、核心符号清单、数据流向一句话。
- 正文断言均有 facts 或源码直接支撑，未发现超出事实的发挥；「sanitizeFileName 空名时间戳命名」是正文超出 facts 的唯一增量断言，但源码依据真实（:1123-1127），建议同步补一条 fact 而非删除。
- 次要瑕疵（不计失败，供 writer 顺手修）：正文「`browser_handle_dialog` 工具处理」引用 `ToolRegistration.kt:1291`，实际 `name =` 在 :1286（差 5 行，仍在同一 registerTool 块内）。

## 退回修正清单

1. facts.json #22 与正文「共 36 个回调方法」→ 改为 **35**。
2. facts.json #56：ref → `BrowserDownloadSupport.kt:1227`，symbol → `openDownloadedFile`。
3. （建议）正文 `browser_handle_dialog` 引用 :1291 → :1286；正文 sanitizeFileName 时间戳兜底补一条 fact。

修正后需重新跑 lint（引用行号变了）并再次送 critic 确认，方可进入后续流程。

## 修正记录（2026-10-01）
- Callbacks 数量 36→35：facts #20 与正文已同步修正（独立复核源码 55–89 行共 35 个 fun）。
- FileProvider 引用：facts #54 ref 改为 BrowserDownloadSupport.kt:1227，symbol 改为 openDownloadedFile。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
