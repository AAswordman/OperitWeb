---
title: Markdown 与富文本渲染
module: UI 通用组件
sources: 24
issue: 109
date: 2026-10-01
---

# ui-common-markdown（Markdown 与富文本渲染）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/`（14 个 Kotlin 文件）+ `app/src/main/java/com/ai/assistance/operit/ui/common/displays/`（10 个 Kotlin 文件），共 24 文件约 10,947 行 @ `dbf71916`

## 概述

这是聊天消息的"排版印刷厂"：AI 回复的原始 Markdown 文本在这里变成带样式、可交互的富文本。之所以自研而不是用现成 Markdown 库，是三个硬需求叠加：

1. **流式输出**：文字要像打字机一样逐块冒出来，不能等整篇收完再排版；
2. **富块原生渲染**：代码块、表格、公式、mermaid 图、音视频都要可交互（复制、横滑、缩放、全屏预览）；
3. **XML 块可扩展**：工具调用返回的 XML 块要能挂插件式渲染器，甚至跑起 Compose DSL 小程序。

为此搭了一套"流式切块 → 稳定节点 → 分组 → Canvas/Compose 混合渲染"管线：纯文本段落走自研 Canvas 绘制（为打字机效果和滚动性能），代码块/表格/公式/媒体等复杂块走 Compose 组件，LaTeX 公式走双 LRU 缓存。同目录的 `displays/` 还放了三套悬浮窗：PhoneAgent 自动化进度卡、UI 操作视觉反馈、虚拟屏小窗，以及 FPS 计数器、彩虹边框等小件。

## AI 速览

核心符号清单（一行一个 `符号 — 一句话职责`）：

- `StreamMarkdownRenderer` — 流式/静态双入口渲染器，200ms 切块、回滚重绘
- `CanvasMarkdownNodeRenderer` — Canvas 节点分发与绘制核心，按 MarkdownProcessorType 派发
- `UnifiedCanvasRenderer` — 纯文本段落 Canvas 渲染，含流式打字机效果
- `EnhancedCodeBlock` — 代码块：工具栏/复制/换行切换/mermaid 与 HTML 预览
- `CanvasMonospaceCodeBlockBody` — Canvas 等宽代码正文，二分虚拟化 + 手动触摸滚动
- `EnhancedTableBlock` — Canvas 表格：横滑/fling/单元格链接点击
- `MarkdownInlineSpannable` — 行内样式 Spannable 构建器（粗斜体/链接/行内代码/行内公式）
- `LatexCache` — 公式 drawable（LRU 50）/bitmap（maxMemory/8）双缓存
- `JLatexMathCompatibility` — JLatexMath 缺失宏（color/oiint/oiiint）补注册
- `MarkdownImageRenderer` — 图片：Coil 加载/全屏缩放预览/保存到相册
- `MarkdownVideoRenderer` / `MarkdownAudioRenderer` — 视频/音频：ExoPlayer + StyledPlayerView
- `markdownToPlainTextForCopy` — 复制用纯文本，复用渲染同一份 AST
- `XmlRenderPluginRegistry` — XML 块插件注册表，支持 ComposeDslScreen 小程序屏
- `MarkdownText` — 对外入口 composable，委托 StreamMarkdownRenderer 并处理链接点击
- `RenderBatchCoordinator` — 渲染更新合并器（revision 计数 + 延迟 flush）
- `MarkdownNodeGrouper` — 节点分组接口（Single/Group），Noop 实现逐节点分组
- `MarkdownCodeTypeface` — JetBrains Mono 字体单例（terminal 模块资源，失败回退 MONOSPACE）
- `UIAutomationProgressOverlay` — PhoneAgent 自动化进度悬浮卡（暂停/继续/取消）
- `UIOperationOverlay` — UI 操作视觉反馈悬浮窗（点击涟漪/滑动彗星/输入气泡）
- `VirtualDisplayOverlay` — 虚拟屏小窗：视频画面 + 触摸转发 + 自动化控制条
- `MessageContentParser` — ChatMarkupRegex 的 XML/工具 pattern 代理入口
- `FpsCounter` / `RainbowBorderOverlay` / `ShowerSurfaceView` — FPS 计数、彩虹边框、虚拟屏 Surface 占位

主入口函数：`MarkdownText(text)`（静态）/ `StreamMarkdownRenderer(markdownStream)`（流式）。

