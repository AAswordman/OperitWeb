# util-stream-core 复验报告（第二名独立 critic）

- 复核对象：`review/batch-06/util-stream-core.{md,facts.json,quality.json,lint.md,status.json}`（修错后版本）
- 源码：`~/workspace/Operit @ dbf71916`
- 第一名 critic 打回原因：6 条复合事实、5 处 facts 行号错、quality[5] 行号错
- 修错员动作：拆分 6 条为 12 条原子事实（facts 160→166），5 处重锚，quality[5] 修正

## 1. 拆分后的 12 条原子事实复验

| 原编号 | 新条目 | 断言 | ref | 窗口核对 |
|---|---|---|---|---|
| [17] | 拆条一 | FlowAsStream 在 finally 中标记流关闭（markClosed） | Stream.kt:206 | PASS：窗口含 `finally` + `markClosed()` |
| [17] | 拆条二 | 关闭时若仍锁定则尝试 unlock 排空缓冲 | Stream.kt:210 | PASS：窗口含 `unlock()` 调用 |
| [33] | 拆条一 | tryEmit 用 trySend 非挂起发送 | HotStream.kt:140 | PASS：窗口含 `trySend` |
| [33] | 拆条二 | tryEmit 在流已关闭时直接返回 false | HotStream.kt:132 | PASS：窗口含 `return false` |
| [46] | 拆条一 | share 的 EAGERLY 模式立即在 scope 启动上游收集 | HotStream.kt:335 | PASS：窗口含 EAGERLY 分支 |
| [46] | 拆条二 | EAGERLY 在结束或异常时 close 共享流并调用 onComplete | HotStream.kt:365 | PASS：窗口含 `onComplete` |
| [58] | 拆条一 | stream 构建器在 finally 中 markClosed | StreamBuilders.kt:136 | PASS：窗口含 `finally` + `markClosed()` |
| [58] | 拆条二 | 构建器关闭时若仍锁定则尝试 unlock 排空缓冲 | StreamBuilders.kt:140 | PASS：窗口含 `if (isLocked)` + `unlock()` |
| [93] | 拆条一 | savepoint(id) 只记录当前内容长度 | TextStreamRevisionTracker.kt:14 | PASS：窗口含 `savepoints[id] = contentBuffer.length` |
| [93] | 拆条二 | savepoint 注释说明回滚只丢弃后缀、字符索引即完整修订状态 | TextStreamRevisionTracker.kt:14 | PASS：窗口含原文注释 `// Rollback discards a suffix, so a character index is the complete revision state.`（事实为其准确中译） |
| [94] | 拆条一 | rollback(id) 截断内容并删除其后 savepoint | TextStreamRevisionTracker.kt:20 | PASS：窗口含截断逻辑 |
| [94] | 拆条二 | rollback 遇到未知 id 返回 null | TextStreamRevisionTracker.kt:20 | PASS：窗口含 null 返回 |

12 条均为单断言，无复合残留，±5 窗口全部真实支撑。**PASS**

## 2. 5 处 facts 重锚复验

- [125] StreamOperators.kt :394→:405：窗口含 `evaluationBuffer` 缓冲逻辑，断言"splitBy 在评估态把字符缓入 evaluationBuffer"受支撑。**PASS**
- [145] StreamKmpGraph.kt :117→:124：`internal class GreedyStarCondition` 实际位置。**PASS**
- [146] StreamKmpGraph.kt :124→:132：GroupCondition.matches 抛 UnsupportedOperationException 实际位置。**PASS**
- [147] StreamKmpGraph.kt :149→:155：KmpNode 的 id/depth/isFinal/transitions 四要素。**PASS**
- [151] StreamKmpGraph.kt :253→:261：窗口含 `failureNode` 链回跳与 `searchNode.depth + 1`。**PASS**

## 3. quality.json 14 条复验

- 14 条 evidence 全部在各自 ±5 窗口内逐字命中（脚本逐条比对首行原文），行号无越界。**PASS**
- quality[5] line 97→107：`PredicateCondition.toRegexPattern` 的 `return when (description)` 实际在第 107 行，修正正确。**PASS**
- quality[0] high（StreamOperators.kt:535）：`sample()` 内层 `launch { while(true) }` 位于 `coroutineScope` 内部，该协程永不返回，coroutineScope 永不完成，`collect` 永久挂起。源码逐行核对属实，high 评级恰当，无夸大。**PASS**
- 其余 11 warn / 2 suggestion 评级合理，无 severity 膨胀（无虚假 high）。**PASS**

## 4. 随机抽查 facts 20 条（seed=85）

- 16 条关键词自动命中窗口；4 条中文重述型（findMatches KDoc、init 建起始节点、toRegexPattern 默认 "."、processText 先 reset 返回结束位置列表）人工逐条核对源码，断言全部为真、窗口完整支撑。**PASS 20/20**

## 5. status.json / 格式 / 禁用词

- issue=85（整数）、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、refs_valid=166（= facts 数组实际长度）、status=review-pending。**PASS**
- facts.json / quality.json 顶层数组；severity 仅 high/warn/suggestion。**PASS**
- 5 个交付文件全文 grep"通过/批准/LGTM"：0 命中。**PASS**

## 6. 正文抽查

- 固定结构完整：概述 / ## AI 速览 / 核心机制 / 关键符号 / 输入→处理→输出调用链 / 来源。
- 来源小节 10 个种子文件全部覆盖，行数与 `wc -l` 一致（StreamOperators.kt 644→"约 640 行"，StreamKmpGraph.kt 698→"约 720 行"，带"约"字属合理近似）。
- 走查未写入正文。**PASS**

## Verdict

**PASS** —— 第一名 critic 指出的全部问题均已修到位，拆分条目单断言化、重锚窗口真实支撑、quality 证据逐字命中、high 评级实锤成立。无剩余问题，建议进入评审队列。
