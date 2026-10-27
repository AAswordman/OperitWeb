---
title: 聊天历史仓库
module: 数据层
sources: ChatHistoryManager.kt, ChatDao.kt, MessageDao.kt, MessageVariantDao.kt, ChatContentDao.kt, ChatEntity.kt, MessageEntity.kt, MessageVariantEntity.kt, ChatHistory.kt, ChatMessage.kt, OperitChatArchive.kt, ChatMessageTimestampAllocator.kt, ChatFormat.kt, ChatFormatConverter.kt, ChatFormatDetector.kt, ChatHistoryCsv.kt, ChatGPTConverter.kt, ChatBoxConverter.kt, MarkdownConverter.kt, GenericJsonConverter.kt, HtmlExporter.kt, MarkdownExporter.kt, TextExporter.kt, OperitBackupDirs.kt, ChatHistoryDelegate.kt
date: 2026-10-01
---

# 聊天历史仓库

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是：Operit 聊天记录在"数据层"的总管——`ChatHistoryManager`。

它是 Room 数据库和上层业务之间的唯一读写门面：会话元数据（标题、分组、锁定、置顶、角色卡绑定、工作区）、消息、AI 回答的多版本（variants）、导入导出，全部走它。全 App 经由 `ChatHistoryManager.getInstance(context)` 拿到全局单例；业务侧的主要调用方是 `ChatHistoryDelegate`（`services/core`）。

底层是三张 Room 表：`chats`（会话）、`messages`（消息）、`message_variants`（AI 回答的再生版本）。读走 `ChatContentDao` 的分片查询（单条消息按 65_536 字符分片，防止 CursorWindow 溢出）；写走四个 DAO；并发控制用"全局锁 + 按会话锁"两级 `Mutex`。另有一条"当前会话 ID"通道：用 DataStore（`current_chat_id`）持久化，对外暴露 `currentChatIdFlow` 响应式流。

## AI 速览

- 核心符号：`ChatHistoryManager`（单例门面）、`ChatEntity`（会话表实体）、`ChatHistory`（UI 侧会话模型）、`MessageEntity`（消息表实体）、`ChatMessage`（UI 侧消息模型）、`MessageVariantEntity`（变体表实体）、`OperitArchivedChat`（导出归档模型）、`chatHistoriesFlow`（会话列表流）、`currentChatIdFlow`（当前会话流）、`ChatImportResult`（导入统计）
- 主入口：`ChatHistoryManager.getInstance(context)` → 各业务挂起函数；业务侧门面为 `ChatHistoryDelegate`
- 数据流向一句话：Room 三表（chats/messages/message_variants）→ ChatDao/MessageDao/MessageVariantDao/ChatContentDao → `ChatHistoryManager` 的 Flow 与挂起函数 → `ChatHistoryDelegate` / UI / 导入导出。

## 核心机制

### 1. 单例与数据库预热

`ChatHistoryManager` 构造器私有，`getInstance` 用 `@Volatile` + `synchronized` 双重检查锁返回单例。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:92`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:103`

`init` 里起一个独立的 IO 协程，调 `chatDao.getAllChats().first()` 做一次真实查询，提前触发 Room 初始化。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:430`

### 2. 三张表与数据模型

- `ChatEntity` 映射表 `chats`，主键 `id` 默认随机 UUID；`displayOrder` 默认 `-createdAt`，即新会话排前面。
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:10`
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:12`
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt:20`
- `MessageEntity` 映射表 `messages`，外键指向 `chats.id` 且 `onDelete = CASCADE`，在 `(chatId)` 和 `(chatId, timestamp)` 上建索引；`orderIndex` 保持消息顺序；`displayMode` 默认 `NORMAL`；`isFavorite` 默认 false。
  `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:10`
  `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:19`
  `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt:27`
- `MessageVariantEntity` 映射表 `message_variants`，外键同样级联到 `chats`，在 `(chatId, messageTimestamp, variantIndex)` 上建唯一索引；`applyTo` 把变体内容覆盖到基座消息上。
  `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:9`
  `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:20`
  `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt:40`
