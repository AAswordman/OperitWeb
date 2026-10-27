---
title: Room 表字段规范与数据救援
module: 附录
sources: 11
date: 2026-10-07
---

# appendix-room-field-spec（Room 表字段规范与数据救援）

> 种子：`data/model/` 下 5 个 Entity、`ui/recovery/`（Activity + ViewModel）、`data/recovery/RoomDatabaseHealthManager.kt`、`res/xml/shortcuts.xml`、AndroidManifest @ `dbf71916`

> 一句话：数据库坏了别急着删整表——这页给你两样东西：① 数据救援界面的入口和能力（桌面长按图标进）；② 5 张 Room 表的逐字段规范，照着写 `UPDATE` 做原子修复。

## 概述

人话：Operit 的聊天、消息、token 账本存在 Room（SQLite）里。库坏了（升级中断、写坏某列、脏枚举值）最粗暴的修法是删整表，但代价是丢数据。正确姿势是：长按桌面图标进**数据救援**界面，先健康检查定位，再用 SQL 控制台做字段级原子修改。这页就是那份"修之前先看"的字段手册——每张表有哪些列、什么类型、什么约束，写 `UPDATE` 时直接照抄。

跟其他页的关系：`data-room-db`（Room 数据库与 DAO）讲库级别（版本链、DAO、迁移）；**本页讲表级别**（逐字段）+ 救援界面操作。

## AI 速览

- **5 张表**：`chats`、`messages`、`message_variants`、`token_usage_records`、`token_stats_models`（字段表见下）。
- **救援入口**：桌面长按应用图标 → 快捷方式"数据救援" → `DataRecoveryActivity`（独立 `:repair` 进程，action `com.ai.assistance.operit.action.OPEN_DATA_RECOVERY`）。
- **SQL 控制台规则**：`SELECT`/`WITH`/`PRAGMA` 开头走查询展示；其他语句直接 `execSQL`（`UPDATE`/`DELETE` 可用），返回影响行数。
- **健康检查/修复**：`RoomDatabaseHealthManager.inspect()`（quick_check、user_version、外键违例计数）；`repair()`（重建索引、跑 Room 迁移链，损坏先备份）。
- **类型映射**：Kotlin `String`→`TEXT`、`Long`/`Int`→`INTEGER`、`Boolean`→`INTEGER`(0/1)、`Double`→`REAL`；`String?` 列可空。

## 核心机制

### 数据救援界面：入口与能力

入口是 Android App Shortcut（桌面长按图标弹出）：`shortcutId="data_recovery"`，label"数据救援"，intent action 为 `com.ai.assistance.operit.action.OPEN_DATA_RECOVERY`，目标 `DataRecoveryActivity`。
`app/src/main/res/xml/shortcuts.xml:26`
`app/src/main/res/values/strings.xml:1504`
`app/src/main/AndroidManifest.xml:292`

`DataRecoveryActivity` 在 Manifest 里 `exported=true`，跑在独立 `:repair` 进程——主进程的库被锁死时也能进去修。
`app/src/main/AndroidManifest.xml:286`
`app/src/main/AndroidManifest.xml:289`

`DataRecoveryViewModel` 提供的四组能力：
- `runSql()`：SQL 控制台。`sanitizeSql` 只做 trim + 去掉尾分号；`isQueryStatement` 判定 `SELECT`/`WITH`/`PRAGMA` 开头走查询结果展示，其他一律 `writableDatabase().execSQL(sql)` 执行并返回 `queryChanges()` 影响行数。**`UPDATE`/`DELETE`/`INSERT` 都直接放行**，这是原子修改的入口。
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:53`
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:356`
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:361`
- `exportRawSnapshot()` / `restoreRawSnapshot(uri)`：原始快照导出与恢复。**动手改字段前先导出一份**。
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:107`
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:137`
- `inspectStorage()` / `repairStorage()`：存储检查与修复，底层走 `RoomDatabaseHealthManager`。
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:165`
  `app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt:201`

### 健康检查与自动修复

`RoomDatabaseHealthManager.inspect()` 返回检查报告：`PRAGMA quick_check`、`readUserVersion`（期望 21）、`countForeignKeyViolations`（`foreign_key_check` 违例计数）。
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:86`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:524`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:534`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:541`

