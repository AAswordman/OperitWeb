---
title: 流式内容解析插件与原生实现
module: util
sources: StreamPlugin.kt, BaseJsonPlugin.kt, StreamJsonPlugin.kt, StreamPureJsonPlugin.kt, StreamMarkdownPlugin.kt, StreamXmlPlugin.kt, NativeMarkdownSplitter.kt, NativeMarkdownStreamOperators.kt, NativeXmlSplitter.kt, native_markdown_splitter.cpp, native_xml_splitter.cpp, StreamOperators.cpp, StreamOperators.h, StreamGroup.h
date: 2026-10-01
---

# 流式内容解析插件与原生实现

> 源码：Operit @ `dbf71916` ｜ Issue #86 ｜ 状态：待评审

## 概述

AI 回复是逐字流式到达的，等整段收完再解析 Markdown/JSON/XML 会让用户干等。本页覆盖 Operit 的两套流式解析设施：

1. **Kotlin 插件体系**（`app/src/main/java/com/ai/assistance/operit/util/stream/plugins/`）：`StreamPlugin` 接口 + 18 个 Markdown 插件、`StreamXmlPlugin`、两个 JSON 插件。每个插件逐字符消费输入流，用 `true/false` 返回值决定字符是否发射，`splitBy` 把流切成带标签的分组。
2. **JNI 原生实现**（`app/src/main/java/com/ai/assistance/operit/util/streamnative/` + `app/src/main/cpp/streamnative/`）：同一套插件逻辑的 C++ 移植，跑在 `streamnative` 共享库里。Kotlin 侧只做 JNI 薄封装：`push(chunk)` 喂 UTF-16 文块，拿回展平的 `(type,start,end)` 三元组 int 数组。

为什么有两套？Kotlin 插件是通用流式框架（JSON/XML/Markdown 都能插）；C++ 原生是 Markdown 渲染热路径的加速版——`WaifuMessageProcessor` 等 UI 渲染链路直接走原生切分，逐字符的 Kotlin 回调开销太大。

## AI 速览

**核心符号清单**

- `StreamPlugin` / `PluginState`（IDLE/TRYING/PROCESSING/WAITFOR）：插件接口与四态机
- `BaseJsonPlugin` → `StreamJsonPlugin`（全量发射）、`StreamPureJsonPlugin`（只发射内容）
- 18 个 `StreamMarkdown*Plugin`：围栏代码块、行内代码、粗体、斜体、标题、链接、图片、引用、分隔线、删除线、下划线、有序/无序列表、4 种 LaTeX、表格
- `StreamXmlPlugin`：XML 标签流解析（含 C++ 移植版）
- `NativeMarkdownSplitter`：`createBlockSession` / `createInlineSession` / `Session.push` / `parseInlineToStableNodes`
- `NativeXmlSplitter.splitXmlTag`：原生 XML 切段
- `nativeMarkdownSplitByBlock` / `nativeMarkdownSplitByInline`：流式算子（Char/String 双重载）
- C++ 侧：`MarkdownSession::push`、`splitByXml`、`Segment{type,start,end}`、`SEG_BREAK=-1`

**主入口**

- Kotlin 通用：`Stream<Char>.splitBy(plugins)`（定义在 `app/src/main/java/com/ai/assistance/operit/util/stream/StreamOperators.kt`）
- 原生 Markdown：`Stream<Char>.nativeMarkdownSplitByBlock()` / `.nativeMarkdownSplitByInline()`
- 原生 XML：`NativeXmlSplitter.splitXmlTag(content)`
- 一次性行内解析：`NativeMarkdownSplitter.parseInlineToStableNodes(content)`

**数据流向一句话**：字符流 → 插件逐字符判定并发射 → `splitBy` 按插件聚成 `StreamGroup`；原生路径则是 文块 → JNI `push` → `(type,start,end)` 三元组 → Kotlin 按类型分拣进不同 channel 发射 `StreamGroup<MarkdownProcessorType?>`。

## 核心机制

### 1. 四态机插件模型

`StreamPlugin` 只认一个方法：`processChar(c, atStartOfLine): Boolean`。返回值是过滤器语义——`true` 发射该字符，`false` 吞掉。状态只有四个：

- `IDLE`：空闲，未命中任何模式
- `TRYING`：命中了模式开头，正在攒字符确认
- `PROCESSING`：确认命中，正在处理模式内容
- `WAITFOR`：悬置等待，用下一个字符决定已攒字符去留（引用块、表格跨行时用）

`atStartOfLine` 由框架维护，标题、列表、引用、分隔线、表格这些行级结构都依赖它。

### 2. KMP 图匹配器

Markdown 插件内部用 `StreamKmpGraph` / `kmpPattern` DSL 描述模式（如 `literal("**")`、`group{…}`、`greedyStar{…}`），返回 `Match` / `InProgress` / `NoMatch` 三种结果。分组捕获（如链接的文本与 URL）用 `result.groups[GROUP_TEXT]` 取出。注意**插件顺序**：`Bold` 必须排在 `Italic` 前面，否则 `**text**` 会被先命中的斜体插件拆成两段。

