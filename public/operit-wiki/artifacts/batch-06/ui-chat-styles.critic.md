# Critic 复核报告：ui-chat-styles（Issue #92）

- 复核对象：`review/batch-06/ui-chat-styles.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 结论：**FAIL** —— 存在 5 项必须修正的问题（见文末清单），另有 11 条 facts 锚点需挪行。修正后需第二名 critic 复验。

## 一、facts.json（111 条）逐条核验

核验方法：脚本校验全部 111 条 ref（文件存在、行号不越界），再对字面量/数字/符号做窗口匹配，命中的可疑条目逐条人工比对源码。

### 1.1 真实错误（必须修）

- **[36] FAIL —— 符号错误**：fact 写"绘制背景后再 drawContent 画内容"，但源码中不存在 `drawContent`，实际 API 是 `drawWithContent`（`BubbleImageBackgroundSurface.kt:72` 的 `.drawWithContent {`）。断言含义为真，但符号名写错，必须改为 `drawWithContent`。
- **[50] FAIL —— 复合事实 + 锚点失配**：一条 fact 含两个断言（"proxySenderName 从 proxySenderTag 提取" / "头像优先级为代发人头像、自定义头像、全局头像"），违反原子化。且 ref `:137` 的 ±5 窗口内只有头像查找，看不到提取逻辑——实际提取在 `parseMessageContent` 内 `:783`（`ChatMarkupRegex.proxySenderTag.find`）。必须拆成两条并各自重锚。
- **[55] FAIL —— 复合事实 + 锚点失配**：一条 fact 含两个断言（"尾部附件行右对齐" / "点击打开 AttachmentViewerDialog"）。右对齐在 `:321` 窗口内成立（`Arrangement.End`），但 `AttachmentViewerDialog` 的实际挂载在 `:681`（`showContentPreview` 门控），超出窗口。必须拆成两条并各自重锚。

### 1.2 锚点窗口违规（事实为真，ref 行号需挪到 ±5 窗口内）

| # | 当前 ref | 问题 | 建议锚点 |
|---|---|---|---|
| [6] | `:39` | 窗口 34–44 只覆盖 AI 内边距（34–35），用户内边距 12f 在 32–33 | `:33` |
| [7] | `:66` | `BLOCK_LATEX` 在第 72 行，窗口 61–71 差一行 | `:69` |
| [18] | `:235` | `applyFontFamilyToTypography` 在 244、`resolveConfiguredFontFamily` 在 247，超出窗口 | `:242` |
| [22] | `:268` | 宽布局的 `Column` 实际在第 283 行 | `:280` |
| [30] | `:148` | `append(" by ")` 实际在第 155 行 | `:152` |
| [37] | `:95` | `withContext(Dispatchers.IO)` 在第 101 行，窗口 90–100 差一行 | `:99` |
| [39] | `:208` | 函数声明在第 200 行（钳制代码 206 行在窗口内，但函数名不在） | `:203` |
| [65] | `:807` | `id = "media_pool:${tag.id}"` 在第 822 行 | `:819` |
| [89] | `:102` | `FLAG_ACTIVITY_NEW_TASK` 在第 109 行，try/catch 在 111–113 | `:108` |
| [91] | `:156` | `roleName` 拼接在第 146 行 | `:148` |
| [104] | `:130` | `onSecondaryContainer` 在第 137 行，窗口 125–135 差两行 | `:135` |

### 1.3 抽查 PASS（其余 97 条经脚本 + 抽样人工核对无问题）

- 抽样人工核对：[0–5] 分发三路、[9] 头像形状、[11] rendererState 缓存、[13] XML 参数、[14] 300ms 动画（`tween(durationMillis = 300)`，fact 写"300ms"属合理转述）、[16] 全宽条件、[19–21] 玻璃互斥（`liquidGlassEnabled = !waterGlassEnabled && ...`，`effectiveBubbleImageStyle` 置 null）、[23] 85% 宽（`maxWidth * 0.85f`）、[24] AI 气泡圆角 `(4,20,20,20)`、[86] KDoc 原文、[92] `overrideStream ?: message.contentStream`、[100] 400.dp（`:136` 对上）、[107] 320.dp（`:246` 对上）等，均与源码一致。
- [8]/[12]/[27]/[34]/[66]/[75] 的关键符号虽不在字面窗口内，但窗口内的调用/注释/条件完整支撑断言，记 PASS（[75] 的 `AttachmentTag` 可点击条件四项在 1068–1073 行内齐全）。

## 二、quality.json（8 条）逐条核验

- evidence 逐字比对：7/8 完全逐字命中；[7] 仅缩进空白差异，实质一致。
- 4 条 warn 实质核实：
  - [0]/[1] `remember` 内 `runBlocking` 查角色卡头像（`:124` / `:137`，上下文已确认在 `remember{}` 内）——属实，warn 合理（性能类，未到 high）。
  - [2] `parseMessageContent` 在 `remember(message.content, ...)` 内做 `Base64.decode` + `decodeDownsampledBitmap`（`:127` 调用，`:795` 解码）——属实。
  - [3] 链接行为不一致：bubble `:193` 返回空操作 `{ _: String -> }`，cursor `AiMessageComposable.kt:102–110` 回退系统浏览器（`FLAG_ACTIVITY_NEW_TASK`，失败忽略）——双边已核实，属实。
- [4] 两套 `parseMessageContent` 重复定义（bubble `:778` / cursor `:417` 均为 `private fun`）——属实，suggestion 合理。
- [5] `runCatching{}.getOrNull()` 静默吞错——属实（`withContext(Dispatchers.IO)` 包裹不改变"无日志"的结论）。
- [6] 过期图片 `AttachmentTag` 的 `onClick` 在 `bitmap == null` 时无反馈——evidence 逐字命中，属实。
- **[7] FAIL —— 描述数字错误**：description 写"两处 320.dp 气泡宽上限"，实际源码中有 **三处**：`bubble/BubbleUserMessageComposable.kt:408`、`:553`、`cursor/UserMessageComposable.kt:246`。必须修正计数（或改述为"多处硬编码"并列全）。

## 三、正文（ui-chat-styles.md）核验

- **FAIL —— 行为断言与实现不符**：核心机制 §6 写"工具输出恒用折叠执行模式"。该说法只存在于 cursor `AiMessageComposable.kt` 的 KDoc（`:36–39` "Always uses collapsed execution mode"），但实现上 `:66` 从 `displayPreferencesManager.toolCollapseMode` 读取用户偏好并透传给 `ThinkToolsXmlNodeGrouper`（`:92–96`），并未强制折叠。正文把过期文档当作行为事实陈述，必须修正（建议改为"默认跟随工具折叠偏好；KDoc 注明恒折叠但实现已改为读偏好"）。
- 行内引用与数据核对：AI 左气泡圆角 `(4,20,20,20)`、用户右气泡 `(20,4,20,20)`（`:402`/`:547`）、85% 宽、300ms 动画、16.dp 圆角 + 8.dp 阴影（总结对话框 `:106`/`:108`）、220.dp 占位、`overrideStream`、头像长按 mention（`onAvatarLongPressMention` `:278`/`:487`）、`heightMemory.updateMeasured`——全部对上源码。
- 种子覆盖：`style/` 下 9 个 kt 文件（bubble 4 / cursor 4 / common 1）齐全，来源小节所列行数（101/692/822/1103/50/80/225/203/747）与 `wc -l` 完全一致；页面问题（两种风格、九宫格背景、圆角、工具折叠）均有覆盖。

## 四、status.json / lint / 禁用词

- PASS：`issue: 92`、`source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、`status: review-pending`、`critic: ""`、`refs_valid: 119` = 111 facts + 8 quality，数字吻合。
- PASS：隔离 lint 0 硬失败 / 0 警告；五文件"通过/批准/LGTM" 0 命中；severity 仅 warn/suggestion。

## 总体 verdict：FAIL

必须修正清单（修完后派第二名独立 critic 复验）：

1. facts[36]：`drawContent` → `drawWithContent`。
2. facts[50]：拆成两条原子事实，分别重锚（提取逻辑锚 `:783` 附近，头像优先级锚 `:137` 附近）。
3. facts[55]：拆成两条原子事实，分别重锚（右对齐锚 `:321`，对话框锚 `:681` 附近）。
4. quality[7]：修正"两处 320.dp"为三处（列出行号）或改述。
5. 正文核心机制 §6：修正"工具输出恒用折叠执行模式"的行为断言，以实现（读偏好）为准。
6. 上表 11 条 facts 按建议锚点挪行（[6]/[7]/[18]/[22]/[30]/[37]/[39]/[65]/[89]/[91]/[104]）。
