---
title: 聊天/备份/历史设置界面
module: 用户界面 / app
sources: 13
date: 2026-10-01
---

# 聊天/备份/历史设置界面（ui-settings-chat）

## 概述

这组界面管三件事：**数据进出**（导出、导入、删除）、**故障兜底**（Room 数据库备份、原生快照备份）和**对话上下文治理**（总结阈值、历史保留回合、聊天记录的批量管理）。共有 13 个 Kotlin 源文件：4 个屏幕级页面 + 9 个组件/枚举文件，分布在 `ui/features/settings/screens/` 与 `ui/features/settings/components/`。

先纠正一个容易误会的点：`ChatHistorySettingsScreen` 虽然叫"设置"，里面**没有任何开关式设置项**——它是个管理操作屏（批量删、批量绑定、记忆重建）。真正的"设置项"分散在另外三个屏幕：备份自动化的开关在 `ChatBackupSettingsScreen`，上下文总结参数在 `ContextSummarySettingsScreen`，功能→模型映射在 `FunctionalConfigScreen`。

## AI 速览

- **核心符号**：`ChatBackupSettingsScreen`（备份主屏）、`ChatHistorySettingsScreen`（历史管理屏）、`ContextSummarySettingsScreen`（总结设置屏）、`FunctionalConfigScreen`（功能配置屏）、`ChatHistoryManager`（聊天 CRUD）、`CharacterCardManager`（角色卡导入导出）、`MemoryRepository`（记忆导入导出）、`ModelConfigManager`（模型配置导入导出）、`RoomDatabaseBackupManager` / `RoomDatabaseRestoreManager`（RoomDB 备份/恢复）、`RawSnapshotBackupManager`（原生快照）、`FunctionalConfigManager`（功能映射）、`MarkdownSyntaxHighlighting`（输入框 Markdown 实时高亮）。
- **主入口**：`ChatBackupSettingsScreen()`（LazyColumn 拼装 9 个区块，备份设置主屏）。
- **数据流向一句话**：UI 事件 → 屏幕级函数在 `Dispatchers.IO` 协程里调对应 Manager → 结果回写 `remember` 状态 + Toast/对话框反馈；功能配置映射走 DataStore 键 `function_config_mapping`；总结参数随模型配置 JSON 走 `model_configs` DataStore。

## 核心机制

### 1. 备份设置主屏（ChatBackupSettingsScreen）

页面是一个 `LazyColumn`，自上而下 9 个区块：

1. **数据总览**（`OverviewCard`）：当前记忆空间名 + 聊天数/角色卡数/记忆数/记忆链接数四个 `StatChip`。
2. **备份统计**（`BackupFilesStatisticsCard`）：统计 5 类备份文件数量。扫描逻辑兼容新旧两套目录（新目录 + 旧 `operitRootDir()`），合并后按文件名去重。扫描中显示 24dp 圆形进度条。
3. **聊天记录管理**（`DataManagementCard`）：导出/导入/删除全部三个按钮。注意一个反直觉细节：导出按钮用的是 **CloudDownload（下载）** 图标、导入用 **CloudUpload（上传）**——和常规语义是反的，看按钮文字不要只看图标。
4. **角色卡管理**（`CharacterCardManagementCard`）：导出/导入。
5. **记忆管理**（`MemoryManagementCard`）：展示记忆数与关联数 + 导出/导入按钮。
6. **模型配置管理**（`ModelConfigManagementCard`）：总数 + 导出/导入按钮。
7. **FAQ**（`FaqCard`）：三问——为什么备份 / 备份存哪 / 重复导入怎么办。
8. **Room 数据库备份**：每日自动备份开关（默认开）、备份份数（下限 1、上限 100，调小后立即 `pruneExcessBackups` 清理）、立即备份按钮、最近 3 份备份列表（带恢复按钮）。
9. **原生快照**：`RawSnapshotBackupManager.exportToBackupDir(context, onProgress)`，进度分 8 个阶段。

