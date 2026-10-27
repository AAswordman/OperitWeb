# Critic 复验报告：ui-chat-parts（Issue #93）— 第二轮

- verdict: **FAIL**（7 项待修，详见末尾清单）
- critic: 第二名独立 critic
- 时间：2026-10-01
- 源码：~/workspace/Operit @ dbf71916（已核对 HEAD 一致）

## 复验方法

1. 第一名 critic 的 47 条 ref 修正清单：用脚本逐条比对修错后 facts.json 的 ref，
   47/47 与清单期望值完全一致（0 遗漏，含 [110] 的文件级修正）。
2. 从 47 条中随机抽 30 条（seed=42），独立拉出源码 ±5 窗口逐条人工核对断言支撑，
   不依赖清单描述。
3. quality.json 7 条：evidence 与源码逐字比对（字节级），行号、severity 逐条核实。
4. status.json 字段、禁用词、文件齐备性核对。

## 第一部分：47 条重定位复验

47 条 ref 与第一名 critic 修正表逐条一致，修正执行无遗漏。**PASS**。

随机抽样的 30 条：[19, 23, 24, 27, 29, 49, 54, 70, 72, 73, 74, 75, 76, 80, 85, 87, 90, 103, 111, 114, 117, 119, 120, 125, 126, 129, 132, 133, 134, 135]。

其中 24 条窗口完整支撑断言；**6 条存在复合断言/窗口覆盖不全问题**（断言本身经源码核实均为真，问题在原子化与引用窗口）：

### F1. facts[72] — 复合事实，第二分句窗口外
- ref: `part/ToolDisplayComponents.kt:161`，窗口 156–166
- fact: "CodeContentWithLineNumbers 行号列固定 40.dp，XML 标签行且短于 300 字符时做语法高亮。"
- 核实：`Modifier.width(40.dp)` 在 :161，窗口内；但"XML 标签行且短于 300 字符"逻辑在 :178–188
 （`lineLengthLimit = 300` 在 :178，`isXmlTagLine && line.length < lineLengthLimit` 在 :187），
  窗口外。两条独立断言挤在一条 fact 里。
- 修正：拆成两条——[72a] "CodeContentWithLineNumbers 行号列固定 40.dp" ref :161；
  [72b] "XML 标签行且短于 300 字符时做语法高亮" ref :180（窗口 175–185 覆盖 :178/:187）。

### F2. facts[73] — 颜色细节窗口外
- ref: `part/ToolDisplayComponents.kt:224`，窗口 219–229
- fact: "FormattedXmlText 在 Dispatchers.Default 异步计算高亮：尖括号紫 0xFF9C27B0，标签字母蓝 0xFF2196F3。"
- 核实：`withContext(Dispatchers.Default)` 在 :224，窗口内；但 0xFF9C27B0 在 :247/:253，
  0xFF2196F3 在 :274，窗口外。
- 修正：拆成三条——[73a] "FormattedXmlText 在 Dispatchers.Default 异步计算高亮" ref :224；
  [73b] "尖括号用紫色 0xFF9C27B0 高亮" ref :247；
  [73c] "标签字母用蓝色 0xFF2196F3 高亮" ref :274。

### F3. facts[74] — 实体反转义部分窗口外
- ref: `part/ToolDisplayComponents.kt:313`，窗口 308–318
- fact: "unescapeXmlForDisplay 剥离 CDATA 包裹并反转义 &lt;/&gt;/&amp;/&quot;/&apos;。"
- 核实：CDATA 剥离在 :316–324，窗口内；5 种实体反转义在 :328–332，窗口外。
- 修正：拆成两条——[74a] "unescapeXmlForDisplay 剥离 CDATA 包裹" ref :316；
  [74b] "unescapeXmlForDisplay 反转义 &lt;/&gt;/&amp;/&quot;/&apos; 五种实体" ref :330
  （窗口 325–335 覆盖 :328–332）。

### F4. facts[111] — 渐隐竖线窗口外
- ref: `part/XmlCanvasBlockComponents.kt:177`，窗口 172–182
- fact: "CanvasIndentedGuide 默认缩进 10.dp，画一条上下渐隐的竖线。"
- 核实：`indentStart: Int = 10` 在 :180，窗口内；`Brush.verticalGradient` 在 :193，窗口外。
- 修正：拆成两条——[111a] "CanvasIndentedGuide 默认缩进 10.dp" ref :177；
  [111b] "竖线用 Brush.verticalGradient 上下渐隐" ref :193（窗口 188–198 覆盖 :193）。

### F5. facts[129] — 视频分支窗口外
- ref: `attachments/AttachmentViewerDialog.kt:268`，窗口 263–273
- fact: "音频与视频预览分别用 AudioAttachmentPlayer/VideoAttachmentPlayer 且 autoPlay=false。"
- 核实：AudioAttachmentPlayer（:265）+ autoPlay=false（:268）在窗口内；
  VideoAttachmentPlayer 在 :281、其 autoPlay=false 在 :289，窗口外。
- 修正：拆成两条——[129a] "音频预览用 AudioAttachmentPlayer，autoPlay=false" ref :268；
  [129b] "视频预览用 VideoAttachmentPlayer，autoPlay=false" ref :285
  （窗口 280–290 覆盖 :281/:289）。

