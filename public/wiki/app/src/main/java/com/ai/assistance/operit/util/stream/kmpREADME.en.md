# StreamKmpGraph: A Powerful Streaming Pattern Matching Library

`StreamKmpGraph` is an efficient, extensible streaming pattern matching library written in Kotlin. It combines the ideas of the Knuth-Morris-Pratt (KMP) algorithm with flexible conditional matching, providing a powerful DSL (domain-specific language) for building complex matching patterns. The library is especially suited to scenarios where a data stream must be processed character by character with patterns recognized in real time, and it also supports capture groups for extracting matched content.


## Core Features
*   **Streaming:** Processes input character by character, making it ideal for large files or network data streams with low memory usage.
*   **Rich match conditions:** Supports not only character matching, but also character ranges, character sets, logical combinations (AND, OR, NOT), and custom assertions.
*   **Powerful DSL:** Provides an intuitive, concise DSL for defining complex matching patterns.
*   **Capture groups:** Supports regex-like capture groups, making it easy to extract matched substrings.
*   **Hybrid engine:** Internally leverages the efficiency of the KMP algorithm for fast state transitions, while combining the power of regular expressions at final match time to extract capture groups.

---

## Core Concepts

1.  **`KmpCondition`**: The core interface for match conditions. It defines whether a character satisfies a given condition. The library provides several implementations:
    *   `CharCondition`: Matches a single specific character.
    *   `CharRangeCondition`: Matches any character within a specified range.
    *   `CharSetCondition`: Matches any character in a specified character set.
    *   `PredicateCondition`: Matches using a custom lambda expression.
    *   `NotCondition`, `OrCondition`, `AndCondition`: Used to logically combine other conditions.

2.  **`KmpPattern`**: The DSL entry point for building match patterns. Through it, you can chain various methods to define a complete matching rule.

3.  **`StreamKmpGraph`**: The state machine built from a `KmpPattern`. It receives a character stream and performs state transitions internally according to the KMP algorithm.

4.  **`StreamKmpMatchResult`**: The return type of the `processChar` method, representing the result of each processing step:
    *   `NoMatch`: The current character matches no pattern, and the state machine has been reset.
    *   `InProgress`: The current character is part of a potential match.
    *   `Match`: The current character completes a match of one or more patterns. A `Match` object contains the captured group information and a flag indicating whether it is a full match.

---

## Quick Start

### 1. Define a simple pattern

Using the `kmpPattern` DSL, you can easily create a pattern. For example, to match the string "abc":

```kotlin
import com.ai.assistance.operit.util.stream.kmpPattern

val pattern = kmpPattern {
    literal("abc")
}
```

### 2. Build the graph and match text

Use `StreamKmpGraphBuilder` to build a graph from a pattern, then use the `processText` method to find the positions of all matches in the text.

```kotlin
import com.ai.assistance.operit.util.stream.StreamKmpGraphBuilder

val builder = StreamKmpGraphBuilder()
val graph = builder.build(pattern)

val matches = graph.processText("ababcabc")
// matches will be [5, 8], indicating that "abc" ends at indices 5 and 8.
println(matches)
```

---

## DSL Details

The DSL provides a rich set of methods for building complex patterns.

### 1. Basic conditions

```kotlin
kmpPattern {
    // 匹配单个字符 'a'
    char('a')
    
    // 匹配字符串 "hello"
    literal("hello")
    
    // 匹配 'a' 到 'z' 之间的任意字符
    range('a', 'z')
    
    // 匹配 'a', 'e', 'i', 'o', 'u' 中的任意一个
    anyOf('a', 'e', 'i', 'o', 'u')

    // 匹配任意单个字符 (通配符)
    any()
}
```

### 2. Predefined character classes

For convenience, the library predefines some common character classes.

```kotlin
kmpPattern {
    digit()           // 匹配任意数字 [0-9]
    letter()          // 匹配任意字母 [a-zA-Z]
    letterOrDigit()   // 匹配字母或数字
    whitespace()      // 匹配空白字符 (空格, tab 等)
}
```

### 3. Logic and negation

Conditions can be logically combined.

```kotlin
kmpPattern {
    // 否定条件
    notChar('a')                  // 匹配非 'a' 的字符
    noneOf('x', 'y', 'z')         // 匹配非 x, y, z 的字符
    notInRange('0', '9')          // 匹配非数字字符
    notDigit()                    // 等同于 notInRange('0', '9')
    not(WHITESPACE)               // 匹配非空白字符

    // 组合条件 (DSL 也支持操作符 `+` for OR and `*` for AND)
    add(OrCondition(CharCondition('a'), CharCondition('b'))) // 匹配 'a' 或 'b'
    add(AndCondition(letter(), not(anyOf('x', 'y', 'z')))) // 匹配一个非x,y,z的字母
}
```

### 4. Repetition

*   `repeat(count) { ... }`: Repeats a pattern a fixed number of times.
*   `greedyStar { ... }`: A "greedy star" that matches zero or more times. It matches as much as possible, but does not "swallow" characters that would prevent subsequent patterns from matching.