数据流向一句话：字符流或全文 → native 层按 200ms 切块 → MarkdownNode → StableNode → 分组 → Canvas/Compose 混合渲染；公式走 LatexCache，XML 块走插件注册表，复制走同一份 AST 转纯文本。

## 核心机制

### 1. 流式渲染管线：切块、节流、回滚

流式渲染器有两个入口。流式入口接收 `Stream<Char>`，`StreamInterceptor`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:435`）把字符转发收集。

收集目标为 `collectedContent`（SmartString，`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:336`）。

`LaunchedEffect`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:451`）驱动流式处理循环。

按 `nativeMarkdownSplitByBlock`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:486`）每 200ms 切块。切块规则是关键：

- `HTML_BREAK` 合并、`HORIZONTAL_RULE` 独立成块；
- `BLOCK_LATEX` 先按 `PLAIN_TEXT` 累积、闭合后再转回，避免公式写一半就渲染；
- `CODE_BLOCK`/`TABLE`/`XML_BLOCK` 不进内联解析；
- `INLINE_LATEX` 先按 `PLAIN_TEXT` 累积、闭合后替换为公式节点；
- `XML_BLOCK` 的字符流用 `share(replay=Int.MAX_VALUE)` 共享（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:553`）。
- 共享后的流记入 `xmlNodeStreams`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:559`）。

渲染更新经 `BatchNodeUpdater`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:1131`）合并节流。

节流间隔为 `RENDER_INTERVAL_MS`（200L，`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:80`）。

finally 块调用 `synchronizeRenderNodes`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:1171`）做三步收尾：更新/新增节点、裁掉多余节点、清理 XML 流，16ms 后开启动画。

换行归一化把 CRLF 合并、连续换行压到最多 2 个（`MAX_CONSECUTIVE_RENDERED_NEWLINES`，`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:82`）。

`replaceRollbackTail`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:170`）在模型回滚重写时只重绘被撤销的尾部，不动前面已稳定的节点。

回滚前缀经 `StreamRollbackPrefix`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/StreamMarkdownRenderer.kt:427`）传入。

静态入口 `StreamMarkdownRenderer(content: String)` 的 `rendererId` 为 `"static-renderer-${content.hashCode()}"`；解析在 `Dispatchers.IO` 执行、回主线程 `replaceStaticNodes`。`MarkdownNodeCache` 按字节估算限大小（maxMemory/64，夹 256KB–4MB）；若 content 与流式已收集内容一致且同步完成则跳过解析。`RenderBatchCoordinator.kt` 做更新合并：`requestUpdate` 递增 `requestedRevision`，已有活跃 job 直接返回；job 内 `while(appliedRevision != requestedRevision){ delay(intervalMs); onFlush() }`。

新节点挂载用 `AnimatedNode` 做 800ms 淡入（`FADE_IN_DURATION_MS=800`），`graphicsLayer` 隔离避免整屏重绘。`MarkdownRenderMode{STREAMING, STATIC}` + `LocalMarkdownRenderMode` 让下游组件知道自己处于流式还是静态，从而降级（如代码块流式下跳过高亮）。

### 2. Canvas 混合渲染：可见性裁剪与打字机

`CanvasMarkdownNodeRenderer.kt` 是绘制核心。`drawOnlyWhenVisible` 用 `onGloballyPositioned` 取 `boundsInWindow`，与 `getGlobalVisibleRect` 比较，不可见时 `drawWithContent` 直接跳过绘制——长消息滚动时只画屏幕内的块。`PaintCache`（ConcurrentHashMap）与 `LayoutCache`（LRU 100 个 StaticLayout）缓存绘制对象。常量：`MAX_CANVAS_HEIGHT_PX=250000f`、`FALLBACK_MAX_TEXT_CHARS=20000`、`TYPEWRITER_WINDOW_MS=200`、行距倍数 1.3f。

按 `MarkdownProcessorType` 分发：HEADER/列表/PLAIN_TEXT 走 `UnifiedCanvasRenderer`；`HTML_BREAK` 渲染为单个 `"\n"`；`CODE_BLOCK` 解析 ` ``` ` 语言行后交 `EnhancedCodeBlock`；`TABLE` 交 `EnhancedTableBlock`；`BLOCK_QUOTE` 用 Surface 加边框并去掉 `"> "` 前缀；`HORIZONTAL_RULE` 为 `HorizontalDivider`；`XML_BLOCK` 交 `xmlRenderer`；`IMAGE` 完整图片语法走 `MarkdownImageRenderer(maxImageHeight=140)` 否则纯文本；`BLOCK_LATEX` 用 `AndroidView` 托管 TextView，结合 `LatexCache.getDrawable` 与 `LatexDrawableSpan`，异常回退等宽原文。

