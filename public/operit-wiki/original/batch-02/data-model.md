---
title: 数据模型（总览）
module: app
sources: 7
date: 2026-09-30
---

# 数据模型（总览）

## 概述

Operit 的持久化数据分三套存储引擎：聊天记录与 Token 统计走 **Room**（SQLite 封装），记忆走 **ObjectBox**（NoSQL 对象库，按记忆空间 profile 分库），配置偏好走 **DataStore Preferences**（键值对）。三套引擎各有唯一入口：Room 是 `AppDatabase`，ObjectBox 是 `ObjectBoxManager`，偏好是各 `*Preferences`/`*Manager` 经版本化 DataStore。

## AI 速览

核心符号清单（一行一个 `符号 — 一句话职责`）：

- `AppDatabase` — 应用主数据库（Room），管聊天/消息/Token 统计。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:38`
- `ObjectBoxManager` — 按 profileId 管理 ObjectBox 记忆库的 object 单例。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:9`
- `AppDatabase.getDatabase` — Room 单例入口，建库名固定为 `app_database`。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:442`
- `ObjectBoxManager.get` — 按 profileId 取（或新建）该记忆空间的 `BoxStore`。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:13`
- `AppDatabase.getDatabase` + `messageDao()` — 聊天历史读写入口，经 DAO 走 Room。`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:114`
- `ObjectBoxManager.get(context, profileId)` — 记忆仓库拿 store 的调用点。`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:90`
- `versionedPreferencesDataStore` — 带版本化 schema 迁移的 DataStore 构造器，偏好设置的统一底座。`app/src/main/java/com/ai/assistance/operit/data/preferences/VersionedPreferencesDataStore.kt:32`

主入口函数：`AppDatabase.getDatabase(context)`（Room）、`ObjectBoxManager.get(context, profileId)`（ObjectBox）。

数据流向一句话：聊天记录与 Token 账本存 Room 的 `app_database` 库，记忆按 profile 存 ObjectBox 的独立目录，配置偏好存 DataStore Preferences，三套引擎读写路径互不交叉。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:445`

## 核心机制

### Room：聊天与 Token 的关系型账本

- `AppDatabase` 继承 `RoomDatabase`，`@Database` 注解声明 5 个实体（ChatEntity、MessageEntity、MessageVariantEntity、TokenUsageRecordEntity、TokenStatsModelEntity），当前版本 21。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:38`
- 对外暴露 5 个 DAO 访问器：`chatDao()`、`messageDao()`、`messageVariantDao()`、`chatContentDao()`、`tokenUsageDao()`。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:40`
- 迁移链共 20 个 `Migration`，在 `addMigrations` 中一次性全部注册，老版本数据库逐级升级到 v21。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:516`
- 迁移从 `MIGRATION_1_2` 起始。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:517`
- 迁移到 `MIGRATION_20_21` 结束，连续覆盖 20 级。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:536`
- 迁移史就是功能史：v2 加会话分组，v3 加排序，v7 绑角色卡，v8 记供应商/模型名，v12 加 token 与耗时列，v14 建 AI 回复多变体表，v17 加收藏，v19 加置顶。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:359`
- v21 新建 `token_usage_records` 用量账本表，并把旧消息表里的历史 token 数据汇总导入新账本。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:270`
- `token_usage_records` 在 `importKey` 上建唯一索引，支持外部导入去重。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:314`
- `validateRecoveryCopy` 把源库拷到随机名隔离文件后做 schema 自检，是数据库损坏恢复的校验入口。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:455`
- 校验前先删掉 `room_master_table`，强制 Room 逐表比对真实表结构而不是信任一次哈希。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:485`

### ObjectBox：记忆的 NoSQL 库

- `ObjectBoxManager` 是 object 单例，内部用 `ConcurrentHashMap<String, BoxStore>` 按 `profileId` 缓存已打开的 store。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:10`
- `profileId` 为 `default` 时目录名为 `objectbox`（向后兼容），其他 profile 为 `objectbox_<profileId>`，目录在 `context.filesDir` 下，与 Room 物理隔离。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:24`
- 记忆相关实体 Memory、MemoryAutoSaveCandidate、DocumentChunk 标注 ObjectBox 的 `Entity` 注解，是 ObjectBox 实体——记忆数据不进 Room。`app/src/main/java/com/ai/assistance/operit/data/model/Memory.kt:5`
- `ObjectBoxManager.delete` 先关 store 再递归删整个目录，是物理删除指定 profile 记忆数据的唯一入口。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:43`

### 数据分几类、存在哪、谁在读写

| 数据类 | 存在哪 | 谁在读写 | 细页 |
|---|---|---|---|
| 聊天记录（会话/消息/AI 回复多变体） | Room `app_database` | `ChatHistoryManager` 经 5 个 DAO | [Room 数据库与 DAO](entry.html?id=batch-04/data-room-db)、[聊天历史仓库](entry.html?id=batch-05/data-repo-chat) |
| 记忆（记忆条目/自动保存候选/文档块） | ObjectBox，按 profile 分目录 | `MemoryRepository` 经 `ObjectBoxManager.get` | [记忆仓库](entry.html?id=batch-05/data-repo-memory) |
| 配置偏好（模型/API Key/角色卡/主题/语音等） | DataStore Preferences（版本化迁移） | 各 `*Preferences`/`*Manager` | [模型与 API 配置](entry.html?id=batch-05/data-prefs-model)、[角色卡与人格配置](entry.html?id=batch-05/data-prefs-character)、[应用基础/主题/语音/记忆搜索配置](entry.html?id=batch-05/data-prefs-app) |
| Token 用量与定价 | Room `token_usage_records` + `token_stats_models` | `tokenUsageDao` 聚合查询 | [Token 用量统计与模型定价数据](entry.html?id=batch-05/data-stats-pricing) |
| 实体类定义 | Kotlin 数据类（`data/model/`） | 各仓库引用 | [数据模型与实体类](entry.html?id=batch-04/data-models) |
| 备份/导出/恢复 | 文件（归档包） | 备份导出逻辑 | [数据备份、恢复与导入导出](entry.html?id=batch-05/data-backup-export) |
| MCP/插件/OAuth/公告等扩展数据 | 各自仓库与偏好 | 对应 Repository | [MCP 服务与插件桥接](entry.html?id=batch-05/data-mcp)、[OAuth 与外部 API 客户端](entry.html?id=batch-05/data-api-oauth)、[应用更新与公告](entry.html?id=batch-05/data-update-announce)、[扩展仓库](entry.html?id=batch-05/data-repo-misc) |