- `ChatHistory` 是 UI 侧模型：`id` 默认随机 UUID，含 `title`、`messages`、`group`、`displayOrder`、`workspace`/`workspaceEnv`、`parentChatId`、`characterCardName`、`characterGroupId`、`locked`、`pinned`。
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatHistory.kt:10`
- `ChatMessage` 的 `sender` 取值 `"user"` / `"ai"`（另有 `"summary"` 用于总结消息）；`timestamp` 默认走 `ChatMessageTimestampAllocator.next()` 分配；`selectedVariantIndex` 为 0 表示原始回答，大于 0 表示选中的再生版本；构造时调 `observe` 把外部时间戳同步进分配器。
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:11`
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:13`
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:15`
  `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt:35`

`ChatMessageTimestampAllocator` 用 CAS 循环保证同一进程内新消息时间戳单调递增且不重复；`observe` 用于导入外部时间戳时把分配器水位推高。
`app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocator.kt:14`
`app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocator.kt:24`

### 3. 两级并发锁

写操作分两级锁：`globalMutex` 全局锁，`chatMutexes` 是按会话 ID 细分的 `Mutex` 池。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:446`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:449`

单会话的增删改（加消息、删消息、改标题、变体管理等）走 `chatMutex(chatId)`；跨会话的批量操作（`updateChatOrderAndGroup` 排序分组、`createBranch` 建分支）走 `globalMutex`。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:887`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:902`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1747`

`createNewChat` 插入新会话时不经过任何一层锁（见代码走查）。

### 4. 会话列表与当前会话

`chatHistoriesFlow` 把 `chatDao.getAllChats()` 映射成 `ChatHistory` 列表再 `stateIn(Lazily)` 共享。注意 `toChatHistory()` 里消息列表恒为空——注释写明"不加载完整消息，以提高侧边栏性能"。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:502`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:471`

会话列表 SQL 按 `pinned DESC, displayOrder ASC` 排序：置顶在前，再按显示顺序。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:17`

当前会话 ID 存在 DataStore（`current_chat_id`），`currentChatIdFlow` 对外暴露；读失败若是 `IOException` 则回退为空偏好（不抛错）。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:76`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:572`

`setCurrentChatId` / `clearCurrentChatId` 写 DataStore。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1425`

### 5. 消息水合（hydrate）

`hydrateMessages` 把变体按 `messageTimestamp` 分组拼回消息：`selectedVariantIndex == 0` 用基座消息；大于 0 时用 `MessageVariantEntity.applyTo` 把选中变体的内容、模型、token 等覆盖到基座上，并算出 `variantCount = 变体数 + 1`。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:139`

带 `chatId` 的重载先按可见消息的时间戳范围拉变体，避免全表扫描。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:161`

### 6. 写路径：先删后插、追加、更新

- `saveChatHistory`（全量保存/导入用）：在会话锁内先删该会话全部消息和变体，再批量插入。**没有包事务**，中途崩溃会丢整会话消息（见代码走查）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:609`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:669`
- `addMessage`（单条追加）：`orderIndex = 该会话最大 orderIndex + 1`，再刷新会话 `updatedAt`。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:887`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:705`
- `updateMessage`（流式更新常用）：选中变体大于 0 时只更新变体行并提前返回；更新基座时，只有"非流式"或"原内容为空且新内容非空"才刷新会话元数据时间戳；找不到同时间戳消息则改为插入。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1131`
- `deleteMessage`：先删该消息的变体，再删消息行，再刷会话元数据。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:994`
- `deleteMessagesFrom`：删指定时间戳及之后的消息和变体（截断用）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1317`
- `clearChatMessages`：清会话全部消息和变体，并把 token 计数归零。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1351`

### 7. 变体（多版本回答）管理

- `addMessageVariant`：只允许给 AI 消息加变体；新变体序号 = 现有变体数 + 1；返回 `AddedMessageVariant`（新选中序号 + 水合后的消息）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1249`
- `selectMessageVariant`：切换选中变体；序号大于 0 时先校验变体存在。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1290`
- `deleteMessageVariant`：删序号 0 的变体时，把第一个变体提拔为基座并整体重编号；删其他变体时删除后重编号，并按规则回退选中序号（后方还有变体则指向被删位置，否则退一格，最小为 0）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1020`
- `setMessageFavorite`：收藏状态相同时直接返回，不写库。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1229`

归档导入时有校验 `validateArchivedMessageVariants`：含变体的消息必须是 AI 发送；变体序号必须为正、互不重复；选中的序号必须存在。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:579`

### 8. 锚点插入与总结消息

