# Critic 复核报告：api-chat-memory（会话记忆与上下文总结）

- 复核对象：`review/batch-04/api-chat-memory.*`（writer 交付）
- 源码版本：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认 `git rev-parse HEAD` 一致）
- 复核方式：116 条 facts 全部机械校验（ref 格式/文件存在/行号范围/重复）+ 逐条人工核对断言 vs 源码 ±5 行窗口；5 条 quality evidence 逐行 diff 源码；正文 §9 结构检查；status.json 字段检查
- 复核结论：**退回修正**（见下）。无虚构证据，但有 12 条 facts 引用问题 + 2 条 quality 行号错位，须修完复检。

## 一、facts.json（116 条）：104 通过 / 12 有问题

机械检查（ref 格式合法、文件存在、行号在范围内、无重复 ref/fact）：116 条全部通过。

内容问题清单（均为引用窗口违规 / 复合事实 / 表述错误，断言本身为真，但引用不合铁律）：

### 必须修

1. **[12] ref `MemoryLibrary.kt:113`** — 断言"saveMemoryAsync … CancellationException 重抛不吞"，但 `catch (e: CancellationException) { throw e }` 在 L136-137，超出 ref 113 的 ±5 窗口（L108-118）。修：ref 改为 `MemoryLibrary.kt:136`。
2. **[13] ref `MemoryLibrary.kt:145`** — 断言"history limit 默认值 10，propagateAnalysisFailure=true"，证据实际在 L158-159（`analysisHistoryLimit = DEFAULT_ANALYSIS_HISTORY_MESSAGE_COUNT` / `propagateAnalysisFailure = true`），超出窗口。修：ref 改为 `MemoryLibrary.kt:158`。
3. **[20] ref `MemoryLibrary.kt:271`** — 断言"用 extractJsonArray 提取数组，非 `[` 开头直接返回"，证据在 L277-278，超出窗口（L266-276）1-2 行。修：ref 改为 `MemoryLibrary.kt:277`。
4. **[31] ref `MemoryLibrary.kt:464`** — 复合事实。前半"importance=0.8f、credibility=1.0f"在窗口内（L464-465）✓；后半"同名已存在则更新内容而非新建"的证据在 L453-457（`existingMemory.content = mainProblem.content; saveMemory`），超出窗口。修：拆成两条，或 ref 改为 `MemoryLibrary.kt:453`（窗口 L448-458 覆盖存在性检查与更新）。
5. **[37] ref `MemoryLibrary.kt:591`** — **表述错误**。断言"scoreMode/keywordWeight/tagWeight/semanticWeight/vectorWeight/edgeWeight 六维权重"，实际 `searchMemories` 调用（L584-591）只有 5 个具名参数：`scoreMode, keywordWeight, tagWeight, semanticWeight, edgeWeight`，其中 `semanticWeight = searchConfig.vectorWeight`——semanticWeight 与 vectorWeight 是同一个参数（参数名 vs 配置来源），不是两个独立维度。"六维"不成立。修：改述为"scoreMode + keyword/tag/semantic/edge 四权重（semanticWeight 取自 vectorWeight 配置），取前 15 条"。
6. **[44] ref `MemoryLibrary.kt:679`** — 断言"solution(180字) + 最近12条消息(1200字)"，证据在 L688（`maxLen = 180`）、L691（`takeLast(12)`）、L692（`maxLen = 1200`），超出窗口。修：ref 改为 `MemoryLibrary.kt:688`。
7. **[61] ref `ChatMemoryRebuildManager.kt:115`** — 复合事实，无单一 ±5 窗口能同时覆盖三个子断言："先报 PREPARING"在 L104，"按 chatId 加载全部消息"在 L112，"plan 切窗"在 L115（L104 与 L115 相距 11 行）。修：拆成两条（PREPARING 一条 ref 改 104；加载+切窗一条 ref 保持 115）。
8. **[68] ref `ChatMemoryRebuildManager.kt:173`** — 断言"analysisHistoryLimit = 窗口消息数"，证据在 L180（`analysisHistoryLimit = window.messages.size`），超出窗口（L168-178）。修：ref 改为 `ChatMemoryRebuildManager.kt:180`。
9. **[93] ref `MemoryAutoSaveScheduler.kt:40`** — 复合事实。"getInstance() 返回可空单例"在 L40 ✓；"start() 未启动时才赋值 instance"的证据在 L48-50（`if (loopJob?.isActive == true) return; instance = this`），超出窗口。修：拆成两条。
10. **[94] ref `MemoryAutoSaveScheduler.kt:48`** — 断言"后台循环 while(isActive){ delay(60000); runOnce() }"，证据在 L54-56，超出窗口（L43-53）。修：ref 改为 `MemoryAutoSaveScheduler.kt:54`。
11. **[95] ref `MemoryAutoSaveScheduler.kt:61`** — 断言"向上取整"，取整公式 `((remainingMs + 60_000L - 1L) / 60_000L)` 在 L67，超出窗口（L56-66）。修：ref 改为 `MemoryAutoSaveScheduler.kt:67`。
12. **[114] ref `MemoryAutoSaveScheduler.kt:279`** — 断言"saveMemoryNow(profileIdOverride=profileId)，成功后删除候选"，`profileIdOverride = profileId` 在 L285，`deleteCandidates` 在 L287，均超出窗口（L274-284）。修：ref 改为 `MemoryAutoSaveScheduler.kt:285`（窗口 L280-290 同时覆盖）。