### F6. facts[133] — 缓冲与超限抛都在窗口外
- ref: `attachments/AttachmentViewerDialog.kt:421`，窗口 416–426
- fact: "readBytesLimited 用 64KB 缓冲分块读，超限抛 IllegalArgumentException。"
- 核实：`ByteArray(64 * 1024)` 在 :434，`throw IllegalArgumentException("Input exceeds limit…")` 在 :439，
  均在窗口外。
- 修正：拆成两条——[133a] "readBytesLimited 用 64KB 缓冲分块读" ref :433
  （窗口 428–438 覆盖 :434）；
  [133b] "读取数据超限时抛 IllegalArgumentException" ref :439
  （窗口 434–444 覆盖 :439）。

其余 24 条抽样 facts：ref ±5 窗口完整支撑断言，无虚构符号、无错文件。**PASS**。

## 第二部分：quality.json 7 条复验

| # | severity | line | 结论 |
|---|---|---|---|
| Q0 | high | CustomXmlRenderer.kt:1433 | **PASS**。evidence 8 行与源码 :1433–1448 逐字连续命中（`javaScriptEnabled = true`、`allowUniversalAccessFromFileURLs = true`、`MIXED_CONTENT_ALWAYS_ALLOW`）；评级 high 合理：AI 生成 HTML 未经消毒直接 `loadDataWithBaseURL`，存储型 XSS / 本地文件读取风险成立。 |
| Q1 | warn | CustomXmlRenderer.kt:1271 | **PASS**。evidence 4 行逐字命中；三处恒等 `.replace("<","<")` 死代码属实。 |
| Q2 | warn | AttachmentViewerDialog.kt:126 | **PASS**。行号已由 125 修正为 126，`File(dir, "$mediaPoolId.$ext")` 逐字命中；`mediaPoolId` 未校验分隔符，路径穿越判断成立（medium 置信恰当）。 |
| Q3 | suggestion | FileDiffDisplay.kt:52 | **PASS**。evidence 逐字命中；`+++` 头行被计入增删属实。 |
| Q4 | suggestion | ToolDisplayComponents.kt:320 | **FAIL（1 处）**。行号已由 287 修正为 320，正确；但 evidence 首行写 `if (result.endsWith("]]>")) {`，源码第 320 行为 `if (result.endsWith("]]>") ) {`——evidence 漏掉了 `)` 前的空格，违反逐字原文铁律。修正：从源码逐字复制该行。 |
| Q5 | suggestion | ParamVisualizer.kt:26 | **PASS**。evidence 3 行（含空行）与源码 :26–29 逐字连续命中；两处 unescape 重复实现属实。 |
| Q6 | suggestion | DialogComponents.kt:121 | **PASS**。evidence 逐字命中；`LaunchedEffect(lines.size)` 自动滚到底属实。 |

## 第三部分：status.json / 禁用词 / 格式

- status.json：`id=ui-chat-parts`、`issue=93`（整数）、`status=review-pending`、
  `source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、`refs_valid=144`=facts 数组长度、
  `critic=""`。**PASS**（注意：修错后 facts 数将因拆条变化，需同步更新 refs_valid）。
- 禁用词：md/facts.json/quality.json/status.json 全文 grep 禁用词表（3 个触发词）0 命中。**PASS**。
- facts.json/quality.json 顶层数组；severity 仅 high/warn/suggestion。**PASS**。
- lint.md 存在且记录了修错后复跑。

## 观察项（不计入 FAIL，供修错员参考）

- facts[135]（`attachments/AttachmentViewerDialog.kt:377`）："把 mp3/wav/ogg/webm/mp4/ogv 等映射到扩展名，
  其他取 mime 子类型"——窗口 372–382 只覆盖到 ogg（:382），webm/mp4 映射与 `else -> mt.substringAfter('/')`
  回退（:387）在窗口外。建议将 ref 移至 :383（窗口 378–388 覆盖全部映射与回退），或拆条。

## 修错清单（共 7 项）

1. facts[72] 拆条：[72a] 40.dp → :161；[72b] XML 标签行短于 300 字符高亮 → :180。
2. facts[73] 拆条：[73a] Dispatchers.Default 异步高亮 → :224；[73b] 尖括号紫 0xFF9C27B0 → :247；
   [73c] 标签字母蓝 0xFF2196F3 → :274。
3. facts[74] 拆条：[74a] 剥离 CDATA → :316；[74b] 反转义 5 种实体 → :330。
4. facts[111] 拆条：[111a] 默认缩进 10.dp → :177；[111b] verticalGradient 渐隐 → :193。
5. facts[129] 拆条：[129a] 音频 autoPlay=false → :268；[129b] 视频 autoPlay=false → :285。
6. facts[133] 拆条：[133a] 64KB 缓冲分块读 → :433；[133b] 超限抛 IllegalArgumentException → :439。
7. quality Q4 evidence 首行改为源码逐字：`if (result.endsWith("]]>") ) {`（注意 `)` 前空格）。

拆条后 facts 总数变化，须同步更新 status.json 的 refs_valid；修完后 4 文件（md/facts/quality/status）
隔离重跑 lint（0 硬失败/0 警告），更新 lint.md。

## 总体 verdict

**FAIL**——6 条 facts 存在复合断言且部分分句落在 ref ±5 窗口外，1 条 quality evidence 有一处
空格级非逐字偏差。断言内容经源码核实全部为真，无虚构；47 条重定位执行无遗漏。
按流程：修错员按上表修正后，须由另一名独立 critic 复验（本次 critic 不得复验自己的结论）。
