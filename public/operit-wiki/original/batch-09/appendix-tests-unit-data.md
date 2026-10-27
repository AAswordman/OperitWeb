---
title: 单元测试·data（测试覆盖附录）
module: 附录
sources: 38
date: 2026-10-01
issue: 122
---

# appendix-tests-unit-data（单元测试·data）

> 种子：`app/src/test/java/com/ai/assistance/operit/data/`（36 文件、35 个测试类、332 个 `@Test`、约 4,188 行）@ `dbf71916`
>
> 说明：test 树下没有独立的 `db/`、`repo/` 目录，数据库与仓库相关测试分别落在 `data/db/`（Room 迁移）、`data/repository/`（仓库持久化）、`data/recovery/`（数据库健康）三个子目录，本页一并覆盖。

## 概述

这是 data 层（模型、API 客户端、偏好设置、统计、数据库、备份、恢复、MCP 配置导入）的 JVM 单元测试全集，全部 332 个测试跑在 `app/src/test`（JUnit4 单元测试源集），不走 Android 插桩。

Android 框架类只出现两处：一处用 `Mockito.mock` 伪造 `Context`（`app/src/test/java/com/ai/assistance/operit/data/preferences/ModelConfigSummariesFlowTest.kt:48`）。

另一处用 JDK 动态代理伪造 `SupportSQLiteDatabase`（`app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt:27`）。

测试风格是三类断言：model 包 17 个文件断言 data class 默认值与 copy；`MessageEntity`、`MessageVariantEntity`、`ChatEntity`、`ChatMessage` 之间断言双向转换不丢字段；stats 包的 `ProviderUsageNormalizer` 断言各厂商 usage 的"未知→null、确认 0→0"归一化契约。

## AI 速览

- **核心符号清单**：CodexOAuthTokenResponse、CodexUsageClient、isSupportedSnapshotPackageName、AppDatabase.MIGRATION_20_21、McpConfigImportParser、AITool、ApiKeyFormatValidator、ApiKeyInfo、ChatEntity、ChatHistory、ChatMessage、ChatMessageTimestampAllocator、ChatMessageDisplayMode、FunctionType、MemoryAutoSaveCandidate、MessageEntity、MessageVariantEntity、BillingMode、ModelParameter、PromptTag、ProviderIdentityUtils、remapDeletedConfigReferences、ModelConfigManager、ThemeScopeMigrationPolicy、ThemeTargetOperationCoordinator、RoomDatabaseHealthManager、decodePersistedAvatarConfigs、JvmSupportSQLiteDatabase、ProviderUsageNormalizer、ReleasedProviderModelKeyDecoder、TokenActivityAggregator、TokenCostCalculator、formatTokenCount、tokenStatsPriceScopeForConfigId、TokenStatsTimeRanges。
- **主入口**：JUnit4 运行器扫描 `app/src/test` 下的 `@Test` 方法；协程测试用 `runTest` / `runBlocking` 驱动。
- **数据流向一句话**：构造被测对象（或伪造 DataStore/数据库）→ 调用被测函数 → `org.junit.Assert` 断言返回值、异常或发射序列。

## 核心机制

### 1. 测试依赖与桩的选择

JUnit 4.13.2 由 `testImplementation` 引入（`app/build.gradle.kts:759`）。

JVM 测试不能用 Android 自带的 org.json 桩（其方法抛 Stub 异常），所以单独引入真实 `org.json:json:20240303`（`app/build.gradle.kts:768`）。

ProviderUsageNormalizerTest 解析 `JSONObject` 就靠这个真实依赖（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:30`）。

协程测试用 `kotlinx-coroutines-test`：`transitionsAreSerialized` 用 `runTest` 驱动（`app/src/test/java/com/ai/assistance/operit/data/preferences/ThemeTargetOperationCoordinatorTest.kt:15`）。

`advanceUntilIdle` 推进虚拟时间（`app/src/test/java/com/ai/assistance/operit/data/preferences/ThemeTargetOperationCoordinatorTest.kt:41`）。

断言两个 `runTransition` 串行化（`app/src/test/java/com/ai/assistance/operit/data/preferences/ThemeTargetOperationCoordinatorTest.kt:22`）。

需要 Android `Context` 的地方用 `Mockito.mock`，不启动 Robolectric（`app/src/test/java/com/ai/assistance/operit/data/preferences/ModelConfigSummariesFlowTest.kt:48`）。

### 2. 数据库迁移：只录 SQL 不跑库

`migration20To21CreatesMessageIndexesExpectedByRoom` 直接驱动生产迁移对象 `AppDatabase.MIGRATION_20_21` 的 `migrate`（`app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt:14`）。

断言迁移执行了两条 `CREATE INDEX`：`index_messages_chatId` 与 `index_messages_chatId_timestamp`（`app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt:19`）。

传入的 `SupportSQLiteDatabase` 由 `recordingDatabase` 用 JDK 动态代理伪造（`app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt:27`）。

代理只记录单参数 `execSQL` 调用（`app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt:31`）。

其他方法调用抛 `UnsupportedOperationException`（`app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt:40`）。

`JvmSupportSQLiteDatabase` 是另一个更重的测试替身：纯 JVM 的最小 `SupportSQLiteDatabase` 实现（`app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:29`）。

它基于 sqlite-jdbc，用于直接驱动生产 `Migration` 的 `migrate` 变体（`app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:19`）。

它只实现迁移路径用到的 `execSQL`（`app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:31`）。

其余方法经 `unsupported` 抛 `UnsupportedOperationException`（`app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:182`）。

`open` 用 `jdbc:sqlite:` 连接字符串打开数据库（`app/src/test/java/com/ai/assistance/operit/data/stats/JvmSupportSQLiteDatabase.kt:188`）。

### 3. 归一化语义：未知与零的区分

ProviderUsageNormalizerTest 的类注释定下契约：未知（缺失字段）→ `null`；确认 0 → 0（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:14`）。

