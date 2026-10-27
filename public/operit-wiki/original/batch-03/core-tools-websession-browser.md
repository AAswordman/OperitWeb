---
title: 网页会话·浏览器宿主
module: core
sources: 11
date: 2026-10-01
---

# 网页会话·浏览器宿主

## 概述

- 这是 Operit 网页会话（WebSession）里"看得见、摸得着"的那一半：一个跑在 `TYPE_APPLICATION_OVERLAY` 悬浮窗里的完整浏览器。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:538`
- AI 通过 22 个 `browser_*` 工具操纵它（从 `browser_click` 起），执行器统一调 `ToolGetter.getBrowserSessionTools(context).invoke(tool)` 分发。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1235`
- 每个标签页对应一个 `BrowserToolSession`（WebView 会话），`getSession` 按 id 或当前活跃页定位。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1132`
- 源码钉住 Operit v1.12.2（commit `dbf71916`）。

## AI 速览

- 主入口：`browser_*` 工具 → `StandardBrowserSessionTools.invoke`（注册见 `ToolRegistration`，本目录 9 个文件是它的扩展函数）。
- 核心符号：`WebSessionBrowserHost`（悬浮窗壳）、`WebSessionWebViewHost`（视口/挂载）、`configureWebView`（WebView 配置）、`settleBrowserAction`（动作结算）、`captureSnapshotModel`（可访问性快照）、`BrowserDownloadManager`（下载）、`WebSessionHistoryStore`（书签/历史）、`WebSessionPermissionRequestCoordinator`（权限桥）。
- 数据流向一句话：AI 发 `browser_*` 工具调用 → 扩展函数把动作翻译成注入页面的 JS → `settleBrowserAction` 等待导航/弹窗/下载结算 → `buildBrowserResponse` 把标签页/快照/控制台/弹窗/下载拼成 Markdown 返回。

## 核心机制

### 悬浮窗宿主（WebSessionBrowserHost）

- 展开时是 `TYPE_APPLICATION_OVERLAY` 全屏窗口；收起时窗口缩为 1×1 像素。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:538`
- 收起后屏幕上只留一个 40dp 可拖动小球 `WebSessionMinimizedIndicator`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:629`
- 有外部打开确认待处理时，最小化窗口放大为 248×86 以容纳确认 UI。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:769`
- 收起的障眼法：`DeceptiveMinimizedLayout` 让子视图仍按全屏尺寸测量、自身只占 1×1——页面保持渲染和可交互，用户看不见。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:819`
- 宿主与会话管理层之间用 `Callbacks` 接口通信，共 35 个回调方法。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:54`
- 文本选择：页面长按选词后，宿主通过 `__operitTextSelection` JS 桥与页面脚本通信，绘制高亮与手柄，提供复制/全选/取消。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:448`

### 视口与 WebView 挂载（WebSessionWebViewHost）

- `attachContainer` 把挂载器绑定到指定容器。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionWebViewHost.kt:26`
- `setActiveWebView` 切换活跃 WebView 并设置逻辑视口宽高；`setViewportSize` 可单独改视口。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionWebViewHost.kt:46`
- WebView 按 density-independent pixels 布局：请求的 CSS 视口乘以 density 得到物理像素布局尺寸，再用 scale/translation 等比缩放居中适配手机屏幕。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionWebViewHost.kt:49`

### WebView 配置与会话管理（BrowserWebViewSupport）