`UnifiedCanvasRenderer` 在流式模式下对末节点做打字机效果：字符在 200ms 窗口内累计显露；布局含 `ImageSpan`（行内公式）时跳过该效果。Canvas 绘制对可见区域做 clip。链接点击通过 `URLSpan` 反查：500ms 内、移动 10px 以内判定为 tap。`calculateLayout` 里标题降一档字号（H1→headlineMedium…）、列表用正则解析序号/符号、无序列表圆点按首行基线对齐、段落按 `\n\n` 切分。`SafeMeasureOrFallback` 在 measure 异常时回退为 Compose `Text` 渲染，保证不崩。

### 3. 代码块：工具栏、流式降级、mermaid/HTML 预览

`EnhancedCodeBlock(code, language)` 是 VS Code 暗色风：背景 `0xFF1E1E1E`、工具栏 `0xFF252526`（`EnhancedCodeBlock.kt:107-108`）。工具栏从左到右：语言标签、mermaid 渲染切换、HTML 预览切换、全屏按钮（仅预览态）、自动换行切换、复制按钮。最大可滚动高度为屏幕高度一半、夹在 240.dp–560.dp（`:85`）。复制写剪贴板并显示 1500ms 蓝色"已复制"提示（`:95`）。

流式降级：`preferStreamingBody` 为 true 时 `highlightedLines` 为空列表（跳过语法高亮），mermaid/HTML 按钮禁用置灰（`0xFF666666`），等流结束再开——避免 WebView 在字符不断追加时反复重建。行高亮缓存 `lineCache` 以 `"$language:$line"` 为 key。

`MermaidRenderer` 用 WebView 加载 `mermaid@10.6.1`（jsdelivr CDN），暗色主题，`securityLevel: 'loose'`（`:427`）；页面内自带缩放控件（+/−/↺）与拖拽、双指捏合缩放；WebView 开 JS 与 DOM 存储，混合内容模式 `MIXED_CONTENT_ALWAYS_ALLOW`（`:607`）；`shouldOverrideUrlLoading` 返回 true 拦截一切导航；`DisposableEffect` 里 destroy 掉 WebView。`HtmlPreviewRenderer` 则相反：JS、DOM 存储、文件访问、内容访问全关，白底静态预览。`highlightSyntaxLine` 手写高亮：关键字蓝 `0xFF569CD6`、字符串橙红 `0xFFCE9178`、注释绿 `0xFF6A9955`、数字淡绿 `0xFFB5CEA8`、类型青 `0xFF4EC9B0`、函数黄 `0xFFDCDCAA`；kotlin/java/swift/typescript/javascript/dart 共用一套分支，mermaid 分支高亮关键字与箭头，`//` 注释（含行内）单独处理。

正文绘制交给 `CanvasMonospaceCodeBlockBody.kt`：12sp JetBrains Mono（`MarkdownCodeTypeface` 单例加载 terminal 模块的 `R.font.jetbrains_mono_nerd_font_regular`，失败回退 `Typeface.MONOSPACE`）；字符宽取 `ceil(measureText("M"))`、行高 1.25 倍；行号 gutter 至少 2 位宽、灰字 `0xFF6A737D` 配深底 `0xFF252526`；自动换行用 `editorNextSymbolOffset`/`editorCellWidth` 正确处理字素簇与 emoji 宽度；可见行区间二分查找、上下各 overscan 6 行虚拟化；触摸滚动手动实现（`awaitEachGesture`、touchSlop、方向判定、`VelocityTracker` + spline decay fling）；同色连续 run 合并为一次 `drawText`，emoji 走 `systemGlyphPaint`；流式时距底部 80px 以内自动跟随到底。

### 4. 表格：双遍测量、横滑、链接点击

