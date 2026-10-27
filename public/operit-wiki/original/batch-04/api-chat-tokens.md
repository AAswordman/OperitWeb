---
title: Token 统计与 usage 上报
module: app
sources: 1
date: 2026-10-01
---

# Token 统计与 usage 上报

## 概述

- 本页覆盖 `api/chat/llmprovider/TokenTrackingAIService.kt`：给大模型请求加上 token 用量跟踪装饰器，把 provider 返回的用量快照合并、落库，供费用统计与用量展示用。
- 一句话：每次请求创建一个 `RequestTracker`，把流式过程中 provider 上报的用量（可多次、按重试 attempt 区分）合并成一份，只取**成功那次 attempt** 的快照，换算成 `TokenUsageRecordEntity` 写进 `TokenUsageRepository`；`recordTokenUsage=false` 时直接透传不跟踪。
- usage 快照（`ProviderUsageSnapshot`）指 provider 返回的用量数据：输入 token、缓存命中 token、输出 token、推理 token 等；attempt 指一次请求里的第几次尝试（重试会产生多个 attempt）。

## AI 速览

- **核心符号**：`TokenTrackingAIService`（用量跟踪装饰器）、`RequestTracker`（单次请求跟踪器）、`TrackingStream` / `TrackingRevisableStream`（包装流）、`TokenUsageRepository`（落库）、`TokenUsageRecordEntity`（落库实体）。
- **主入口**：`TokenTrackingAIService.sendMessage(..., recordTokenUsage, ...)`；用量到达回调 `onUsageReported`、完成回调 `onUsageFinalized`；落库 `persist(repository, request, request.finish())`。
- **数据流向一句话**：`sendMessage` 按 `recordTokenUsage` 决定是否挂跟踪钩子 → provider 的用量回调被 `RequestTracker` 按 attempt 合并 → 流采集完成后 `finish()` 取成功 attempt 的快照换算成实体 → `Dispatchers.IO` 落库（恰好一次）。

## 核心机制

### 装饰器与开关

- 类 KDoc：只记录“带 provider 确认用量的成功正式推理请求”。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:27`
- `TokenTrackingAIService(delegate, context, configId) : AIService`，构造即拿到 `TokenUsageRepository.getInstance(context.applicationContext)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:28`
- `inputTokenCount` / `cachedInputTokenCount` / `outputTokenCount` / `providerModel` 四个属性直接委托。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:38`
- `cancelStreaming()` 把代际加 1、逐个取消活跃请求，再调原服务取消。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:44`
- 每次发送请求创建一个 `RequestTracker(configId, providerModel)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:76`
- `recordTokenUsage=false` 时直接透传原服务，不挂任何跟踪钩子。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:93`
- `recordTokenUsage=true` 时包装 `onUsageReported`：先 `request.onUsage(usage, attempt)` 再转发给原观察者。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:120`
- 同时包装 `onUsageFinalized`：先 `request.onSuccess(attempt)` 再转发。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:127`
- 观察者转发是防炸的：`CancellationException` 原样抛出，其他异常记日志吞掉（两个转发函数同理）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:150`

### 流包装与采集

- `wrapStream`：内层是 `TextStreamEventCarrier` 用 `TrackingRevisableStream`（保留 `eventChannel`），否则用 `TrackingStream`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:178`
- `collect` 流程：`onStarted()` → `throwIfCancelled()` → 内层采集 → `ensureActive()` → `persist(repository, request, request.finish())` → `finally onFinished()`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:198`
- `onStarted` 在锁内比较取消代际：过期则 `request.cancel()`，再把请求加入 `activeRequests`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:78`
- `onFinished` 在锁内把请求移出 `activeRequests`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:87`

### 用量合并（RequestTracker）

- `attempts` 是 `linkedMapOf<Int, ProviderUsageSnapshot>`；`onUsage` 的 key 为 `attempt.coerceAtLeast(1)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:244`
- `merge`：新快照 `completeSnapshot=true` 则整体替换；否则用新值非空字段补旧值。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:317`
- `onSuccess(attempt)` 记录 `successfulAttempt`（`coerceAtLeast(1)`）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:256`
- `finish()`：已取消、无成功 attempt、快照无已知字段时返回 null（不落库）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:270`
- `finish()` 要求 `providerModel` 为 `"provider:model"` 格式：`require(separator > 0 && separator < lastIndex)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:279`
- 推理 token 落库口径：`reasoningIncludedInOutput == false` 时用 `saturatedAdd` 把推理 token 并入持久化 output，保持总量与费用口径完整。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:283`
- 全部 token 字段为 null 时 `finish()` 返回 null。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:292`
- 落库实体：`occurredAtMs=startedAtMs`、`configId`、provider/model 按冒号切分、`requestCount=1`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:300`
- `cacheWriteTokens` 仅在 `cacheWriteSeparateBilling=true` 时落库，否则记 0。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:308`

### 落库恰好一次

- `markPersisted()` 用 `compareAndSet(false, true)` 保证单次请求只落库一次。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:315`
- 落库跑在 `Dispatchers.IO + NonCancellable`；失败只记日志不抛。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:344`
- `saturatedAdd` 在加法溢出时钳到 `Long.MAX_VALUE`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:357`

## 关键符号

| 符号 | 职责 |
|---|---|
| `TokenTrackingAIService` | token 用量跟踪装饰器 |
| `RequestTracker` | 单次请求的用量合并与落库实体换算 |
| `TrackingStream` / `TrackingRevisableStream` | 包装流，在采集完成时触发落库 |
| `TokenUsageRepository` | 用量落库仓储（单例） |
| `TokenUsageRecordEntity` | 落库实体：时间/配置/provider/模型/各类 token |
| `ProviderUsageSnapshot` | provider 上报的用量快照（输入/缓存/输出/推理） |

## 调用链

1. **输入**：`sendMessage(..., recordTokenUsage=true, onUsageReported, onUsageFinalized)`；为本次请求创建 `RequestTracker`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:76`
2. **处理**：流式过程中 provider 的用量回调被 `request.onUsage` 按 attempt 合并（`merge`）；完成时 `request.onSuccess` 记下成功 attempt；两个用户观察者照常转发（异常隔离）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:120`
3. **输出**：流采集完成后 `request.finish()` 取成功 attempt 的快照 → 换算 `TokenUsageRecordEntity`（推理 token 并入 output、缓存写入按计费标志处理）→ `Dispatchers.IO + NonCancellable` 落库，`compareAndSet` 保恰好一次。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt:198`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/TokenTrackingAIService.kt`
