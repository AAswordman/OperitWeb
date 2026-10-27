# critic 报告：appendix-tests-unit-data（Day 7 / batch-09，Issue #122）

- 评审人：独立 critic（新 session，只读音和引用指向的源码行）
- 源码钉住：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 评审时间：2026-10-01

## 1. facts 抽查：30 条，命中 28 / 错位 2

抽样方式：`random.seed(42)` 固定抽取 30 条：[0, 6, 7, 8, 22, 23, 26, 28, 35, 50, 53, 55, 57, 59, 62, 69, 70, 75, 83, 89, 91, 97, 103, 108, 111, 129, 138, 139, 142, 143]。逐条用 `git show dbf71916:<path>` 实地核对文件存在、行号、±5 行窗口内容。

- ref 格式：30 条全部为仓库根相对全路径 + 行号，无异常；全页 144 条 ref 格式全部合规；distinct 引用文件 38 = frontmatter `sources: 38`，一致。

### 错位 2 条（必须修复）

**fact[103]** — `app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:186`
- 原 ref：`:186`；原断言内嵌锚点："`JvmCursor`（JvmSupportSQLiteDatabase.kt:177）…`getColumnIndex` 按小写做大小写不敏感匹配（:186-187、:213-216）"。
- 实地：`:186` 为空行（紧邻 `companion object`），`JvmCursor` 类声明实际在 **:194**；`getColumnIndex` 覆盖实际在 **:239**（`columnName.lowercase()`），大小写不敏感映射在 **:202**。
- 断言方向（最小 Cursor 实现、大小写不敏感列名匹配）是对的，但三个行号全错。
- 修正建议：ref 改为 `:194`（或 `:239`）；fact 文本内 `:177` → `:194`，`:186-187、:213-216` → `:202、:239-240`。

**fact[143]** — `app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:114`
- 原 ref：`:114`，落在上一条测试 `daily buckets across dst have exact 23 and 24 hour spans` 的函数体内。
- 实地：被测测试 `` `bucket boundaries partition events exactly once` `` 实际声明在 **:131**；断言内容（半开语义、range.endMs 与 startMs-1 返回 null）与 :144-152 代码一致，内容无误，只是锚点错位。
- 修正建议：ref 改为 `:131`。

### 轻微漂移 4 条（建议修复，不强制）

锚点落在注释/空行/上条测试尾部，符号名在 ±5 行内（满足引用铁律字面要求），但建议移到符号所在行：

- fact[108] ref `:133`（节注释）→ 建议 `:136`（`` `openai responses keeps reasoning tokens separately and marks included` `` 声明行）
- fact[111] ref `:213`（空行）→ 建议 `:217`（`` `gemini normalizes usage metadata with cached content and thoughts` `` 声明行）
- fact[139] ref `:36`（空行）→ 建议 `:40`（`` `granularity is chosen by range duration` `` 声明行）
- fact[142] ref `:88`（上条测试的 `}`）→ 建议 `:91`（`` `hourly buckets across fall back produce both repeated hour buckets` `` 声明行）

其余 24 条（含 fact[35]/[97] 的多证据枚举型）全部逐字命中，锚点准确，无编造。

## 2. quality.json 核查：4 条全部真实，severity 合理

| # | file:line | 结论 |
|---|-----------|------|
| 0 | ChatMessageTimestampAllocatorTest.kt:63 | 行存在，证据与源码一致（`||` 第二分支调用 `next(0)` 含副作用，断言近乎空转），warn 合理 |
| 1 | ChatMessageTimestampAllocatorTest.kt:47 | 行存在，`concurrent` 测试实为串行 `(1..100).map`，warn 合理 |
| 2 | ModelConfigSummariesFlowTest.kt:50 | 行存在，`emissions.receive()` 三次无超时，`take(3)` 挂起风险真实，warn 合理 |
| 3 | ChatMessageTest.kt:12 | 行存在，`tearDown` 只调用 `next()` 不重置；4 个测试类共享该单例（实地 `git grep` 确认：ChatMessageTest / ChatMessageTimestampAllocatorTest / MessageEntityTest / MessageVariantEntityTest），warn 合理 |

字段说明：全页用 `description` 而非 SCHEMA §8 的 `detail`、缺 `category`，但这是本批全部页面的统一惯例（ui-main、ui-assistant、ui-memory 均同），`build_quality.py` 有 `f.get` 容错，不视为本页缺陷。

## 3. .md 结构核查（§9 双受众）

- 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源（行 15/25/31/109/136/142）。
- AI 速览：核心符号清单（一行英文符号，34 个）+ 主入口（JUnit4 运行器 + runTest/runBlocking）+ 数据流向一句话，合规。
- 调用链：输入→处理→输出三段编号，合规；来源非空（11 个条目，覆盖 api/backup/db/mcp/model/preferences/recovery/repository/stats + gradle 配置），合规。
- 禁用词：正文 0 命中。术语人话化（"替身"、"真跑 SQLite" 等）无时髦错误类比，未发现超出引用支撑的发挥。
- 小问题：`## 核心机制` 节为空（紧随其后即 `## 关键符号`），结构上合规但内容上该节缺失，建议 writer 补 2-3 行或合并声明；不列入必须修复。

## 4. status.json 核查

`refs_valid=144 = facts 数 144` ✓；`status=review-pending` ✓；`issue=122` ✓；`source_repo=operit`、`source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（完整 hash）✓。

## 5. lint

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`：本页 `appendix-tests-unit-data.md` **0 硬失败 / 0 警告**。
（报告中针对 `appendix-tests-unit-data.lint.md` 的 5 条报错是 lint 扫描到自己上一轮生成的报告文件——同批 ui-about/ui-assistant/ui-permission/ui-tokenstats 的 `.lint.md` 被同等报错，属流水线已知 artifact 噪声，非本页缺陷；建议后续 lint 扫描排除 `*.lint.md`。）

## 结论：FAIL

**必须修复清单**（2 项，修完即转 PASS）：

1. fact[103]：ref `:186` → `:194`（或 `:239`）；fact 文本内 `:177` → `:194`，`:186-187、:213-216` → `:202、:239-240`。
2. fact[143]：ref `:114` → `:131`。

建议（不阻塞）：fact[108]/[111]/[139]/[142] 锚点移到测试声明行；补 `## 核心机制` 2-3 行内容。