```kotlin
// 匹配 "aaa"
val pattern1 = kmpPattern {
    repeat(3) { char('a') }
}

// 匹配 "b"、"bb"、"bbb" 等任意多个 "b"，然后跟一个 "a"
// 例如，可以匹配 "bbba"
val pattern2 = kmpPattern {
    greedyStar { char('b') }
    char('a')
}
```

### 5. Capture groups

This is a core feature of `StreamKmpGraph`. Use `group(id) { ... }` to define a capture group, where `id` is an integer `Int` ID you specify. After a successful match, content can be extracted by ID.

```kotlin
// 匹配 "id:123" 并提取数字
val pattern = kmpPattern {
    literal("id:")
    group(1) {
        repeat(3) { digit() }
    }
}

val builder = StreamKmpGraphBuilder()
val graph = builder.build(pattern)

// 使用流式API
graph.reset()
graph.processChar('i')
graph.processChar('d')
graph.processChar(':')
graph.processChar('1')
graph.processChar('2')
val result = graph.processChar('3')

if (result is StreamKmpMatchResult.Match && result.isFullMatch) {
    val capturedNumber = result.groups[1] // "123"
    println("Captured: $capturedNumber")
}
```
#### Nested groups

Groups can be nested, which is very useful for parsing structured data.

```kotlin
// 匹配 "(ax7)" 并分别捕获 "(ax7)" 和 "ax7"
val nestedGroupPattern = kmpPattern {
    group(1) { // 外部组
        char('(')
        group(2) { // 内部组
            letter()
            digit()
        }
        char(')')
    }
}
val graph = StreamKmpGraphBuilder().build(nestedGroupPattern)
graph.reset()
graph.processChar('(')
graph.processChar('a')
graph.processChar('7')
val result = graph.processChar(')')

if (result is StreamKmpMatchResult.Match) {
    // result.groups[1]会是"(a7)"
    // result.groups[2]会是"a7"
    println("Group 1: ${result.groups[1]}, Group 2: ${result.groups[2]}")
}

```

---

## Streaming API (`processChar`)

For scenarios requiring real-time response, `processChar` is the method of choice. It processes one character at a time and returns a result immediately.

### Workflow:

1.  **Reset**: Call `graph.reset()` to clear the state.
2.  **Process character by character**: Pass characters into `graph.processChar(c)` in a loop.
3.  **Check the result**:
    *   `InProgress`: Matching is in progress; continue feeding the next character.
    *   `Match`: A full match was found. You can extract capture groups from the result. After a match completes, the KMP failure function handles things automatically, allowing the next match to start immediately without a manual reset.
    *   `NoMatch`: The current character caused the match to fail with no fallback, and the state machine has reset automatically.

### Example: Parsing a log stream

Suppose we have a log stream in the format `[LEVEL] message`, and we want to extract `LEVEL` and `message`.

```kotlin
// 模式: [ (LEVEL) ] (MESSAGE)
val logPattern = kmpPattern {
    char('[')
    group(1) {
        // LEVEL: 匹配多个字母
        greedyStar { letter() }
    }
    char(']')
    char(' ')
    group(2) {
        // MESSAGE: 匹配到行尾
        greedyStar { any() }
    }
}

val graph = StreamKmpGraphBuilder().build(logPattern)

fun processLogStream(stream: Sequence<Char>) {
    graph.reset()
    var potentialMatchBuffer = ""
    stream.forEach { char ->
        // 当我们遇到换行符或流结束时，可以认为一个日志条目结束
        if(char == '\n') {
            val result = graph.processText(potentialMatchBuffer)
            // processText不返回分组，这里需要修改逻辑
            // 为了简单起见，我们假设每个日志条目都是独立处理的
            potentialMatchBuffer = ""
            graph.reset()
        } else {
             potentialMatchBuffer += char
        }

        val result = graph.processChar(char)
        if (result is StreamKmpMatchResult.Match && result.isFullMatch) {
            val level = result.groups[1]
            val message = result.groups[2]
            println("Level: $level, Message: $message")
            // 在流式场景中，匹配后可能需要重置或根据业务逻辑决定下一步
            graph.reset()
        }
    }
}

val logStream = "[INFO] User logged in.\n[DEBUG] Cache cleared.\n".asSequence()
// processLogStream(logStream) // 此处调用逻辑需要根据具体场景细化
```
*Note: The streaming example logic above needs to be refined for the specific application scenario, e.g. how to determine where a message ends.*

---

## How It Works

`StreamKmpGraph` uses a hybrid strategy to balance performance and functionality:

1.  **KMP state machine**: A pattern is first compiled into a KMP state machine. This state machine is very efficient, performing state transitions rapidly over a character stream without the heavy backtracking of traditional regular expressions.
2.  **Second regex match**: When the KMP state machine reaches a final state (`isFinal = true`), it indicates a potential full match has been found. At this point, the library matches the possibly-matching text fragment accumulated in the buffer against a **standard regular expression** dynamically generated from the original `KmpPattern` that is equivalent to it.
3.  **Extract capture groups**: The sole purpose of this standard regex match is to take advantage of the regex engine's mature **capture group** functionality. Group information is extracted from the `MatchResult` and wrapped into a `StreamKmpMatchResult` to return.

This design gives `StreamKmpGraph` both the high-speed advantage of the KMP algorithm in streaming processing and the powerful capture group functionality of regular expressions — a solution that balances performance and flexibility.
