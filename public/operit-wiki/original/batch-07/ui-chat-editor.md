---
title: 内置代码编辑器
module: 聊天 / webview 工作区
sources: 105
date: 2026-10-01
---

# ui-chat-editor（内置代码编辑器）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/workspace/editor/`（24 个 Kotlin 文件，约 5,416 行）@ `dbf71916`

## 概述

这是 Operit 聊天工作区里自研的一个**手机代码编辑器**：没有用 WebView，也没有用系统 EditText，而是自己拿 Android 的 Canvas（画布）在 SurfaceView 上一笔一笔画出代码、光标、行号和选区。之所以自研，是因为要在手机上同时搞定等宽排版、CJK/emoji 宽字符、中文输入法（IME）、代码高亮、自动补全和双指缩放——系统控件拼不齐这些需求。

整套编辑器分四层：

1. **Compose 入口层**（`CodeEditor.kt`）——给 Compose 界面用的可组合函数，顺带提供底部符号工具条（`{ } ( ) [ ]` 等快捷输入）和补全弹窗的锚点计算。
2. **渲染与交互层**（`CanvasCodeEditorView.kt`，1953 行，最大文件）——SurfaceView + 独立渲染线程，负责绘制、触摸、手势、滚动、缩放、选择、剪贴板、输入法连接。
3. **文档模型层**（`EditorDocument.kt`）——纯 Kotlin 文本模型：行索引、undo/redo、字素簇（grapheme cluster，人眼看到的“一个字符”，比如带肤色修饰的 emoji）光标移动、自动缩进。
4. **语言服务层**——`language/`（关键字/类型配色与各语言关键字表）、`EditorSyntaxHighlighter.kt`（后台线程做高亮）、`completion/`（代码补全）、`LanguageDetector.kt`（按扩展名判语言）、`CodeFormatter.kt`（JS/CSS/HTML 格式化）、`theme/`（主题）、`EditorMetrics.kt`（字体度量）。

## AI 速览

- **核心符号**：`CodeEditor`（Compose 入口）、`NativeCodeEditor`（ViewGroup 包装）、`CanvasCodeEditorView`（SurfaceView 渲染+交互）、`EditorDocument`（文档模型）、`EditorSyntaxHighlighter`（后台高亮）、`EditorCompletionCallback`（补全回调接口）、`CompletionProviderFactory`（补全分发）、`LanguageSupportRegistry`（语言注册表）、`EditorTheme`/`getThemeForLanguage`（主题）、`EditorMetrics`（字体度量）、`CodeFormatter.format`（格式化）、`LanguageDetector.detectLanguage`（语言检测）。
- **主入口**：Compose 侧调 `CodeEditor(code, language, onCodeChange, …)`；原生侧所有能力经 `CanvasCodeEditorView` 的公开方法（`setTextContent` / `insertSymbol` / `applyCompletion` / `undo` / `redo`）。
- **数据流向一句话**：用户触摸/键盘/IME → `CanvasCodeEditorView` 改 `EditorDocument` → `onDocumentMutated()` 触发“重绘 + 后台高亮 + 补全更新 + onCodeChange 回调”。

## 核心机制

### 1. 双线程渲染：UI 线程改数据，渲染线程只画画

`CanvasCodeEditorView` 继承 `SurfaceView`，自己起了一个叫 `CanvasCodeEditorRenderer` 的渲染线程。UI 线程（触摸、输入法、按键）只改 `EditorDocument` 里的数据，然后调用 `requestRender()` 把 `isDirty` 标志位置 true 并唤醒渲染线程；渲染线程醒来后 `lockCanvas()` 拿到画布，一口气画完背景、行号、缩进参考线、文本、选区、光标、选择手柄，再 `unlockCanvasAndPost` 上屏。只重绘可见行（`firstVisibleLine..lastVisibleLine` 由滚动偏移算出），长文件不卡。

一个细节：fling（惯性滚动）的 `OverScroller` 步进**故意放在主线程**用 `postOnAnimation` 逐帧跑——注释里写了原因：某些机型（如 HONOR）在渲染线程调 `computeScrollOffset()` 会因无 looper 崩溃（#798），渲染线程只管画主线程发布出来的滚动偏移。

### 2. 文档模型：按“人眼字符”移动光标

`EditorDocument` 底层是 `SpannableStringBuilder`，另维护 `lineStarts` 行首索引做 O(1) 行定位。光标移动不按 Java `char`（会把 emoji 代理对拆半），而是按**字素簇**：`editorNextSymbolOffset` / `editorPreviousSymbolOffset` 能正确跳过 ZWJ 序列（👨‍👩‍👧）、变音符、emoji 肤色修饰符、区域指示符（国旗）、keycap 数字键。宽度模型：Tab=4 格、CJK/emoji=2 格、其余 1 格；点选定位时按“半格四舍五入”决定光标落在字符前还是后。