`resolveAnchoredMessageLocked` 支持在前后两条消息之间插入：双锚点取时间戳中点 `(before + after) / 2`；只有前锚点则 `+1ms`，只有后锚点则 `-1ms`。锚点不存在、顺序非法、中点间隔不足 1ms 时全部拒绝并打 warn 日志；非空会话里不带任何锚点也拒绝插入。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:729`

`addSummaryMessageBetweenSliceNeighbors` 在插入前检查：相邻消息已有 `sender == "summary"` 的就取消，避免重复总结。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:830`

总结消息的读取侧：`getLatestSummaryTimestamp` 查 `sender = 'summary'` 的最大时间戳；`loadRuntimeChatMessages` / `loadMessagesAfterLatestSummaryInRange` 只加载最新总结之后的消息，控制上下文窗口。
`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:106`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2426`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2379`

### 9. 分支

`createBranch` 复制父会话元数据（`parentChatId` 指向父 ID，`locked=false`，`pinned=false`），用 SQL 的 `INSERT INTO ... SELECT` 批量复制消息和变体到指定时间戳（含），再把新分支设为当前会话。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1747`
`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:147`

`getBranches` / `getBranchesFlow` 按 `parentChatId` 查分支列表。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1812`

### 10. 锁定、置顶与删除保护

- `deleteChatHistory`：会话被锁定时返回 false 不删；删除后若删的是当前会话，顺手清除 DataStore 里的当前会话 ID。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1463`
- `canDeleteChatHistory`：会话不存在或被锁定都返回 false（查失败也返回 false）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1450`
- `updateChatLocked` / `updateChatPinned` 改锁定/置顶状态。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:681`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:694`
- `deleteGroup(groupName, deleteChats=true, ...)`：SQL 只删未锁定会话（`locked = 0`），被锁定的会话保留、仅移出分组。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:956`
  `app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:120`
- `deleteChatsByCharacterCardBinding`：批量删某角色卡（或未绑定）的未锁定会话；若当前会话在删除范围内，一并清除当前会话 ID。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2727`

### 11. 分组、角色卡、群组绑定

- `getChatHistoriesByCharacterCard`：默认角色卡返回"该角色卡 + 未绑定"会话；非默认卡只返回该卡会话。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:540`
  `app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:167`
- `updateGroupName` / `deleteGroup` 支持限定角色卡（SQL 批量），或作用于所有同名分组。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:929`
- `clearCharacterCardBinding` 把已删除角色卡绑定的会话置空；`reassignChatsToCharacterCard` 把某卡（或未绑定）会话批量转到新卡，返回受影响行数。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2326`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2341`
- 批量接口（空列表直接返回 0）：`assignCharacterCardToChats`、`assignCharacterGroupToChats`、`clearCharacterGroupBindingForChats`、`assignGroupToChats`、`renameCharacterCardInChats`、`renameRoleNameInMessages`。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2772`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2870`
- `characterCardStatsFlow` / `characterGroupStatsFlow`：按角色卡/群组统计会话数和消息数。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:529`

注意 SQL 细节：`updateChatCharacterCardName` 会把 `characterGroupId` 置 NULL，`updateChatCharacterGroupId` 会把 `characterCardName` 置 NULL——单会话同一时间只归属角色卡或群组之一。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt:77`

### 12. 工作区重命名

`renameManagedWorkspace` 只允许重命名"托管"工作区：名字非空、不含 `/` `\`、不是 `.`/`..`；会话必须绑定 workspace 且 `workspaceEnv` 为空；目录必须在 `filesDir/workspace` 下。校验后用 `File.renameTo` 改目录名，再更新会话标题和 workspace 路径。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1554`

### 13. 新建会话

`createNewChat` 标题为"新对话 + 时:分:秒"；分组按"显式指定 > 从某会话继承 > 不分组"三档确定；默认设为当前会话。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1492`

### 14. 搜索与定位预览

`searchChatIdsByContent`：先把 `\` `%` `_` 转义再走 `LIKE ... ESCAPE '\'`（大小写不敏感），返回含关键词的会话 ID 集合。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1719`
`app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt:228`

`loadChatMessageLocatorPreviews`：取每条消息前 48 字符的轻量预览（`LOCATOR_PREVIEW_CHAR_COUNT = 48`），支持关键词搜索定位；`displayMode = HIDDEN_PLACEHOLDER` 的用户消息在预览里内容置空。
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:95`
`app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2470`

### 15. 长消息分片读取

`ChatContentDao` 的所有正文查询都用 `SUBSTR(content, 1, 65_536)` 只取前 65_536 字符，超长消息再按 `messageId` 分片追读拼回，保证单行不撑爆 CursorWindow。
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt:11`
`app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt:423`