四个操作状态枚举并排定义在文件头部：`RoomDatabaseBackupOperation`、`RoomDatabaseRestoreOperation`（均为 IDLE/…/SUCCESS/FAILED 四态）、`RawSnapshotOperation`（五态）。注意命名不一致：原生快照的成功态叫 `BACKUP_SUCCESS`，而 `BackupOperationTypes.kt` 里的三个枚举用 `EXPORTED`/`IMPORTED`。

### 2. 导出/导入/删除的细节

**聊天记录**：导出默认 JSON，可选 MARKDOWN/HTML/TXT/CSV；导入默认 OPERIT，可选 CHATGPT/CHATBOX/MARKDOWN/GENERIC_JSON（以及 CLAUDE）。导出前可多选会话（`ChatHistoryExportSelectionDialog`，不选会话确认键禁用）。导出是长文本逐字符进度回调。`deleteAllChatHistories` 在 `Dispatchers.IO` 逐条删除，被锁定的会话返回 false、计入 `skippedLockedCount`——批量删除**非原子**：被锁定的会话被跳过，最终是删一部分、留一部分的结果。

**角色卡**：导出调 `CharacterCardManager.exportAllCharacterCardsToBackupFile()`，成功 Toast 里带备份文件路径；导入读整文件文本后调 `importAllCharacterCardsFromBackupContent`，返回 total/new/updated/skipped 四元结果。

**记忆**：导出先选记忆空间（默认当前活动空间），`memoryRepository.exportMemoriesToJson()` 生成 JSON，文件名 `memory_backup_yyyy-MM-dd_HH-mm-ss.json`。导出时**过滤掉文档节点**（`!it.isDocumentNode`）。导入先做空串校验，再按策略（SKIP/UPDATE/CREATE_NEW，默认 SKIP）调 `importMemoriesFromJson`。`CREATE_NEW` 创建新记录，重复导入同一份文件会产生重复数据。

**模型配置**：导出文件名 `model_config_backup_yyyy-MM-dd_HH-mm-ss.json`，`exportFile.writeText(jsonContent)` **明文写入、无加密**。导出成功后弹 `ModelConfigExportWarningDialog` 安全警告——这个对话框**只有一个知悉按钮**，没有"取消导出"选项（导出已经完成了），也没有密码/加密选项。导入调 `modelConfigManager.importConfigs`，返回 new/updated/skipped 三元组。

### 3. Room 数据库备份与原生快照

**RoomDB 备份**：`RoomDatabaseBackupManager.backupIfNeeded(context, force=true)` 在 IO 线程执行。自动备份文件名 `room_db_backup_<timestamp>.zip`，手动备份 `room_db_manual_backup_<yyyy-MM-dd_HH-mm-ss>.zip`。列表项 `RoomDbBackupListItem` 解析文件名展示类型与时间，手动备份时间解析失败时显示原串不崩溃。恢复前有确认对话框，恢复成功后要求重启 App（恢复数据库必须重启）。

**原生快照**（整机级备份）：8 个备份阶段里包含 `ZIPPING_SHARED_PREFS` 与 `ZIPPING_DATASTORE`——即 SharedPreferences 与 DataStore 的原始文件被原样打进 zip。恢复时对应 `REPLACING_SHARED_PREFS` / `REPLACING_DATASTORE`，恢复完成后直接 `exitProcess(0)` 杀进程重启（代码注释原话：open process may retain stale DataStore state）。恢复流程里取持久 URI 权限失败时 `catch (_: Exception) {}` 空处理，不影响继续恢复、也无提示。

### 4. 聊天历史管理屏（ChatHistorySettingsScreen）

这个屏不写任何持久化键，纯操作屏，五个区块：