`EnhancedTableBlock.kt` 的 `parseTable`（internal）把原始表格文本解析为 `TableData(rows, hasHeader)`：正则识别表头分隔行，`parseCells` 按 `|` 切分并去掉首尾竖线、把 `<br/>` 换成换行，不足列补空字符串。

`measureTableLayout` 做列宽分配：每列初始最小宽 80.dp（`TABLE_MIN_COLUMN_WIDTH`，`:57`），按单元格内容测出期望宽度后夹在 80.dp–320.dp（`:58`）之间；表头行用粗体；单元格文本经 `buildMarkdownInlineSpannableFromText` 构建行内样式；`StaticLayout` 用 `ALIGN_CENTER`、`includePad=false`。注意实现上每个单元格构建了两次 `StaticLayout`（测量一次、最终布局一次，`:533`），大表格时开销翻倍。

交互：`detectHorizontalDragGestures` 横向拖拽滚动，松手后按 `exp(-4.5*dt)` 衰减做 fling（速度夹 ±9000，低于 120 停止）；链接点击用 `awaitEachGesture` 做手势判定，抬起时按单元格矩形与 `StaticLayout` 行列反查 `URLSpan`，超出 touchSlop 则取消。`SideEffect` 在流式追加导致内容变窄时把滚动偏移钳制回 `maxScrollPx`。无障碍语义为 `table_block` 字符串。

### 5. 行内样式与 LaTeX 公式

`MarkdownInlineSpannable.kt` 把内联节点转成 `SpannableStringBuilder`。`NestedInlineNodeCache`（LRU 256）缓存 `NativeMarkdownSplitter.parseInlineToStableNodes` 的解析结果。`appendInlineNode` 按类型挂 span：LINK 挂 `URLSpan`+`UnderlineSpan`+`ForegroundColorSpan(primary)`；BOLD/ITALIC/STRIKETHROUGH/UNDERLINE 挂对应 `StyleSpan`；行内代码挂等宽样式 span（字号 0.9 倍 JetBrains Mono）与圆角背景 marker（背景透明度浅色字 0.18/深色字 0.12，水平内边距 4dp、垂直内缩 2dp、圆角 4dp），`drawInlineCodeBackgrounds` 按行分段画圆角矩形并处理 RTL；`HTML_BREAK` 转 `'\n'`。递归有双保险：深度≥24（`MAX_INLINE_RENDER_DEPTH`，`:34`）或节点已访问则直接追加解析后文本，防止循环引用。`selectedTextWithInlineCodeMarkers` 在选中文本的行内代码区间外补反引号，保证复制出来仍是合法 markdown。

公式渲染的核心是 `LatexDrawableSpan`（`ReplacementSpan`）：不把公式底部当基线（那样分数、积分、上下标会整体上飘），而是把公式放在周围文本视觉中心——`getSize` 按 `textCenter ± height/2` 扩展 `fontMetrics`，`draw` 平移到 `baseline + textCenter - height/2`。块公式与行内公式共用同一套 drawable 度量。

`LatexCache.kt` 是 object 单例双缓存：drawable LRU 50 条；bitmap LRU 按 `maxMemory/8` KB 计（`sizeOf` 按 `byteCount/1024`），`entryRemoved` 里 recycle 被驱逐的 bitmap。`getDrawable` 先调 `JLatexMathCompatibility.ensureRegistered()` 再构建。`buildCacheKey` 用反射读 builder 的 textSize/color/align/padding/background 字段拼 key，反射失败回退为纯 formula（`:175-211`）。`JLatexMathCompatibility.kt` 用双重检查锁注册 JLatexMath 缺失的宏：`color→color_macro`、`oiint→oiint_macro`、`oiiint→oiiint_macro`，以及 U+222F→`\oiint`、U+2230→`\oiiint` 的字符映射；`advanceTeXParserPosition` 用反射改 `TeXParser` 私有字段 `pos`，失败记日志。

### 6. 图片、视频、音频

`MarkdownImageRenderer(imageMarkdown, maxImageHeight=160, enableDialogs=true)`：`isCompleteImageMarkdown` 要求同时含 `![`、`(`…`)` 且 `)` 在 `(` 之后，否则直接返回不渲染（流式写一半的图片语法不会闪一下）。URL 为空直接返回；按扩展名分流——视频 URL 转交 `MarkdownVideoRenderer(maxVideoHeight=220)`，音频 URL 转交 `MarkdownAudioRenderer`。图片用 Coil `SubcomposeAsyncImage`（crossfade、`ContentScale.Fit`、圆角 12dp），加载中显示 50dp 浅灰盒 + 20dp 进度圈，失败显示红色单行省略文本；alt 说明居中显示一行。

