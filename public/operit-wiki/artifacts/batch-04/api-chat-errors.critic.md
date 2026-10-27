# Critic 复核报告：api-chat-errors（错误/限流/重试）

- 复核对象：`review/batch-04/api-chat-errors.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 已核对一致）
- 复核方式：32 条 facts 逐条取 ref ±5 行窗口与源码 diff；4 条 quality evidence 逐字比对；正文结构与 status 人工检查
- **结论：退回修正（3 处引用问题，见下）**

## 总览

| 项 | 结果 |
|---|---|
| facts 32 条 | **29 通过 / 3 需修**（1 处术语错误+窗口违规，2 处窗口盖不住断言尾部） |
| quality 4 条 | **4/4 通过**，evidence 全部逐字命中源码 |
| 正文 .md | §9 结构完整，通过（1 处引用需同步修正，见下） |
| .status.json | 通过（id / issue 51 / review-pending / source_repo=operit / source_commit 正确） |
| lint | 0 硬失败 / 0 警告（writer 自报，已见 .lint.md） |

## 必须修正（3 处）

### 1. fact [4]：术语错误 + 窗口违规（必须改述+重锚）

- 现状：ref `RateLimitedAIService.kt:48`，断言"冷流在采集开始前可被取消：**onStarted 注册 AtomicBoolean** 并在锁内比较 epoch，epoch 已变则标记取消"。
- 问题有二：
  - **术语错误**：`RateLimitedAIService.kt` 全文件**不存在 `onStarted`**（grep 确认无此符号）。`onStarted` 是隔壁 `TokenTrackingAIService.kt` 的 lambda，writer 把两个文件记串了。
  - **窗口违规**：真正的注册动作 `queuedRequests.add(cancelled)` 在 **54 行**，ref :48 的窗口（43–53）盖不住。
- 修正：改述为"流体构建时把 `AtomicBoolean` 注册进 `queuedRequests` 并在锁内比较 epoch，代际已变则标记取消"，ref 改为 **:50**（窗口 45–55 覆盖 48–54）。正文第 31 行"冷流在采集开始前也能被取消：启动时注册一个 `AtomicBoolean`……"的引用 `:48` 同步改为 `:50`。

### 2. fact [8]：窗口盖不住断言尾部

- 现状：ref `:84`，断言完整顺序"throwIfCancelled → awaitRateLimit → throwIfCancelled → acquireConcurrency → throwIfCancelled → delegate.sendMessage"。
- 问题：窗口（79–89）只到 `if (semaphore != null) {`，最后的 `throwIfCancelled()`（91 行）与 `delegate.sendMessage(`（92 行）在窗口外。
- 修正：ref 改为 **:88**（窗口 83–93，84–92 全覆盖）。断言本身为真，无需改述。

### 3. fact [22]：窗口盖不住"返回 Semaphore"

- 现状：ref `:17`，断言"返回按 key 共享的 `Semaphore(maxConcurrentRequests)`，配置变化重建 Entry"。
- 问题：窗口（12–22）能看到 `Semaphore(maxConcurrentRequests)` 的构造（21 行），但函数真正的返回 `.semaphore` 在 **26 行**（`}!!.semaphore`），在窗口外。
- 修正：ref 改为 **:22**（窗口 17–27，覆盖构造 21 行与返回 26 行）。断言为真，无需改述。

## quality（4/4 通过）

- Q0 warning（配额变更不传播）：evidence 7 行逐字命中 `RateLimiterRegistry.kt:11`。注：证据末行 `}!!` 系源码原文（`compute(...)!!` 非空断言），非转录错误，已核实。
- Q1 warning（多密钥 429 提示被压住）：evidence 9 行逐字命中 `HttpStatusCodeException.kt:17`。
- Q2 suggestion（50ms 忙轮询）：evidence 9 行逐字命中 `RateLimitedAIService.kt:63`。
- Q3 suggestion（系统时钟回拨拉长窗口）：evidence 2 行逐字命中 `SlidingWindowRateLimiter.kt:15`。
- severity/confidence 均合理，无夸大。

## 正文（通过，1 处同步修正）

- §9 结构完整：概述 / ## AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制（6 小节）/ 关键符号（符号表，英文原名）/ 调用链（输入→处理→输出 4 步编号，引用精确到行）/ 来源。
- 人话短句，术语首现均有解释（限流/并发正交性、usage 快照、attempt）。
- 唯一问题：正文"冷流在采集开始前也能被取消"段引用 `:48`，随 fact [4] 同步改为 `:50`。
- 无走查内容混入正文，无禁用词。

## status.json（通过）

`{id: api-chat-errors, issue: 51, status: review-pending, source_repo: operit, source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb}` — 全部正确。

## 给 writer 的修正要求

1. 按上表修正 fact [4]/[8]/[22]（[4] 必须改述+重锚）。
2. 正文第 31 行引用 `:48`→`:50`。
3. 修正后逐条用 sed 核实新 ref 的 ±5 窗口完全支撑断言。
4. 重跑 `scripts/lint.py` 保持 0/0，通知复检（只需复检本次列出的 3 条+正文 1 处）。

## 复检（2026-10-01T13:58 CST，修错后复验）

**结论：通过**。critic 退回的 3 处 + 正文 1 处已全部修正并经独立验真，无未通过条目。

- **[4]** ref `:50`，窗口 45–55 覆盖 `AtomicBoolean(false)`（48）、epoch 比较（51–53）、`queuedRequests.add(cancelled)`（54）；断言已改述，"onStarted" 记串说法已删除（grep 确认 `RateLimitedAIService.kt` 全文件 0 命中）。✓
- **[8]** ref `:88`，窗口 83–93 覆盖完整调用链（84/85/86/89/91/92）。✓
- **[22]** ref `:22`，窗口 17–27 覆盖 `Semaphore(maxConcurrentRequests)` 构造（21）与 `}!!.semaphore` 返回（26）。✓
- **正文第 30 行**引用已同步为 `:50`。✓
- lint：0 硬失败 / 0 警告（修错后重跑）。
