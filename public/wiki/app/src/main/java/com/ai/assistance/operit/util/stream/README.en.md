# Stream Library - Comprehensive Application Guide

`Stream` is a lightweight asynchronous data stream processing library inspired by Kotlin Flow. It aims to provide a concise, powerful, and easy-to-use API for creating, transforming, and consuming asynchronous data sequences. Whether you are handling user input, network responses, or complex data pipelines, `Stream` offers an elegant solution.

This document serves as a comprehensive guide to help you go from getting started to mastering all features of the `Stream` library.

## Core Concepts

-   **`Stream<T>`**: This is the core of the library, representing a "cold" asynchronous data sequence. This means a `Stream` only starts executing its code and emitting elements when a collector exists.
-   **`SharedStream<T>`**: A "hot" stream, similar to `SharedFlow`. It can share data among multiple collectors. It can remain active even without collectors. An upstream exception at stream end can be queried via `completionCause`.
-   **`StateStream<T>`**: A special "hot" stream, similar to `StateFlow`. It always has a current value, and new collectors immediately receive the latest value.

---

## Quick Start

### 1. Creating a Stream

The `Stream` library provides many flexible ways to create data streams.

**Creating from existing data:**

```kotlin
// 从单个值创建
val singleValueStream = streamOf("Hello, Stream!")

// 从多个值创建
val multiValueStream = streamOf(1, 2, 3, 4, 5)

// 从集合创建
val list = listOf("A", "B", "C")
val streamFromList = list.asStream()

// 从序列创建
val streamFromSequence = generateSequence(0) { it + 1 }.asStream()
```

**Creating with a builder:**

The `stream { ... }` builder is the most general and powerful way to create streams, letting you define asynchronous operations inside it.

```kotlin
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

// 创建一个每秒发射一次递增数字的 Stream
val counterStream = stream<Int> {
    var count = 0
    while (true) {
        emit(count++)
        delay(1.seconds)
    }
}
```

**Creating with preset builders:**

```kotlin
// 创建一个发射指定范围整数的 Stream
val rangeStream = rangeStream(start = 1, count = 5) // 会发射 1, 2, 3, 4, 5

// 创建一个按指定时间间隔发射的 Stream
val intervalStream = intervalStream(period = 2.seconds) // 每2秒发射 0, 1, 2, ...
```

### 2. Consuming a Stream

Once a `Stream` is created, you can use `collect` to consume the elements it emits.

```kotlin
suspend fun main() {
    rangeStream(1, 3)
        .collect { number ->
            println("Received: $number")
        }
    // 输出:
    // Received: 1
    // Received: 2
    // Received: 3
}
```

In a coroutine scope, you can use `launchIn` to start collecting a `Stream` without manually managing the `Job`.

```kotlin
// 在 ViewModel 的 CoroutineScope 中启动
counterStream.launchIn(viewModelScope) { count ->
    // 更新 UI
    _uiState.value = "Current count: $count"
}
```

### 3. Converting a String to a Character Stream

The Stream library provides convenient extension functions for converting a string into a character stream:

```kotlin
// 将字符串转换为字符流
val text = "Hello, Stream!"
val charStream = text.stream()

// 收集字符流
charStream.collect { c ->
    print(c)  // 逐字符输出: Hello, Stream!
}
```

This conversion is well suited to text that needs character-by-character analysis, and is especially useful when implementing Markdown parsers, pattern matching, or text processing workflows.

```kotlin
// 字符流转换的实现方式
fun String.stream(): Stream<Char> {
    return stream {
        for (c in this@stream) {
            emit(c)
        }
    }
}
```

> **Note**: In MarkdownProcessor-related code, you may see a `toCharStream()` method, which does the same thing as the `stream()` method, only with a different name.

---

## Operators

Operators are the core functionality of `Stream`; they transform and combine data streams in various ways.

### Flow-Control Operations

- `lock()`: Lock the stream, pausing receipt of new data, while senders can still keep sending (data is buffered)
- `unlock()`: Unlock the stream, resuming data receipt, and sending all data buffered during the lock in order
- `clearBuffer()`: Clear data buffered during the lock
- `isLocked`: Check whether the stream is locked
- `bufferedCount`: See the number of elements currently buffered

```kotlin
// 使用锁定功能控制数据流
val stream = intervalStream(100.milliseconds)

// 在某个时刻锁定流，后续数据将被缓存
stream.lock()

// 检查锁定状态和缓冲区数据
println("流已锁定: ${stream.isLocked}")
println("缓冲区项数: ${stream.bufferedCount}")

// 在需要时解锁流，之前缓存的数据会按顺序发送
stream.unlock()

// 可以选择在解锁前清空缓冲区数据
stream.clearBuffer()
```

