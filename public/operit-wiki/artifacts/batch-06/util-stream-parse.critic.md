# Critic 复核报告：util-stream-parse（Issue #86）

- 复核对象：`review/batch-06/util-stream-parse.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit` @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 复核方法：83 条 facts 全部做文件存在/行号越界机械校验（0 问题）；全部 ±5 窗口人工比对；10 条 quality evidence 与源码逐字比对；正文行内引用抽查；status.json 字段核对。

## 总体 verdict：FAIL（需修错后复验）

事实性错误 1 处，引用窗口违规 6 处，quality 行号错误 1 处。无虚构符号、无复合事实、无错文件；severity 评级合理；禁用词 0 命中；lint 0/0；status.json 字段全对（issue 86、commit 一致、refs_valid 83、review-pending）。

## 必须修的问题清单

### A. 事实性错误（1）

1. **facts[0]**：`PluginState` 枚举实际有 **4 个**状态（IDLE、TRYING、PROCESSING、WAITFOR，见 `StreamPlugin.kt:6-18`），fact 写"包含 IDLE、TRYING、PROCESSING 三个状态"是错的，且与本页 facts[1]（WAITFOR 定义）自相矛盾。修正："四个状态"。

### B. 引用 ±5 窗口违规（6）——断言为真，但 ref 行号落在无关代码上

2. **facts[54]**（splitXmlTag 转换逻辑）：ref `:11` 的窗口（6–16 行）只含函数签名和段读取，`listOf(tagName, chunk)` / `listOf("text", chunk)` 实际在 24–28 行。改 ref 为 `:24`。
3. **facts[57]**（nativeMarkdownSplitBySession）：ref `:7` 是一行 import，函数定义在 `:21`（Char 版），String 版在 `:220`。改 ref 为 `:21`。
4. **facts[64]**（段类型变化关闭旧 channel并发射新分组）：ref `:290` 的窗口是 `flushDelta` 实现；标签变化关闭逻辑在 150–153 行，`StreamGroup(tag, stream)` 发射在 `:280`。改 ref 为 `:280`。
5. **facts[66]**（finally 销毁原生 session）：ref `:201` 的窗口（196–206）不含 `session.destroy()`（在 `:208`）。改 ref 为 `:206`。
6. **facts[80]**（splitByXml type 0/1）：ref `:440` 的窗口只含 type 0（默认文本段），type 1（XML 段）在 `:452`。建议改 ref 为 `:447` 或拆成两条 fact 各给锚点。
7. **facts[38]**（表格插件换行进 WAITFOR）：ref `:1374` 的窗口是类声明，`state = PluginState.WAITFOR` 在 `:1411`。改 ref 为 `:1411`。

### C. quality 行号错误（1）

8. **quality[6]**：`file:line` 为 `NativeMarkdownStreamOperators.kt:7`，但 evidence 首行 `private fun Stream<Char>.nativeMarkdownSplitBySession(` 实际在 `:21`，:7 是 import 行。改 line 为 `21`。其余 9 条 quality 的 evidence 均与源码逐字一致，行号落在窗口内。

## PASS 的部分

- 83 条 facts：文件存在、行号无越界、无复合事实、无虚构符号；除上述 7 条外，其余 76 条 ±5 窗口完整支撑断言。
- 10 条 quality：除第 6 条行号外，evidence 均为源码逐字原文；5 条 warn 重点项逐一核实成立——
  - inline code KDoc 声称支持双反引号但起始模式是单个反引号（`StreamMarkdownPlugin.kt:136` KDoc vs `:149` 模式）；
  - JNI OOM 返回 nullptr 与 Kotlin `nativePush` 非空 `IntArray` 声明冲突；
  - XML 不支持同名嵌套（源码 KDoc 第 9–11 行自述）；
  - PrefixMatcher 失配 `i=0` 无部分回退（注释原文 "no partial fallback"）；
  - nativePush handle==0 静默返回空数组（`:64`）。
- high 评级：本页无 high，合理（无安全/数据丢失级问题）。
- 正文：固定结构完整；行内引用抽查（StreamJsonPlugin.kt:11、StreamXmlPlugin.kt:16、NativeMarkdownSplitter.kt:38、NativeXmlSplitter.kt:4、StreamGroup.h:6、MarkdownProcessor.kt:24 等）均落在有效窗口；18 个 Markdown 插件、BaseJsonPlugin、StreamXmlPlugin、JNI 原生会话、StreamPlugin 状态机均有覆盖；MarkdownProcessorType 19 种枚举已数实。
- status.json：`issue=86`、`source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、`refs_valid=83`（= facts 条数）、`status=review-pending`、`critic=""`，全对。
- 禁用词（通过/批准/LGTM）5 文件 0 命中；lint 0 硬失败 / 0 警告。

## 下一步

修错员按 A–C 共 8 项修正后，派另一名独立 critic 复验（重点复核 facts[0] 数字与 7 处新锚点窗口）。
