---
title: 响应式流框架
module: 工具函数库 / app
sources: 10
date: 2026-10-01
---

# 响应式流框架（util-stream-core）

## 概述

`util/stream` 是 Operit 自研的一套响应式流框架，API 风格对标 Kotlin 的 Flow / SharedFlow / StateFlow，但在其之上加了四个自有设计：冷流的锁定与缓冲、热流多播、可修订文本流、基于 KMP 图的流式字符匹配。

它主要服务于聊天场景的流式文本渲染：大模型的 token 流进来，先经过操作符变换，再按插件分组切分，修订事件驱动存档点与回滚，最后以字符流形式交给 Markdown 组件逐字渲染。框架本身不依赖 Android，只依赖 kotlinx.coroutines。

## AI 速览

**核心符号清单**：`Stream<T>`、`StreamCollector<T>`、`AbstractStream<T>`、`FlowAsStream`、`StreamAsFlow`、`SharedStream<T>`、`MutableSharedStream<T>`、`StateStream<T>`、`MutableStateStream<T>`、`MutableSharedStreamImpl`、`MutableStateStreamImpl`、`StreamStart`、`stream()`、`streamOf()`、`emptyStream()`、`intervalStream()`、`rangeStream()`、`streamError()`、`String.stream()`；操作符：`map`、`filter`、`take`、`drop`、`flatMap`、`onEach`、`timeout`、`merge`、`combine`、`concatWith`、`catch`、`finally`、`throttleFirst`、`distinctUntilChanged`、`chunked`、`splitBy`、`delay`、`debounce`、`sample`、`throttleLast`、`fixedRate`、`timeoutTrigger`；分组：`StreamGroup`、`StreamProcessor`、`CompositeStreamProcessor`、`StreamGroupBuilder`、`StreamInterceptor`；修订：`RevisableTextStream`、`RevisableSharedTextStream`、`RevisableCharStream`、`TextStreamEvent`、`TextStreamEventType`、`TextStreamEventCarrier`、`TextStreamRevisionTracker`；KMP：`StreamKmpGraph`、`StreamKmpGraphBuilder`、`KmpPattern`、`KmpCondition`、`KmpNode`、`StreamKmpMatchResult`。

**主入口**：`stream { }` 构建器（冷流）、`Stream.share()` / `Stream.state()`（转热流）、`Stream<Char>.splitBy(plugins)`（插件分组）、`StreamKmpGraph.processChar(c)`（逐字符匹配）。

**数据流向一句话**：上游用构建器产生冷流 → 经操作符变换 → `share`/`state` 转热流多播 → 文本流经 `splitBy` 按插件分组、修订事件驱动 savepoint/rollback → 字符流交付渲染。

## 核心机制

### 1. 冷流：Stream 与锁定缓冲

`Stream<T>` 是冷流接口：每次 `collect` 才开始产生数据。`AbstractStream` 给所有冷流提供了一套锁定机制：`lock()` 暂停向下游发送但继续接收，收到的数据进 `ConcurrentLinkedQueue` 缓冲；`unlock()` 原子解除锁定并把缓冲逐个补发；`clearBuffer()` 丢弃缓冲。`tryBuffer()` 是内部钩子，构建器在每次 `emit` 前先问它"是否处于锁定"，是则入缓冲。

`FlowAsStream` / `StreamAsFlow` 是双向适配器，让自研 Stream 与 Kotlin Flow 互转。`FlowAsStream` 在收集结束的 `finally` 里标记关闭，若关闭时仍处于锁定状态会尝试解锁排空，避免缓冲数据丢失。

### 2. 热流：SharedStream / StateStream

`MutableSharedStreamImpl` 是自研的 SharedFlow：每个订阅者分配一个无界 `Channel`，`emit` 时把值包装成 `SharedEvent.Value` 发给所有通道；`close(cause)` 发 `SharedEvent.Completion` 并关闭通道。重放缓冲是 `ArrayDeque`，按 `replay` 上限从头部丢弃旧值。`collect` 先重放快照再注册订阅者，结束时在 `finally` 里注销。