### Transformation Operations

-   `map { ... }`: Transform each element into a new element.
-   `flatMap { ... }`: Transform each element into a new `Stream`, then merge all of these new `Stream`s into one.

```kotlin
streamOf(1, 2, 3)
    .map { "Item #$it" } // Stream<String>
    .collect { println(it) } // 输出: Item #1, Item #2, Item #3

streamOf("A", "B")
    .flatMap { letter ->
        streamOf("${letter}1", "${letter}2")
    }
    .collect { println(it) } // 输出: A1, A2, B1, B2
```

### Filtering Operations

-   `filter { ... }`: Keep only elements that satisfy the condition.
-   `take(n)`: Take only the first `n` elements.
-   `drop(n)`: Drop the first `n` elements.
-   `distinctUntilChanged()`: Remove consecutive duplicate elements.

```kotlin
streamOf(1, 2, 2, 3, 3, 3, 4, 3)
    .distinctUntilChanged()
    .collect { print("$it ") } // 输出: 1 2 3 4 3
```

### Combination Operations

-   `merge(other)`: Merge two `Stream`s; the emission order of elements is not deterministic.
-   `concatWith(other)`: Concatenate two `Stream`s, starting to collect the second only after the first completes.
-   `combine(other) { a, b -> ... }`: Combine the latest values of two `Stream`s together.

```kotlin
val streamA = streamOf("A", "B").onEach { delay(100) }
val streamB = streamOf(1, 2).onEach { delay(150) }

streamA.combine(streamB) { letter, number -> "$letter$number" }
    .collect { println(it) }
// 可能的输出: A1, B1, B2
```

### Utility Operations

-   `onEach { ... }`: Perform an operation on each element without changing the element itself, commonly used for debugging or side effects.
-   `chunked(size)`: Split the elements in the stream into chunks of the specified size.
-   `throttleFirst(duration)`: Within a specified time window, emit only the first element.
-   `timeout(duration)`: If no new element is emitted within the specified time, throw a `TimeoutException`.

```kotlin
streamOf(1, 2, 3, 4, 5, 6, 7)
    .chunked(3)
    .collect { group ->
        println("Chunk: $group")
    }
// 输出:
// Chunk: [1, 2, 3]
// Chunk: [4, 5, 6]
// Chunk: [7]
```

### Error Handling

-   `catch { e -> ... }`: Catch exceptions occurring in the upstream `Stream`.
-   `finally { ... }`: Execute an action when the `Stream` completes or is cancelled.

```kotlin
stream<Int> {
    emit(1)
    emit(2)
    throw IllegalStateException("Something went wrong")
    }
.catch { error ->
    println("Caught error: ${error.message}")
    }
.collect {
    println("Received: $it")
}
// 输出:
// Received: 1
// Received: 2
// Caught error: Something went wrong
```

---

## Hot Streams: Sharing and State Management

Hot streams are used to broadcast data among multiple observers or to manage application state.

-   `MutableSharedStream<T>`: A mutable shared stream, used to manually emit events.
-   `MutableStateStream<T>`: A mutable state stream, used to maintain and update state.

**Example: Managing UI State and Events in a ViewModel**

```kotlin
class MyViewModel : ViewModel() {
    // 用于管理一次性事件，如Toast或导航
    private val _events = MutableSharedStream<String>()
    val events: SharedStream<String> = _events

    // 用于管理UI状态
    private val _uiState = MutableStateStream("Initial State")
    val uiState: StateStream<String> = _uiState

    fun performAction() {
        viewModelScope.launch {
            // 更新状态
            _uiState.value = "Loading..."
            delay(1000)

            // 模拟操作成功
            _uiState.value = "Action Successful"
            // 发射一次性事件
            _events.emit("Show success toast")
        }
    }
    }
```

### Converting a Cold Stream to a Hot Stream

You can use `shareIn` and `stateIn` to convert any cold stream into a hot stream.

-   `share(scope, ...)`: Convert a cold stream to a `SharedStream`. By default, upstream exceptions are thrown to collectors; to keep `completionCause` while letting subscribers finish normally, pass `propagateCompletionCause = false`.
-   `state(scope, ...)`: Convert a cold stream to a `StateStream`.

```kotlin
val coldStream = intervalStream(1.seconds)

// 转换为在 viewModelScope 中共享的 SharedStream
val shared = coldStream.share(viewModelScope, replay = 1)

// 转换为在 viewModelScope 中维护状态的 StateStream
val state = coldStream.state(viewModelScope, initialValue = -1L)
```

