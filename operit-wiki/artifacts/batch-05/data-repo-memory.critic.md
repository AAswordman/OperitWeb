# Critic 报告：data-repo-memory（记忆仓库，Issue #62）

- 核验时间：2026-10-01
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（`git rev-parse HEAD` 一致）
- 核验方式：156 条 facts 全量程序化校验（ref 格式/文件存在/行号不越界）+ 逐条 ±5 行窗口语义核对；quality 12 条去缩进逐字匹配；正文结构/断言交叉核对；lint.py 独立复跑；全文禁用词 grep。

## 结论：打回

1 处正文断言与代码矛盾 + 6 处 facts ref 行号错位（±5 窗口内无支撑原文），必须修。修完后 critic 需复检修正条目。

---

## 硬问题（必须修）

### H1. 正文 §9 断言错误：入队方不是三处，是两处

正文写："入队方有三处：`EnhancedAIService`（回复定稿）、`MemoryAutoSaveScheduler`（定时任务内）、`MessageCoordinationDelegate`（消息协调流程）"。

事实：`MemoryAutoSaveScheduler.kt` 全文件**没有任何** `enqueue`/`enqueueSelectedUserMessages` 调用（grep 全文件 0 命中），它只做拉取（`getPendingAndFailedCandidates`）。真正的入队方只有两处：

- `EnhancedAIService.kt:2048` → `.enqueue(...)`（回复定稿）
- `MessageCoordinationDelegate.kt:1501` → `.enqueueSelectedUserMessages(...)`（消息协调流程）

必须把"三处"改成"两处"，删掉 MemoryAutoSaveScheduler 作为入队方的表述。

### H2. facts ref 行号错位（6 条，±5 窗口内无支撑原文）

| # | 当前 ref | 问题 | 实际位置 | 建议 ref |
|---|---|---|---|---|
| [104] | MemoryRepository.kt:1894 | 断言"把内容为空但仍有 embedding 的记忆的 embedding 清空为 null"，窗口内（1889–1899）只有探针文本逻辑，清 null 代码在 1906–1912 | 1906–1912 | **1908** |
| [121] | MemoryExportModel.kt:39 | 断言 ImportStrategy 三种策略，39 行是 `SerializableMemory` 的 `contentType` 字段，枚举实际在 80–94 | 80–94 | **80** |
| [122] | MemoryRepository.kt:2745 | 断言 CREATE_NEW 强制生成新 UUID，2745 行是链接导入代码，UUID 逻辑在 2777（`uuid = if (forceNewUuid) UUID.randomUUID()...`） | 2777 | **2777** |
| [123] | MemoryExportModel.kt:59 | 断言 MemoryImportResult 四个计数字段，59 行在 `SerializableLink` 里，data class 在 101–106 | 101–106 | **101** |
| [149] | MemoryAutoSaveCandidate.kt:13 | 断言状态常量 pending/processing/failed，13 行是 `createdAt` 字段，常量在 companion object 21–23 | 21–23 | **21** |
| [150] | MemoryAutoSaveCandidate.kt:17 | 断言来源常量字符串值，17 行是 `lastError` 字段，常量在 25–26 | 25–26 | **25** |

以上 6 条断言本身**为真**，错的是引用行号，必须按建议值修正。

---

## 轻微问题（建议修，不阻塞）

1. [37] ref 927 → 悬空判定条件（`sourceId <= 0L` 等）在 935–938，建议 ref → **934**。
2. [74] ref 1418 → 反向包含核心逻辑（`textMatchesLexicalToken(query, memory.title)`，注释里还有"长安大学"原例）在 1396–1412，建议 ref → **1398**。
3. [128] ref 2347 → `source = "merged_from_memory"` 在 2341（偏 1 行出窗），建议 ref → **2341**。
4. 正文"来源"小节行数与实际不符：MemoryExportModel.kt 标 101 实际 **107**；CloudEmbeddingConfig.kt 标 19 实际 **24**；DocumentChunk.kt 标 31 实际 **27**；MemorySearchDebugInfo.kt 标 39 实际 **38**。其余 4 个文件行数正确。
5. `data-repo-memory.lint.md` 自身含模糊词"可能"（meta 文件，不影响条目页 lint 结果；条目页独立复跑 0/0）。
6. Q1（warn）与 Q0（high）是同类问题（未就绪时静默丢向量），分级不一致；Q0 的 high 判定本身合理，Q1 维持 warn 也可接受，提请 writer 自行斟酌。
7. 走查可补一条 suggestion：`CloudEmbeddingConfig.apiKey` 经 `MemorySearchSettingsPreferences` 明文存 DataStore（app 私有目录，非 world-readable，属常规做法，至多 suggestion 级）。

---

## 通过项

### facts 156 条：基本通过（除上表 6 条 ref 错位）

- ref 格式/文件存在/行号不越界：156/156 全过。
- 逐条窗口语义核对：其余 150 条断言均被 ±5 窗口原文支撑，包括数值类断言（RRF_K=60.0、覆盖率公式、权重乘子三元组、图谱传播公式、颜色值 0xFF9575CD 等）全部与代码逐字一致。
- 原子化：无三段式复合事实；[0]/[141] 等含两分句的均为同一函数行为的紧密描述，可接受。

### 正文 md：结构通过，内容 1 处硬伤（H1）