编辑历史用 `EditorEditCommand(before/after 文本 + 前后选区)` 压进 `undoStack`/`redoStack` 两个双端队列；回车 `insertNewlineWithIndent` 复制当前行缩进，行尾是 `{`/`[`/`(` 时多加 4 空格。注意：输入法**预编辑**（composing，拼音候选上屏前那段带下划线的字）不记入历史，只有最终 `commitText` 才记一次。

### 3. 后台高亮：版本丢弃，过期结果直接扔

`EditorSyntaxHighlighter` 在**单线程 executor** 上跑，`AtomicInteger latestRequestedVersion` 做版本号。每次文档变更带着 `document.version` 请求一次高亮；后台算完后在主线程回调里比对——如果算的不是最新版本，直接丢弃，保证慢机器上不会把旧配色刷上屏。高亮规则是手写的词法扫描：`//` 到行尾、`/* */` 到结束标记、字符串转义、数字（含 `0x`/`0b` 前缀、`L/F/D` 后缀）、标识符用 `Character.isJavaIdentifierStart` 识别后查关键字/类型表（含 `(` 后判函数名、首字母大写判类型）。配色是 VSCode Dark+ 那套（关键字 `#569CD6` 等）。注意数字消费有个小毛病：`1-2` 会被当成一个数字染成数字色（见代码走查）。

### 4. 补全：按语言分发 Provider，弹窗不抢焦点

`CompletionProviderFactory.getProvider(language)` 按语言名分发到 Kotlin/JavaScript/HTML/Dart 四个专用 provider，默认 `DefaultCompletionProvider`（用正则从文本里提取 `var/let/const/val` 定义的变量名）。默认触发字符是 `.` 和 `:`；`getPrefix` 从光标往前扫字母数字下划线得到前缀。Kotlin provider 内置常用方法表和 `fun`/`if` 代码片段（含 `${1}` 占位符）；HTML provider 区分“标签内”（补属性，插入 `attr="$1"`）和“普通位置”（补标签对 `<tag>$1</tag>`），还会提取 `id`/`class` 生成 `#id`/`.class` 选择器补全。

弹窗是 Compose `Popup`，刻意设 `focusable=false`（不抢输入法焦点）、宽 260.dp、最大高 220.dp。锚点由 `CodeEditor` 算：编辑器窗口偏移 + `getCursorScreenPosition()` + 6.dp 下移；键盘弹出时底部留 24.dp 避让。

### 5. 输入法（IME）对接

`onCreateInputConnection` 返回内部 `EditorInputConnection`（继承 `BaseInputConnection`）：`commitText`/`setComposingText`/`deleteSurroundingText` 把拼音/手写/语音的输入翻译成文档操作并归一化换行（`\r\n`→`\n`）；预编辑区间的下划线由 `drawComposingUnderline` 画；`updateSelection` 实时把选区变化告诉输入法。`onCheckIsTextEditor` 在只读模式返回 false，输入法不会弹。

### 6. 手势与选择

单击收拢选区并弹键盘；长按/双击选中单词并弹出**浮动选择菜单**（复制/剪切/粘贴/全选，只读时无剪切粘贴）；选中后两端出现圆形选择手柄，可拖动手柄改选区（命中阈值 `handleRadiusPx * 2.25f`）。双指缩放字号，范围钳制在 0.5x–3.0x，缩放以手势焦点为中心保持视觉锚定。硬件键盘支持方向键/Shift 选区/Home/End/Ctrl+A/C/V/X/Z/Y，Tab 插入 4 空格。

### 7. 杂项服务

- `LanguageDetector.detectLanguage(fileName)`：按扩展名映射 20+ 语言（kotlin/java/js/ts/html/css/xml/json/md/python/cpp/csharp/php/ruby/go/rust/swift/dart/shell/sql/yaml），未知→`text`。
- `CodeFormatter.format(code, language)`：只支持 javascript/css/html，其余打 warn 日志原样返回；异常打 error 返回原文。HTML 格式化有 14 个自闭合标签表、22 个内联标签表，`<script>`/`<style>` 内容透传不格式化。
- `EditorMetrics`：等宽基准取 `ceil(measureText("M"))`，行高 = 字高 × 1.25，基线垂直居中。
- `EditorTheme`：data class 主题；`getThemeForLanguage` 目前**忽略参数恒返回深色主题**（见走查）。
- 字体优先加载 `jetbrains_mono_nerd_font_regular`，缺失回退系统等宽；emoji 及符号区间（0x1F000–0x1FAFF 等）改用系统字体绘制，避免等宽字体缺字形画成 tofu。

## 关键符号