### 3. JSON 插件：括号计数器

`BaseJsonPlugin` 是抽象骨架：IDLE 时见 `{`/`[` 进入 PROCESSING，之后数字符串感知地计数括号（字符串内的括号不算，转义符正确处理），计数归零即结构完整，`reset()` 回 IDLE。`shouldEmit` 留给子类：

- `StreamJsonPlugin`：恒 `true`，整个 JSON 原样发射
- `StreamPureJsonPlugin`：字符串内去转义符去引号发射内容，字符串外丢掉 `{}[]",:` 和空白——只留"纯内容"

### 4. XML 插件：标签状态机 + 中文语境优化

`StreamXmlPlugin` 用起始标签匹配器抓 `<tag …>`，标签名必须以 ASCII 字母开头、后续只许字母数字下划线；命中后动态构造 `</tag>` 结束匹配器。两个实用细节：

- 自闭合标签（`<br/>`）被当普通文本，不进入 XML 模式
- 中文标点（，。？！：（）《》）或 emoji 之后允许 `<` 直接开标签——这是为 AI 中文回复里 `<think>` 这类标签紧跟标点/emoji 的场景做的

已知限制（源码自述）：**不支持同名嵌套标签**。

### 5. JNI 原生切分：会话 + 三元组

C++ 侧是同一套插件的移植（`app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.cpp` 等），但驱动方式不同：`MarkdownSession` 持有插件表，`push(chars, len)` 喂一块 UTF-16，返回 `vector<Segment>`，每个 `Segment{type, start, end}`。`type` 是与 `MarkdownProcessorType` 序数对齐的 int 常量（`MD_HEADER=0 … MD_PLAIN_TEXT=17, MD_HTML_BREAK=18`），`SEG_BREAK=-1` 是分组边界哨兵。

会话分两种：Block 会话装 11 个块级插件（顺序必须与 `NestedMarkdownProcessor.getBlockPlugins()` 一致），Inline 会话装 8 个行内插件。`globalOffset_` 让多次 `push` 的索引全局连续。

JNI 胶水（`native_markdown_splitter.cpp` / `native_xml_splitter.cpp`）：`nativeCreateBlockSession` 等返回 `jlong` 句柄（`reinterpret_cast` 指针），`nativePush` 用 `GetStringChars` 取 UTF-16、`ReleaseStringChars` 释放，结果展平成 3 倍长的 `jintArray`。库名 `streamnative`，`System.loadLibrary("streamnative")`，CMake 里是 SHARED 库。

### 6. Kotlin 流式算子：channel 分拣

`nativeMarkdownSplitBySession`（Char/String 各一套）是核心：上游每来一个字符就追加到 `fullContent` 和 `deltaBuffer`；换行或增量达到 `maxDeltaChars` 时 `flushDelta()`——把 delta 喂给原生 session，按返回的三元组把文本分拣进 channel：`PLAIN_TEXT` 进默认 channel（tag=null），其他类型按 `MarkdownProcessorType` 开/关插件 channel，每段包装成 `StreamGroup(tag, stream)` 发射。`SEG_BREAK`（负 type）直接关闭当前分组。`initialContent` 参数用于恢复解析器状态而不重发已渲染的前缀（回滚重渲染场景）。结束时 `finally` 取消定时 flush 任务、关 channel、销毁原生 session。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `StreamPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamPlugin.kt:24` | 插件接口：processChar / initPlugin / destroy / reset |
| `PluginState` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamPlugin.kt:6` | IDLE / TRYING / PROCESSING / WAITFOR |
| `BaseJsonPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/BaseJsonPlugin.kt:7` | JSON 括号计数抽象骨架，发射策略由子类实现 |
| `StreamJsonPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamJsonPlugin.kt:11` | 全量发射 JSON |
| `StreamPureJsonPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamPureJsonPlugin.kt:12` | 只发射 JSON 内容字符 |
| `StreamMarkdownFencedCodeBlockPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:36` | 围栏代码块 |
| `StreamMarkdownInlineCodePlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:143` | 行内代码（等长反引号） |
| `StreamMarkdownBoldPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:223` | `**text**` |
| `StreamMarkdownItalicPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:295` | `*text*` |
| `StreamMarkdownHeaderPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:382` | `#` 标题（1-6 个） |
| `StreamMarkdownLinkPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:469` | `[text]`（方括号文本）+ `(url)`（圆括号地址） |
| `StreamMarkdownImagePlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:559` | `![alt]`（叹号+方括号）+ `(url)`（圆括号地址） |
| `StreamMarkdownBlockQuotePlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:666` | `> ` 引用 |
| `StreamMarkdownHorizontalRulePlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:751` | `---` / `***` / `___` |
| `StreamMarkdownStrikethroughPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:819` | `~~text~~` |
| `StreamMarkdownUnderlinePlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:892` | `__text__` |
| `StreamMarkdownOrderedListPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:965` | `1. ` 有序列表 |
| `StreamMarkdownUnorderedListPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:1037` | `- ` / `+ ` / `* ` 无序列表 |
| `StreamMarkdownInlineLaTeXPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:1106` | `$…$` |
| `StreamMarkdownInlineParenLaTeXPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:1175` | `\(…\)` |
| `StreamMarkdownBlockLaTeXPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:1246` | `$$…$$` |
| `StreamMarkdownBlockBracketLaTeXPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:1308` | `\[…\]` |
| `StreamMarkdownTablePlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamMarkdownPlugin.kt:1374` | `\|` 表格 |
| `StreamXmlPlugin` | `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/StreamXmlPlugin.kt:16` | XML 标签流解析 |
| `NativeMarkdownSplitter` | `app/src/main/java/com/ai/assistance/operit/util/streamnative/NativeMarkdownSplitter.kt:38` | JNI 封装 object，Session 句柄包装类 |
| `NativeXmlSplitter` | `app/src/main/java/com/ai/assistance/operit/util/streamnative/NativeXmlSplitter.kt:4` | `splitXmlTag(content)` |
| `nativeMarkdownSplitByBlock` | `app/src/main/java/com/ai/assistance/operit/util/streamnative/NativeMarkdownStreamOperators.kt:419` | 块级流式切分算子 |
| `nativeMarkdownSplitByInline` | `app/src/main/java/com/ai/assistance/operit/util/streamnative/NativeMarkdownStreamOperators.kt:443` | 行内流式切分算子 |
| `MarkdownSession::push` | `app/src/main/cpp/streamnative/StreamOperators.cpp` | 原生逐字符驱动 |
| `splitByXml` | `app/src/main/cpp/streamnative/StreamOperators.cpp` | 原生 XML 切段 |
| `Segment` | `app/src/main/cpp/streamnative/StreamGroup.h:6` | `{type, start, end}` 三元组 |
| `MarkdownProcessorType` | `app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:24` | 19 种类型枚举，与 C++ `MD_*` 序数对齐 |