### 建议收紧（表述真实但引用可更严，可与上面一起修）

- **[3] ref `MemoryLibrary.kt:40`** — "saveMemory 与 autoCategorizeMemories 串行执行"的证据是两处 `mutex.withLock`（L198、L323），不在声明行窗口内。建议改述为"全局互斥锁（saveMemory/autoCategorizeMemories 经它串行）"并 ref 指向一处 withLock，或保持现状（描述性断言）。
- **[38] ref `MemoryLibrary.kt:621`** — "发现同名记忆多于 1 条时" 的阈值逻辑在 `findAndDescribeDuplicates` 内部（L754），调用处窗口只见注释。建议 ref 改为 `MemoryLibrary.kt:754`。
- **[45] ref `MemoryLibrary.kt:702`** — 中文正则在 L705-707 ✓，英文 `Question:...Solution:` 正则在 L710-711，超出窗口。建议 ref 改为 `MemoryLibrary.kt:705`（窗口 L700-710 同时覆盖中英两处）。
- **[49] ref `MemoryLibrary.kt:834`** — "缺一即抛 IllegalArgumentException"为真（`requiredString` L858-860 抛 `IllegalArgumentException`，`requiredObjectArray` L847-849 用 `require` 同样抛该类型），但抛行为在 L841-850，超出 ref 834 窗口。建议 ref 改为 `MemoryLibrary.kt:847`，或拆成"协议字段"与"缺失抛异常"两条。
- **[71] ref `ChatMemoryRebuildManager.kt:230`** — "有 characterGroupId 直接用当前记忆空间"的证据在 L222-224，超出窗口（L225-235）。建议拆成两条（ref 222 + ref 230）。
- **[83] ref `ChatMemoryWindowPlanner.kt:56`** — "user 消息计入 source"（`pendingSourceMessages += message`）在 L62，超出窗口（L51-61）。建议 ref 改为 `ChatMemoryWindowPlanner.kt:58`（窗口 L53-63 同时覆盖 emit 检查与 +=）。

## 二、quality.json（5 条）：证据全部真实，2 处行号错位

逐行 diff 源码结论：5 条 evidence 均为源码逐字复制，**无虚构**，severity/置信度合理。但有 2 条 `line` 字段指向 evidence 块的末行而非首行（行号错位）：

1. **"createdMemories 按标题做键，AI 返回重名实体会静默覆盖"** — evidence 三行逐字等于源码 L514/L515/L516，但 `line` 标为 516。修：`line` 改为 **514**。
2. **"autoCategorizeMemoriesAsync 吞掉全部异常，调用方无从得知失败"** — evidence 七行逐字等于源码 L104-L110，但 `line` 标为 101（函数声明行）。修：`line` 改为 **104**。

其余 3 条（mutex 横跨 LLM 流式分析 L323、JSON 打 debug 日志 L821、start() 覆盖 instance L48）行号与 evidence 首行一致，通过。

走查内容本身有价值：mutex 横跨网络流式导致定时保存可被饿死、标题键覆盖、吞异常无回调均为实锤。

## 三、正文 api-chat-memory.md：通过

- §9 双受众结构完整：概述 / `## AI 速览`（11 个核心符号清单 + 主入口签名 + 数据流向一句话）/ 核心机制 7 节 / 关键符号表（14 行，引用精确到行）/ 调用链 3 条（输入→处理→输出三段式编号）/ 来源（5 文件，行数 927/297/245/82/43 与源码 `wc -l` 一致）。
- 人话：术语首现均有解释（记忆图谱、记忆空间、durable 保留英文），短句。
- 抽查正文内引用行号（:145/:323/:379/:556/:813/:48/:82/:287/:78/:115/:197/:5/:8）均指向对应符号定义/逻辑处，无明显错位。

## 四、status.json：通过

`{id: "api-chat-memory", issue: 57, status: "review-pending", source_repo: "Operit", source_commit: "dbf71916fae9750cfdc9f9a774f5a0fee56633fb", critic: ""}` —— 字段全对，critic 留空待填。

## 总结论

**退回修正**：facts 12 条引用问题（§一"必须修"）+ quality 2 处行号错位（§二）须修正后复检。无虚构证据，正文与 status 通过。建议 writer 按本报告逐条改 ref/拆分/改述后，跑一遍自检脚本确认 ±5 窗口，再交复检。
