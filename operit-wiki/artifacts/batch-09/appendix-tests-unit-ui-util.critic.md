# Critic 报告：appendix-tests-unit-ui-util（Issue #123）

- 评审结论：**FAIL**（1 处必须修复，非推倒重来）
- 评审范围：facts.json 全量 143 条（随机抽查 30 条，seed=123）、quality.json 4 条、md 全文、status.json、lint
- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`

## 1. facts 抽查：30/30 精确命中，0 错位、0 编造

抽查索引（seed=123）：0, 8, 9, 11, 13, 20, 22, 27, 34, 40, 48, 55, 57, 62, 68, 76, 85, 86, 87, 93, 97, 99, 104, 112, 115, 125, 131, 134, 141, 142。

逐条用 sed 实地核对源码窗口（±5 行），每条 ref 均精确落在对应 @Test 方法声明行，断言与测试代码一致：

- [13] `ComposeDslTextFieldEchoGuardTest.kt:67` — 失焦直接应用 EXTERNAL_CHANGE，窗口见 `reconcile(..., isFocused = false)` 与 `assertEquals(...EXTERNAL_CHANGE...)` ✔
- [68] `ScreenRouteViewModelStoreOwnerManagerTest.kt:127` — `remove_unknownKey_isNoOp` 方法声明行 ✔
- [22] `MessageCopyTextTest.kt:11` — `cleanMessageContentForCopy_removesMultipleOpenAiReasoningMetadata`，窗口见 openai:responses_reasoning 元数据 ✔
- [104] `ChatUtilsStripMetaCollectionsTest.kt:19` — `stripMeta_turns_preserveKinds`，窗口见 PromptTurnKind.SYSTEM/ASSISTANT ✔
- [141]/[142] `TextStreamRevisionTrackerTest.kt:13/:27` — assertSame 共享 SmartString、rollback/savepoint 逻辑 ✔
- [9] `ComposeDslTextFieldEchoGuardTest.kt:10` — 类声明行，窗口见 issue #1150 回归注释 ✔（7 个 @Test 实地复算 ✔）
- [97] `ChatMarkupRegexToolNameTest.kt:11` — isToolTagName 大写 TOOL_EXEC 接受/null 拒绝 ✔
- [40] `StatusCardHtmlDocumentTest.kt:29` — `document requests nothing over the network`，assertFalse http:// 与 https:// ✔
- [34] `TokenHitRateFormatTest.kt:10` — 657280/685487 = 95.88% ✔
- [112] `MathMlPlainTextConverterTest.kt:33` — 二次公式转 "x = (− b ± √(b² − 4ac))/(2a)" ✔
- [62] `TokenStatsDatePickerTest.kt:87` — 秋季回拨自然日校验 ✔
- [20] `ChatAreaTokenSpeedTest.kt:10` — 100L/4000L = 25.0 token/s ✔
- [0] `ComposeDslFilePickerRequestTest.kt:11` — 类声明行 ✔（4 个 @Test 实地复算 ✔）
- [93] `ChatMarkupRegexTest.kt:83` — geminiThoughtSignatureMetaTag 包裹签名 ✔
- 其余 16 条同样逐条命中，不再逐列。

全量机械校验 143/143：顶层数组、每条仅 `{fact, ref}` 两键、ref 全部 `path:line` 格式且仓库根相对、文件全部存在、行号全部合法。

## 2. 必须修复（1 项）

**frontmatter `sources: 48` ≠ facts 去重引用文件数（46）。**

- 种子目录 `app/src/test/.../ui/`（16 文件）+ `util/`（32 文件）实地 `find` 复算 = 48 文件，与 md 口径一致。
- facts 去重引用文件 = 46。两个种子文件零 facts：
  - `app/src/test/java/com/ai/assistance/operit/util/ChatUtilsThinkingEdgeTest.kt`（3 个 @Test）
  - `app/src/test/java/com/ai/assistance/operit/util/ChatUtilsThinkingTest.kt`（4 个 @Test）
- 这与本批 ui-floating 首轮 FAIL 的判定口径一致（来源列了文件但零 facts = 覆盖缺口）。
- 修复（二选一，推荐前者）：
  1. 为两个文件各补 ≥1 条事实。备选断言（已实地读过源码，可直接用）：
     - `ChatUtilsThinkingTest.kt:8` — `removeThinkingContent` 删除 `<think>` 块后 trim 首尾空白（`"  <think>x</think> answer  "` → `"answer"`）
     - `ChatUtilsThinkingTest.kt:12` — `extractThinkingContent` 无思考块时返回 `(原文, "")`
     - `ChatUtilsThinkingTest.kt:18` — `<think>` 与 `<thinking>` 两段思考内容用 `\n` 拼接（`"a\nb"`）
     - `ChatUtilsThinkingEdgeTest.kt:8` — `<thinking>` 变体标签同样被 `removeThinkingContent` 删除
     - `ChatUtilsThinkingEdgeTest.kt:13` — 纯思考内容提取后正文部分为 `""`
     - `ChatUtilsThinkingEdgeTest.kt:18` — `<search>` 块被 `removeThinkingContent` 删除
  2. 或把 frontmatter sources 改为 46，并同步修正 md "48 文件全文实读"口径（不推荐，缺口真实存在）。

## 3. quality.json 核查：4/4 真实，severity 合理

- [0] warn `ScreenRouteViewModelStoreOwnerManagerTest.kt:74` — `awaitScopeCancelled` 用 `System.currentTimeMillis()+5000` + `Thread.sleep(10)` 忙等，证据实地命中，warn 合理。
- [1] suggestion `WaifuMessageProcessorTest.kt:107` — `requireNativeStreamSplitter` 缺 so 时 `assumeNoException` 静默跳过，证据命中，suggestion 合理。
- [2] suggestion `StatusCardHtmlDocumentTest.kt:88` — 字体字节数 456052 与 SHA-256 写死为常量，证据命中，suggestion 合理。
- [3] suggestion `ChatMarkupRegexRandomTagTest.kt:9` — 随机标签总长度写死 9/16（fact[87] 佐证），证据命中，suggestion 合理。
- 4 条均为 `{severity, category, file, line, title, detail, evidence, confidence}` 齐全；severity 只用 warn/suggestion，无 high。

## 4. md 结构核查：§9 合规

- 六节齐全：## 概述 / ## AI 速览 / ## 核心机制 / ## 关键符号 / ## 调用链 / ## 来源。
- frontmatter 齐全：title / module=附录 / sources / date / issue=123。
- 禁用词（可能/大概/似乎/应该/也许）0 命中。
- 关键计数实地复算无误：48 文件（16+32）、292 个 @Test（逐文件 `grep -c @Test` 求和 = 292，与 md 一致）、ComposeDslFilePickerRequestTest 4 个 @Test、ComposeDslTextFieldEchoGuardTest 7 个 @Test。
- 无编造：抽查的调用链与符号表引用均有 facts 支撑。

## 5. status.json 核查：合规

- `refs_valid=143` = facts 数 143 ✔
- `status=review-pending` ✔，`issue=123` ✔，`source_commit` 为完整 hash `dbf71916fae9750cfdc9f9a774f5a0fee56633fb` ✔，`source_repo=operit` ✔。

## 6. lint 核查：本页 0/0

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09` 按本条目过滤：`.md/.facts.json/.quality.json/.status.json` **0 硬失败 / 0 警告**。
落在本页名下的报错仅 `appendix-tests-unit-ui-util.lint.md` 自检报告自身（frontmatter 缺字段）——lint.py 会扫描所有 md 的已知工具 quirks，batch-08 同样出现，不阻塞正文。

## 结论

**FAIL** — 必须修复清单：

1. `ChatUtilsThinkingEdgeTest.kt`、`ChatUtilsThinkingTest.kt` 各补 ≥1 条 facts（备选断言见 §2），或改 sources 为 46 并修正口径（推荐前者）。

修复后针对性复验这两条 facts 即可 PASS，无需重审全文。