- `configureWebView` 开启 JS、DOM storage、多窗口、safeBrowsing、混合内容兼容模式，接受 cookie 与第三方 cookie。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:77`
- 页面内注入 3 个 JS bridge：`BrowserWebDownloadBridge`（`downloadBase64` 把下载请求转 base64 交原生层）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:40`
- `BrowserAsyncBridge` 用 resolve/reject 把 JS 异步结果传回 Kotlin。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:61`
- `BrowserTextSelectionBridge` 把页面的文本选择事件（展示操作条、触感反馈）传回宿主。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:85`
- `onCreateWindow` 拦截新窗口请求，为弹窗新建会话。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:150`
- JS 的 alert/confirm/prompt 被拦截成 `PendingDialog` 挂起，不自动处理。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:50`
- 挂起的弹窗由 `browser_handle_dialog` 工具处理。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1291`
- `shouldOverrideUrlLoading` 分流：blob 交给 blob 下载脚本、data 走内联下载，其余进导航覆盖处理。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:339`
- 以 .user.js 结尾的链接由 `isUserscriptInstallUri` 识别，触发 userscript 安装。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:1094`
- intent 等外部 scheme 由 `handleIntentSchemeOnMain` 处理，走外部打开确认。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:1096`
- 外部打开请求是 `PendingExternalOpenRequest`，必须用户确认；防 intent 劫持：intent 被清洗，component/selector 置空。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:1050`
- `onReceivedSslError` 对任何 SSL 错误直接放行：仅标记会话并在 UI 显示 SSL 徽章。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:380`
- `onRenderProcessGone` 清理会话状态、取消挂起的弹窗与文件选择器、关闭会话并 Toast 提示。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:397`
- `setDesktopModeEnabled` 切换桌面模式：改视口尺寸与 UA，偏好落盘。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:1280`
- `resolveUserAgent` 按桌面模式选择 UA：桌面用伪装 Chrome/Windows 的 UA，移动用移动版。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:972`
- 桌面 UA 还补 `UserAgentMetadata`：platform 填 Windows，brand 填 Chromium/Google Chrome（`DESKTOP_CHROME_MAJOR_VERSION` 为 124）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:999`

### 页面执行：快照、动作、截图（BrowserToolSupport / BrowserPageExecutionSupport）

- `BrowserSnapshot` 存快照：generation/yaml/nodesByRef 三字段。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:19`
- `captureSnapshotModel` 注入 JS 生成可访问性树 YAML，节点用 ref 引用串起 role/name/state。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:649`
- `locatorExpressionForRef` 把快照 ref 转成 Playwright 表达式：role/name 明确时按 role+name 定位，否则回退按 aria-ref 属性定位。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:1159`
- `settleBrowserAction` 做动作结算：等待导航完成、文档 ready、弹窗出现、文件选择器、下载触发，超时标 timedOut。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:450`
- `buildBrowserResponse` 把标签页、页面状态、快照、控制台消息、弹窗状态、下载拼成返回 AI 的 Markdown。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:100`
- `runPlaywrightLikeCode` 在页面里执行 Playwright 风格代码：提供受限 page 对象；goto、goBack、setViewportSize 被禁用并报错指引改用 browser_* 工具。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2638`
- `fillFormFields` 按字段类型分发填充：文本/滑块、复选/单选、下拉各走不同写入方式。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2146`
- `typeIntoElementByRef` 支持输完回车提交，或 35ms 间隔逐字慢速输入。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2260`
- `evaluateJavascriptAsync` 用 callId 把 evaluateJavascript 回调转成可等待的异步结果。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2033`
- `takeScreenshot` 支持视口/整页/元素三种截图，输出到应用缓存的 browser-output 目录，JPEG 质量 92。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2340`
- `captureFullPageBitmap` 整页截图时临时放大 WebView 布局后绘制，布局宽高上限 32768px，超限抛异常。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2404`
- 控制台与网络请求记入 `BrowserConsoleEntry` / `BrowserNetworkRequestEntry` 事件日志。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:37`
- 事件日志上限 500 条（`MAX_EVENT_LOG_ENTRIES`），超限删最旧。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:77`
- `isStaticRequest` 按 Accept 头与扩展名判别静态资源，这类请求不记录 body。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:588`

### 下载管理（BrowserDownloadSupport / BrowserPageExecutionSupport）

- `createDownloadListener` 做下载三路分发：blob、data、http(s) 各走不同通道。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:108`
- `injectDownloadHelper` 注入点击拦截脚本：拦截 blob/data 链接点击，转 base64 后经 JS bridge 交给原生下载。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:884`
- `handleInlineDownload` 处理内联下载：base64 解码写 .part 临时文件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1031`
- `resolveInlineDownloadFileName` 在无文件名时按 mimeType 猜扩展名（图片/音频/视频/pdf/json/xml/csv/zip/html/js/txt，兜底 .bin）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1092`
- `sanitizeFileName` 把文件名中的非法字符换成下划线，空名则用时间戳命名。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1123`
- `BrowserDownloadManager` 单例，任务状态机：排队→连接中→下载中→暂停/完成/失败/取消。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:214`
- HTTP 下载默认 4 线程（`DEFAULT_BROWSER_DOWNLOAD_THREADS`），分段写 .part.N 临时文件后合并。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:38`
- `HttpMultiPartDownloader.probeDownload` 先探测是否支持断点续传与已知长度，决定是否多线程。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:562`
- 下载目录是系统公共 Downloads，重名自动加 (n) 后缀。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:1299`
- 下载请求携带页面 Cookie（`CookieManager` 读取）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:1089`
- 下载完成触发 `MediaScannerConnection` 媒体扫描。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:764`
- 任务状态持久化到 `browser_download_tasks.json`（500ms 节流）；重启后未完成的 HTTP 任务置暂停、内联任务置失败。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:37`
- `FileProvider` 授权打开已下载文件，避免 file:// URI 暴露。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:1227`