| 符号 | 位置 | 人话 |
|---|---|---|
| `CodeEditor` | CodeEditor.kt:51 | Compose 入口可组合函数 |
| `NativeCodeEditor` | CodeEditor.kt:233 | ViewGroup 包装，桥接 Compose 与画布视图 |
| `CanvasCodeEditorView` | CanvasCodeEditorView.kt | SurfaceView 本体：绘制+触摸+输入法 |
| `RenderThread` | CanvasCodeEditorView.kt:1892 | 独立渲染线程，线程名 CanvasCodeEditorRenderer |
| `EditorInputConnection` | CanvasCodeEditorView.kt:1760 | 输入法连接，把 IME 操作翻译成文档操作 |
| `EditorCompletionCallback` | CanvasCodeEditorView.kt:49 | 补全弹窗回调接口（显示/隐藏/是否可见） |
| `EditorDocument` | EditorDocument.kt | 文档模型：文本、行索引、undo/redo、选区 |
| `EditorEditCommand` | EditorDocument.kt:256 | 一次可撤销编辑的记录（前后文本+选区） |
| `editorNextSymbolOffset` / `editorPreviousSymbolOffset` | EditorDocument.kt:75/125 | 按字素簇移动光标 |
| `EditorSyntaxHighlighter` | EditorSyntaxHighlighter.kt | 后台线程高亮器，版本丢弃防过期 |
| `HighlightSnapshot` | EditorSyntaxHighlighter.kt:13 | 高亮结果快照（version + colors 数组） |
| `CompletionProviderFactory.getProvider` | completion/CompletionProviderFactory.kt:12 | 按语言分发补全 provider |
| `CompletionProvider.getPrefix` | completion/CompletionProvider.kt:82 | 从光标向前提取补全前缀 |
| `LanguageSupportRegistry` | language/LanguageSupportRegistry.kt | 语言支持注册表（各实现类自注册） |
| `LanguageFactory.init` | language/LanguageFactory.kt:10 | 触发四个语言类初始化 |
| `LanguageDetector.detectLanguage` | LanguageDetector.kt:12 | 按扩展名判语言 |
| `CodeFormatter.format` | CodeFormatter.kt:17 | JS/CSS/HTML 代码格式化 |
| `EditorTheme` / `getThemeForLanguage` | theme/EditorTheme.kt:10/105 | 主题 data class / 主题获取（恒返深色） |
| `EditorMetrics` | EditorMetrics.kt:7 | 字符宽度/行高/基线度量 |

## 输入 → 处理 → 输出调用链

**链路 1：打字上屏**
1. 输入：IME 经 `EditorInputConnection.commitText`（拼音选词/手写/语音）或硬件键盘 `handleKeyEvent`。
2. 处理：`document.replaceSelection(normalized, recordHistory=true)` 改 buffer → `onDocumentMutated()`（清偏好列→保证光标可见→`notifySelectionChanged` 通知 IME→`requestHighlight` 扔后台→`requestRender` 唤醒渲染线程→`updateCompletion`→`textChangedListener` 回调 Compose）。
3. 输出：渲染线程 `drawEditor` 重绘可见行；`onCodeChange` 把新文本同步回 Compose 状态。

**链路 2：点选定位**
1. 输入：`onTouchEvent` ACTION_UP，被判定为 tap（未超 touchSlop、非多指、非缩放）。
2. 处理：`screenToOffset(x, y)` 按“半格四舍五入”把触摸坐标映射为字符偏移 → `document.collapseSelection(offset)`。
3. 输出：`ensureCursorVisible` 滚动跟随 → 重绘光标 → 非只读时 `showSoftKeyboard()` 弹键盘。

**链路 3：代码补全**
1. 输入：文档变更后 `updateCompletion()`（只读/有选区/未启用则直接隐藏）。
2. 处理：`completionProvider.shouldShowCompletion`（默认看触发字符）→ `getCompletionItems(text, cursor)` 取候选 → `getPrefix` 取前缀。
3. 输出：`EditorCompletionCallback.showCompletions(items, prefix)` → Compose 弹窗在“窗口偏移+光标坐标+6.dp”处弹出；用户点选后 `applyCompletion` 替换前缀插入 `insertText`。

**链路 4：后台高亮**
1. 输入：`requestHighlight()` 带 `document.version`。
2. 处理：单线程 executor 上词法扫描整篇文本，逐字符填色数组。
3. 输出：主线程回调比对版本，一致才替换 `highlightSnapshot` + `requestRender()`，过期直接丢弃。

## 来源

- 种子目录 `app/src/main/java/com/ai/assistance/operit/ui/features/chat/webview/workspace/editor/` 全 24 文件（`CanvasCodeEditorView.kt` 1953 行、`EditorDocument.kt` 812 行、`CodeFormatter.kt` 452 行、`CodeEditor.kt` 373 行、`EditorSyntaxHighlighter.kt` 271 行等），源码 commit `dbf71916`。
- 原子事实见 `ui-chat-editor.facts.json`（105 条），代码走查见 `ui-chat-editor.quality.json`（12 条：1 高 / 5 警告 / 6 建议），lint 报告见 `ui-chat-editor.lint.md`。
