---
title: 工具包 Compose DSL 渲染
module: ui-common / app
sources: 6
issue: 108
date: 2026-10-01
---

# 工具包 Compose DSL 渲染（ui-common-dsl）

> 人话：工具包（Tool Package）作者用一段 JS 脚本描述界面（DSL），App 把这段脚本跑起来、变成原生 Compose 界面。用户点的每个按钮、敲的每个字都会回传给 JS，JS 算出新界面再渲染——一个"JS 驱动 UI"的迷你前端框架。

## AI 速览

- 核心符号：`ToolPkgComposeDslScreen`（渲染屏）、`renderComposeDslNode`（节点分发）、`ToolPkgComposeDslNode`（节点树）、`dispatchActionInternal`（动作派发）、`ComposeDslWebViewHostRegistry`（WebView 宿主注册表）、`ToolPkgComposeDslDebugSnapshotStore`（调试快照）、`ComposeDslTextInputDispatchQueue`（文本输入串行队列）
- 主入口：`ToolPkgComposeDslToolScreen.render()`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1257`）
- 数据流向：JS 脚本执行 → 解析为节点树 → 递归分发渲染为 Compose UI → 用户交互派发动作回 JS → 新树重渲染

## 核心机制

### 渲染管线：脚本 → 节点树 → Compose

1. 输入：DSL 屏组合后调用 `render`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1257`）。
2. 处理：调用 `executeComposeDslScript` 执行 DSL 脚本（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1310`）。
3. 解析：`parseRenderResult` 把脚本返回值解析为节点树（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1318`）。
4. 输出：整轮渲染在 `renderMutex` 的 `withLock` 内串行执行（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1036`）。
5. 快照：每次结果写入 `ToolPkgComposeDslDebugSnapshotStore` 的 `update`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:941`）。

重渲染请求走 `requestComposeDslTreeRerender`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1029`）。
非立即重渲染用 `withFrameNanos` 等到下一帧再执行，避免一帧内多次渲染（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1034`）。

### 节点分发：手写节点优先，自动生成兜底

`renderComposeDslNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2075`）的分发顺序是硬编码的优先级链。

1. 类型 `aichat` 命中第一条分支，交给 `renderAiChatNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2095`）。
2. `renderAiChatNode` 直接嵌入 `AIChatScreen`（`embedded = true`）（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2482`）。
3. 类型 `adaptivesidepanel` 命中分支，交给 `renderAdaptiveSidePanelNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2099`）。
4. 类型 `canvas` 命中分支，交给 `renderCanvasNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2103`）。
5. 类型 `webview` 命中分支，交给 `renderWebViewNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2107`）。
6. 类型 `markdown` 命中分支，交给 `renderMarkdownNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2111`）。
7. 类型 `alertdialog` 命中分支，交给 `renderComposeDslAlertDialogNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2115`）。
8. 类型 `dialog` 命中分支，交给 `renderComposeDslDialogNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2119`）。
9. 上述都未命中则查 `composeDslGeneratedNodeRendererRegistry`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2123`）。
10. registry 也查不到的类型渲染 Unsupported node 提示文本而不是崩溃（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2129`）。

节点路径规则：普通子节点路径为 nodePath/index（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:137`）。
slot 子节点路径为 nodePath:slotName（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:198`）。
懒列表条目 key 为 parentNodePath:key:key 或 parentNodePath/index:类型（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:176`）。
调试快照的路径收集与渲染侧规则一致（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:209`）。

### 文本输入：串行队列 + 回声消除

`ComposeDslTextInputDispatchQueue`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputSync.kt:74`）是单 in-flight 串行派发队列，保证 JS 运行时按击键顺序应用编辑。
每个 Entry(actionId, text) 带 CompletableDeferred 可 await（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputSync.kt:113`）。
队列排空后经 onAllSettled 触发一次重渲染，而不是每击键重渲染一次（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1049`）。
派发侧 `dispatchTextInputAction` 的 payload 带 composeTextFieldPayload 标记（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1185`）。
payload 还带 no_render 标记，单次击键不触发整树重渲染（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1195`）。
回声消除守卫在本地编辑派发时记录回声：`onLocalEditDispatched`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputSync.kt:37`）。
JS 返回的新树经 reconcile 做回声消除后再进输入框（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputSync.kt:40`）。

### 动作派发：ticket 防乱序

`dispatchActionInternal`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1064`）给每次派发分配递增 ticket。
派发开始时 dispatchingCount 加 1，isDispatching 为真（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1096`）。
JS 返回的中间渲染结果若其 ticket 已在 settledDispatchTickets 中则直接丢弃，防止慢动作的旧结果覆盖新状态（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1105`）。
动作结算后 ticket 入集；集合超过 64 时只保留最大的 32 个，防止无限增长（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1146`）。
dispatchingCount 归零时 isDispatching 复位（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1168`）。
另有可挂起版本 `dispatchActionAwait`，供手势/修饰符动作等待 JS 结果（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1205`）。

