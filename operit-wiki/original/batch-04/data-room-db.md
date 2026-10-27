---
title: Room 数据库与 DAO
module: app
sources: 8
date: 2026-10-01
---

# Room 数据库与 DAO

## 概述

App 的聊天、消息、token 用量都存在 SQLite 里，由 Room 统一管理建表、升级和查询。`AppDatabase` 是唯一的数据库入口，版本号 21，20 个 `Migration` 覆盖从版本 1 到 21 的每次升级。

另一套 NoSQL 存储走 ObjectBox：`ObjectBoxManager` 按 `profileId` 分库缓存 `BoxStore`，`default` 用 `objectbox` 目录，其他 profile 用 `objectbox_<profileId>`。
`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:24`
`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:24`

## AI 速览

- 核心符号：`AppDatabase`、`ObjectBoxManager`、`ChatDao`、`MessageDao`、`MessageVariantDao`、`ChatContentDao`、`TokenUsageDao`、`ChatMessageCount`
- 主入口：`AppDatabase.getDatabase(context)`（单例，库名 `app_database`）
- 数据流向一句话：调用方调 DAO 方法 → Room 生成的实现类执行 SQL → SQLite 文件 `app_database`；ObjectBox 数据走 `BoxStore`（`objectbox[_profileId]` 目录）。
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:445`

## 核心机制

### 版本与迁移链

`APP_DATABASE_VERSION = 21`。`buildDatabase` 里 `addMigrations` 把 `MIGRATION_1_2` 到 `MIGRATION_20_21` 共 20 个迁移对象全部注册，Room 在首次打开时按需顺序执行。
`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:517`
`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:536`

版本演进的关键节点：

- v1→v2：建 `chats` 表和 `messages` 表。`messages.chatId` 外键引用 `chats(id)`，`ON DELETE CASCADE`——删聊天自动清掉它的消息。
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:61`
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:83`
- v14→v15：建 `message_variants` 表（同一条消息的多个 AI 回复版本），外键同样级联删除；`selectedVariantIndex` 列记当前选中的版本。
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:165`
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:180`
- v20→v21：新增 `token_usage_records`（token 消费流水）和 `token_stats_models`（模型计费配置）两张表，并把 `messages` 里 `sender='ai'` 的历史 token 数据回填进流水表。
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:270`
  `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:324`

注意：部分老迁移（如加 `workspaceEnv` 列）用空 `catch` 包住 `ALTER TABLE`，失败会静默通过。

### 长文本分块读

单条消息文本量大时，一次读进 `CursorWindow` 会爆。`ChatContentDao` 把阈值定为 65_536 字符：查询时 `SUBSTR(content, 1, 65536)` 只取首块并附带全文长度；`materializeMessage` 发现超长就循环拉后续分块拼回完整正文。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt:11`
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt:414`

### 恢复校验

`validateRecoveryCopy` 是给“数据库损坏恢复” UI 用的：把源库拷成 `room_health_validation_<uuid>` 的隔离副本，删掉 `room_master_table`（Room 的身份哈希表），强制 Room 逐表比对真实 schema，然后用 `buildDatabase` 打开副本触发完整迁移链。校验完在 `finally` 里删掉全部临时文件，不碰线上库。
`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:459`
`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:485`
`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:501`

### token 账本

`TokenUsageDao` 是抽象类 DAO：`insertRecord` 记流水，`upsertStatsModel` 维护模型计费价，`aggregateModelsForLifetime` 按 (provider, model, configId) 聚合计费，`getActivityDaysInRange` 用 `strftime` 按本地日期聚合每日用量。
`app/src/main/java/com/ai/assistance/operit/data/dao/TokenUsageDao.kt:39`
`app/src/main/java/com/ai/assistance/operit/data/dao/TokenUsageDao.kt:114`
`app/src/main/java/com/ai/assistance/operit/data/dao/TokenUsageDao.kt:186`

