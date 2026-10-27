# Critic 复核报告：api-chat-tokens（Token 统计与 usage 上报）

- 复核对象：`review/batch-04/api-chat-tokens.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 已核对一致）
- 复核方式：29 条 facts 逐条取 ref ±5 行窗口与源码 diff；3 条 quality evidence 逐字比对；正文结构与 status 人工检查
- **结论：退回修正（2 处引用窗口问题 + 1 处 evidence 缩进问题，见下）**

## 总览

| 项 | 结果 |
|---|---|
| facts 29 条 | **27 通过 / 2 需修**（断言为真，ref 窗口盖不住 catch 链） |
| quality 3 条 | **2 通过 / 1 需修**（Q2 evidence 缩进与源码不一致） |
| 正文 .md | §9 结构完整，通过 |
| .status.json | 通过（id / issue 53 / review-pending / source_repo=operit / source_commit 正确） |
| lint | 0 硬失败 / 0 警告（writer 自报，已见 .lint.md） |

## 必须修正（3 处）

### 1. fact [12]：窗口盖不住 catch 链

- 现状：ref `TokenTrackingAIService.kt:144`，断言"forwardUsageObserver：CancellationException 原样抛出，其他异常记日志吞掉"。
- 问题：窗口（139–149）只到 `val callback = observer ?: return`（149 行）；真正的 `try { callback } catch (CancellationException) { throw } catch (Exception) { log }` 在 **150–156 行**，在窗口外。
- 修正：ref 改为 **:150**（窗口 145–155，覆盖 try/catch 全链）。断言为真，无需改述。

### 2. fact [13]：窗口盖不住 catch 链

- 现状：ref `:159`，断言"forwardUsageFinalizedObserver：CancellationException 原样抛出，其他异常记日志吞掉"。
- 问题：窗口（154–164）只到 `try {`（164 行）；`catch (CancellationException)` 在 166 行、`catch (Exception)` 在 168 行，均在窗口外。
- 修正：ref 改为 **:165**（窗口 160–170，覆盖 164–170 全链）。断言为真，无需改述。

### 3. quality Q2：evidence 缩进与源码不一致（必须重拷）

- 现状：`TokenTrackingAIService.kt:198` 的 evidence 整块被统一加了 4 空格缩进（源码 `        override suspend fun collect` 8 空格，evidence 写成 12 空格），逐字比对失败。
- 修正：从源码 198–207 行逐字重拷 evidence，保持原始缩进。断言内容（TrackingStream 与 TrackingRevisableStream 的 collect 完全重复）为真，severity suggestion/high 合理。

## quality（其余 2 条通过）

- Q0 warning（providerModel 格式不符 require 抛错）：evidence 4 行逐字命中 `:279`。
- Q1 suggestion（merge 标志位被 null 覆盖）：evidence 7 行逐字命中 `:317`（截断块，前 7 行逐字一致）。
- severity/confidence 均合理。

## 正文（通过）

- §9 结构完整：概述 / ## AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制（4 小节）/ 关键符号（符号表，英文原名）/ 调用链（输入→处理→输出 3 步编号）/ 来源。
- 人话短句，术语首现均有解释（usage 快照、attempt）。
- "观察者转发是防炸的"段引用 `:150`：窗口（145–155）覆盖第一函数的 catch 链，两个函数同理的表述成立，可保留。
- 无走查内容混入正文，无禁用词。

## status.json（通过）

`{id: api-chat-tokens, issue: 53, status: review-pending, source_repo: operit, source_commit: dbf71916fae9750cfdc9f9a774f5a0fee56633fb}` — 全部正确。

## 给 writer 的修正要求

1. fact [12] ref `:144`→`:150`；fact [13] ref `:159`→`:165`。
2. quality Q2 evidence 从源码逐字重拷（198–207 行，保留原始缩进）。
3. 修正后逐条用 sed 核实新 ref 的 ±5 窗口完全支撑断言。
4. 重跑 `scripts/lint.py` 保持 0/0，通知复检（只需复检本次列出的 3 处）。

## 复检（2026-10-01T13:58 CST，修错后复验）

**结论：通过**。critic 退回的 3 处已全部修正并经独立验真，无未通过条目。

- **[12]** ref `:150`，窗口 145–155 覆盖 `try { callback } catch (CancellationException) { throw } catch (Exception) { log }` 全链（150–156）。✓
- **[13]** ref `:165`，窗口 160–170 覆盖全链（164–170）。✓
- **Q2 evidence**：11 行与源码 `TokenTrackingAIService.kt` 198–208 行逐字一致（原始 8 空格缩进已恢复；修错员取 198–208 而非报告建议的 198–207，多含闭合 `}`，更完整，无问题）。✓
- lint：0 硬失败 / 0 警告（修错后重跑）。