---

## Advanced Feature: Stream Splitting and Pattern Matching

This is a very powerful feature of the `Stream` library, allowing you to split a character stream (`Stream<Char>`) into multiple semantically-tagged substreams based on complex pattern-matching rules. It is very useful when parsing structured text, handling protocols, or in any scenario where information needs to be extracted from a raw byte stream.

### Core Concepts

-   **`StreamPlugin`**: A plugin that defines how to recognize and handle a specific pattern in the stream. The plugin processes input characters according to its state.
-   **`PluginState`**: The plugin's state enum, with three states:
    -   `IDLE`: The plugin is idle, waiting for the start of a matching pattern.
    -   `TRYING`: The plugin has matched the beginning of a pattern and is trying to verify the complete match.
    -   `PROCESSING`: The plugin has confirmed the complete match and is processing the matched content.
-   **`splitBy(plugins)`**: An operator on `Stream<Char>` that takes a set of plugins and splits the character stream according to these plugins' matching results.
-   **`StreamGroup`**: The output of `splitBy`; it contains a tag (the matched plugin) and a sub-`Stream` (the matched content). Text not matched by any plugin goes into a default group whose tag is `null`.
-   **`kmpPattern` DSL**: A domain-specific language for defining matching patterns inside plugins, built on the efficient KMP algorithm.

### Example 1: Parsing XML with the Built-in `StreamXmlPlugin`

The `Stream` library provides a built-in plugin, `StreamXmlPlugin`, for recognizing XML/HTML tags. The example below shows how to use it to split a mixed stream containing text and XML.

```kotlin
// 流包含前导文本、一个XML块和尾随文本
val mixedContentStream = "Some leading text<item>Content</item>Some trailing text".asCharStream()

val plugins = listOf(StreamXmlPlugin())

mixedContentStream.splitBy(plugins)
    .collect { group ->
        val groupType = when (group.tag) {
            is StreamXmlPlugin -> "XML"
            null -> "Text" // tag为null表示默认的文本组
        }
        print("发现组 '$groupType': ")
        
        val content = StringBuilder()
        group.stream.collect { content.append(it) }
        
        println(content.toString())
}

// 输出:
// 发现组 'Text': Some leading text
// 发现组 'XML': <item>Content</item>
// 发现组 'Text': Some trailing text
```
*Note: `StreamXmlPlugin` is a basic plugin demonstrating what `splitBy` can do. It treats everything from the start tag to the corresponding end tag (including any inner tags) as a single group, and does not support true nested XML parsing. For complex XML processing, a more specialized library is needed.*

### Example 2: Creating a Custom Plugin to Parse Key-Value Pairs

Suppose we have a stream in the format `[KEY1:VALUE1][KEY2:VALUE2]...`, and we want to parse it out.

**1. Define our custom plugin**

```kotlin
private const val GROUP_KEY = 1
private const val GROUP_VALUE = 2

class KeyValuePlugin : StreamPlugin {
    override var state: PluginState = PluginState.IDLE
        private set
        
    private var matcher: StreamKmpGraph

    init {
        matcher = StreamKmpGraphBuilder().build(kmpPattern {
            char('[')
            group(GROUP_KEY) { greedyStar { noneOf(':') } }
            char(':')
            group(GROUP_VALUE) { greedyStar { noneOf(']') } }
            char(']')
        })
        reset()
    }

    override fun processChar(c: Char): Boolean {
        when (val result = matcher.processChar(c)) {
            is StreamKmpMatchResult.Match -> {
                // 完全匹配，转为IDLE状态
                state = PluginState.IDLE
                matcher.reset()
                return true
            }
            is StreamKmpMatchResult.InProgress -> {
                // 正在匹配中
                state = if (result.isMatchStarted) PluginState.PROCESSING else PluginState.TRYING
                return true
            }
            is StreamKmpMatchResult.NoMatch -> {
                // 匹配失败，重置状态
                if (state != PluginState.IDLE) {
                    state = PluginState.IDLE
                    matcher.reset()
                }
                return false
            }
        }
    }

    override fun reset() {
        matcher.reset()
        state = PluginState.IDLE
    }
    
    override fun initPlugin(): Boolean {
        reset()
        return true
    }
    
    override fun destroy() {
        // 清理资源
    }
}
``` 

**2. Using the `kmpPattern` DSL**

The `kmpPattern` DSL is the core of defining matching logic.

-   `char('[')`: Match a single character `[`.
-   `group(ID) { ... }`: Define a capture group. The matched content can be obtained by ID.
-   `greedyStar { ... }`: Greedy matching. It matches as many characters as possible that satisfy the inner condition.
-   `noneOf(':')`: Match any character that is not a colon `:`.

