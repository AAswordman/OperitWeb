# Critic 复核报告：data-room-db（Room 数据库与 DAO）

- 复核对象：`review/batch-04/data-room-db.*`
- 源码基准：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse HEAD` 一致）
- 复核结论：**退回修正（26 处引用行号错位，无事实性错误、无虚构）**

## facts：99 条中 73 条通过 / 26 条退回

73 条通过：引用文件存在、行号有效、断言的关键符号全部落在 ±5 窗口内；抽查 [0]/[15]/[31]/[36]/[66]/[98] 语义与源码一致；20 个 Migration 注册链与 `addMigrations` 实测一致（MIGRATION_1_2…MIGRATION_20_21 共 20 个，无遗漏）。

26 条退回——**断言本身全部为真，但关键符号落在所引行号 ±5 窗口之外**（writer 习惯引用 SQL/方法体内部行而非符号声明行）。对照表：

**迁移名错位（11 条，ref → 迁移声明实际行）：**
| # | 现 ref | 迁移符号实际行 | 偏差 |
|---|---|---|---|
| 12 | AppDatabase.kt:61 | :55（MIGRATION_1_2） | 6 行 |
| 14 | AppDatabase.kt:89 | :55（MIGRATION_1_2） | 34 行 |
| 17 | AppDatabase.kt:128 | :120（MIGRATION_12_13） | 8 行 |
| 18 | AppDatabase.kt:136 | :120（MIGRATION_12_13） | 16 行 |
| 19 | AppDatabase.kt:144 | :120（MIGRATION_12_13） | 24 行 |
| 22 | AppDatabase.kt:165 | :157（MIGRATION_14_15） | 8 行 |
| 28 | AppDatabase.kt:226 | :220（MIGRATION_18_19） | 6 行 |
| 32 | AppDatabase.kt:261 | :240（MIGRATION_20_21） | 21 行 |
| 33 | AppDatabase.kt:270 | :240（MIGRATION_20_21） | 30 行 |
| 34 | AppDatabase.kt:298 | :240（MIGRATION_20_21） | 58 行 |
| 35 | AppDatabase.kt:324 | :240（MIGRATION_20_21） | 84 行 |

**DAO 方法名错位（15 条，ref → 方法声明实际行）：**
| # | 现 ref | 方法实际行 | 偏差 | 备注 |
|---|---|---|---|---|
| 46 | ObjectBox.kt:28 | :22（buildStore） | 6 行 | 窗口内有 builder 逻辑，缺函数名 |
| 57 | ChatDao.kt:72 | :96（updateChatLocked） | 24 行 | :72 实际是 updateChatGroup 的 @Query，张冠李戴 |
| 58 | ChatDao.kt:75 | :100（updateChatPinned） | 25 行 | |
| 59 | ChatDao.kt:99 | :120（deleteChatsInGroup） | 21 行 | |
| 60 | ChatDao.kt:117 | :144（getBranchesByParentId） | 27 行 | |
| 61 | ChatDao.kt:126 | :152（getMainChats） | 26 行 | |
| 62 | ChatDao.kt:151 | :168（getChatsByCharacterCardOrNull） | 17 行 | |
| 63 | ChatDao.kt:167 | :176（deleteUnlockedChatsByCharacterCardName） | 9 行 | |
| 64 | ChatDao.kt:252 | :267（getCharacterCardChatStats） | 15 行 | |
| 65 | ChatDao.kt:270 | :286（getCharacterGroupChatStats） | 16 行 | |
| 72 | ChatContentDao.kt:423 | 消息串在 :430 | 7 行 | 另见下：`IllegalStateException` 符号在源码中不存在，实际是 `checkNotNull` 抛出；重锚到 :428/:430 并改述为 checkNotNull |
| 73 | ChatContentDao.kt:384 | :372（getVariantsForMessages） | 12 行 | |
| 76 | MessageDao.kt:52 | :38/:42（HIDDEN_PLACEHOLDER） | 10–14 行 | 方法名在窗内，证据 WHEN 子句在窗外；需拆分或重锚 |
| 93 | TokenUsageDao.kt:63 | :53（getStatsModel） | 10 行 | |
| 95 | TokenUsageDao.kt:83 | :89（deleteEmptyStatsModels） | 6 行 | |

次要（不阻塞，可顺手）：[88] `TokenUsageModelAggregateRow` 类声明在 :10，ref :26 只覆盖到 `providerModel` 属性；建议拆分或去掉类名前缀。

修正要求：逐条重锚到上表实际行，修正后用 sed 复验每个 ref 的 ±5 窗口完全支撑断言；正文 md 里继承了同样错位的 4 处引用（`deleteChatsInGroup`:99、`getMainChats`:126、`getBranchesByParentId`:117、`getVariantsForMessages`:384）同步修正。修完重跑 lint，无需二次全文复核。

## quality：8/8 通过

- 8 条 evidence 全部与源码逐字一致（脚本 diff 验证），且落在所标行号 ±5 窗口内。
- [0] 空 catch：detail 声称的 10 处行号（101/114/125/129/133/137/141/145/391/435）已用 grep 逐一核实命中。
- [1] insertChat REPLACE 级联清空：`@Insert(REPLACE)`（ChatDao.kt:33）、`FOREIGN KEY…ON DELETE CASCADE`（AppDatabase.kt:83 messages、:180 message_variants）均核实；"Room 默认启用外键约束"的框架前提与 Room 官方默认行为一致（第三方工程文档亦称其 pragma 选择 "mirrors Room's default"）。
- severity/confidence 合理（warning 3：空 catch、REPLACE 级联、checkNotNull 崩溃；suggestion 5：LIKE 全表扫描、exportSchema、缺事务、字符统计、sender 硬编码）。

## 正文：通过（2 处顺手修）

- §9 双受众结构完整：概述 / AI 速览（核心符号+主入口+数据流向一句话）/ 核心机制 / 关键符号 / 调用链（输入→处理→输出编号）/ 来源；术语首现均有解释（Migration、CursorWindow、Flow、BoxStore）；符号名英文原文；frontmatter 齐全。
- 顺手修 1：`注意：部分老迁移…失败会静默通过（见代码走查）。`——"（见代码走查）"违反 SCHEMA §8（走查不进正文），删掉括号。
- 顺手修 2：正文 4 处引用与 facts 同样错位（见上表），同步修正行号。

## status.json：正确（1 处全批现象备注）

- id=data-room-db、issue=60、status=review-pending、source_commit=dbf71916… 全对。
- 备注：`source_repo` 本页为 `"operit"`，全批 22 页同为小写、仅 2 页为 `"Operit"`，大小写不统一是全批现象，不单独退回，请 parent 日终统一。

## lint：0 硬失败 / 0 警告（修完引用后需重跑确认）

---

## 复检（2026-10-01T13:58 CST，修错后复验）——**通过**

复检范围：只复检退回项，未重走全文。逐条用 sed 实测源码窗口（Operit @ dbf71916，已核对 HEAD 一致）。

### 1. 5 处偏离 critic 建议的最终结论——修错员 5 处全对

| # | critic 建议 | 修错员实际 | 亲验结论 |
|---|---|---|---|
| [14] | :55 | :89（断言改述"该迁移…"） | **修错员对**。:55 的 ±5 窗口（50–60）只有 MIGRATION_1_2 声明，看不到 89 行的索引 SQL；任何单行窗口都无法同时覆盖声明（55）与证据（89，相距 34 行）。修错员用 :89（窗口 84–94 完整覆盖 `CREATE INDEX … index_messages_chatId … messages (chatId)`）+"该迁移"指代（上文 [12] 已确立 MIGRATION_1_2），是 ±5 铁律下唯一合规写法。 |
| [17] | :120 | :124 | **修错员对**。:120 窗口（115–125）盖不住 128 行的 outputTokens；:124 窗口（119–129）同时覆盖 MIGRATION_12_13（120）、inputTokens（124）、outputTokens（128），全支撑。 |
| [22] | :157 | :160 | **修错员对**。:157 窗口（152–162）盖不住 165 行的 `CREATE TABLE … message_variants`；:160 窗口（155–165）边界恰好覆盖（160+5=165），声明+建表全在窗内。 |
| [28] | :220 | :224 | **修错员对**。:220 窗口（215–225）盖不住 227 行的 message_variants.completedAt；:224 窗口（219–229）同时覆盖 MIGRATION_18_19（220）、messages.completedAt（224）、message_variants.completedAt（227）。 |
| [46] | ObjectBox.kt:22 | ObjectBox.kt:25（并拆出 [46]:24 讲 dbName） | **修错员对（且更优）**。:22 窗口虽也可用，但修错员把原复合事实拆成两条原子事实：[46]:24（窗口 19–29 覆盖 `dbName = if (profileId == "default") "objectbox" else "objectbox_$profileId"`）、[47]:25（窗口 20–30 覆盖 MyObjectBox.builder/.androidContext/.directory 链），各自窗口完全支撑，符合原子化铁律。 |

### 2. 抽查改动 fact（31 条，超任务要求的 15 条）

全部通过，±5 窗口完全支撑断言，无越界：
- 迁移类：[12]:55（MIGRATION_1_2+创建 chats 表注释）、[18]:134（cachedInputTokens 132/sentAt 136）、[19]:142（outputDurationMs 140/waitDurationMs 144）、[32]:263（两个索引 261–262/265–266+Room 校验注释）、[33]:270（CREATE TABLE token_usage_records）、[34]:298（CREATE TABLE token_stats_models）、[35]:309（PRIMARY KEY(configId, provider, model)）、[36]:324（INSERT INTO token_usage_records + FROM messages + WHERE sender='ai' 329）。
- DAO 类：[58]:96（updateChatLocked）、[59]:100（updateChatPinned）、[60]:120（deleteChatsInGroup，locked=0 在 119）、[61]:144（getBranchesByParentId）、[62]:152（getMainChats，IS NULL 在 151）、[63]:168（getChatsByCharacterCardOrNull）、[64]:176（deleteUnlockedChatsByCharacterCardName，返回 Int）、[65]:267（getCharacterCardChatStats）、[66]:278（角色群组聚合 SQL：COUNT/GROUP BY characterGroupId/messageCount；方法名无反引号，仅作标识，实质断言"统计口径"被窗口完全支撑，接受）、[67]:286（返回 Flow<List<CharacterGroupChatStats>>）、[75]:372（getVariantsForMessages 声明+messageTimestamps 参数+空集早返）、[78]:52（getLocatorPreviewsForChat，WHERE chatId 在 48）、[79]:40（HIDDEN_PLACEHOLDER 分支：空预览 38/0 长度 42）、[92]:26（providerModel 派生属性 "$provider:$model" 在 27）、[97]:53（getStatsModel 三元组）、[99]:89（deleteEmptyStatsModels）。

### 3. [72] 改述准确

`IllegalStateException` 在 ChatContentDao.kt 全文件无命中（grep 确认），源码实际是 :423 `checkNotNull(...)` + :430 消息串 `"Message disappeared while reading content: messageId=..."`。改述"分块读取时 checkNotNull 校验消息块非空，缺失则抛异常"，ref :427（窗口 422–432 同时覆盖调用与消息串），准确。

### 4. 正文 4 处引用同步 + 删除"（见代码走查）"到位

- 正文引用已改为 `:120`（deleteChatsInGroup）、`:152`（getMainChats）、`:144`（getBranchesByParentId）、`:372`（getVariantsForMessages）。
- 全文 grep "代码走查" 0 命中，"（见代码走查）"已删净。

### 5. lint 与文件状态

- 单页隔离跑 `scripts/lint.py`：**0 硬失败 / 0 警告**（注：直接对 batch-04 整目录跑会把 `.lint.md`/`.critic.md` 误当条目页出伪警告，是 lint.py 的已知 quirk，非本页问题）。
- facts 103 条（99→103，4 处拆分）、quality 8 条、`.status.json` 未动（review-pending/issue 60/source_repo operit/source_commit dbf71916）。

**未通过条目：无。本页已达收货标准，可进入发布队列。**
