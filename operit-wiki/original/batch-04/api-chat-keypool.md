---
title: Key 池轮询（ApiKeyProvider）
module: app
sources: 2
date: 2026-10-01
---

# Key 池轮询（ApiKeyProvider）

## 概述

- 一个模型配置可以配多个 API Key（Key 池）。每次发请求前，由 `ApiKeyProvider` 挑一个 Key 出来；多个 Key 之间按**轮询**（round-robin）挨个用，避免单个 Key 被限流打死。
- 一句话：`MultiApiKeyProvider` 在互斥锁里筛出"启用且可用"的 Key，按持久化的下标轮流取一个并把下标 +1 存回去；`ApiKeyPoolAvailabilityTester` 负责把池子里没测过的 Key 逐个拿去真实连一次，把可用/不可用打标写回配置。
- 单 Key 的旧配置由 `SingleApiKeyProvider` 兼容：直接返回唯一的 Key。
- 与 [[api-chat|云端 Chat API 接入（总览）]] 的关系：本页是"每次请求用哪个 Key"的决策层，Key 的格式校验与配置就绪判定见 [[api-chat-params|统一参数模型与自定义参数]]。

## AI 速览

- **核心符号**：`ApiKeyProvider`（取 Key 接口）、`SingleApiKeyProvider`（单 Key 兼容实现）、`MultiApiKeyProvider`（多 Key 轮询实现）、`ApiKeyPoolAvailabilityTester`（池可用性批量测试器）、`ApiKeyPoolTestState`（测试进度状态）、`ApiKeyAvailabilityStatus`（UNTESTED/AVAILABLE/UNAVAILABLE 三态）。
- **主入口**：`MultiApiKeyProvider.getApiKey()`（取下一个 Key）、`ApiKeyPoolAvailabilityTester.startOrResume(...)`（开始/继续批量测试）。
- **数据流向一句话**：请求前调 `getApiKey()` → 读配置、筛启用 Key、按可用性标记过滤候选集 → 按 `currentKeyIndex` 取一个并持久化下标+1 → 返回 Key；测试侧 `startOrResume` 把 UNTESTED 的 Key 发进 Channel，多 worker 并发真实建连测试，结果打标回写整池。

## 核心机制

### 取 Key 接口（ApiKeyProvider）

- 接口只有两个 suspend 函数：`getApiKey()` 取当前可用的 Key，`getCandidateKeyCount()` 取参与轮询的候选 Key 数量。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:15`
- `SingleApiKeyProvider` 直接返回构造时传入的唯一 Key；日志里只保留 Key 首尾各 4 个字符。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:26`
- 单 Key 下候选数为 1（Key 为空则是 0）。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:30`

### 多 Key 轮询（MultiApiKeyProvider）

- 取 Key 全程持有 `mutex.withLock`，并发请求不会拿到同一个下标。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:45`
- 配置不存在直接抛 `IllegalStateException`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:47`
- 先筛出启用的 Key（`filter { it.isEnabled }`），禁用的 Key 永不参与。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:50`
- 只要池子里有任一 Key 被测过（`availabilityStatus != UNTESTED`），候选集就只保留 `AVAILABLE` 的 Key；一个都没测过时，全部启用的 Key 都参与轮询。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:56`
- 有可用性标记但一个 AVAILABLE 都没有：抛错，提示去测试 Key 或清除标记。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:68`
- 池子空了且没标记：如果配置里还配了单个 `apiKey`，回退用它；都没有才抛错。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:74`
- 轮询取 `currentKeyIndex % candidateKeys.size` 位置的 Key。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:81`
- 取完后把 `(startIndex + 1) % candidateKeys.size` 经 `updateConfigKeyIndex` 持久化，下次接着轮。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:88`

### 池可用性批量测试（ApiKeyPoolAvailabilityTester）

- 测试跑在独立协程域（`SupervisorJob() + Dispatchers.IO`），进度经 `StateFlow<ApiKeyPoolTestState>` 对外只读暴露。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:42`
- `ApiKeyPoolTestState` 记录待测总数、已测数、可用/不可用数、运行/暂停标志与最近错误。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:28`
- `pause()` 取消当前测试任务。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:50`
- `pauseAndJoin()` 取消并等待任务结束。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:54`
- `close()` 取消整个测试协程域。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:58`
- `isRunning()` 看任务是否活跃。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:61`
- 已在运行时（`isRunning()` 为 true）直接返回。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:71`
- 只测启用且 `UNTESTED` 的 Key；无 Key 可测时把状态清零。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:75`
- 待测 Key 发进无界 Channel，worker 数取 `maxOf(1, min(concurrency, 待测数))`，多 worker 并发消费。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:113`
- 单 Key 真实建连由 `testSingleKey` 承担。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:178`
- 测试配置：用待测 Key，`useMultipleApiKeys=false`、池清空、模型取索引 0。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:188`
- 经 `AIServiceFactory.createService` 建服务调 `testConnection().getOrThrow()`，finally 里 `release()`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:199`
- 测完一个 Key：在 `poolUpdateMutex` 下更新整池里对应项的 `availabilityStatus`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:130`
- 更新后切主线程回调 `onPoolUpdated`，再经 `updateApiKeyPoolSettings` 全量持久化。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:139`
- 进度每次 `tested+1`，可用/不可用按结果累加。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:148`
- 全测完置 `running=false`；被取消置 `paused=true`；其他异常记 `lastError`。`app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:166`

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| `ApiKeyProvider` | 取 Key 的抽象接口 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:13` |
| `SingleApiKeyProvider` | 单 Key 兼容实现 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:24` |
| `MultiApiKeyProvider` | 多 Key 轮询实现（互斥+持久化下标） | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:38` |
| `getApiKey()` | 取下一个可用 Key | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:15` |
| `getCandidateKeyCount()` | 候选 Key 数量 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:18` |
| `updateConfigKeyIndex` | 持久化轮询下标 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:88` |
| `ApiKeyPoolAvailabilityTester` | 池 Key 批量可用性测试器 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:38` |
| `ApiKeyPoolTestState` | 测试进度状态 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:28` |
| `startOrResume` | 开始/继续批量测试 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:63` |
| `testSingleKey` | 单 Key 真实建连测试 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:178` |
| `ApiKeyAvailabilityStatus` | UNTESTED/AVAILABLE/UNAVAILABLE 三态 | `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:75` |

## 调用链

1. **输入**：聊天请求前，调用方调 `MultiApiKeyProvider.getApiKey()`（suspend）。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:44`
2. **处理**：拿锁 → 读配置 → 筛启用 Key → 按可用性标记过滤候选集 → 为空则抛错或回退单 Key → 按 `currentKeyIndex` 取一个 → 下标+1 持久化。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:45`
3. **输出**：返回选中的 Key 字符串，调用方拿去发请求。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt:90`
4. **输入**：用户在配置页点"测试 Key 池"，调 `ApiKeyPoolAvailabilityTester.startOrResume(...)`。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:63`
5. **处理**：筛出 UNTESTED 的 Key 发进 Channel → 多 worker 并发做单 Key 真实建连 → 逐个打标、主线程回调、全量持久化。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:104`
6. **输出**：`_state` 更新 tested/available/unavailable，UI 读 `state` 展示进度；打标结果写回配置，影响下次 `getApiKey` 的候选集。
   `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt:150`

## 来源

- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyProvider.kt`（111 行，已全读）
- `app/src/main/java/com/ai/assistance/operit/api/chat/llmprovider/ApiKeyPoolAvailabilityTester.kt`（206 行，已全读）
