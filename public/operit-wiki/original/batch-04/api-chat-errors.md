---
title: 错误/限流/重试
module: app
sources: 7
date: 2026-10-01
---

# 错误/限流/重试

## 概述

- 本页覆盖 `api/chat/llmprovider/` 下与“别把云端 API 打爆、打挂了能优雅退”相关的 6 个文件：请求限流装饰器、滑动窗口限流器、并发信号量注册表、指数退避重试策略、HTTP 状态码异常契约。
- 一句话：每次发往大模型的请求先过两道门——**限流门**（每分钟最多 N 次，超了就等）和**并发门**（同时最多 M 个在飞，超了就排队）；两道门都支持中途取消；429 限流在多密钥轮询时会被压住提示；重试走指数退避（1s→2s→4s→8s→16s，上限 5 次）。
- 限流（rate limit）指单位时间内的请求次数上限；并发（concurrency）指同一时刻正在执行的请求数上限。两者是正交的：限流管“频率”，并发管“同时在飞的数量”。

## AI 速览

- **核心符号**：`RateLimitedAIService`（限流装饰器）、`SlidingWindowRateLimiter`（滑动窗口限流器）、`RateLimiterRegistry`（限流器按 key 复用）、`RequestConcurrencyRegistry`（并发信号量按 key 复用）、`LlmRetryPolicy`（指数退避）、`HttpStatusCodeException`（状态码契约）、`shouldSuppressKeyPoolRateLimitNotice`（多密钥 429 提示压制）。
- **主入口**：`RateLimitedAIService.sendMessage(...)`（装饰后的统一发送入口）；限流等待 `awaitRateLimit()`；并发等待 `acquireConcurrency(semaphore)`；重试延迟 `LlmRetryPolicy.nextDelayMs(retryAttempt)`。
- **数据流向一句话**：`MultiServiceManager` 按模型配置创建/复用限流器与信号量并包出 `RateLimitedAIService` → 每次 `sendMessage` 先过滑动窗口限流再抢并发信号量 → 调真正的大模型服务 → finally 释放信号量。

## 核心机制

### 限流装饰器（RateLimitedAIService）

- `RateLimitedAIService(delegate, rateLimiter?, concurrencySemaphore?)` 用 `AIService by delegate` 把除发送/取消外的所有方法委托给原服务。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:14`
- `queuedRequests`（`ConcurrentHashMap.newKeySet<AtomicBoolean>`）记录正在排队的请求，`cancellationEpoch` 计数取消代际。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:19`
- `cancelStreaming()` 把 epoch 加 1 并标记所有排队请求为已取消，再调原服务的取消。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:23`
- 在构造冷流前先快照 `requestEpoch`（取消代际）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:46`
- 冷流在采集开始前也能被取消：启动时注册一个 `AtomicBoolean` 并在锁内比较 epoch，代际已变就标记取消。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:50`
- `throwIfCancelled()` 在取消标记为 true 时抛 `CancellationException("AI request was cancelled")`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:59`
- 发送顺序是：检查取消 → 等限流 → 检查取消 → 等并发 → 检查取消 → 调原服务发送。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:84`
- `awaitRateLimit()` 循环调 `limiter.tryAcquire()`：返回等待毫秒 >0 就 `delay(min(retryAfterMs, 50ms))`，<=0 直接放行。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:63`
- `acquireConcurrency()` 循环调 `semaphore.tryAcquire()`：成功置 `concurrencyAcquired=true`，失败 `delay(50ms)`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:73`
- `finally` 块：只有拿到信号量才释放，并在锁内把请求移出 `queuedRequests`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:114`
- 取消轮询间隔常量 `CANCELLATION_POLL_INTERVAL_MS = 50L`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:123`
- `onUsageFinalized` 回调被包装了一层：先 `throwIfCancelled()` 再调用户回调，避免取消后还上报。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:105`

### 滑动窗口限流器（SlidingWindowRateLimiter）