- §9 双受众结构完整：概述 / `## AI 速览`（核心符号清单+主入口+数据流向一句话）/ 核心机制（9 节）/ 关键符号（表格，英文原名）/ 调用链（输入→处理→输出三段式编号）/ 来源。
- 人话可读，术语首现有解释；与 facts 无其他矛盾（H1 除外）。
- 禁用词：全文 grep "通过/批准/LGTM" 0 命中。

### quality 12 条：通过

- 12 条 evidence 去缩进后全部在源码逐字命中（0 缺失）。
- 分级合理：1 high（Q0，saveMemory 静默丢向量，数据丢失类，high 恰当）/ 3 warn / 8 suggestion；无夸大、无漏判的高危。
- quality 不进正文，符合铁律。

### status.json：正确

`id` / `title` 记忆仓库 / `issue` 62（整数）/ `status` review-pending / `source_repo` operit / `source_commit` dbf71916… / `critic` 留空 / `refs_valid` 格式与样例一致。

### lint：通过

独立复跑 `lint.py --src ~/workspace/Operit --dir review/batch-05`：`data-repo-memory.md` 本体 0 硬失败 / 0 警告（目录级报告里关于 `data-repo-memory.lint.md` 的条目是 lint 工具把 meta 文件当条目页扫的噪音，各页皆然，不影响条目结论）。

---

## 复检要求

writer 修正 H1（正文入队方两处）+ H2（6 条 ref 行号）后，critic 对修正条目复检窗口支撑，确认后方可关闭。轻微问题建议同批顺手修。

---

## 复验（第二轮）——2026-10-01

- 复验身份：独立于第一轮 critic 的复验 critic，全程独立核源码，未采信修错员报告。
- 源码版本：`git rev-parse HEAD` = `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，与钉死 commit 一致。

### 复验结论：通过

修错员对第一轮报告的全部硬问题 + 轻微问题已逐项修复，经独立核验确认：

**H1（正文入队方断言）——修好。** 自己 grep 三文件源码：`MemoryAutoSaveScheduler.kt` 全文件 `enqueue` 0 命中（只做 `getPendingAndFailedCandidates` 拉取）；`EnhancedAIService.kt:2049` 有 `.enqueue(` 调用（上下文日志"自动保存长期记忆入队"）；`MessageCoordinationDelegate.kt:1502` 有 `.enqueueSelectedUserMessages(` 调用。正文 §9 已改成"入队方有两处：EnhancedAIService（回复定稿）、MessageCoordinationDelegate（消息协调流程）；MemoryAutoSaveScheduler 只拉取 pending/failed 候选，不负责入队"，断言与代码一致。

**H2（6 条 ref 重新锚定）——全部逐行核实，±5 窗口均有支撑原文：**
- [104]→MemoryRepository.kt:1908：窗口 1903–1913 见 `memory.embedding = null`（1909），与"内容为空但仍有 embedding 的记忆的 embedding 清空为 null"断言一致
- [121]→MemoryExportModel.kt:80：窗口见 `enum class ImportStrategy`（80），三种策略在 80–94
- [122]→MemoryRepository.kt:2777：窗口见 `uuid = if (forceNewUuid) UUID.randomUUID().toString() else serializable.uuid`
- [123]→MemoryExportModel.kt:101：窗口见 `data class MemoryImportResult` 及四个计数字段（102–105）
- [149]→MemoryAutoSaveCandidate.kt:21：窗口见 STATUS_PENDING/PROCESSING/FAILED（21–23）
- [150]→MemoryAutoSaveCandidate.kt:25：窗口见 SOURCE_TYPE_REPLY_FINALIZED_AUTO（25）、SOURCE_TYPE_SELECTED_USER_MESSAGE（26）

**轻微项——全部确认：**
- [37]→:934：窗口见 `sourceId <= 0L`（935）等悬空判定条件
- [74]→:1398：窗口见注释"长安大学"原例（1397）与 `textMatchesLexicalToken(query, memory.title)`（1399）
- [128]→:2341：窗口见 `source = "merged_from_memory"`（2341）
- 正文"来源"小节 4 文件行数已纠正，自己 `wc -l` 核实：MemoryExportModel 107、CloudEmbeddingConfig 24、DocumentChunk 27、MemorySearchDebugInfo 38，标注与实际一致
- `.lint.md` 自身模糊词"可能"已清除（全文 grep 0 命中）
- Q0 与 Q1 同类数据丢失问题均已为 **high**，分级一致、无夸大
- 新增 suggestion 项（CloudEmbeddingConfig.apiKey 经 MemorySearchSettingsPreferences.kt:101 `.putString(KEY_CLOUD_API_KEY, normalized.apiKey)` 明文存普通 SharedPreferences）：evidence 与源码逐字一致，suggestion 分级恰当

**全量复查：**
- 156 条 facts ref 程序化校验：文件存在、行号不越界，156/156 通过
- 人工抽样 20 条 ±5 窗口语义核对（含 RRF 公式 1.0/(60.0+rank)、deleteMemory 删区块、30 秒节流、merge 至少两源记忆等）：全部支撑成立
- 5 文件全文 grep"通过/批准/LGTM"：0 命中
- status.json：issue 62（整数）、review-pending、source_repo operit、source_commit 一致；refs_valid"156/156 引用行号真实存在，lint 硬失败 0/警告 0"与实测一致
- lint.py 独立隔离重跑（输出放目录外，避免自扫 quirk）：检查文件 1，硬失败 0 / 警告 0
