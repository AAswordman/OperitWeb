---
title: 数据备份、恢复与导入导出
module: 数据层
sources: RawSnapshotBackupManager.kt, RoomDatabaseBackupManager.kt, RoomDatabaseBackupPreferences.kt, RoomDatabaseBackupScheduler.kt, RoomDatabaseBackupWorker.kt, RoomDatabaseRestoreManager.kt, OperitBackupDirs.kt, PreferencesHealthManager.kt, RoomDatabaseHealthManager.kt, HtmlExporter.kt, MarkdownExporter.kt, TextExporter.kt
date: 2026-10-01
---

# 数据备份、恢复与导入导出

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲 Operit 如何保住用户数据：备份、恢复、健康检查、导入导出。分四个子系统：

1. **原始快照**（raw snapshot）：把整个应用的数据目录打成一个 zip，一键导出、一键恢复。由 `RawSnapshotBackupManager` 负责。
2. **Room 数据库备份**：每天凌晨自动备份一次 `app_database`，也可手动触发；恢复时做原子替换。由 `RoomDatabaseBackupManager`、`RoomDatabaseRestoreManager`、`RoomDatabaseBackupScheduler`、`RoomDatabaseBackupWorker`、`RoomDatabaseBackupPreferences` 五个类协作。
3. **健康检查与修复**：DataStore 配置文件和 Room 数据库的"体检"，发现损坏先归档再动手。由 `PreferencesHealthManager` 和 `RoomDatabaseHealthManager` 负责，界面跑在独立的 `:repair` 进程。
4. **聊天记录导入导出**：Markdown / HTML / TXT / JSON / CSV 五种格式导出，九种格式导入。导出器是 `data/exporter/` 下的三个 object，导入导出的编排在 `ChatHistoryManager`。

注意：源码里没有 `data/importer/` 目录（已确认不存在）。导入逻辑不在独立目录里，而是放在 `ChatHistoryManager.importChatHistoriesFromUri` 与 `data/converter/` 下的各格式转换器中。

备份文件统一落在 `Download/Operit/` 下的 `backup/` 子目录，由 `OperitBackupDirs` 管理。

## AI 速览

- 核心符号：`RawSnapshotBackupManager`（原始快照）、`RoomDatabaseBackupManager`（数据库备份）、`RoomDatabaseRestoreManager`（数据库恢复）、`RoomDatabaseBackupScheduler`（备份调度）、`RoomDatabaseBackupPreferences`（备份配置）、`PreferencesHealthManager`（配置健康检查）、`RoomDatabaseHealthManager`（数据库健康检查）、`HtmlExporter` / `MarkdownExporter` / `TextExporter`（聊天导出器）、`ChatHistoryManager`（导入导出编排）、`OperitBackupDirs`（备份目录）
- 主入口：备份调度 `RoomDatabaseBackupScheduler.ensureScheduled(context)`（应用启动时装配）；快照导出 `RawSnapshotBackupManager.exportToBackupDir(context)`；数据库恢复 `RoomDatabaseRestoreManager.restoreFromBackupFile/restoreFromBackupUri`；体检 `PreferencesHealthManager.inspect` / `RoomDatabaseHealthManager.inspect`；聊天导出 `ChatHistoryManager.exportChatHistoriesToDownloads`、导入 `ChatHistoryManager.importChatHistoriesFromUri`
- 数据流向一句话：应用数据目录 / 数据库 / 聊天记录 → 打包为 zip 或文本 → 落盘到 `Download/Operit/backup`；恢复时反向把文件拷回原位并重建数据库连接。

## 核心机制

### 1. 原始快照：整个应用一锅端

`RawSnapshotBackupManager.exportToBackupDir` 把五个位置打进一个 zip：应用私有 files 目录、外部 files 目录、shared_prefs、datastore、databases。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:105`

zip 里第一个条目是 `manifest.json`，记录格式版本（当前为 1）、包名、创建时间、包含的负载列表、是否含终端数据。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:153`

导出前先对 Room 数据库做 `PRAGMA wal_checkpoint(FULL)`，把 WAL 里的脏页刷回主库，避免备出一半新一半旧的数据。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:132`

默认不备份终端数据：`usr`、`tmp`、`bin` 三个顶层目录被排除；只有显式传 `SnapshotOptions(includeTerminalData = true)` 才包含。两个 UI 调用点目前都用默认值。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:65`

