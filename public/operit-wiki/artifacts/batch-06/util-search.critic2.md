# 复验报告（critic2）：util-search（Issue #88）

- 复验对象：`review/batch-06/util-search.{md,facts.json,quality.json,lint.md,status.json}`（修错后版本）
- 源码：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已确认）
- 第一轮 critic：FAIL（22 项清单：13 条 facts 窗口违规、F72 断言失实、F79 工具名虚构、5 条 quality 行号错、正文 4 处 search_code + 行数错 + 无来源比较）
- 复验方式：22 项逐项脚本核窗口 + F72 源码语义核对 + quality 12 条逐字比对 + 20 条随机抽查人工读窗口 + 正文/禁用词/status 字段核对 + /tmp 隔离 lint 重跑。
- 结论用词：PASS / FAIL（不使用禁用词）。

## 一、第一轮 22 项修正逐项复验

### facts（14 项）——全部修到位

| 项 | 修正 | 复验 |
|---|---|---|
| F31 | ref `:9`→`:12` | PASS：窗口 7–17 行含 `contextLines`（15 行）、`maxResults`（16 行） |
| F35 | ref `:66`→`:73` | PASS：窗口 68–78 行含 `success: false` 的 Err 分支 |
| F39 | ref `:121`→`:125` | PASS：窗口 120–130 行含 `"pattern is required"`（130 行） |
| F44 | ref `:257`→`:260` | PASS：窗口 255–265 行含 `contains(&0)`（264 行） |
| F47 | ref `:226`→`:230` | PASS：窗口 225–235 行含 `backup/**` 排除项（233–234 行） |
| F48 | ref `:174`→`:182` | PASS：窗口 177–187 行含 `max_results` break 逻辑（182–186 行） |
| F49 | ref `:198`→`:201` | PASS：窗口 196–206 行含 `case_insensitive`（204 行） |
| F53 | ref `:296`→`:305` | PASS：窗口 300–310 行含 `BTreeSet`（302 行起） |
| F66 | ref `:343`→`:346` | PASS：窗口 341–351 行含 `chunk.id`（349–350 行） |
| F72 | 拆成两条 | PASS：idx71 ref `:600` 表述"回查 memoryBox、逐条重算 cosineSimilarity、函数内不做排序"；idx72 ref `MemoryRepository.kt:1433` 表述"调用方 sortedByDescending 降序"。源码核对：595–606 行无 sort、`cosineSimilarity`+`memoryBox` 在列；1428–1438 行含 `sortedByDescending`。语义准确 |
| F73 | ref `:272`→`:276` | PASS：窗口 271–281 行含 `Dispatchers.IO`（280 行） |
| F75 | ref `:282`→`:285` | PASS：窗口 280–290 行含 `coerceAtLeast`（288–289 行） |
| F78 | ref `:531`→`:543` | PASS：窗口 538–548 行含 `effectiveMaxResults == 0`（543 行） |
| F79 | `search_code`→`grep_code` | PASS：fact 写"grep_code 工具的执行入口最终调用 grepCodeWithNativeRipgrep"，`search_code` 字样已清零 |

facts 总数 81→82，全部为单断言原子事实；status.json `refs_valid: 82` 与数组长度一致。

### quality（5 处行号）——全部修到位且逐字命中

| 项 | 修正 | 复验 |
|---|---|---|
| Q5 | line 87→89 | PASS：`tools/native_ripgrep/src/lib.rs:89` 与 evidence `.unwrap_or(std::ptr::null_mut())` 逐字一致 |
| Q6 | line 348→349 | PASS：`:349` 与 evidence 逐字一致 |
| Q8 | line 82→81 | PASS：`VectorIndexManager.kt:81` 与 evidence 逐字一致 |
| Q9 | line 59→60 | PASS：`:60` 与 evidence 逐字一致 |
| Q12 | line 257→262 | PASS：`:262` 与 evidence 逐字一致 |

其余 7 条（Q1/Q2/Q3/Q4/Q7/Q10/Q11）evidence 同样逐字命中源码。12/12 逐字比对 PASS。

severity 合理性：2 条 high（索引加载失败整体删除索引文件、HNSW 索引 Java 原生序列化反序列化）均为真实数据丢失/代码执行风险，无夸大；warn/suggestion 分级恰当；取值仅 high/warn/suggestion。

### 正文（3 类）——全部修到位

1. 4 处 `search_code` → `grep_code`（概述/关键符号/链路 3/来源），md 内 `search_code` 残留 0 处，`grep_code` 出现 4 处。
2. 来源小节行数：VectorIndexManager.kt 91 行、IndexItem.kt 34 行、NativeRipgrep.kt 18 行、lib.rs 350 行——与 `wc -l` 逐一核对一致；frontmatter `sources: 8` 与实际来源数一致（第一轮指出的 9 对不上 8 已修正）。
3. "速度比纯 Kotlin 实现快得多"无来源比较已删除。

## 二、20 条 facts 随机抽查（种子 88）

抽查索引：0、7、8、14、21、23、24、29、35、41、44、49、50、51、57、58、60、62、67、70。每条人工读 ref±5 窗口：

- 全部 20 条断言与窗口内源码一致（泛型约束、FLOAT_COSINE_DISTANCE、withRemoveEnabled、ensureCapacity 扩容条件、version 默认值 0L、Item 接口实现、dimensions()=vector.size、@JvmStatic external searchJson、serde camelCase、git_* 遍历规则、filePattern 空/* 不过滤、invalid regex 错误、from_utf8_lossy+去 \r、unwrap_or(false)、escape_json_fragment 只转义反斜杠和双引号、JNI null jstring、cdylib、VectorIndexManager 泛型实例化、doc_index 文件名格式、findNearest 全量取候选）。
- 无虚构符号、无复合事实、无错文件、无越界行号。

## 三、status.json / lint / 禁用词

- `status.json`：id=`util-search`、issue=88、status=`review-pending`、source_repo=`operit`、source_commit=`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`、refs_valid=82（= facts 数组长度），全部正确。
- 隔离 lint（/tmp，不含 `.lint.md` 自扫）：硬失败 0 / 警告 0。
- 5 文件禁用词（通过/批准/LGTM）全文扫描：0 命中。
- facts.json / quality.json 均为顶层数组，格式合规。

## 四、总体 verdict

**PASS** —— 第一轮 critic 的 22 项清单全部修到位，随机抽查无新问题，lint 0/0，禁用词 0 命中。本页可放行进入 `review-pending` 评审队列（`status.json` 的 `critic` 字段待 parent 统一填写）。