## 关键符号

| 符号 | 说明 |
|---|---|
| `AppDatabase` | Room 数据库抽象类，5 个 DAO 的唯一入口 |
| `AppDatabase.getDatabase` | 双重检查锁单例，库名 `app_database` |
| `ObjectBoxManager` | ObjectBox 的 `BoxStore` 按 profile 缓存管理 |
| `ChatDao` | 聊天表 CRUD、分组、角色卡绑定、分支对话 |
| `MessageDao` | 消息表 CRUD、复制、搜索、预览 |
| `MessageVariantDao` | 消息多版本变体的 CRUD 与复制 |
| `ChatContentDao` | 长文本分块读取与完整还原 |
| `TokenUsageDao` | token 流水记录与计费聚合 |
| `ChatMessageCount` | (chatId, count) 计数行 |
| `MIGRATION_20_21` | 唯一的 `internal` 迁移，v21 的 token 表与索引补建 |

`ChatDao.getAllChats` 返回 `Flow`，按 `pinned` 置顶优先、`displayOrder` 排序，UI 层订阅后自动刷新。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:17`

`MessageDao.insertMessage` 用 `REPLACE` 策略并返回行 id；`copyMessagesToChat` 用 `INSERT INTO ... SELECT` 跨聊天复制消息。
`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:139`
`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:191`

`MessageDao.searchChatIdsByContent` 用前后通配 `LIKE` 加 `ESCAPE` 做不区分大小写的全文搜聊天。
`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:240`

`ChatDao.deleteChatsInGroup` 只删分组下未锁定的聊天（`locked = 0`），锁定的保留。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:120`

`ChatDao.getMainChats` 查 `parentChatId IS NULL` 的主对话，`getBranchesByParentId` 查分支。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:152`
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:144`

`getVariantsForMessages` 先按时间范围查、再在内存里按请求的时间戳集合过滤，避免大列表被 Room 展开成海量 SQLite 绑定变量。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt:372`

## 调用链

1. **初始化**：`AppDatabase.getDatabase(context)` → 双重检查锁 → `Room.databaseBuilder(context, AppDatabase::class.java, "app_database")` → `addMigrations(20 个)` → 首次打开自动执行迁移链。
   `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:442`
2. **读聊天列表**：UI 订阅 `ChatDao.getAllChats()` → `Flow<List<ChatEntity>>` → 数据变化自动推送，置顶的排前面。
   `app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:17`
3. **读消息正文**：`ChatContentDao.getMessagesForChat(chatId)` → 分块 SQL（首块 65536 字符 + 全文长度）→ `materializeMessages` → 超长则循环拉分块拼回完整 `MessageEntity`。
   `app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt:277`
4. **写消息**：`MessageDao.insertMessage(message)` → `REPLACE` 写入 → 返回 `rowId`。
   `app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:139`
5. **删聊天**：`ChatDao.deleteChat(chatId)` → 外键 `ON DELETE CASCADE` 自动清掉该聊天的 `messages` 和 `message_variants`。
   `app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:36`
6. **记 token**：`TokenUsageDao.insertRecord(record)` → 写入 `token_usage_records` → `aggregateModelsForLifetime` 按模型聚合展示。
   `app/src/main/java/com/ai/assistance/operit/data/dao/TokenUsageDao.kt:39`

## 来源

- 数据库定义与迁移：`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt`
- ObjectBox 管理：`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt`
- 聊天 DAO：`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt`
- 消息 DAO：`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt`
- 消息变体 DAO：`app/src/main/java/com/ai/assistance/operit/data/dao/MessageVariantDao.kt`
- 长文本分块 DAO：`app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt`
- token 账本 DAO：`app/src/main/java/com/ai/assistance/operit/data/dao/TokenUsageDao.kt`
- 计数行：`app/src/main/java/com/ai/assistance/operit/data/dao/ChatMessageCount.kt`