`MutableStateStreamImpl` 直接包装 `MutableStateFlow`，`completionCause` 恒为 null，`resetReplayCache` 为空实现（StateFlow 恒持有当前值）。

`Stream.share(scope, replay, started, onComplete, propagateCompletionCause)` 把冷流转热流：EAGERLY 模式立即在 scope 里启动上游收集；LAZILY 模式监听订阅计数，有人订阅才启动、无人订阅就取消。`Stream.state(scope, initialValue, started)` 同理转成状态流。注意 `propagateCompletionCause` 参数：聊天场景要求主订阅者能读到 `completionCause`，而旁观订阅者不应被同一 provider 失败的协程异常打断。

### 3. 可修订文本流：事件通道 + 修订追踪器

LLM 输出经常需要"撤回重写"。框架用两件套解决：

- **事件通道**：`TextStreamEventCarrier` 给文本流附加一个 `SharedStream<TextStreamEvent>`，事件只有两种：`SAVEPOINT`（打存档点）和 `ROLLBACK`（回滚）。`withEventChannel` 系列函数是幂等的，重复附加同一通道直接返回自身。`shareRevisable()` 在共享文本流的同时，把事件通道以 `replay=Int.MAX_VALUE` 共享，保证后加入的订阅者也能收到历史修订事件。
- **修订追踪器**：`TextStreamRevisionTracker` 维护 `SmartString` 内容缓冲与 `savepoint id → 字符长度` 映射。`savepoint(id)` 只记长度（注释写明：回滚只丢弃后缀，所以一个字符索引就是完整的修订状态，无需存全量快照）；`rollback(id)` 把内容截断到保存长度并删除其后的存档点；`replace(content)` 整体替换内容。

`StreamRollbackPrefix`（internal）标记回滚替换流中"回滚前已渲染"的那段前缀，供下游区分处理。

### 4. KMP 图匹配：StreamKmpGraph

`StreamKmpGraph` 是基于图的 KMP 状态机，用于流式字符匹配。`KmpNode` 以 `KmpCondition` 为边条件（字符相等、范围、字符集、取反、或、与、自定义谓词，支持 `+`/`*`/`not()` 组合）。`KmpPattern` 是 DSL 构建器：`char`、`digit`、`letter`、`greedyStar`、`repeat`、`group(id)` 定义捕获组等。

`processChar(c)` 逐字符推进：有转移则前进；否则沿 `failureNode` 链回跳并调整匹配长度。到达终态节点后会做一次**正则二次确认**：用 pattern 转出的等效正则在全量字符缓冲上 `find`，按 `groupIds` 顺序提取捕获组，返回 `StreamKmpMatchResult.Match(groups, isFullMatch)`。注意两点实现取舍：失败转移是简化版（所有非起始节点的失败链都指向起始节点）；`characterStreamBuffer` 只增不减（除 `reset()`），长流场景下内存持续增长。

### 5. 插件分组：splitBy

`Stream<Char>.splitBy(plugins)` 把字符流按插件匹配状态切成多个 `StreamGroup`：每个插件维护 `TRYING` / `PROCESSING` / `WAITFOR` 状态机。评估态下字符先缓入 `evaluationBuffer`，一旦某个插件进入 `PROCESSING`，缓冲回放给该插件，其余插件重置；没有任何插件处于 `TRYING` 则字符归入 `tag` 为 null 的默认文本组。`WAITFOR` 状态会多等一个字符再决定去留，退出时把字符返还到 `pendingChars` 重新评估。`Stream<String>.splitBy` 先用 `flatMap` 把字符串拆成字符，再复用字符版实现。

### 6. 流分组与拦截：StreamGroup / StreamInterceptor

`StreamGroup<TAG>` 把"标签 + 文本流 + 可选处理器 + 子组"绑在一起，支持嵌套与递归处理，`StreamGroupBuilder` 用 DSL 构建。`StreamInterceptor` 包装上游流，对每个值应用可替换的 `onEach` 变换后形成新的下游流。