点击图片（`enableDialogs` 时）开全屏 Dialog：黑底 0.9 透明度，`detectTransformGestures` 缩放 0.5–3.0、平移按缩放钳制，有重置缩放按钮；下载按钮调 `saveImageFromUrl`：文件名 `markdown_yyyyMMdd_HHmmss.jpg`，Android Q 及以上经 MediaStore 存到 `Pictures/Markdown`（MIME `image/jpeg`），以下用传统文件方式；经 `java.net.URL.openConnection` 下载，异常返回 false 并记日志。

`MarkdownVideoRenderer` 支持 mp4/webm/mkv/mov/m4v/3gp/avi/ogv（`:34`），`MarkdownAudioRenderer` 支持 mp3/wav/ogg/oga/m4a/aac/flac/opus/weba（`:30`）；`normalizeMarkdownMediaUrl` 去掉 `#`/`?` 后缀、trim、转小写后再取扩展名。两者都按 URL `remember` 一个 `ExoPlayer`，`LaunchedEffect` 里 `setMediaItem` + `prepare`、`playWhenReady=false` 不自动播放；`DisposableEffect` 里 stop/clearMediaItems/release。视频用 `StyledPlayerView`（`useController=true`、`RESIZE_MODE_FIT`、16:9、高度上限），音频用无宽高比的控制条样式。

### 7. 复制用纯文本：与渲染共享同一份 AST

`markdownToPlainTextForCopy`（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/MarkdownPlainTextRenderer.kt:11`，internal suspend）复用 `parseMarkdownToNodes` 产出的同一份 AST，保证"复制出来的内容"和屏幕渲染共享代码块/表格/公式的起止边界判断。

细节：末尾缺换行时补换行以冲刷 native 流式解析器的前瞻；2 个以上换行（含水平空白，如模型输出残留的全角空格行）折叠为双换行；相邻列表项（有序/无序混排）之间只用单个换行、其余块之间空一行，`HTML_BREAK` 不参与（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/MarkdownPlainTextRenderer.kt:42`）。

块渲染规则：代码块有语言时输出语言分隔线加代码原文；表格行用换行、单元格用制表符连接；单元格内联样式经 `parseInlineToStableNodes` 还原（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/MarkdownPlainTextRenderer.kt:116`）。

链接输出为"文本 (url)"形式；图片取 alt 文本；标题去井号；无序列表前缀圆点。公式先记为占位符（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/MarkdownPlainTextRenderer.kt:127`），最后经 latexToPlainText 回调替换（默认恒等）。

### 8. XML 块插件渲染（含 Compose DSL 小程序）

`XmlRenderPluginRegistry.kt` 定义 `sealed XmlRenderResult{ComposableRender, Text, ComposeDslScreen(containerPackageName, screenPath, state, memo, moduleSpec)}` 与 `XmlRenderPlugin{id, supports(tagName), suspend resolve(...)}`。Registry 用 `CopyOnWriteArrayList` 存插件，`register`/`unregister` 加 `@Synchronized`，`changeVersion` 为 StateFlow。`@Composable RenderIfMatched` 按 `(renderInstanceKey, tagName, plugin.id, registryVersion)` remember，`LaunchedEffect` 里调 `plugin.resolve`：失败显示错误文本、未完成显示 `LinearProgressIndicator`（`:206`），返回 Boolean 表示是否命中——未命中的 XML 块回退到 `DefaultXmlRenderer`（Surface 包裹等宽文本）。

`ComposeDslScreen` 是最重的插件结果：`RenderComposeDslScreen` 用 `PackageManager.acquireToolPkgExecutionEngine` 获取工具包执行引擎（`DisposableEffect` 释放），读工具包脚本资源调 `executeComposeDslScript`，`ToolPkgComposeDslParser` 解析后渲染，`onLoad` 动作自动派发；`dispatchTextInputAction` 用 `CompletableDeferred` ticket 队列做同步，全部完成后重渲染。`MessageContentParser.kt`（19 行）是 companion object 代理 `ChatMarkupRegex` 的 `xmlStatusPattern`/`xmlToolResultPattern`/`xmlToolRequestPattern`（private）/`namePattern`/`toolParamPattern`，供消息内容解析复用。