1. **总览卡**：聊天记录总数 + 当前记忆空间名称。
2. **角色卡统计卡**：按角色卡名聚合聊天数/消息数；未绑定或角色卡丢失的条目**标红、可点击处理**。
3. **角色群组统计卡**：按群组聚合，丢失的群组排最前标红。
4. **批量选择器**：搜索过滤 + 多选列表，可批量绑定角色卡/群组/分组、批量删除、聊天记忆重建。批量操作成功后自动清空选中。角色卡与群组批量绑定互斥：指定群组目标时角色卡绑定不被同时改动。
5. **无绑定工作区**：检测内部 `filesDir/workspace` + 外部 `Downloads/Operit/workspace` 两个目录，无确认以外的保护、直接 `deleteRecursively()` 物理删除整个目录。

**记忆重建**：窗口大小可选 16/24/32/48 条消息；时间范围可选全部（ENTIRE）或自定义日期范围（RANGE）。进度五态 PREPARING/RUNNING/COMPLETED/CANCELLED/FAILED，可取消；运行时批量操作被锁定（`canSubmit` 要求 `!isMemoryRebuildRunning`）。

### 5. 上下文与总结设置（ContextSummarySettingsScreen）

**全自动保存**：`snapshotFlow{}.drop(1).debounce(700).distinctUntilChanged().collectLatest{}`——输入变化 700ms 防抖后写回，无显式保存按钮。

**总结触发双条件**：
- 上下文使用比例超过阈值（默认 0.70）。注意：UI 文案写范围 0.1–0.95，但代码实际接受 (0,1) 开区间任意值——0.05、0.99 也能存。
- 新消息数达到阈值（默认 16，需开 `enableSummaryByMessageCount`）。UI 文案写 1–20 条，代码只校验 >0、**没有 20 上限**。

**默认值**（随模型配置 JSON 存 `model_configs` DataStore）：`enableSummary=true`、`summaryTokenThreshold=0.70f`、`enableSummaryByMessageCount=true`、`summaryMessageCountThreshold=16`。

**提示词三层可配**：
- 全局自定义规则 `summaryCustomRules`（自由文本）；
- 四节标题/指令覆盖 `summarySectionOverrides`——四节 id 为 core_task（核心任务）、interaction（互动）、progress（进展）、key_info（关键信息），只保存与默认值的差异字段，全无差异则不存；
- 对话回顾开关 `enableSummaryDialogueReview` + 自定义标题。

**注意**：本页没有独立的摘要模型选择器，总结绑定当前 CHAT 功能的模型配置（`functionMappings[FunctionType.CHAT]`）。关闭 `enableSummary` 总开关时不清空阈值等字段，重开即恢复。

**历史保留回合**：图片默认保留 2 个用户回合（键 `max_image_history_user_turns`）、音视频默认 1 回合（键 `max_media_history_user_turns`），输入框校验仅 `toIntOrNull` 且 ≥0——**0 是合法值**，表示不保留。阈值/回合数校验失败时报错提示，不写回。

**全屏文本编辑器**（`FullscreenSettingsTextEditor`）：关闭、确认、返回手势都会调 `finishEditing()` 写回——**没有真正的取消路径**，误改无法放弃。

### 6. 功能配置映射（FunctionalConfigScreen）

这个屏**没有开关式配置项**，是 11 个功能类型到模型配置的映射页：CHAT / SUMMARY / TITLE_GENERATION / MEMORY / UI_CONTROLLER / TRANSLATION / GREP / ROLE_RESPONSE_PLANNER / IMAGE_RECOGNITION / AUDIO_RECOGNITION / VIDEO_RECOGNITION。

- 持久化键 `function_config_mapping`（DataStore），默认全部 → `FunctionConfigMapping("default", 0)`。
- 每个功能类型一张卡：下拉选择模型配置 + 连接测试（图像/音频/视频三类还能测试媒体处理能力）。
- **CHAT 功能特殊规则**：选中含 `autoglm` 的模型时弹 Toast 警告并阻止选择（autoglm 有专用场景限制）；其他功能类型允许。
- 图像/音频/视频识别三类，如果配置未启用"直接媒体处理"（靠模型本身多模态），显示红色能力不足警告。
- 连接测试是 `stream=false、enableRetry=false` 的真实小样本调用，不是 ping；媒体测试的临时文件在 `finally` 里 `runCatching` 清理；测试结果 5 秒后自动清空。
- **重置全部**按钮点击即 `resetAllFunctionConfigs()` + 刷新所有服务，**无确认对话框**、不可撤销。