OpenAI chat 响应携带 `cached_tokens`（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:33`）。

拆分后 `uncachedInputTokens`=800、`cachedInputTokens`=200（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:39`）。

缺 details 时 `uncachedInputTokens` 与 `cachedInputTokens` 均为 `assertNull`，总量照收（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:89`）。

Anthropic 的 `input_tokens` 不含缓存分量（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:16`）。

缓存创建独立计费（`cacheWriteSeparateBilling`，`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:183`）。

Gemini 的 `candidatesTokenCount` 不含 `thoughtsTokenCount`，思考 token 按输出计费（`app/src/test/java/com/ai/assistance/operit/data/stats/ProviderUsageNormalizerTest.kt:238`）。

### 4. 配置与主题：纯函数 + 伪造 DataStore

`remapDeletedConfigReferences` 是纯函数：引用已删配置的功能重映射到 `default`（`app/src/test/java/com/ai/assistance/operit/data/preferences/FunctionalConfigMappingRepairTest.kt:16`）。

ModelConfigSummariesFlowTest 伪造整个 `DataStore`：私有类 `TestPreferencesDataStore` 用 `MutableStateFlow` 承接读写（`app/src/test/java/com/ai/assistance/operit/data/preferences/ModelConfigSummariesFlowTest.kt:74`）。

创建/改名后 `configSummariesFlow` 按序发射 3 次（`app/src/test/java/com/ai/assistance/operit/data/preferences/ModelConfigSummariesFlowTest.kt:52`）。

`ThemeScopeMigrationPolicy` 的 `shouldCopyLegacyThemeToDefaultCharacter` 覆盖"迁移过一次就不再跑"的幂等条件（`app/src/test/java/com/ai/assistance/operit/data/preferences/ThemeScopeMigrationPolicyTest.kt:65`）。

### 5. 时间范围与 DST

TokenStatsTimeRangeTest 覆盖日历桶的 DST 边界。

`granularityFor` 按时长选择粒度：48 小时以内 `TEN_MINUTES`/`HOURLY`（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:42`）。

49 小时及以上 `DAILY`（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:48`）。

纽约春令切换日的小时桶只有 23 个（`bucketStarts`，`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:69`），秋令回拨日 25 个、本地 01:00 出现两次（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:94`）。

桶边界是半开语义：范围终点 `endMs` 本身不属于任何桶，`bucketIndexOf` 返回 `assertNull`（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsTimeRangeTest.kt:147`）。

## 关键符号