**3. Splitting a stream with the plugin**

Once the plugin is defined, using it is just as simple as using a built-in plugin. `splitBy` handles all state transitions and buffering logic.

This powerful pattern-matching system, combined with `Stream`'s asynchronous processing capabilities, provides great flexibility for handling complex, continuous data streams.

---

## Advanced Topic: Stream Parsing with the Plugin System

This is a very powerful feature of the `Stream` library, allowing you to split a character stream (`Stream<Char>`) into multiple semantically-tagged substreams based on complex pattern-matching rules. It is very useful when parsing structured text (such as Markdown or XML), handling network protocols, or in any scenario where information needs to be extracted from a raw byte stream.

### Core Concepts

-   **`Stream<Char>.splitBy(plugins)`**: This is the core operator. It takes a list of `StreamPlugin`s and, according to these plugins' matching rules, splits the input `Stream<Char>` into a `Stream<StreamGroup<StreamPlugin?>>`.
-   **`StreamPlugin`**: Plugins are where pattern-recognition logic is implemented. A plugin is essentially a state machine that processes each character in the stream via the `processChar(c: Char, atStartOfLine: Boolean)` method.
    -   The `atStartOfLine` parameter is crucial for parsing position-sensitive syntax (such as Markdown headings and lists).
    -   A plugin has three internal states (`PluginState`):
        -   `IDLE`: Idle state, waiting for the start of a matching pattern.
        -   `TRYING`: Has matched the beginning of a pattern and is trying to verify the complete match. If subsequent characters do not match, the plugin resets and gives up.
        -   `PROCESSING`: Has confirmed the complete match and is processing the matched content until the pattern ends.
-   **`StreamGroup<TAG>`**: The output unit of `splitBy`. It contains a `tag` (the plugin instance that matched successfully, or `null` for default text belonging to no plugin) and a `stream: Stream<String>`. Note that the substream type is `Stream<String>`, which emits the characters captured by the plugin in chunks.

### In Practice: Building a Streaming Markdown Parser

This library provides a complete set of Markdown plugins. The example below shows how to use them to build a high-performance streaming Markdown parser — exactly how the `StreamMarkdownRenderer` component in this library works.

#### 1. Two-Stage Parsing Strategy

Markdown syntax has nested structure (for example, a list item can contain bold text). The best way to handle it is in two steps:
1.  **Block-level parsing**: First, use block-level element plugins (such as headings, lists, and code blocks) to split the entire Markdown text.
2.  **Inline parsing**: Then, for each block-level element's content, use inline element plugins (such as bold, italic, and links) to split it again.

#### 2. Getting the Preset Plugins

For convenience, `MarkdownProcessor.kt` provides preset plugin lists.

```kotlin
// 获取所有块级插件
val blockPlugins = NestedMarkdownProcessor.getBlockPlugins()

// 获取所有内联插件
val inlinePlugins = NestedMarkdownProcessor.getInlinePlugins()
```

> **Important note**: Plugin order matters! For syntax with overlapping delimiters (for example `**` for bold and `*` for italic), the plugin with the longer delimiter must come first, to ensure `**text**` is correctly parsed as bold rather than two consecutive italics. `getInlinePlugins()` already handles the correct order.

#### 3. Implementing Streaming Parsing

The code below demonstrates how to implement streaming parsing and UI model building:

```kotlin
// 假设 markdownStream: Stream<Char> 是输入的Markdown字符流
// nodes 是一个UI状态列表 (e.g., mutableStateListOf<MarkdownNode>())

// 1. 块级解析
markdownStream.splitBy(blockPlugins).collect { blockGroup ->
    // 根据匹配的插件确定块类型
    val blockType = NestedMarkdownProcessor.getTypeForPlugin(blockGroup.tag)
    
    // 为这个新块创建一个UI节点
    val node = MarkdownNode(type = blockType, content = "", children = mutableListOf())
    val nodeIndex = nodes.add(node) // 添加到UI列表并获取索引

    val isInlineContainer = blockType != MarkdownProcessorType.CODE_BLOCK
    val contentBuilder = StringBuilder()

    // 收集块的内容
    blockGroup.stream.collect { contentChunk ->
        // 流式更新UI节点的内容，实现"打字机"效果
        nodes[nodeIndex] = nodes[nodeIndex].copy(content = nodes[nodeIndex].content + contentChunk)
        contentBuilder.append(contentChunk)
    }

    val blockContent = contentBuilder.toString()

    // 2. 如果块可以包含内联元素，则进行内联解析
    if (isInlineContainer && blockContent.isNotEmpty()) {
        val inlineChildren = mutableListOf<MarkdownNode>()
        
        // 将块内容转换为字符流以供再次分割
        val charStream = blockContent.toCharStream()  // 使用 String.toCharStream() 扩展函数，等同于 String.stream()

        charStream.splitBy(inlinePlugins).collect { inlineGroup ->
            val inlineType = NestedMarkdownProcessor.getTypeForPlugin(inlineGroup.tag)
            val inlineContent = inlineGroup.stream.collectToString() // 辅助函数
            
            if (inlineContent.isNotEmpty()) {
                inlineChildren.add(MarkdownNode(type = inlineType, content = inlineContent))
            }
        }
        
        // 内联解析完成后，用解析出的子节点更新UI节点
        if (inlineChildren.isNotEmpty()) {
            nodes[nodeIndex] = nodes[nodeIndex].copy(children = inlineChildren)
        }
    }
}
```