### 7. 小组件文件

- **`BackupCards.kt`**：`OverviewCard`（四统计）、`BackupFilesStatisticsCard`（五类文件计数+刷新）、`DataManagementCard`（导出/导入/删除全部）。
- **`BackupManagementCards.kt`**：`DataManagementCard`、`CharacterCardManagementCard`、`MemoryManagementCard`、`ModelConfigManagementCard`、`FaqCard`、`OperationResultCard`。注意四张管理卡都是**纯 UI 回调**（`onExport/onImport/onDelete`），没有备份文件列表、没有恢复对话框。
- **`BackupDialogs.kt`**：12 个 @Composable（含 5 个选项行组件）。删除确认键红色；导出格式（5 种）与导入格式（5 种）是**不同枚举**；`ChatHistoryExportSelectionDialog` 未选会话时确认键禁用；全文件无密码输入框、无加密选项、无进度对话框。
- **`RoomDbBackupComponents.kt`**：只渲染备份列表项（`RoomDbBackupListItem`），恢复确认与执行逻辑不在此文件。`input.parse(raw)!!` 是个非空断言写法（外层 try/catch 兜底不崩溃）。
- **`BackupMemoryImportStrategyStrings.kt`**：记忆导入三策略文案——SKIP 跳过（推荐）/ UPDATE 更新 / CREATE_NEW 创建新记录（重复导入产生重复数据），冲突判定依据 UUID 是否重复。
- **`BackupOperationTypes.kt`**：`ChatHistoryOperation` 8 态（IDLE/EXPORTING/EXPORTED/IMPORTING/IMPORTED/DELETING/DELETED/FAILED）——是唯一带删除态的；其余三个 6 态（无 DELETING/DELETED）。
- **`ChatStyleOption.kt`**：通用样式选项卡片（title+selected+onClick），不定义具体样式枚举，样式列表由调用方传入。
- **`MarkdownSyntaxHighlighting.kt`**：纯手写字符扫描器（`scanMarkdownSyntax`/`scanInlineSyntax`，无正则），8 种 token（HEADING/EMPHASIS/CODE/LINK/QUOTE/MARKER/COMMENT/HTML）。`MAX_INLINE_TOKEN_LENGTH=512` 限制行内 token 向后搜索长度，防止畸形分隔符触发全行重复搜索。`rememberMarkdownSyntaxOutputTransformation` 返回 Compose `OutputTransformation`——是对**输入框源文本做原位样式变换**，不是渲染器。围栏代码块开栏要求 ``` / ~~~ 长度 ≥3，闭栏同标记且长度 ≥ 开栏、其后仅空白。
- **`ExpandableStatusText.kt`**：默认收起 1 行 + 省略号；展开按钮（···）只在**实测溢出**（`onTextLayout` 的 `hasVisualOverflow`，非字符数估算）时渲染；文本变化时自动复位为收起。

## 关键符号

| 符号 | 角色 |
|---|---|
| `ChatBackupSettingsScreen()` | 备份设置主屏，LazyColumn 拼装 9 区块 |
| `ChatHistorySettingsScreen()` | 聊天历史管理操作屏（无持久化键） |
| `ContextSummarySettingsScreen()` | 上下文与总结设置页，全自动保存 |
| `FunctionalConfigScreen()` | 11 功能类型→模型配置映射页 |
| `ChatHistoryManager` | 聊天记录 CRUD、导入导出执行 |
| `CharacterCardManager` | 角色卡导入导出 |
| `MemoryRepository` | 记忆导入导出（`exportMemoriesToJson`/`importMemoriesFromJson`） |
| `ModelConfigManager` | 模型配置导入导出 |
| `RoomDatabaseBackupManager` | RoomDB 备份（`backupIfNeeded`） |
| `RoomDatabaseRestoreManager` | RoomDB 恢复（`restoreFromBackupFile`/`restoreFromBackupUri`） |
| `RawSnapshotBackupManager` | 原生快照备份/恢复（`exportToBackupDir`） |
| `FunctionalConfigManager` | 功能映射读写（键 `function_config_mapping`） |
| `ChatHistoryOperation` / `MemoryOperation` / `CharacterCardOperation` / `ModelConfigOperation` | 四类操作状态枚举 |
| `MarkdownSyntaxKind` | 8 种 Markdown token 枚举 |
| `ModelConfigDefaults` | 总结阈值等默认值（`DEFAULT_SUMMARY_TOKEN_THRESHOLD=0.70f` 等） |

## 输入→处理→输出调用链

1. **输入**：用户点击导出/导入/删除按钮 → 对话框收集参数（格式选择、会话多选、记忆空间、导入策略）。
2. **处理**：屏幕级函数在 `Dispatchers.IO` 协程里调对应 Manager：
   - 聊天导出：`ChatHistoryManager.exportChatHistoriesToDownloads(selectedChatIds, format, onProgress)`（长文本逐字符进度）；
   - 聊天导入：`chatHistoryManager.importChatHistoriesFromUri(uri, format)`；
   - 记忆导出：`memoryRepository.exportMemoriesToJson()` → 写 `memory_backup_<时间>.json`；
   - 模型配置导出：`exportFile.writeText(jsonContent)` 明文落盘 → 弹安全警告；
   - RoomDB 备份：`RoomDatabaseBackupManager.backupIfNeeded(context, force=true)`；
   - 原生快照：`RawSnapshotBackupManager.exportToBackupDir(context, onProgress)`（8 阶段）；
   - 功能映射：`FunctionalConfigManager` 读写 DataStore 键 `function_config_mapping`，改动后 `EnhancedAIService.refreshAllServices(context)`。
3. **输出**：结果回写 `remember` 状态 → `OperationResultCard` / Toast / 对话框反馈；需要重启的恢复类操作弹重启确认对话框；`refreshStats()` 重新扫描备份目录统计。

## 来源

机器可读事实：ui-settings-chat.facts.json（115 条，引用逐条验真）
代码走查：ui-settings-chat.quality.json（17 条：高危 2 / 警告 8 / 建议 7）

13 个种子文件（Operit @ dbf71916，2026-10-01 精读）：

- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ChatBackupSettingsScreen.kt`（1649 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ChatHistorySettingsScreen.kt`（2576 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/ContextSummarySettingsScreen.kt`（1489 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/screens/FunctionalConfigScreen.kt`（1061 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/BackupCards.kt`（319 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/BackupManagementCards.kt`（588 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/BackupDialogs.kt`（784 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/RoomDbBackupComponents.kt`（97 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/BackupMemoryImportStrategyStrings.kt`（28 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/BackupOperationTypes.kt`（39 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ChatStyleOption.kt`（39 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/MarkdownSyntaxHighlighting.kt`（600 行）
- `app/src/main/java/com/ai/assistance/operit/ui/features/settings/components/ExpandableStatusText.kt`（72 行）

另引用 `data/model/ModelConfigData.kt`（总结默认值）、`data/preferences/ApiPreferences.kt`（历史保留回合键与默认值）、`data/repository/MemoryRepository.kt`（记忆导出过滤/导入策略）、`data/repository/ChatHistoryManager.kt`（CLAUDE 回退）、`api/chat/library/ChatMemoryRebuildManager.kt`（记忆重建状态）、`core/config/FunctionalPrompts.kt`（总结分节）、`data/model/FunctionType.kt`（功能类型枚举）、`data/preferences/FunctionalConfigManager.kt`（功能映射持久化）、`data/preferences/CharacterCardManager.kt`（导入结果类型）、`data/backup/RoomDatabaseBackupManager.kt`（备份命名/走查证据）与 `data/backup/RoomDatabaseRestoreManager.kt`（走查证据）。
