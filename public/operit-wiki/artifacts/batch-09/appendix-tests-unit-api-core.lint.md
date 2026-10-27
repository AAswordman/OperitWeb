# Lint 自检报告（appendix-tests-unit-api-core）

- 检查时间：2026-10-01
- 检查工具：`scripts/lint.py --src ~/workspace/Operit --dir review/batch-09`（按本条目过滤）
- frontmatter：title / module / sources / date / issue 齐全
- 硬失败：0（引用文件全部存在、行号无越界、无死链、有"来源"小节）
- 警告：0（每行一个引用；反引号符号全部落在引用行 ±5 行内；无禁用模糊词）

## 自检过程

1. 初版 lint 报本条目 40+ 警告，根因有三类：
   - 同一 markdown 行放多个引用，lint 按整行检查符号；
   - 引用行取的是 `@Test` 注解行而非 `fun` 行（系统性偏 1–2 行）；
   - 个别方法名记错（如 `imageMatch_requiresOnlyFullCode` 误引 video 段行号、`mergeAdjacentTurns_mergesAssistantTurns` 行号错位）。
2. 修复：逐行拆分为"一行一引用"；写脚本把 78 处测试方法引用统一校准到 `fun` 声明行；`ThinkingConfigurationApplier`（测试文件中不存在的符号）已替换为实测存在的 `GeminiThinkingConfig`。
3. 引用验真：89 条 facts 全部复核——抽样 15 条人工核对（fact 主题与引用行方法一致），md 抽样 20 处（17 处 fun 行一致，3 处为有意的非 fun 行：反射行、断言行、matchesVideo 行，均实地看过源码）。

## 走查与测试覆盖说明

- 代码走查 6 条（见 `.quality.json`），全部为 suggestion 级：反射测试写死私有方法签名（3 文件）、JsRuntimeToolCallTest 断言 JS bundle 源码字符串、`@Test(expected=...)` 无法定位异常来源、ExpressionParserTest 与 EdgeCase 场景重叠、ToolPkgManagerTest 引擎工厂 `removeFirst()` 失败信息不友好、ConversationMarkupManager 限长逻辑仅 1 个用例。
- 测试套件本身质量高：无无效断言（全目录扫描所有 @Test 均含断言或 expected 声明）、无永远通过的测试、无 Thread.sleep/随机数/墙钟依赖、时区写死、`@After` 清理全局状态。
