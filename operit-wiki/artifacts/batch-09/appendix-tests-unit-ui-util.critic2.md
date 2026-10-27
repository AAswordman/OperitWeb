# appendix-tests-unit-ui-util 复验报告（critic2）

- 条目：appendix-tests-unit-ui-util（Issue #123），Day 7 / batch-09
- 源码：~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb
- 复验日期：2026-10-01
- 结论：**PASS**

## 1. 新增 6 条 facts 逐条实地核对（sed，±5 行口径）

全部精确命中：

| # | ref | 源码窗口实测 | 结论 |
|---|---|---|---|
| 143 | ChatUtilsThinkingTest.kt:8 | :8 = `removeThinkingContent_trimsWhitespaceAroundRemovedBlocks`，assert `"answer"`（去掉 `<think>` 块后 trim） | 命中 |
| 144 | ChatUtilsThinkingTest.kt:12 | :12 = `extractThinkingContent_returnsEmptyThinkingWhenAbsent`，返回 `("answer", "")` | 命中 |
| 145 | ChatUtilsThinkingTest.kt:18 | :18 = `extractThinkingContent_trimsEachThinkingSegment`，:21 assert `"a\nb"`（两段思考 `\n` 拼接、每段 trim） | 命中 |
| 146 | ChatUtilsThinkingEdgeTest.kt:8 | :8 = `removeThinkingContent_handlesThinkingTagVariant`，`<thinking>` 变体同样被删除 | 命中 |
| 147 | ChatUtilsThinkingEdgeTest.kt:13 | :13 = `extractThinkingContent_handlesNoSearchTag`，正文 `""`、思考 `"x"` | 命中 |
| 148 | ChatUtilsThinkingEdgeTest.kt:18 | :18 = `removeThinkingContent_handlesSearchOnlyContent`，`<search>` 块被删除 | 命中 |

## 2. 随机抽查 5 条其他 facts（确认文件未改坏）

| # | ref | 源码窗口实测 | 结论 |
|---|---|---|---|
| 0 | ComposeDslFilePickerRequestTest.kt:11 | 类声明行，文件内 @Test 方法覆盖请求解析 | 命中 |
| 50 | MarkdownSyntaxHighlightingTest.kt:123 | :124 `range.end <= source.length`、:125–126 有序断言，均在 ±5 内 | 命中 |
| 100 | ChatUtilsExtractJsonEdgeTest.kt:17 | `extractJson_handlesMarkdownFenceWithoutLanguage`，无语言围栏精确命中 | 命中 |
| 120 | StreamingJsonXmlConverterObjectTest.kt:11 | 嵌套引号转 `&quot;` 精确命中 | 命中 |
| 140 | HotStreamTest.kt:73 | `propagateCompletionCause = false` 在 :69，±5 内 | 命中 |

## 3. 一致性

- facts 总数 149 = status.json refs_valid 149
- 去重引用文件 48 = frontmatter sources 48
- 首轮 FAIL 的 sources 缺口已闭合（ChatUtilsThinkingTest.kt、ChatUtilsThinkingEdgeTest.kt 现各有 3 条 facts）

## 4. 结论

**PASS** —— 首轮必须修复项已精确修复，无残留问题，无需再审。