## 关键符号

| 符号 | 作用 |
|---|---|
| `Stream<T>` | 冷流接口，`collect` 时才产生数据 |
| `AbstractStream<T>` | 冷流基类，提供锁定/缓冲/关闭 |
| `StreamCollector<T>` | 收集器接口，`suspend fun emit(value: T)` |
| `SharedStream<T>` / `MutableSharedStream<T>` | 热流接口，`subscriptionCount` / `replayCache` / `completionCause` |
| `StateStream<T>` / `MutableStateStream<T>` | 状态流接口，暴露当前 `value` |
| `StreamStart` | `EAGERLY` 立即启动 / `LAZILY` 有订阅者时启动 |
| `TextStreamEvent` / `TextStreamEventType` | 修订事件，`SAVEPOINT` / `ROLLBACK` |
| `TextStreamEventCarrier` | 携带事件通道 `eventChannel` 的流 |
| `TextStreamRevisionTracker` | 存档点/回滚的内容追踪器 |
| `StreamKmpGraph` | 基于图的 KMP 流式匹配器 |
| `KmpPattern` | 匹配模式 DSL 构建器 |
| `KmpCondition` | 字符匹配条件，可组合 |
| `StreamKmpMatchResult` | 匹配结果：`NoMatch` / `InProgress` / `Match` |
| `StreamGroup<TAG>` | 标签 + 文本流 + 处理器的分组 |
| `StreamInterceptor<T, R>` | 可替换变换函数的流拦截器 |

## 输入→处理→输出调用链

1. **输入**：数据源经 `stream { emit(...) }` 构建器、`streamOf` / `Collection.asStream` / `String.stream()` 或 `Flow.asStream()` 产生 `Stream<T>` 冷流。
2. **处理**：操作符链（`map` / `filter` / `debounce` / `sample` 等）变换；`share(scope)` / `state(scope)` 转热流多播给多个订阅者；文本场景走 `splitBy(plugins)` 按插件切分为 `StreamGroup` 流；修订场景经事件通道发送 `SAVEPOINT` / `ROLLBACK`，`TextStreamRevisionTracker` 执行存档与回滚；模式匹配场景 `StreamKmpGraph.processChar(c)` 逐字符推进并返回 `Match` 结果。
3. **输出**：`collect(collector)` / `collect { }` / `launchIn(scope)` 消费；热流订阅者先收到重放快照再收到实时值；字符流最终交付 Markdown 渲染组件逐字显示。

## 来源

- `app/src/main/java/com/ai/assistance/operit/util/stream/Stream.kt`（252 行）：Stream 接口、AbstractStream 锁定缓冲、Flow 双向适配、StreamLogger
- `app/src/main/java/com/ai/assistance/operit/util/stream/HotStream.kt`（450 行）：SharedStream/StateStream、share/state、StreamStart
- `app/src/main/java/com/ai/assistance/operit/util/stream/StreamBuilders.kt`（188 行）：stream 构建器与常用构造器
- `app/src/main/java/com/ai/assistance/operit/util/stream/StreamOperators.kt`（约 640 行）：23 个操作符、splitBy 插件分组
- `app/src/main/java/com/ai/assistance/operit/util/stream/StreamGroup.kt`（221 行）：StreamGroup、StreamProcessor、StreamInterceptor
- `app/src/main/java/com/ai/assistance/operit/util/stream/RevisableTextStream.kt`（177 行）：修订事件通道、shareRevisable
- `app/src/main/java/com/ai/assistance/operit/util/stream/TextStreamRevisionTracker.kt`（30 行）：savepoint/rollback 追踪器
- `app/src/main/java/com/ai/assistance/operit/util/stream/StreamKmpGraph.kt`（约 720 行）：KMP 图、KmpPattern DSL、条件体系
- `app/src/main/java/com/ai/assistance/operit/util/stream/StreamKmpMatchResult.kt`（18 行）：匹配结果密封类
- `app/src/main/java/com/ai/assistance/operit/util/stream/StringExtensions.kt`（11 行）：String.stream()