### 16. 导出

`exportChatHistoriesToDownloads(selectedChatIds, format, onProgress)`：

- 导出目录固定为 `OperitBackupDirs.chatDir()`（即 `backup/chat`）；文件名 `chat_backup_yyyy-MM-dd_HH-mm-ss`；失败时删除残留文件并返回 null。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1894`
  `app/src/main/java/com/ai/assistance/operit/data/backup/OperitBackupDirs.kt:12`
- MARKDOWN：打成 zip，每会话一个 `.md`；标题里的 `\/:*?"<>|` 替换成 `_`，超 50 字符截断，重名加 `(1)` 后缀。
  `app/src/main/java/com/ai/assistance/operit/data/exporter/MarkdownExporter.kt:19`
- JSON：流式写 Operit 归档（`archiveType = "operit_chat_archive"`，`formatVersion = 2`，含 `exportedAt`）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:204`
  `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt:15`
  `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt:16`
- HTML / TXT：正文总字符数达到 4_000_000 才走流式长文本导出（64KB 写缓冲、每 256KB 回调进度、每会话 `yield()` 让出）；低于阈值走全量内存拼接。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:96`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2048`
- CSV：`ChatHistoryCsv` 流式写，`format_version = "1"`，三类记录 `chat` / `message` / `variant`，48 列；字段含 `,` `"` 换行时才加引号，引号内双引号转义为 `""`。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:246`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatHistoryCsv.kt:15`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatHistoryCsv.kt:176`

导出器细节：

- `MarkdownExporter.exportSingle` 写 `<!-- chat-info: ... -->` 注释 + YAML front matter，消息按 `## 👤 User` / `## 🤖 Assistant` 分节。
  `app/src/main/java/com/ai/assistance/operit/data/exporter/MarkdownExporter.kt:32`
- `TextExporter` 用 60 字符宽分隔线，内容按 64KB 分片写并回调进度。
  `app/src/main/java/com/ai/assistance/operit/data/exporter/TextExporter.kt:16`
- `HtmlExporter` 对标题、分组、模型名做 HTML 转义（`&` `<` `>` `"` `'`）；正文按行处理，` ``` ` 代码围栏转 `<pre><code>`，其余行转义后加 `<br>`。
  `app/src/main/java/com/ai/assistance/operit/data/exporter/HtmlExporter.kt:334`
  `app/src/main/java/com/ai/assistance/operit/data/exporter/HtmlExporter.kt:346`

### 17. 导入

`importChatHistoriesFromUri(uri, format)`：

- MARKDOWN 格式先尝试按 zip 解析（每个 `.md` 条目走 `MarkdownConverter`）；失败再按普通文件读。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2164`
- OPERIT 格式走流式导入 `importOperitChatHistoriesStream`：`JsonReader` 逐元素解码，`BEGIN_OBJECT` 视为 Operit 归档（读 `chats` 数组），`BEGIN_ARRAY` 视为旧版会话数组；空消息会话跳过计数，已存在 ID 记 updated、新 ID 记 new。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:355`
- 其他格式整文件读成文本，走 `convertToOperitFormat`；空消息会话跳过；返回 `ChatImportResult(new, updated, skipped)`，`total = new + updated`。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2278`
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2882`

`convertToOperitFormat` 的格式分发：

- OPERIT：先 kotlinx 解码 `List<ChatHistory>`，失败回退 Gson（日期格式 `yyyy-MM-dd'T'HH:mm:ss`）。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2265`
- CHATGPT → `ChatGPTConverter`；CHATBOX → `ChatBoxConverter(context)`；MARKDOWN → `MarkdownConverter(context)`；GENERIC_JSON → `GenericJsonConverter()`；CLAUDE 暂不支持，**回退到通用 JSON 转换器**；未知格式抛 `ConversionException`。
  `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2278`

各转换器要点：