几类大文件永远不进快照：语音模型目录（`sherpa-ncnn-` 开头）、向量索引、图片/媒体池、技能仓库 zip 池（来自 `OperitPaths.rawSnapshotExcludedFilesTopLevelDirNames`），以及终端 rootfs 包（`ubuntu-*.tar.xz`）、向量索引文件（`memory_hnsw_*.idx`、`doc_index_*.hnsw`）和 ObjectBox 的 `lock.mdb`。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:518`

导出先写 `.tmp` 文件，写完再 rename 为正式文件，避免崩溃留下半截 zip。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:116`

恢复（`restoreFromBackupUri`）更谨慎：先把用户选的文件完整拷到 cache 临时目录，再关闭 Room 和 ObjectBox，然后校验 manifest（版本必须为 1、包名必须以 `com.ai.assistance.operit` 开头），解压时做 canonical 路径校验防 zip-slip，最后把五个目录逐个替换。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:263`

替换是"完整恢复点"语义：目标目录里快照中没有的旧文件会被删掉；但如果快照本身不含终端数据，现有的 `usr`/`tmp`/`bin` 会被保留下来。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:301`

DataStore 配置文件替换时用 `AtomicFile` 写入，防止 DataStore 读到瞬时的空文件又把它持久化回去。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:628`

### 2. Room 数据库：每天凌晨自动备份

`RoomDatabaseBackupScheduler.ensureScheduled` 注册一个 24 小时周期的 WorkManager 任务，约束是"存储空间不低"，首次执行对齐到下一个凌晨 3 点。应用启动时按备份开关决定装配还是取消。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupScheduler.kt:20`

真正干活的是 `RoomDatabaseBackupWorker.doWork`，它读 `KEY_FORCE` 参数后调 `backupIfNeeded`。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupWorker.kt:18`

`backupIfNeeded` 的决策表：开关关闭且非强制 → 跳过（`disabled`）；`force=true` → 走手动备份，文件名带精确时间戳；当天已备份 → 跳过（`already_backed_up_today`）；否则生成 `room_db_backup_<日期>.zip` 并记录成功。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupManager.kt:41`

备份 zip 里装三样东西：`app_database` 主库、`app_database-wal`、`app_database-shm`。恢复时若目标已有 wal/shm 而备份里缺对应条目，恢复直接抛错中断，所以三者打包在一起。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupManager.kt:94`

备份保留数默认 10，可在 1~100 之间调；`enforceMaxBackupCount` 按修改时间只留最新的 N 个，多余的删掉，同时兼容旧版本放在根目录的备份。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupManager.kt:155`

