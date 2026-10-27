# Critic 报告：ui-chat-parts（Issue #93）

- verdict: **FAIL**
- critic: 独立 critic（subagent 9a8f9b33）
- 时间：2026-10-01
- 核验方法：144 条 facts 全部机械检查（文件存在、行号不越界）0 越界；
  逐条人工抽查断言真伪与 ref ±5 行窗口支撑，共抽查全部 144 条的断言与窗口。

## 结论

**事实本体基本全对，但引用行号系统性漂移，判定 FAIL。**
约 48/144 条 facts 的 ref 行号落在断言代码之外（±5 窗口无支撑），
与 batch-06 的 widget-provider（Issue #82）同一类问题：writer 疑似用缓存/旧行号写 ref，
断言多半为真，但引用铁律（ref ±5 窗口必须完整支撑断言）不满足。

## facts 核验结果

- 断言为真但 ref 行号错误（需按下表修正 ref）：共 47 条
- 断言本身无误、ref 窗口勉强/刚好覆盖（建议微调）：[65]
- 虚构/错误断言：0 条（本次未发现编造事实）
- 越界/死文件：0 条

### ref 行号修正清单（fact 为真，ref 需改为正确行）

格式：`[n] 原ref → 正确ref（说明）`，文件均为
`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/` 下相对路径。

**part/CustomXmlRenderer.kt：**
- [19] :284 → :273（起始标签无 `>` 时 `return content` 等待后续片段，注释在 273）
- [23] :557 → :569（`parseStructuredSearchXml` 函数定义行）
- [24] :636 → :643（`structured = hasSearchRoot && (provider/action/status/query/source 任一非空)`）
- [25] :681 → :717（`faviconUrlForSearchSource` 定义，`https://www.google.com/s2/favicons?sz=64&domain=$host`）
- [26] :702 → :726（`renderThinkContent` 函数定义行）
- [27] :712 → :747（shimmer：`initialValue=-140f, targetValue=220f, tween(1400)`）
- [29] :784 → :829（`val threshold = 80`，`atBottom = scrollState.value >= maxValue - threshold`）
- [49] :1498 → :1501（`applyBuiltInStyles` 的 when 起始行；`warning-card` 在 1504，原窗口 1493–1503 刚好漏掉）
- [54] :1563 → :1577（`hexToRgb` 解析失败默认返回 `"0, 122, 255"`）

**part/ThinkToolsXmlNodeGrouper.kt：**
- [57] :88 → :98（`stableKey = "think-tools-$i"`）
- [59] :454 → :429（`isIgnorableXmlTagForToolGrouping`：`return tag == "meta"`）
- [60] :141 → :151（`stableKey = "tools-only-$i"`；`search-only-$i` 在 187）

**part/ToolDisplayComponents.kt：**
- [69] :72 → :43（`CompactToolDisplay` 定义行；其内部在 78 调用 `CanvasToolSummaryRow`）
- [70] :112 → :119（`paramsSizeLabel = remember(displayParams) { buildToolParamsSizeLabel(...) }`）
- [72] :150 → :161（行号列 `Modifier.width(40.dp)`）
- [73] :247 → :224（`withContext(Dispatchers.Default)` 高亮计算）
- [74] :284 → :313（`unescapeXmlForDisplay` 定义；CDATA 剥离 + 5 种实体还原）
- [75] :331 → :371（`normalizeToolDisplayForStrictProxy` 定义）
- [76] :372 → :406（`parseProxyJsonParamsToXml` 定义）
- [80] :512 → :489（`calculateToolParamsBytes` 定义；`toByteArray(Charsets.UTF_8).size`）

**part/ToolResultDisplay.kt：**
- [85] :56 → :64（`result.take(200)`）
- [86] :90 → :171（复制按钮注释与 `Icons.Default.ContentCopy`）
- [87] :114 → :129（`if (dialogMetrics.isCompactHeight) 160.dp else 300.dp`）

**part/ParamVisualizer.kt：**
- [88] :41 → :51（`paramRegex = """<param\s+name="([^"]+)">(.*?)</param>""".toRegex(DOT_MATCHES_ALL)`）
- [89] :66 → :85（`clipboardManager.setText(AnnotatedString(param.value))`）
- [90] :97 → :105（`params.isEmpty()` 时 else 分支直接 `Text(xmlContent)` 显示原文）

**part/DetailsTagRenderer.kt：**
- [102] :90 → :97（`extractSummary` 定义，`<summary>(.*?)</summary>` 正则）
- [103] :104 → :37（`defaultExpanded = hasOpenAttribute(xmlContent, tagName)`）
- [104] :48 → :40（`targetValue = if (expanded) 90f else 0f`，`tween(durationMillis = 300)`）