### 文件选择器：严格校验 + 暂存目录隔离

`parseComposeDslFilePickerRequest`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:286`）对选择请求做严格校验。
executionContextKey 必填（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:288`）。
mimeTypes 仅 DOCUMENT 模式可用（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:318`）。
allowMultiple 要求模式 supportsMultiple（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:343`）。
持久权限要求 supportsPersistablePermission（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:347`）。
6 种模式的能力矩阵：多选仅 DOCUMENT/IMAGE/VIDEO/MEDIA（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:228`）。
持久 URI 权限仅 DOCUMENT/DIRECTORY（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:231`）。
选中文件经 `stageComposeDslPickedFile` 复制到 cleanOnExitDir 下 compose_file_picker 暂存目录（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:515`）。
文件名先经 `sanitizeComposeDslPickedFileName` 过滤：非法字符转下划线、限 120 字符（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:492`）。
扩展名白名单为字母数字下划线连字符（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:501`）。
最终落盘名为 picked_毫秒_12位uuid.ext 格式（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:521`）。
启动经主线程 Handler 投递（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:418`）。
文档选择 launcher 在 `filePickerLauncher`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:748`）。
图片单选 launcher（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:806`）。
图片多选 launcher（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:819`）。
拍照 launcher（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:832`）。

### WebView 节点：双向桥 + 宿主注册表

`renderWebViewNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:1397`）把原生 WebView 包成 DSL 节点，核心是双向桥。
Native→JS：`injectComposeDslWebViewBridgeRuntimeIntoHtml` 往 HTML 注入运行时脚本（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:878`）。
注入脚本带 data-operit-webview-bridge-runtime 标记，已有则跳过（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:887`）。
系统支持时用 WebViewCompat.addDocumentStartJavaScript 向所有源注入（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:1628`）。
JS→Native：`ComposeDslWebViewPageBridge` 的 invoke 在单线程 lane 上 20s 阻塞执行接口方法对应的 DSL 动作（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:1274`）。
`handleControllerCommand` 支持 loadUrl/loadHtml/reload/stopLoading/goBack/goForward/clearHistory/evaluateJavascript/getState/增删 JS 接口（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:427`）。
13 种页面回调（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:940`）。
绑定由 `ComposeDslWebViewHostRegistry` 按 executionContextKey→controllerKey 两级 map 管理（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:222`）。
executionContextKey 格式为 toolpkg_compose_dsl:包:模块:路由（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:630`）。
销毁时依次 removeJavascriptInterface、stopLoading、loadUrl(about:blank)、clearHistory、removeAllViews、destroy 并 shutdown lane（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:2166`）。

注意：默认配置偏宽松——JS/第三方 Cookie 默认开（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:2253`）。
allowFileAccessFromFileURLs/allowUniversalAccessFromFileURLs 默认开（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:2261`）。
混合内容默认 ALWAYS_ALLOW（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:4539`）。
权限请求被自动 grant，无用户确认环节（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:2104`）。
定位权限被静默自动授予且不记住选择（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:2108`）。
JS 弹窗被自动 confirm（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:2115`）。
详见 quality.json 的 3 条 high。

### 修饰符：通用解析器 + 约 40 种 op

`defaultComposeDslModifierResolver` 转调 `applyCommonModifier`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:61`）。
applyCommonModifier 处理 width/height、fillMax*（互斥链）、padding、background、zIndex（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:3076`）。
Row/Column/Box 有各自的作用域解析器，处理 weight+align（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:68`）。
`applyScopedCommonModifier` 再包一层调试布局修饰（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:119`），调试时可见节点边界。
`applyProxyModifierOps` 读取 modifierOps 列表逐条应用约 40 种 op（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:3298`）。
applyProxyModifierOps 的入口在 Screen（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:3138`）。
未知 op 静默忽略，写错 token 无报错（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:3597`）。
样式 token：颜色经 colorScheme 反射与 #RRGGBB 解析（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:4704`）。
对齐 token（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:4455`）。
字重/字体 token（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:4488`）。
图标名经 MaterialIconNameResolver 解析，失败回退 Icons.Default.Info（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:4638`）。

### 自适应面板与画布

`renderAdaptiveSidePanelNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2487`）。
断点默认 600dp 可覆盖（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2508`）。
宽屏 Row + detectDragGestures 可拖拽分隔条（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2556`）。
onOpenChanged 必填（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2498`）。
slot 要求恰好 1 个子节点（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2639`）。
`renderCanvasNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2730`）：命令式绘图。
指令含 line/rect/roundrect/circle/text 与 path 子操作 moveto/lineto/cubicto/quadto/close（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2748`）。
坐标单位 fraction（按画布换算）/dp/px（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2760`）。
画刷目前只支持 verticalgradient（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2690`）。
缩放手势钳制 0.6–2.0（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2779`）。

### 对话框与嵌入 API

`ToolPkgComposeDslDialogHost`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1560`）：对话框里的 DSL 宿主变体，无文件选择器绑定。
LocalComposeDslDialogDismissHandler 注入关闭回调（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1999`）。
`RenderToolPkgComposeDslNode`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:2014`）：对外公开的单节点嵌入 API；对话框场景下 LocalComposeDslWebViewHost 为 null。
根节点 onLoad 动作只派发一次（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1491`）。
顶栏标题取自 slot topBarTitle（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:897`）。
WebView IME 场景窗口设为 SOFT_INPUT_ADJUST_RESIZE（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1248`）。

### 调试快照

`ToolPkgComposeDslDebugSnapshotStore`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:47`）是 object 单例。
`update` 记录渲染快照并裁掉已消失节点的布局快照（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:55`）。
`updateLayout` 记录节点布局（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:69`）。
`clear` 按路由清理（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:79`）。
`dumpCurrentSnapshot` 导出到外部文件目录 debug/compose_dsl_dump/current（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:92`）。
导出内容含 manifest、布局 json/txt、源 JS、原始/解析后渲染结果、state、memo、组件树 json/txt、布局树 txt（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt:100`）。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `ToolPkgComposeDslToolScreen` | Screen.kt | DSL 屏组合入口，`render()` 在此 |
| `renderComposeDslNode` | Screen.kt:2075 | 节点分发主函数 |
| `ToolPkgComposeDslNode` | parser（外部） | 节点树数据结构 |
| `dispatchActionInternal` | Screen.kt:1064 | 动作派发，ticket 防乱序 |
| `dispatchTextInputAction` | Screen.kt:1185 | 文本输入派发入口 |
| `ComposeDslTextInputDispatchQueue` | ComposeDslTextInputSync.kt:74 | 文本输入串行队列 |
| `ComposeDslTextFieldEchoGuard` | ComposeDslTextInputSync.kt:37 | 回声消除守卫 |
| `ComposeDslWebViewHostRegistry` | WebView.kt:222 | WebView 宿主两级注册表 |
| `ComposeDslWebViewPageBridge` | WebView.kt:1274 | JS→Native 桥，invoke 入口 |
| `ToolPkgComposeDslDebugSnapshotStore` | DebugSnapshotStore.kt:47 | 调试快照 object |
| `composeDslGeneratedNodeRendererRegistry` | GeneratedRegistry.kt | 自动生成节点的渲染器注册表 |
| `applyProxyModifierOps` | Screen.kt:3298 | 约 40 种 modifier op 的代理应用 |

## 调用链

1. 输入：DSL 屏组合后调用 `render`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1257`）。
2. 处理：`executeComposeDslScript` 执行 DSL 脚本（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1310`）。
解析由 `parseRenderResult` 完成（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1318`）。
3. 输出：Compose UI 产出；快照写入 `ToolPkgComposeDslDebugSnapshotStore`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:941`）。

文本输入链路：

1. 输入：用户击键 → `renderTextFieldNode` 的 onValueChange 回调（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt:466`）。
2. 处理：`dispatchTextInputAction` 入串行队列，payload 带 no_render 跳过重渲染（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1185`）。
3. 输出：队列排空 → onAllSettled → `requestComposeDslTreeRerender`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt:1049`）。

WebView 桥链路：

1. 输入：页面 JS 调用宿主接口（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:878`）。
2. 处理：运行时脚本经隐藏桥 `invoke`（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:1343`）。
3. 输出：lane 线程 20s 阻塞 → 查动作 id → 执行 DSL 动作（`app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt:168`）。

## 来源

- 渲染屏：`review/batch-08/ui-common-dsl.facts.json`（172 条，引用全部验真）
- 走查：`review/batch-08/ui-common-dsl.quality.json`（3 high / 6 warn / 9 suggestion）
- 源码（钉住 dbf71916）：
  - `app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslScreen.kt`（4733 行）
  - `app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslWebView.kt`（2314 行）
  - `app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRenderers.kt`（3381 行）
  - `app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslGeneratedRegistry.kt`（91 行）
  - `app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ToolPkgComposeDslDebugSnapshotStore.kt`（442 行）
  - `app/src/main/java/com/ai/assistance/operit/ui/common/composedsl/ComposeDslTextInputSync.kt`（137 行）