- 构造参数 `maxRequestsPerMinute` 与 `windowMs`（默认 60_000L，即 60 秒窗口）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/SlidingWindowRateLimiter.kt:8`
- `tryAcquire` 先在 `mutex.withLock` 内淘汰早于窗口的旧时间戳。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/SlidingWindowRateLimiter.kt:18`
- 窗口已满返回距最老记录过期的剩余毫秒（下限 1ms）；未满则记录当前时间戳并返回 0。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/SlidingWindowRateLimiter.kt:23`
- `maxRequestsPerMinute <= 0` 时 `tryAcquire` 直接返回 0，即不限流。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/SlidingWindowRateLimiter.kt:16`
- `acquire()` 是阻塞式版本：循环 `tryAcquire` + `delay` 直到放行。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/SlidingWindowRateLimiter.kt:36`

### 注册表：按 key 复用（RateLimiterRegistry / RequestConcurrencyRegistry）

- `RateLimiterRegistry` 是 object 单例，内部 `ConcurrentHashMap<String, SlidingWindowRateLimiter>`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimiterRegistry.kt:5`
- `getOrCreate(key, maxRequestsPerMinute)` 要求配额 >0，用 `compute` 原子化：已有且配置相同则复用，配置变化则重建。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimiterRegistry.kt:8`
- `RequestConcurrencyRegistry` 是 object 单例；私有 `Entry(maxConcurrentRequests, semaphore)`；map 为 `ConcurrentHashMap<String, Entry>`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RequestConcurrencyRegistry.kt:6`
- `getOrCreate(key, maxConcurrentRequests)` 要求并发数 >0，返回按 key 共享的 `Semaphore`，配置变化重建 `Entry`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RequestConcurrencyRegistry.kt:14`

### 装配（MultiServiceManager）

- 按模型配置装配：`requestLimitPerMinute` / `maxConcurrentRequests` 经 `coerceAtLeast(0)`。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/MultiServiceManager.kt:320`
- 两项配额都为 0 时直接返回原 service，不做限流包装。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/MultiServiceManager.kt:323`
- 限流与并发的 key 都取自 `config.id`（同一模型配置共享同一限流器/信号量）。`app/src/main/java/com/ai/assistance/operit/api/chat/enhance/MultiServiceManager.kt:331`

### 重试策略（LlmRetryPolicy）

- `LlmRetryPolicy` 是 internal object，`MAX_RETRY_ATTEMPTS = 5`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlmRetryPolicy.kt:4`
- `RETRY_BASE_DELAY_MS = 1_000L`，`RETRY_MAX_DELAY_MS = 16_000L`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlmRetryPolicy.kt:5`
- `nextDelayMs(retryAttempt)` 是指数退避：`base * 2^(attempt-1)`，attempt 下限 1、指数上限 4，总上限 16 秒（序列 1s/2s/4s/8s/16s/16s…）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlmRetryPolicy.kt:8`

### 429 提示压制（HttpStatusCodeException）

- `HttpStatusCodeException` 是 internal 接口，只有一个属性 `val statusCode: Int`，供各 provider 的 HTTP 异常实现。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/HttpStatusCodeException.kt:5`
- `shouldSuppressKeyPoolRateLimitNotice`：异常不是 `HttpStatusCodeException` 或状态码非 429，直接返回 false。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/HttpStatusCodeException.kt:9`
- 候选密钥数 >1 时压住 429 中间提示（多密钥轮询会接着试其他密钥），并记一条 warning 日志带 `candidateKeyCount`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/HttpStatusCodeException.kt:17`

## 关键符号

| 符号 | 职责 |
|---|---|
| `RateLimitedAIService` | 限流+并发装饰器，发送前排队、支持取消 |
| `SlidingWindowRateLimiter` | 滑动窗口限流器，`tryAcquire` 返回需等待毫秒 |
| `RateLimiterRegistry` | 按 key 复用限流器的单例注册表 |
| `RequestConcurrencyRegistry` | 按 key 复用并发信号量的单例注册表 |
| `LlmRetryPolicy` | 指数退避重试延迟计算（上限 5 次/16s） |
| `HttpStatusCodeException` | HTTP 状态码异常契约（`statusCode`） |
| `shouldSuppressKeyPoolRateLimitNotice` | 多密钥轮询时压制 429 中间提示 |
| `CANCELLATION_POLL_INTERVAL_MS` | 取消轮询间隔 50ms |

## 调用链

1. **输入**：`MultiServiceManager` 拿到模型配置的 `requestLimitPerMinute` / `maxConcurrentRequests`（`coerceAtLeast(0)`），都为 0 则直接返回原服务。
   `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/MultiServiceManager.kt:320`
2. **处理**：按 `config.id` 从两个注册表取（或创建）限流器与信号量，包出 `RateLimitedAIService`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/MultiServiceManager.kt:331`
3. **处理**：每次发送先快照取消代际（`requestEpoch`）→ `awaitRateLimit()` 等滑动窗口放行 → `acquireConcurrency()` 抢信号量 → 每步都可被 `cancelStreaming()` 中断。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:46`
4. **输出**：调原服务真正发送；`finally` 释放信号量并注销排队请求；失败重试由上层按 `LlmRetryPolicy.nextDelayMs` 退避（最多 5 次）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt:114`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimitedAIService.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RateLimiterRegistry.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/SlidingWindowRateLimiter.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/RequestConcurrencyRegistry.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/LlmRetryPolicy.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/HttpStatusCodeException.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/enhance/MultiServiceManager.kt`（装配调用方）