- `ChatGPTConverter`：从 `current_node` 沿 `parent` 回溯 `mapping` 还原消息链；跳过非用户自定义的系统消息和非 text 内容；`assistant` → `ai`；模型缺省 `gpt-3.5-turbo`，供应商填 `OpenAI`，分组填 `Imported from ChatGPT`。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatGPTConverter.kt:76`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatGPTConverter.kt:109`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatGPTConverter.kt:150`
- `ChatBoxConverter`：支持对象格式（单 session）和 KV 导出格式（`chat-sessions-list` + `session:<id>` 键）；顶层数组直接抛不支持；role 规范化（system → user）；无时间戳时用 `base + index*100` 递增；模型缺省 `chatbox`，供应商缺省 `ChatBox`。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatBoxConverter.kt:50`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatBoxConverter.kt:233`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatBoxConverter.kt:166`
- `MarkdownConverter`：整个文件视为一个对话；解析 `<!-- chat-info: -->` 和 `<!-- msg: user, model=..., timestamp=... -->` 注释还原结构；role 只接受明确名称。
  `app/src/main/java/com/ai/assistance/operit/data/converter/MarkdownConverter.kt:43`
  `app/src/main/java/com/ai/assistance/operit/data/converter/MarkdownConverter.kt:107`
- `GenericJsonConverter`：支持对话数组、消息数组、单个对话对象、单个消息对象；`system` → `user`；时间戳缺省 `base + index*100`；模型缺省 `unknown`，供应商缺省 `imported`。
  `app/src/main/java/com/ai/assistance/operit/data/converter/GenericJsonConverter.kt:57`
  `app/src/main/java/com/ai/assistance/operit/data/converter/GenericJsonConverter.kt:175`

导入前的格式侦测：`ChatFormatDetector`（object 单例）：