- CodexOAuthTokenResponse 的 `requireComplete`：四字段齐全返回自身（`app/src/test/java/com/ai/assistance/operit/data/api/CodexOAuthTokenResponseTest.kt:16`）。
- `refreshToken` 为 null 时抛 `IllegalArgumentException`（`app/src/test/java/com/ai/assistance/operit/data/api/CodexOAuthTokenResponseTest.kt:20`）。
- `CodexUsageClient` 的 `parseUsage`：Codex 用量 JSON 解析（`app/src/test/java/com/ai/assistance/operit/data/api/CodexUsageClientTest.kt:18`）。
- 主窗口 604800s/used 52% 时 `fiveHourWindow` 为空（`app/src/test/java/com/ai/assistance/operit/data/api/CodexUsageClientTest.kt:62`）。
- `isSupportedSnapshotPackageName`：快照包名前缀白名单（`app/src/test/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManagerTest.kt:11`）。
- `McpConfigImportParser` 的 `parse`：MCP 配置导入解析（`app/src/test/java/com/ai/assistance/operit/data/mcp/McpConfigImportParserTest.kt:36`）。
- 远程条目的 `connectionType` 为 `httpStream`（`app/src/test/java/com/ai/assistance/operit/data/mcp/McpConfigImportParserTest.kt:47`）。
- `ApiKeyFormatValidator` 的 `isValid`：拒绝非 ASCII 与空白字符（`app/src/test/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidatorTest.kt:15`）。
- `hasUsableKey` 判定密钥池可用性（`app/src/test/java/com/ai/assistance/operit/data/model/ApiKeyFormatValidatorTest.kt:45`）。
- 聊天实体的 `displayOrder` 默认等于 `-createdAt`（`app/src/test/java/com/ai/assistance/operit/data/model/ChatEntityTest.kt:64`）。
- `ChatMessageTimestampAllocator` 的 `next`：全局单调时间戳（`app/src/test/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocatorTest.kt:15`）。
- `toChatMessage`：未知 displayMode 回退 `NORMAL`（`app/src/test/java/com/ai/assistance/operit/data/model/MessageEntityTest.kt:115`）。
- `applyTo` 把变体写回 `ChatMessage`（`app/src/test/java/com/ai/assistance/operit/data/model/MessageVariantEntityTest.kt:69`）。
- `BillingMode` 的 `fromString`：非法输入默认 `TOKEN`（`app/src/test/java/com/ai/assistance/operit/data/model/MiscModelTest.kt:21`）。
- `ParameterValueType` 恰好 5 个值（`app/src/test/java/com/ai/assistance/operit/data/model/ModelParameterTest.kt:109`）。
- `TagType` 恰好 4 个值（`app/src/test/java/com/ai/assistance/operit/data/model/PromptTagTest.kt:62`）。
- `hasIndependentCacheWriteBilling`：缓存写入独立计费判定（`app/src/test/java/com/ai/assistance/operit/data/model/ProviderIdentityUtilsTest.kt:31`）。
- `RoomDatabaseHealthManager` 的 `isIndexOnlyQuickCheckFailure`：索引损坏可修复判定（`app/src/test/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManagerTest.kt:11`）。
- `decodePersistedAvatarConfigs`：头像配置解码容错（`app/src/test/java/com/ai/assistance/operit/data/repository/AvatarConfigPersistenceTest.kt:40`）。
- `TokenCostCalculator` 的 `currentCost`：按拆分价格计费（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenCostCalculatorTest.kt:12`）。
- `saturatedAdd` 溢出钳制（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenCostCalculatorTest.kt:188`）。
- `formatTokenCount`：token 数紧凑格式化（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsDisplayUnitTest.kt:12`）。
- `tokenStatsPriceScopeForConfigId`：定价作用域判定（`app/src/test/java/com/ai/assistance/operit/data/stats/TokenStatsPriceScopeTest.kt:13`）。
- `ReleasedProviderModelKeyDecoder` 的 `decodeOrNull`：供应商模型键解码（`app/src/test/java/com/ai/assistance/operit/data/stats/ReleasedProviderModelKeyDecoderTest.kt:16`）。

## 调用链

1. **输入**：JUnit4 运行器发现 `app/src/test` 下 35 个测试类、332 个 `@Test` 方法；协程用例经 `runTest` / `runBlocking` 进入协程作用域。
2. **处理**：被测对象直接构造（数据类/解析器/归一化器）；需要外部依赖时用三类替身——JDK 动态代理（`AppDatabaseMigrationTest.recordingDatabase`）、私有 `DataStore` 实现（`TestPreferencesDataStore`）、`Mockito.mock(Context)`；数据库迁移测试用 `JvmSupportSQLiteDatabase` 真跑 SQLite。
3. **输出**：`org.junit.Assert` 断言（`assertEquals`/`assertTrue`/`assertNull`/`expected` 异常）；`ModelConfigSummariesFlowTest` 用 `Channel` 收集 `Flow` 发射序列后断言。

## 来源

- `app/src/test/java/com/ai/assistance/operit/data/api/CodexOAuthTokenResponseTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/api/CodexUsageClientTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManagerTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/db/AppDatabaseMigrationTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/mcp/McpConfigImportParserTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/model/`（17 文件：AIToolTest、ApiKeyFormatValidatorTest、ApiKeyInfoTest、AttachmentInfoTest、ChatEntityTest、ChatHistoryTest、ChatMessageDisplayModeTest、ChatMessageTest、ChatMessageTimestampAllocatorTest、FunctionTypeTest、MemoryAutoSaveCandidateTest、MessageEntityTest、MessageVariantEntityTest、MiscModelTest、ModelParameterTest、PromptTagTest、ProviderIdentityUtilsTest）
- `app/src/test/java/com/ai/assistance/operit/data/preferences/`（4 文件：FunctionalConfigMappingRepairTest、ModelConfigSummariesFlowTest、ThemeScopeMigrationPolicyTest、ThemeTargetOperationCoordinatorTest）
- `app/src/test/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManagerTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/repository/AvatarConfigPersistenceTest.kt`
- `app/src/test/java/com/ai/assistance/operit/data/stats/`（8 文件：JvmSupportSQLiteDatabase、ProviderUsageNormalizerTest、ReleasedProviderModelKeyDecoderTest、TokenActivityAggregatorTest、TokenCostCalculatorTest、TokenStatsDisplayUnitTest、TokenStatsPriceScopeTest、TokenStatsTimeRangeTest）
- `app/build.gradle.kts`（测试依赖声明）、`gradle/libs.versions.toml`（JUnit 版本号）