### 9. 三套悬浮窗

**UIAutomationProgressOverlay**（534 行）：PhoneAgent UI 自动化进度悬浮卡，双重检查锁单例。窗口类型 `TYPE_APPLICATION_OVERLAY`（Android O 以下 `TYPE_PHONE`），flags `FLAG_NOT_FOCUSABLE|FLAG_LAYOUT_IN_SCREEN|FLAG_LAYOUT_NO_LIMITS`；内容用 `ComposeView` + `DisposeOnDetachedFromWindow` + `ServiceLifecycleOwner` 承载。`ProgressInfo(currentStep, totalSteps, statusText)` 描述进度，对外 `show/updateProgress/hide`；`setOverlayVisible` 是 suspend 函数，在截图/操作期间临时隐藏（加 `FLAG_NOT_TOUCHABLE` 并改 alpha/visibility）避免悬浮窗入镜；`moveOverlayBy` 支持拖拽；`setBorderEnabled` 控制全屏彩虹边框 `borderView`。卡片有暂停/继续与取消按钮，`statusIconFor` 按文案含 "execut"/"done"/"success" 选图标，显示前检查 `Settings.canDrawOverlays`。

**UIOperationOverlay**（616 行）：UI 操作视觉反馈悬浮窗，单例；flags 额外加 `FLAG_NOT_TOUCHABLE|FLAG_NOT_TOUCH_MODAL`，不拦截底层触摸。事件类型 `TapEvent`/`SwipeEvent`/`TextInputEvent`（UUID 标识）；`showTap/showSwipe/showTextInput` 都把 y 减去 `statusBarHeight` 对齐；事件到期经 `handler.postDelayed` 移除（tap/swipe 1500ms、text 2000ms）；`scheduleAutoCleanup` 在 500ms 后队列全空则隐藏；`hide()` 延迟 600ms 让动画播完，`hideImmediately()` 立即清空。视觉：青色涟漪 600ms（点击）、橙色彗星 1000ms（滑动）、黑色呼吸气泡（文本输入）。

**VirtualDisplayOverlay**（1296 行，最大文件）：按 `agentId` 用 `ConcurrentHashMap` 管理单例，`getInstance/hide(agentId)/hideAll()`。`mapOffsetToRemote` 把 overlay 坐标归一化映射到远端设备坐标（`:112`）。`show(displayId)` 展示小窗，`captureCurrentFramePng()` 经 `surfaceView` 截帧。自动化控制条（`showAutomationControls/updateAutomationProgress/hideAutomationControls`）占左侧 56dp 面板；`hide(cancelAutomation)` 调 `PhoneAgentJobRegistry.cancelAgent` 并 `ShowerController.shutdown`；`toggleFullScreen` 切换全屏；`snapToEdge` 贴边最小化为可见 36dp、屏外 12dp、高 48dp 的条状，`animateToPosition` 300ms；小窗布局为视频区 0.4×屏宽加 56dp 面板。全屏下 `OverlayCard` 用 `pointerInteropFilter` 转发触摸（仅单指 DOWN/MOVE/UP/CANCEL），经 `touchForwardMutex` 序列化、历史触点逐个 `mapOffsetToRemote` 后调 `ShowerController.injectTouchEvent`；`AndroidView` 挂载 `ShowerSurfaceView`（`com.ai.assistance.showerclient.ui.ShowerSurfaceView` 的空壳子类）并 `bindController`。每 500ms 轮询 `getVideoSize`，虚拟屏断开则 `cancelAgent`。控制条显示 `"n/m"` 进度、暂停/继续、退出；贴边态显示应用图标或箭头。

### 10. 小件：FPS、彩虹边框、链接处理

`FpsCounter.kt`（104 行）：`Choreographer.FrameCallback` 统计帧，每秒算一次 FPS，≥55 绿/≥30 橙/其余红；`DisposableEffect` 注销回调。另有一个 `while(true){delay(500)}` 的空循环 `LaunchedEffect`（`:86`），循环体无操作。