`repair()` 的修复顺序：先 `preserveDatabaseFiles` 把损坏库文件备份，再 `rebuildIndexes`（`REINDEX`），再 `runRoomMigrations` 跑完整 Room 迁移链。`onCorruption` 回调兜底。
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:93`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:564`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:581`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:590`
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:681`

### 表字段规范

#### chats（`ChatEntity`）

`app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:10`

| 列 | SQLite 类型 | 约束/默认值 | 说明 |
|---|---|---|---|
| `id` | TEXT | PK，默认随机 UUID | `app/.../ChatEntity.kt:12` |
| `title` | TEXT | NOT NULL | |
| `createdAt` | INTEGER | 默认当前毫秒 | |
| `updatedAt` | INTEGER | 默认当前毫秒 | |
| `inputTokens` | INTEGER | 默认 0 | |
| `outputTokens` | INTEGER | 默认 0 | |
| `currentWindowSize` | INTEGER | 默认 0 | |
| `group` | TEXT | 可空 | ⚠ SQLite 关键字，手写 SQL 请用 `"group"` |
| `displayOrder` | INTEGER | 默认 `-createdAt` | 列表排序键 |
| `workspace` | TEXT | 可空 | |
| `workspaceEnv` | TEXT | 可空 | |
| `parentChatId` | TEXT | 可空 | 分支对话的父聊天 id |
| `characterCardName` | TEXT | 可空 | |
| `characterGroupId` | TEXT | 可空 | |
| `locked` | INTEGER | 0/1，默认 0 | 锁定后 `deleteChatsInGroup` 跳过 |
| `pinned` | INTEGER | 0/1，默认 0 | 置顶优先排序 |

#### messages（`MessageEntity`）

`app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:9`

| 列 | SQLite 类型 | 约束/默认值 | 说明 |
|---|---|---|---|
| `messageId` | INTEGER | PK，自增 | `app/.../MessageEntity.kt:22` |
| `chatId` | TEXT | FK→`chats(id)`，**ON DELETE CASCADE** | 删聊天自动清消息 |
| `sender` | TEXT | NOT NULL | `user` / `ai` 等 |
| `content` | TEXT | NOT NULL | |
| `timestamp` | INTEGER | 默认当前毫秒 | |
| `orderIndex` | INTEGER | NOT NULL | 消息顺序 |
| `roleName` | TEXT | 默认 `""` | |
| `selectedVariantIndex` | INTEGER | 默认 0 | 当前选中的回复版本 |
| `provider` | TEXT | 默认 `""` | |
| `modelName` | TEXT | 默认 `""` | |
| `inputTokens` | INTEGER | 默认 0 | |
| `outputTokens` | INTEGER | 默认 0 | |
| `cachedInputTokens` | INTEGER | 默认 0 | |
| `sentAt` | INTEGER | 默认 0 | |
| `outputDurationMs` | INTEGER | 默认 0 | |
| `waitDurationMs` | INTEGER | 默认 0 | |
| `completedAt` | INTEGER | 默认 0 | |
| `displayMode` | TEXT | 默认 `"NORMAL"` | 非法值会被 `valueOf` 兜底回 NORMAL，但脏数据建议修掉 |
| `isFavorite` | INTEGER | 0/1，默认 0 | |

索引：`(chatId)`、`(chatId, timestamp)`。
`app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:19`

#### message_variants（`MessageVariantEntity`）

`app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:8`

| 列 | SQLite 类型 | 约束/默认值 | 说明 |
|---|---|---|---|
| `variantId` | INTEGER | PK，自增 | `app/.../MessageVariantEntity.kt:24` |
| `chatId` | TEXT | FK→`chats(id)`，**ON DELETE CASCADE** | 注意：外键挂的是聊天，不是消息 |
| `messageTimestamp` | INTEGER | NOT NULL | 关联到 `messages.timestamp`（逻辑关联，非外键） |
| `variantIndex` | INTEGER | NOT NULL | 版本序号 |
| `content` | TEXT | NOT NULL | |
| `roleName` | TEXT | 默认 `""` | |
| `provider` | TEXT | 默认 `""` | |
| `modelName` | TEXT | 默认 `""` | |
| `inputTokens` | INTEGER | 默认 0 | |
| `outputTokens` | INTEGER | 默认 0 | |
| `cachedInputTokens` | INTEGER | 默认 0 | |
| `sentAt` | INTEGER | 默认 0 | |
| `outputDurationMs` | INTEGER | 默认 0 | |
| `waitDurationMs` | INTEGER | 默认 0 | |
| `completedAt` | INTEGER | 默认 0 | |

索引：`(chatId, messageTimestamp)`；**唯一** `(chatId, messageTimestamp, variantIndex)`——同一消息同一版本号只允许一行。
`app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:20`

#### token_usage_records（`TokenUsageRecordEntity`）

`app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt:8`

| 列 | SQLite 类型 | 约束/默认值 | 说明 |
|---|---|---|---|
| `id` | INTEGER | PK，自增 | `app/.../TokenUsageRecordEntity.kt:17` |
| `importKey` | TEXT | 可空，**唯一索引** | 导入去重键 |
| `occurredAtMs` | INTEGER | 可空 | 发生时间 |
| `configId` | TEXT | NOT NULL | 空字符串=不分配置的全局身份 |
| `provider` | TEXT | NOT NULL | |
| `model` | TEXT | NOT NULL | |
| `requestCount` | INTEGER | NOT NULL | |
| `uncachedInputTokens` | INTEGER | 可空 | |
| `cachedInputTokens` | INTEGER | 可空 | |
| `cacheWriteTokens` | INTEGER | 可空 | |
| `totalInputTokens` | INTEGER | 可空 | |
| `outputTokens` | INTEGER | 可空 | |

索引：`(occurredAtMs)`、`(provider, model, configId, occurredAtMs)`、唯一 `(importKey)`。
`app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt:11`

#### token_stats_models（`TokenStatsModelEntity`）

`app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt:5`

**复合主键** `(configId, provider, model)`，三列都是 TEXT NOT NULL。**WHERE 条件必须带齐三列**，否则可能改到别家模型的计费配置。
`app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt:8`

| 列 | SQLite 类型 | 约束/默认值 | 说明 |
|---|---|---|---|
| `configId` | TEXT | 联合 PK | 空=provider/model 级全局定价 |
| `provider` | TEXT | 联合 PK | |
| `model` | TEXT | 联合 PK | |
| `billingMode` | TEXT | 可空 | |
| `currency` | TEXT | 可空 | |
| `inputPricePerMillion` | REAL | 可空 | 每百万 input token 价 |
| `cachedInputPricePerMillion` | REAL | 可空 | |
| `cacheWritePricePerMillion` | REAL | 可空 | |
| `outputPricePerMillion` | REAL | 可空 | |
| `pricePerRequest` | REAL | 可空 | 按次计费价 |

### 原子修改操作指南

标准流程：**先导出快照**（`exportRawSnapshot`）→ `SELECT` 定位坏行 → `UPDATE` 定点修 → 跑"存储检查"验证（或 `PRAGMA quick_check;` / `PRAGMA foreign_key_check;`）。

常用修复 SQL（在救援界面 SQL 控制台执行）：

```sql
-- 聊天被锁死打不开：解锁
UPDATE chats SET locked=0 WHERE id='<chat-id>';