## 输入→处理→输出调用链

**链路 A：Kotlin 通用插件（以 XML 为例）**

1. **输入**：`Stream<Char>` 字符流 + `listOf(StreamXmlPlugin())`，如 `ExternalChatResponseSanitizer` 的 `raw.charStream().splitBy(listOf(StreamXmlPlugin()))`
2. **处理**：`splitBy` 逐字符喂给每个插件的 `processChar`；`StreamXmlPlugin` 用起始标签匹配器抓 `<tag>`，命中后动态构造 `</tag>` 结束匹配器，返回值决定每个字符发射与否
3. **输出**：`Stream<StreamGroup<StreamPlugin?>>`——标签段与普通文本段被切成带插件标签的分组流，下游按组消费

**链路 B：原生 Markdown 流式切分**

1. **输入**：`Stream<Char>`（如 AI 回复字符流）调用 `.nativeMarkdownSplitByBlock(flushIntervalMs, maxDeltaChars)`
2. **处理**：字符攒入 `deltaBuffer`，换行/达阈值/定时触发 `flushDelta()` → JNI `nativePush(handle, delta)` → C++ `MarkdownSession::push` 跑 11 个块级插件 → 返回 `(type,start,end)` 三元组 → Kotlin 按类型分拣进 `Channel<String>`
3. **输出**：`Stream<StreamGroup<MarkdownProcessorType?>>`——每段 Markdown 块（标题/代码块/表格/纯文本…）是一个带类型标签的分组，`WaifuMessageProcessor` 按组做流式渲染

**链路 C：原生 XML 一次性切段**

1. **输入**：完整字符串 `content` → `NativeXmlSplitter.splitXmlTag(content)`
2. **处理**：JNI `nativeSplitXmlSegments` → C++ `splitByXml` 跑 `StreamXmlPlugin`，type 0=文本、type 1=XML 段
3. **输出**：`List<List<String>>`，元素为 `[tagName, chunk]` 或 `["text", chunk]`，供 `StructuredAssistantContentParser` 解析

## 来源

- `app/src/main/java/com/ai/assistance/operit/util/stream/plugins/`：`StreamPlugin.kt`、`BaseJsonPlugin.kt`、`StreamJsonPlugin.kt`、`StreamPureJsonPlugin.kt`、`StreamMarkdownPlugin.kt`（1509 行，18 个插件类）、`StreamXmlPlugin.kt`
- `app/src/main/java/com/ai/assistance/operit/util/streamnative/`：`NativeMarkdownSplitter.kt`、`NativeMarkdownStreamOperators.kt`（503 行）、`NativeXmlSplitter.kt`
- `app/src/main/cpp/streamnative/`：`native_markdown_splitter.cpp`、`native_xml_splitter.cpp`、`StreamOperators.cpp`（496 行）、`StreamOperators.h`、`StreamGroup.h`、`app/src/main/java/com/ai/assistance/operit/util/stream/plugins/`（Markdown/Xml 插件 C++ 移植）
- 调用方：`app/src/main/java/com/ai/assistance/operit/util/StructuredAssistantContentParser.kt:27`、`app/src/main/java/com/ai/assistance/operit/util/WaifuMessageProcessor.kt:116`
- 类型枚举：`app/src/main/java/com/ai/assistance/operit/util/markdown/MarkdownProcessor.kt:24`
