# critic 评审报告：appendix-tests-unit-api-core（Issue #121）

- 评审人：独立 critic（subagent 37955f7c）
- 评审时间：2026-10-01
- 评审对象：`review/batch-09/appendix-tests-unit-api-core.{md,facts.json,quality.json,lint.md,status.json}`
- 源码版本：`~/workspace/Operit @ dbf71916fae9750cfdc9f9a774f5a0fee56633fb`

## 结论：PASS

## 1. facts 抽查（30/30 命中，0 错位）

随机抽样 30 条（seed=121），逐条用 sed 实地核对源码窗口，**30 条全部精确命中**，断言与测试代码一致：

| # | ref | 核对结果 |
|---|---|---|
| 11 | EndpointCompleterTest.kt:37 | ✓ `customNonV1Path_isUnchanged`：非 v1 自定义路径原样返回 |
| 27 | StructuredToolCallBridgeHistoryTest.kt:52 | ✓ 乱序 tool 结果按 tool 名配对 |
| 74 | ExpressionNodeTest.kt:61 | ✓ 除零求值 `isInfinite()` |
| 50 | OpenAIResponsesFileInputTest.kt:10 | ✓ `mapsPdfContentToResponsesInputFile` |
| 80 | ConditionEvaluatorBooleanLogicTest.kt:21 | ✓ `nullIsFalsyInBooleanContext` |
| 22 | ChatConfigReadinessTest.kt:76 | ✓ `localProviderDoesNotRequireEndpointOrKey`（MNN） |
| 78 | ConditionEvaluatorTest.kt:51 | ✓ `precedence_andBeforeOr` |
| 66 | PromptTurnConversionTest.kt:8 | ✓ `fromRole_preservesToolName` |
| 83 | McpServerRegistrationTest.kt:37 | ✓ remote runtime 不暴露给 AI |
| 42 | MediaCapabilityProbeTest.kt:9 | ✓ 图片完整 code 匹配（`7k2q`/` 7K2Q. ` 通过，句子中 code 拒绝） |
| 36 | OpenAiChatReasoningEffortTest.kt:97 | ✓ OpenAI chat 模型不收 `reasoning_effort` |
| 23 | ChatConfigReadinessTest.kt:91 | ✓ 注册插件自带配置要求 |
| 54 | OpenAIProviderContentFieldTest.kt:12 | ✓ chat 协议去掉 responses 标记 |
| 7 | ChatMemoryRebuildTimeScopeTest.kt:13 | ✓ `ZoneId.of("Asia/Shanghai")` 写死时区；全目录 grep 无 `Thread.sleep`/`Random(`/墙钟读取，负向断言成立 |
| 55 | CodexModelListParserTest.kt:8 | ✓ `parsesOpenCodeCatalogAndExpandsAllowedModes` |
| 16 | EndpointCompleterTest.kt:158 | ✓ 只有 query 的根 URL，query 保留在补全路径之前 |
| 3 | OrderedToolResultsTest.kt:18 | ✓ `runBlocking` 包裹挂起代码 |
| 60 | ConversationMarkupManagerResultLimitTest.kt:14 | ✓ 每个 tool 结果独立限长、全部保留 |
| 76 | CalculatorTest.kt:50 | ✓ `clearVariables` 后 PI 恢复 `Math.PI`（`assertEquals(Math.PI, pi, 0.001)`） |
| 43 | MediaCapabilityProbeTest.kt:18 | ✓ 视频完整 code 匹配 |
| 57 | OrderedToolResultsTest.kt:18 | ✓ 同名调用逆序完成仍按调用顺序发布 |
| 29 | GeminiThinkingConfigTest.kt:25 | ✓ 启用的 thinking 选项请求 thought 摘要（`includeThoughts`） |
| 19 | EndpointCompleterProviderSpecificTest.kt:9 | ✓ OpenAI 通用 provider 走 Responses 补全 |
| 44 | MediaCapabilityProbeTest.kt:27 | ✓ 音频接受数字与英文词 |
| 77 | ConditionEvaluatorTest.kt:11 | ✓ 空表达式默认 true |
| 86 | ToolPkgManifestSelectionTest.kt:32 | ✓ root hjson 优先于其他 manifest |
| 85 | ToolPkgManagerTest.kt:16 | ✓ 执行上下文不能被不同容器共享 |
| 75 | JsCalculatorTest.kt:55 | ✓ 未定义变量求值抛 `IllegalArgumentException` |
| 20 | ChatConfigReadinessTest.kt:18 | ✓ 中文 API key 被拒绝（`deepSeekWithChineseKey_isRejected`） |
| 59 | ToolExecutionManagerMarkupTest.kt:27 | ✓ `ensureOwnLine` 让 tool 结果独占一行 |