-- 消息显示模式脏值：重置
UPDATE messages SET displayMode='NORMAL' WHERE messageId=<id>;

-- 某条消息 token 统计错乱：清零重算
UPDATE messages SET inputTokens=0, outputTokens=0 WHERE messageId=<id>;

-- 计费配错了：定点改（WHERE 必须带齐三列）
UPDATE token_stats_models SET outputPricePerMillion=<price>
WHERE configId='<cid>' AND provider='<p>' AND model='<m>';

-- 改完验证
PRAGMA quick_check;
PRAGMA foreign_key_check;
```

⚠ 三条红线：
1. **外键 CASCADE**：`messages` / `message_variants` 的 `chatId` 外键 `ON DELETE CASCADE`——删 `chats` 一行会连带清空该聊天的消息和变体。只想修字段就用 `UPDATE`，别用 `DELETE`。
2. **`group` 是 SQLite 关键字**：手写 SQL 涉及该列时用 `"group"`（双引号），否则语法报错。
3. **`message_variants` 唯一索引**：`(chatId, messageTimestamp, variantIndex)` 唯一，INSERT 新版本行时 `variantIndex` 别和现有冲突，否则直接报错。

## 关键符号

| 符号 | 说明 |
|---|---|
| `DataRecoveryActivity` | 数据救援 Activity，`:repair` 进程，action `OPEN_DATA_RECOVERY` |
| `DataRecoveryViewModel` | SQL 控制台、快照导出/恢复、存储检查/修复 |
| `RoomDatabaseHealthManager` | `inspect()` 健康检查、`repair()` 自动修复、`onCorruption` 兜底 |
| `ChatEntity` / `MessageEntity` / `MessageVariantEntity` | `chats` / `messages` / `message_variants` 表定义 |
| `TokenUsageRecordEntity` / `TokenStatsModelEntity` | token 流水 / 计费配置表定义 |
| `AppDatabase` | Room 唯一入口，库名 `app_database`，版本 21（见 `data-room-db`） |

## 来源

- 表定义：`app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/TokenUsageRecordEntity.kt`
- `app/src/main/java/com/ai/assistance/operit/data/model/TokenStatsModelEntity.kt`
- 救援 Activity：`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryActivity.kt`
- 救援 ViewModel：`app/src/main/java/com/ai/assistance/operit/ui/recovery/DataRecoveryViewModel.kt`
- 健康检查：`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt`
- 快捷方式：`app/src/main/res/xml/shortcuts.xml`
- Manifest 声明：`app/src/main/AndroidManifest.xml`
- 字符串：`app/src/main/res/values/strings.xml`