人话翻译：可以把数据层想象成三个抽屉——Room 是带表格的账本抽屉，记"说过什么、花了多少 token"；ObjectBox 是按人头分格的记忆抽屉，每个记忆空间（profile）一格；DataStore 是贴标签的配置抽屉，记"用哪个模型、API Key 是什么、界面长什么样"。删记忆空间只删它那一格（`delete` 删目录），不动聊天账本；反过来清聊天记录也不碰记忆。

## 关键符号

- `APP_DATABASE_VERSION` — 数据库版本号常量，当前 21。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:24`
- `ChatEntity` / `MessageEntity` / `MessageVariantEntity` — Room 三实体：会话、消息、AI 回复多变体。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:29`
- `TokenUsageRecordEntity` / `TokenStatsModelEntity` — Room 两实体：用量账本、模型定价。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:32`
- `exportSchema` — 设为 false，不导出 Room schema 文件。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:36`
- `MIGRATION_13_14` — 迁移链里唯一删表的一次：`DROP TABLE problem_records`。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:150`
- `MIGRATION_14_15` 给 messages 表加 `selectedVariantIndex` 列，并新建 message_variants 表存放 AI 回复的多个变体。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:157`
- `MIGRATION_20_21` — 新建用量账本与定价表，并把历史 token 数据汇总导入。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:240`
- `getDatabase` — Room 单例入口，双重检查加锁。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:442`
- `closeDatabase` — 关闭 INSTANCE 并置空。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:548`
- `closeAll` — 关闭全部 ObjectBox store 并清空缓存。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:54`

## 调用链

链路 A（聊天消息落库：输入 → 处理 → 输出）：

1. 输入：用户或 AI 产生一条聊天消息，由 ChatHistoryManager 承接。`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:114`
2. 处理：经 `messageDao` 拿到消息 DAO，写入 messages 表。`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:116`
3. 输出：Room 持久化到 app_database；回读时走 `(chatId, timestamp)` 联合索引按会话拉历史。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:206`

链路 B（记忆写入：输入 → 处理 → 输出）：

1. 输入：产生一条记忆或自动保存候选，由 MemoryRepository 承接。`app/src/main/java/com/ai/assistance/operit/data/repository/MemoryRepository.kt:90`
2. 处理：`ObjectBoxManager.get(context, profileId)` 取该记忆空间专属 `BoxStore`（`default` 用 `objectbox` 目录，其他用 `objectbox_<profileId>`）。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:24`
3. 输出：写入 `context.filesDir` 下的 ObjectBox 目录，与 Room 物理隔离。`app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt:25`

链路 C（Token 用量记账：输入 → 处理 → 输出）：

1. 输入：一次 AI 请求完成，产生 input/output/cached token 数。
2. 处理：经 `tokenUsageDao` 写入用量账本（importKey 唯一防重）。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:46`
3. 输出：按 `(provider, model, configId, occurredAtMs)` 联合索引聚合查询，对照 `token_stats_models` 定价表核算费用。`app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt:298`

## 关联条目

本页是数据章总览，下属 13 个细页（点击直达评审页）：

- [Room 数据库与 DAO](entry.html?id=batch-04/data-room-db)
- [数据模型与实体类](entry.html?id=batch-04/data-models)
- [记忆仓库](entry.html?id=batch-05/data-repo-memory)
- [聊天历史仓库](entry.html?id=batch-05/data-repo-chat)
- [扩展仓库](entry.html?id=batch-05/data-repo-misc)
- [模型与 API 配置](entry.html?id=batch-05/data-prefs-model)
- [角色卡与人格配置](entry.html?id=batch-05/data-prefs-character)
- [应用基础配置](entry.html?id=batch-05/data-prefs-app)
- [Token 用量统计与模型定价](entry.html?id=batch-05/data-stats-pricing)
- [数据备份与导入导出](entry.html?id=batch-05/data-backup-export)
- [MCP 服务与插件桥接](entry.html?id=batch-05/data-mcp)
- [OAuth 与外部 API 客户端](entry.html?id=batch-05/data-api-oauth)
- [应用更新与公告](entry.html?id=batch-05/data-update-announce)
- [工具注册与执行框架](entry.html?id=batch-02/core-tools-registry)：工具结果类型 `ToolResultData` 的定义不在数据层，归工具章。

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/db/AppDatabase.kt`
- `app/src/main/java/com/ai/assistance/operit/data/db/ObjectBox.kt`
- 以下文件仅只读确认、未登记为严格已读：`data/model/Memory.kt`、`data/model/MemoryAutoSaveCandidate.kt`、`data/repository/MemoryRepository.kt`、`data/repository/ChatHistoryManager.kt`、`data/preferences/VersionedPreferencesDataStore.kt`