全量机械校验（89/89）：键恰为 `{fact, ref}`、ref 全部为 `app/src/` 开头仓库根相对全路径、文件全部存在、行号全部在文件行数范围内。**无一错位。**

## 2. quality.json 核查（6/6 真实）

| # | file:line | 证据核对 |
|---|---|---|
| 0 | ClaudeOrderedToolHistoryTest.kt:90 | ✓ `getDeclaredMethod("buildSerializedHistory", ...)` 反射写死私有方法签名 |
| 1 | JsRuntimeToolCallTest.kt:11 | ✓ 断言生成 JS bundle 源码字符串 `source.contains("'callToolAsync'")` |
| 2 | ExpressionParserTest.kt:313 | ✓ `@Test(expected = IllegalArgumentException::class)` |
| 3 | ExpressionParserEdgeCaseTest.kt:16 | ✓ 与 ExpressionParserTest 场景重叠（如除零 Infinity 在两处都有） |
| 4 | ToolPkgManagerTest.kt:109 | ✓ 引擎工厂 `availableEngines.removeFirst()` 分发 mock |
| 5 | ConversationMarkupManagerResultLimitTest.kt:12 | ✓ 结果限长仅 1 个用例 |

6 条 severity 均为 suggestion，合理；evidence 与源码一致；file:line 全部存在。只评审真实性，不重做走查。

非阻塞建议：6 条缺 `category` 字段（SCHEMA §8 列为字段之一；`build_quality.py` 不读它，不影响展示）。

## 3. md 结构（§9 合规）

- 六节齐全：概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源 ✓
- AI 速览含核心符号清单（一行一个符号 — 一句话职责）+ 主入口 + 数据流向一句话 ✓
- frontmatter 齐全（title/module/sources/date/issue）✓
- 无禁用词（可能/大概/似乎/应该/也许）✓
- 人话质量：术语首现给解释，调用链叙事 ✓
- 无编造：关键计数实地复核——`api/` 43 文件 + `core/` 29 文件 = 72 文件、`@Test` 705 个，与正文宣称完全一致；来源小节分目录计数复核：llmprovider 37、enhance 3、library 3、chat 7（递归含 hooks/6）、calculator 7（362 个 @Test）、condition 7，全部与源码一致 ✓
- 正文行内引用抽验：`Mockito.mockStatic(AppLogger::class.java).use {}` @ ProviderUsageCancellationTest.kt:175 精确命中 ✓；无模糊指代 ✓

## 4. status.json

- `refs_valid=89` = facts 数 89 ✓
- `status=review-pending` ✓
- `issue=121` ✓
- `source_commit=dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（完整 hash）✓

## 5. lint

`python3 scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`：本页 **4 个真实文件（.md/.facts.json/.quality.json/.status.json）0 硬失败 / 0 警告**。
报告中出现的本页报错全部落在 `appendix-tests-unit-api-core.lint.md` 自检报告自身（frontmatter/来源小节缺失）——这是 lint.py 把自检报告当条目扫描的已知工具 quirks，batch-08 同样存在，不阻塞。

## 必须修复清单

无。