配置（开关、上次备份日期、错误信息、保留数）存在 DataStore 文件 `database_backup_settings` 里，由 `RoomDatabaseBackupPreferences` 读写。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupPreferences.kt:17`

恢复走 `RoomDatabaseRestoreManager`：从文件或 uri 读 zip，先解到临时文件，再用 `ATOMIC_MOVE` 原子替换掉现有的库文件和 wal/shm；如果备份里缺了目标已有的 wal/shm，直接抛错中断，不做半吊子恢复。
`app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseRestoreManager.kt:187`

### 3. 健康检查与修复：先体检，坏了先归档再动手

`PreferencesHealthManager` 管 DataStore 配置文件（`*.preferences_pb`），`RoomDatabaseHealthManager` 管 Room 数据库。两者都是"用户手动触发"的体检加修复，`inspect()` 返回三态报告：`HEALTHY`（健康）、`NEEDS_REPAIR`（可修）、`MANUAL_RECOVERY_REQUIRED`（只能手动恢复）。
`app/src/main/java/com/ai/assistance/operit/data/recovery/PreferencesHealthManager.kt:44`

配置检查的做法是"影子验证"：把每个 `.preferences_pb` 拷到随机临时目录，用 `PreferenceDataStoreFactory` 打开读一遍。读出 `CorruptionException` 判损坏；能读出来再扫一遍里面的字符串值，以 `{` 或 `[` 开头的做 JSON 解析，坏掉的记为领域问题（domain issue）。
`app/src/main/java/com/ai/assistance/operit/data/recovery/PreferencesHealthManager.kt:326`

数据库检查的项目更多：文件是否存在、wal/shm/journal 边车文件是否合法、只读打开是否触发损坏回调、`PRAGMA quick_check` 完整性、`user_version` 是否等于 21（`AppDatabase.DATABASE_VERSION`）、外键是否违规、主进程是否已停、以及在隔离拷贝上走 Room 验证 schema。
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:526`

只有两类问题支持自动修：纯索引损坏（`quick_check` 报的都是 `row N missing from index` 这类）→ 执行 `REINDEX`；版本号偏低 → 打开一次 Room 触发自动迁移。其他损坏一律判手动恢复。
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:291`

修复是"保全优先"：动手前先把源文件打成带时间戳的 zip 归档（配置的归档在 `backup/preferences`，数据库的在 `backup/room_db`），修坏了抛出的 `RepairFailedException` 里还带着这份归档，修完重新体检出一份新报告。
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:607`

修复要求主进程已停止——体检和修复界面跑在独立的 `:repair` 进程（`DataRecoveryActivity` 在 manifest 里声明 `android:process=":repair"`），避免修的时候主进程还在读写。
`app/src/main/AndroidManifest.xml:289`

### 4. 聊天记录：五种格式导出，九种格式导入

导出（`ChatHistoryManager.exportChatHistoriesToDownloads`）支持五种格式，文件落在 `backup/chat`。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1894`

- **MARKDOWN**：打成 `chat_backup_<时间>.zip`，每个会话一个 `.md`；标题里的非法字符换成下划线、截断 50 字符、重名自动加序号。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1946`
- **JSON**：Operit 原生归档，`{archiveType, formatVersion, exportedAt, chats:[...]}`，逐会话流式写入。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:204`
- **HTML / TXT**：短文本一次性生成，长文本走流式写入并上报字符级进度。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2050`
- **CSV**：经 `ChatHistoryCsv` 逐行写入。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:246`

三个导出器（`data/exporter/`）都是无状态 object：

- `MarkdownExporter`：文件头写 `<!-- chat-info: ... -->` 结构化注释加 YAML front matter，每条消息前写 `<!-- msg: user, model=..., timestamp=... -->`，方便以后再导回来。
`app/src/main/java/com/ai/assistance/operit/data/exporter/MarkdownExporter.kt:32`
- `HtmlExporter`：自带内联 CSS，消息转义 HTML 特殊字符，``` 围栏转 `<pre><code>`，64KB 分块写、每 256KB 回调进度。
`app/src/main/java/com/ai/assistance/operit/data/exporter/HtmlExporter.kt:334`
- `TextExporter`：60 字符宽的 ASCII 分隔线排版，同样 64KB 分块。
`app/src/main/java/com/ai/assistance/operit/data/exporter/TextExporter.kt:59`

导入（`importChatHistoriesFromUri`）支持九种 `ChatFormat`：Operit 原生走流式 `JsonReader`（兼容新归档对象和旧版数组），Markdown 先试 zip 再试单文件，ChatGPT / ChatBox / 通用 JSON 各有转换器，Claude 格式回退到通用 JSON。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2164`

导入按会话 id 去重：已存在的记更新，不存在的记新增，空消息的记跳过，最后返回 `ChatImportResult(new, updated, skipped)`。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2247`

## 关键符号

| 符号 | 职责 |
|---|---|
| `RawSnapshotBackupManager` | 原始快照导出/恢复（整个应用目录打包） |
| `RoomDatabaseBackupManager` | Room 数据库自动/手动备份与超量清理 |
| `RoomDatabaseRestoreManager` | Room 数据库备份列表与原子恢复 |
| `RoomDatabaseBackupScheduler` | WorkManager 周期/一次性备份任务编排 |
| `RoomDatabaseBackupWorker` | 备份任务的 Worker 实现 |
| `RoomDatabaseBackupPreferences` | 备份开关与状态的 DataStore |
| `OperitBackupDirs` | 备份目录（backup/raw_snapshot、room_db、preferences、chat 等） |
| `PreferencesHealthManager` | DataStore 配置文件的健康检查与修复 |
| `RoomDatabaseHealthManager` | Room 数据库的健康检查与修复 |
| `HtmlExporter` / `MarkdownExporter` / `TextExporter` | 聊天记录 HTML / Markdown / 纯文本导出器 |
| `ChatHistoryManager` | 聊天记录导入导出的编排（含 JSON / CSV 编解码） |
| `ChatFormat` / `ExportFormat` | 导入九种 / 导出五种格式枚举 |
| `TokenUsageRepository.withDatabaseAccess` | 备份/恢复期间的数据库访问互斥 |

## 输入→处理→输出调用链

1. **输入**：`OperitApplication` 启动时读 `RoomDatabaseBackupPreferences.isDailyBackupEnabled`，决定装配还是取消周期备份。
   `app/src/main/java/com/ai/assistance/operit/core/application/OperitApplication.kt:370`
2. **处理**：`RoomDatabaseBackupScheduler.ensureScheduled` 注册 24 小时周期任务（首次对齐凌晨 3 点）；到点 `RoomDatabaseBackupWorker.doWork` 调 `RoomDatabaseBackupManager.backupIfNeeded(force=false)`，按决策表生成 `room_db_backup_<日期>.zip`，再 `enforceMaxBackupCount` 清掉多余旧备份。
   `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupManager.kt:41`
3. **输出**：备份 zip（含 db/wal/shm）落在 `backup/room_db`；手动恢复时 `RoomDatabaseRestoreManager` 用 `ATOMIC_MOVE` 原子替换现库。
   `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseRestoreManager.kt:187`

快照恢复链：**输入**为用户在设置页选的快照文件 → **处理**经 `RawSnapshotBackupManager.restoreFromBackupUri`（拷 cache → 关数据库 → 验 manifest → 防 zip-slip 解压 → 五目录替换）→ **输出**为恢复后的应用数据目录。
`app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt:263`

健康修复链：**输入**为 `:repair` 进程恢复页的用户体检请求 → **处理**经 `inspect` 出三态报告，确认后先归档源文件再执行修复（删损坏配置 / `REINDEX` / Room 迁移）→ **输出**为新的体检报告与修复归档 zip。
`app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt:93`

聊天导出链：**输入**为选中的会话 id 集合与 `ExportFormat` → **处理**经 `ChatHistoryManager.exportChatHistoriesToDownloads` 按格式分发（zip 打包 md / 流式 JSON / HTML-TXT / CSV）→ **输出**为 `backup/chat` 下的导出文件。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1894`

聊天导入链：**输入**为用户选的文件 uri 与 `ChatFormat` → **处理**经 `importChatHistoriesFromUri`（Markdown 先试 zip、Operit 走流式 JsonReader、其他走转换器）→ **输出**为按 id 去重入库的会话与 `ChatImportResult` 计数。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2164`

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/backup/OperitBackupDirs.kt`：备份目录定义
- `app/src/main/java/com/ai/assistance/operit/data/backup/RawSnapshotBackupManager.kt`：原始快照导出/恢复
- `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupManager.kt`：数据库自动/手动备份
- `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupPreferences.kt`：备份配置 DataStore
- `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupScheduler.kt`：WorkManager 调度
- `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseBackupWorker.kt`：备份 Worker
- `app/src/main/java/com/ai/assistance/operit/data/backup/RoomDatabaseRestoreManager.kt`：数据库恢复
- `app/src/main/java/com/ai/assistance/operit/data/recovery/PreferencesHealthManager.kt`：配置健康检查与修复
- `app/src/main/java/com/ai/assistance/operit/data/recovery/RoomDatabaseHealthManager.kt`：数据库健康检查与修复
- `app/src/main/java/com/ai/assistance/operit/data/exporter/HtmlExporter.kt`：HTML 导出器
- `app/src/main/java/com/ai/assistance/operit/data/exporter/MarkdownExporter.kt`：Markdown 导出器
- `app/src/main/java/com/ai/assistance/operit/data/exporter/TextExporter.kt`：纯文本导出器
- `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt`：导入导出编排
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormat.kt`：导入/导出格式枚举

事实清单：data-backup-export.facts.json（182 条）
代码走查：data-backup-export.quality.json（13 条：高危 3 / 警告 6 / 建议 4）