### 历史、书签与权限

- `WebSessionHistoryStore` 单例，DataStore `web_session_browser_store` 存 JSON。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:20`
- 历史上限 500 条（`MAX_HISTORY_ENTRIES`），超限截断保留最新。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:28`
- `recordVisit` 记录访问：刷新只更新标题不新增条目。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:63`
- `normalizeUrl` 小写 scheme/host、去默认端口，丢弃 about:/blob:/data: 与非 http(s)。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:205`
- `toggleBookmark` 切换书签；更新标题时同步书签与历史。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:161`
- 桌面模式偏好默认 true（`desktopModeFlow` 读不到时取 true）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:58`
- `WebSessionPermissionRequestCoordinator` 按请求 id 挂起权限请求，弹透明 Activity 用系统弹窗让用户决定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionPermissionRequestActivity.kt:18`
- 权限请求 30 秒超时（`REQUEST_TIMEOUT_MS`），超时或失败全部按拒绝处理。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionPermissionRequestActivity.kt:21`

## 关键符号

- `WebSessionBrowserHost`：悬浮窗宿主。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt:48`
- `WebSessionWebViewHost`：WebView 挂载器，视口缩放适配。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionWebViewHost.kt:11`
- `WebSessionBrowserState`：单标签页的 Compose UI 状态。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHostState.kt:43`
- `WebSessionBrowserHostState`：整个宿主的 UI 状态。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHostState.kt:105`
- `StandardBrowserSessionTools`：browser_* 工具的执行主体（定义在 standard 包）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt:76`
- `settleBrowserAction`：动作结算（等导航/弹窗/下载/超时）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:450`
- `captureSnapshotModel`：可访问性树快照。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:649`
- `buildBrowserResponse`：返回 AI 的 Markdown 组装。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:100`
- `BrowserDownloadManager`：下载任务状态机与持久化。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt:214`
- `WebSessionHistoryStore`：书签/历史/桌面模式偏好持久化。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt:22`
- `WebSessionPermissionRequestCoordinator`：页面权限请求桥，30 秒超时 fail-closed。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionPermissionRequestActivity.kt:18`

## 调用链

1. **工具调用**：AI 调 `browser_click`（如 ref=e3）→ 注册的执行器调 `ToolGetter.getBrowserSessionTools(context).invoke(tool)` 分发。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1235`
2. **会话定位**：`getSession` 优先用参数 sessionId，否则用活跃会话 id。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1132`
3. **标签页注册**：`buildPageRegistry` 组装有序 id、活跃 id、悬浮窗展开态与各会话快照。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1915`
4. **页面执行**：动作被翻译成注入页面的 JS，经 `evaluateJavascriptAsync` 异步求值。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:2033`
5. **动作结算**：`settleBrowserAction` 等待导航完成、文档 ready、弹窗、下载触发，超时标 timedOut。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt:450`
6. **结果返回**：`buildSettledBrowserResponse` 拼出 Markdown 返回 AI。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:1973`
7. **下载链路**：`createDownloadListener` 三路分发 → 内联下载或下载管理器 → 状态落盘。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt:108`
8. **历史链路**：页面加载完成（`onPageFinished`）后记录访问，持久化到 DataStore。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt:322`

## 关联条目

- [[core-tools|工具系统总览]]：本页所属的工具系统总览。
- [[core-tools-websession-userscript|网页会话·用户脚本]]：兄弟页，.user.js 链接触发的 userscript 安装归它管。
- [[core-tools-standard-webchat|标准 WebChat]]：兄弟页，网页会话的另一种宿主形态。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHostState.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionWebViewHost.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionPermissionRequestActivity.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionHistoryStore.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/WebSessionBrowserHost.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserToolSupport.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserWebViewSupport.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserDownloadSupport.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/browser/BrowserPageExecutionSupport.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardBrowserSessionTools.kt`（browser_* 工具定义与常量）
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`（browser_* 工具注册）