- `detectFormat(content)`：空白内容直接 UNKNOWN；检测顺序固定——先 Markdown，再 CSV，再 JSON（以 `{`/`[` 开头），最后默认纯文本。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt:16`
- Markdown 有强弱两档：任一行去空白后以 `<!-- chat-info:` / `<!-- msg:` 开头即强命中；弱匹配要求同时有 `#` 标题行和整行严格匹配 `## User/Assistant/AI/System/Model/用户/助手/系统/模型`（可选中英文冒号、不区分大小写）的对话标记。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt:126`
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt:142`
- CSV 双条件：首行小写化后含 timestamp/role/content/sender 之一，且含逗号的行数过半。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt:165`
- JSON 按键特征分流：`mapping`+`current_node`→CHATGPT；`id`+`title`+`messages`+`createdAt`→OPERIT；`uuid`/`chat_messages`→CLAUDE；`role`+`content`→GENERIC_JSON；空数组→GENERIC_JSON；解析抛错→UNKNOWN（解析器 `ignoreUnknownKeys = true`）。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt:82`
- `detectFormatByExtension(fileName)`：json→null（需内容检测）、md/markdown→MARKDOWN、csv→CSV、txt→PLAIN_TEXT、html/htm→UNKNOWN（暂不支持导入）。
  `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt:172`

`ChatFormat` 枚举 9 个值（OPERIT / CHATGPT / CHATBOX / CLAUDE / MARKDOWN / GENERIC_JSON / CSV / PLAIN_TEXT / UNKNOWN），`ExportFormat` 5 个值（JSON / MARKDOWN / HTML / TXT / CSV）。
`app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormat.kt:8`
`app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormat.kt:38`

### 18. 业务侧调用方

`ChatHistoryDelegate` 持有 `ChatHistoryManager.getInstance(context)`，是业务层门面：用 80 条一批的倒序分页（`DISPLAY_WINDOW_QUERY_BATCH_SIZE = 80`）组装当前会话显示窗口，订阅 `chatHistoriesFlow` / `currentChatIdFlow` 做 UI 同步，删除当前会话前先切到替代会话再调 `deleteChatHistory`。
`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:50`
`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:44`
`app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:1061`

## 关键符号

| 符号 | 说明 |
|---|---|
| `ChatHistoryManager` | 单例门面，聊天记录数据层唯一读写入口 |
| `chatHistoriesFlow` | 会话列表响应式流（消息列表恒为空，侧边栏用） |
| `currentChatIdFlow` | 当前会话 ID 响应式流（DataStore 持久化） |
| `ChatEntity` | `chats` 表实体，会话元数据 |
| `ChatHistory` | UI 侧会话模型 |
| `MessageEntity` | `messages` 表实体 |
| `ChatMessage` | UI 侧消息模型 |
| `MessageVariantEntity` | `message_variants` 表实体，AI 回答多版本 |
| `OperitArchivedChat` / `OperitChatArchive` | 导出归档模型（`archiveType = "operit_chat_archive"`，版本 2） |
| `ChatImportResult` | 导入统计（new / updated / skipped） |
| `AddedMessageVariant` | 加变体结果（新选中序号 + 水合后消息） |
| `ChatExportProgress` / `ChatExportResult` | 长文本导出进度 / 导出结果（文件路径 + 会话数） |
| `ChatHistoryCsv` | CSV 导出器（format_version 1，三类记录） |
| `ChatFormat` / `ExportFormat` | 导入格式枚举（9 值）/ 导出格式枚举（5 值） |
| `ChatFormatDetector` | 导入格式侦测（object 单例：内容检测 + 扩展名推测两路） |
| `ChatFormatConverter` | 转换器接口（`convert` + `getSupportedFormat`） |
| `ChatMessageTimestampAllocator` | 进程内单调时间戳分配器 |
| `globalMutex` / `chatMutexes` | 全局锁 / 按会话锁池 |
| `ChatHistoryDelegate` | 业务侧门面（services/core） |

## 输入→处理→输出调用链

### 链路 A：用户发一条消息并持久化

1. 输入：`ChatHistoryDelegate.addMessageToChat(message)`（流式时走 `updateMessage`，新消息走 `addMessage`）。
   `app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt:50`
2. 处理：`ChatHistoryManager.addMessage` 在 `chatMutex(chatId)` 内调 `persistMessageLocked`，`orderIndex` 取该会话最大值 + 1 后 `insertMessage`，再刷会话 `updatedAt`。
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:887`
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:705`
3. 输出：返回持久化的 `ChatMessage`；`chatDao.getAllChats()` 的 Flow 自动推送新列表，UI 侧边栏刷新。

### 链路 B：导入一份 Operit 归档备份

1. 输入：`importChatHistoriesFromUri(uri, ChatFormat.OPERIT)`。
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2164`
2. 处理：`importOperitChatHistoriesStream` 用 `JsonReader` 流式逐会话解码（归档对象读 `chats` 数组，旧版读顶层数组）；`consumeImportedChat` 按 ID 判 new/updated，空消息会话记 skipped；`saveArchivedChat` → `saveChatHistoryInternal` 在会话锁内先删后插。
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:355`
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:303`
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:311`
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:609`
3. 输出：`ChatImportResult(new, updated, skipped)`。
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:2882`

### 链路 C：导出选中会话为 Markdown 包

1. 输入：`exportChatHistoriesToDownloads(selectedChatIds, ExportFormat.MARKDOWN, onProgress)`。
   `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt:1894`
2. 处理：`loadDisplayHistories` 补全消息 → `MarkdownExporter.exportSingle` 逐会话生成 Markdown（含 `chat-info` 注释和 YAML front matter）→ 写入 `backup/chat/chat_backup_<时间>.zip`，文件名做非法字符替换、50 字符截断、重名去重。
   `app/src/main/java/com/ai/assistance/operit/data/exporter/MarkdownExporter.kt:32`
3. 输出：`ChatExportResult(filePath, chatCount)`；异常时删除残留文件并返回 null。

## 来源

- `app/src/main/java/com/ai/assistance/operit/data/repository/ChatHistoryManager.kt`（2889 行，本页种子，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/dao/ChatDao.kt`（287 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/dao/MessageDao.kt`（245 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/dao/MessageVariantDao.kt`（82 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/dao/ChatContentDao.kt`（471 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatEntity.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/MessageEntity.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/MessageVariantEntity.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatHistory.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessage.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/OperitChatArchive.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/model/ChatMessageTimestampAllocator.kt`（35 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormat.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatConverter.kt`（全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatFormatDetector.kt`（181 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatGPTConverter.kt`（209 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatBoxConverter.kt`（327 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/MarkdownConverter.kt`（290 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/GenericJsonConverter.kt`（209 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/converter/ChatHistoryCsv.kt`（198 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/exporter/HtmlExporter.kt`（496 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/exporter/MarkdownExporter.kt`（132 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/exporter/TextExporter.kt`（201 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/data/backup/OperitBackupDirs.kt`（50 行，全部读完）
- `app/src/main/java/com/ai/assistance/operit/services/core/ChatHistoryDelegate.kt`（1696 行，全部读完）
