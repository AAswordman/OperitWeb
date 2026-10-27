# ui-chat-parts 第三轮独立复验报告（critic3）

- 条目：ui-chat-parts（Issue #93）
- 复验对象：第二轮修错后版本（facts 144→151，status.json refs_valid=151）
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb（已确认 HEAD 一致）
- 复验人：第三名独立 critic（未参与前两轮打回与修错）

## 一、14 处新锚点逐条核对（±5 窗口）

| # | ref | 断言 | 窗口核对 |
|---|-----|------|---------|
| 72 | ToolDisplayComponents.kt:161 | CodeContentWithLineNumbers 行号列固定 40.dp | PASS（`40.dp` 在窗口内） |
| 73 | ToolDisplayComponents.kt:180 | XML 标签行且短于 300 字符时做语法高亮 | PASS（`lineLengthLimit = 300` :178 + 标签行判定 :179–185） |
| 74 | ToolDisplayComponents.kt:224 | FormattedXmlText 在 Dispatchers.Default 异步计算高亮 | PASS |
| 75 | ToolDisplayComponents.kt:247 | 尖括号用紫色 0xFF9C27B0 高亮 | PASS |
| 76 | ToolDisplayComponents.kt:274 | 标签字母用蓝色 0xFF2196F3 高亮 | PASS |
| 77 | ToolDisplayComponents.kt:316 | unescapeXmlForDisplay 剥离 CDATA 包裹 | PASS |
| 78 | ToolDisplayComponents.kt:330 | 反转义 &lt;/&gt;/&amp;/&quot;/&apos; 五种实体 | PASS（五条 .replace 全在窗口 328–332） |
| 115 | XmlCanvasBlockComponents.kt:177 | CanvasIndentedGuide 默认缩进 10.dp | **FAIL（见问题 1）** |
| 116 | XmlCanvasBlockComponents.kt:193 | 竖线用 Brush.verticalGradient 上下渐隐 | PASS |
| 134 | AttachmentViewerDialog.kt:268 | 音频预览用 AudioAttachmentPlayer，autoPlay=false | PASS |
| 135 | AttachmentViewerDialog.kt:285 | 视频预览用 VideoAttachmentPlayer，autoPlay=false | PASS |
| 139 | AttachmentViewerDialog.kt:433 | readBytesLimited 用 64KB 缓冲分块读 | PASS |
| 140 | AttachmentViewerDialog.kt:439 | 读取数据超限时抛 IllegalArgumentException | PASS |
| 142 | AttachmentViewerDialog.kt:383 | fileExtForMimeType 映射 mp3/wav/ogg/webm/mp4/ogv 等 | PASS（378–387 全在窗口内） |

13/14 新锚点完整支撑断言。

## 二、发现的剩余问题（2 项，均为单点重锚，断言本身已验真）

### 问题 1：facts[115] "dp" 单位超出窗口
- 当前 ref：XmlCanvasBlockComponents.kt:177，窗口 171–182。
- 窗口内含 `indentStart: Int = 10`（:180），但 `.dp` 单位换算在 :186（`.padding(start = indentStart.dp, …)`），超出窗口 4 行。
- 断言"默认缩进 10.dp"本身为真（:180 默认值 + :186 单位）。
- 修正：ref 改为 **:181**（窗口 175–187 同时覆盖 :180 与 :186）。

### 问题 2：facts[28] 三分支逻辑锚点偏离
- 当前 ref：CustomXmlRenderer.kt:740，窗口 735–745。
- 断言"思考展开逻辑：初始展开且已完成则展开；进行中跟随用户偏好 expandThinkingProcess；结束后总是折叠"——三分支 `targetExpanded` 逻辑实际在 :781–789（`if (initialThinkingExpanded && !isThinkingInProgress) … else if (isThinkingInProgress) expandThinkingProcess … else 折叠`），:740 窗口只含偏好与 in-progress 判定输入，不含分支本体。
- 断言本身为真（:781–789 逐行核实）。
- 修正：ref 改为 **:784**（窗口 778–789 覆盖全部三分支）。

## 三、复合事实残留扫描

- 151 条 facts 的 ref 全部合法（文件存在、行号无越界）：0 问题。
- 含"；"的 2 条人工核查：
  - facts[9]（:141）：单个 if/else 语句的双分支描述，窗口 136–146 完整覆盖两分支——可接受，非违规复合。
  - facts[28]：见问题 2（重锚即可）。
- 其余 149 条无复合残留。

## 四、quality 7 条逐字比对

- 7/7 evidence 与源码逐字节一致（含首行在 ±5 窗口内）：
  - Q4（ToolDisplayComponents.kt:320）首行 `    if (result.endsWith("]]>") ) {` 与源码第 320 行字节级一致（`)` 前空格已修正）。
- severity：1 high / 2 warn / 4 suggestion，分级合理。
- high 实锤核实：CustomXmlRenderer.kt:1433 附近 `javaScriptEnabled = true`（:1433）、`allowUniversalAccessFromFileURLs = true`（:1440）、`mixedContentMode = MIXED_CONTENT_ALWAYS_ALLOW`（:1446）、`loadDataWithBaseURL(null, fullHtml, …)`（:1467），且加载路径无消毒调用——high 评级恰当，无夸大。

## 五、状态与规范

- status.json：issue=93（整数）、source_commit=dbf71916…（正确）、refs_valid=151（= facts 数组实际长度）、status=review-pending、critic 字段为空（待 parent 填写）——全对。
- 5 个交付文件全文"通过/批准/LGTM"：0 命中。
- facts/quality 均为顶层数组；severity 取值仅 high/warn/suggestion。

## 六、总体 verdict

**FAIL**——无虚构事实、无 evidence 造假、无 high 膨胀；剩余 2 项均为机械重锚（facts[115] :177→:181、facts[28] :740→:784），断言内容已逐条验真。按既有先例，parent 可直接修正 2 处并核对 ±5 窗口，无需第四轮全量复核。
