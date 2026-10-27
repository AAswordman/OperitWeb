# Critic 复核报告：util-stream-core（响应式流框架，Issue #85）

- 复核对象：`review/batch-06/util-stream-core.{md,facts.json,quality.json,lint.md,status.json}`
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 复核方式：160 条 facts 全部拉出 ref±5 行窗口逐条比对源码；quality 14 条 evidence 逐字比对；正文通读；种子清单对照 `tracking/shards/day-4.json`

## 总体 verdict：FAIL（需修错后复验）

事实性错误 0 处；但发现 **6 条复合事实违反原子化铁律**、**5 处 facts 行号锚点错误/窗口外**、**1 处 quality 行号锚点错误**。修错后需另一名独立 critic 复验。

---

## 一、facts.json 逐条结论

机械检查（160 条）：ref 文件全部存在、行号无越界、顶层数组格式正确、无虚构符号。以下为 FAIL 项，其余 149 条 PASS。

### FAIL-1 [17] 复合事实 + 后半断言超出 ±5 窗口
- fact："FlowAsStream 在 finally 中标记流关闭；若关闭时仍处于锁定状态则尝试 unlock 排空缓冲。"
- 两个断言违反原子化；且 `unlock()` 调用在 Stream.kt:213，超出 ref :206 的 ±5 窗口（201–211）。
- 修正：拆成 2 条原子事实；或将 ref 改为 :209（窗口 204–214 覆盖 markClosed、isLocked 检查与 unlock() 调用）。

### FAIL-2 [33] 复合事实 + 后半断言超出 ±5 窗口
- fact："tryEmit 用 trySend 非挂起发送；流已关闭时直接返回 false。"
- 两个断言违反原子化；且 `channel.trySend(...)` 在 HotStream.kt:140–142，超出 ref :130 的 ±5 窗口（125–135）。
- 修正：拆成 2 条；或将 ref 改为 :138（窗口 133–143 覆盖 `isClosed return false` 与 trySend）。

### FAIL-3 [46] 复合事实 + 后半断言超出 ±5 窗口
- fact："share 的 EAGERLY 模式立即在 scope 启动上游收集，结束或异常时 close 共享流并调用 onComplete。"
- 两个断言违反原子化；"结束或异常时 close 共享流并调用 onComplete" 在 HotStream.kt:363–367，超出 ref :335 的 ±5 窗口。
- 修正：拆成 2 条（第二条 ref 锚定 :365 附近）。

### FAIL-4 [58] 复合事实 + 后半断言超出 ±5 窗口
- fact："stream 构建器在 finally 中 markClosed；若关闭时仍锁定则尝试 unlock 排空缓冲。"
- 两个断言违反原子化；unlock() 调用在 StreamBuilders.kt:143 附近，超出 ref :134 的 ±5 窗口。
- 修正：拆成 2 条；或将 ref 改为 :137。

### FAIL-5 [93] 复合事实
- fact："savepoint(id) 只记录当前内容长度；注释说明回滚只丢弃后缀，字符索引即完整修订状态。"
- 断言本身为真（TextStreamRevisionTracker.kt:13–16，±5 窗口内），但含 2 个断言，违反原子化。
- 修正：拆成 2 条。

### FAIL-6 [94] 复合事实
- fact："rollback(id) 把内容截断到保存长度并删除其后的 savepoint；未知 id 返回 null。"
- 断言本身为真（:19–23，±5 窗口内），但含 2 个断言，违反原子化。
- 修正：拆成 2 条。

### FAIL-7 [119] 后半断言超出 ±5 窗口
- fact："splitBy 在评估态把字符缓入 evaluationBuffer，插件进入 PROCESSING 后回放缓冲。"
- 断言为真，但"回放缓冲"（`evaluationBuffer.forEachIndexed` 回放循环，StreamOperators.kt:405–412）超出 ref :394 的 ±5 窗口（389–399）。
- 修正：将 ref 改为 :405（窗口 400–410 覆盖"回放缓冲区中的字符到成功的插件"注释与回放循环）。

### FAIL-8 [139] 行号锚点错误
- fact："GreedyStarCondition 是 internal 的贪心星号条件。"，ref :117。
- `internal class GreedyStarCondition` 实际在 StreamKmpGraph.kt:124；ref :117 的 ±5 窗口（112–122）不包含该声明。
- 修正：ref 改为 :124。

### FAIL-9 [140] 行号锚点错误
- fact："GroupCondition 是构建器标记类，直接调用 matches 会抛 UnsupportedOperationException。"，ref :124。
- 断言为真（StreamKmpGraph.kt:131–134），但 ref :124 指向的是 GreedyStarCondition，±5 窗口（119–129）不包含 GroupCondition。
- 修正：ref 改为 :132。

