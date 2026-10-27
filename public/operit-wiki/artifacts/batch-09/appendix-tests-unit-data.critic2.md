# 复验报告 critic2 — appendix-tests-unit-data（Issue #122）

针对首轮 critic FAIL 的 6 条逐条实地复验（sed/grep 源码），另随机抽查 5 条。

## 1. 6 条修复逐条核对（全部命中）

- **fact[103]** ✅ 命中。`JvmCursor` 类声明在 `app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:194`（`private class JvmCursor(`）；`getColumnIndex` 在 `:239-240`，源码为 `columnIndexByName[columnName.lowercase()] ?: -1`，确实按小写做大小写不敏感匹配。断言原文与 fact 文字一致。
- **fact[143]** ✅ 命中。`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:131`：`fun \`bucket boundaries partition events exactly once\`() {`。正文内嵌行号已改 :114→:131，精确。
- **fact[108]** ✅ 命中。`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:136`：`fun \`openai responses keeps reasoning tokens separately and marks included\`() {`。正文内嵌已改 :133→:136，精确。
- **fact[111]** ✅ 命中。`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:217`：`fun \`gemini normalizes usage metadata with cached content and thoughts\`() {`。正文内嵌已改 :213→:217，精确。
- **fact[139]** ✅ 命中。`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:40`：`fun \`granularity is chosen by range duration\`() {`。正文内嵌已改 :36→:40，精确。
- **fact[142]** ✅ 命中。`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:91`：`fun \`hourly buckets across fall back produce both repeated hour buckets\`() {`。正文内嵌已改 :88→:91，精确。

## 2. 随机抽查 5 条（全部命中）

- **fact[28]** ✅ `AIToolTest.kt:37`：`create tool invocation`，`responseLocation = 0..10`（:39）与 fact 一致。
- **fact[6]** ✅ `CodexOAuthTokenResponseTest.kt:8`：四字段齐全时 `assertSame(response, response.requireComplete())`（:16）与 fact 一致。
- **fact[70]** ✅ `MiscModelTest.kt:106`：`embedding rebuild progress fraction`，`EmbeddingRebuildProgress(total = 10, processed = 5)`，`assertEquals(0.5f, progress.fraction)`，与 fact 一致。
- **fact[62]** ✅ `MessageEntityTest.kt:110`：`toChatMessage handles unknown display mode`，`displayMode = "UNKNOWN_MODE"` → `assertEquals(ChatMessageDisplayMode.NORMAL, msg.displayMode)`，与 fact 一致。
- **fact[57]** ✅ `MemoryAutoSaveCandidateTest.kt:85`：`status constants are defined`，三常量 `"pending"/"processing"/"failed"`（:86-88）与 fact 一致。

## 3. 计数校验

- facts 数组：144 条
- `appendix-tests-unit-data.status.json`：`refs_valid: 144`
- 两者一致，无遗漏/多余引用。

## 结论

**PASS** — 6 条修复全部精确命中（0 行偏差，非 ±5 行容限），随机抽查 5 条无漂移，计数一致。首轮 critic FAIL 项已全部闭环，无文件被改坏。