**part/XmlCanvasBlockComponents.kt：**
- [101] :255 → :247（`backgroundColor.copy(alpha = 0.18f)`）
- [110] ref 文件错误：原 ref 指向 DetailsTagRenderer.kt:60 → 应为
  `part/XmlCanvasBlockComponents.kt:51`（`CanvasExpandableHeaderRow` 定义；
  `rotationDegrees = if (expanded) 90f else 0f`，`titleAlpha` 参数）
- [111] :164 → :177（`CanvasIndentedGuide` 定义；`indentStart: Int = 10` 且以 `indentStart.dp`
  使用，竖线为上下渐隐 verticalGradient）

**part/XmlCanvasSummaryComponents.kt：**
- [114] :96 → :89（`titleMinWidthPx = 80.dp`，`titleMaxWidthPx = 120.dp`）
- [115] :200 → :239（`startPaddingPx = 24.dp`）
- [117] :343 → :356（`horizontalPaddingPx/verticalPaddingPx = 12.dp`，
  `outerVerticalPx = 4.dp`，`cornerRadius = 8.dp`，`borderWidth = 1.dp`）
- [118] :398 → :430（`barWidthPx = 2.dp`，`barHeightPx = 16.dp`，
  `barColor = error.copy(alpha = 0.7f)`）

**attachments/AttachmentViewerDialog.kt：**
- [119] :55 → :67（`data class ChatAttachment(id, filename, mimeType, size = 0, content = "")`）
- [120] :68 → :81（`if (!visible || attachment == null) return`）
- [121] :77 → :89（`when` 按 mimeType 前缀路由 image/audio/video/文本）
- [125] :129 → :137（`fileFromPath` 定义；`file.exists() && file.isFile`）
- [126] :137 → :144（`fileUri`：`content://`/`file://` 直接 parse，否则 `Uri.fromFile`）
- [129] :255 → :268（音频 268 / 视频 289 行 `autoPlay = false`）
- [131] :343 → :393（`FileProvider.getUriForFile(context, "$packageName.fileprovider", file)`）
- [132] :356 → :408（打开失败 `file_open_failed` toast，408/415 两处）
- [133] :375 → :421（`readBytesLimited` 定义；64KB 缓冲，超限抛 `IllegalArgumentException`）
- [134] :320 → :370（`isTextLikeMimeType` 定义；`text/` 前缀 + 白名单后缀）
- [135] :330 → :377（`fileExtForMimeType` 定义；默认 `"bin"`）

## quality.json 走查复核（7 条全部抽查源码）

| # | severity | 结论 |
|---|---|---|
| Q0 | high | **属实**。`renderHtmlContent`（CustomXmlRenderer.kt:1401）对 AI 生成的 `<html>` 内容：
  `javaScriptEnabled=true`、`allowUniversalAccessFromFileURLs=true`、
  `MIXED_CONTENT_ALWAYS_ALLOW`（1433–1448），经 `applyBuiltInStyles` 只做 CSS 类替换、
  无 script 消毒，直接 `loadDataWithBaseURL` 载入。存储型 XSS / 本地文件读取风险成立。 |
| Q1 | warn | **属实**。1271 行 `.replace("<","<").replace(">",">").replace("&","&")` 三处恒等替换死代码；
  疑似本意是实体解码但方向写反，diff 内转义实体原样显示。 |
| Q2 | warn | **属实**（medium 置信合理）。`mediaPoolId = attachment.id.removePrefix("media_pool:")`（93–95），
  `File(dir, "$mediaPoolId.$ext")`（126）未校验路径分隔符；id 若含 `../` 可穿越出 cacheDir。
  注意 evidence 行号写 125，实际为 126，差一行。 |
| Q3 | suggestion | **属实**。`diffLines.count { it.startsWith("+") }` 会把 unified diff 的 `+++` 文件头计入增删数。 |
| Q4 | suggestion | **属实**。`if (result.endsWith("]]>"))` 无条件截尾 3 字符（实际在 320 行，
  quality.json 写的 287 行漂移，需一并修正）。 |
| Q5 | suggestion | **属实**。`ParamVisualizer.unescapeXml`（ParamVisualizer.kt:26）与
  `ToolDisplayComponents.unescapeXmlForDisplay`（:313）重复实现，语义细节不一致。 |
| Q6 | suggestion | **属实**（UX 判断，medium 置信合理）。`ContentDetailDialog` 打开时
  `LaunchedEffect(lines.size)` 自动滚到最后一行（DialogComponents.kt:121–123）。 |

## 打回要求

1. 按上表修正 47 条 facts 的 ref 行号（断言文字无需改动，经核验全部为真）。
2. [110] 的 ref 文件一并改到 `part/XmlCanvasBlockComponents.kt:51`。
3. quality.json Q4 的 `line` 由 287 改为 320；Q2 的 `line` 由 125 改为 126。
4. 修正后须由**另一名独立 critic**重新逐条复验（writer 自检不能代替），
   复验通过后方可翻 `.status.json` 的 critic 字段。