### FAIL-10 [141] 行号锚点偏离
- fact："KmpNode 有 id、depth、isFinal，并用 transitions 映射维护条件到目标节点的跳转。"，ref :149。
- 断言为真，但 ref :149 的 ±5 窗口（144–154）只覆盖到 id/depth；isFinal（:157）、transitions（:159）在窗口外。
- 修正：ref 改为 :155（窗口 150–160 覆盖全部四要素）。

### FAIL-11 [145] 关键证据超出 ±5 窗口
- fact："processChar 走失败路径时沿 failureNode 链回跳并按 searchNode.depth + 1 调整匹配长度。"，ref :253。
- 断言为真，但 `currentMatchLength = searchNode.depth + 1` 在 StreamKmpGraph.kt:263，超出 ref :253 的 ±5 窗口（248–258）。
- 修正：ref 改为 :261（窗口 256–266 覆盖 failureNode 回跳与 depth+1 调整）。

其余 149 条：PASS（断言为真、原子化、±5 窗口完整支撑）。

---

## 二、quality.json 逐条结论

14 条中 13 条 PASS：evidence 均为源码逐字原文且落在 file:line ±5 窗口内；severity 评级合理。

### high [0] PASS（实锤确认）
- `sample()`（StreamOperators.kt:535）：`coroutineScope { launch { while (true) { delay... } }; collect { ... } }`——内层 launch 永不结束，外层 coroutineScope 永不完成，collect 永久挂起（仅取消能解脱）。high 评级合理。

### FAIL-12 quality [5] 行号锚点错误
- finding："顶层预定义条件 DIGITS/LETTERS 等的 description 是大写（如 "DIGITS"），而 PredicateCondition.toRegexPattern 的 when 只匹配小写 "digit" 等，落到 else 返回 "."；二次正则确认时语义被泛化为任意字符。"
- claim 属实：DIGITS = PredicateCondition("DIGITS")（:659），toRegexPattern 的 `return when (description)` 只匹配小写分支，else -> "."（:107–120）。
- 但 file:line 写的是 :97，evidence 首行 `return when (description) {` 实际在 :107，超出 ±5 窗口。
- 修正：line 改为 107。

其余 warn 11 / suggestion 2：PASS（[4] repeat 绕过 add 的 groupIds 登记、[6] take 不停无限上游、[7] unlock 异常丢缓冲、[9] shareRevisable replay=Int.MAX_VALUE 事件累积、[10] setupFailureTransitions 简化回溯、[11] WAITFOR 空 catch 等，证据逐字命中，评级合理）。

---

## 三、正文核查

- 结构：概述 / ## AI 速览（核心符号清单 + 主入口 + 数据流向一句话）/ 核心机制 / 关键符号 / 输入→处理→输出三段式 / 来源——齐全，PASS。
- 双受众：人话表述 + 符号英文原文保留，PASS。
- 来源小节 10 个种子文件与 `tracking/shards/day-4.json` 的 util-stream-core 种子清单逐一对应，行数核对：Stream.kt 252 / HotStream.kt 450 / StreamBuilders.kt 188 / StreamOperators.kt 644 / StreamGroup.kt 221 / RevisableTextStream.kt 177 / TextStreamRevisionTracker.kt 30 / StreamKmpGraph.kt 698 / StreamKmpMatchResult.kt 18 / StringExtensions.kt 11——全部一致。
- 小瑕疵（建议级，不计入 FAIL）：来源写 StreamKmpGraph.kt"约 720 行"，实际 698 行，"约"字兜底可接受，建议改"约 700 行"更准确。
- 正文无行内 file:line 引用（引用承载在 facts.json），无禁用词（全文 0 命中），无模糊词。

---

## 四、status.json

`{"id":"util-stream-core","issue":85,"status":"review-pending","source_repo":"operit","source_commit":"dbf71916fae9750cfdc9f9a774f5a0fee56633fb","refs_valid":160,"critic":""}`——字段全部正确，PASS。
注意：若修错时拆分复合事实导致 facts 数量变化，refs_valid 须同步更新。

---

## 修错清单（修错员按此执行）

1. 拆分复合事实 [17]、[33]、[46]、[58]、[93]、[94] 为原子事实（一条一个断言）。
2. 修正行号锚点：[119]→:405、[139]→:124、[140]→:132、[141]→:155、[145]→:261；quality [5] line 97→107。
3. 每条修正后重新核对 ±5 窗口支撑；facts 数量变化则更新 status.json 的 refs_valid。
4. 修正后 4 文件（md/facts/quality/status，不含 lint.md）隔离跑 lint.py，必须 0 硬失败/0 警告；更新 lint.md。
5. 全文复查"通过/批准/LGTM" 0 命中；severity 仅 high/warn/suggestion。

修错完成后，须派另一名独立 critic 复验（writer/修错员自检不能代替）。