This example perfectly demonstrates the nesting capability of `splitBy`, implementing incremental streaming parsing of complex text.

### Available Markdown Plugins

The following are the main Markdown plugins provided in the `com.ai.assistance.operit.util.stream.plugins` package:

| Plugin Class | Function | Main Constructor Parameters |
| :--- | :--- | :--- |
| `StreamMarkdownHeaderPlugin` | Recognizes ATX-style headings (`# ...`) | `includeMarker: Boolean` - Whether to include `#` |
| `StreamMarkdownFencedCodeBlockPlugin` | Recognizes code blocks (```...```) | `includeFences: Boolean` - Whether to include ``` |
| `StreamMarkdownBlockQuotePlugin` | Recognizes block quotes (`> ...`) | `includeMarker: Boolean` - Whether to include `>` |
| `StreamMarkdownOrderedListPlugin` | Recognizes ordered lists (`1. ...`) | `includeMarker: Boolean` - Whether to include `1.` |
| `StreamMarkdownUnorderedListPlugin`| Recognizes unordered lists (`- ...` or `* ...`) | `includeMarker: Boolean` - Whether to include `-` |
| `StreamMarkdownHorizontalRulePlugin`| Recognizes horizontal rules (`---`, `***`) | `includeMarker: Boolean` - Whether to include the delimiter |
| `StreamMarkdownBoldPlugin` | Recognizes bold (`**...**`) | `includeAsterisks: Boolean` - Whether to include `**` |
| `StreamMarkdownItalicPlugin` | Recognizes italics (`*...*`) | `includeAsterisks: Boolean` - Whether to include `*` |
| `StreamMarkdownInlineCodePlugin` | Recognizes inline code (`` `...` ``) | `includeTicks: Boolean` - Whether to include `` ` `` |
| `StreamMarkdownLinkPlugin` | Recognizes links (`[text](url)`) | `includeDelimiters: Boolean` - Whether to include `[]()` |
| `StreamMarkdownImagePlugin` | Recognizes images (`![alt](url)`) | `includeDelimiters: Boolean` - Whether to include `![]()` |
| `StreamMarkdownStrikethroughPlugin`| Recognizes strikethrough (`~~...~~`) | `includeDelimiters: Boolean` - Whether to include `~~` |
| `StreamMarkdownUnderlinePlugin` | Recognizes underlines (`__...__`) | `includeDelimiters: Boolean` - Whether to include `__` |

---

## Interoperability with Kotlin Flow

`Stream` provides seamless conversion with Kotlin Flow.

-   `Flow<T>.asStream()`: Convert a `Flow` to a `Stream`.
-   `Stream<T>.asFlow()`: Convert a `Stream` to a `Flow`.

This lets you gradually introduce `Stream` into an existing project, or leverage specific functionality from the `Flow` ecosystem when needed.

---

## Best Practices

-   **Cold streams vs hot streams**: Use cold streams (plain `Stream`) for short-lived, one-off data transformations. For data that needs to be shared in multiple places (such as configuration or user state) or event sources, use hot streams (`SharedStream`, `StateStream`).
-   **Exception handling**: Always consider exceptions that may occur in a data stream, and use the `catch` operator to handle them gracefully and prevent app crashes.
-   **Lifecycle management**: In components with a lifecycle such as Android, use `viewModelScope` or `lifecycleScope` combined with `launchIn` to automatically manage stream collection and avoid memory leaks.
-   **Debugging with `onEach`**: When a stream does not behave as expected, `onEach { ... }` is an excellent debugging tool, letting you observe the data at each stage without affecting the stream.

We hope this guide helps you make full use of the powerful features of the `Stream` library!