`RainbowBorderOverlay.kt`（105 行）：`rememberInfiniteTransition` 0→1、4000ms、`LinearEasing`、`Reverse` 模式；6 色渐变；Canvas 按 72 步画同心圆角矩形环带（`PathOperation.Difference` 挖空），alpha 按 `(1-startT)^1.55` 衰减，渐隐宽度 `minDimension*0.046`。

`MarkdownTextComposable.kt`（77 行）：`MarkdownText` 直接委托 `StreamMarkdownRenderer(content=text, onLinkClick={ openMarkdownLink(context, url) })`（`:30`）。`openMarkdownLink` 对无 scheme 的相对链接（如 README 内的 `README.md`/`#anchor`）只 Toast 提示不打开（`:58`）；`ACTION_VIEW` 包 try/catch，`ActivityNotFoundException` 与 `SecurityException` 都记日志 + Toast，不崩溃。

## 关键符号

| 符号 | 职责 | 位置 |
|---|---|---|
| `StreamMarkdownRenderer(markdownStream/content)` | 流式/静态双入口 | StreamMarkdownRenderer.kt |
| `MarkdownText(text)` | 对外入口 composable | MarkdownTextComposable.kt:30 |
| `CanvasMarkdownNodeRenderer` | Canvas 节点分发核心 | CanvasMarkdownNodeRenderer.kt |
| `UnifiedCanvasRenderer` | 文本段落 Canvas 渲染 + 打字机 | CanvasMarkdownNodeRenderer.kt |
| `drawOnlyWhenVisible` | 不可见时跳过绘制 | CanvasMarkdownNodeRenderer.kt |
| `EnhancedCodeBlock(code, language)` | 代码块：工具栏/复制/mermaid/HTML 预览 | EnhancedCodeBlock.kt |
| `CanvasMonospaceCodeBlockBody` | Canvas 等宽代码正文（虚拟化） | CanvasMonospaceCodeBlockBody.kt |
| `MermaidRenderer` / `HtmlPreviewRenderer` | WebView 预览：mermaid 图 / HTML | EnhancedCodeBlock.kt |
| `highlightSyntaxLine` | 手写单行语法高亮 | EnhancedCodeBlock.kt |
| `EnhancedTableBlock(tableContent)` | Canvas 表格：横滑/fling/链接 | EnhancedTableBlock.kt |
| `parseTable` | 表格文本解析（internal） | EnhancedTableBlock.kt |
| `buildMarkdownInlineSpannableFromText` | 行内样式 Spannable 构建 | MarkdownInlineSpannable.kt |
| `LatexDrawableSpan` | 公式居中 span（文本视觉中心对齐） | MarkdownInlineSpannable.kt |
| `LatexCache.getDrawable/getLatexBitmap` | 公式双 LRU 缓存（@Synchronized） | LatexCache.kt |
| `JLatexMathCompatibility.ensureRegistered` | JLatexMath 缺失宏补注册 | JLatexMathCompatibility.kt |
| `MarkdownImageRenderer` | 图片：Coil/全屏预览/保存相册 | MarkdownImageRenderer.kt |
| `MarkdownVideoRenderer` / `MarkdownAudioRenderer` | 视频/音频：ExoPlayer | MarkdownVideoRenderer.kt / MarkdownAudioRenderer.kt |
| `isLikelyVideoUrl` / `isLikelyAudioUrl` | 按扩展名分流媒体 | MarkdownVideoRenderer.kt:39 / MarkdownAudioRenderer.kt:43 |
| `markdownToPlainTextForCopy` | 复制用纯文本（internal suspend） | MarkdownPlainTextRenderer.kt:14 |
| `XmlRenderPluginRegistry` | XML 块插件注册表 | XmlRenderPluginRegistry.kt |
| `RenderIfMatched` | 插件命中渲染（返回 Boolean） | XmlRenderPluginRegistry.kt |
| `RenderBatchCoordinator` | 渲染更新合并器 | RenderBatchCoordinator.kt |
| `MarkdownNodeGrouper` / `NoopMarkdownNodeGrouper` | 节点分组接口/默认实现 | MarkdownNodeGrouper.kt |
| `getMarkdownCodeTypeface` | JetBrains Mono 单例 | MarkdownCodeTypeface.kt |
| `UIAutomationProgressOverlay` | 自动化进度悬浮卡 | UIAutomationProgressOverlay.kt |
| `UIOperationOverlay` | UI 操作视觉反馈悬浮窗 | UIOperationOverlay.kt |
| `VirtualDisplayOverlay` | 虚拟屏小窗 + 触摸转发 | VirtualDisplayOverlay.kt |
| `MessageContentParser` | ChatMarkupRegex pattern 代理 | MessageContentParser.kt |

## 调用链

1. **静态消息渲染**：`MarkdownText(text)` → `StreamMarkdownRenderer(content)` → `Dispatchers.IO` 解析 → 主线程 `replaceStaticNodes` → `UnifiedMarkdownCanvas` 按 grouper 分组 → `CanvasMarkdownNodeRenderer` 按类型分发 → 文本走 Canvas、复杂块走 Compose 组件。
2. **流式消息渲染**：`StreamMarkdownRenderer(markdownStream)` → `StreamInterceptor` 收集字符 → 每 200ms `nativeMarkdownSplitByBlock` 切块 → `BatchNodeUpdater` 节流 → `synchronizeRenderNodes`（更新/新增/裁剪/清 XML 流）→ `AnimatedNode` 800ms 淡入；回滚时 `replaceRollbackTail` 只重绘尾部。
3. **公式**：`BLOCK_LATEX` → `extractLatexContent` 剥分隔符 → `LatexCache.getDrawable`（先 `ensureRegistered`）→ `JLatexMathDrawable` → `AndroidView` TextView + `LatexDrawableSpan`；行内公式 → `MarkdownInlineSpannable` 内 `LatexCache.getDrawable` → `\uFFFC` 占位 + `LatexDrawableSpan`。
4. **代码块**：`CODE_BLOCK` → `EnhancedCodeBlock`（语言行解析）→ `CanvasMonospaceCodeBlockBody`（Canvas 虚拟化正文）；`mermaid` 语言 + 用户点击渲染 → `MermaidRenderer`（WebView）；`html` 语言 → `HtmlPreviewRenderer`（无 JS WebView）。
5. **表格**：`TABLE` → `EnhancedTableBlock` → `parseTable` → `measureTableLayout`（双遍 StaticLayout）→ Canvas 画边框/网格/单元格 → 横滑/fling/URLSpan 链接点击。
6. **媒体**：`IMAGE` → `isCompleteImageMarkdown` 校验 → 扩展名分流视频/音频 → 图片走 Coil（点击开全屏 Dialog，可缩放/下载存相册），音视频走 ExoPlayer + StyledPlayerView。
7. **XML 块**：`XML_BLOCK` → `RenderIfMatched` → 插件 `resolve` → `ComposableRender`（直接组合）/`Text`（纯文本）/`ComposeDslScreen`（工具包 Compose DSL 小程序屏，`executeComposeDslScript` + 自动派发 onLoad）；未命中回退 `DefaultXmlRenderer`。
8. **复制**：长按复制 → `markdownToPlainTextForCopy` → 同一份 AST → `joinBlocks`/`renderBlockNode` → 纯文本（公式经占位符回调替换）。
9. **链接点击**：`openMarkdownLink` → 无 scheme 只 Toast；有 scheme 则 `ACTION_VIEW`，异常记日志 + Toast。
10. **虚拟屏**：`VirtualDisplayOverlay.show(displayId)` → `ShowerSurfaceView` 绑 `ShowerController` → 全屏触摸经 `pointerInteropFilter` → `mapOffsetToRemote` → `injectTouchEvent`；自动化控制条走 `showAutomationControls/updateAutomationProgress/hideAutomationControls`。

## 来源

- 原子事实 209 条：`review/batch-08/ui-common-markdown.facts.json`，每条带 `文件:行号` 引用（ref ±5 行内可验证）。
- 代码走查 12 条：`review/batch-08/ui-common-markdown.quality.json`（warn 7：XML 流无界重放、Mermaid WebView 混合内容放行、反射脆弱性×2、bitmap 缓存配额、ExoPlayer 多实例、表格双遍测量；suggestion 5：FpsCounter 空循环、isLargeImage 死代码、hideAll 吞异常、下载无超时、500ms 轮询）。
- 种子文件 24 个（`app/src/main/java/com/ai/assistance/operit/ui/common/markdown/` 14 个 + `app/src/main/java/com/ai/assistance/operit/ui/common/displays/` 10 个），源码版本 `dbf71916`（v1.12.2），阅读状态已登记。
